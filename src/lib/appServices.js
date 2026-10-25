import { isCloudVoiceUrl, isSupabaseConfigured } from './supabaseClient.js'
import { createStorageAdapter } from '../core/storageAdapter.js'
import { initials, normalizeArtworkUrl, resolveTrackArtwork } from './media'
import { ARTIST_LANGUAGE, normalizeTasteProfile } from '../core/tasteEngine.js'
import { getActiveStreamQuality } from '../services/networkMonitor'
import { detectLyricsLanguage, hasDevanagari, transliterateDevanagari, parseLrc } from '../core/lrcParser.js'

const DEV_API = import.meta.env.DEV

const SAAVN_BASES = ['/api/saavn']

let saavnBackoffUntil = 0

const ITUNES_BASE = 'https://itunes.apple.com/search'

const LRCLIB_BASE = 'https://lrclib.net/api'

const LIBRARY_CACHE_KEY = 'echosync.library.v1'

const LYRIC_CACHE_KEY = 'echosync.lyrics.v1'

const LIKES_KEY = 'echosync.likes.v1'

const THEME_KEY = 'echosync.theme.v1'

const USERS_KEY = 'echosync_users_db'

const ACTIVE_USER_ID_KEY = isSupabaseConfigured() ? 'echosync_active_user_id_cloud' : 'echosync_active_user_id'

const REMEMBER_USER_KEY = isSupabaseConfigured() ? 'echosync_remember_user_id_cloud' : 'echosync_remember_user_id'

const ROOMS_KEY = isSupabaseConfigured() ? 'echosync_rooms_v3_cloud' : 'echosync_rooms_v3'

const ROOM_STATE_KEY = isSupabaseConfigured() ? 'echosync_room_state_v3_cloud' : 'echosync_room_state_v3'

const MESSAGES_KEY = isSupabaseConfigured() ? 'echosync_messages_v3_cloud' : 'echosync_messages_v3'

const PLAYLISTS_KEY = 'echosync_playlists_v1'

const RECENT_KEY = 'echosync_recent_v1'

const SETTINGS_KEY = 'echosync_settings_v1'

const TASTE_PROFILE_KEY = 'echosync_taste_profile_v1'

const TRANSLATE_KEY = 'echosync_translate.v1'

const STREAM_CACHE_KEY = 'echosync_stream_cache_v4'

const TRANSLATION_CACHE_KEY = 'echosync_lyrics_trans_cache'

const INVITES_KEY = isSupabaseConfigured() ? 'echosync_invites_v1_cloud' : 'echosync_invites_v1'

const PUBLIC_LOUNGE_KEY = isSupabaseConfigured() ? 'echosync_public_lounge_v1_cloud' : 'echosync_public_lounge_v1'

const LOUNGE_MESSAGE_LIMIT = 120

const LOUNGE_TYPING_MS = 2400

const DAILY_FEED_PREFIX = 'echosync_daily_feed_v3_'

const DAILY_FEED_LEGACY_PREFIX = 'echosync_daily_feed_'

let pendingStorageFailure = false

let storageFailureQueued = false

const { read: readStorage, write: writeStorage } = createStorageAdapter({
  getStorage: () => localStorage,
  onWriteFailure: notifyStorageFailure,
})

const LOCK_MESSAGE = 'Listener Mode: Only Room Admin or DJ can control playback'

const SOLO_ROOM_ID = 'solo'

const DAILY_QUERIES = [
  'Atif Aslam songs',
  'Arijit Singh songs',
  'Coke Studio songs',
  'Pritam songs',
  'The Weeknd songs',
  'Diljit Dosanjh songs',
  'Nusrat Fateh Ali Khan songs',
  'AR Rahman songs',
]

const DEFAULT_SETTINGS = {
  quality: 'high',
  crossfade: false,
  crossfadeSeconds: 4,
  normalization: false,
  duckLevel: 20,
  gapless: true,
  showActivity: true,
  allowInvites: true,
  autoTranslate: false,
  repeatMode: 'off',
  shuffleEnabled: false,
}

const STREAM_CACHE_TTL = 1000 * 60 * 30

const YOUTUBE_CACHE_TTL = 1000 * 60 * 15

const LIBRARY_STREAM_TTL = 1000 * 60 * 45

const MAX_SESSION_IDS = 300

const MAX_PALETTE_ENTRIES = 150

const RESUME_RELOAD_TIMEOUT = 1500

const RESUME_ADVANCE_TIMEOUT = 1800

const BUFFER_RECOVERY_TIMEOUT = 1800

function rememberBoundedId(set, id, limit = MAX_SESSION_IDS) {
  if (!set || !id) return false
  if (set.has(id)) return false
  set.add(id)
  while (set.size > limit) {
    const oldest = set.values().next().value
    if (oldest === undefined) break
    set.delete(oldest)
  }
  return true
}

function trimBoundedSet(set, limit = MAX_SESSION_IDS) {
  if (!set) return
  while (set.size > limit) {
    const oldest = set.values().next().value
    if (oldest === undefined) break
    set.delete(oldest)
  }
}

function seededShuffle(items, seed = 0) {
  const result = [...items]
  let state = (Number(seed) || 0) ^ 0x9e3779b9
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 1 | state)
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    const random = ((state ^ (state >>> 14)) >>> 0) / 4294967296
    const swap = Math.floor(random * (index + 1))
    const value = result[index]
    result[index] = result[swap]
    result[swap] = value
  }
  return result
}

const PIPED_INSTANCES = DEV_API
  ? ['/api/piped/coffee', '/api/piped/ducks']
  : ['https://api.piped.private.coffee', 'https://pipedapi.ducks.party']

const INVIDIOUS_INSTANCES = DEV_API
  ? ['/api/invidious/f5']
  : ['https://invidious.f5.si']

function mediaProxyUrl(url) {
  if (!url || url.startsWith('/api/')) return url
  return `/api/media?url=${encodeURIComponent(url)}`
}

const AVATAR_PRESETS = [
  { id: 'rose', av1: '#eda272', av2: '#a14e58' },
  { id: 'ocean', av1: '#6b9ae7', av2: '#343e87' },
  { id: 'orchid', av1: '#db7ea5', av2: '#763e76' },
  { id: 'jade', av1: '#60b9a7', av2: '#296d70' },
  { id: 'amber', av1: '#d9aa59', av2: '#8d5c34' },
  { id: 'violet', av1: '#9187dc', av2: '#514093' },
  { id: 'ember', av1: '#e2806a', av2: '#7d3040' },
  { id: 'mint', av1: '#7fd0a4', av2: '#2f6b57' },
]

const ROOM_GRADIENTS = [
  { id: 'midnight', c1: '#251c27', c2: '#94484e', accent: '#f16b73', accent2: '#f2b38e' },
  { id: 'sufi', c1: '#332916', c2: '#9c7433', accent: '#d8a64c', accent2: '#efcf93' },
  { id: 'punjabi', c1: '#172b24', c2: '#2d7d5e', accent: '#43c692', accent2: '#a7e2b9' },
  { id: 'studio', c1: '#162430', c2: '#2e6582', accent: '#5bbde7', accent2: '#a9d8ee' },
  { id: 'dusk', c1: '#2b1f33', c2: '#6f4b8f', accent: '#b98ce0', accent2: '#dcc2f0' },
  { id: 'sunset', c1: '#33201b', c2: '#b25f3e', accent: '#ef8f5b', accent2: '#f4c191' },
]

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function slugifyHandle(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 24)
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `ES-${code}`
}

function normalizeRoomCode(value = '') {
  const compact = String(value).trim().toUpperCase().replace(/\s+/g, '')
  if (!compact) return ''
  if (/^[A-Z0-9]{4}$/.test(compact)) return `ES-${compact}`
  return compact
}

function handleFromEmail(email = '') {
  return slugifyHandle(String(email).split('@')[0])
}

function displayNameFromHandle(handle = '') {
  const name = String(handle)
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
  return name || 'New Listener'
}

function readActiveUserId() {
  try {
    return sessionStorage.getItem(ACTIVE_USER_ID_KEY) || localStorage.getItem(REMEMBER_USER_KEY) || null
  } catch {
    return null
  }
}

function writeActiveSession(id, remember = false) {
  try {
    sessionStorage.setItem(ACTIVE_USER_ID_KEY, id)
    if (remember) localStorage.setItem(REMEMBER_USER_KEY, id)
    else localStorage.removeItem(REMEMBER_USER_KEY)
  } catch {
    /* session storage can be unavailable */
  }
}

function clearActiveSession() {
  try {
    sessionStorage.removeItem(ACTIVE_USER_ID_KEY)
    localStorage.removeItem(REMEMBER_USER_KEY)
  } catch {
    /* ignore */
  }
}

function loadUsers() {
  const stored = readStorage(USERS_KEY, null)
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
}

function loadStoredRooms() {
  const stored = readStorage(ROOMS_KEY, [])
  return Array.isArray(stored) ? stored : []
}

function loadStoredMessages() {
  const stored = readStorage(MESSAGES_KEY, null)
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
}

function readUserValue(key, userId, fallback) {
  if (!userId) return fallback
  const stored = readStorage(key, null)
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return fallback
  return Object.prototype.hasOwnProperty.call(stored, userId) ? stored[userId] : fallback
}

function writeUserValue(key, userId, value) {
  if (!userId) return
  const stored = readStorage(key, null)
  const map = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  map[userId] = value
  return writeStorage(key, map)
}

function loadInvites() {
  const stored = readStorage(INVITES_KEY, [])
  if (!Array.isArray(stored)) return []
  const cutoff = Date.now() - 1000 * 60 * 60 * 48
  return stored.filter((invite) => invite?.id && invite.roomId && invite.toUserId && (invite.createdAt || 0) > cutoff)
}

function normalizeLoungeMessage(raw) {
  if (!raw?.id || !raw?.author) return null
  const isVoice = raw.type === 'voice'
  const text = safeText(raw.text).slice(0, 1000)
  const voiceData = typeof raw.voiceData === 'string' && (raw.voiceData.startsWith('data:audio/') || isCloudVoiceUrl(raw.voiceData))
    ? raw.voiceData
    : ''
  if (!isVoice && !text) return null
  if (isVoice && !voiceData) return null
  const replyTo = raw.replyTo?.id
    ? {
        id: safeText(raw.replyTo.id),
        name: safeText(raw.replyTo.name, 'Listener'),
        handle: safeText(raw.replyTo.handle, 'listener'),
        text: safeText(raw.replyTo.text, 'Message').slice(0, 180),
      }
    : null
  const reactions = Array.isArray(raw.reactions)
    ? raw.reactions
        .map((reaction) => {
          const emoji = safeText(reaction?.emoji)
          if (!emoji) return null
          const userIds = Array.isArray(reaction?.userIds)
            ? [...new Set(reaction.userIds.map((id) => safeText(id)).filter(Boolean))]
            : []
          const count = Math.max(Number(reaction?.count) || 0, userIds.length)
          return count > 0 ? { emoji, count, userIds } : null
        })
        .filter(Boolean)
    : []
  return {
    id: safeText(raw.id),
    author: safeText(raw.author),
    userName: safeText(raw.userName, 'Listener').slice(0, 80),
    authorHandle: safeText(raw.authorHandle, 'listener').slice(0, 32),
    type: isVoice ? 'voice' : raw.type === 'song' && raw.track?.id ? 'song' : 'text',
    ...(raw.type === 'song' && raw.track?.id ? { track: sanitizeTrack(raw.track) } : {}),
    text: isVoice ? '' : text,
    voiceData,
    duration: Math.max(1, Math.min(45, Number(raw.duration) || 1)),
    waveform: Array.isArray(raw.waveform)
      ? raw.waveform.slice(0, 40).map((value) => Math.min(1, Math.max(0.12, Number(value) || 0.2)))
      : [],
    time: safeText(raw.time, clockNow()),
    createdAt: Number(raw.createdAt) || Date.now(),
    replyTo,
    reactions,
    read: raw.read !== false,
  }
}

