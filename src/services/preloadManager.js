const warmAudio = new Map()
const resolvedTracks = new Map()
let metadataAudio = null
let metadataLink = null
const MAX_WARM_TRACKS = 5

function getMetadataAudio() {
  if (metadataAudio || typeof document === 'undefined') return metadataAudio
  metadataAudio = document.createElement('audio')
  metadataAudio.preload = 'metadata'
  metadataAudio.crossOrigin = 'anonymous'
  metadataAudio.setAttribute('aria-hidden', 'true')
  metadataAudio.style.display = 'none'
  document.body.appendChild(metadataAudio)
  return metadataAudio
}

function getPreloadLink() {
  if (metadataLink || typeof document === 'undefined') return metadataLink
  metadataLink = document.createElement('link')
  metadataLink.rel = 'preload'
  metadataLink.as = 'audio'
  metadataLink.dataset.echosyncPreload = 'true'
  document.head.appendChild(metadataLink)
  return metadataLink
}

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
  if (!url || warmAudio.has(url)) return
  try {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = url
    warmAudio.set(url, audio)
    audio.load()
    const metadata = getMetadataAudio()
    if (metadata) {
      metadata.src = url
      metadata.load()
    }
    const link = getPreloadLink()
    if (link) {
      link.href = url
      link.removeAttribute('crossorigin')
    }
    trimWarmAudio()
  } catch {
    /* prewarming is best-effort */
  }
}

export function preloadTrack(track, { resolve, force = false } = {}) {
  const id = track?.id
  if (!id || id === 'empty' || /^http/i.test(id)) return Promise.resolve(null)
  if (!force && resolvedTracks.has(id)) return resolvedTracks.get(id)
  const task = Promise.resolve()
    .then(() => (typeof resolve === 'function' ? resolve(track) : track))
    .then((resolved) => {
      const candidate = resolved && typeof resolved === 'object' ? resolved : track
      if (candidate?.streamUrl && !candidate.preview) warmStream(candidate.streamUrl)
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
  if (metadataAudio) {
    try {
      metadataAudio.removeAttribute('src')
      metadataAudio.load()
    } catch {
      /* ignore */
    }
  }
  if (metadataLink) metadataLink.removeAttribute('href')
}
