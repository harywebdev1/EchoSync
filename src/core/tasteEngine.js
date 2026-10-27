import { getCanonicalSongStem } from './songStem.js'

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

// Invisible learning only. Every dimension is artist, vibe, or language-era.
export const TASTE_WEIGHTS = {
  play: { artist: 3, vibe: 2, language: 1 },
  complete: { artist: 5, vibe: 3, language: 1 },
  replay: { artist: 5, vibe: 3, language: 1 },
  like: { artist: 6, vibe: 4, language: 1 },
  playlist: { artist: 6, vibe: 4, language: 1 },
  search: { keyword: 3 },
  skip: { artist: -2, vibe: -2, language: 0 },
}

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
    version: 2,
    artists: {},
    languages: {},
    genres: {},
    vibes: {},
    eras: {},
    keywords: {},
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
  profile.eras = copyWeights(raw.eras)
  profile.keywords = copyWeights(raw.keywords)
  profile.searches = (Array.isArray(raw.searches) ? raw.searches : [])
    .map((entry) => {
      if (typeof entry === 'string') return { query: safeText(entry), at: 0 }
      return { query: safeText(entry?.query), at: Number(entry?.at) || 0 }
    })
    .filter((entry) => entry.query)
    .slice(0, 10)
  profile.tuned = []
  profile.events = Math.max(0, Number(raw.events) || 0)
  profile.updatedAt = Number(raw.updatedAt) || 0
  return profile
}

