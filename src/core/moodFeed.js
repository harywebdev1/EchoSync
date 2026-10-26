const clean = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s*\(from\s+[^)]*\)\s*/gi, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const credits = track => [...new Set(String(track?.artist || track?.primaryArtists || '').split(/,|&| feat\.? /i).map(clean).filter(artist => artist && !['unknown artist', 'echosync'].includes(artist)))].sort()
export function songStem(track) {
  // Credit order differs between providers. Keep the complete artist identity,
  // and retain version qualifiers (live/remix/acoustic) in the title.
  const artists = credits(track)
  return clean(track?.title) + '::' + (artists.join('|') || String(track?.id || ''))
}
export function sameRecording(a, b) {
  if (a?.id && a.id === b?.id) return true
  if (!clean(a?.title) || clean(a.title) !== clean(b?.title)) return false
  const durationA = Number(a.duration), durationB = Number(b.duration)
  if (a.status !== 'pending' && b.status !== 'pending' && durationA > 0 && durationB > 0 && Math.abs(durationA - durationB) > Math.max(3, Math.max(durationA, durationB) * .01)) return false
  const other = credits(b)
  return credits(a).some(artist => other.includes(artist))
}
// Title buckets keep cross-provider matching bounded to a few versions of a song.
// A title alone never proves that two recordings are the same.
export function createRecordingIndex() {
  const buckets = new Map()
  const find = track => (buckets.get(clean(track?.title)) || []).find(previous => sameRecording(previous, track))
  return { find, add(track) {
    if (find(track)) return false
    const key = clean(track?.title), bucket = buckets.get(key) || []
    bucket.push(track); buckets.set(key, bucket); return true
  } }
}
export function collectMoodResults(results) {
  const seen = createRecordingIndex()
  return results.flatMap(result => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []).filter(track => {
    return Boolean(track?.id && !track.preview && Number(track.duration) >= 60 && seen.add(track))
  })
}
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
  const existing = createRecordingIndex()
  local.filter(track => track?.id).forEach(track => existing.add(track))
  const seen = createRecordingIndex(), result = []
  for (const track of [...live, ...local]) {
    if (!track?.id || !seen.add(track)) continue
    const previous = existing.find(track)
    result.push(previous ? { ...previous, ...track, id: previous.id } : track)
  }
  return result
}

export function allocateHomeShelves(quick, familiar, fresh) {
  const usedTrackStems=createRecordingIndex()
  // Only reserve the tracks actually displayed, not the entire candidate pool.
  const allocate=(tracks,limit)=>{const result=[];for(const track of tracks){if(!track?.id||!usedTrackStems.add(track))continue;result.push(track);if(result.length===limit)break}return result}
  return {quickPicks:allocate(quick,12),familiar:allocate(familiar,10),fresh:allocate(fresh,12)}
}
