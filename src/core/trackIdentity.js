// One canonical identity per song. Movie versions, re-uploads, lofi edits and
// "trending" re-releases must never occupy more than one slot in a shelf, queue
// or radio station.
const PARENTHETICAL = /[([{][^)\]}]*[)\]}]/g

const NOISE_PHRASES = [
  /\btrending\s+version\b/gi,
  /\beclipsa\s+audio\b/gi,
  /\bafro\s*(?:mix|beat)\b/gi,
  /\blo[\s-]?fi(?:\s+(?:mix|version|edit))?\b/gi,
  /\bslowed(?:\s*(?:and|&|\+)\s*reverb)?\b/gi,
  /\breverb(?:ed)?\b/gi,
  /\baudio\b/gi,
  /\bvideo\b/gi,
]

function baseNormalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Strip release noise from a song title and return a comparable core.
 * Parenthetical groups are dropped (usually "From the movie ..." or a label),
 * then explicit re-release markers are removed before punctuation and case.
 */
export function cleanTitleCore(value) {
  const original = String(value || '')
  let text = original.replace(PARENTHETICAL, ' ')
  for (const pattern of NOISE_PHRASES) text = text.replace(pattern, ' ')
  const core = baseNormalize(text)
  // A title made entirely of noise ("Audio") must still identify something.
  return core || baseNormalize(original)
}

/** Canonical dedupe key for a track: title only, intentionally artist-agnostic. */
export function getCanonicalSongStem(track) {
  const title = track && typeof track === 'object'
    ? track.title || track.name || track.song || track.trackName || ''
    : track
  return cleanTitleCore(title)
}

export { getCanonicalSongStem as songStem }
