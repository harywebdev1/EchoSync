import { songStem } from './moodFeed.js'
export const ARTIST_LANGUAGE = {
  'atif aslam': 'Urdu',
  'arijit singh': 'Hindi',
  'coke studio': 'Urdu',
  'the weeknd': 'English',
  'diljit dosanjh': 'Punjabi',
  'ap dhillon': 'Punjabi',
  'talha anjum': 'Urdu',
  pritam: 'Hindi',
  'ar rahman': 'Hindi',
  'a.r. rahman': 'Hindi',
  coldplay: 'English',
  'ali sethi': 'Urdu',
  'kaifi khalil': 'Urdu',
  'rahat fateh ali khan': 'Urdu',
  'jubin nautiyal': 'Hindi',
}

export const TASTE_WEIGHTS = { play: 3, like: 5, playlist: 4, search: 2, tune: 6 }

export const TASTE_VIBES = [
  { id: 'pakistani-indie', label: 'Pakistani Indie', query: 'Pakistani indie songs', hint: 'Kaifi Khalil, Talha Anjum, Ali Sethi', c1: '#1d4f42', c2: '#78c59c', language: 'Urdu', genre: 'Indie' },
  { id: 'coke-studio', label: 'Coke Studio', query: 'Coke Studio Pakistan songs', hint: 'Live sessions with a pulse', c1: '#5a2c17', c2: '#e8a65e', language: 'Urdu', genre: 'Coke Studio' },
  { id: 'bollywood-romance', label: 'Bollywood Romance', query: 'Bollywood romantic songs', hint: 'Arijit, Pritam, soft endings', c1: '#5a2032', c2: '#ec8da0', language: 'Hindi', genre: 'Bollywood' },
  { id: 'punjabi-hip-hop', label: 'Punjabi Hip-Hop', query: 'Punjabi hip hop songs', hint: 'AP Dhillon, Diljit, Sidhu', c1: '#183a31', c2: '#57c99a', language: 'Punjabi', genre: 'Hip-Hop' },
  { id: 'sufi-qawwali', label: 'Sufi & Qawwali', query: 'Sufi qawwali songs', hint: 'Nusrat, Rahat, sacred scale', c1: '#4c3617', c2: '#d8b15f', language: 'Urdu', genre: 'Qawwali' },
  { id: 'global-pop', label: 'Global Pop', query: 'global pop hits', hint: 'The Weeknd, Post Malone, Coldplay', c1: '#1b3158', c2: '#7ca9ee', language: 'English', genre: 'Pop' },
  { id: 'lofi-chill', label: 'Lo-Fi Chill', query: 'lofi chill songs', hint: 'Soft focus, late hours', c1: '#292448', c2: '#a795e8', language: 'English', genre: 'Lo-Fi' },
  { id: 'naat-spiritual', label: 'Naat & Spiritual', query: 'Naat spiritual songs', hint: 'Quiet devotion, open room', c1: '#204338', c2: '#8cd3ad', language: 'Urdu', genre: 'Spiritual' },
]

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(feat|ft|featuring|with)\b.*$/g, ' ')
    .replace(/[^a-z0-9\s'&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeText(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function emptyTasteProfile() {
  return {
    version: 1,
    artists: {},
    languages: {},
    genres: {},
    vibes: {},
    searches: [],
    tuned: [],
    events: 0,
    updatedAt: 0,
  }
}

export function normalizeTasteProfile(raw) {
  const profile = emptyTasteProfile()
  if (!raw || typeof raw !== 'object') return profile
  const copyWeights = (source) => {
    if (!source || typeof source !== 'object') return {}
    const entries = Object.entries(source)
      .map(([key, value]) => {
        if (value && typeof value === 'object') {
          return [key, {
            name: safeText(value.name, key),
            weight: Math.max(0, Number(value.weight) || 0),
          }]
        }
        return [key, { name: key, weight: Math.max(0, Number(value) || 0) }]
      })
      .filter(([key, value]) => key && value.weight > 0)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 30)
    return Object.fromEntries(entries)
  }
  profile.artists = copyWeights(raw.artists)
  profile.languages = copyWeights(raw.languages)
  profile.genres = copyWeights(raw.genres)
  profile.vibes = copyWeights(raw.vibes)
  profile.searches = (Array.isArray(raw.searches) ? raw.searches : [])
    .map((entry) => {
      if (typeof entry === 'string') return { query: safeText(entry), at: 0 }
      return { query: safeText(entry?.query), at: Number(entry?.at) || 0 }
    })
    .filter((entry) => entry.query)
    .slice(0, 10)
  profile.tuned = [...new Set((Array.isArray(raw.tuned) ? raw.tuned : []).filter((id) => TASTE_VIBES.some((vibe) => vibe.id === id)))]
  profile.events = Math.max(0, Number(raw.events) || 0)
  profile.updatedAt = Number(raw.updatedAt) || 0
  return profile
}

function bumpTasteWeight(map, key, name, amount) {
  if (!key) return
  const previous = map[key]
  const weight = (previous?.weight || 0) + amount
  map[key] = { name: name || previous?.name || key, weight }
}

