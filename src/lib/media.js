function decodeEntities(value = '') {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function safeText(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function normalizeArtworkUrl(value) {
  if (Array.isArray(value)) {
    const found = value.map((entry) => normalizeArtworkUrl(entry)).filter(Boolean)
    return found[found.length - 1] || null
  }
  if (value && typeof value === 'object') {
    const keys = ['url', 'link', 'src', 'image', 'images', 'cover', 'artwork', 'thumbnail', 'thumbnails']
    for (const key of keys) {
      const found = normalizeArtworkUrl(value[key])
      if (found) return found
    }
    return null
  }
  let text = decodeEntities(safeText(value)).trim()
  if (!text) return null
  if (text.startsWith('//')) text = `https:${text}`
  if (/^http:\/\//i.test(text)) text = text.replace(/^http:/i, 'https:')
  return /^(https:\/\/|data:image\/|blob:|\/(?!\/))/i.test(text) ? text : null
}

export function artworkThumbUrl(url) {
  if (!url || /^(data:|blob:)/i.test(url)) return url
  return url
    .replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, '/160x160bb.$1')
    .replace(/-\d+x\d+\.(jpg|jpeg|png|webp)$/i, '-160x160.$1')
    .replace(/\/(?:hq|sd|maxres)default\.(jpg|jpeg|png|webp)$/i, '/mqdefault.$1')
}

export function initials(value = '') {
  return value
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}


export function trackArtworkSources(track) {
  return [...new Set(['artwork', 'cover', 'image', 'thumbnail', 'albumArt'].map(key => normalizeArtworkUrl(track?.[key])).filter(Boolean))]
}

export function resolveTrackArtwork(track) {
  return trackArtworkSources(track)[0] || null
}
