export const MOOD_QUERIES = {
  all: ['trending Hindi hits', 'Pakistan Coke Studio hits', 'global pop hits', 'new Bollywood songs'],
  energize: ['upbeat Bollywood dance', 'Punjabi party hits', 'energetic pop'],
  relax: ['acoustic Hindi unplugged', 'soft romantic ballads', 'unplugged melodies'],
  focus: ['lofi instrumental beats', 'ambient study music', 'instrumental chill'],
  workout: ['gym workout Punjabi', 'high tempo hip hop bass', 'workout dance hits'],
  sufi: ['Coke Studio soulful classics', 'Nusrat Fateh Ali Khan qawwali', 'Atif Aslam Sufi', 'Rahat Fateh Ali Khan qawwali'],
  night: ['midnight lofi slow reverb', 'Arijit Singh late night melodies', 'Hamza Malik late night'],
}

export function moodQueries(mood, artists = [], rotation = 0) {
  const pool = MOOD_QUERIES[mood] || MOOD_QUERIES.all
  const index = Math.abs(Math.floor(rotation)) % pool.length
  const queries = [pool[index], pool[(index + 1) % pool.length]]
  if (mood === 'all' && artists[0]) queries[0] = `${artists[0]} hits`
  return [...new Set(queries)]
}
// Refresh metadata/URLs without duplicating the same song or discarding user-owned IDs.
export function mergeMoodCatalog(live, local) {
  const key = track => `${String(track?.title || '').trim().toLowerCase()}::${String(track?.artist || '').trim().toLowerCase()}`
  const existing = new Map(local.filter(track => track?.id).map(track => [key(track), track]))
  const seen = new Set(), result = []
  for (const track of [...live, ...local]) {
    if (!track?.id || seen.has(key(track))) continue
    seen.add(key(track))
    const previous = existing.get(key(track))
    result.push(previous ? { ...previous, ...track, id: previous.id } : track)
  }
  return result
}