function loadLoungeMessages() {
  const stored = readStorage(PUBLIC_LOUNGE_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map(normalizeLoungeMessage)
    .filter(Boolean)
    .slice(-LOUNGE_MESSAGE_LIMIT)
}

function normalizeRoom(room) {
  if (!room?.id) return null
  const members = Array.isArray(room.members)
    ? [...new Set(room.members.filter(Boolean))]
    : (room.dj ? [room.dj] : [])
  const roles = { ...(room.roles || {}) }
  members.forEach((id) => {
    if (!roles[id]) roles[id] = id === room.dj ? 'admin' : 'listener'
  })
  if (!Object.values(roles).includes('admin') && members[0]) roles[members[0]] = 'admin'
  const trackIds = Array.isArray(room.trackIds) ? room.trackIds.map((id) => safeText(id)).filter(Boolean) : []
  const next = {
    ...room,
    name: safeText(room.name, 'Listening room'),
    tagline: safeText(room.tagline, 'A room built for the moment.'),
    members,
    roles,
    requests: Array.isArray(room.requests) ? room.requests.filter((request) => request?.id && request?.userId) : [],
    trackIds: [...new Set(trackIds)],
    code: normalizeRoomCode(room.code) || roomCode(),
    leader: members.find((id) => roles[id] === 'admin') || members[0] || null,
    listeners: undefined,
  }
  return next
}

function loadRoomStateSnapshot() {
  return readStorage(ROOM_STATE_KEY, {})
}

function purgeLegacySeedData() {
  try {
    ;['echosync_accounts', 'echosync_active_user', 'echosync_rooms.v1', 'echosync_room_state.v1', 'echosync.translation_cache.v1']
      .forEach((key) => localStorage.removeItem(key))
    sessionStorage.removeItem('echosync_active_user')
  } catch {
    /* storage can be unavailable */
  }
}

purgeLegacySeedData()

const streamCache = (() => {
  const stored = readStorage(STREAM_CACHE_KEY, null)
  if (stored && typeof stored === 'object') {
    return { searches: stored.searches || {}, streams: stored.streams || {} }
  }
  return { searches: {}, streams: {} }
})()

function persistStreamCache() {
  const searches = Object.entries(streamCache.searches)
    .sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0))
    .slice(0, 140)
  const streams = Object.entries(streamCache.streams)
    .sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0))
    .slice(0, 260)
  streamCache.searches = Object.fromEntries(searches)
  streamCache.streams = Object.fromEntries(streams)
  writeStorage(STREAM_CACHE_KEY, streamCache)
}

function purgePreviewCaches() {
  let changed = false
  Object.entries(streamCache.searches).forEach(([key, entry]) => {
    if (!Array.isArray(entry?.tracks)) return
    const cleaned = entry.tracks.filter((track) => !isPreviewTrack(track))
    if (cleaned.length !== entry.tracks.length) {
      streamCache.searches[key] = { ...entry, tracks: cleaned }
      changed = true
    }
  })
  Object.entries(streamCache.streams).forEach(([key, entry]) => {
    if (isPreviewTrack(entry?.track)) {
      delete streamCache.streams[key]
      changed = true
    }
  })
  if (changed) persistStreamCache()
  const library = readStorage(LIBRARY_CACHE_KEY, null)
  if (library && typeof library === 'object' && !Array.isArray(library)) {
    let libraryChanged = false
    Object.entries(library).forEach(([key, entry]) => {
      if (isPreviewTrack(entry?.track)) {
        delete library[key]
        libraryChanged = true
      }
    })
    if (libraryChanged) writeStorage(LIBRARY_CACHE_KEY, library)
  }
}

purgePreviewCaches()

function cachedSearchEntry(provider, query, limit) {
  const key = `${provider}:${limit}:${normalize(query)}`
  const entry = streamCache.searches[key]
  if (!entry || !Array.isArray(entry.tracks) || Date.now() - entry.ts > 1000 * 60 * 60 * 6) return null
  const tracks = entry.tracks
    .filter((track) => !isPreviewTrack(track))
    .map(sanitizeTrack)
  return tracks.length ? tracks : null
}

function cacheSearchEntry(provider, query, limit, tracks) {
  const clean = (tracks || [])
    .filter((track) => !isPreviewTrack(track))
    .map(sanitizeTrack)
  if (!clean.length) return
  streamCache.searches[`${provider}:${limit}:${normalize(query)}`] = { ts: Date.now(), tracks: clean }
  persistStreamCache()
}

function cachedResolvedStream(seedId) {
  const entry = streamCache.streams[seedId]
  const isYouTube = String(seedId).startsWith('yt:') || entry?.track?.provider === 'youtube'
  const maxAge = isYouTube ? YOUTUBE_CACHE_TTL : STREAM_CACHE_TTL
  if (!entry?.track || isPreviewTrack(entry.track) || Date.now() - entry.ts > maxAge) return null
  return sanitizeTrack(entry.track)
}

function cacheResolvedStream(seedId, track) {
  if (!seedId || !track || isPreviewTrack(track)) return
  streamCache.streams[seedId] = { ts: Date.now(), track: sanitizeTrack(track) }
  persistStreamCache()
}

function clearResolvedStream(seedId) {
  delete streamCache.streams[seedId]
  resolutionPromises.delete(seedId)
  persistStreamCache()
}

function clearPlaybackCaches() {
  streamCache.searches = {}
  streamCache.streams = {}
  saavnBackoffUntil = 0
  resolutionPromises.clear()
  try {
    localStorage.removeItem(STREAM_CACHE_KEY)
    localStorage.removeItem(TRANSLATION_CACHE_KEY)
    localStorage.removeItem(LYRIC_CACHE_KEY)
    localStorage.removeItem(LIBRARY_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

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
  { id: 'chaleya', title: 'Chaleya', artist: 'Arijit Singh', album: 'Jawan', duration: 200, c1: '#3a2330', c2: '#c96a5a', cover: 'https://c.saavncdn.com/047/Jawan-Hindi-2023-20230921190854-500x500.jpg' },
  { id: 'tere-hawaale', title: 'Tere Hawaale', artist: 'Arijit Singh', album: 'Laal Singh Chaddha', duration: 346, c1: '#2a2a24', c2: '#b88a4e', cover: 'https://c.saavncdn.com/576/Laal-Singh-Chaddha-Hindi-2022-20220805121002-500x500.jpg' },
  { id: 'kun-faya-kun', title: 'Kun Faya Kun', searchTitle: 'Kun Faaya Kun', artist: 'A.R. Rahman', album: 'Rockstar', duration: 473, c1: '#2a2519', c2: '#a07b3e', cover: 'https://c.saavncdn.com/408/Rockstar-Hindi-2011-20221212023139-500x500.jpg' },
  { id: 'afreen-afreen', title: 'Afreen Afreen', artist: 'Rahat Fateh Ali Khan', album: 'Coke Studio Season 9', duration: 400, c1: '#2f2a1d', c2: '#b28e4a', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music71/v4/95/ff/b0/95ffb0d1-ba72-767e-a4e4-6e7989524b03/190394811402.jpg/600x600bb.jpg' },
  { id: 'raataan-lambiyan', title: 'Raataan Lambiyan', artist: 'Jubin Nautiyal', album: 'Shershaah', duration: 230, c1: '#232b35', c2: '#a06a6a', cover: 'https://c.saavncdn.com/238/Shershaah-Original-Motion-Picture-Soundtrack--Hindi-2021-20210815181610-500x500.jpg' },
  { id: 'kabira', title: 'Kabira', artist: 'Tochi Raina', album: 'Yeh Jawaani Hai Deewani', duration: 224, c1: '#2d2a20', c2: '#a88654', cover: 'https://c.saavncdn.com/440/Yeh-Jawaani-Hai-Deewani-2013-500x500.jpg' },
]

const SEED_BY_ID = Object.fromEntries(SEED_TRACKS.map((track) => [track.id, track]))

function accountDisplay(account) {
  if (!account) return { id: 'guest', name: 'Guest Listener', handle: 'guest', initials: 'GL', av1: '#7d8794', av2: '#3d4650', online: false }
  return {
    ...account,
    initials: account.initials || initials(account.name || account.handle || 'Echo'),
  }
}

function rolesForRoom(room) {
  const matrix = {}
  room.members.forEach((id) => {
    matrix[id] = id === room.dj ? 'admin' : 'listener'
  })
  return matrix
}

function randomAvatarPreset(seed = '') {
  const value = seed || uid('av')
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) % 9973
  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length]
}

const HARD_BAD_MATCH = /\b(karaoke|instrumental|8-bit|8bit|ringtone|tribute|made famous|in the style of|originally performed|workout)\b/i

const SOFT_BAD_MATCH = /\b(remix|slowed|reverb|8d|8-d|lofi|lo-fi|nightcore|sped up|sped-up|mashup|dj mix|flip|dance mix)\b/i

function clockNow() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

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

function safeMediaUrl(value) {
  const text = safeText(value)
  if (!/^(https?:\/\/|blob:|\/api\/media\?)/i.test(text)) return null
  return text.replace(/^http:\/\//i, 'https://')
}

const PALETTE_CACHE = new Map()

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function parseHexColor(value) {
  const text = String(value || '').trim().replace(/^#/, '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(text)) return null
  const expanded = text.length === 3 ? text.split('').map((part) => `${part}${part}`).join('') : text
  const number = Number.parseInt(expanded, 16)
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 }
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6
    else if (max === green) hue = (blue - red) / delta + 2
    else hue = (red - green) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  const lightness = (max + min) / 2
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0
  return { h: hue, s: saturation, l: lightness }
}

function hslToRgb(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360
  const s = clamp(saturation, 0, 1)
  const l = clamp(lightness, 0, 1)
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const segment = h / 60
  const second = chroma * (1 - Math.abs((segment % 2) - 1))
  let rgb = [0, 0, 0]
  if (segment < 1) rgb = [chroma, second, 0]
  else if (segment < 2) rgb = [second, chroma, 0]
  else if (segment < 3) rgb = [0, chroma, second]
  else if (segment < 4) rgb = [0, second, chroma]
  else if (segment < 5) rgb = [second, 0, chroma]
  else rgb = [chroma, 0, second]
  const match = l - chroma / 2
  return {
    r: Math.round((rgb[0] + match) * 255),
    g: Math.round((rgb[1] + match) * 255),
    b: Math.round((rgb[2] + match) * 255),
  }
}

function cssColor({ r, g, b }, alpha = 1) {
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function hashHue(value, offset = 0) {
  let hash = 0
  const text = String(value || 'EchoSync')
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 31) + text.charCodeAt(index)) % 360
  return (hash + offset) % 360
}

function paletteFromHue(hue, saturation = 0.68, lightness = 0.58, fallback = null) {
  const primary = hslToRgb(hue, saturation, lightness)
  const secondary = hslToRgb(hue + 28, Math.max(0.45, saturation - 0.12), Math.min(0.72, lightness + 0.08))
  return {
    accent: cssColor(primary),
    accent2: fallback?.accent2 || cssColor(secondary),
    glow: cssColor(primary, 0.34),
    surface: cssColor(primary, 0.12),
    hue,
    saturation,
    lightness,
  }
}

function paletteFromTrack(track) {
  if (!track || track.id === 'empty') return null
  const colorA = parseHexColor(track.c2)
  const colorB = parseHexColor(track.c1)
  const chosen = colorA || colorB
  if (!chosen) return paletteFromHue(hashHue(`${track.artist || ''} ${track.title || ''}`))
  const hsl = rgbToHsl(chosen)
  const hue = hsl.s < 0.16 ? hashHue(`${track.artist || ''} ${track.title || ''}`) : hsl.h
  const secondary = colorB && colorB !== chosen ? rgbToHsl(colorB) : null
  const base = paletteFromHue(
    hue,
    clamp(Math.max(hsl.s, 0.56), 0.5, 0.84),
    clamp(hsl.l, 0.5, 0.64),
  )
  if (secondary) {
    const secondaryHue = secondary.s < 0.12 ? hue + 32 : secondary.h
    base.accent2 = cssColor(hslToRgb(secondaryHue, clamp(Math.max(secondary.s, 0.42), 0.4, 0.72), clamp(secondary.l, 0.55, 0.74)))
  }
  return base
}

function artworkImageSource(cover) {
  const normalized = normalizeArtworkUrl(cover)
  if (!normalized) return null
  if (normalized.startsWith('data:') || normalized.startsWith('blob:') || normalized.startsWith('/')) return normalized
  return `/api/media?url=${encodeURIComponent(normalized)}`
}

function loadArtworkCanvasSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Artwork could not be read'))
    image.src = source
  })
}

