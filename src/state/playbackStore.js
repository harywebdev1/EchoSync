import { useSyncExternalStore } from 'react'

function createExternalStore(initialValue) {
  let value = initialValue
  const listeners = new Set()
  const notify = () => listeners.forEach((listener) => listener())
  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === 'function' ? next(value) : next
      if (Object.is(resolved, value)) return
      value = resolved
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const playbackProgressStore = createExternalStore(0)

const initialTelemetry = {
  roomDriftMs: 0,
  driftMeasuredAt: 0,
  networkLatencyMs: 0,
  jitterMs: 0,
  bufferedPct: 0,
  quality: 'high',
  updatedAt: 0,
}

export const liveTelemetryStore = createExternalStore(initialTelemetry)

function telemetryChanged(current, next) {
  return Object.keys(next).some((key) => {
    if (key === 'updatedAt') return false
    const before = Number(current[key])
    const after = Number(next[key])
    if (Number.isFinite(before) && Number.isFinite(after)) {
      return Math.abs(before - after) >= 0.5
    }
    return current[key] !== next[key]
  })
}

export function setLiveTelemetry(patch) {
  if (!patch || typeof patch !== 'object') return
  const current = liveTelemetryStore.get()
  const next = { ...current, ...patch, updatedAt: Date.now() }
  if (!telemetryChanged(current, next)) return
  liveTelemetryStore.set(next)
}

export function resetRoomTelemetry() {
  setLiveTelemetry({ roomDriftMs: 0, driftMeasuredAt: 0, bufferedPct: 0 })
}

export function usePlaybackProgress() {
  return useSyncExternalStore(
    playbackProgressStore.subscribe,
    playbackProgressStore.get,
    playbackProgressStore.get,
  )
}

export function useLiveTelemetry() {
  return useSyncExternalStore(
    liveTelemetryStore.subscribe,
    liveTelemetryStore.get,
    liveTelemetryStore.get,
  )
}