function bumpTasteWeight(map, key, name, amount) {
  if (!key || !amount) return
  const previous = map[key]
  const weight = Math.max(0, (previous?.weight || 0) + amount)
  if (weight <= 0) {
    delete map[key]
    return
  }
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

function decadeForTrack(track) {
  const year = Number(track?.year || String(track?.releaseDate || '').slice(0, 4))
  if (Number.isFinite(year) && year >= 1950 && year <= 2100) return `${Math.floor(year / 10) * 10}s`
  return 'timeless'
}

export function applyTasteSignal(profile, type, payload = {}, now = Date.now) {
  const config = TASTE_WEIGHTS[type]
  if (!config) return profile
  const next = normalizeTasteProfile(profile)
  next.events += 1
  next.updatedAt = now()

  if (type === 'search') {
    const query = safeText(payload.query).slice(0, 80)
    if (!query || !config.keyword) return next
    next.searches = [
      { query, at: now() },
      ...next.searches.filter((entry) => normalize(entry.query) !== normalize(query)),
    ].slice(0, 8)
    normalize(query).split(' ').filter(token => token.length > 2).slice(0, 4).forEach((token) => {
      bumpTasteWeight(next.keywords, token, token, config.keyword)
    })
    return next
  }

  const track = payload.track
  if (!track?.id) return next
  const amount = Number(config.artist) || 0
  artistNames(track).forEach((artist) => {
    bumpTasteWeight(next.artists, normalize(artist), artist, amount)
  })
  const vibes = genresForTrack(track)
  vibes.forEach((vibe) => {
    bumpTasteWeight(next.vibes, normalize(vibe), vibe, Number(config.vibe) || 0)
    bumpTasteWeight(next.genres, normalize(vibe), vibe, Number(config.vibe) || 0)
  })
  const language = languageForTrack(track)
  if (language && config.language) {
    const era = `${language} · ${decadeForTrack(track)}`
    bumpTasteWeight(next.eras, normalize(era), era, config.language)
    if (config.language > 0) bumpTasteWeight(next.languages, normalize(language), language, config.language)
  }
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
  topTasteLabels(profile?.artists, 3).forEach((artist) => add(artist, `${artist} songs`))
  topTasteLabels(profile?.vibes, 2).forEach((vibe) => add(vibe, `${vibe} songs`))
  topTasteLabels(profile?.eras, 1).forEach((era) => add(era, `${era.split(' · ')[0]} songs`))
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
  for (const [dimension, weight] of [['artists', 0.35], ['vibes', 0.25], ['genres', 0.2], ['eras', 0.1], ['languages', 0.1]]) {
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

function keywordScore(track, profile) {
  const keywords = Object.entries(profile?.keywords || {})
  if (!keywords.length) return 0
  const text = normalize(`${track?.title || ''} ${track?.artist || ''} ${track?.album || ''}`)
  return keywords.reduce((sum, [keyword, entry]) => text.includes(keyword) ? sum + (Number(entry?.weight) || 0) : sum, 0)
}

function eraScore(track, profile) {
  const era = normalize(`${languageForTrack(track)} · ${decadeForTrack(track)}`)
  return profile?.eras?.[era]?.weight || 0
}

export function rankHomeTracks(tracks, { profile, liked = [], recent = [], mood = 'all' } = {}) {
  const known = new Set(liked), played = new Set(recent), seen = new Set()
  const pattern = HOME_MOODS.find(item => item.id === mood)?.pattern
  return tracks.filter(track => {
    const duration = Number(track?.duration)
    const stem = getCanonicalSongStem(track)
    if (!track?.id || !stem || seen.has(stem) || track.preview || (duration > 0 && duration < 60)) return false
    seen.add(stem); return true
  }).map((track, index) => {
    const artistWeight = artistNames(track).reduce((sum, artist) => sum + (profile?.artists?.[normalize(artist)]?.weight || 0), 0)
    const vibeWeight = genresForTrack(track).reduce((sum, vibe) => sum + (profile?.vibes?.[normalize(vibe)]?.weight || 0), 0)
    const genreWeight = genresForTrack(track).reduce((sum, genre) => sum + (profile?.genres?.[normalize(genre)]?.weight || 0), 0)
    const text = [track.title, track.artist, track.album, track.genre, ...(track.tags || [])].join(' ')
    const score = (pattern?.test(text) ? 1000 : 0) +
      Math.min(artistWeight * 2 + vibeWeight + genreWeight * 0.5, 160) +
      eraScore(track, profile) +
      keywordScore(track, profile) +
      (known.has(track.id) ? 20 : 0) +
      (played.has(track.id) ? 8 : 0)
    return { track, score, index }
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.track)
}

export function buildQuickPicksAndRadio(tracks, options = {}, seed = null) {
  const ranked = rankHomeTracks(tracks, options)
  const related = seed ? rankHomeTracks(ranked, { ...options, profile: applyTasteSignal(options.profile, 'play', { track: seed }, () => 0) }) : ranked
  const stem = seed ? getCanonicalSongStem(seed) : ''
  const radio = [
    ...(seed ? [seed] : []),
    ...related.filter(track => track.id !== seed?.id && getCanonicalSongStem(track) !== stem),
  ].slice(0, 16)
  return { quickPicks: ranked.slice(0, 12), radio }
}

// Autoplay continuation: the same learned profile picks the next station seed.
export function buildRadioContinuation(profile, tracks, seed = null, limit = 12) {
  const ranked = rankHomeTracks(tracks, { profile })
  const stem = seed ? getCanonicalSongStem(seed) : ''
  return ranked.filter(track => track.id !== seed?.id && getCanonicalSongStem(track) !== stem).slice(0, limit)
}

/** YouTube-Music-style artist radio.
 * 50% primary artist, 30% same vibe/mood/era/co-artist, 20% learned taste.
 * The interleave guarantees at least two same-artist/collaborator tracks inside
 * the first four picks, so the station immediately sounds like the seed.
 */
export function buildArtistRadio(seed, tracks = [], profile = null, options = {}) {
  if (!seed?.id) return []
  const limit = Math.max(4, Number(options.limit) || 12)
  const seedStem = getCanonicalSongStem(seed)
  const names = artistNames(seed).map(normalize).filter(Boolean)
  const primaryArtist = names[0] || ''
  const collaborators = new Set(names.slice(1))
  const seedVibes = new Set(genresForTrack(seed).map(normalize))
  const seedEra = decadeForTrack(seed)
  const seedLanguage = languageForTrack(seed)
  const seen = new Set(seedStem ? [seedStem] : [])

  const artistPool = []
  const vibePool = []
  const tastePool = []
  ;(tracks || []).forEach((track, index) => {
    if (!track?.id || track.id === seed.id) return
    const stem = getCanonicalSongStem(track)
    if (!stem || seen.has(stem)) return
    const duration = Number(track.duration)
    if (track.preview || (duration > 0 && duration < 60)) return
    seen.add(stem)
    const trackArtists = artistNames(track).map(normalize)
    const samePrimary = Boolean(primaryArtist) && trackArtists.includes(primaryArtist)
    const sameCollaborator = trackArtists.some((artist) => collaborators.has(artist))
    const sameVibe = genresForTrack(track).map(normalize).some((vibe) => seedVibes.has(vibe))
    const sameEra = decadeForTrack(track) === seedEra
    const sameLanguage = languageForTrack(track) === seedLanguage
    const artistWeight = trackArtists.reduce((sum, artist) => sum + (profile?.artists?.[artist]?.weight || 0), 0)
    const vibeWeight = genresForTrack(track).reduce((sum, vibe) => sum + (profile?.vibes?.[normalize(vibe)]?.weight || 0), 0)
    const entry = {
      track,
      index,
      samePrimary,
      sameCollaborator,
      sameVibe,
      sameEra,
      sameLanguage,
      tasteScore: artistWeight * 2 + vibeWeight + eraScore(track, profile) + keywordScore(track, profile),
    }
    const related = samePrimary || sameCollaborator
    if (related) artistPool.push(entry)
    else if (sameVibe || sameEra || sameLanguage) vibePool.push(entry)
    else tastePool.push(entry)
  })

  const byTasteThenIndex = (a, b) => b.tasteScore - a.tasteScore || a.index - b.index
  artistPool.sort((a, b) => Number(b.samePrimary) - Number(a.samePrimary) || byTasteThenIndex(a, b))
  vibePool.sort(byTasteThenIndex)
  tastePool.sort(byTasteThenIndex)

  const buckets = [artistPool, vibePool, tastePool]
  const weights = [0.5, 0.3, 0.2]
  const taken = [0, 0, 0]
  const out = []
  while (out.length < limit) {
    let best = -1
    let bestScore = -Infinity
    for (let i = 0; i < buckets.length; i += 1) {
      if (taken[i] >= buckets[i].length) continue
      const score = weights[i] * (out.length + 1) - taken[i]
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) break
    out.push(buckets[best][taken[best]].track)
    taken[best] += 1
  }
  return out
}
