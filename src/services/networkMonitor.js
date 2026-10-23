import { setLiveTelemetry, liveTelemetryStore } from '../state/playbackStore'

const PING_INTERVAL_MS = 2000
const NETWORK_CHANNEL = 'echosync-network-telemetry-v1'
const LOW_LATENCY_MS = 180
const MEDIUM_LATENCY_MS = 550

let started = false
let pingTimer = null
let echoTimer = null
let channel = null
let preferredQuality = 'high'
let apiLatencyMs = 0
let echoLatencyMs = 0
let lastLatencyMs = null
let jitterMs = 0
let connection = null

function readConnection() {
  if (typeof navigator === 'undefined') return null
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
}

function isSlowConnection() {
  const info = connection || readConnection()
  if (!info) return false
  const effectiveType = String(info.effectiveType || '').toLowerCase()
  const downlink = Number(info.downlink)
  const rtt = Number(info.rtt)
  if (['slow-2g', '2g', '3g'].includes(effectiveType)) return true
  if (Number.isFinite(rtt) && rtt > MEDIUM_LATENCY_MS) return true
  if (Number.isFinite(downlink) && downlink > 0 && downlink < 1) return true
  return false
}

function qualityFromNetwork() {
  const info = connection || readConnection()
  const effectiveType = String(info?.effectiveType || '').toLowerCase()
  const rtt = Number(info?.rtt)
  if (isSlowConnection()) {
    if (effectiveType === '2g' || effectiveType === 'slow-2g' || (Number.isFinite(rtt) && rtt > 900)) return 'saver'
    return 'normal'
  }
  const measured = Math.max(apiLatencyMs, echoLatencyMs)
  if (measured > MEDIUM_LATENCY_MS) return 'saver'
  if (measured > LOW_LATENCY_MS) return 'normal'
  return preferredQuality
}

function publishTelemetry() {
  const quality = qualityFromNetwork()
  setLiveTelemetry({
    networkLatencyMs: Math.max(0, Math.round(Math.max(apiLatencyMs, echoLatencyMs))),
    jitterMs: Math.round(jitterMs),
    quality,
  })
}

async function pingProxy() {
  if (typeof window === 'undefined' || document.visibilityState === 'hidden') return
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)
  const startedAt = performance.now()
  try {
    const response = await fetch(`/api/media?_ping=${Date.now()}`, {
      method: 'OPTIONS',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('Telemetry endpoint unavailable')
    apiLatencyMs = performance.now() - startedAt
    const currentRtt = apiLatencyMs
    jitterMs = lastLatencyMs == null ? 0 : Math.abs(currentRtt - lastLatencyMs)
    lastLatencyMs = currentRtt
  } catch {
    const info = connection || readConnection()
    const reported = Number(info?.rtt)
    apiLatencyMs = Number.isFinite(reported) && reported > 0 ? reported : Math.max(apiLatencyMs, 900)
  } finally {
    clearTimeout(timeout)
    connection = connection || readConnection()
    publishTelemetry()
  }
}

function setupChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  try {
    channel = new BroadcastChannel(NETWORK_CHANNEL)
    channel.onmessage = (event) => {
      const data = event.data
      if (!data) return
      if (data.type === 'ping') {
        channel.postMessage({ type: 'pong', id: data.id, sentAt: data.sentAt })
        return
      }
      if (data.type === 'pong') {
        const elapsed = performance.now() - Number(data.sentAt || performance.now())
        if (elapsed > 0 && elapsed < 4000) {
          echoLatencyMs = echoLatencyMs ? echoLatencyMs * 0.6 + elapsed * 0.4 : elapsed
          publishTelemetry()
        }
      }
    }
    echoTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      channel?.postMessage({ type: 'ping', id: `${Date.now()}-${Math.random()}`, sentAt: performance.now() })
    }, 4000)
  } catch {
    channel = null
  }
}

export function startNetworkMonitor() {
  if (started || typeof window === 'undefined') return
  started = true
  connection = readConnection()
  connection?.addEventListener?.('change', publishTelemetry)
  setupChannel()
  pingProxy()
  pingTimer = setInterval(pingProxy, PING_INTERVAL_MS)
}

export function stopNetworkMonitor() {
  if (!started) return
  started = false
  clearInterval(pingTimer)
  clearInterval(echoTimer)
  connection?.removeEventListener?.('change', publishTelemetry)
  channel?.close()
  channel = null
}

export function setPreferredStreamQuality(value) {
  preferredQuality = ['high', 'normal', 'saver'].includes(value) ? value : 'high'
  publishTelemetry()
}

export function getActiveStreamQuality() {
  return qualityFromNetwork()
}

export function getNetworkSnapshot() {
  return liveTelemetryStore.get()
}

export function recordRoomDrift(driftSeconds) {
  const drift = Math.max(0, Number(driftSeconds) || 0) * 1000
  setLiveTelemetry({ roomDriftMs: Math.round(drift) })
}
