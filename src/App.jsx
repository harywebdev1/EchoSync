import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Home,
  Radio,
  Search,
  Library,
  Plus,
  Heart,
  MoreHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Mic,
  MicOff,
  MessageCircle,
  X,
  ChevronDown,
  ChevronRight,
  Send,
  Smile,
  Users,
  Lock,
  Globe2,
  Sparkles,
  Headphones,
  ListMusic,
  UserPlus,
  Check,
  CheckCheck,
  Music2,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Moon,
  Sun,
  Wifi,
  Crown,
  Disc3,
  AudioLines,
  PanelRightClose,
} from 'lucide-react'

const SAAVN_BASES = ['https://saavn.sumit.co']
const ITUNES_BASE = 'https://itunes.apple.com/search'
const LRCLIB_BASE = 'https://lrclib.net/api'
const LIBRARY_CACHE_KEY = 'echosync.library.v1'
const LYRIC_CACHE_KEY = 'echosync.lyrics.v1'
const LIKES_KEY = 'echosync.likes.v1'
const THEME_KEY = 'echosync.theme.v1'
const LOCK_MESSAGE = '🔒 Listener Mode: Only Room Admin or DJ can control playback'

const SEED_TRACKS = [
  { id: 'kesariya', title: 'Kesariya', artist: 'Arijit Singh', album: 'Brahmastra', duration: 268, c1: '#3c2d5c', c2: '#ca765b', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/9f/13/ca/9f13ca3b-e533-03e0-f19a-f0aaa774581d/196589311191.jpg/600x600bb.jpg' },
  { id: 'apna-bana-le', title: 'Apna Bana Le', artist: 'Arijit Singh', album: 'Bhediya', duration: 261, c1: '#263b35', c2: '#c6a26c', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/29/14/de/2914deba-3fac-4a9a-e493-0efd12bf8c69/840214461774.png/600x600bb.jpg' },
  { id: 'excuses', title: 'Excuses', artist: 'AP Dhillon', album: 'Hidden Gems', duration: 159, c1: '#28231f', c2: '#af5a48', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/47/47/ac/4747ac85-1658-64ae-bc82-220a4d6213d5/859747478890_cover.jpg/600x600bb.jpg' },
  { id: 'tum-hi-ho', title: 'Tum Hi Ho', artist: 'Arijit Singh', album: 'Aashiqui 2', duration: 262, c1: '#31263b', c2: '#a1739c', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/600x600bb.jpg' },
  { id: 'starboy', title: 'Starboy', artist: 'The Weeknd', album: 'Starboy', duration: 230, c1: '#1c2027', c2: '#a8353d', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg' },
  { id: 'pasoori', title: 'Pasoori', artist: 'Ali Sethi & Shae Gill', album: 'Coke Studio', duration: 232, c1: '#213630', c2: '#d38642', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/f3/f9/06/f3f906c3-79d5-ac9a-5fdd-262048f955f9/cover.jpg/600x600bb.jpg' },
  { id: 'tajdar', title: 'Tajdar-e-Haram', artist: 'Atif Aslam', album: 'Coke Studio', duration: 617, c1: '#2b3025', c2: '#b8954a', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/41/67/ad/4167ad0c-1dfd-6655-d62d-61d3059cdd10/7316476372880.jpg/600x600bb.jpg' },
  { id: 'gumaan', title: 'Gumaan', artist: 'Talha Anjum', album: 'Gumaan', duration: 260, c1: '#24262e', c2: '#7a6d9f', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/d4/f3/69/d4f36986-1fe2-0b4c-a2cf-54192ded03ae/artwork.jpg/600x600bb.jpg' },
  { id: 'sunflower', title: 'Sunflower', artist: 'Post Malone & Swae Lee', album: 'Into the Spider-Verse', duration: 158, c1: '#1d2d45', c2: '#cc9245', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4b/30/2c/4b302cb6-7a14-5464-4e97-0577e9d0be49/18UMGIM82277.rgb.jpg/600x600bb.jpg' },
  { id: 'kahani-suno', title: 'Kahani Suno 2.0', artist: 'Kaifi Khalil', album: 'Kahani Suno 2.0', duration: 224, c1: '#34251e', c2: '#b35f48', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/9f/44/a6/9f44a6ef-4438-1794-26ac-7f73d167afbf/artwork.jpg/600x600bb.jpg' },
  { id: 'blinding-lights', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200, c1: '#2c171e', c2: '#c2354b', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/600x600bb.jpg' },
]

const SEED_BY_ID = Object.fromEntries(SEED_TRACKS.map((track) => [track.id, track]))

const MEMBERS = {
  me: { id: 'me', name: 'Haris Mujahid', handle: 'haris', initials: 'HM', av1: '#eda272', av2: '#a14e58', online: true },
  usman: { id: 'usman', name: 'Usman Ali', handle: 'usman.ali', initials: 'UA', av1: '#6b9ae7', av2: '#343e87', online: true },
  zara: { id: 'zara', name: 'Zara Khan', handle: 'zara.k', initials: 'ZK', av1: '#db7ea5', av2: '#763e76', online: true },
  bilal: { id: 'bilal', name: 'Bilal Ahmed', handle: 'bilal.ahmed', initials: 'BA', av1: '#60b9a7', av2: '#296d70', online: true },
  sana: { id: 'sana', name: 'Sana Iqbal', handle: 'sana.iqbal', initials: 'SI', av1: '#d9aa59', av2: '#8d5c34', online: true },
  ayaan: { id: 'ayaan', name: 'Ayaan Raza', handle: 'ayaan.r', initials: 'AR', av1: '#9187dc', av2: '#514093', online: false },
}

const ROOMS = [
  {
    id: 'midnight-radio',
    name: 'Midnight Radio',
    accent: '#f16b73',
    accent2: '#f2b38e',
    tagline: 'For the drive home, and the hour after.',
    description: 'After-hours R&B, soft rap, and songs that sound better when the city is asleep.',
    trackIds: ['kesariya', 'excuses', 'starboy', 'apna-bana-le', 'sunflower', 'blinding-lights'],
    members: ['me', 'usman', 'zara', 'bilal'],
    listeners: 128,
    private: false,
    dj: 'usman',
    c1: '#251c27',
    c2: '#94484e',
  },
  {
    id: 'sufi-sundays',
    name: 'Sufi Sundays',
    accent: '#d8a64c',
    accent2: '#efcf93',
    tagline: 'Devotional voices, unhurried.',
    description: 'Tea optional. Every Sunday we let the qawwalis take their time.',
    trackIds: ['tajdar', 'pasoori', 'kahani-suno', 'tum-hi-ho', 'apna-bana-le'],
    members: ['sana', 'zara', 'me'],
    listeners: 46,
    private: true,
    dj: 'sana',
    c1: '#332916',
    c2: '#9c7433',
  },
  {
    id: 'late-night-punjabi',
    name: 'Late Night Punjabi',
    accent: '#43c692',
    accent2: '#a7e2b9',
    tagline: 'Bass, tabs, and absolutely no skips.',
    description: 'AP Dhillon keeps the aux. Windows down, even if you are inside.',
    trackIds: ['excuses', 'apna-bana-le', 'kahani-suno', 'gumaan', 'pasoori'],
    members: ['bilal', 'ayaan', 'me'],
    listeners: 83,
    private: false,
    dj: 'bilal',
    c1: '#172b24',
    c2: '#2d7d5e',
  },
  {
    id: 'coke-studio-deep-cuts',
    name: 'Coke Studio Deep Cuts',
    accent: '#5bbde7',
    accent2: '#a9d8ee',
    tagline: 'The versions that live rent-free.',
    description: 'Front-row seats to the season finales. Bring your best headphones.',
    trackIds: ['tajdar', 'pasoori', 'kesariya', 'tum-hi-ho'],
    members: ['ayaan', 'usman', 'sana'],
    listeners: 212,
    private: true,
    dj: 'ayaan',
    c1: '#162430',
    c2: '#2e6582',
  },
]

const DEFAULT_ROLES = {
  'midnight-radio': 'admin',
  'sufi-sundays': 'listener',
  'late-night-punjabi': 'listener',
  'coke-studio-deep-cuts': 'listener',
}

const SEED_MESSAGES = {
  'midnight-radio': [
    { id: 'm1', author: 'zara', text: 'this intro is unreal 😮‍💨', time: '11:42 PM', reactions: [] },
    { id: 'm2', author: 'usman', text: 'queued it for the 2am crowd. headphones on.', time: '11:43 PM', reactions: [{ emoji: '🎧', count: 2, mine: false }] },
    { id: 'm3', author: 'bilal', text: 'the bass on that chorus though', time: '11:44 PM', reactions: [] },
    { id: 'm4', author: 'me', text: 'this room is a whole mood', time: '11:45 PM', reactions: [{ emoji: '🌙', count: 3, mine: true }], read: true },
  ],
  'sufi-sundays': [
    { id: 's1', author: 'sana', text: 'chai is ready. volume is not.', time: '7:02 PM', reactions: [{ emoji: '🫖', count: 4, mine: false }] },
    { id: 's2', author: 'zara', text: 'that opening takbir gives me chills every time', time: '7:04 PM', reactions: [] },
    { id: 's3', author: 'me', text: 'no notes. just goosebumps.', time: '7:06 PM', reactions: [], read: true },
  ],
  'late-night-punjabi': [
    { id: 'p1', author: 'bilal', text: 'aux cord is mine tonight, sorry not sorry', time: '11:56 PM', reactions: [] },
    { id: 'p2', author: 'ayaan', text: 'excuses on repeat is a personality', time: '11:57 PM', reactions: [{ emoji: '😂', count: 2, mine: false }] },
    { id: 'p3', author: 'me', text: 'windows down in spirit', time: '11:58 PM', reactions: [], read: true },
  ],
  'coke-studio-deep-cuts': [
    { id: 'c1', author: 'ayaan', text: 'the live mix is so much better than the studio cut', time: '9:14 PM', reactions: [{ emoji: '💯', count: 3, mine: false }] },
    { id: 'c2', author: 'sana', text: 'the backing vocalists deserve their own tour', time: '9:16 PM', reactions: [] },
    { id: 'c3', author: 'usman', text: 'goosebumps. actual goosebumps.', time: '9:17 PM', reactions: [], },
  ],
}

const REPLY_OPTIONS = [
  'this one never gets old.',
  'okay but that bassline 😮‍💨',
  '+1, adding this to my library',
  'the transition was so smooth',
  'who chose this? genius.',
  'I was just about to say the same thing',
  'headphones recommended for this part',
  'this room has immaculate taste',
]

const BAD_MATCH = /\b(karaoke|instrumental|cover|tribute|remix|slowed|reverb|8d|8-d|lofi|lo-fi|nightcore|sped up|sped-up|made famous|in the style of|originally performed|workout|ringtone|mashup|dj mix|tribute)\b/i

const LYRIC_EMOJIS = ['❤️', '🔥', '😂', '🎧', '🌙', '✨', '💯', '🫶', '🥹', '🙌', '👀', '🎶', '💫', '😮‍💨']

function formatTime(value) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function clockNow() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function initials(value = '') {
  return value
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function decodeEntities(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage can be unavailable */
  }
}

function loadLibraryCache() {
  const cache = readStorage(LIBRARY_CACHE_KEY, {})
  const now = Date.now()
  const valid = {}
  Object.entries(cache).forEach(([id, entry]) => {
    if (entry && entry.savedAt && now - entry.savedAt < 1000 * 60 * 60 * 10 && entry.track?.streamUrl) {
      valid[id] = entry.track
    }
  })
  return valid
}

function buildInitialLibrary() {
  const cache = loadLibraryCache()
  const library = {}
  SEED_TRACKS.forEach((seed) => {
    const cached = cache[seed.id]
    library[seed.id] = cached
      ? { ...seed, ...cached, id: seed.id, status: 'ready' }
      : { ...seed, status: 'pending', streamUrl: null, cover: null }
  })
  return library
}

function saveLibraryEntry(id, track) {
  const cache = readStorage(LIBRARY_CACHE_KEY, {})
  cache[id] = { savedAt: Date.now(), track }
  writeStorage(LIBRARY_CACHE_KEY, cache)
}

function loadLyricCache() {
  return readStorage(LYRIC_CACHE_KEY, {})
}

function saveLyricCache(key, data) {
  const cache = loadLyricCache()
  cache[key] = { savedAt: Date.now(), data }
  const keys = Object.keys(cache)
  if (keys.length > 40) {
    keys
      .sort((a, b) => cache[a].savedAt - cache[b].savedAt)
      .slice(0, keys.length - 40)
      .forEach((oldKey) => delete cache[oldKey])
  }
  writeStorage(LYRIC_CACHE_KEY, cache)
}

async function fetchJson(url, options = {}) {
  const { timeout = 4500, ...rest } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...rest, signal: controller.signal })
    if (!response.ok) {
      const error = new Error(`Request failed (${response.status})`)
      error.status = response.status
      throw error
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function normalizeSaavn(raw) {
  const downloads = Array.isArray(raw.downloadUrl) ? raw.downloadUrl : []
  const images = Array.isArray(raw.image) ? raw.image : []
  const stream =
    downloads.find((item) => item.quality === '320kbps') ||
    downloads.find((item) => item.quality === '160kbps') ||
    downloads[downloads.length - 1]
  const cover =
    images.find((item) => item.quality === '500x500') ||
    images[images.length - 1]
  const artists = raw.artists?.primary?.map((artist) => artist.name).filter(Boolean)
  const artist =
    (artists && artists.length ? artists.join(', ') : null) ||
    decodeEntities(raw.primaryArtists || raw.artist || 'Unknown artist')
  return {
    id: `jio-${raw.id}`,
    provider: 'jiosaavn',
    providerLabel: 'JioSaavn',
    title: decodeEntities(raw.name || 'Unknown track'),
    artist: decodeEntities(artist),
    album: decodeEntities(raw.album?.name || 'Single'),
    duration: Number(raw.duration) || 0,
    streamUrl: stream?.url || null,
    cover: cover?.url || null,
    quality: downloads.find((item) => item.quality === '320kbps')?.quality || stream?.quality || '',
  }
}

function normalizeItunes(raw) {
  const art = raw.artworkUrl100 || raw.artworkUrl60 || ''
  const fullDuration = raw.trackTimeMillis ? raw.trackTimeMillis / 1000 : 30
  return {
    id: `itunes-${raw.trackId}`,
    provider: 'itunes',
    providerLabel: 'iTunes',
    title: decodeEntities(raw.trackName || 'Unknown track'),
    artist: decodeEntities(raw.artistName || 'Unknown artist'),
    album: decodeEntities(raw.collectionName || 'Single'),
    duration: 30,
    fullDuration,
    preview: true,
    streamUrl: raw.previewUrl || null,
    cover: art ? art.replace(/\/\d+x\d+bb[^/]*\.(jpg|png)/i, '/600x600bb.jpg').replace('100x100bb', '600x600bb') : null,
    quality: '30s',
  }
}

function titleOverlap(a, b) {
  const first = new Set(normalize(a).split(' ').filter(Boolean))
  const second = new Set(normalize(b).split(' ').filter(Boolean))
  if (!first.size || !second.size) return 0
  let shared = 0
  first.forEach((token) => {
    if (second.has(token)) shared += 1
  })
  return shared / Math.max(first.size, second.size)
}

function scoreMatch(track, seed) {
  if (!track?.streamUrl || !track.title || !track.artist) return -1
  if (BAD_MATCH.test(track.title) || BAD_MATCH.test(track.artist)) return -1
  const targetTitle = normalize(seed.title)
  const candidateTitle = normalize(track.title)
  if (!targetTitle || !candidateTitle) return -1
  let score = 0
  if (candidateTitle === targetTitle) score += 55
  else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 30
  else if (titleOverlap(seed.title, track.title) >= 0.8) score += 20
  else return -1

  const seedArtists = seed.artist
    .split(/\s*(?:&|,| and )\s*/i)
    .map(normalize)
    .filter(Boolean)
  const candidateArtist = normalize(track.artist)
  const artistHit = seedArtists.some((artist) => {
    if (!artist) return false
    return candidateArtist.includes(artist) || artist.includes(candidateArtist)
  })
  if (!artistHit) return -1
  score += 30

  const duration = track.fullDuration || track.duration
  if (duration && seed.duration) {
    const difference = Math.abs(duration - seed.duration)
    if (difference > 55) return -1
    if (difference <= 5) score += 15
    else if (difference <= 20) score += 8
  }
  return score
}

function chooseBest(results, seed) {
  return results
    .map((track) => ({ track, score: scoreMatch(track, seed) }))
    .filter((entry) => entry.score >= 70)
    .sort((a, b) => b.score - a.score)[0]?.track || null
}

async function fetchJioSearch(query, limit = 12) {
  for (const base of SAAVN_BASES) {
    try {
      const payload = await fetchJson(
        `${base}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`,
        { timeout: 4200 },
      )
      const results = payload?.data?.results || payload?.data?.songs?.results || []
      if (Array.isArray(results) && results.length) {
        return results.map(normalizeSaavn).filter((track) => track.streamUrl)
      }
    } catch {
      /* try the next verified mirror */
    }
  }
  return []
}

async function fetchItunesSearch(query, limit = 12) {
  try {
    const payload = await fetchJson(
      `${ITUNES_BASE}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`,
      { timeout: 5000 },
    )
    const results = Array.isArray(payload?.results) ? payload.results : []
    return results.map(normalizeItunes).filter((track) => track.streamUrl)
  } catch {
    return []
  }
}

async function searchEverything(query) {
  const [jioResult, itunesResult] = await Promise.allSettled([
    fetchJioSearch(query, 14),
    fetchItunesSearch(query, 12),
  ])
  const jio = jioResult.status === 'fulfilled' ? jioResult.value : []
  const itunes = itunesResult.status === 'fulfilled' ? itunesResult.value : []
  const seen = new Set()
  return [...jio, ...itunes].filter((track) => {
    const key = `${normalize(track.title)}::${normalize(track.artist)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 18)
}

const resolutionPromises = new Map()

async function resolveSeed(seed) {
  if (resolutionPromises.has(seed.id)) return resolutionPromises.get(seed.id)
  const task = (async () => {
    const primaryQuery = `${seed.title} ${seed.artist}`
    let candidates = await fetchJioSearch(primaryQuery, 16)
    let best = chooseBest(candidates, seed)
    if (best) return { ...seed, ...best, id: seed.id, c1: seed.c1, c2: seed.c2, cover: seed.cover || best.cover || null }

    candidates = await fetchItunesSearch(primaryQuery, 16)
    best = chooseBest(candidates, seed)
    if (best) return { ...seed, ...best, id: seed.id, c1: seed.c1, c2: seed.c2, cover: seed.cover || best.cover || null }

    candidates = await fetchJioSearch(seed.title, 16)
    best = chooseBest(candidates, seed)
    if (best) return { ...seed, ...best, id: seed.id, c1: seed.c1, c2: seed.c2, cover: seed.cover || best.cover || null }

    const error = new Error('No official stream found')
    error.code = 'UNRESOLVED'
    throw error
  })()
  resolutionPromises.set(seed.id, task)
  try {
    return await task
  } catch (error) {
    resolutionPromises.delete(seed.id)
    throw error
  }
}

function parseLrc(text) {
  if (!text) return []
  const lines = []
  text.split(/\r?\n/).forEach((rawLine) => {
    const stamps = [...rawLine.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) return
    const content = rawLine.replace(/\[[^\]]+\]/g, '').trim()
    if (!content) return
    stamps.forEach((stamp) => {
      const minutes = Number(stamp[1])
      const seconds = Number(stamp[2])
      const fraction = stamp[3] ? Number(stamp[3].padEnd(3, '0')) : 0
      lines.push({ time: minutes * 60 + seconds + fraction / 1000, text: content })
    })
  })
  return lines.sort((a, b) => a.time - b.time)
}

function normalizeLyricData(payload) {
  if (!payload) return null
  if (payload.syncedLyrics) {
    const lines = parseLrc(payload.syncedLyrics)
    if (lines.length) {
      return { type: 'synced', lines, source: 'LRCLIB', instrumental: Boolean(payload.instrumental) }
    }
  }
  if (payload.plainLyrics) {
    return { type: 'plain', plain: payload.plainLyrics, source: 'LRCLIB', instrumental: Boolean(payload.instrumental) }
  }
  return null
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchLyrics(track) {
  if (!track?.title || !track?.artist) return null
  const cache = loadLyricCache()
  const cacheKey = `${normalize(track.title)}::${normalize(track.artist)}`
  const cached = cache[cacheKey]
  if (cached && Date.now() - cached.savedAt < 1000 * 60 * 60 * 24) return cached.data

  let networkFailed = false
  const attempts = [
    `${LRCLIB_BASE}/get?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist)}`,
    `${LRCLIB_BASE}/get?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist.split('&')[0].trim())}`,
  ]
  for (const url of attempts) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const payload = await fetchJson(url, { timeout: 4800 })
        const normalized = normalizeLyricData(payload)
        if (normalized) {
          saveLyricCache(cacheKey, normalized)
          return normalized
        }
        break
      } catch (error) {
        if (error.status === 404) break
        networkFailed = true
        if (attempt === 0) await delay(900)
      }
    }
  }

  try {
    const payload = await fetchJson(
      `${LRCLIB_BASE}/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`,
      { timeout: 5200 },
    )
    const results = Array.isArray(payload) ? payload : []
    const best = results
      .map((entry) => {
        const candidate = {
          title: entry.trackName,
          artist: entry.artistName,
          streamUrl: 'present',
        }
        return { entry, score: scoreMatch(candidate, track) }
      })
      .filter(({ score, entry }) => score >= 0 || entry?.syncedLyrics)
      .sort((a, b) => b.score - a.score)[0]?.entry
    const normalized = normalizeLyricData(best)
    if (normalized) {
      saveLyricCache(cacheKey, normalized)
      return normalized
    }
  } catch (error) {
    if (error.status !== 404) networkFailed = true
  }
  if (networkFailed) throw new Error('Lyrics temporarily unavailable')
  return null
}

function Logo() {
  return (
    <div className="brand">
      <div className="brand-glyph">
        <span className="bars"><i /><i /><i /><i /></span>
      </div>
      <span className="brand-name">Echo<span>Sync</span></span>
      <span className="brand-beta">BETA</span>
    </div>
  )
}

function Avatar({ member, size = '', online = false, className = '' }) {
  if (!member) return null
  return (
    <span
      className={`avatar ${size} ${className}`}
      style={{ '--av1': member.av1, '--av2': member.av2 }}
      title={member.name}
    >
      {member.initials}
      {online && <i className="avatar-online" />}
    </span>
  )
}

function AvatarStack({ ids = [], size = 'xs', max = 4 }) {
  return (
    <div className="avatar-stack">
      {ids.slice(0, max).map((id) => (
        <Avatar key={id} member={MEMBERS[id]} size={size} />
      ))}
    </div>
  )
}

function Cover({ track, size = 'cover-size-sm', className = '', showQuality = false, playing = false }) {
  return (
    <div
      className={`cover ${size} ${playing ? 'playing' : ''} ${className}`}
      style={{ '--c1': track?.c1 || '#26303a', '--c2': track?.c2 || '#a65845' }}
    >
      {track?.cover ? (
        <img src={track.cover} alt="" loading={size === 'cover-size-hero' ? 'eager' : 'lazy'} />
      ) : (
        <div className="cover-fallback">
          <span className="cover-glyph">{initials(track?.title || 'Echo')}</span>
        </div>
      )}
      {showQuality && track?.quality && (
        <span className="quality-badge"><AudioLines /> {track.quality}</span>
      )}
    </div>
  )
}

function ProviderBadge({ provider, preview }) {
  return (
    <span className={`source-badge ${provider || ''}`}>
      {provider === 'jiosaavn' ? 'JioSaavn' : provider === 'itunes' ? 'iTunes' : 'Library'}
      {preview ? ' · 30s' : ''}
    </span>
  )
}

function Equalizer({ className = 'live-eq' }) {
  return (
    <span className={className}>
      <i /><i /><i />
    </span>
  )
}

function Sidebar({
  room,
  view,
  onNavigate,
  onSearch,
  onJoinRoom,
  role,
  onInvite,
  likedCount,
  onOpenProfile,
}) {
  return (
    <aside className="sidebar">
      <Logo />

      <button className="search-trigger" onClick={onSearch}>
        <Search size={14} />
        <span>Search the room</span>
        <kbd>⌘K</kbd>
      </button>

      <nav className="side-nav">
        <button className={`nav-item ${view === 'room' ? 'active' : ''}`} onClick={() => onNavigate('room')}>
          <Home />
          <span>Home</span>
        </button>
        <button className={`nav-item ${view === 'rooms' ? 'active' : ''}`} onClick={() => onNavigate('rooms')}>
          <Radio />
          <span>Rooms</span>
          <span className="nav-count">04</span>
        </button>
        <button className="nav-item" onClick={onSearch}>
          <Search />
          <span>Search</span>
        </button>
        <button className={`nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => onNavigate('library')}>
          <Library />
          <span>Your library</span>
          <span className="nav-count">{String(likedCount).padStart(2, '0')}</span>
        </button>
      </nav>

      <div className="side-section">
        <div className="side-label">
          <span>LISTENING ROOMS</span>
          <button onClick={onInvite} aria-label="Create room"><Plus size={13} /></button>
        </div>
        <div className="room-list">
          {ROOMS.map((item) => (
            <button
              key={item.id}
              className={`room-link ${room.id === item.id && view === 'room' ? 'active' : ''}`}
              style={{ '--room-accent': item.accent }}
              onClick={() => onJoinRoom(item)}
            >
              <span className="room-dot" />
              <span className="room-link-name">{item.name}</span>
              {item.private && <Lock size={9} style={{ opacity: 0.45 }} />}
              <Equalizer />
            </button>
          ))}
        </div>
      </div>

      <div className="side-bottom">
        <div className="invite-card">
          <strong>Listening is better together.</strong>
          <p>Invite a friend into the room. Playback stays in lockstep.</p>
          <button onClick={onInvite}><UserPlus size={11} /> Copy invite link</button>
        </div>
        <button className="profile" onClick={onOpenProfile}>
          <Avatar member={MEMBERS.me} online />
          <span className="profile-meta">
            <strong>{MEMBERS.me.name}</strong>
            <span><Crown size={10} /> {role} of {room.name}</span>
          </span>
          <MoreHorizontal size={15} />
        </button>
      </div>
    </aside>
  )
}

function StageBar({
  room,
  view,
  theme,
  onToggleTheme,
  onSearch,
  onToggleChat,
  chatOpen,
  onHome,
}) {
  return (
    <header className="stage-bar">
      <div className="mobile-brand" onClick={onHome} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onHome()}>
        <div className="brand-glyph" style={{ width: 25, height: 25, borderRadius: 8 }}>
          <span className="bars" style={{ transform: 'scale(0.78)' }}><i /><i /><i /><i /></span>
        </div>
        <span className="brand-name" style={{ fontSize: 15 }}>Echo<span>Sync</span></span>
      </div>

      <div className="stage-crumb">
        <span className="live-pill"><span className="live-dot" /> LIVE</span>
        <ChevronRight />
        <strong>{view === 'rooms' ? 'All rooms' : view === 'library' ? 'Your library' : room.name}</strong>
      </div>

      <div className="stage-actions">
        <button className="icon-btn" onClick={onSearch} aria-label="Search">
          <Search />
        </button>
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <button className={`icon-btn chat-desktop-toggle ${chatOpen ? 'active' : ''}`} onClick={onToggleChat} aria-label="Toggle room chat">
          <MessageCircle />
        </button>
      </div>
    </header>
  )
}

const ROLE_COPY = {
  admin: { label: 'Admin', note: 'Full playback and queue control', Icon: Crown },
  dj: { label: 'DJ', note: 'Playback control, locked queue', Icon: Disc3 },
  listener: { label: 'Listener', note: 'Listen along, controls locked', Icon: Headphones },
}

function VoiceRow({
  micOn,
  micLevel,
  speaking,
  duckTest,
  ducked,
  onToggleMic,
  onDuckTest,
}) {
  const bars = [0.35, 0.7, 1, 0.55, 0.82, 0.42, 0.65]
  return (
    <div className="voice-row">
      <button className={`voice-btn ${micOn ? 'on' : ''}`} onClick={onToggleMic}>
        {micOn ? <Mic /> : <MicOff />}
        <span>{micOn ? 'Mic live' : 'Join mic'}</span>
        {micOn && <i className="voice-live-dot" />}
      </button>
      <button className={`voice-test ${duckTest ? 'busy' : ''}`} onClick={onDuckTest} disabled={duckTest}>
        {duckTest ? <span className="spinner" /> : <Sparkles />}
        <span>{duckTest ? 'Ducking…' : 'Duck test'}</span>
      </button>
      {speaking && (
        <span className="duck-indicator on">
          <span className="mic-bars">
            {bars.map((height, index) => (
              <i
                key={index}
                style={{ height: `${Math.max(3, height * (micLevel || 0.3) * 11)}px` }}
              />
            ))}
          </span>
          {ducked ? 'Music ducked to 20%' : 'Voice detected'}
        </span>
      )}
      <span className="voice-note"><Lock size={8} /> On-device · never recorded</span>
    </div>
  )
}

function RoomsView({ library, currentRoom, onJoin }) {
  return (
    <div className="rooms-view">
      <div className="eyebrow">
        <span className="live-pill"><Radio size={9} /> DISCOVER</span>
        <span className="seg" />
        <span>4 ROOMS LIVE</span>
      </div>
      <h1 className="page-title">Find your <em>frequency.</em></h1>
      <p className="page-sub">Small rooms, shared speakers, and a queue that moves together. Step into a room and stay a while.</p>

      <div className="rooms-grid">
        {ROOMS.map((room) => {
          const firstCover = room.trackIds.map((id) => library[id]?.cover).find(Boolean)
          return (
            <button
              key={room.id}
              className="room-card"
              style={{ '--rc1': room.c1, '--rc2': room.c2 }}
              onClick={() => onJoin(room)}
            >
              {firstCover && <img src={firstCover} alt="" />}
              <div className="rc-top">
                <span className="rc-live"><span className="live-dot" /> LIVE</span>
                {room.private && <span className="rc-private"><Lock size={9} /> Private</span>}
                <span className="rc-listeners">{room.listeners} listening</span>
              </div>
              <h2 className="rc-title">{room.name}</h2>
              <p className="rc-sub">{room.tagline}</p>
              <div className="rc-foot">
                <AvatarStack ids={room.members} size="xs" max={3} />
                <span>{room.members.length + room.listeners - (room.id === currentRoom.id ? 1 : 0)} in the room</span>
                <span className="rc-join"><Headphones size={11} /> {room.id === currentRoom.id ? 'You’re here' : 'Join room'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LibraryView({ library, liked, onPlay, onLike, onSearch }) {
  const likedTracks = liked.map((id) => library[id]).filter(Boolean)
  return (
    <div className="library-view">
      <div className="eyebrow">
        <span className="live-pill"><Heart size={9} /> SAVED</span>
        <span className="seg" />
        <span>{likedTracks.length} TRACKS</span>
      </div>
      <h1 className="page-title">Songs you keep <em>coming back to.</em></h1>
      <p className="page-sub">Everything you have saved while listening across the rooms. Yours, quietly waiting.</p>

      <div className="section-head">
        <div>
          <h3>Liked songs</h3>
          <p>Saved across every room.</p>
        </div>
        <div className="head-actions">
          <button className="text-btn" onClick={onSearch}><Plus /> Find something new</button>
        </div>
      </div>

      <section className="library-list">
        {likedTracks.length === 0 ? (
          <div className="library-empty">
            <Music2 />
            <h4>Your library is quiet</h4>
            <p>Tap the heart on any song to keep it here.</p>
          </div>
        ) : (
          likedTracks.map((track, index) => (
            <div
              className="library-row"
              key={track.id}
              role="button"
              tabIndex={0}
              onClick={() => onPlay(track)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onPlay(track)
              }}
            >
              <span className="num">{String(index + 1).padStart(2, '0')}</span>
              <Cover track={track} size="cover-size-sm" />
              <div className="queue-copy">
                <strong>{track.title}</strong>
                <span>{track.artist}{track.providerLabel ? ` · ${track.providerLabel}` : ''}</span>
              </div>
              <span className="album">{track.album || 'Single'}</span>
              <span className="dur">{track.status === 'ready' ? formatTime(track.duration) : '—'}</span>
              <button
                className="queue-heart liked"
                onClick={(event) => {
                  event.stopPropagation()
                  onLike(track.id)
                }}
                aria-label="Unlike track"
              >
                <Heart />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function LyricsPanel({
  track,
  lyrics,
  progress,
  canControl,
  onSeek,
  onLock,
  onRetry,
  showTrack = true,
}) {
  const scrollRef = useRef(null)
  const pauseUntil = useRef(0)
  const resumeTimer = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [pausedHint, setPausedHint] = useState(false)

  const activeIndex = useMemo(() => {
    if (lyrics?.status !== 'ready' || lyrics.type !== 'synced' || !lyrics.lines?.length) return -1
    let active = -1
    for (let index = 0; index < lyrics.lines.length; index += 1) {
      if (lyrics.lines[index].time <= progress + 0.12) active = index
      else break
    }
    return active < 0 ? 0 : active
  }, [lyrics, progress])

  useEffect(() => {
    if (!autoScroll || activeIndex < 0 || !scrollRef.current) return
    if (Date.now() < pauseUntil.current) return
    const container = scrollRef.current
    const line = container.querySelector(`[data-lyric-index="${activeIndex}"]`)
    if (!line) return
    const top = line.offsetTop - container.clientHeight * 0.32
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [activeIndex, autoScroll])

  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  const pauseAutoScroll = () => {
    if (!autoScroll) return
    pauseUntil.current = Date.now() + 6000
    setPausedHint(true)
    clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setPausedHint(false), 6000)
  }

  const seekLine = (line) => {
    if (!canControl) {
      onLock()
      return
    }
    onSeek(line.time)
  }

  return (
    <div className="lyrics-shell">
      {showTrack && (
        <div className="lyrics-track">
          <Cover track={track} size="cover-size-sm" />
          <div className="lyrics-track-copy">
            <strong>{track?.title || 'Nothing playing'}</strong>
            <span>{track?.artist || 'EchoSync'}</span>
          </div>
          <span className="source-badge">LRCLIB</span>
        </div>
      )}

      <div
        className="lyrics-body"
        ref={scrollRef}
        onWheel={pauseAutoScroll}
        onTouchMove={pauseAutoScroll}
      >
        {lyrics?.status === 'loading' && (
          <div className="lyrics-skeleton">
            <span /><span /><span /><span /><span /><span />
          </div>
        )}

        {lyrics?.status === 'error' && (
          <div className="lyrics-placeholder">
            <AlertCircle />
            <h4>No lyrics on this frequency</h4>
            <p>LRCLIB is taking a breath. The room keeps playing — try the lyrics again in a moment.</p>
            <button className="retry-btn" onClick={onRetry}><RefreshCw /> Try again</button>
          </div>
        )}

        {lyrics?.status === 'idle' && (
          <div className="lyrics-placeholder">
            <Music2 />
            <h4>Lyrics, when you want them</h4>
            <p>Play a track and the words will find their place here.</p>
          </div>
        )}

        {lyrics?.status === 'ready' && lyrics.type === 'plain' && (
          <div className="plain-lyrics">{lyrics.plain}</div>
        )}

        {lyrics?.status === 'ready' && lyrics.type === 'synced' && (
          <>
            {lyrics.lines.map((line, index) => (
              <button
                key={`${line.time}-${index}`}
                className={`lyric-line ${index === activeIndex ? 'active' : ''}`}
                data-lyric-index={index}
                onClick={() => seekLine(line)}
              >
                <span className="lyric-time">{formatTime(line.time)}</span>
                {line.text}
              </button>
            ))}
            {lyrics.instrumental && (
              <div className="lyrics-placeholder" style={{ minHeight: 100 }}>
                <p>This one lets the instruments do the talking.</p>
              </div>
            )}
          </>
        )}

        {lyrics?.status === 'none' && (
          <div className="lyrics-placeholder">
            <Sparkles />
            <h4>No lyrics for this one</h4>
            <p>The room keeps moving. Some songs are better without words.</p>
          </div>
        )}
      </div>

      <div className="lyrics-foot">
        <span className="source-badge">LRCLIB</span>
        <span className="mono">
          {lyrics?.status === 'ready' && lyrics.type === 'synced'
            ? `${lyrics.lines.length} lines · synced`
            : lyrics?.status === 'loading'
              ? 'finding words…'
              : lyrics?.status === 'error'
                ? 'unavailable'
                : 'time-synced lyrics'}
        </span>
        <button className={`auto-toggle ${autoScroll ? 'on' : ''}`} onClick={() => setAutoScroll((value) => !value)}>
          <Sparkles />
          {pausedHint && autoScroll ? 'Paused' : autoScroll ? 'Auto' : 'Manual'}
        </button>
      </div>
    </div>
  )
}

function ChatPanel({
  room,
  activeTab,
  onTab,
  messages,
  typingMemberId,
  draft,
  onDraft,
  onSend,
  onReact,
  onClose,
  track,
  lyrics,
  progress,
  canControl,
  onSeek,
  onLock,
  onRetryLyrics,
  open,
}) {
  const chatRef = useRef(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const typingMember = typingMemberId ? MEMBERS[typingMemberId] : null

  useEffect(() => {
    if (activeTab !== 'chat') return
    const node = chatRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages.length, typingMemberId, activeTab, room.id])

  useEffect(() => {
    setEmojiOpen(false)
  }, [room.id])

  return (
    <aside className={`social ${open ? 'mobile-open' : ''}`}>
      <div className="social-top">
        <div className="social-tabs">
          <button className={`social-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => onTab('chat')}>
            <MessageCircle /> Room chat
          </button>
          <button className={`social-tab ${activeTab === 'lyrics' ? 'active' : ''}`} onClick={() => onTab('lyrics')}>
            <Sparkles /> Lyrics
          </button>
        </div>
        <button className="icon-btn social-close" onClick={onClose} aria-label="Close panel">
          <X />
        </button>
      </div>

      <div className="social-head">
        <div className="social-head-copy">
          <h3>{activeTab === 'chat' ? 'Room chat' : 'Live lyrics'}</h3>
          <p>
            {activeTab === 'chat' ? (
              <><Wifi /> {room.listeners.toLocaleString()} listening · {room.members.length} in here</>
            ) : (
              <>Synced with playback · LRCLIB</>
            )}
          </p>
        </div>
        {activeTab === 'chat' ? (
          <AvatarStack ids={room.members} size="xs" max={3} />
        ) : (
          <span className="sync-chip"><Wifi /> <b>live</b></span>
        )}
      </div>

      {activeTab === 'chat' ? (
        <>
          <div className="chat-body" ref={chatRef}>
            <div className="chat-day"><span>Tonight · {room.name}</span></div>
            {messages.map((message) => {
              const author = MEMBERS[message.author] || MEMBERS.me
              const mine = message.author === 'me'
              return (
                <div className={`msg-row ${mine ? 'mine' : ''}`} key={message.id}>
                  {!mine && <Avatar member={author} size="sm" />}
                  <div className="msg-main">
                    {!mine && (
                      <div className="msg-author">
                        {author.name}
                        {message.author === room.dj && <span className="dj-tag">DJ</span>}
                      </div>
                    )}
                    <div className="bubble">
                      {message.text}
                      <span className="bubble-meta">
                        {message.time}
                        {mine && (message.read ? <CheckCheck /> : <Check />)}
                      </span>
                      <button
                        className="msg-react-trigger"
                        onClick={() => onReact(message.id, '❤️')}
                        aria-label="React with heart"
                      >
                        <Smile />
                      </button>
                    </div>
                    {message.reactions?.length > 0 && (
                      <div className="msg-reactions">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            className={`reaction ${reaction.mine ? 'mine' : ''}`}
                            onClick={() => onReact(message.id, reaction.emoji)}
                          >
                            {reaction.emoji} <b>{reaction.count}</b>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {typingMember && (
              <div className="typing-row">
                <Avatar member={typingMember} size="sm" />
                <div>
                  <div className="typing-bubble"><i /><i /><i /></div>
                  <span className="typing-label">{typingMember.name.split(' ')[0]} is typing</span>
                </div>
              </div>
            )}
          </div>

          <div className="chat-composer">
            {emojiOpen && (
              <div className="emoji-pop">
                {LYRIC_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => onDraft(draft + emoji)}>{emoji}</button>
                ))}
              </div>
            )}
            <button className="emoji-btn" onClick={() => setEmojiOpen((value) => !value)} aria-label="Add emoji">
              <Smile />
            </button>
            <div className="composer-input">
              <input
                value={draft}
                onChange={(event) => onDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    onSend()
                  }
                }}
                placeholder="Message the room…"
                aria-label="Room message"
              />
              <button className="send-btn" onClick={onSend} aria-label="Send message">
                <Send />
              </button>
            </div>
          </div>
          <div className="social-note"><Lock size={9} /> Room chat stays in this room · reactions are live</div>
        </>
      ) : (
        <LyricsPanel
          track={track}
          lyrics={lyrics}
          progress={progress}
          canControl={canControl}
          onSeek={onSeek}
          onLock={onLock}
          onRetry={onRetryLyrics}
        />
      )}
    </aside>
  )
}

function RoomView({
  room,
  track,
  queue,
  currentIndex,
  isPlaying,
  progress,
  duration,
  canControl,
  role,
  syncMs,
  volume,
  muted,
  liked,
  micOn,
  micLevel,
  speaking,
  duckTest,
  onSelectRole,
  onLock,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolume,
  onToggleMute,
  onLike,
  onInvite,
  onSearch,
  onPlayIndex,
  onToggleMic,
  onDuckTest,
  onOpenFull,
}) {
  const [roleOpen, setRoleOpen] = useState(false)
  const roleRef = useRef(null)
  const words = room.name.split(' ')
  const lastWord = words.pop()
  const linePeople = room.members.filter((id) => id !== 'me').slice(0, 4)
  const linePositions = [15, 33, 54, 74]
  const total = duration || track?.duration || 0
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  const ready = track?.status === 'ready' && Boolean(track?.streamUrl)
  const failed = track?.status === 'error'
  const pending = track?.status === 'pending' || track?.status === 'resolving'
  const RoleIcon = ROLE_COPY[role]?.Icon || Headphones

  useEffect(() => {
    if (!roleOpen) return undefined
    const close = (event) => {
      if (roleRef.current && !roleRef.current.contains(event.target)) setRoleOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [roleOpen])

  const seekFromEvent = (event) => {
    if (!canControl) {
      onLock()
      return
    }
    if (!ready) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    onSeek(ratio * (total || 0))
  }

  return (
    <>
      <section className="room-head">
        <div className="eyebrow">
          <span className="live-pill"><span className="live-dot" /> LIVE</span>
          <span className="seg" />
          <span>{room.private ? 'PRIVATE ROOM' : 'OPEN ROOM'}</span>
          <span className="seg" />
          <span>SINCE 2024</span>
        </div>
        <h1 className="room-title">
          {words.join(' ')} {words.length > 0 && ' '}<em>{lastWord}</em>
        </h1>
        <p className="room-sub">{room.description}</p>
        <div className="room-meta">
          <AvatarStack ids={room.members} size="sm" max={4} />
          <span className="meta-listeners"><b>{room.listeners.toLocaleString()}</b> listening now</span>
          <div className="meta-divider" />
          <div ref={roleRef} style={{ position: 'relative' }}>
            <button className="role-chip" onClick={() => setRoleOpen((value) => !value)}>
              <RoleIcon />
              <span>Viewing as <b>{ROLE_COPY[role]?.label}</b></span>
              <ChevronDown size={10} />
            </button>
            {roleOpen && (
              <div className="role-menu">
                <div className="role-menu-label">WHO CAN CONTROL PLAYBACK</div>
                {Object.entries(ROLE_COPY).map(([key, option]) => {
                  const Icon = option.Icon
                  return (
                    <button
                      key={key}
                      className={`role-option ${role === key ? 'selected' : ''}`}
                      onClick={() => {
                        onSelectRole(key)
                        setRoleOpen(false)
                      }}
                    >
                      <Icon />
                      <span>
                        {option.label}
                        <small>{option.note}</small>
                      </span>
                      {role === key && <Check className="check" size={12} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <button className="text-btn" onClick={onInvite}>
            <UserPlus size={12} /> Invite
          </button>
        </div>
      </section>

      <section className={`now-card ${isPlaying ? 'is-playing' : ''}`}>
        <Cover track={track} size="cover-size-hero" showQuality playing={isPlaying} />
        <div className="now-main">
          <div className="now-kicker">
            <span className={isPlaying ? 'live-dot' : ''} style={isPlaying ? { color: room.accent } : undefined} />
            <span>{isPlaying ? 'PLAYING NOW' : 'UP NEXT IN THE ROOM'}</span>
            <ProviderBadge provider={track?.provider} preview={track?.preview} />
            {pending && <span className="source-badge"><span className="spinner" style={{ width: 8, height: 8 }} /> Tuning</span>}
          </div>

          <h2 className="now-title" title={track?.title}>{track?.title || 'Finding a track…'}</h2>
          <p className="now-artist">
            {track?.artist || 'EchoSync'}
            {track?.album && <><span> · </span><span className="album">{track.album}</span></>}
          </p>

          <div className="listening-block">
            <div className="timeline">
              <div
                className={`timeline-track ${canControl ? '' : 'disabled'}`}
                onClick={seekFromEvent}
                role="slider"
                aria-label="Playback position"
                aria-valuemin={0}
                aria-valuemax={Math.round(total)}
                aria-valuenow={Math.round(progress)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (!canControl) return
                  if (event.key === 'ArrowRight') onSeek(Math.min(total, progress + 5))
                  if (event.key === 'ArrowLeft') onSeek(Math.max(0, progress - 5))
                }}
              >
                <div className="timeline-fill" style={{ width: `${pct}%` }} />
                {linePeople.map((id, index) => {
                  const member = MEMBERS[id]
                  return (
                    <span
                      key={id}
                      className={`line-avatar ${index === 3 ? 'ghost' : ''}`}
                      style={{
                        left: `${linePositions[index]}%`,
                        '--av1': member.av1,
                        '--av2': member.av2,
                      }}
                      title={`${member.name} is listening`}
                    />
                  )
                })}
              </div>
              <div className="time-row">
                <b>{formatTime(progress)}</b>
                <span>{canControl ? 'CLICK TO SEEK' : 'SYNCED TO ROOM'}</span>
                <span>{formatTime(total)}</span>
              </div>
            </div>
          </div>

          <div className="now-controls">
            <div className="transport">
              <button className="icon-btn" onClick={onPrev} aria-label="Previous track">
                <SkipBack />
              </button>
              <button className="play-main" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause /> : <Play />}
              </button>
              <button className="icon-btn" onClick={onNext} aria-label="Next track">
                <SkipForward />
              </button>
            </div>
            <span className="sync-chip" title="Estimated drift between listeners">
              <Wifi /> In sync · <b>{syncMs} ms</b>
            </span>
            <div className="volume-box">
              <button className="icon-btn" onClick={onToggleMute} aria-label="Mute">
                {muted || volume === 0 ? <VolumeX /> : volume < 0.5 ? <Volume1 /> : <Volume2 />}
              </button>
              <input
                className="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={muted ? 0 : volume}
                onChange={(event) => onVolume(Number(event.target.value))}
                aria-label="Volume"
              />
            </div>
            <button className="icon-btn" onClick={onOpenFull} aria-label="Open full player">
              <Maximize2 />
            </button>
          </div>

          <div className="now-foot">
            <span>{failed ? 'Source unavailable' : pending ? 'Finding the official source…' : track?.provider === 'itunes' ? 'Official preview · 30 seconds' : ready ? 'Ad-free stream · 320 kbps' : 'Ready in the room'}</span>
            <span className="dot" />
            <span>{room.listeners.toLocaleString()} in the room</span>
            <span className={`dot`} />
            <span>{canControl ? 'You have control' : 'Listen-only mode'}</span>
            <span className="grow" />
            <button className={`like-btn ${liked.includes(track?.id) ? 'liked' : ''}`} onClick={() => onLike(track?.id)} aria-label="Like track">
              <Heart />
            </button>
          </div>

          <VoiceRow
            micOn={micOn}
            micLevel={micLevel}
            speaking={speaking}
            duckTest={duckTest}
            ducked={speaking}
            onToggleMic={onToggleMic}
            onDuckTest={onDuckTest}
          />
        </div>
      </section>

      <div className="section-head">
        <div>
          <h3>The room queue</h3>
          <p>Everyone hears the same <b>1</b> at the same time.</p>
        </div>
        <div className="head-actions">
          <button className="text-btn" onClick={onSearch}><Plus /> Add a song</button>
          <span className="source-badge">{queue.length} tracks</span>
        </div>
      </div>

      <section className="queue">
        {queue.map((item, index) => {
          const active = index === currentIndex
          const itemReady = item?.status === 'ready' && item?.streamUrl
          const itemFailed = item?.status === 'error'
          const itemPending = !itemReady && !itemFailed
          return (
            <div
              key={`${item?.id || 'track'}-${index}`}
              className={`queue-row ${active ? 'active' : ''}`}
              onClick={() => onPlayIndex(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onPlayIndex(index)
                }
              }}
            >
              <span className="queue-index-wrap">
                <span className="queue-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="queue-eq"><i /><i /><i /></span>
              </span>
              <Cover track={item} size="cover-size-sm" playing={active && isPlaying} />
              <div className="queue-copy">
                <strong>{item?.title || 'Untitled track'}</strong>
                <span>
                  {item?.artist || 'EchoSync'}
                  {itemFailed ? ' · Stream unavailable — tap to retry' : itemPending ? ' · Tuning into the room…' : ''}
                </span>
              </div>
              <div className="queue-right">
                <span className="queue-provider">{item?.providerLabel || 'EchoSync'}</span>
                <span className="queue-dur">{itemReady ? formatTime(item.duration) : '—'}</span>
              </div>
              <button
                className={`queue-heart ${liked.includes(item?.id) ? 'liked' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onLike(item?.id)
                }}
                aria-label="Like track"
              >
                <Heart />
              </button>
              <span className="queue-more"><MoreHorizontal /></span>
            </div>
          )
        })}
      </section>

      <p className="room-foot-note">
        <Headphones size={12} />
        <span>Guests stay in sync automatically. Only <b>Admin</b> and <b>DJ</b> can change playback.</span>
      </p>
    </>
  )
}

function PlayerDock({
  track,
  isPlaying,
  progress,
  duration,
  liked,
  syncMs,
  volume,
  muted,
  onTogglePlay,
  onPrev,
  onNext,
  onLike,
  onVolume,
  onToggleMute,
  onOpenFull,
}) {
  const total = duration || track?.duration || 0
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  return (
    <div className="player-dock">
      <div className="dock-progress"><span style={{ width: `${pct}%` }} /></div>
      <div
        className="dock-track"
        role="button"
        tabIndex={0}
        onClick={onOpenFull}
        onKeyDown={(event) => event.key === 'Enter' && onOpenFull()}
      >
        <Cover track={track} size="cover-size-sm" playing={isPlaying} />
        <div className="dock-copy">
          <strong>{track?.title || 'Nothing playing'}</strong>
          <span>
            {track?.artist || 'EchoSync'}
            {track?.providerLabel && <><span style={{ opacity: 0.6 }}>·</span> {track.providerLabel}</>}
          </span>
        </div>
      </div>
      <div className="dock-center">
        <div className="dock-buttons">
          <button className="icon-btn dock-skip" onClick={onPrev} aria-label="Previous track"><SkipBack /></button>
          <button className="dock-play" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause /> : <Play />}
          </button>
          <button className="icon-btn dock-skip" onClick={onNext} aria-label="Next track"><SkipForward /></button>
        </div>
        <div className="dock-time">
          <span>{formatTime(progress)}</span>
          <div className="dock-mini-line"><span style={{ width: `${pct}%` }} /></div>
          <span>{formatTime(total)}</span>
        </div>
      </div>
      <div className="dock-actions">
        <span className="dock-sync"><Wifi /> <b>{syncMs} ms</b></span>
        <button className={`like-btn ${liked.includes(track?.id) ? 'liked' : ''}`} onClick={() => onLike(track?.id)} aria-label="Like track"><Heart /></button>
        <div className="volume-box">
          <button className="icon-btn" onClick={onToggleMute} aria-label="Mute">
            {muted || volume === 0 ? <VolumeX /> : volume < 0.5 ? <Volume1 /> : <Volume2 />}
          </button>
          <input
            className="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={muted ? 0 : volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </div>
        <button className="icon-btn" onClick={onOpenFull} aria-label="Expand player"><Maximize2 /></button>
      </div>
    </div>
  )
}

function MobileNav({ view, chatOpen, onNavigate, onSearch, onChat }) {
  return (
    <nav className="mobile-nav">
      <button className={view === 'room' && !chatOpen ? 'active' : ''} onClick={() => onNavigate('room')}>
        <Home /> Home
      </button>
      <button className={view === 'rooms' && !chatOpen ? 'active' : ''} onClick={() => onNavigate('rooms')}>
        <Radio /> Rooms
      </button>
      <button onClick={onSearch}>
        <Search /> Search
      </button>
      <button className={view === 'library' && !chatOpen ? 'active' : ''} onClick={() => onNavigate('library')}>
        <Library /> Library
      </button>
      <button className={chatOpen ? 'active' : ''} onClick={onChat}>
        <MessageCircle /> Chat
      </button>
    </nav>
  )
}

function SearchOverlay({ onClose, onPlay, onQueue }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const inputRef = useRef(null)
  const latestQuery = useRef('')

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setStatus('idle')
      setResults([])
      return undefined
    }
    latestQuery.current = trimmed
    setStatus('loading')
    const timer = setTimeout(async () => {
      const found = await searchEverything(trimmed)
      if (latestQuery.current !== trimmed) return
      setResults(found)
      setStatus('ready')
    }, 380)
    return () => clearTimeout(timer)
  }, [query])

  const suggestions = ['Kesariya', 'Pasoori', 'The Weeknd', 'AP Dhillon', 'Coke Studio', 'Atif Aslam']

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="search-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-top">
          <Search />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a song, an artist, a mood…"
          />
          <span className="esc-key">ESC</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close search"><X /></button>
        </div>

        <div className="search-results">
          {status === 'idle' && (
            <div className="search-idle">
              <h4>What does tonight sound like?</h4>
              <p>Search across JioSaavn and iTunes. Every result is a real, playable stream.</p>
              <div className="suggestion-chips">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} onClick={() => setQuery(suggestion)}>{suggestion}</button>
                ))}
              </div>
              <div className="search-caption"><span>Room favourites</span><b>try one</b></div>
              <div className="suggestion-chips">
                {SEED_TRACKS.slice(0, 6).map((seed) => (
                  <button key={seed.id} onClick={() => setQuery(seed.title)}>{seed.title}</button>
                ))}
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="search-loading"><span className="spinner" /> Listening to the catalogue…</div>
          )}

          {status === 'ready' && results.length === 0 && (
            <div className="no-results">No streams found for “{query}”. Try another spelling or artist.</div>
          )}

          {status === 'ready' && results.length > 0 && (
            <>
              <div className="search-caption"><span>Top results</span><b>{results.length} streams</b></div>
              {results.map((track) => (
                <div
                  key={track.id}
                  className="search-result"
                  role="button"
                  tabIndex={0}
                  onClick={() => onPlay(track)}
                  onKeyDown={(event) => event.key === 'Enter' && onPlay(track)}
                >
                  <Cover track={track} size="cover-size-sm" />
                  <div className="search-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist} · {track.providerLabel}{track.preview ? ' preview' : ''}</span>
                  </div>
                  <button
                    className="search-play"
                    onClick={(event) => {
                      event.stopPropagation()
                      onPlay(track)
                    }}
                    aria-label="Play now"
                  >
                    <Play />
                  </button>
                  <button
                    className="search-add"
                    onClick={(event) => {
                      event.stopPropagation()
                      onQueue(track)
                    }}
                    aria-label="Add to room queue"
                  >
                    <Plus />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="search-foot">
          <AudioLines />
          <span>JioSaavn 320kbps + official iTunes previews</span>
          <span className="right">Live catalogue</span>
        </div>
      </div>
    </div>
  )
}

function FullPlayer({
  room,
  track,
  queue,
  isPlaying,
  progress,
  duration,
  syncMs,
  volume,
  muted,
  liked,
  lyrics,
  canControl,
  onClose,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onLock,
  onLike,
  onVolume,
  onToggleMute,
  onRetryLyrics,
}) {
  const total = duration || track?.duration || 0
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  return (
    <div className="full-player">
      {track?.cover && <div className="fp-bg" style={{ backgroundImage: `url(${track.cover})` }} />}
      <div className="fp-scrim" />
      <div className="fp-inner">
        <header className="fp-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close full player"><ChevronDown /></button>
          <div className="fp-head-copy">
            <span>Playing in {room.name}</span>
            <strong>{queue.length} tracks in the room queue · synced with {room.listeners} listeners</strong>
          </div>
          <div className="head-spacer" />
        </header>

        <div className="fp-body">
          <div className="fp-left">
            <div className="fp-art-wrap">
              <Cover track={track} size="" showQuality playing={isPlaying} />
            </div>
            <div className="fp-info">
              <div className="fp-kicker">
                <span className="live-dot" style={{ color: room.accent }} />
                <span>{isPlaying ? 'Playing now' : 'Paused in room'}</span>
                <ProviderBadge provider={track?.provider} preview={track?.preview} />
              </div>
              <h2 className="fp-title">{track?.title}</h2>
              <p className="fp-artist">{track?.artist}{track?.album ? ` · ${track.album}` : ''}</p>

              <div className="fp-timeline">
                <div
                  className={`timeline-track ${canControl ? '' : 'disabled'}`}
                  onClick={(event) => {
                    if (!canControl) {
                      onLock()
                      return
                    }
                    const rect = event.currentTarget.getBoundingClientRect()
                    onSeek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * total)
                  }}
                  role="slider"
                  aria-label="Playback position"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(total)}
                  aria-valuenow={Math.round(progress)}
                  tabIndex={0}
                >
                  <div className="timeline-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="time-row">
                  <b>{formatTime(progress)}</b>
                  <span>{canControl ? 'CLICK TO SEEK' : 'SYNCED TO ROOM'}</span>
                  <span>{formatTime(total)}</span>
                </div>
              </div>

              <div className="fp-controls">
                <button className="icon-btn" onClick={onPrev} aria-label="Previous"><SkipBack /></button>
                <button className="fp-play" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <Pause /> : <Play />}
                </button>
                <button className="icon-btn" onClick={onNext} aria-label="Next"><SkipForward /></button>
              </div>

              <div className="fp-bottom-row">
                <button className={`like-btn ${liked.includes(track?.id) ? 'liked' : ''}`} onClick={() => onLike(track?.id)} aria-label="Like track"><Heart /></button>
                <div className="volume-box">
                  <button className="icon-btn" onClick={onToggleMute} aria-label="Mute">
                    {muted || volume === 0 ? <VolumeX /> : volume < 0.5 ? <Volume1 /> : <Volume2 />}
                  </button>
                  <input
                    className="volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={muted ? 0 : volume}
                    onChange={(event) => onVolume(Number(event.target.value))}
                    aria-label="Volume"
                  />
                </div>
                <span className="fp-sync"><Wifi /> <b>{syncMs} ms</b> drift</span>
              </div>
            </div>
          </div>

          <div className="fp-right">
            <div className="social-head">
              <div className="social-head-copy">
                <h3>Live lyrics</h3>
                <p><Sparkles size={10} /> {lyrics?.status === 'ready' && lyrics.type === 'synced' ? 'Following the room, line by line' : 'Time-synced with playback'}</p>
              </div>
              <span className="source-badge">LRCLIB</span>
            </div>
            <LyricsPanel
              track={track}
              lyrics={lyrics}
              progress={progress}
              canControl={canControl}
              onSeek={onSeek}
              onLock={onLock}
              onRetry={onRetryLyrics}
              showTrack={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`toast ${toast.tone || ''}`} key={toast.id}>
      {toast.tone === 'lock' ? <Lock /> : <Check />}
      <span>{toast.message}</span>
    </div>
  )
}

const EMPTY_TRACK = {
  id: 'empty',
  title: 'The room is quiet',
  artist: 'Add a song to begin',
  album: '',
  duration: 0,
  status: 'idle',
  c1: '#26303a',
  c2: '#a65845',
}

function initialMessages() {
  const copy = {}
  Object.entries(SEED_MESSAGES).forEach(([roomId, list]) => {
    copy[roomId] = list.map((message) => ({
      ...message,
      reactions: (message.reactions || []).map((reaction) => ({ ...reaction })),
    }))
  })
  return copy
}

export default function App() {
  const [theme, setTheme] = useState(() => (readStorage(THEME_KEY, 'dark') === 'light' ? 'light' : 'dark'))
  const [view, setView] = useState('room')
  const [activeRoomId, setActiveRoomId] = useState('midnight-radio')
  const [roles, setRoles] = useState(DEFAULT_ROLES)
  const [library, setLibrary] = useState(buildInitialLibrary)
  const [queues, setQueues] = useState(() => Object.fromEntries(ROOMS.map((room) => [room.id, [...room.trackIds]])))
  const [currentByRoom, setCurrentByRoom] = useState({})
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.82)
  const [muted, setMuted] = useState(false)
  const [liked, setLiked] = useState(() => {
    const stored = readStorage(LIKES_KEY, null)
    return Array.isArray(stored) ? stored : ['kesariya', 'pasoori', 'tum-hi-ho']
  })
  const [messages, setMessages] = useState(initialMessages)
  const [typing, setTyping] = useState({})
  const [draft, setDraft] = useState('')
  const [activeTab, setActiveTab] = useState('chat')
  const [chatOpen, setChatOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 1050))
  const [searchOpen, setSearchOpen] = useState(false)
  const [fullPlayer, setFullPlayer] = useState(false)
  const [toast, setToast] = useState(null)
  const [lyrics, setLyrics] = useState({ status: 'idle' })
  const [lyricsRefresh, setLyricsRefresh] = useState(0)
  const [syncMs, setSyncMs] = useState(14)
  const [seekSignal, setSeekSignal] = useState(0)
  const [micOn, setMicOn] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [duckTest, setDuckTest] = useState(false)

  const audioRef = useRef(null)
  const loadedUrlRef = useRef('')
  const pendingSeekRef = useRef(null)
  const channelRef = useRef(null)
  const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const activeRoomRef = useRef(activeRoomId)
  const currentIndexRef = useRef(0)
  const isPlayingRef = useRef(false)
  const toastTimerRef = useRef(null)
  const chatTimersRef = useRef([])
  const micRef = useRef({ stream: null, ctx: null, analyser: null, raf: null, loudAt: 0, quietAt: 0 })
  const duckRef = useRef({ interval: null, timer: null })

  const activeRoom = ROOMS.find((room) => room.id === activeRoomId) || ROOMS[0]
  const role = roles[activeRoomId] || 'listener'
  const canControl = role === 'admin' || role === 'dj'
  const queueIds = queues[activeRoomId] || []
  const queue = queueIds.map((id) => {
    if (library[id]) return library[id]
    if (SEED_BY_ID[id]) return { ...SEED_BY_ID[id], status: 'pending' }
    return null
  }).filter(Boolean)
  const requestedIndex = currentByRoom[activeRoomId] ?? 0
  const currentIndex = queue.length ? Math.min(requestedIndex, queue.length - 1) : 0
  const track = queue[currentIndex] || EMPTY_TRACK
  const roomMessages = messages[activeRoomId] || []
  const typingMemberId = typing[activeRoomId] || null
  const lyricsKey = `${track?.id}`
  const likedSet = liked

  useEffect(() => {
    activeRoomRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    writeStorage(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    writeStorage(LIKES_KEY, liked)
  }, [liked])

  useEffect(() => {
    let cancelled = false
    const pending = SEED_TRACKS.filter((seed) => {
      const status = library[seed.id]?.status
      return status === 'pending' || status === 'resolving'
    })
    let cursor = 0
    const worker = async () => {
      while (!cancelled) {
        const seed = pending[cursor]
        cursor += 1
        if (!seed) return
        setLibrary((previous) => {
          if (previous[seed.id]?.status === 'ready') return previous
          return { ...previous, [seed.id]: { ...previous[seed.id], status: 'resolving' } }
        })
        try {
          const resolved = await resolveSeed(seed)
          if (cancelled) return
          const ready = { ...resolved, c1: seed.c1, c2: seed.c2, status: 'ready' }
          setLibrary((previous) => ({ ...previous, [seed.id]: ready }))
          saveLibraryEntry(seed.id, ready)
        } catch {
          if (cancelled) return
          setLibrary((previous) => ({
            ...previous,
            [seed.id]: { ...previous[seed.id], status: 'error', streamUrl: null },
          }))
        }
      }
    }
    Promise.all([worker(), worker(), worker()])
    return () => {
      cancelled = true
    }
    // The initial catalogue is hydrated once; retries are handled by ensurePlayable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!track?.streamUrl) {
      audio.pause()
      loadedUrlRef.current = ''
      return
    }
    if (loadedUrlRef.current === track.streamUrl) return
    loadedUrlRef.current = track.streamUrl
    audio.src = track.streamUrl
    audio.load()
    setProgress(0)
    setDuration(track.duration || 0)
  }, [track?.streamUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!track?.streamUrl) {
      audio.pause()
      return
    }
    if (isPlaying) {
      const playback = audio.play()
      if (playback?.catch) {
        playback.catch(() => {
          setIsPlaying(false)
          showToast('Press play once to let the room join you in audio.')
        })
      }
    } else {
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, track?.streamUrl])

  useEffect(() => {
    if (!seekSignal) return undefined
    const audio = audioRef.current
    const target = pendingSeekRef.current
    if (!audio || target == null) return undefined
    const apply = () => {
      try {
        audio.currentTime = target
      } catch {
        /* the source may not be seekable yet */
      }
      pendingSeekRef.current = null
    }
    if (audio.readyState >= 1) apply()
    else audio.addEventListener('loadedmetadata', apply, { once: true })
    return () => audio.removeEventListener('loadedmetadata', apply)
  }, [seekSignal, track?.streamUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    const target = muted ? 0 : speaking ? volume * 0.2 : volume
    const start = audio.volume
    const startedAt = performance.now()
    let frame = 0
    const tick = (now) => {
      const ratio = Math.min(1, (now - startedAt) / 260)
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * ratio))
      if (ratio < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [speaking, volume, muted])

  useEffect(() => {
    let cancelled = false
    if (!track?.title || !track?.artist || track.id === 'empty') {
      setLyrics({ status: 'idle' })
      return undefined
    }
    setLyrics({ status: 'loading' })
    fetchLyrics(track)
      .then((data) => {
        if (cancelled) return
        setLyrics(data ? { status: 'ready', ...data } : { status: 'none' })
      })
      .catch(() => {
        if (!cancelled) setLyrics({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricsKey, track?.title, track?.artist, lyricsRefresh])

  useEffect(() => {
    if (!isPlaying) return undefined
    const timer = setInterval(() => {
      setSyncMs((value) => Math.max(4, Math.min(39, value + (Math.random() > 0.55 ? 1 : -1))))
    }, 3600)
    return () => clearInterval(timer)
  }, [isPlaying])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel('echosync-room-sync')
    channelRef.current = channel
    channel.onmessage = (event) => {
      const data = event.data
      if (!data || data.sender === tabIdRef.current) return
      if (data.roomId !== activeRoomRef.current) return

      if (data.type === 'chat' && data.message) {
        setMessages((previous) => {
          const list = previous[data.roomId] || []
          if (list.some((message) => message.id === data.message.id)) return previous
          return { ...previous, [data.roomId]: [...list, data.message] }
        })
        return
      }

      if (data.type === 'state') {
        setSyncMs(Math.max(2, Math.round(Date.now() - data.ts)))
        const indexChanged = typeof data.index === 'number' && data.index !== currentIndexRef.current
        if (indexChanged) {
          setCurrentByRoom((previous) => ({ ...previous, [data.roomId]: data.index }))
        }
        if (typeof data.isPlaying === 'boolean') setIsPlaying(data.isPlaying)
        const elapsed = data.isPlaying ? Math.max(0, Date.now() - data.ts) / 1000 : 0
        const target = (data.time || 0) + elapsed
        const actual = audioRef.current?.currentTime ?? 0
        if (indexChanged || !data.heartbeat || Math.abs(actual - target) > 1.1) {
          pendingSeekRef.current = target
          setSeekSignal((value) => value + 1)
        }
      }
    }
    channel.postMessage({ type: 'hello', roomId: activeRoomRef.current, sender: tabIdRef.current, ts: Date.now() })
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      const channel = channelRef.current
      if (!channel || !isPlayingRef.current) return
      channel.postMessage({
        type: 'state',
        roomId: activeRoomRef.current,
        sender: tabIdRef.current,
        index: currentIndexRef.current,
        isPlaying: true,
        time: audioRef.current?.currentTime || 0,
        ts: Date.now(),
        heartbeat: true,
      })
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        if (searchOpen) setSearchOpen(false)
        else if (fullPlayer) setFullPlayer(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen, fullPlayer])

  useEffect(() => () => {
    clearTimeout(toastTimerRef.current)
    chatTimersRef.current.forEach((timer) => clearTimeout(timer))
    clearInterval(duckRef.current.interval)
    clearTimeout(duckRef.current.timer)
    if (micRef.current.raf) cancelAnimationFrame(micRef.current.raf)
    micRef.current.stream?.getTracks().forEach((streamTrack) => streamTrack.stop())
    if (micRef.current.ctx) micRef.current.ctx.close()
    audioRef.current?.pause()
  }, [])

  function showToast(message, tone = 'info') {
    setToast({ id: Date.now() + Math.random(), message, tone })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3400)
  }

  function lockToast() {
    showToast(LOCK_MESSAGE, 'lock')
  }

  function announce(overrides = {}) {
    channelRef.current?.postMessage({
      type: 'state',
      roomId: activeRoomId,
      sender: tabIdRef.current,
      index: currentIndex,
      isPlaying,
      time: audioRef.current?.currentTime || 0,
      ts: Date.now(),
      ...overrides,
    })
  }

  async function ensurePlayable(candidate) {
    if (!candidate) return null
    if (candidate.status === 'ready' && candidate.streamUrl) return candidate
    const seed = SEED_BY_ID[candidate.id]
    if (!seed) {
      showToast('This stream is not available right now.', 'lock')
      return null
    }
    setLibrary((previous) => ({
      ...previous,
      [seed.id]: { ...previous[seed.id], status: 'resolving' },
    }))
    try {
      const resolved = await resolveSeed(seed)
      const ready = { ...resolved, c1: seed.c1, c2: seed.c2, status: 'ready' }
      setLibrary((previous) => ({ ...previous, [seed.id]: ready }))
      saveLibraryEntry(seed.id, ready)
      return ready
    } catch {
      setLibrary((previous) => ({
        ...previous,
        [seed.id]: { ...previous[seed.id], status: 'error', streamUrl: null },
      }))
      showToast(`Couldn’t find an official stream for “${seed.title}”.`, 'lock')
      return null
    }
  }

  function selectIndex(index) {
    setCurrentByRoom((previous) => ({ ...previous, [activeRoomId]: index }))
    setProgress(0)
    setDuration(library[queueIds[index]]?.duration || 0)
    setIsPlaying(true)
    announce({ index, isPlaying: true, time: 0 })
  }

  async function playIndex(index) {
    if (!canControl) {
      lockToast()
      return
    }
    const candidate = library[queueIds[index]]
    if (!candidate) return
    const playable = await ensurePlayable(candidate)
    if (!playable) return
    selectIndex(index)
  }

  async function togglePlay() {
    if (!canControl) {
      lockToast()
      return
    }
    if (!track?.id || track.id === 'empty') return
    let playable = track
    if (track.status !== 'ready' || !track.streamUrl) {
      playable = await ensurePlayable(track)
      if (!playable) return
      setCurrentByRoom((previous) => ({ ...previous, [activeRoomId]: currentIndex }))
      setProgress(0)
      setIsPlaying(true)
      announce({ index: currentIndex, isPlaying: true, time: 0 })
      return
    }
    const nextState = !isPlaying
    setIsPlaying(nextState)
    announce({ isPlaying: nextState, time: audioRef.current?.currentTime || 0 })
  }

  async function nextTrack() {
    if (!canControl) {
      lockToast()
      return
    }
    if (!queueIds.length) return
    const nextIndex = (currentIndex + 1) % queueIds.length
    const playable = await ensurePlayable(library[queueIds[nextIndex]])
    if (!playable) return
    selectIndex(nextIndex)
  }

  async function previousTrack() {
    if (!canControl) {
      lockToast()
      return
    }
    if (audioRef.current && audioRef.current.currentTime > 4) {
      audioRef.current.currentTime = 0
      setProgress(0)
      announce({ time: 0 })
      return
    }
    if (!queueIds.length) return
    const previousIndex = (currentIndex - 1 + queueIds.length) % queueIds.length
    const playable = await ensurePlayable(library[queueIds[previousIndex]])
    if (!playable) return
    selectIndex(previousIndex)
  }

  function seekTo(seconds) {
    if (!canControl) {
      lockToast()
      return
    }
    const audio = audioRef.current
    if (!audio || track.status !== 'ready') return
    const target = Math.max(0, Math.min(seconds, duration || track.duration || 0))
    try {
      audio.currentTime = target
    } catch {
      return
    }
    setProgress(target)
    announce({ time: target })
  }

  function handleVolume(value) {
    setVolume(value)
    setMuted(value === 0)
  }

  function handleLike(id) {
    if (!id) return
    const exists = liked.includes(id)
    setLiked((previous) => (exists ? previous.filter((item) => item !== id) : [...previous, id]))
    showToast(exists ? 'Removed from your library' : 'Saved to your library')
  }

  function chooseRole(nextRole) {
    setRoles((previous) => ({ ...previous, [activeRoomId]: nextRole }))
    showToast(`Viewing as ${ROLE_COPY[nextRole].label} in ${activeRoom.name}`)
  }

  function joinRoom(room) {
    const changed = room.id !== activeRoomId
    if (changed) {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.currentTime = 0
      setIsPlaying(false)
      setProgress(0)
      setDuration(0)
      setDraft('')
      setActiveRoomId(room.id)
    }
    setView('room')
    if (typeof window !== 'undefined' && window.innerWidth <= 1050) setChatOpen(false)
    showToast(changed ? `Joined ${room.name}` : `You’re already in ${room.name}`)
  }

  async function copyInvite() {
    const url = `${window.location.origin}/?room=${activeRoomId}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Invite link copied — listening is better together')
    } catch {
      showToast('Invite link ready — share it with a friend')
    }
  }

  function broadcastChat(message) {
    channelRef.current?.postMessage({
      type: 'chat',
      roomId: activeRoomId,
      sender: tabIdRef.current,
      message,
    })
  }

  function sendMessage() {
    const text = draft.trim()
    if (!text) return
    const roomId = activeRoomId
    const senderRoom = activeRoom
    const message = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: 'me',
      text: text.slice(0, 500),
      time: clockNow(),
      reactions: [],
      read: false,
    }
    setMessages((previous) => ({ ...previous, [roomId]: [...(previous[roomId] || []), message] }))
    broadcastChat(message)
    setDraft('')

    const others = senderRoom.members.filter((id) => id !== 'me')
    const responderId = others[Math.floor(Math.random() * others.length)] || 'usman'
    const typingTimer = setTimeout(() => {
      setTyping((previous) => ({ ...previous, [roomId]: responderId }))
    }, 850 + Math.random() * 600)
    const replyTimer = setTimeout(() => {
      setTyping((previous) => {
        const next = { ...previous }
        delete next[roomId]
        return next
      })
      const reply = {
        id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        author: responderId,
        text: REPLY_OPTIONS[Math.floor(Math.random() * REPLY_OPTIONS.length)],
        time: clockNow(),
        reactions: [],
      }
      setMessages((previous) => ({
        ...previous,
        [roomId]: (previous[roomId] || [])
          .map((item) => (item.id === message.id ? { ...item, read: true } : item))
          .concat(reply),
      }))
    }, 2800 + Math.random() * 1100)
    chatTimersRef.current.push(typingTimer, replyTimer)
  }

  function reactToMessage(messageId, emoji) {
    const roomId = activeRoomId
    setMessages((previous) => {
      const list = previous[roomId] || []
      return {
        ...previous,
        [roomId]: list.map((message) => {
          if (message.id !== messageId) return message
          const reactions = (message.reactions || []).map((reaction) => ({ ...reaction }))
          const existingIndex = reactions.findIndex((reaction) => reaction.emoji === emoji)
          if (existingIndex >= 0) {
            const existing = reactions[existingIndex]
            if (existing.mine) {
              if (existing.count <= 1) reactions.splice(existingIndex, 1)
              else reactions[existingIndex] = { ...existing, count: existing.count - 1, mine: false }
            } else {
              reactions[existingIndex] = { ...existing, count: existing.count + 1, mine: true }
            }
          } else {
            reactions.push({ emoji, count: 1, mine: true })
          }
          return { ...message, reactions }
        }),
      }
    })
  }

  function addExternalTrack(trackToAdd) {
    setLibrary((previous) => ({ ...previous, [trackToAdd.id]: { ...trackToAdd, status: 'ready' } }))
    setQueues((previous) => {
      const list = previous[activeRoomId] || []
      if (list.includes(trackToAdd.id)) return previous
      return { ...previous, [activeRoomId]: [...list, trackToAdd.id] }
    })
  }

  function queueExternalTrack(trackToAdd) {
    if (!canControl) {
      lockToast()
      return
    }
    addExternalTrack(trackToAdd)
    showToast(`Added “${trackToAdd.title}” to the ${activeRoom.name} queue`)
  }

  function playExternalTrack(trackToAdd) {
    if (!canControl) {
      lockToast()
      return
    }
    addExternalTrack(trackToAdd)
    const existingIndex = queueIds.indexOf(trackToAdd.id)
    const index = existingIndex >= 0 ? existingIndex : queueIds.length
    setCurrentByRoom((previous) => ({ ...previous, [activeRoomId]: index }))
    setProgress(0)
    setDuration(trackToAdd.duration || 0)
    setIsPlaying(true)
    announce({ index, isPlaying: true, time: 0 })
    setSearchOpen(false)
    showToast(`Playing “${trackToAdd.title}” in ${activeRoom.name}`)
  }

  function playLibraryTrack(trackToPlay) {
    if (!canControl) {
      lockToast()
      return
    }
    if (trackToPlay.status !== 'ready') {
      showToast('This track is still tuning. Try again in a moment.')
      return
    }
    const existingIndex = queueIds.indexOf(trackToPlay.id)
    const index = existingIndex >= 0 ? existingIndex : queueIds.length
    if (existingIndex < 0) addExternalTrack(trackToPlay)
    setCurrentByRoom((previous) => ({ ...previous, [activeRoomId]: index }))
    setProgress(0)
    setDuration(trackToPlay.duration || 0)
    setIsPlaying(true)
    announce({ index, isPlaying: true, time: 0 })
    setView('room')
    showToast(`Playing “${trackToPlay.title}” in ${activeRoom.name}`)
  }

  function handleEnded() {
    if (!canControl) {
      setIsPlaying(false)
      return
    }
    if (queueIds.length <= 1) {
      setIsPlaying(false)
      setProgress(0)
      return
    }
    const nextIndex = (currentIndex + 1) % queueIds.length
    const playable = library[queueIds[nextIndex]]
    if (playable?.status === 'ready' && playable.streamUrl) selectIndex(nextIndex)
    else setIsPlaying(false)
  }

  function handleAudioError() {
    if (!loadedUrlRef.current) return
    setIsPlaying(false)
    showToast('That stream didn’t load. Try the next track.', 'lock')
  }

  async function toggleMic() {
    if (micOn) {
      stopMic()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('This browser can’t reach a microphone. Try Duck test instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const context = new AudioCtx()
      await context.resume()
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.72
      const source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      micRef.current.stream = stream
      micRef.current.ctx = context
      micRef.current.analyser = analyser
      micRef.current.loudAt = 0
      micRef.current.quietAt = performance.now()
      const data = new Uint8Array(analyser.fftSize)
      let lastPaint = 0
      let speakingSince = 0
      const loop = () => {
        if (!micRef.current.analyser) return
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let index = 0; index < data.length; index += 1) {
          const offset = (data[index] - 128) / 128
          sum += offset * offset
        }
        const rms = Math.sqrt(sum / data.length)
        const level = Math.min(1, rms * 7)
        const now = performance.now()
        if (now - lastPaint > 90) {
          setMicLevel(level)
          lastPaint = now
        }
        if (level > 0.075) {
          micRef.current.loudAt = now
          if (!speakingSince) speakingSince = now
          if (now - speakingSince > 170) setSpeaking(true)
        } else if (now - micRef.current.loudAt > 520) {
          speakingSince = 0
          setSpeaking(false)
        }
        micRef.current.raf = requestAnimationFrame(loop)
      }
      micRef.current.raf = requestAnimationFrame(loop)
      setMicOn(true)
      showToast('Mic is live — music ducks when you speak')
    } catch {
      showToast('Microphone unavailable. Try the Duck test to preview voice ducking.')
    }
  }

  function stopMic() {
    if (micRef.current.raf) cancelAnimationFrame(micRef.current.raf)
    micRef.current.stream?.getTracks().forEach((streamTrack) => streamTrack.stop())
    micRef.current.ctx?.close()
    micRef.current = { stream: null, ctx: null, analyser: null, raf: null, loudAt: 0, quietAt: 0 }
    setMicOn(false)
    setMicLevel(0)
    if (!duckTest) setSpeaking(false)
  }

  function runDuckTest() {
    if (duckTest) return
    if (micOn) stopMic()
    setDuckTest(true)
    setSpeaking(true)
    setMicLevel(0.65)
    duckRef.current.interval = setInterval(() => {
      setMicLevel(0.35 + Math.random() * 0.6)
    }, 110)
    duckRef.current.timer = setTimeout(() => {
      clearInterval(duckRef.current.interval)
      duckRef.current.interval = null
      setDuckTest(false)
      setSpeaking(false)
      setMicLevel(0)
      showToast('Duck test complete — music back at full volume')
    }, 4000)
    showToast('Duck test: a friend is talking — music dips to 20%')
  }

  const rootStyle = {
    '--accent': activeRoom.accent,
    '--accent-2': activeRoom.accent2,
  }

  return (
    <div className={`app ${theme}`} style={rootStyle}>
      <div className="ambient" />
      <audio
        ref={audioRef}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime || 0)}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget
          if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
          if (pendingSeekRef.current != null) {
            try {
              audio.currentTime = pendingSeekRef.current
            } catch {
              /* ignore unseekable previews */
            }
            pendingSeekRef.current = null
          }
        }}
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      <div className={`shell ${chatOpen ? '' : 'chat-collapsed'}`}>
        <Sidebar
          room={activeRoom}
          view={view}
          role={ROLE_COPY[role]?.label}
          likedCount={liked.length}
          onNavigate={(nextView) => {
            setView(nextView)
            if (typeof window !== 'undefined' && window.innerWidth <= 1050 && nextView !== 'room') setChatOpen(false)
          }}
          onSearch={() => setSearchOpen(true)}
          onJoinRoom={joinRoom}
          onInvite={copyInvite}
          onOpenProfile={() => showToast('Signed in as Haris Mujahid · @haris')}
        />

        <main className="stage">
          <StageBar
            room={activeRoom}
            view={view}
            theme={theme}
            onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            onSearch={() => setSearchOpen(true)}
            onToggleChat={() => setChatOpen((value) => !value)}
            chatOpen={chatOpen}
            onHome={() => setView('room')}
          />

          <div className="stage-scroll">
            {view === 'room' && (
              <RoomView
                room={activeRoom}
                track={track}
                queue={queue}
                currentIndex={currentIndex}
                isPlaying={isPlaying}
                progress={progress}
                duration={duration}
                canControl={canControl}
                role={role}
                syncMs={syncMs}
                volume={volume}
                muted={muted}
                liked={likedSet}
                micOn={micOn}
                micLevel={micLevel}
                speaking={speaking}
                duckTest={duckTest}
                onSelectRole={chooseRole}
                onLock={lockToast}
                onTogglePlay={togglePlay}
                onNext={nextTrack}
                onPrev={previousTrack}
                onSeek={seekTo}
                onVolume={handleVolume}
                onToggleMute={() => setMuted((value) => !value)}
                onLike={handleLike}
                onInvite={copyInvite}
                onSearch={() => setSearchOpen(true)}
                onPlayIndex={playIndex}
                onToggleMic={toggleMic}
                onDuckTest={runDuckTest}
                onOpenFull={() => setFullPlayer(true)}
              />
            )}
            {view === 'rooms' && (
              <RoomsView library={library} currentRoom={activeRoom} onJoin={joinRoom} />
            )}
            {view === 'library' && (
              <LibraryView
                library={library}
                liked={liked}
                onPlay={playLibraryTrack}
                onLike={handleLike}
                onSearch={() => setSearchOpen(true)}
              />
            )}
          </div>

          <PlayerDock
            track={track}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            liked={liked}
            syncMs={syncMs}
            volume={volume}
            muted={muted}
            onTogglePlay={togglePlay}
            onPrev={previousTrack}
            onNext={nextTrack}
            onLike={handleLike}
            onVolume={handleVolume}
            onToggleMute={() => setMuted((value) => !value)}
            onOpenFull={() => setFullPlayer(true)}
          />

          <MobileNav
            view={view}
            chatOpen={chatOpen}
            onNavigate={(nextView) => {
              setView(nextView)
              setChatOpen(false)
            }}
            onSearch={() => setSearchOpen(true)}
            onChat={() => {
              setActiveTab('chat')
              setChatOpen(true)
            }}
          />
        </main>

        <ChatPanel
          room={activeRoom}
          activeTab={activeTab}
          onTab={setActiveTab}
          messages={roomMessages}
          typingMemberId={typingMemberId}
          draft={draft}
          onDraft={setDraft}
          onSend={sendMessage}
          onReact={reactToMessage}
          onClose={() => setChatOpen(false)}
          track={track}
          lyrics={lyrics}
          progress={progress}
          canControl={canControl}
          onSeek={seekTo}
          onLock={lockToast}
          onRetryLyrics={() => setLyricsRefresh((value) => value + 1)}
          open={chatOpen}
        />
        {chatOpen && <div className="chat-scrim" onClick={() => setChatOpen(false)} />}
      </div>

      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onPlay={playExternalTrack}
          onQueue={queueExternalTrack}
        />
      )}

      {fullPlayer && (
        <FullPlayer
          room={activeRoom}
          track={track}
          queue={queue}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          syncMs={syncMs}
          volume={volume}
          muted={muted}
          liked={liked}
          lyrics={lyrics}
          canControl={canControl}
          onClose={() => setFullPlayer(false)}
          onTogglePlay={togglePlay}
          onPrev={previousTrack}
          onNext={nextTrack}
          onSeek={seekTo}
          onLock={lockToast}
          onLike={handleLike}
          onVolume={handleVolume}
          onToggleMute={() => setMuted((value) => !value)}
          onRetryLyrics={() => setLyricsRefresh((value) => value + 1)}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