function paletteFromArtworkPixels(data) {
  const buckets = new Map()
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha < 150) continue
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const hsl = rgbToHsl({ r: red, g: green, b: blue })
    if (hsl.l < 0.08 || hsl.l > 0.94 || hsl.s < 0.12) continue
    const key = `${Math.round(red / 24)}:${Math.round(green / 24)}:${Math.round(blue / 24)}`
    const weight = 1 + (hsl.s * 2.2) + (1 - Math.abs(hsl.l - 0.55))
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0, weight: 0, hue: hsl.h, saturation: hsl.s, lightness: hsl.l }
    bucket.r += red
    bucket.g += green
    bucket.b += blue
    bucket.count += 1
    bucket.weight += weight
    bucket.hue = hsl.h
    bucket.saturation = (bucket.saturation + hsl.s) / 2
    bucket.lightness = (bucket.lightness + hsl.l) / 2
    buckets.set(key, bucket)
  }
  const ranked = [...buckets.values()].sort((a, b) => (b.weight * Math.sqrt(b.count)) - (a.weight * Math.sqrt(a.count)))
  if (!ranked.length) return null
  const primary = ranked[0]
  const hue = primary.saturation < 0.18 ? hashHue(`${primary.r}${primary.g}${primary.b}`) : primary.hue
  const saturation = clamp(Math.max(primary.saturation, 0.58), 0.52, 0.86)
  const lightness = clamp(primary.lightness, 0.48, 0.62)
  const accent = hslToRgb(hue, saturation, lightness)
  const partner = ranked.find((bucket) => {
    const delta = Math.abs(bucket.hue - hue)
    return bucket.count >= 3 && (delta > 36 && delta < 324) && bucket.saturation > 0.24
  })
  const accent2 = partner
    ? hslToRgb(partner.hue, clamp(partner.saturation, 0.42, 0.76), clamp(partner.lightness, 0.52, 0.72))
    : hslToRgb(hue + 28, Math.max(0.45, saturation - 0.12), Math.min(0.72, lightness + 0.08))
  return {
    accent: cssColor(accent),
    accent2: cssColor(accent2),
    accentRgb: `${accent.r}, ${accent.g}, ${accent.b}`,
    glow: cssColor(accent, 0.34),
    surface: cssColor(accent, 0.13),
  }
}

async function extractArtworkPalette(cover) {
  const source = artworkImageSource(cover)
  if (!source) return null
  if (PALETTE_CACHE.has(source)) {
    const cached = PALETTE_CACHE.get(source)
    PALETTE_CACHE.delete(source)
    PALETTE_CACHE.set(source, cached)
    return cached
  }
  const task = (async () => {
    const image = await loadArtworkCanvasSource(source)
    const canvas = document.createElement('canvas')
    canvas.width = 36
    canvas.height = 36
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    return paletteFromArtworkPixels(pixels)
  })()
  PALETTE_CACHE.set(source, task)
  while (PALETTE_CACHE.size > MAX_PALETTE_ENTRIES) {
    PALETTE_CACHE.delete(PALETTE_CACHE.keys().next().value)
  }
  try {
    return await task
  } catch {
    PALETTE_CACHE.delete(source)
    return null
  }
}

function withTimeout(promise, ms, message = 'Request timed out') {
  let timer
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(message)
        error.timeout = true
        reject(error)
      }, ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

function likedTrackId(value) {
  if (typeof value === 'string') return safeText(value)
  if (value && typeof value === 'object') return safeText(value.id || value.trackId)
  return ''
}

function likedIdsFrom(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(likedTrackId).filter(Boolean))]
}

function mergeLikedTracks(library, value) {
  const next = { ...(library || {}) }
  const ids = []
  ;(Array.isArray(value) ? value : []).forEach((entry) => {
    const id = likedTrackId(entry)
    if (!id) return
    ids.push(id)
    if (!entry || typeof entry !== 'object') return
    const incoming = sanitizeTrack({ ...entry, id })
    const existing = next[id]
    const merged = sanitizeTrack({
      ...incoming,
      ...existing,
      id,
      title: existing?.title && existing.title !== 'Unknown track' ? existing.title : incoming.title,
      artist: existing?.artist && existing.artist !== 'Unknown artist' ? existing.artist : incoming.artist,
      cover: existing?.cover || incoming.cover,
      streamUrl: existing?.streamUrl || incoming.streamUrl,
      youtubeVideoId: existing?.youtubeVideoId || incoming.youtubeVideoId,
    })
    if (merged.streamUrl || merged.youtubeVideoId) merged.status = 'ready'
    else if (!merged.status || merged.status === 'ready') merged.status = 'pending'
    next[id] = merged
  })
  return { library: next, ids: [...new Set(ids)] }
}

function sanitizeTrack(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const title = safeText(source.title || source.name, 'Unknown track')
  const artist = safeText(source.artist || source.primaryArtists, 'Unknown artist')
  const id = safeText(source.id || source.providerId) || `track-${normalize(`${title}-${artist}`).replace(/\s+/g, '-').slice(0, 48) || uid('track')}`
  const duration = Number(source.duration ?? source.fullDuration)
  const fullDuration = Number(source.fullDuration)
  return {
    ...source,
    id,
    providerId: safeText(source.providerId) || undefined,
    provider: safeText(source.provider, 'library'),
    providerLabel: safeText(source.providerLabel, 'EchoSync'),
    title,
    artist,
    album: safeText(source.album, 'Single'),
    duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
    fullDuration: Number.isFinite(fullDuration) ? Math.max(0, fullDuration) : undefined,
    streamUrl: safeMediaUrl(source.streamUrl),
    cover: normalizeArtworkUrl(source.cover) || resolveTrackArtwork(source),
    youtubeVideoId: safeText(source.youtubeVideoId) || undefined,
    quality: safeText(source.quality),
    c1: safeText(source.c1, '#26303a'),
    c2: safeText(source.c2, '#a65845'),
    preview: source.preview === true,
    needsHydration: Boolean(source.needsHydration),
    searchTitle: safeText(source.searchTitle) || undefined,
    status: safeText(source.status, source.streamUrl ? 'ready' : 'pending'),
  }
}

function sanitizePlaylist(raw) {
  if (!raw || typeof raw !== 'object') return null
  const trackIds = Array.isArray(raw.trackIds) ? raw.trackIds.map((id) => safeText(id)).filter(Boolean) : []
  return {
    ...raw,
    id: safeText(raw.id) || uid('playlist'),
    name: safeText(raw.name, 'Untitled playlist'),
    description: safeText(raw.description),
    trackIds: [...new Set(trackIds)],
    createdAt: Number(raw.createdAt) || Date.now(),
  }
}

function isPreviewTrack(track) {
  if (!track) return false
  if (track.preview === true) return true
  if (track.fullDuration === 30 || track.quality === '30s') return true
  const stream = String(track.streamUrl || '')
  return /\/(?:preview|30sec|30s)[/.]/i.test(stream) || /\.m4a\?.*preview/i.test(stream)
}

function notifyStorageFailure() {
  pendingStorageFailure = true
  if (!storageFailureQueued && typeof window !== 'undefined') {
    storageFailureQueued = true
    queueMicrotask(() => {
      storageFailureQueued = false
      window.dispatchEvent(new Event('echosync-storage-failure'))
    })
  }
}

function loadLibraryCache() {
  const cache = readStorage(LIBRARY_CACHE_KEY, {})
  const now = Date.now()
  const valid = {}
  Object.entries(cache).forEach(([id, entry]) => {
    if (!entry?.savedAt || !entry.track || isPreviewTrack(entry.track)) return
    const maxAge = entry.track.streamUrl || entry.track.youtubeVideoId
      ? LIBRARY_STREAM_TTL
      : 1000 * 60 * 60 * 24 * 30
    if (now - entry.savedAt < maxAge) valid[id] = sanitizeTrack(entry.track)
  })
  return valid
}

