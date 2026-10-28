import { cleanTitleCore } from './songStem.js'
import { phoneticNormalize, rankBySearchSimilarity } from './searchRanking.js'

// OmniRoute: one identity, one ranking and one failover ladder for every
// catalog the app can reach (Apple, JioSaavn, Deezer, YouTube, Audius).
const PROXIED_MEDIA_HOST = /saavncdn\.com|dzcdn\.net|googlevideo\.com/i

function providerOf(track) {
  return String(track?.provider || 'jiosaavn').toLowerCase()
}

function artistKeys(track) {
  return String(track?.artist || track?.primaryArtists || '')
    .split(/,|&|;|\bfeat\.?\s|\bft\.?\s/i)
    .map((name) => phoneticNormalize(name))
    .filter(Boolean)
}

/** Canonical identity used to merge the same recording across storefronts. */
export function omniCanonicalKey(track) {
  const stem = cleanTitleCore(track?.title || track?.name || '')
  if (!stem) return ''
  return `${stem}::${artistKeys(track)[0] || ''}`
}

/**
 * Merge provider groups into one catalog. The first row keeps its identity;
 * later rows only contribute the fields the first one lacks (stream, preview,
 * artwork, duration), so a cover can never donate its audio to an original.
 */
export function mergeOmniTracks(groups = []) {
  const order = []
  const byKey = new Map()
  for (const group of groups) {
    for (const track of Array.isArray(group) ? group : []) {
      if (!track?.id) continue
      const key = omniCanonicalKey(track)
      const existing = key ? byKey.get(key) : null
      if (!existing) {
        const copy = { ...track, providers: [providerOf(track)] }
        if (key) byKey.set(key, copy)
        order.push(copy)
        continue
      }
      if (!existing.previewUrl && track.previewUrl) existing.previewUrl = track.previewUrl
      if (!existing.streamUrl && track.streamUrl) existing.streamUrl = track.streamUrl
      if (!existing.youtubeVideoId && track.youtubeVideoId) existing.youtubeVideoId = track.youtubeVideoId
      if (!existing.cover && track.cover) existing.cover = track.cover
      if (!Number(existing.duration) && Number(track.duration)) existing.duration = track.duration
      if (!existing.providers.includes(providerOf(track))) existing.providers.push(providerOf(track))
    }
  }
  return order
}

export function rankOmniTracks(tracks = [], query = '') {
  return rankBySearchSimilarity(tracks, query)
}

/**
 * Silent failover ladder for a resolved track: alternate Saavn bitrate, the
 * same-origin proxy for hosts it may fetch, then the guaranteed provider
 * preview. Order matters: cheapest and most reliable source first.
 */
export function omniStreamChain(track) {
  const url = String(track?.streamUrl || '')
  const chain = []
  if (/saavncdn\.com/i.test(url) && /_(?:96|160|320)\.mp4/i.test(url)) {
    chain.push(url.replace(/_(?:96|160|320)\.mp4/i, '_320.mp4'))
    chain.push(url.replace(/_(?:96|160|320)\.mp4/i, '_160.mp4'))
    chain.push(url.replace(/_(?:96|160|320)\.mp4/i, '_96.mp4'))
  }
  if (PROXIED_MEDIA_HOST.test(url)) chain.push(`/api/media?url=${encodeURIComponent(url)}`)
  if (track?.previewUrl && track.previewUrl !== url) chain.push(track.previewUrl)
  return [...new Set(chain.filter(Boolean))]
}