export function artistNames(track) {
  return String(track?.artist || '')
    .split(/\s*(?:&|,| and | feat\.? | ft\.? )\s*/i)
    .map((artist) => artist.trim())
    .filter((artist) => artist && !/unknown/i.test(artist))
}

export function languageForTrack(track) {
  const language = safeText(track?.language || track?.lang)
  if (language) return language
  const artist = normalize(artistNames(track)[0] || '')
  if (ARTIST_LANGUAGE[artist]) return ARTIST_LANGUAGE[artist]
  const title = normalize(`${track?.title || ''} ${track?.album || ''}`)
  if (/\b(naat|qawwali|sufi|hamd|ghazal)\b/.test(title)) return 'Urdu'
  if (/\b(punjabi|bhangra|jatt)\b/.test(title)) return 'Punjabi'
  if (/\b(bollywood|filmi|hindi)\b/.test(title)) return 'Hindi'
  return track?.provider === 'youtube' ? 'Global' : 'Hindi'
}

export function genresForTrack(track) {
  const text = normalize(`${track?.title || ''} ${track?.album || ''} ${track?.artist || ''}`)
  const genres = []
  if (/\b(qawwali|naat|sufi|hamd|ghazal)\b/.test(text)) genres.push(/naat|hamd/.test(text) ? 'Spiritual' : 'Qawwali')
  if (/\b(coke studio)\b/.test(text)) genres.push('Coke Studio')
  if (/\b(indie|underground|independent)\b/.test(text)) genres.push('Indie')
  if (/\b(hip hop|hip-hop|rap|trap|drill)\b/.test(text) || /talha anjum|ap dhillon|diljit|sidhu/.test(text)) genres.push('Hip-Hop')
  if (/\b(lofi|lo-fi|chill|ambient)\b/.test(text)) genres.push('Lo-Fi')
  if (/\b(punjabi|bhangra)\b/.test(text)) genres.push('Punjabi')
  if (/\b(romance|romantic|love|ishq|pyaar)\b/.test(text)) genres.push('Romance')
  if (!genres.length) {
    const language = languageForTrack(track)
    if (language === 'Hindi') genres.push('Bollywood')
    else if (language === 'Urdu') genres.push('South Asian')
    else if (language === 'Punjabi') genres.push('Punjabi Pop')
    else genres.push('Pop')
  }
  return [...new Set(genres)].slice(0, 2)
}

export function applyTasteSignal(profile, type, payload = {}, now = Date.now) {
  const weight = TASTE_WEIGHTS[type] || 0
  if (!weight) return profile
  const next = normalizeTasteProfile(profile)
  next.events += 1
  next.updatedAt = now()
  if (type === 'tune') {
    const selected = [...new Set((payload.vibes || []).filter((id) => TASTE_VIBES.some((vibe) => vibe.id === id)))]
    const previous = new Set(next.tuned)
    selected.forEach((id) => {
      const vibe = TASTE_VIBES.find((item) => item.id === id)
      if (!vibe) return
      if (!previous.has(id)) {
        bumpTasteWeight(next.vibes, vibe.id, vibe.label, weight)
        bumpTasteWeight(next.languages, normalize(vibe.language), vibe.language, weight)
        bumpTasteWeight(next.genres, normalize(vibe.genre), vibe.genre, weight)
      }
    })
    next.tuned = selected
    return next
  }
  if (type === 'search') {
    const query = safeText(payload.query).slice(0, 80)
    if (!query) return next
    next.searches = [
      { query, at: now() },
      ...next.searches.filter((entry) => normalize(entry.query) !== normalize(query)),
    ].slice(0, 8)
    return next
  }
  const track = payload.track
  if (!track?.id) return next
  artistNames(track).forEach((artist) => {
    bumpTasteWeight(next.artists, normalize(artist), artist, weight)
  })
  const language = languageForTrack(track)
  if (language) bumpTasteWeight(next.languages, normalize(language), language, weight)
  genresForTrack(track).forEach((genre) => {
    bumpTasteWeight(next.genres, normalize(genre), genre, weight)
  })
  return next
}

export function topTasteLabels(map, limit = 4) {
  return Object.values(map || {})
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.name)
    .filter(Boolean)
    .slice(0, limit)
}

export function buildTasteSuggestions(profile, dailyUser, trending) {
  const suggestions = []
  const seen = new Set()
  const add = (label, query) => {
    const cleanLabel = safeText(label)
    const cleanQuery = safeText(query)
    if (!cleanLabel || !cleanQuery || seen.has(normalize(cleanLabel))) return
    seen.add(normalize(cleanLabel))
    suggestions.push({ label: cleanLabel, query: cleanQuery })
  }
  ;(profile?.tuned || []).forEach((id) => {
    const vibe = TASTE_VIBES.find((item) => item.id === id)
    if (vibe) add(vibe.label, vibe.query)
  })
  topTasteLabels(profile?.artists, 3).forEach((artist) => add(artist, `${artist} songs`))
  topTasteLabels(profile?.languages, 2).forEach((language) => add(`${language} picks`, `${language} songs`))
  topTasteLabels(profile?.genres, 2).forEach((genre) => add(genre, `${genre} songs`))
  ;(dailyUser?.topArtists || []).forEach((artist) => add(artist, `${artist} songs`))
  const trendingArtists = [...new Set((trending || []).map((track) => safeText(track?.artist)).filter(Boolean))]
  trendingArtists.slice(0, 3).forEach((artist) => add(artist, `${artist} songs`))
  return suggestions.slice(0, 8)
}