function buildInitialLibrary() {
  const cache = loadLibraryCache()
  const library = {}
  SEED_TRACKS.forEach((seed) => {
    const cached = cache[seed.id]
    const safeSeed = sanitizeTrack(seed)
    library[seed.id] = cached
      ? sanitizeTrack({ ...safeSeed, ...cached, id: seed.id, preview: false, status: 'ready' })
      : { ...safeSeed, status: 'pending', streamUrl: null }
  })
  Object.values(cache).forEach((track) => {
    if (!track?.id || SEED_BY_ID[track.id] || isPreviewTrack(track)) return
    library[track.id] = sanitizeTrack({
      ...track,
      preview: false,
      status: track.streamUrl || track.youtubeVideoId ? 'ready' : 'pending',
    })
  })
  return library
}

function saveLibraryEntry(id, track) {
  if (!id || !track || isPreviewTrack(track)) return
  const cache = readStorage(LIBRARY_CACHE_KEY, {})
  cache[id] = { savedAt: Date.now(), track: sanitizeTrack(track) }
  writeStorage(LIBRARY_CACHE_KEY, cache)
}

function replaceTrackArtwork(tracks, trackId, cover) {
  if (!Array.isArray(tracks)) return tracks
  return tracks.map((entry) => (entry?.id === trackId ? { ...entry, cover } : entry))
}

function persistTrackArtwork(trackId, cover) {
  const safeCover = normalizeArtworkUrl(cover)
  if (!trackId || !safeCover) return
  const updateTrack = (entry) => (entry?.id === trackId ? { ...entry, cover: safeCover } : entry)

  const libraryCache = readStorage(LIBRARY_CACHE_KEY, null)
  if (libraryCache && typeof libraryCache === 'object') {
    Object.values(libraryCache).forEach((entry) => {
      if (entry?.track?.id === trackId) entry.track.cover = safeCover
    })
    writeStorage(LIBRARY_CACHE_KEY, libraryCache)
  }

  const likes = readStorage(LIKES_KEY, null)
  if (likes && typeof likes === 'object' && !Array.isArray(likes)) {
    let changed = false
    Object.keys(likes).forEach((userId) => {
      if (!Array.isArray(likes[userId])) return
      likes[userId] = likes[userId].map((entry) => {
        if (!entry || typeof entry !== 'object' || entry.id !== trackId) return entry
        changed = true
        return { ...entry, cover: safeCover }
      })
    })
    if (changed) writeStorage(LIKES_KEY, likes)
  }

  try {
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(DAILY_FEED_LEGACY_PREFIX)) return
      const feed = readStorage(key, null)
      if (!feed || typeof feed !== 'object') return
      let changed = false
      if (Array.isArray(feed.trending)) {
        const next = replaceTrackArtwork(feed.trending, trackId, safeCover)
        changed = changed || next !== feed.trending
        feed.trending = next
      }
      Object.values(feed.users || {}).forEach((user) => {
        if (Array.isArray(user?.madeForYou)) {
          const next = replaceTrackArtwork(user.madeForYou, trackId, safeCover)
          changed = changed || next !== user.madeForYou
          user.madeForYou = next
        }
        if (Array.isArray(user?.basedOnRecent)) {
          const next = replaceTrackArtwork(user.basedOnRecent, trackId, safeCover)
          changed = changed || next !== user.basedOnRecent
          user.basedOnRecent = next
        }
      })
      if (changed) writeStorage(key, feed)
    })
  } catch {
    /* storage can be unavailable */
  }

  let cacheChanged = false
  Object.values(streamCache.searches).forEach((entry) => {
    if (!Array.isArray(entry?.tracks)) return
    const next = entry.tracks.map(updateTrack)
    if (next.some((track, index) => track !== entry.tracks[index])) {
      entry.tracks = next
      cacheChanged = true
    }
  })
  Object.values(streamCache.streams).forEach((entry) => {
    if (entry?.track?.id === trackId) {
      entry.track.cover = safeCover
      cacheChanged = true
    }
  })
  if (cacheChanged) persistStreamCache()
}

function dailyFeedKey(dayKey) {
  return `${DAILY_FEED_PREFIX}${dayKey}`
}

function normalizeDailyFeed(dayKey, feed, builtAt = Date.now()) {
  const users = Object.fromEntries(Object.entries(feed?.users || {}).slice(-8).map(([id, user]) => [
    id,
    {
      ...user,
      madeForYou: Array.isArray(user?.madeForYou) ? user.madeForYou.map(sanitizeTrack) : [],
      basedOnRecent: Array.isArray(user?.basedOnRecent) ? user.basedOnRecent.map(sanitizeTrack) : [],
      topArtists: Array.isArray(user?.topArtists) ? user.topArtists : [],
      topLanguages: Array.isArray(user?.topLanguages) ? user.topLanguages : [],
    },
  ]))
  return {
    dayKey,
    builtAt,
    liveCount: Number(feed?.liveCount) || 0,
    trending: Array.isArray(feed?.trending) ? feed.trending.map(sanitizeTrack) : [],
    users,
  }
}

function validDailyTracks(tracks, minimum = 1) {
  const clean = uniqueTracks(
    (Array.isArray(tracks) ? tracks : [])
      .filter((track) => track?.id && !isPreviewTrack(track) && isFullLengthTrack(track))
      .map((track) => sanitizeTrack(track)),
  )
  return clean.length >= minimum ? clean : []
}

function buildDailyStarterFeed(dayKey, userKey, library = {}) {
  const cachedTracks = Object.values(library)
    .filter((track) => track?.id && !track.preview && isFullLengthTrack(track))
    .sort((left, right) => Number(right.status === 'ready') - Number(left.status === 'ready'))
  const pool = uniqueTracks([...cachedTracks, ...SEED_TRACKS])
  const trending = rotateDaily(pool, dayKey, 0).slice(0, 16)
  const madeForYou = rotateDaily(pool, `${dayKey}:${userKey}`, 4).slice(0, 12)
  const basedOnRecent = rotateDaily(pool, `${dayKey}:${userKey}`, 9).slice(0, 10)
  return {
    dayKey,
    builtAt: 0,
    liveCount: 0,
    trending,
    users: {
      [userKey]: {
        madeForYou,
        basedOnRecent,
        topArtists: [...new Set(pool.map((track) => safeText(track.artist)).filter(Boolean))].slice(0, 4),
        topLanguages: [],
      },
    },
  }
}

function fillDailyFeed(feed, starter, userKey) {
  const existingUser = feed?.users?.[userKey] || {}
  const starterUser = starter.users[userKey]
  const trending = validDailyTracks(feed?.trending, 6)
  return {
    ...(feed || starter),
    trending: trending.length ? trending : starter.trending,
    users: {
      ...(feed?.users || {}),
      [userKey]: {
        ...existingUser,
        madeForYou: validDailyTracks(existingUser.madeForYou).length
          ? validDailyTracks(existingUser.madeForYou)
          : starterUser.madeForYou,
        basedOnRecent: validDailyTracks(existingUser.basedOnRecent).length
          ? validDailyTracks(existingUser.basedOnRecent)
          : starterUser.basedOnRecent,
        topArtists: existingUser.topArtists?.length ? existingUser.topArtists : starterUser.topArtists,
        topLanguages: Array.isArray(existingUser.topLanguages) ? existingUser.topLanguages : [],
      },
    },
  }
}

function loadDailyFeedCache(dayKey) {
  const cached = readStorage(dailyFeedKey(dayKey), null)
  if (!cached || cached.dayKey !== dayKey) return null
  try {
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith(DAILY_FEED_LEGACY_PREFIX) &&
        key !== dailyFeedKey(dayKey)
      ) localStorage.removeItem(key)
    })
  } catch {
    /* storage can be unavailable */
  }
  const normalized = normalizeDailyFeed(dayKey, cached, Number(cached.builtAt) || 0)
  if (validDailyTracks(normalized.trending, 6).length < 6) {
    try {
      localStorage.removeItem(dailyFeedKey(dayKey))
    } catch {
      /* storage can be unavailable */
    }
    return null
  }
  if (JSON.stringify(normalized) !== JSON.stringify(cached)) {
    writeStorage(dailyFeedKey(dayKey), normalized)
  }
  return normalized
}

function saveDailyFeedCache(dayKey, feed) {
  if (validDailyTracks(feed?.trending, 6).length < 6 || Number(feed?.liveCount) < 6) return
  writeStorage(dailyFeedKey(dayKey), normalizeDailyFeed(dayKey, feed))
}

function uniqueTracks(tracks = [], excluded = new Set()) {
  const seen = new Set()
  const remember = (track) => {
    if (!track) return
    if (typeof track === 'string') {
      seen.add(track)
      return
    }
    if (track.id) seen.add(track.id)
    seen.add(`${normalize(track.title)}::${normalize(track.artist)}`)
  }
  excluded.forEach(remember)
  return tracks.filter((track) => {
    if (!track?.id) return false
    const key = `${normalize(track.title)}::${normalize(track.artist)}`
    if (seen.has(track.id) || seen.has(key)) return false
    seen.add(track.id)
    seen.add(key)
    return true
  })
}

function tasteSummary(library, liked, recentIds, playlists) {
  const sessionIds = [
    ...(Array.isArray(liked) ? liked : []),
    ...(Array.isArray(recentIds) ? recentIds : []),
    ...(Array.isArray(playlists) ? playlists.flatMap((playlist) => (Array.isArray(playlist?.trackIds) ? playlist.trackIds : [])) : []),
  ]
  const seen = new Set()
  const tracks = sessionIds
    .filter((id) => {
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map((id) => library[id])
    .filter(Boolean)
  const artistCounts = new Map()
  const languageCounts = new Map()
  tracks.forEach((track) => {
    const artists = String(track.artist || '')
      .split(/\s*(?:&|,| and | feat\.? | ft\.? )\s*/i)
      .map((artist) => artist.trim())
      .filter((artist) => artist && !/unknown/i.test(artist))
    artists.forEach((artist) => {
      const key = artist.toLowerCase()
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1)
      const language = ARTIST_LANGUAGE[key]
      if (language) languageCounts.set(language, (languageCounts.get(language) || 0) + 1)
    })
  })
  const recentArtists = (Array.isArray(recentIds) ? recentIds : [])
    .map((id) => library[id]?.artist)
    .flatMap((artist) => String(artist || '').split(/\s*(?:&|,| and )\s*/i))
    .map((artist) => artist.trim())
    .filter((artist) => artist && !/unknown/i.test(artist))
  return {
    topArtists: [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).map(([artist]) => artist).slice(0, 4),
    recentArtists: [...new Set(recentArtists)].slice(0, 4),
    topLanguages: [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).map(([language]) => language).slice(0, 2),
    trackCount: tracks.length,
  }
}

function loadTasteProfile(userId) {
  return normalizeTasteProfile(readUserValue(TASTE_PROFILE_KEY, userId || 'guest', null))
}

function rotateDaily(items, dayKey, offset = 0) {
  if (!items.length) return []
  let hash = 0
  for (let index = 0; index < dayKey.length; index += 1) hash = (hash * 31 + dayKey.charCodeAt(index)) % 100003
  const shift = (hash + offset) % items.length
  return [...items.slice(shift), ...items.slice(0, shift)]
}

async function fetchPlayableDaily(query, limit = 10) {
  const found = (await fetchJioSearch(query, Math.max(14, limit + 4)))
    .filter((track) => track && !isPreviewTrack(track) && isFullLengthTrack(track))
  const ready = []
  for (const candidate of found) {
    const track = candidate.streamUrl ? candidate : await hydrateJioTrack(candidate)
    if (track?.streamUrl && !isPreviewTrack(track) && isFullLengthTrack(track)) ready.push(sanitizeTrack(track))
    if (ready.length >= limit) break
  }
  return ready
}

async function loadDailySection(queries, limit) {
  const settled = await Promise.allSettled(queries.map((query) => fetchPlayableDaily(query, limit)))
  return uniqueTracks(settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))).slice(0, limit)
}

