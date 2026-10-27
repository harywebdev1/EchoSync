import { cleanTitleCore } from './songStem.js'
// Shared by the server and UI. Similarity changes ordering, never eligibility.
export function phoneticNormalize(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ph/g, 'f')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/iy(?=a\b)/g, 'i')
    .replace(/([rs])a(?=[ri])/g, '$1')
    .replace(/sh/g, 's')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/w/g, 'v')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const tokens = (text) =>
  phoneticNormalize(text).split(' ').filter(Boolean).slice(0, 12)
function grams(value) {
  const text = `  ${value} `,
    out = new Set()
  for (let i = 0; i < text.length - 2; i++) out.add(text.slice(i, i + 3))
  return out
}
export function trigramSimilarity(a, b) {
  if (!a || !b) return 0
  const left = grams(a),
    right = grams(b)
  return (
    (2 * [...left].filter((value) => right.has(value)).length) /
    (left.size + right.size)
  )
}
function tokenSimilarity(a, b) {
  if (a === b) return 1
  if (b.startsWith(a)) return 0.92
  if (a.length < 3 || b.length < 3) return 0
  a = a.slice(0, 40)
  b = b.slice(0, 40)
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    previous = next
  }
  return Math.max(
    trigramSimilarity(a, b),
    1 - previous[b.length] / Math.max(a.length, b.length)
  )
}
export function searchSimilarity(track, query) {
  const q = phoneticNormalize(query),
    words = tokens(query)
  if (!q || !words.length) return 0
  const rawTitle = track?.title || track?.name || ''
  const title = phoneticNormalize(cleanTitleCore(rawTitle))
  const variants =
    /\b(reprise|acoustic|cover|remix|karaoke|tribute|instrumental)\b/i
  const variantPenalty =
    variants.test(rawTitle) && !variants.test(query) ? 0.15 : 0
  const artist = phoneticNormalize(
    track?.artist ||
      track?.primaryArtists ||
      track?.artists?.primary?.map((item) => item.name).join(' ')
  )
  const album = phoneticNormalize(track?.album?.name || track?.album)
  const fieldScore = (field) => {
    if (!field) return 0
    const candidates = field.split(' ')
    const tokenScore =
      words.reduce(
        (sum, word) =>
          sum +
          Math.max(
            0,
            ...candidates.map((candidate) => tokenSimilarity(word, candidate))
          ),
        0
      ) / words.length
    return tokenScore * 0.7 + trigramSimilarity(q, field) * 0.3
  }
  return (
    Math.max(
      fieldScore(title) + (title === q ? 0.5 : title.startsWith(q) ? 0.2 : 0),
      fieldScore(artist) +
        (artist === q ? 0.4 : artist.startsWith(q) ? 0.15 : 0),
      fieldScore(`${title} ${artist}`) * 0.9,
      fieldScore(album) * 0.65
    ) - variantPenalty
  )
}
export function rankBySearchSimilarity(tracks, query) {
  return tracks
    .map((track, index) => ({
      track,
      index,
      score: searchSimilarity(track, query)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.track)
}
