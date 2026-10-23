let youtubeClientPromise
const cache = new Map()
const inflight = new Map()

async function youtubeClient() {
  if (!youtubeClientPromise) {
    youtubeClientPromise = import('youtubei.js')
      .then(({ Innertube }) => Innertube.create({
        lang: 'en', location: 'US',
        fetch: (input, init = {}) => {
          const deadline = AbortSignal.timeout(10_000)
          const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline
          return globalThis.fetch(input, { ...init, signal })
        },
      }))
      .catch(error => { youtubeClientPromise = null; throw error })
  }
  return youtubeClientPromise
}

export async function extractYouTubeAudio(videoId) {
  const now = Date.now()
  for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key)
  if (cache.has(videoId)) return cache.get(videoId).data
  if (inflight.has(videoId)) return inflight.get(videoId)
  const task = (async () => {
    const client = await youtubeClient()
    let lastError
    for (const clientType of ['VISIONOS', 'IOS', 'ANDROID_VR']) {
      try {
        const info = await client.getBasicInfo(videoId, { client: clientType })
        const format = info.chooseFormat({ type: 'audio', quality: 'best' })
        if (!format?.url) continue
        const data = { url: format.url, mimeType: format.mime_type || 'audio/mp4',
          bitrate: Number(format.bitrate || format.average_bitrate) || 0,
          duration: Number(info.basic_info?.duration) || Math.round(Number(format.approx_duration_ms || 0) / 1000) || 0,
          title: info.basic_info?.title || '', author: info.basic_info?.author || '',
          thumbnail: info.basic_info?.thumbnail?.[0]?.url || '' }
        const signedExpiry = Number(new URL(data.url).searchParams.get('expire')) * 1000
        const expiresAt = Math.min(Date.now() + 15 * 60_000, signedExpiry > 0 ? signedExpiry - 60_000 : Infinity)
        if (cache.size >= 200) cache.delete(cache.keys().next().value)
        if (expiresAt > Date.now()) cache.set(videoId, { data, expiresAt })
        return data
      } catch (error) { lastError = error }
    }
    throw lastError || new Error('No playable audio format found')
  })().finally(() => inflight.delete(videoId))
  inflight.set(videoId, task)
  return task
}

export function createYoutubeAudioHandler({ resolve = extractYouTubeAudio, timeoutMs = 12_000 } = {}) {
  return async function youtubeAudioHandler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    const fail = (status, error) => { if (!res.destroyed) { res.statusCode = status; res.end(JSON.stringify({ error })) } }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); fail(405, 'Method not allowed'); return }
    const url = new URL(req.originalUrl || req.url, 'http://localhost')
    const videoId = req.query?.videoId ?? url.searchParams.get('videoId') ?? url.pathname.match(/\/api\/youtube\/audio\/([^/]+)\/?$/)?.[1]
    if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) { fail(400, 'Invalid video id'); return }
    let timer
    let close
    try {
      const disconnected = new Promise((_, reject) => { close = () => reject(new Error('Client disconnected')); res.once('close', close) })
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Resolver deadline')), timeoutMs) })
      const data = await Promise.race([resolve(videoId), deadline, disconnected])
      if (!res.destroyed) res.end(JSON.stringify(data))
    } catch { fail(502, 'Unable to resolve audio') }
    finally { clearTimeout(timer); res.off('close', close) }
  }
}

export const youtubeAudioHandler = createYoutubeAudioHandler()