async function buildDailyFeed({ dayKey, userKey, taste, rotation = 0, existing = null }) {
  const trendingQueries = rotateDaily(DAILY_QUERIES, dayKey, rotation).slice(0, 4)
  const fallbackQueries = DAILY_QUERIES.filter((query) => !trendingQueries.includes(query))
  let live = await loadDailySection(trendingQueries, 20)
  if (live.length < 6) {
    live = uniqueTracks([...live, ...await loadDailySection(fallbackQueries, 20)])
  }
  const trending = uniqueTracks([
    ...live,
    ...(validDailyTracks(existing?.trending, 6) || []),
  ]).slice(0, 20)
  const profileArtists = Array.isArray(taste.profileArtists) ? taste.profileArtists : []
  const profileLanguages = Array.isArray(taste.profileLanguages) ? taste.profileLanguages : []
  const profileVibes = Array.isArray(taste.profileVibes) ? taste.profileVibes : []
  const profileSearches = Array.isArray(taste.profileSearches) ? taste.profileSearches : []
  const allArtists = [...new Set([...profileArtists, ...(taste.topArtists || [])])]
  const allLanguages = [...new Set([...profileLanguages, ...(taste.topLanguages || [])])]
  const hasProfile = Boolean(taste.profileEvents) || allArtists.length > 0 || profileVibes.length > 0
  const user = { madeForYou: [], basedOnRecent: [], topArtists: allArtists.slice(0, 4), topLanguages: allLanguages.slice(0, 2) }
  if ((userKey !== 'guest' || hasProfile) && (taste.trackCount > 0 || hasProfile)) {
    const language = allLanguages[0] || 'Hindi'
    const madeQueries = [
      ...allArtists.slice(0, 3).map((artist) => `${artist} songs`),
      ...profileVibes.slice(0, 2).map((vibe) => vibe.query),
      `${language} songs`,
    ]
    const recentQueries = [
      ...profileSearches.slice(0, 2).map((query) => query),
      ...(taste.recentArtists || []).slice(0, 3).map((artist) => `${artist} songs`),
    ]
    const [made, based] = await Promise.all([
      loadDailySection([...new Set(madeQueries)], 12),
      recentQueries.length ? loadDailySection([...new Set(recentQueries)], 10) : Promise.resolve([]),
    ])
    user.madeForYou = uniqueTracks([...made, ...trending]).slice(0, 12)
    user.basedOnRecent = uniqueTracks([...based, ...trending]).slice(0, 10)
  }
  return { dayKey, builtAt: Date.now(), liveCount: live.length, trending, users: { [userKey]: user } }
}

