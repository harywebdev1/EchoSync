const warmAudio = new Map()
const resolvedTracks = new Map()
const readyTracks = new Map()
export function getPreloadedTrack(id) {
  const entry = readyTracks.get(id)
  if (!entry || entry.expiresAt <= Date.now()) { readyTracks.delete(id); if (entry) resolvedTracks.delete(id); return null }
  return entry.track
}
const MAX_WARM_TRACKS = 5

function trimWarmAudio() {
  while (warmAudio.size > MAX_WARM_TRACKS) {
    const [key, audio] = warmAudio.entries().next().value || []
    if (!key) break
    try {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    } catch {
      /* ignore */
    }
    warmAudio.delete(key)
  }
}

function warmStream(url) {
  if (!url) return null
  if (warmAudio.has(url)) return warmAudio.get(url)
  try {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = url
    warmAudio.set(url, audio)
    audio.load()
    trimWarmAudio()
    return audio
  } catch {
    /* prewarming is best-effort */
  }
}

export function preloadTrack(track, { resolve, force = false } = {}) {
  const id = track?.id
  if (!id || id === 'empty' || /^http/i.test(id)) return Promise.resolve(null)
  if (readyTracks.has(id) && !getPreloadedTrack(id)) resolvedTracks.delete(id)
  if (!force && resolvedTracks.has(id)) return resolvedTracks.get(id)
  const task = Promise.resolve()
    .then(() => (typeof resolve === 'function' ? resolve(track) : track))
    .then((resolved) => {
      const candidate = resolved && typeof resolved === 'object' ? resolved : track
      if (candidate?.streamUrl && !candidate.preview) {
        const audio = warmStream(candidate.streamUrl)
        const confirm = () => {
          if (!Number.isFinite(audio?.duration) || audio.duration < 60) { resolvedTracks.delete(id); return }
          let expiresAt = Date.now() + 10 * 60_000
          try {
            const url = new URL(candidate.streamUrl, location.origin)
            const stream = url.searchParams.has('url') ? new URL(url.searchParams.get('url')) : url
            const signedExpiry = Number(stream.searchParams.get('expire')) * 1000
            if (signedExpiry) expiresAt = Math.min(expiresAt, signedExpiry - 60000)
          } catch { /* Relative native streams use the bounded cache lifetime. */ }
          readyTracks.set(id, { track: { ...candidate, duration: audio.duration }, expiresAt })
          while (readyTracks.size > 10) readyTracks.delete(readyTracks.keys().next().value)
        }
        if (audio?.readyState >= 1) confirm()
        else audio?.addEventListener('loadedmetadata', confirm, { once:true })
        audio?.addEventListener('error', () => { readyTracks.delete(id); resolvedTracks.delete(id); warmAudio.delete(candidate.streamUrl) }, { once:true })
      }
      if (!resolved?.streamUrl && !resolved?.youtubeVideoId && resolvedTracks.get(id) === task) resolvedTracks.delete(id)
      return candidate || null
    })
    .catch(() => { if (resolvedTracks.get(id) === task) resolvedTracks.delete(id); return null })
  resolvedTracks.set(id, task)
  while (resolvedTracks.size > MAX_WARM_TRACKS * 2) {
    resolvedTracks.delete(resolvedTracks.keys().next().value)
  }
  return task
}

export function preloadQueueWindow({ queue = [], currentIndex = 0, repeatMode = 'off', resolve }) {
  if (!queue.length || repeatMode === 'one') return []
  const nextIndex = currentIndex + 1 < queue.length ? currentIndex + 1 : repeatMode === 'all' ? 0 : -1
  const afterIndex = nextIndex >= 0 && nextIndex + 1 < queue.length ? nextIndex + 1 : repeatMode === 'all' ? 0 : -1
  return [nextIndex, afterIndex]
    .filter((index, position, list) => index >= 0 && list.indexOf(index) === position)
    .map((index) => preloadTrack(queue[index], { resolve }))
}

export function preloadCandidateAt(queue, index, resolve) {
  const candidate = queue[index]
  if (!candidate) return Promise.resolve(null)
  return preloadTrack(candidate, { resolve })
}

export function clearPreloadSession() {
  readyTracks.clear()
  resolvedTracks.clear()
  warmAudio.forEach((audio) => {
    try {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    } catch {
      /* ignore */
    }
  })
  warmAudio.clear()
}
