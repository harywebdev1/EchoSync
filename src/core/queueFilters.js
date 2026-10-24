export const QUEUE_FILTERS = ['All', 'Familiar', 'Discover', 'Deep Cuts']
const normalize = value => String(value || '').toLowerCase().trim()

// Keep original queue indexes: filtering is presentation-only, never a queue mutation.
export function filterUpcomingQueue(queue, currentIndex, mode = 'All', { liked = [], recent = [], tasteProfile = {} } = {}) {
  const known = new Set([...liked, ...recent])
  const artists = tasteProfile.artists || {}
  const affinity = track => (artists[normalize(track?.artist)]?.weight || 0) >= 5
  const deep = track => /acoustic|sufi|qawwali|lo[ -]?fi|ambient|unplugged|live session/i.test([track?.title, track?.artist, track?.album, track?.genre].join(' ')) || Number(track?.duration) >= 300
  return queue.map((item, index) => ({ item, index })).filter(({ item, index }) => {
    if (index <= currentIndex) return false
    if (mode === 'Familiar') return known.has(item?.id) || affinity(item)
    if (mode === 'Discover') return !known.has(item?.id)
    if (mode === 'Deep Cuts') return deep(item)
    return true
  })
}