function evictLibraryEntry(id) {
  if (!id) return
  const cache = readStorage(LIBRARY_CACHE_KEY, {})
  if (!Object.prototype.hasOwnProperty.call(cache, id)) return
  delete cache[id]
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

const deadMirrors = new Set()

const LOCAL_MIRROR_PREFIXES = [
  '/api/saavn',
  '/api/piped/kavin',
  '/api/piped/coffee',
  '/api/piped/adminforge',
  '/api/piped/ducks',
  '/api/invidious/tux',
  '/api/invidious/nerd',
  '/api/invidious/f5',
]

function mirrorKeyFromUrl(url) {
  const value = String(url || '')
  const localPrefix = LOCAL_MIRROR_PREFIXES.find((prefix) => value.startsWith(prefix))
  if (localPrefix) return localPrefix
  try {
    return new URL(value, globalThis.location?.href).origin
  } catch {
    return value.split(/[?#]/)[0]
  }
}

async function fetchJson(url, options = {}) {
  const { timeout = 4500, ...rest } = options
  const mirrorKey = mirrorKeyFromUrl(url)
  if (!url.startsWith('/api/') && deadMirrors.has(mirrorKey)) {
    const error = new Error('Mirror unavailable')
    error.deadMirror = true
    error.status = 503
    throw error
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...rest, credentials: 'omit', signal: controller.signal })
    if (!response.ok) {
      if (!url.startsWith('/api/') && (response.status === 401 || response.status === 403)) deadMirrors.add(mirrorKey)
      const error = new Error(`Request failed (${response.status})`)
      error.status = response.status
      throw error
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function pickSaavnDownload(downloads = []) {
  const activeQuality = getActiveStreamQuality()
  const order = activeQuality === 'saver'
    ? ['96kbps', '160kbps', '320kbps']
    : activeQuality === 'normal'
      ? ['160kbps', '320kbps', '96kbps']
      : ['320kbps', '160kbps', '96kbps']
  for (const quality of order) {
    const found = downloads.find((item) => item.quality === quality)
    if (found?.url) return found
  }
  return downloads[downloads.length - 1]
}

function normalizeSaavn(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const providerId = safeText(source.id)
  if (!providerId) return null
  const downloads = Array.isArray(source.downloadUrl) ? source.downloadUrl.filter((item) => item?.url) : []
  const images = Array.isArray(source.image) ? source.image.filter((item) => item?.url) : []
  const stream = pickSaavnDownload(downloads)
  const cover =
    images.find((item) => item.quality === '500x500') ||
    images[images.length - 1]
  const artists = Array.isArray(source.artists?.primary)
    ? source.artists.primary.map((artist) => artist?.name).filter(Boolean)
    : []
  const artist =
    (artists.length ? artists.join(', ') : null) ||
    decodeEntities(source.primaryArtists || source.artist || 'Unknown artist')
  return sanitizeTrack({
    id: `jio-${providerId}`,
    providerId,
    provider: 'jiosaavn',
    providerLabel: 'JioSaavn',
    title: decodeEntities(source.name || 'Unknown track'),
    artist: decodeEntities(artist),
    album: decodeEntities(source.album?.name || 'Single'),
    duration: Number(source.duration) || 0,
    streamUrl: stream?.url || null,
    cover: cover?.url || null,
    quality: stream?.quality || '',
  })
}

function normalizeItunes(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const providerId = safeText(source.trackId)
  if (!providerId) return null
  const art = safeText(source.artworkUrl100 || source.artworkUrl60)
  const fullDuration = source.trackTimeMillis ? Math.round(Number(source.trackTimeMillis) / 1000) : 0
  return sanitizeTrack({
    id: `itunes-${providerId}`,
    providerId,
    provider: 'itunes',
    providerLabel: 'iTunes',
    title: decodeEntities(source.trackName || 'Unknown track'),
    artist: decodeEntities(source.artistName || 'Unknown artist'),
    album: decodeEntities(source.collectionName || 'Single'),
    duration: fullDuration,
    fullDuration,
    preview: false,
    needsHydration: true,
    streamUrl: null,
    cover: art ? art.replace(/\/\d+x\d+bb[^/]*\.(jpg|png)/i, '/600x600bb.jpg').replace('100x100bb', '600x600bb') : null,
    quality: 'metadata',
  })
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
  if (!track?.title || !track?.artist) return -1
  const haystack = `${track.title} ${track.album || ''}`
  if (HARD_BAD_MATCH.test(haystack)) return -1
  const softBad = SOFT_BAD_MATCH.test(haystack)
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
    return candidateArtist.includes(artist) || artist.includes(candidateArtist) ||
      normalize(seed.artist).includes(candidateArtist)
  })
  if (!artistHit) return -1
  score += 30

  const duration = track.fullDuration || track.duration
  if (duration && seed.duration) {
    if (duration < 40 && seed.duration > 60) return -1
    const difference = Math.abs(duration - seed.duration)
    if (difference <= 5) score += 15
    else if (difference <= 20) score += 8
    else if (difference > 45 && !(candidateTitle === targetTitle && artistHit)) return -1
    else if (difference > 45) score -= 5
  }
  if (softBad) score -= 22
  return score
}

function rankCandidates(results, seed) {
  return results
    .map((track) => ({ track, score: scoreMatch(track, seed) }))
    .filter((entry) => entry.score >= 55)
    .sort((a, b) => b.score - a.score)
}

async function hydrateJioTrack(track, options = {}) {
  if (!track || (!options.fresh && track.streamUrl) || !track.providerId) return track
  const cached = !options.fresh && cachedResolvedStream(`jio:${track.providerId}`)
  if (cached) return { ...track, ...cached, cover: track.cover || cached.cover }
  if (Date.now() < saavnBackoffUntil) return track
  for (const base of SAAVN_BASES) {
    try {
      const payload = await fetchJson(`${base}/api/songs/${track.providerId}`, { timeout: 5200 })
      const raw = Array.isArray(payload?.data) ? payload.data[0] : payload?.data?.songs?.[0] || payload?.data
      if (raw?.downloadUrl) {
        const normalized = normalizeSaavn(raw)
        if (normalized?.streamUrl) {
          cacheResolvedStream(`jio:${track.providerId}`, normalized)
          return { ...track, ...normalized, cover: track.cover || normalized.cover }
        }
      }
    } catch (error) {
      if (error?.status === 429) {
        saavnBackoffUntil = Date.now() + 15000
        return track
      }
    }
  }
  return track
}

async function fetchJioSearch(query, limit = 12, options = {}) {
  const cached = !options.fresh && cachedSearchEntry('jio', query, limit)
  if (cached) return cached
  if (Date.now() < saavnBackoffUntil) return []
  for (const base of SAAVN_BASES) {
    try {
      const payload = await fetchJson(
        `${base}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=${options.page || 1}`,
        { timeout: 9500 },
      )
      const results = payload?.data?.results || payload?.data?.songs?.results || []
      if (Array.isArray(results) && results.length) {
        const tracks = results.map(normalizeSaavn).filter(Boolean)
        if (tracks.length) {
          saavnBackoffUntil = 0
          cacheSearchEntry('jio', query, limit, tracks)
          return tracks
        }
      }
    } catch (error) {
      if (error?.status === 429) {
        saavnBackoffUntil = Date.now() + 15000
        return []
      }
    }
  }
  return []
}

async function fetchItunesSearch(query, limit = 12) {
  const cached = cachedSearchEntry('itunes', query, limit)
  if (cached) return cached
  try {
    const payload = await fetchJson(
      `${ITUNES_BASE}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`,
      { timeout: 5000 },
    )
    const results = Array.isArray(payload?.results) ? payload.results : []
    const tracks = results
      .map(normalizeItunes)
      .filter((track) => track && track.duration >= 45 && !isPreviewTrack(track))
    cacheSearchEntry('itunes', query, limit, tracks)
    return tracks
  } catch {
    return []
  }
}

const artworkFallbackCache = new Map()

const artworkFallbackMisses = new Set()

const artworkFallbackInflight = new Map()

async function fetchArtworkFallback(titleOrTrack, artist = '', videoId = '') {
  const track = titleOrTrack && typeof titleOrTrack === 'object' ? titleOrTrack : null
  const title = safeText(track?.title || titleOrTrack)
  const by = safeText(track?.artist || artist)
  const youtubeVideoId = safeText(track?.youtubeVideoId || videoId)
  if (!title || /^unknown track$/i.test(title)) return null
  const key = `${normalize(title)}::${normalize(by)}::${youtubeVideoId}`
  if (artworkFallbackCache.has(key)) return artworkFallbackCache.get(key)
  if (artworkFallbackMisses.has(key)) return null
  if (artworkFallbackInflight.has(key)) return artworkFallbackInflight.get(key)

  const task = (async () => {
    if (youtubeVideoId) {
      const thumbnail = normalizeArtworkUrl(`https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`)
      artworkFallbackCache.set(key, thumbnail)
      return thumbnail
    }
    const query = `${title} ${by}`.trim()
    const results = await Promise.allSettled([
      withTimeout(fetchJioSearch(query, 8), 4500),
      withTimeout(fetchItunesSearch(query, 8), 4500),
    ])
    const candidates = results.flatMap((result) => (
      result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
    )).filter((candidate) => normalizeArtworkUrl(candidate?.cover))
    const ranked = rankCandidates(candidates, { ...track, title, artist: by })
    const cover = normalizeArtworkUrl(ranked[0]?.track?.cover || candidates[0]?.cover)
    if (cover) artworkFallbackCache.set(key, cover)
    else artworkFallbackMisses.add(key)
    return cover
  })().finally(() => artworkFallbackInflight.delete(key))

  artworkFallbackInflight.set(key, task)
  return task
}

function normalizePipedCandidate(item) {
  const source = item && typeof item === 'object' ? item : {}
  const videoId = String(source.url || '').split('v=')[1]?.split('&')[0] || safeText(source.id)
  if (!videoId) return null
  return sanitizeTrack({
    id: `yt-${videoId}`,
    videoId,
    provider: 'youtube',
    providerLabel: '',
    title: decodeEntities(source.title || 'Unknown video'),
    artist: decodeEntities(source.uploaderName || source.uploader || 'Unknown artist'),
    album: '',
    duration: Number(source.duration) || 0,
    streamUrl: null,
    cover: safeMediaUrl(source.thumbnail),
    quality: '',
  })
}

function normalizeInvidiousCandidate(item) {
  const source = item && typeof item === 'object' ? item : {}
  const videoId = safeText(source.videoId)
  if (!videoId) return null
  const thumb = Array.isArray(source.videoThumbnails)
    ? source.videoThumbnails.find((entry) => entry?.quality === 'maxresdefault') || source.videoThumbnails[source.videoThumbnails.length - 1]
    : null
  return sanitizeTrack({
    id: `yt-${videoId}`,
    videoId,
    provider: 'youtube',
    providerLabel: '',
    title: decodeEntities(source.title || 'Unknown video'),
    artist: decodeEntities(source.author || 'Unknown artist'),
    album: '',
    duration: Number(source.lengthSeconds) || 0,
    streamUrl: null,
    cover: safeMediaUrl(thumb?.url),
    quality: '',
  })
}

async function searchPiped(query, filter = 'music_songs') {
  for (const base of PIPED_INSTANCES) {
    try {
      const payload = await fetchJson(
        `${base}/search?q=${encodeURIComponent(query)}&filter=${filter}`,
        { timeout: 4600 },
      )
      const items = Array.isArray(payload?.items) ? payload.items : []
      const tracks = items.map(normalizePipedCandidate).filter((track) => track && (!track.duration || track.duration >= 45))
      if (tracks.length) return tracks
    } catch {
      /* try the next instance */
    }
  }
  return []
}

async function searchInvidious(query) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const payload = await fetchJson(
        `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { timeout: 4600 },
      )
      const items = Array.isArray(payload) ? payload : []
      const tracks = items.map(normalizeInvidiousCandidate).filter((track) => track && (!track.duration || track.duration >= 45))
      if (tracks.length) return tracks
    } catch {
      /* try the next instance */
    }
  }
  return []
}

async function searchYouTubeCandidates(query) {
  const [pipedResult, invidiousResult] = await Promise.allSettled([
    searchPiped(query),
    searchInvidious(query),
  ])
  let all = [
    ...(pipedResult.status === 'fulfilled' ? pipedResult.value : []),
    ...(invidiousResult.status === 'fulfilled' ? invidiousResult.value : []),
  ]
  if (!all.length) all = await searchPiped(query, 'videos')
  const seen = new Set()
  return all.filter((track) => {
    if (!track.videoId || seen.has(track.videoId)) return false
    seen.add(track.videoId)
    return true
  })
}

function chooseAudioFormat(formats = []) {
  const audio = formats
    .filter((format) => format?.url && (String(format.mimeType || format.type || '').startsWith('audio/') || format.audioQuality))
    .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))
  const mp4 = audio.find((format) => String(format.mimeType || format.type || '').includes('mp4'))
  return mp4 || audio[0] || null
}

function pickPipedAudio(payload) {
  const audio = chooseAudioFormat(payload?.audioStreams || [])
  if (audio) return audio
  const muxed = (payload?.videoStreams || [])
    .filter((format) => format?.url && !format.videoOnly && String(format.mimeType || '').includes('mp4'))
  return chooseAudioFormat(muxed)
}

async function firstSuccessful(tasks) {
  return new Promise((resolve, reject) => {
    let pending = tasks.length
    if (!pending) {
      reject(new Error('No stream sources available'))
      return
    }
    tasks.forEach((task) => {
      Promise.resolve(task)
        .then(resolve)
        .catch(() => {
          pending -= 1
          if (!pending) reject(new Error('No stream source answered'))
        })
    })
  })
}

async function getLocalYouTubeAudio(videoId) {
  const data = await fetchJson(`/api/youtube/audio/${encodeURIComponent(videoId)}`, { timeout: 14000 })
  if (!data?.url) throw new Error('No audio format')
  return {
    streamUrl: mediaProxyUrl(data.url),
    quality: data.bitrate ? `${Math.round(Number(data.bitrate) / 1000)} kbps` : 'Audio',
    duration: Number(data.duration) || 0,
    cover: safeMediaUrl(data.thumbnail),
    provider: 'youtube',
    providerLabel: '',
  }
}

async function getPipedAudio(base, videoId) {
  const payload = await fetchJson(`${base}/streams/${videoId}`, { timeout: 4600 })
  const format = pickPipedAudio(payload)
  if (!format?.url) throw new Error('No audio format')
  return {
    streamUrl: mediaProxyUrl(format.url),
    quality: format.bitrate ? `${Math.round(Number(format.bitrate) / 1000)} kbps` : 'Audio',
    duration: Number(payload?.duration) || 0,
    cover: safeMediaUrl(payload?.thumbnailUrl),
    provider: 'youtube',
    providerLabel: '',
  }
}

async function getInvidiousAudio(base, videoId) {
  const payload = await fetchJson(`${base}/api/v1/videos/${videoId}`, { timeout: 4600 })
  const format = chooseAudioFormat(payload?.adaptiveFormats || [])
  if (!format?.url) throw new Error('No audio format')
  return {
    streamUrl: mediaProxyUrl(format.url),
    quality: format.bitrate ? `${Math.round(Number(format.bitrate) / 1000)} kbps` : 'Audio',
    duration: Number(payload?.lengthSeconds) || 0,
    cover: safeMediaUrl(payload?.videoThumbnails?.find((entry) => entry.quality === 'maxresdefault')?.url),
    provider: 'youtube',
    providerLabel: '',
  }
}

async function getYouTubeAudio(videoId) {
  if (!videoId) return null
  const cached = cachedResolvedStream(`yt:${videoId}`)
  if (cached?.streamUrl) return cached
  const tasks = [
    getLocalYouTubeAudio(videoId),
    ...INVIDIOUS_INSTANCES.map((base) => getInvidiousAudio(base, videoId)),
    ...PIPED_INSTANCES.map((base) => getPipedAudio(base, videoId)),
  ]
  try {
    const result = await firstSuccessful(tasks)
    cacheResolvedStream(`yt:${videoId}`, result)
    return result
  } catch {
    return null
  }
}

function scoreYouTubeCandidate(track, seed) {
  const targetTitle = normalize(seed.title)
  const candidateTitle = normalize(track.title)
  if (!targetTitle || !candidateTitle) return -1
  if (HARD_BAD_MATCH.test(candidateTitle)) return -1
  let score = 0
  if (candidateTitle === targetTitle) score += 60
  else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 38
  else if (titleOverlap(seed.title, track.title) >= 0.7) score += 22
  else return -1
  const artistTokens = seed.artist.split(/\s*(?:&|,| and )\s*/i).map(normalize).filter(Boolean)
  if (artistTokens.some((artist) => artist && normalize(track.artist).includes(artist))) score += 24
  if (SOFT_BAD_MATCH.test(candidateTitle)) score -= 18
  const duration = track.duration || 0
  if (duration && seed.duration) {
    const difference = Math.abs(duration - seed.duration)
    if (difference <= 8) score += 12
    else if (difference > 70) score -= 8
  }
  return score
}

function rankYouTubeCandidates(candidates, seed) {
  return candidates
    .map((track) => ({ track, score: scoreYouTubeCandidate(track, seed) }))
    .filter((entry) => entry.score >= 30)
    .sort((a, b) => b.score - a.score)
}

async function resolveYouTubeTrack(seed) {
  const queries = [`${seed.searchTitle || seed.title} ${seed.artist}`, seed.searchTitle || seed.title]
  let fallback = null
  for (const query of queries) {
    const candidates = await searchYouTubeCandidates(query)
    if (!candidates.length) continue
    const ranked = rankYouTubeCandidates(candidates, seed).slice(0, 3)
    for (const entry of ranked) {
      const audio = await getYouTubeAudio(entry.track.videoId)
      const candidate = entry.track
      if (!fallback) fallback = candidate
      if (audio?.streamUrl) {
        return {
          ...seed,
          id: seed.id,
          provider: 'youtube',
          providerLabel: '',
          youtubeVideoId: candidate.videoId,
          streamUrl: audio.streamUrl,
          duration: candidate.duration || audio.duration || seed.duration,
          cover: seed.cover || candidate.cover || audio.cover || null,
          quality: audio.quality || 'Audio',
          preview: false,
          c1: seed.c1,
          c2: seed.c2,
        }
      }
    }
  }
  if (fallback) {
    return {
      ...seed,
      id: seed.id,
      provider: 'youtube',
      providerLabel: '',
      youtubeVideoId: fallback.videoId,
      streamUrl: null,
      duration: fallback.duration || seed.duration,
      cover: seed.cover || fallback.cover || null,
      quality: 'Stream',
      preview: false,
      c1: seed.c1,
      c2: seed.c2,
    }
  }
  return null
}

async function searchEverything(query) {
  const cached = cachedSearchEntry('everything', query, 30)
  if (cached) return cached
  const [jioResult, youtubeResult, itunesResult] = await Promise.allSettled([
    fetchJioSearch(query, 30),
    searchYouTubeCandidates(query),
    fetchItunesSearch(query, 24),
  ])
  const jio = jioResult.status === 'fulfilled' ? jioResult.value : []
  const youtube = youtubeResult.status === 'fulfilled' ? youtubeResult.value : []
  const itunes = itunesResult.status === 'fulfilled' ? itunesResult.value : []
  const seen = new Set()
  const combined = []
  const sources = [jio, youtube.slice(0, 16), itunes]
  const maxLength = Math.max(...sources.map((source) => source.length))
  for (let index = 0; index < maxLength; index += 1) {
    sources.forEach((source) => {
      const track = source[index]
      if (!track) return
      const safeTrack = sanitizeTrack(track)
      if (!safeTrack || isPreviewTrack(safeTrack) || !isFullLengthTrack(safeTrack)) return
      const key = `${normalize(safeTrack.title)}::${normalize(safeTrack.artist)}`
      if (seen.has(key)) return
      seen.add(key)
      combined.push(safeTrack)
    })
  }
  const result = combined.slice(0, 30)
  cacheSearchEntry('everything', query, 30, result)
  return result
}

function isFullLengthTrack(track) {
  if (!track) return false
  if (isPreviewTrack(track)) return false
  const seconds = Number(track.duration) || 0
  // Unknown duration stays in the catalog; playback must verify media metadata.
  return !seconds || (Number.isFinite(seconds) && seconds >= 60)
}

async function resolveFullTrack(candidate, options = {}) {
  if (!candidate) return null
  const cached = !options.forceRefresh && cachedResolvedStream(candidate.id)
  if (cached && (cached.streamUrl || cached.youtubeVideoId)) {
    return { ...candidate, ...cached, id: candidate.id, preview: false, needsHydration: false, status: 'ready' }
  }
  const seed = SEED_BY_ID[candidate.id]
  if (seed) {
    const resolved = await resolveSeed(seed, options)
    return { ...candidate, ...resolved, id: candidate.id, preview: false, needsHydration: false, status: 'ready' }
  }
  const target = { ...candidate, preview: false, needsHydration: true }
  if (target.provider === 'jiosaavn') {
    const hydrated = target.streamUrl && !isPreviewTrack(target) ? target : await hydrateJioTrack(target, { fresh: options.forceRefresh })
    if (hydrated?.streamUrl && isFullLengthTrack(hydrated)) {
      const ready = { ...target, ...hydrated, id: target.id, preview: false, needsHydration: false }
      cacheResolvedStream(target.id, ready)
      return ready
    }
  }
  if (target.streamUrl && isFullLengthTrack(target)) {
    cacheResolvedStream(target.id, target)
    return { ...target, needsHydration: false, status: 'ready' }
  }

  if (target.youtubeVideoId) {
    const audio = await getYouTubeAudio(target.youtubeVideoId)
    if (audio?.streamUrl) {
      const ready = {
        ...target,
        ...audio,
        id: target.id,
        provider: 'youtube',
        providerLabel: '',
        preview: false,
        needsHydration: false,
        status: 'ready',
      }
      cacheResolvedStream(target.id, ready)
      return ready
    }
  }

  const query = `${target.searchTitle || target.title} ${target.artist || ''}`.trim()
  if (query) {
    const candidates = await fetchJioSearch(query, 16, { fresh: options.forceRefresh })
    const ranked = rankCandidates(candidates, {
      ...target,
      title: target.searchTitle || target.title,
      duration: target.duration || 180,
    })
    for (const entry of ranked.slice(0, 4)) {
      const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track, { fresh: options.forceRefresh })
      if (hydrated?.streamUrl && isFullLengthTrack(hydrated)) {
        const ready = {
          ...target,
          ...hydrated,
          id: target.id,
          preview: false,
          needsHydration: false,
          status: 'ready',
          cover: target.cover || hydrated.cover || null,
        }
        cacheResolvedStream(target.id, ready)
        return ready
      }
    }
  }

  if (target.title && target.artist) {
    const youtube = await resolveYouTubeTrack(target)
    if (youtube?.streamUrl || youtube?.youtubeVideoId) {
      const ready = {
        ...target,
        ...youtube,
        id: target.id,
        preview: false,
        needsHydration: false,
        status: 'ready',
        cover: target.cover || youtube.cover || null,
      }
      cacheResolvedStream(target.id, ready)
      return ready
    }
  }
  return null
}

async function resolveByMetadata(candidate, options = {}) {
  if (!candidate) return null
  const target = {
    ...candidate,
    searchTitle: candidate.searchTitle || candidate.title,
    preview: false,
    needsHydration: true,
  }
  const query = `${target.searchTitle || target.title} ${target.artist || ''}`.trim()
  if (!query) return null

  const [jioResult, youtubeResult] = await Promise.allSettled([
    withTimeout(fetchJioSearch(query, 16, { fresh: options.forceRefresh }), 4500),
    withTimeout(searchYouTubeCandidates(query), 4500),
  ])
  const jioTracks = jioResult.status === 'fulfilled' ? jioResult.value : []
  const youtubeTracks = youtubeResult.status === 'fulfilled' ? youtubeResult.value : []

  const ranked = rankCandidates(jioTracks, target)
  for (const entry of ranked.slice(0, 2)) {
    if (entry.track?.streamUrl && !isPreviewTrack(entry.track) && isFullLengthTrack(entry.track)) {
      const ready = sanitizeTrack({
        ...target,
        ...entry.track,
        id: target.id,
        cover: target.cover || entry.track.cover || null,
        preview: false,
        needsHydration: false,
        status: 'ready',
      })
      cacheResolvedStream(target.id, ready)
      return ready
    }
  }

  const youtubeRanked = rankYouTubeCandidates(youtubeTracks, target)
  const youtubeCandidate = youtubeRanked[0]?.track || youtubeTracks[0] || null
  if (youtubeCandidate?.videoId) {
    let audio = null
    try {
      audio = await withTimeout(getYouTubeAudio(youtubeCandidate.videoId), 4500)
    } catch {
      audio = null
    }
    const ready = sanitizeTrack({
      ...target,
      ...(audio || {}),
      id: target.id,
      provider: 'youtube',
      providerLabel: '',
      youtubeVideoId: youtubeCandidate.videoId,
      streamUrl: audio?.streamUrl || null,
      duration: youtubeCandidate.duration || audio?.duration || target.duration,
      cover: target.cover || audio?.cover || youtubeCandidate.cover || null,
      quality: audio?.quality || 'Stream',
      preview: false,
      needsHydration: false,
      status: 'ready',
    })
    cacheResolvedStream(target.id, ready)
    return ready
  }

  for (const entry of ranked.slice(0, 2)) {
    try {
      const hydrated = await withTimeout(hydrateJioTrack(entry.track), 4500)
      if (hydrated?.streamUrl && !isPreviewTrack(hydrated) && isFullLengthTrack(hydrated)) {
        const ready = sanitizeTrack({
          ...target,
          ...hydrated,
          id: target.id,
          cover: target.cover || hydrated.cover || null,
          preview: false,
          needsHydration: false,
          status: 'ready',
        })
        cacheResolvedStream(target.id, ready)
        return ready
      }
    } catch {
      /* try the next matching source */
    }
  }
  return null
}

const resolutionPromises = new Map()

async function resolveSeed(seed, options = {}) {
  const cached = !options.forceRefresh && cachedResolvedStream(seed.id)
  if (cached && (cached.streamUrl || cached.youtubeVideoId)) return { ...cached, id: seed.id }
  if (!options.forceRefresh && resolutionPromises.has(seed.id)) return resolutionPromises.get(seed.id)
  const task = (async () => {
    const searchTitle = seed.searchTitle || seed.title
    const primaryQuery = `${searchTitle} ${seed.artist}`
    const finalize = (best) => {
      const resolved = {
        ...seed,
        ...best,
        id: seed.id,
        c1: seed.c1,
        c2: seed.c2,
        cover: seed.cover || best.cover || null,
        preview: false,
      }
      if (resolutionPromises.get(seed.id) === task) cacheResolvedStream(seed.id, resolved)
      return resolved
    }

    let candidates = await fetchJioSearch(primaryQuery, 16, { fresh: options.forceRefresh })
    let ranked = rankCandidates(candidates, seed)
    for (const entry of ranked.slice(0, 3)) {
      const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track, { fresh: options.forceRefresh })
      if (hydrated?.streamUrl && isFullLengthTrack(hydrated)) return finalize(hydrated)
    }

    const youtube = await resolveYouTubeTrack(seed)
    if (youtube?.streamUrl || youtube?.youtubeVideoId) return finalize(youtube)

    candidates = await fetchJioSearch(searchTitle, 16, { fresh: options.forceRefresh })
    ranked = rankCandidates(candidates, seed)
    for (const entry of ranked.slice(0, 3)) {
      const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track)
      if (hydrated?.streamUrl && isFullLengthTrack(hydrated)) return finalize(hydrated)
    }

    const error = new Error('No official stream found')
    error.code = 'UNRESOLVED'
    throw error
  })()
  resolutionPromises.set(seed.id, task)
  try {
    return await task
  } finally {
    if (resolutionPromises.get(seed.id) === task) resolutionPromises.delete(seed.id)
  }
}

function prepareLyricsData(data) {
  if (!data || !Array.isArray(data.lines) || !data.lines.length) return data
  const language = detectLyricsLanguage(data.lines.map((line) => line?.text || '').join(' '))
  const translatable = language === 'ur' || language === 'other'
  const lines = data.lines.map((line) => {
    const sourceText = String(line?.text || '')
    return {
      ...line,
      sourceText,
      text: hasDevanagari(sourceText) ? transliterateDevanagari(sourceText) : sourceText,
    }
  })
  return {
    ...data,
    lines,
    language,
    translatable,
    plain: lines.map((line) => line.text).join('\n'),
  }
}

function normalizeLyricData(payload) {
  if (!payload) return null
  if (payload.syncedLyrics) {
    const lines = parseLrc(payload.syncedLyrics)
    if (lines.length) {
      return prepareLyricsData({ type: 'synced', lines, source: 'LRCLIB', instrumental: Boolean(payload.instrumental) })
    }
  }
  if (payload.plainLyrics) {
    const lines = String(payload.plainLyrics)
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ time: index, text }))
    return prepareLyricsData({
      type: 'plain',
      plain: payload.plainLyrics,
      lines,
      source: 'LRCLIB',
      instrumental: Boolean(payload.instrumental),
    })
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
  if (cached && Date.now() - cached.savedAt < 1000 * 60 * 60 * 24) {
    return cached.data ? prepareLyricsData(cached.data) : null
  }

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

const CURATED_TRANSLATIONS = {
  kesariya: [
    'A moment of love, a moment, my love',
    'A moment of colour, a moment, my love',
    'When I found you, I lost myself',
    'My beloved, my beloved',
  ],
  pasoori: [
    'I am a little stubborn, a little crazy',
    'You are my world, the beat of my heart',
    'This puzzle of love, this Pasoori',
    'Tell me, how do I solve you?',
  ],
  'tum-hi-ho': [
    'You are life and death for me',
    'You are my peace, my sanctuary',
    'Without you I am nothing',
    'You are everything I have',
  ],
  'apna-bana-le': [
    'Make me yours, my beloved',
    'I am yours, make me yours',
    'When you are not here, nothing feels right',
    'Stay with me, make me yours',
  ],
}

async function translateBatchGoogle(texts) {
  if (!texts.length) return null
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(texts.join('\n'))}`
  const payload = await fetchJson(url, { timeout: 8000 })
  const pieces = Array.isArray(payload?.[0]) ? payload[0] : []
  const translated = pieces.map((piece) => (Array.isArray(piece) ? piece[0] : '') || '').join('')
  const lines = translated.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === texts.length) return lines
  const compact = translated.trim()
  if (texts.length === 1 && compact) return [compact]
  return null
}

async function translateLineMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en`
  const payload = await fetchJson(url, { timeout: 5200 })
  const translated = payload?.responseData?.translatedText
  return typeof translated === 'string' ? decodeEntities(translated).trim() : ''
}

function loadTranslationCache(trackId) {
  const cache = readStorage(TRANSLATION_CACHE_KEY, {}) || {}
  const entry = cache[trackId]
  if (!entry || !Array.isArray(entry.lines) || Date.now() - (entry.ts || 0) > 1000 * 60 * 60 * 24 * 14) return null
  return entry.lines
}

function saveTranslationCache(trackId, lines) {
  const cache = readStorage(TRANSLATION_CACHE_KEY, {}) || {}
  cache[trackId] = { ts: Date.now(), lines }
  writeStorage(TRANSLATION_CACHE_KEY, cache)
}

async function translateLines(lines, track, onProgress) {
  const trackId = track?.id || 'track'
  const curated = CURATED_TRANSLATIONS[trackId] || []
  const cachedLines = loadTranslationCache(trackId) || []
  const results = [...lines]
  const cacheLines = [...cachedLines]
  while (cacheLines.length < lines.length) cacheLines.push('')

  results.forEach((line, index) => {
    if (!(line?.sourceText || line?.text)?.trim()) return
    if (curated[index]) {
      results[index] = { ...line, enText: curated[index] }
      cacheLines[index] = curated[index]
    } else if (cachedLines[index]) {
      results[index] = { ...line, enText: cachedLines[index] }
    }
  })
  onProgress?.([...results])

  const missing = results
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => (line?.sourceText || line?.text)?.trim() && !results[index].enText)
  if (!missing.length) return results

  const chunks = []
  for (let index = 0; index < missing.length; index += 18) {
    chunks.push(missing.slice(index, index + 18))
  }

  for (const chunk of chunks) {
    const texts = chunk.map(({ line }) => String(line.sourceText || line.text).trim())
    let translatedBatch = null
    try {
      translatedBatch = await translateBatchGoogle(texts)
    } catch {
      translatedBatch = null
    }
    if (!translatedBatch || translatedBatch.length !== chunk.length) {
      translatedBatch = []
      for (const text of texts) {
        let translated = ''
        try {
          translated = await translateLineMyMemory(text)
        } catch {
          translated = ''
        }
        translatedBatch.push(translated)
      }
    }
    chunk.forEach(({ line, index }, offset) => {
      const translated = translatedBatch[offset] || ''
      if (!translated) return
      results[index] = { ...line, enText: translated }
      cacheLines[index] = translated
    })
    saveTranslationCache(trackId, cacheLines)
    onProgress?.([...results])
  }

  return results
}

const EMPTY_TRACK = {
  id: 'empty',
  title: 'Nothing playing',
  artist: 'Choose a song to begin',
  album: '',
  duration: 0,
  status: 'idle',
  c1: '#26303a',
  c2: '#a65845',
}

const ROOM_EMPTY_TRACK = {
  ...EMPTY_TRACK,
  title: 'The room is quiet',
  artist: 'Add a song to begin',
}

function publicAccount(account, online = false) {
  if (!account) return null
  const { password, ...safe } = account
  return { ...safe, online: online && safe.showActivity !== false }
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

let ytApiPromise = null

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous()
      resolve(window.YT)
    }
    const existing = document.querySelector('script[data-echosync-yt]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.echosyncYt = 'true'
      script.onerror = () => {
        ytApiPromise = null
        reject(new Error('YouTube IFrame API unavailable'))
      }
      document.head.appendChild(script)
    }
    setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT)
      else {
        ytApiPromise = null
        reject(new Error('YouTube IFrame API timed out'))
      }
    }, 8000)
  })
  return ytApiPromise
}

export function consumeStorageFailure() {
  if (!pendingStorageFailure) return false
  pendingStorageFailure = false
  return true
}

export {
  DEV_API,
  SAAVN_BASES,
  saavnBackoffUntil,
  ITUNES_BASE,
  LRCLIB_BASE,
  LIBRARY_CACHE_KEY,
  LYRIC_CACHE_KEY,
  LIKES_KEY,
  THEME_KEY,
  USERS_KEY,
  ACTIVE_USER_ID_KEY,
  REMEMBER_USER_KEY,
  ROOMS_KEY,
  ROOM_STATE_KEY,
  MESSAGES_KEY,
  PLAYLISTS_KEY,
  RECENT_KEY,
  SETTINGS_KEY,
  TASTE_PROFILE_KEY,
  TRANSLATE_KEY,
  STREAM_CACHE_KEY,
  TRANSLATION_CACHE_KEY,
  INVITES_KEY,
  PUBLIC_LOUNGE_KEY,
  LOUNGE_MESSAGE_LIMIT,
  LOUNGE_TYPING_MS,
  DAILY_FEED_PREFIX,
  DAILY_FEED_LEGACY_PREFIX,
  pendingStorageFailure,
  storageFailureQueued,
  readStorage,
  writeStorage,
  LOCK_MESSAGE,
  SOLO_ROOM_ID,
  DAILY_QUERIES,
  DEFAULT_SETTINGS,
  STREAM_CACHE_TTL,
  YOUTUBE_CACHE_TTL,
  LIBRARY_STREAM_TTL,
  MAX_SESSION_IDS,
  MAX_PALETTE_ENTRIES,
  RESUME_RELOAD_TIMEOUT,
  RESUME_ADVANCE_TIMEOUT,
  BUFFER_RECOVERY_TIMEOUT,
  rememberBoundedId,
  trimBoundedSet,
  seededShuffle,
  PIPED_INSTANCES,
  INVIDIOUS_INSTANCES,
  mediaProxyUrl,
  AVATAR_PRESETS,
  ROOM_GRADIENTS,
  uid,
  slugifyHandle,
  roomCode,
  normalizeRoomCode,
  handleFromEmail,
  displayNameFromHandle,
  readActiveUserId,
  writeActiveSession,
  clearActiveSession,
  loadUsers,
  loadStoredRooms,
  loadStoredMessages,
  readUserValue,
  writeUserValue,
  loadInvites,
  normalizeLoungeMessage,
  loadLoungeMessages,
  normalizeRoom,
  loadRoomStateSnapshot,
  purgeLegacySeedData,
  streamCache,
  persistStreamCache,
  purgePreviewCaches,
  cachedSearchEntry,
  cacheSearchEntry,
  cachedResolvedStream,
  cacheResolvedStream,
  clearResolvedStream,
  clearPlaybackCaches,
  SEED_TRACKS,
  SEED_BY_ID,
  accountDisplay,
  rolesForRoom,
  randomAvatarPreset,
  HARD_BAD_MATCH,
  SOFT_BAD_MATCH,
  clockNow,
  decodeEntities,
  normalize,
  safeText,
  safeMediaUrl,
  PALETTE_CACHE,
  clamp,
  parseHexColor,
  rgbToHsl,
  hslToRgb,
  cssColor,
  hashHue,
  paletteFromHue,
  paletteFromTrack,
  artworkImageSource,
  loadArtworkCanvasSource,
  paletteFromArtworkPixels,
  extractArtworkPalette,
  withTimeout,
  likedTrackId,
  likedIdsFrom,
  mergeLikedTracks,
  sanitizeTrack,
  sanitizePlaylist,
  isPreviewTrack,
  notifyStorageFailure,
  loadLibraryCache,
  buildInitialLibrary,
  saveLibraryEntry,
  replaceTrackArtwork,
  persistTrackArtwork,
  dailyFeedKey,
  normalizeDailyFeed,
  validDailyTracks,
  buildDailyStarterFeed,
  fillDailyFeed,
  loadDailyFeedCache,
  saveDailyFeedCache,
  uniqueTracks,
  tasteSummary,
  loadTasteProfile,
  rotateDaily,
  fetchPlayableDaily,
  loadDailySection,
  buildDailyFeed,
  evictLibraryEntry,
  loadLyricCache,
  saveLyricCache,
  deadMirrors,
  LOCAL_MIRROR_PREFIXES,
  mirrorKeyFromUrl,
  fetchJson,
  pickSaavnDownload,
  normalizeSaavn,
  normalizeItunes,
  titleOverlap,
  scoreMatch,
  rankCandidates,
  hydrateJioTrack,
  fetchJioSearch,
  fetchItunesSearch,
  artworkFallbackCache,
  artworkFallbackMisses,
  artworkFallbackInflight,
  fetchArtworkFallback,
  normalizePipedCandidate,
  normalizeInvidiousCandidate,
  searchPiped,
  searchInvidious,
  searchYouTubeCandidates,
  chooseAudioFormat,
  pickPipedAudio,
  firstSuccessful,
  getLocalYouTubeAudio,
  getPipedAudio,
  getInvidiousAudio,
  getYouTubeAudio,
  scoreYouTubeCandidate,
  rankYouTubeCandidates,
  resolveYouTubeTrack,
  resolveTrackArtwork,
  searchEverything,
  isFullLengthTrack,
  resolveFullTrack,
  resolveByMetadata,
  resolutionPromises,
  resolveSeed,
  prepareLyricsData,
  normalizeLyricData,
  delay,
  fetchLyrics,
  CURATED_TRANSLATIONS,
  translateBatchGoogle,
  translateLineMyMemory,
  loadTranslationCache,
  saveTranslationCache,
  translateLines,
  EMPTY_TRACK,
  ROOM_EMPTY_TRACK,
  publicAccount,
  formatBytes,
  ytApiPromise,
  loadYouTubeApi,
}