export function extractTopVibeTags(profile, limit = 3) {
  return topTasteLabels(profile?.vibes || {}, limit)
}

/** Weighted cosine similarity, 0..99. Empty profiles score 0; this is a heuristic, not a probability.
 * Each dimension is normalized independently so play-count volume cannot dominate compatibility.
 * A missing dimension on one side contributes zero; dimensions empty on both sides are omitted.
 */
export function computeTasteMatchPercentage(profileA, profileB) {
  const a = normalizeTasteProfile(profileA)
  const b = normalizeTasteProfile(profileB)
  let similarity = 0
  let totalWeight = 0
  for (const [dimension, weight] of [['artists', 0.4], ['genres', 0.3], ['vibes', 0.2], ['languages', 0.1]]) {
    const vector = map => {
      const entries = Object.entries(map).filter(([, entry]) => Number.isFinite(entry.weight) && entry.weight > 0)
      const maximum = Math.max(0, ...entries.map(([, entry]) => entry.weight))
      const result = new Map()
      for (const [key, entry] of entries) {
        const canonical = String(key).normalize('NFKC').trim().toLowerCase()
        if (!canonical) continue
        result.set(canonical, (result.get(canonical) || 0) + entry.weight / maximum)
      }
      return result
    }
    const left = vector(a[dimension])
    const right = vector(b[dimension])
    if (!left.size && !right.size) continue
    totalWeight += weight
    let dot = 0, normA = 0, normB = 0
    left.forEach((value, key) => { dot += value * (right.get(key) || 0); normA += value * value })
    right.forEach(value => { normB += value * value })
    if (normA && normB) similarity += weight * dot / Math.sqrt(normA * normB)
  }
  return totalWeight ? Math.max(0, Math.min(99, Math.round(99 * similarity / totalWeight))) : 0
}


export const HOME_MOODS = [
  { id: 'all', label: 'All', tint: '#a78bfa' },
  { id: 'energize', label: 'Energize', tint: '#f59e0b', pattern: /dance|pop|party|energy|punjabi|hip.hop/i },
  { id: 'relax', label: 'Relax', tint: '#5eaca5', pattern: /acoustic|chill|soft|calm|romance|dil/i },
  { id: 'focus', label: 'Focus', tint: '#8c9ecf', pattern: /instrumental|piano|ambient|focus|study|classical/i },
  { id: 'workout', label: 'Workout', tint: '#ee8273', pattern: /workout|beats|dance|energy|hip.hop|rap/i },
  { id: 'sufi', label: 'Sufi & Soul', tint: '#d6ac66', pattern: /sufi|qawwali|coke studio|nusrat|rahat|soul|tajdar/i },
  { id: 'night', label: 'Late Night', tint: '#a695d4', pattern: /lo.fi|night|slow|moon|raat|ambient|chill/i },
]

export function rankHomeTracks(tracks, { profile, liked = [], recent = [], mood = 'all' } = {}) {
  const known = new Set(liked), played = new Set(recent), seen = new Set()
  const pattern = HOME_MOODS.find(item => item.id === mood)?.pattern
  return tracks.filter(track => {
    const duration = Number(track?.duration)
    if (!track?.id || seen.has(songStem(track)) || track.preview || (duration > 0 && duration < 60)) return false
    seen.add(songStem(track)); return true
  }).map((track, index) => {
    const artistWeight = artistNames(track).reduce((sum, artist) => sum + (profile?.artists?.[normalize(artist)]?.weight || 0), 0)
    const genreWeight = genresForTrack(track).reduce((sum, genre) => sum + (profile?.genres?.[normalize(genre)]?.weight || 0), 0)
    const text = [track.title, track.artist, track.album, track.genre, ...(track.tags || [])].join(' ')
    const score = (pattern?.test(text) ? 1000 : 0) + Math.min(artistWeight + genreWeight, 100) + (known.has(track.id) ? 20 : 0) + (played.has(track.id) ? 8 : 0)
    return { track, score, index }
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.track)
}

export function buildQuickPicksAndRadio(tracks, options = {}, seed = null) {
  const ranked = rankHomeTracks(tracks, options)
  const related = seed ? rankHomeTracks(ranked, { ...options, profile: applyTasteSignal(options.profile, 'play', { track: seed }, () => 0) }) : ranked
  const radio = [...(seed ? [seed] : []), ...related.filter(track => track.id !== seed?.id)].slice(0, 16)
  return { quickPicks: ranked.slice(0, 12), radio }
}
