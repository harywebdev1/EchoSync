import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  Settings,
  Pencil,
  Trash2,
  LogOut,
  ShieldCheck,
  Shield,
  UserRoundPlus,
  UserMinus,
  KeyRound,
  AtSign,
  CornerUpLeft,
  Languages,
  UsersRound,
  Copy,
  Globe,
  Clock3,
  Music,
  ListPlus,
  Link2,
  DoorOpen,
  Shuffle,
  SlidersHorizontal,
  HardDrive,
  BellRing,
  ArrowRight,
  Mail,
  Image,
  Save,
} from 'lucide-react'

const DEV_API = import.meta.env.DEV
const SAAVN_BASES = [DEV_API ? '/api/saavn' : 'https://saavn.sumit.co']
let saavnBackoffUntil = 0
let streamQuality = 'high'
const ITUNES_BASE = 'https://itunes.apple.com/search'
const LRCLIB_BASE = 'https://lrclib.net/api'
const LIBRARY_CACHE_KEY = 'echosync.library.v1'
const LYRIC_CACHE_KEY = 'echosync.lyrics.v1'
const LIKES_KEY = 'echosync.likes.v1'
const THEME_KEY = 'echosync.theme.v1'
const USERS_KEY = 'echosync_users_db'
const ACTIVE_USER_ID_KEY = 'echosync_active_user_id'
const REMEMBER_USER_KEY = 'echosync_remember_user_id'
const ROOMS_KEY = 'echosync_rooms_v3'
const ROOM_STATE_KEY = 'echosync_room_state_v3'
const MESSAGES_KEY = 'echosync_messages_v3'
const PLAYLISTS_KEY = 'echosync_playlists_v1'
const RECENT_KEY = 'echosync_recent_v1'
const SETTINGS_KEY = 'echosync_settings_v1'
const TRANSLATE_KEY = 'echosync_translate.v1'
const STREAM_CACHE_KEY = 'echosync_stream_cache_v3'
const TRANSLATION_CACHE_KEY = 'echosync_lyrics_trans_cache'
const INVITES_KEY = 'echosync_invites_v1'
const LOCK_MESSAGE = '🔒 Listener Mode: Only Room Admin or DJ can control playback'
const SOLO_ROOM_ID = 'solo'

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
}

const PIPED_INSTANCES = DEV_API
  ? ['/api/piped/kavin', '/api/piped/coffee', '/api/piped/adminforge']
  : ['https://pipedapi.kavin.rocks', 'https://api.piped.private.coffee', 'https://pipedapi.adminforge.de']
const INVIDIOUS_INSTANCES = DEV_API
  ? ['/api/invidious/tux', '/api/invidious/nerd']
  : ['https://inv.tux.pizza', 'https://invidious.nerdvpn.de']

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

function nameFromEmail(email = '') {
  const prefix = String(email).split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (!prefix) return 'New Listener'
  return prefix.split(' ').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
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

function loadStoredPlaylists() {
  const stored = readStorage(PLAYLISTS_KEY, null)
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
}

function loadStoredRecent() {
  const stored = readStorage(RECENT_KEY, null)
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
}

function loadSettings() {
  const stored = readStorage(SETTINGS_KEY, null)
  return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) }
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
  writeStorage(key, map)
}

function loadInvites() {
  const stored = readStorage(INVITES_KEY, [])
  if (!Array.isArray(stored)) return []
  const cutoff = Date.now() - 1000 * 60 * 60 * 48
  return stored.filter((invite) => invite?.id && invite.roomId && invite.toUserId && (invite.createdAt || 0) > cutoff)
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
  const trackIds = Array.isArray(room.trackIds) ? room.trackIds.filter(Boolean) : []
  return {
    ...room,
    members,
    roles,
    requests: Array.isArray(room.requests) ? room.requests : [],
    trackIds,
    code: room.code || roomCode(),
    leader: members.find((id) => roles[id] === 'admin') || members[0] || null,
  }
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
  const tracks = entry.tracks.filter((track) => !isPreviewTrack(track))
  return tracks.length ? tracks : null
}

function cacheSearchEntry(provider, query, limit, tracks) {
  const clean = (tracks || []).filter((track) => !isPreviewTrack(track))
  if (!clean.length) return
  streamCache.searches[`${provider}:${limit}:${normalize(query)}`] = { ts: Date.now(), tracks: clean }
  persistStreamCache()
}

function cachedResolvedStream(seedId) {
  const entry = streamCache.streams[seedId]
  if (!entry?.track || isPreviewTrack(entry.track) || Date.now() - entry.ts > 1000 * 60 * 60 * 12) return null
  return entry.track
}

function cacheResolvedStream(seedId, track) {
  if (!seedId || !track || isPreviewTrack(track)) return
  streamCache.streams[seedId] = { ts: Date.now(), track }
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

const MembersContext = createContext({})

function useMembers() {
  return useContext(MembersContext)
}

function rolesForRoom(room) {
  const matrix = {}
  room.members.forEach((id) => {
    matrix[id] = id === room.dj ? 'admin' : 'listener'
  })
  return matrix
}

function roleMatrixFromRooms(rooms) {
  const matrix = {}
  rooms.forEach((room) => {
    matrix[room.id] = rolesForRoom(room)
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

const LYRIC_EMOJIS = ['❤️', '🔥', '😂', '🎧', '🌙', '✨', '💯', '🫶', '🥹', '🙌', '👀', '🎶', '💫', '😮‍💨']
const REACTION_EMOJIS = ['❤️', '🔥', '👏', '😂', '😮', '🙏']

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

function isPreviewTrack(track) {
  if (!track) return false
  if (track.preview === true) return true
  if (track.fullDuration === 30 || track.quality === '30s') return true
  const stream = String(track.streamUrl || '')
  return /\/(?:preview|30sec|30s)[/.]/i.test(stream) || /\.m4a\?.*preview/i.test(stream)
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
    if (
      entry &&
      entry.savedAt &&
      now - entry.savedAt < 1000 * 60 * 60 * 10 &&
      entry.track?.streamUrl &&
      !isPreviewTrack(entry.track)
    ) {
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
      ? { ...seed, ...cached, id: seed.id, preview: false, status: 'ready' }
      : { ...seed, status: 'pending', streamUrl: null }
  })
  Object.values(cache).forEach((track) => {
    if (!track?.id || SEED_BY_ID[track.id] || isPreviewTrack(track)) return
    library[track.id] = { ...track, preview: false, status: 'ready' }
  })
  return library
}

function saveLibraryEntry(id, track) {
  if (!id || !track || isPreviewTrack(track)) return
  const cache = readStorage(LIBRARY_CACHE_KEY, {})
  cache[id] = { savedAt: Date.now(), track }
  writeStorage(LIBRARY_CACHE_KEY, cache)
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

function pickSaavnDownload(downloads = []) {
  const order = streamQuality === 'saver'
    ? ['96kbps', '160kbps', '320kbps']
    : streamQuality === 'normal'
      ? ['160kbps', '320kbps', '96kbps']
      : ['320kbps', '160kbps', '96kbps']
  for (const quality of order) {
    const found = downloads.find((item) => item.quality === quality)
    if (found?.url) return found
  }
  return downloads[downloads.length - 1]
}

function normalizeSaavn(raw) {
  const downloads = Array.isArray(raw.downloadUrl) ? raw.downloadUrl : []
  const images = Array.isArray(raw.image) ? raw.image : []
  const stream = pickSaavnDownload(downloads)
  const cover =
    images.find((item) => item.quality === '500x500') ||
    images[images.length - 1]
  const artists = raw.artists?.primary?.map((artist) => artist.name).filter(Boolean)
  const artist =
    (artists && artists.length ? artists.join(', ') : null) ||
    decodeEntities(raw.primaryArtists || raw.artist || 'Unknown artist')
  return {
    id: `jio-${raw.id}`,
    providerId: raw.id,
    provider: 'jiosaavn',
    providerLabel: 'JioSaavn',
    title: decodeEntities(raw.name || 'Unknown track'),
    artist: decodeEntities(artist),
    album: decodeEntities(raw.album?.name || 'Single'),
    duration: Number(raw.duration) || 0,
    streamUrl: stream?.url || null,
    cover: cover?.url || null,
    quality: stream?.quality || '',
  }
}

function normalizeItunes(raw) {
  const art = raw.artworkUrl100 || raw.artworkUrl60 || ''
  const fullDuration = raw.trackTimeMillis ? Math.round(raw.trackTimeMillis / 1000) : 0
  return {
    id: `itunes-${raw.trackId}`,
    provider: 'itunes',
    providerLabel: 'iTunes',
    title: decodeEntities(raw.trackName || 'Unknown track'),
    artist: decodeEntities(raw.artistName || 'Unknown artist'),
    album: decodeEntities(raw.collectionName || 'Single'),
    duration: fullDuration,
    fullDuration,
    preview: false,
    needsHydration: true,
    streamUrl: null,
    cover: art ? art.replace(/\/\d+x\d+bb[^/]*\.(jpg|png)/i, '/600x600bb.jpg').replace('100x100bb', '600x600bb') : null,
    quality: 'metadata',
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

function chooseBest(results, seed) {
  return rankCandidates(results, seed)[0]?.track || null
}

async function hydrateJioTrack(track) {
  if (!track || track.streamUrl || !track.providerId) return track
  const cached = cachedResolvedStream(`jio:${track.providerId}`)
  if (cached) return { ...track, ...cached, cover: track.cover || cached.cover }
  if (Date.now() < saavnBackoffUntil) return track
  for (const base of SAAVN_BASES) {
    try {
      const payload = await fetchJson(`${base}/api/songs/${track.providerId}`, { timeout: 5200 })
      const raw = Array.isArray(payload?.data) ? payload.data[0] : payload?.data?.songs?.[0] || payload?.data
      if (raw?.downloadUrl) {
        const normalized = normalizeSaavn(raw)
        if (normalized.streamUrl) {
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

async function fetchJioSearch(query, limit = 12) {
  const cached = cachedSearchEntry('jio', query, limit)
  if (cached) return cached
  if (Date.now() < saavnBackoffUntil) return []
  for (const base of SAAVN_BASES) {
    try {
      const payload = await fetchJson(
        `${base}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`,
        { timeout: 4200 },
      )
      const results = payload?.data?.results || payload?.data?.songs?.results || []
      if (Array.isArray(results) && results.length) {
        const tracks = results.map(normalizeSaavn)
        cacheSearchEntry('jio', query, limit, tracks)
        return tracks
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
      .filter((track) => track.duration >= 60 && !isPreviewTrack(track))
    cacheSearchEntry('itunes', query, limit, tracks)
    return tracks
  } catch {
    return []
  }
}

function normalizePipedCandidate(item) {
  const videoId = String(item?.url || '').split('v=')[1]?.split('&')[0] || item?.id || ''
  if (!videoId) return null
  return {
    id: `yt-${videoId}`,
    videoId,
    provider: 'youtube',
    providerLabel: 'YouTube Music',
    title: decodeEntities(item.title || 'Unknown video'),
    artist: decodeEntities(item.uploaderName || item.uploader || 'YouTube'),
    album: 'YouTube Music',
    duration: Number(item.duration) || 0,
    streamUrl: null,
    cover: item.thumbnail || null,
    quality: '',
  }
}

function normalizeInvidiousCandidate(item) {
  const videoId = item?.videoId
  if (!videoId) return null
  const thumb = Array.isArray(item.videoThumbnails)
    ? item.videoThumbnails.find((entry) => entry.quality === 'maxresdefault') || item.videoThumbnails[item.videoThumbnails.length - 1]
    : null
  return {
    id: `yt-${videoId}`,
    videoId,
    provider: 'youtube',
    providerLabel: 'YouTube Music',
    title: decodeEntities(item.title || 'Unknown video'),
    artist: decodeEntities(item.author || 'YouTube'),
    album: 'YouTube Music',
    duration: Number(item.lengthSeconds) || 0,
    streamUrl: null,
    cover: thumb?.url || null,
    quality: '',
  }
}

async function searchPiped(query, filter = 'music_songs') {
  for (const base of PIPED_INSTANCES) {
    try {
      const payload = await fetchJson(
        `${base}/search?q=${encodeURIComponent(query)}&filter=${filter}`,
        { timeout: 4600 },
      )
      const items = Array.isArray(payload?.items) ? payload.items : []
      const tracks = items.map(normalizePipedCandidate).filter((track) => track && (!track.duration || track.duration >= 60))
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
      const tracks = items.map(normalizeInvidiousCandidate).filter((track) => track && (!track.duration || track.duration >= 60))
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

async function getYouTubeAudio(videoId) {
  if (!videoId) return null
  const cached = cachedResolvedStream(`yt:${videoId}`)
  if (cached?.streamUrl) return cached
  for (const base of PIPED_INSTANCES) {
    try {
      const payload = await fetchJson(`${base}/streams/${videoId}`, { timeout: 5600 })
      const format = chooseAudioFormat(payload?.audioStreams || [])
      if (format?.url) {
        const result = {
          streamUrl: format.url,
          quality: format.bitrate ? `${Math.round(Number(format.bitrate) / 1000)}k audio` : 'YT audio',
          duration: Number(payload?.duration) || 0,
          cover: payload?.thumbnailUrl || null,
        }
        cacheResolvedStream(`yt:${videoId}`, result)
        return result
      }
    } catch {
      /* try the next instance */
    }
  }
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const payload = await fetchJson(`${base}/api/v1/videos/${videoId}`, { timeout: 5600 })
      const format = chooseAudioFormat(payload?.adaptiveFormats || [])
      if (format?.url) {
        const result = {
          streamUrl: format.url,
          quality: format.bitrate ? `${Math.round(Number(format.bitrate) / 1000)}k audio` : 'YT audio',
          duration: Number(payload?.lengthSeconds) || 0,
          cover: payload?.videoThumbnails?.find((entry) => entry.quality === 'maxresdefault')?.url || null,
        }
        cacheResolvedStream(`yt:${videoId}`, result)
        return result
      }
    } catch {
      /* try the next instance */
    }
  }
  return null
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
          providerLabel: 'YouTube Music',
          youtubeVideoId: candidate.videoId,
          streamUrl: audio.streamUrl,
          duration: candidate.duration || audio.duration || seed.duration,
          cover: seed.cover || candidate.cover || audio.cover || null,
          quality: audio.quality || 'YT audio',
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
      providerLabel: 'YouTube Music',
      youtubeVideoId: fallback.videoId,
      streamUrl: null,
      duration: fallback.duration || seed.duration,
      cover: seed.cover || fallback.cover || null,
      quality: 'YT frame',
      preview: false,
      c1: seed.c1,
      c2: seed.c2,
    }
  }
  return null
}

async function searchEverything(query) {
  const cached = cachedSearchEntry('everything', query, 18)
  if (cached) return cached
  const [jioResult, youtubeResult, itunesResult] = await Promise.allSettled([
    fetchJioSearch(query, 14),
    searchYouTubeCandidates(query),
    fetchItunesSearch(query, 12),
  ])
  const jio = jioResult.status === 'fulfilled' ? jioResult.value : []
  const youtube = youtubeResult.status === 'fulfilled' ? youtubeResult.value : []
  const itunes = itunesResult.status === 'fulfilled' ? itunesResult.value : []
  const seen = new Set()
  const combined = []
  ;[...jio, ...youtube.slice(0, 8), ...itunes].forEach((track) => {
    if (!track || isPreviewTrack(track) || !isFullLengthTrack(track)) return
    const key = `${normalize(track.title)}::${normalize(track.artist)}`
    if (seen.has(key)) return
    seen.add(key)
    combined.push(track)
  })
  const result = combined.slice(0, 18)
  cacheSearchEntry('everything', query, 18, result)
  return result
}

function isFullLengthTrack(track) {
  if (!track) return false
  if (isPreviewTrack(track)) return false
  const seconds = Number(track.duration) || 0
  return !seconds || seconds >= 60
}

async function resolveFullTrack(candidate) {
  if (!candidate) return null
  const cached = cachedResolvedStream(candidate.id)
  if (cached && (cached.streamUrl || cached.youtubeVideoId)) {
    return { ...candidate, ...cached, id: candidate.id, preview: false, needsHydration: false, status: 'ready' }
  }
  const seed = SEED_BY_ID[candidate.id]
  if (seed) {
    const resolved = await resolveSeed(seed)
    return { ...candidate, ...resolved, id: candidate.id, preview: false, needsHydration: false, status: 'ready' }
  }
  const target = { ...candidate, preview: false, needsHydration: true }
  if (target.provider === 'jiosaavn') {
    const hydrated = target.streamUrl && !isPreviewTrack(target) ? target : await hydrateJioTrack(target)
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

  const query = `${target.searchTitle || target.title} ${target.artist || ''}`.trim()
  if (query) {
    const candidates = await fetchJioSearch(query, 16)
    const ranked = rankCandidates(candidates, {
      ...target,
      title: target.searchTitle || target.title,
      duration: target.duration || 180,
    })
    for (const entry of ranked.slice(0, 4)) {
      const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track)
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

  if (target.youtubeVideoId) {
    const audio = await getYouTubeAudio(target.youtubeVideoId)
    if (audio?.streamUrl) {
      const ready = {
        ...target,
        ...audio,
        id: target.id,
        provider: 'youtube',
        providerLabel: 'YouTube Music',
        preview: false,
        needsHydration: false,
        status: 'ready',
      }
      cacheResolvedStream(target.id, ready)
      return ready
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

const resolutionPromises = new Map()

async function resolveSeed(seed) {
  const cached = cachedResolvedStream(seed.id)
  if (cached && (cached.streamUrl || cached.youtubeVideoId)) return { ...cached, id: seed.id }
  if (resolutionPromises.has(seed.id)) return resolutionPromises.get(seed.id)
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
      cacheResolvedStream(seed.id, resolved)
      return resolved
    }

    let candidates = await fetchJioSearch(primaryQuery, 16)
    let ranked = rankCandidates(candidates, seed)
    for (const entry of ranked.slice(0, 3)) {
      const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track)
      if (hydrated?.streamUrl && isFullLengthTrack(hydrated)) return finalize(hydrated)
    }

    const youtube = await resolveYouTubeTrack(seed)
    if (youtube?.streamUrl || youtube?.youtubeVideoId) return finalize(youtube)

    candidates = await fetchJioSearch(searchTitle, 16)
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
    const lines = String(payload.plainLyrics)
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ time: index, text }))
    return {
      type: 'plain',
      plain: payload.plainLyrics,
      lines,
      source: 'LRCLIB',
      instrumental: Boolean(payload.instrumental),
    }
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
    if (!line?.text?.trim()) return
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
    .filter(({ line, index }) => line?.text?.trim() && !results[index].enText)
  if (!missing.length) return results

  const chunks = []
  for (let index = 0; index < missing.length; index += 18) {
    chunks.push(missing.slice(index, index + 18))
  }

  for (const chunk of chunks) {
    const texts = chunk.map(({ line }) => line.text.trim())
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
      title={member.name ? `${member.name} @${member.handle || ''}` : undefined}
    >
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : member.initials}
      {online && <i className="avatar-online" />}
    </span>
  )
}

function AvatarStack({ ids = [], size = 'xs', max = 4 }) {
  const members = useMembers()
  return (
    <div className="avatar-stack">
      {ids.slice(0, max).map((id) => (
        <Avatar key={id} member={members[id]} size={size} />
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
      {provider === 'jiosaavn'
        ? 'JioSaavn'
        : provider === 'itunes'
          ? 'iTunes'
          : provider === 'youtube'
            ? 'YouTube Music'
            : 'Library'}
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
  rooms,
  view,
  onNavigate,
  onSearch,
  onJoinRoom,
  role,
  onInvite,
  likedCount,
  onOpenProfile,
  onCreateRoom,
  onJoinCode,
  onCreatePlaylist,
  playlists,
  onOpenPlaylist,
  onLeaveRoom,
  currentUser,
  inRoom,
}) {
  return (
    <aside className="sidebar">
      <Logo />

      <button className="search-trigger" onClick={onSearch}>
        <Search size={14} />
        <span>Search songs, artists…</span>
        <kbd>⌘K</kbd>
      </button>

      <nav className="side-nav">
        <button className={`nav-item ${view === 'home' || (view === 'room' && !inRoom) ? 'active' : ''}`} onClick={() => onNavigate('home')}>
          <Home />
          <span>Home</span>
        </button>
        <button className={`nav-item ${view === 'rooms' ? 'active' : ''}`} onClick={() => onNavigate('rooms')}>
          <Radio />
          <span>Rooms</span>
          <span className="nav-count">{String(rooms.length).padStart(2, '0')}</span>
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
          <span className="side-label-actions">
            <button onClick={onJoinCode} aria-label="Join room by code"><KeyRound size={12} /></button>
            <button onClick={onCreateRoom} aria-label="Create room"><Plus size={13} /></button>
          </span>
        </div>
        <div className="room-list">
          {rooms.length === 0 && (
            <p className="side-empty">No rooms yet. Start one and invite a friend.</p>
          )}
          {rooms.map((item) => (
            <button
              key={item.id}
              className={`room-link ${inRoom && room.id === item.id && view === 'room' ? 'active' : ''}`}
              style={{ '--room-accent': item.accent }}
              onClick={() => onJoinRoom(item)}
            >
              <span className="room-dot" />
              <span className="room-link-name">{item.name}</span>
              {item.private
                ? <Lock size={9} style={{ opacity: 0.45 }} aria-label="Private room" />
                : <Globe2 size={9} style={{ opacity: 0.3 }} aria-label="Public room" />}
              <Equalizer />
            </button>
          ))}
        </div>
      </div>

      <div className="side-section side-playlists">
        <div className="side-label">
          <span>PLAYLISTS</span>
          <button onClick={onCreatePlaylist} aria-label="Create playlist"><Plus size={13} /></button>
        </div>
        <div className="room-list">
          {playlists.length === 0 && <p className="side-empty">Build your first playlist.</p>}
          {playlists.slice(0, 5).map((playlist) => (
            <button key={playlist.id} className="room-link playlist-link" onClick={() => onOpenPlaylist(playlist)}>
              <ListMusic size={12} />
              <span className="room-link-name">{playlist.name}</span>
              <span className="nav-count">{playlist.trackIds.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="side-bottom">
        {inRoom ? (
          <div className="invite-card">
            <strong>Listening is better together.</strong>
            <p>Code <b>{room.code}</b> · playback stays in lockstep.</p>
            <button onClick={onInvite}><UserPlus size={11} /> Copy invite link</button>
            <button className="leave-room-btn" onClick={onLeaveRoom}><DoorOpen size={11} /> Leave room</button>
          </div>
        ) : (
          <div className="invite-card">
            <strong>Start a listening room.</strong>
            <p>Bring your queue to a friend. Everyone hears the same beat.</p>
            <button onClick={onCreateRoom}><Plus size={11} /> Create a room</button>
          </div>
        )}
        <button className="profile" onClick={onOpenProfile}>
          <Avatar member={currentUser} online />
          <span className="profile-meta">
            <strong>{currentUser?.name || 'Sign in'}</strong>
            <span>@{currentUser?.handle || 'guest'} · {inRoom ? <><Crown size={10} /> {role}</> : 'Solo listening'}</span>
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
  inRoom,
  theme,
  onToggleTheme,
  onSearch,
  onToggleChat,
  chatOpen,
  onHome,
  currentUser,
  onOpenProfile,
  onLogin,
  onSignUp,
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
        {inRoom ? (
          <span className="live-pill"><span className="live-dot" /> LIVE</span>
        ) : (
          <span className="live-pill solo-pill"><Headphones size={9} /> SOLO</span>
        )}
        <ChevronRight />
        <strong>{view === 'rooms' ? 'All rooms' : view === 'library' ? 'Your library' : view === 'room' && inRoom ? room.name : 'Home'}</strong>
      </div>

      <div className="stage-actions">
        {!currentUser && (
          <div className="guest-actions">
            <button className="text-btn guest-login" onClick={onLogin}>Log in</button>
            <button className="primary-btn guest-signup" onClick={onSignUp}>Sign up</button>
          </div>
        )}
        <button className="icon-btn account-mobile" onClick={onOpenProfile} aria-label="Account and profile">
          <Avatar member={currentUser} />
        </button>
        <button className="icon-btn" onClick={onSearch} aria-label="Search">
          <Search />
        </button>
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        {inRoom && (
          <button className={`icon-btn chat-desktop-toggle ${chatOpen ? 'active' : ''}`} onClick={onToggleChat} aria-label="Toggle room chat">
            <MessageCircle />
          </button>
        )}
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
  duckLevel = 20,
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
          {ducked ? `Music ducked to ${duckLevel}%` : 'Voice detected'}
        </span>
      )}
      <span className="voice-note"><Lock size={8} /> Private room · live voice</span>
    </div>
  )
}

function RoomsView({ rooms, library, currentRoom, onJoin, onCreate, onJoinCode }) {
  return (
    <div className="rooms-view">
      <div className="eyebrow">
        <span className="live-pill"><Radio size={9} /> DISCOVER</span>
        <span className="seg" />
        <span>{String(rooms.length).padStart(2, '0')} ROOMS LIVE</span>
        <span className="grow" />
        <button className="text-btn" onClick={onJoinCode}><KeyRound size={11} /> Join with code</button>
      </div>
      <h1 className="page-title">Find your <em>frequency.</em></h1>
      <p className="page-sub">Small rooms, shared speakers, and a queue that moves together. Start one, invite a friend, or join with a code.</p>

      <div className="rooms-grid">
        <button className="room-card create-room-card" onClick={onCreate}>
          <div className="rc-create-glyph"><Plus /></div>
          <h2 className="rc-title">Start a room</h2>
          <p className="rc-sub">Pick a vibe, invite the room, and become its Admin.</p>
          <div className="rc-foot">
            <span className="rc-join"><UsersRound size={11} /> Create listening room</span>
          </div>
        </button>
        {rooms.map((room) => {
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
                {room.private
                  ? <span className="rc-private"><Lock size={9} /> Private</span>
                  : <span className="rc-public"><Globe2 size={9} /> Public</span>}
                <span className="rc-listeners">{room.members.length} in the room</span>
              </div>
              <h2 className="rc-title">{room.name}</h2>
              <p className="rc-sub">{room.tagline}</p>
              <div className="rc-foot">
                <AvatarStack ids={room.members} size="xs" max={3} />
                <span>{room.members.length} member{room.members.length === 1 ? '' : 's'}</span>
                <span className="rc-join"><Headphones size={11} /> {currentRoom && room.id === currentRoom.id ? 'You’re here' : 'Join room'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HomeView({
  currentUser,
  library,
  liked,
  recentIds,
  playlists,
  onPlayTrack,
  onPlayPlaylist,
  onLike,
  onSearch,
  onCreatePlaylist,
  onOpenPlaylist,
  onCreateRoom,
  onJoinCode,
  roomCount,
}) {
  const featured = SEED_TRACKS.map((seed) => library[seed.id] || seed)
  const recent = recentIds.map((id) => library[id]).filter(Boolean).slice(0, 8)
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()
  const heroCovers = featured.slice(0, 4)
  return (
    <div className="home-view">
      <section className="solo-hero">
        <div className="solo-hero-copy">
          <div className="eyebrow">
            <span className="live-pill solo-pill"><Headphones size={9} /> SOLO LISTENING</span>
            <span className="seg" />
            <span>FULL CONTROL</span>
          </div>
          <h1 className="page-title">{greeting}, <em>{currentUser?.name?.split(' ')[0] || 'listener'}.</em></h1>
          <p className="page-sub">Your music, your rules. Press play, build a playlist, or open the door to a live room whenever you want company.</p>
          <div className="solo-actions">
            <button className="primary-btn" onClick={() => onPlayTrack(featured[0])}><Play /> Play something</button>
            <button className="text-btn" onClick={() => onPlayTrack(featured[Math.floor(Math.random() * featured.length)])}><Shuffle size={13} /> Shuffle</button>
            <button className="text-btn" onClick={onCreateRoom}><Radio size={13} /> Create room</button>
            <button className="text-btn" onClick={onJoinCode}><KeyRound size={13} /> Join with code</button>
          </div>
          <div className="solo-stats">
            <span><b>{liked.length}</b> liked songs</span>
            <span><b>{playlists.length}</b> playlists</span>
            <span><b>{roomCount}</b> live rooms</span>
          </div>
        </div>
        <div className="solo-hero-art">
          {heroCovers.map((track, index) => (
            <Cover key={track.id} track={track} size="" className={`hero-tile tile-${index}`} playing={index === 0} />
          ))}
          <span className="hero-orbit" />
          <span className="hero-orbit second" />
        </div>
      </section>

      {recent.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <div><h3>Recently played</h3><p>Pick up right where you left off.</p></div>
            <span className="source-badge">{recent.length} tracks</span>
          </div>
          <div className="home-rail">
            {recent.map((track) => (
              <button key={track.id} className="home-tile" onClick={() => onPlayTrack(track)}>
                <Cover track={track} size="" playing />
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="section-head">
          <div><h3>Trending on EchoSync</h3><p>Full-length streams across every language.</p></div>
          <div className="head-actions"><button className="text-btn" onClick={onSearch}><Search /> Search catalogue</button></div>
        </div>
        <div className="home-grid">
          {featured.slice(0, 10).map((track) => (
            <div key={track.id} className="home-card">
              <button className="home-card-art" onClick={() => onPlayTrack(track)} aria-label={`Play ${track.title}`}>
                <Cover track={track} size="" />
                <span className="home-card-play"><Play /></span>
              </button>
              <div className="home-card-copy">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </div>
              <button
                className={`queue-heart ${liked.includes(track.id) ? 'liked' : ''}`}
                onClick={() => onLike(track.id)}
                aria-label="Like track"
              >
                <Heart />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <div><h3>Your playlists</h3><p>Collections for every version of you.</p></div>
          <div className="head-actions"><button className="text-btn" onClick={onCreatePlaylist}><Plus /> New playlist</button></div>
        </div>
        {playlists.length === 0 ? (
          <button className="playlist-create-card" onClick={onCreatePlaylist}>
            <ListPlus />
            <strong>Make your first playlist</strong>
            <span>Name it, add songs, make it yours.</span>
          </button>
        ) : (
          <div className="playlist-grid">
            {playlists.map((playlist) => {
              const covers = playlist.trackIds.map((id) => library[id]).filter(Boolean).slice(0, 4)
              return (
                <button key={playlist.id} className="playlist-card" onClick={() => onOpenPlaylist(playlist)}>
                  <div className="playlist-mosaic">
                    {covers.length ? covers.map((cover) => (
                      <span key={cover.id} style={cover.cover ? { backgroundImage: `url(${cover.cover})` } : { background: `linear-gradient(135deg, ${cover.c1}, ${cover.c2})` }} />
                    )) : <span className="mosaic-empty"><Music2 /></span>}
                  </div>
                  <strong>{playlist.name}</strong>
                  <span>{playlist.trackIds.length} track{playlist.trackIds.length === 1 ? '' : 's'}</span>
                  <em onClick={(event) => { event.stopPropagation(); onPlayPlaylist(playlist) }} role="button" tabIndex={0}>
                    <Play size={11} /> Play
                  </em>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function LibraryView({
  library,
  liked,
  recentIds,
  playlists,
  currentUser,
  activePlaylistId,
  onSelectPlaylist,
  onPlay,
  onLike,
  onSearch,
  onCreatePlaylist,
  onPlayPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onRemoveFromPlaylist,
  onShufflePlaylist,
  onOpenPlaylist,
}) {
  const [tab, setTab] = useState('playlists')
  const likedTracks = liked.map((id) => library[id]).filter(Boolean)
  const recent = recentIds.map((id) => library[id]).filter(Boolean)
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) || null
  const playlistTracks = activePlaylist ? activePlaylist.trackIds.map((id) => library[id]).filter(Boolean) : []

  useEffect(() => {
    if (activePlaylistId) setTab('playlists')
  }, [activePlaylistId])

  return (
    <div className="library-view">
      <div className="eyebrow">
        <span className="live-pill"><Library size={9} /> YOUR LIBRARY</span>
        <span className="seg" />
        <span>{playlists.length} PLAYLISTS · {likedTracks.length} LIKED</span>
      </div>
      <h1 className="page-title">Everything that sounds like <em>you.</em></h1>
      <p className="page-sub">Your playlists, your liked songs, and the music you keep returning to. All in one place.</p>

      {activePlaylist ? (
        <section className="playlist-detail">
          <div className="playlist-detail-head">
            <div className="playlist-mosaic large">
              {playlistTracks.slice(0, 4).map((cover) => (
                <span key={cover.id} style={cover.cover ? { backgroundImage: `url(${cover.cover})` } : { background: `linear-gradient(135deg, ${cover.c1}, ${cover.c2})` }} />
              ))}
              {!playlistTracks.length && <span className="mosaic-empty"><ListMusic /></span>}
            </div>
            <div className="playlist-detail-copy">
              <span className="eyebrow"><span className="seg" /> PLAYLIST</span>
              <h2>{activePlaylist.name}</h2>
              <p>{activePlaylist.description || `Made by ${currentUser?.name || 'you'} · ${playlistTracks.length} track${playlistTracks.length === 1 ? '' : 's'}`}</p>
              <div className="playlist-detail-actions">
                <button className="primary-btn" onClick={() => onPlayPlaylist(activePlaylist)} disabled={!playlistTracks.length}><Play /> Play</button>
                <button className="text-btn" onClick={() => onShufflePlaylist(activePlaylist)} disabled={!playlistTracks.length}><Shuffle size={12} /> Shuffle</button>
                <button className="text-btn" onClick={() => onRenamePlaylist(activePlaylist)}><Pencil size={12} /> Edit</button>
                <button className="text-btn danger-btn" onClick={() => onDeletePlaylist(activePlaylist)}><Trash2 size={12} /> Delete</button>
                <button className="text-btn ghosted" onClick={() => onSelectPlaylist(null)}><X size={12} /> Close</button>
              </div>
            </div>
          </div>
          <div className="library-list">
            {playlistTracks.length === 0 ? (
              <div className="library-empty">
                <ListMusic />
                <h4>This playlist is waiting</h4>
                <p>Search for a song and use “Add to playlist”.</p>
                <button className="text-btn" onClick={onSearch}><Search size={12} /> Find songs</button>
              </div>
            ) : playlistTracks.map((track, index) => (
              <div className="library-row" key={track.id} role="button" tabIndex={0} onClick={() => onPlay(track)}>
                <span className="num">{String(index + 1).padStart(2, '0')}</span>
                <Cover track={track} size="cover-size-sm" />
                <div className="queue-copy">
                  <strong>{track.title}</strong>
                  <span>{track.artist}{track.providerLabel ? ` · ${track.providerLabel}` : ''}</span>
                </div>
                <span className="album">{track.album || 'Single'}</span>
                <span className="dur">{formatTime(track.duration)}</span>
                <button
                  className="queue-heart"
                  onClick={(event) => { event.stopPropagation(); onRemoveFromPlaylist(activePlaylist.id, track.id) }}
                  aria-label="Remove from playlist"
                  title="Remove from playlist"
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="library-tabs">
            <button className={tab === 'playlists' ? 'active' : ''} onClick={() => setTab('playlists')}><ListMusic /> Playlists</button>
            <button className={tab === 'liked' ? 'active' : ''} onClick={() => setTab('liked')}><Heart /> Liked songs</button>
            <button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}><Clock3 /> Recently played</button>
            <span className="grow" />
            <button className="text-btn" onClick={onCreatePlaylist}><Plus /> New playlist</button>
          </div>

          {tab === 'playlists' && (
            playlists.length === 0 ? (
              <div className="library-empty">
                <ListMusic />
                <h4>No playlists yet</h4>
                <p>Create one and start collecting the songs that matter.</p>
                <button className="primary-btn" onClick={onCreatePlaylist}><Plus /> Create playlist</button>
              </div>
            ) : (
              <div className="playlist-grid library-grid">
                {playlists.map((playlist) => {
                  const covers = playlist.trackIds.map((id) => library[id]).filter(Boolean).slice(0, 4)
                  return (
                    <button key={playlist.id} className="playlist-card" onClick={() => onOpenPlaylist(playlist)}>
                      <div className="playlist-mosaic">
                        {covers.length ? covers.map((cover) => (
                          <span key={cover.id} style={cover.cover ? { backgroundImage: `url(${cover.cover})` } : { background: `linear-gradient(135deg, ${cover.c1}, ${cover.c2})` }} />
                        )) : <span className="mosaic-empty"><Music2 /></span>}
                      </div>
                      <strong>{playlist.name}</strong>
                      <span>{playlist.trackIds.length} track{playlist.trackIds.length === 1 ? '' : 's'}</span>
                      <em onClick={(event) => { event.stopPropagation(); onPlayPlaylist(playlist) }} role="button" tabIndex={0}>
                        <Play size={11} /> Play
                      </em>
                    </button>
                  )
                })}
              </div>
            )
          )}

          {tab === 'liked' && (
            <div className="library-list">
              {likedTracks.length === 0 ? (
                <div className="library-empty">
                  <Music2 />
                  <h4>Your liked songs live here</h4>
                  <p>Tap the heart on any song to save it.</p>
                  <button className="text-btn" onClick={onSearch}><Search size={12} /> Find something new</button>
                </div>
              ) : likedTracks.map((track, index) => (
                <div className="library-row" key={track.id} role="button" tabIndex={0} onClick={() => onPlay(track)}>
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <Cover track={track} size="cover-size-sm" />
                  <div className="queue-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}{track.providerLabel ? ` · ${track.providerLabel}` : ''}</span>
                  </div>
                  <span className="album">{track.album || 'Single'}</span>
                  <span className="dur">{formatTime(track.duration)}</span>
                  <button className="queue-heart liked" onClick={(event) => { event.stopPropagation(); onLike(track.id) }} aria-label="Unlike track">
                    <Heart />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'recent' && (
            <div className="library-list">
              {recent.length === 0 ? (
                <div className="library-empty">
                  <Clock3 />
                  <h4>Nothing played yet</h4>
                  <p>Songs you play will show up here.</p>
                  <button className="text-btn" onClick={onSearch}><Search size={12} /> Play something</button>
                </div>
              ) : recent.map((track, index) => (
                <div className="library-row" key={`${track.id}-${index}`} role="button" tabIndex={0} onClick={() => onPlay(track)}>
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <Cover track={track} size="cover-size-sm" />
                  <div className="queue-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                  </div>
                  <span className="album">{track.album || 'Single'}</span>
                  <span className="dur">{formatTime(track.duration)}</span>
                  <button className={`queue-heart ${liked.includes(track.id) ? 'liked' : ''}`} onClick={(event) => { event.stopPropagation(); onLike(track.id) }} aria-label="Like track">
                    <Heart />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
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
  translateOn = false,
  translating = false,
  onToggleTranslate,
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
          <div className="plain-lyrics">
            {(lyrics.lines || []).map((line, index) => {
              const translated = translateOn && line.enText && line.enText.toLowerCase() !== line.text.trim().toLowerCase()
                ? line.enText
                : null
              return (
                <div className={`plain-line ${translated ? 'translated' : ''}`} key={`${line.time}-${index}`}>
                  {translated ? (
                    <span className="lyric-dual">
                      <span className="lyric-en">{translated}</span>
                      <span className="lyric-orig">{line.text}</span>
                    </span>
                  ) : line.text}
                </div>
              )
            })}
          </div>
        )}

        {lyrics?.status === 'ready' && lyrics.type === 'synced' && (
          <>
            {lyrics.lines.map((line, index) => {
              const translated = translateOn && line.enText && line.enText.toLowerCase() !== line.text.trim().toLowerCase()
                ? line.enText
                : null
              return (
                <button
                  key={`${line.time}-${index}`}
                  className={`lyric-line ${index === activeIndex ? 'active' : ''} ${translated ? 'translated' : ''}`}
                  data-lyric-index={index}
                  onClick={() => seekLine(line)}
                  title={translated ? line.text : undefined}
                >
                  <span className="lyric-time">{formatTime(line.time)}</span>
                  {translated ? (
                    <span className="lyric-dual">
                      <span className="lyric-en">{translated}</span>
                      <span className="lyric-orig">{line.text}</span>
                    </span>
                  ) : line.text}
                </button>
              )
            })}
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
            : lyrics?.status === 'ready' && lyrics.type === 'plain'
              ? `${lyrics.lines?.length || 0} lines · plain`
              : lyrics?.status === 'loading'
                ? 'finding words…'
                : lyrics?.status === 'error'
                  ? 'unavailable'
                  : 'time-synced lyrics'}
        </span>
        {lyrics?.status === 'ready' && lyrics.lines?.length > 0 && onToggleTranslate && (
          <button
            className={`translate-btn ${translateOn ? 'on' : ''}`}
            onClick={onToggleTranslate}
            disabled={translating}
          >
            {translating ? <span className="spinner" /> : <Globe />}
            {translating ? 'Translating lyrics to English…' : translateOn ? 'Showing English' : 'Translate to English'}
          </button>
        )}
        <button className={`auto-toggle ${autoScroll ? 'on' : ''}`} onClick={() => setAutoScroll((value) => !value)}>
          <Sparkles />
          {pausedHint && autoScroll ? 'Paused' : autoScroll ? 'Auto' : 'Manual'}
        </button>
      </div>
    </div>
  )
}

function ModalShell({ children, onClose, size = '' }) {
  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}

function AuthModal({ mode, reason, notice, pendingRoom, onClose, onSwitch, onSignIn, onSignUp }) {
  const [form, setForm] = useState({ email: '', username: '', identifier: '', password: '' })
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
  }, [mode])

  const submit = (event) => {
    event.preventDefault()
    setError('')
    const result = mode === 'signin'
      ? onSignIn({ identifier: form.identifier, password: form.password, remember })
      : onSignUp({
        email: form.email,
        username: form.username,
        handle: form.username,
        password: form.password,
        remember,
      })
    if (result?.error) setError(result.error)
  }

  const switching = mode === 'signin' ? 'signup' : 'signin'

  return (
    <ModalShell onClose={onClose} size="modal-auth">
      <div className="auth-modal-head">
        <div className="auth-mark"><Headphones /></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close sign in"><X /></button>
      </div>
      <div className="auth-modal-copy">
        <span className="eyebrow"><span className="seg" /> {mode === 'signin' ? 'WELCOME BACK' : 'THREE FIELDS. THAT’S IT.'}</span>
        <h2>{mode === 'signin' ? 'Sign in to EchoSync' : 'Create your listening account'}</h2>
        <p>{reason || (mode === 'signin' ? 'Your library, rooms, and queue pick up where you left off.' : 'No display-name theatre. Pick a handle, add your email, and listen.')}</p>
      </div>

      {(pendingRoom || notice) && (
        <div className="auth-invite-note">
          <Radio size={13} />
          <span>{pendingRoom ? <>Room <b>{pendingRoom}</b> is waiting. Sign in and we’ll take you straight in.</> : notice}</span>
        </div>
      )}

      <div className="auth-switch auth-switch-top">
        <button className={mode === 'signin' ? 'active' : ''} onClick={() => onSwitch('signin')}>Log in</button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => onSwitch('signup')}>Sign up</button>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' ? (
          <>
            <label className="field">
              <span>Email</span>
              <div className="field-with-icon">
                <Mail />
                <input
                  type="email"
                  name="email"
                  data-testid="signup-email"
                  value={form.email}
                  onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </label>
            <label className="field">
              <span>Username</span>
              <div className="field-with-icon handle-field">
                <AtSign />
                <input
                  name="username"
                  data-testid="signup-username"
                  value={form.username}
                  onChange={(event) => setForm((value) => ({ ...value, username: slugifyHandle(event.target.value) }))}
                  placeholder="your.handle"
                  autoComplete="username"
                  required
                />
              </div>
              <small className="field-hint">Your handle will be @{form.username || 'your.handle'}</small>
            </label>
            <label className="field">
              <span>Password</span>
              <div className="field-with-icon">
                <Lock />
                <input
                  type="password"
                  name="password"
                  data-testid="signup-password"
                  value={form.password}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  placeholder="At least 4 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Email or username</span>
              <div className="field-with-icon">
                <AtSign />
                <input
                  name="identifier"
                  data-testid="login-identifier"
                  value={form.identifier}
                  onChange={(event) => setForm((value) => ({ ...value, identifier: event.target.value }))}
                  placeholder="you@gmail.com or your.handle"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </label>
            <label className="field">
              <span>Password</span>
              <div className="field-with-icon">
                <Lock />
                <input
                  type="password"
                  name="password"
                  data-testid="login-password"
                  value={form.password}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>
          </>
        )}

        <label className="remember-row">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>Remember me on this device</span>
        </label>

        {error && <span className="auth-error"><AlertCircle size={12} /> {error}</span>}

        <button className="primary-btn full" type="submit">
          <KeyRound />
          {mode === 'signin' ? 'Log in' : 'Create account'}
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="auth-switch auth-switch-bottom">
        <span>{mode === 'signin' ? 'New to EchoSync?' : 'Already have an account?'}</span>
        <button onClick={() => onSwitch(switching)}>{mode === 'signin' ? 'Create an account' : 'Log in'}</button>
      </div>

      <p className="auth-legal">By continuing you agree to keep the aux cord democratic.</p>
    </ModalShell>
  )
}

function SettingsModal({
  user,
  settings,
  stats,
  cacheInfo,
  onClose,
  onSaveProfile,
  onSaveSettings,
  onClearCache,
  onSignOut,
}) {
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({
    handle: user.handle || '',
    email: user.email || '',
    showActivity: user.showActivity !== false,
    allowInvites: user.allowInvites !== false,
  })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [audio, setAudio] = useState(settings)
  const [profileError, setProfileError] = useState('')

  const preview = accountDisplay({
    ...user,
    name: displayNameFromHandle(form.handle || user.handle),
    handle: form.handle || user.handle,
    initials: initials(displayNameFromHandle(form.handle || user.handle)),
  })

  const submitProfile = (event) => {
    event.preventDefault()
    const result = onSaveProfile({
      name: displayNameFromHandle(form.handle),
      handle: form.handle,
      email: form.email,
      showActivity: form.showActivity,
      allowInvites: form.allowInvites,
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    })
    if (result?.error) setProfileError(result.error)
    else {
      setProfileError('')
      setPasswords({ currentPassword: '', newPassword: '' })
    }
  }

  const saveAudio = () => {
    onSaveSettings(audio)
  }

  return (
    <ModalShell onClose={onClose} size="modal-settings">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> SETTINGS</span>
          <h2>Your account & listening</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close settings"><X /></button>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRoundPlus /> Profile</button>
          <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><SlidersHorizontal /> Audio & playback</button>
          <button className={tab === 'social' ? 'active' : ''} onClick={() => setTab('social')}><UsersRound /> Social & privacy</button>
          <button className={tab === 'storage' ? 'active' : ''} onClick={() => setTab('storage')}><HardDrive /> Storage & cache</button>
          <span className="grow" />
          <button className="signout-btn" onClick={onSignOut}><LogOut /> Sign out</button>
        </nav>

        <div className="settings-body">
          {tab === 'profile' && (
            <form className="profile-form" onSubmit={submitProfile}>
              <div className="profile-top settings-profile-top">
                <Avatar member={preview} size="avatar-xl" online />
                <div>
                  <strong>{preview.name}</strong>
                  <span>@{preview.handle} · {preview.email}</span>
                  <small>Your initials stay your badge. No avatar uploads, no bio.</small>
                </div>
              </div>
              <div className="profile-stats">
                <span><b>{stats.playlists}</b>Playlists created</span>
                <span><b>{stats.liked}</b>Liked songs</span>
                <span><b>{stats.rooms}</b>Rooms hosted</span>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Username</span>
                  <input value={form.handle} onChange={(event) => setForm((value) => ({ ...value, handle: slugifyHandle(event.target.value) }))} placeholder="your.handle" autoComplete="username" />
                </label>
                <label className="field">
                  <span>Email address</span>
                  <input type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} autoComplete="email" />
                </label>
              </div>
              <div className="settings-subhead">
                <strong>Change password</strong>
                <span>Leave both fields empty to keep your current password.</span>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Current password</span>
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(event) => setPasswords((value) => ({ ...value, currentPassword: event.target.value }))}
                    placeholder="Current password"
                    autoComplete="current-password"
                  />
                </label>
                <label className="field">
                  <span>New password</span>
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) => setPasswords((value) => ({ ...value, newPassword: event.target.value }))}
                    placeholder="At least 4 characters"
                    autoComplete="new-password"
                  />
                </label>
              </div>
              {profileError && <span className="auth-error"><AlertCircle size={12} /> {profileError}</span>}
              <div className="modal-actions">
                <button type="button" className="text-btn ghosted" onClick={onSignOut}><LogOut size={12} /> Sign out</button>
                <button type="submit" className="primary-btn"><Save size={12} /> Save profile</button>
              </div>
            </form>
          )}

          {tab === 'audio' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Audio & playback</h3>
                <p>Built for full-length streams, not 30-second compromises.</p>
              </div>
              <label className="field">
                <span>Streaming quality</span>
                <select value={audio.quality} onChange={(event) => setAudio((value) => ({ ...value, quality: event.target.value }))}>
                  <option value="high">High — 320 kbps</option>
                  <option value="normal">Normal — 160 kbps</option>
                  <option value="saver">Data saver — 96 kbps</option>
                </select>
              </label>
              <div className="setting-toggle-row">
                <div>
                  <strong>Crossfade</strong>
                  <span>Ease between tracks instead of a hard cut.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.crossfade ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, crossfade: !value.crossfade }))}
                  aria-label="Toggle crossfade"
                >
                  <span />
                </button>
              </div>
              <label className="field">
                <span>Crossfade length · {audio.crossfadeSeconds}s</span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={audio.crossfadeSeconds}
                  onChange={(event) => setAudio((value) => ({ ...value, crossfadeSeconds: Number(event.target.value) }))}
                  disabled={!audio.crossfade}
                />
              </label>
              <div className="setting-toggle-row">
                <div>
                  <strong>Gapless playback</strong>
                  <span>Keep continuous albums continuous.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.gapless ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, gapless: !value.gapless }))}
                  aria-label="Toggle gapless playback"
                >
                  <span />
                </button>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Volume normalisation</strong>
                  <span>Even out loud and quiet masters.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.normalization ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, normalization: !value.normalization }))}
                  aria-label="Toggle volume normalisation"
                >
                  <span />
                </button>
              </div>
              <label className="field">
                <span>Rave mic ducking level</span>
                <select value={audio.duckLevel} onChange={(event) => setAudio((value) => ({ ...value, duckLevel: Number(event.target.value) }))}>
                  <option value={15}>15% — subtle</option>
                  <option value={20}>20% — balanced</option>
                  <option value={35}>35% — voice forward</option>
                </select>
              </label>
              <div className="modal-actions">
                <button className="primary-btn" onClick={saveAudio}><Save size={12} /> Save preferences</button>
              </div>
            </div>
          )}

          {tab === 'social' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Social & privacy</h3>
                <p>You decide who gets to share your listening.</p>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Show my listening activity</strong>
                  <span>Let friends see when you’re in a room.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${form.showActivity ? 'on' : ''}`}
                  onClick={() => setForm((value) => ({ ...value, showActivity: !value.showActivity }))}
                  aria-label="Toggle listening activity"
                >
                  <span />
                </button>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Allow direct room invites from anyone</strong>
                  <span>Turn off to only receive invites from people you know.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${form.allowInvites ? 'on' : ''}`}
                  onClick={() => setForm((value) => ({ ...value, allowInvites: !value.allowInvites }))}
                  aria-label="Toggle direct room invites"
                >
                  <span />
                </button>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Auto-translate lyrics by default</strong>
                  <span>Non-English songs open with English lyrics underneath.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.autoTranslate ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, autoTranslate: !value.autoTranslate }))}
                  aria-label="Toggle auto-translate lyrics"
                >
                  <span />
                </button>
              </div>
              <div className="modal-actions">
                <button
                  className="primary-btn"
                  onClick={() => {
                    const result = onSaveProfile({ ...form })
                    if (result?.error) setProfileError(result.error)
                    onSaveSettings(audio)
                  }}
                >
                  <Save size={12} /> Save privacy
                </button>
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Storage & cache</h3>
                <p>Resolved streams, lyrics, and translations live on this device.</p>
              </div>
              <div className="cache-grid">
                <div><HardDrive /><strong>{cacheInfo.size}</strong><span>Total cache size</span></div>
                <div><AudioLines /><strong>{cacheInfo.streams}</strong><span>Cached streams</span></div>
                <div><Languages /><strong>{cacheInfo.translations}</strong><span>Translated tracks</span></div>
              </div>
              <p className="settings-note">Clearing the cache also resets the JioSaavn backoff timer, so the next play tries the full-length engine immediately.</p>
              <div className="settings-actions-row">
                <button className="text-btn danger-btn" onClick={onClearCache}><Trash2 size={12} /> Clear stream & lyrics cache</button>
                <span className="grow" />
                <button className="text-btn ghosted" onClick={onSignOut}><LogOut size={12} /> Sign out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function PlaylistModal({ mode, playlist, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: playlist?.name || '',
    description: playlist?.description || '',
  })
  return (
    <ModalShell onClose={onClose} size="modal-playlist">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {mode === 'edit' ? 'EDIT PLAYLIST' : 'NEW PLAYLIST'}</span>
          <h2>{mode === 'edit' ? 'Make it feel right' : 'A new collection'}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close playlist"><X /></button>
      </div>
      <form
        className="modal-body"
        onSubmit={(event) => {
          event.preventDefault()
          if (!form.name.trim()) return
          onSubmit({ name: form.name.trim(), description: form.description.trim() })
        }}
      >
        <label className="field">
          <span>Playlist name</span>
          <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Late night, full volume" autoFocus />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={3} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="What is this playlist for?" />
        </label>
        <div className="modal-actions">
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit">{mode === 'edit' ? <Save size={12} /> : <Plus size={12} />} {mode === 'edit' ? 'Save playlist' : 'Create playlist'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function JoinRoomModal({ onClose, onJoin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onClose} size="modal-join">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> JOIN A ROOM</span>
          <h2>Enter the room code</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close join room"><X /></button>
      </div>
      <form
        className="modal-body"
        onSubmit={(event) => {
          event.preventDefault()
          const result = onJoin(code)
          if (result?.error) setError(result.error)
        }}
      >
        <div className="join-code-art"><KeyRound /></div>
        <p className="join-hint">Ask the host for their <b>ES-####</b> code, or open their invite link. You’ll join as a Listener.</p>
        <label className="field">
          <span>Room code</span>
          <input value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError('') }} placeholder="ES-4829" autoFocus />
        </label>
        {error && <span className="auth-error"><AlertCircle size={12} /> {error}</span>}
        <div className="modal-actions">
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit"><DoorOpen size={12} /> Join room</button>
        </div>
      </form>
    </ModalShell>
  )
}

function PasscodeModal({ room, onClose, onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onClose} size="modal-join">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> PRIVATE ROOM</span>
          <h2>{room?.name || 'Locked room'}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close passcode"><X /></button>
      </div>
      <form
        className="modal-body"
        onSubmit={(event) => {
          event.preventDefault()
          const result = onUnlock(code)
          if (result?.error) setError(result.error)
        }}
      >
        <div className="join-code-art private-code-art"><Lock /></div>
        <p className="join-hint">This room is private. Enter its <b>ES-XXXX</b> passcode, or open the host’s invite link.</p>
        <label className="field">
          <span>Room passcode</span>
          <input
            value={code}
            onChange={(event) => { setCode(event.target.value.toUpperCase()); setError('') }}
            placeholder="ES-4829"
            autoFocus
            data-testid="private-room-code"
          />
        </label>
        {error && <span className="auth-error"><AlertCircle size={12} /> {error}</span>}
        <div className="modal-actions">
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit"><KeyRound size={12} /> Unlock room</button>
        </div>
      </form>
    </ModalShell>
  )
}

function AddToPlaylistModal({ track, playlists, onClose, onAdd, onCreate }) {
  return (
    <ModalShell onClose={onClose} size="modal-add-playlist">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> ADD TO PLAYLIST</span>
          <h2>{track?.title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close add to playlist"><X /></button>
      </div>
      <div className="modal-body">
        <button className="new-playlist-row" onClick={() => onCreate(track)}>
          <span className="new-playlist-glyph"><Plus /></span>
          <span><strong>New playlist</strong><small>Create one and add this song</small></span>
        </button>
        <div className="add-playlist-list">
          {playlists.length === 0 && <p className="modal-hint">No playlists yet. Create one above.</p>}
          {playlists.map((playlist) => {
            const added = playlist.trackIds.includes(track?.id)
            return (
              <button key={playlist.id} className={`add-playlist-row ${added ? 'added' : ''}`} onClick={() => onAdd(playlist.id)}>
                <span className="new-playlist-glyph"><ListMusic /></span>
                <span>
                  <strong>{playlist.name}</strong>
                  <small>{playlist.trackIds.length} track{playlist.trackIds.length === 1 ? '' : 's'}</small>
                </span>
                {added ? <span className="added-tag"><Check size={11} /> Added</span> : <Plus size={14} />}
              </button>
            )
          })}
        </div>
      </div>
    </ModalShell>
  )
}

function InviteBanner({ invite, onAccept, onDecline }) {
  if (!invite) return null
  return (
    <div className="live-invite-banner">
      <span className="live-invite-icon"><BellRing /></span>
      <div>
        <strong>🎵 @{invite.fromHandle || 'a listener'} invited you to join room {invite.roomName}</strong>
        <span>Code {invite.roomCode} · you’ll join as a Listener</span>
      </div>
      <button className="primary-btn" onClick={onAccept}>Accept & Join</button>
      <button className="text-btn ghosted" onClick={onDecline}>Decline</button>
    </div>
  )
}

function RoleRequestPopup({ request, requester, roomName, onApprove, onDecline }) {
  if (!request) return null
  return (
    <div className="role-request-popup">
      <span className="role-request-icon"><BellRing /></span>
      <div>
        <strong>🔔 @{requester?.handle || request.userId} is requesting {request.requested === 'admin' ? 'Admin' : 'DJ'} permissions</strong>
        <span>in {roomName}</span>
      </div>
      <button className="request-approve" onClick={onApprove}><Check size={12} /> Approve {request.requested === 'admin' ? 'Admin' : 'DJ'}</button>
      <button className="request-decline" onClick={onDecline}><X size={12} /> Decline</button>
    </div>
  )
}

function MembersModal({
  room,
  currentUserId,
  canModerate,
  roles,
  members,
  users,
  requests,
  onClose,
  onInviteUser,
  onCopyLink,
  onKick,
  onAssignRole,
  onResolveRequest,
}) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const code = room.code || 'ES-0000'

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      /* clipboard can be unavailable */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const copyLink = async () => {
    const link = `${window.location.origin}/?room=${encodeURIComponent(code)}`
    try {
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1600)
    } catch {
      /* clipboard can be unavailable */
    }
    onCopyLink?.(link)
  }

  const matches = canModerate && query.trim()
    ? Object.values(users)
      .filter((user) => user.id !== currentUserId && !room.members.includes(user.id))
      .filter((user) => {
        const needle = query.trim().toLowerCase().replace(/^@/, '')
        return user.handle?.toLowerCase().includes(needle) || user.email?.toLowerCase().includes(needle) || user.name?.toLowerCase().includes(needle)
      })
      .slice(0, 5)
    : []

  const submit = (event) => {
    event.preventDefault()
    if (onInviteUser(query)) setQuery('')
  }

  return (
    <ModalShell onClose={onClose} size="modal-members">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {room.name}</span>
          <h2>Members, invites & roles</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close members"><X /></button>
      </div>
      <div className="modal-body">
        <div className="invite-code-row">
          <button className={`invite-code ${copied ? 'copied' : ''}`} onClick={copyCode}>
            <span>
              <small>ROOM CODE</small>
              <strong>{code}</strong>
            </span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <em>{copied ? 'Copied' : 'Click to copy'}</em>
          </button>
          <button className={`invite-link-btn ${linkCopied ? 'copied' : ''}`} onClick={copyLink}>
            {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
            <span>{linkCopied ? 'Link copied' : 'Copy invite link'}</span>
            <small>Anyone with the link joins as Listener</small>
          </button>
        </div>

        {canModerate && (
          <form className="add-member" onSubmit={submit}>
            <div className="add-member-copy">
              <strong>Invite a registered listener</strong>
              <small>Search by @handle, name, or email. They receive a live invite banner.</small>
            </div>
            <div className="add-member-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="@handle, name, or email" />
              <button className="primary-btn" type="submit"><UserRoundPlus /> Invite</button>
            </div>
            {matches.length > 0 && (
              <div className="invite-search-list">
                {matches.map((user) => (
                  <button type="button" key={user.id} className="invite-search-row" onClick={() => { onInviteUser(user.handle); setQuery('') }}>
                    <Avatar member={user} size="sm" />
                    <span>
                      <strong>{user.name}</strong>
                      <small>@{user.handle} · {user.email}</small>
                    </span>
                    <em><Send size={10} /> Send invite</em>
                  </button>
                ))}
              </div>
            )}
            {query.trim() && !matches.length && <span className="modal-hint">No registered listener matches that search.</span>}
          </form>
        )}

        {canModerate && requests.length > 0 && (
          <div className="pending-requests">
            <span className="modal-hint">PENDING REQUESTS</span>
            {requests.map((request) => (
              <div className="pending-row" key={request.id}>
                <Avatar member={members[request.userId]} size="sm" />
                <span>
                  <strong>{members[request.userId]?.name || request.userId}</strong>
                  <small>Wants {request.requested === 'admin' ? 'Admin' : 'DJ'} access</small>
                </span>
                <button className="request-approve" onClick={() => onResolveRequest(request.id, true)}><Check size={12} /> Approve</button>
                <button className="request-decline" onClick={() => onResolveRequest(request.id, false)}><X size={12} /> Decline</button>
              </div>
            ))}
          </div>
        )}

        <div className="member-list">
          <span className="modal-hint">{room.members.length} IN THE ROOM</span>
          {room.members.map((id) => {
            const member = members[id]
            const memberRole = roles[id] || 'listener'
            const isSelf = id === currentUserId
            return (
              <div className="member-row" key={id}>
                <Avatar member={member} size="sm" online={member?.online && member?.showActivity !== false} />
                <span className="member-copy">
                  <strong>{member?.name || id} {isSelf && <em>you</em>}</strong>
                  <small>
                    @{member?.handle || id}
                    {member?.online && member?.showActivity !== false && (
                      <em className="member-live"><span className="live-dot" /> Listening</em>
                    )}
                  </small>
                </span>
                {canModerate && !isSelf ? (
                  <select
                    className={`role-select ${memberRole}`}
                    value={memberRole}
                    onChange={(event) => onAssignRole(id, event.target.value)}
                    aria-label={`Role for ${member?.name || id}`}
                  >
                    <option value="listener">Listener</option>
                    <option value="dj">DJ</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className={`role-label ${memberRole}`}>
                    {memberRole === 'admin' ? <ShieldCheck /> : memberRole === 'dj' ? <Disc3 /> : <Headphones />}
                    {ROLE_COPY[memberRole]?.label || 'Listener'}
                  </span>
                )}
                {canModerate && !isSelf && (
                  <button className="icon-btn member-kick" onClick={() => onKick(id)} aria-label={`Remove ${member?.name || id}`}>
                    <UserMinus />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="social-note"><Shield size={9} /> Admins decide who plays what. DJs can control the queue.</div>
      </div>
    </ModalShell>
  )
}

function RoomModal({ mode, room, onClose, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(() => ({
    name: room?.name || '',
    tagline: room?.tagline || '',
    description: room?.description || '',
    gradient: ROOM_GRADIENTS.find((gradient) => gradient.accent === room?.accent)?.id || ROOM_GRADIENTS[0].id,
    private: Boolean(room?.private),
    code: room?.code || roomCode(),
    listeners: room?.listeners || 8,
    trackIds: room?.trackIds ? [...room.trackIds] : SEED_TRACKS.slice(0, 6).map((seed) => seed.id),
  }))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const toggleTrack = (id) => {
    setForm((value) => ({
      ...value,
      trackIds: value.trackIds.includes(id) ? value.trackIds.filter((trackId) => trackId !== id) : [...value.trackIds, id],
    }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      name: form.name,
      tagline: form.tagline,
      description: form.description,
      private: form.private,
      code: mode === 'edit' ? form.code : undefined,
      listeners: Number(form.listeners) || 2,
      trackIds: form.trackIds.length ? form.trackIds : SEED_TRACKS.slice(0, 4).map((seed) => seed.id),
    }
    if (mode === 'create') onCreate({ ...payload, gradient: form.gradient })
    else onUpdate(payload)
  }

  return (
    <ModalShell onClose={onClose} size="modal-room">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {mode === 'create' ? 'NEW ROOM' : 'ROOM SETTINGS'}</span>
          <h2>{mode === 'create' ? 'Start a listening room' : `Tune ${room?.name}`}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close room editor"><X /></button>
      </div>
      <form className="modal-body room-form" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span>Room name</span>
            <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Sunday Slow Jams" />
          </label>
          <label className="field">
            <span>Tagline</span>
            <input value={form.tagline} onChange={(event) => setForm((value) => ({ ...value, tagline: event.target.value }))} placeholder="One line about the vibe" />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea rows={2} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="What happens in this room?" />
        </label>

        <div className="field">
          <span>Room gradient</span>
          <div className="gradient-grid">
            {ROOM_GRADIENTS.map((gradient) => (
              <button
                type="button"
                key={gradient.id}
                className={`gradient-swatch ${form.gradient === gradient.id ? 'selected' : ''}`}
                style={{ '--c1': gradient.c1, '--c2': gradient.c2 }}
                onClick={() => setForm((value) => ({ ...value, gradient: gradient.id }))}
                aria-label={`${gradient.id} gradient`}
              />
            ))}
          </div>
        </div>

        <div className="field-row compact">
          <label className="field">
            <span>Room privacy</span>
            <select value={form.private ? 'private' : 'open'} onChange={(event) => setForm((value) => ({ ...value, private: event.target.value === 'private' }))}>
              <option value="open">Public · 1-click join</option>
              <option value="private">Private · passcode or invite</option>
            </select>
          </label>
          <label className="field">
            <span>Listener count</span>
            <input type="number" min="1" max="9999" value={form.listeners} onChange={(event) => setForm((value) => ({ ...value, listeners: event.target.value }))} />
          </label>
        </div>

        {mode === 'edit' && (
          <div className={`room-code-box ${form.private ? 'locked' : ''}`}>
            <div className="room-code-copy">
              <span>{form.private ? <Lock size={12} /> : <Globe2 size={12} />} Room passcode</span>
              <code data-testid="room-code">{form.code}</code>
              <small>{form.private ? 'Required to enter unless a member invites you.' : 'Share it for code joins; public rooms still open in one click.'}</small>
            </div>
            <div className="room-code-actions">
              <button
                type="button"
                className="text-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(form.code)
                    setCopiedCode(true)
                    setTimeout(() => setCopiedCode(false), 1800)
                  } catch {
                    setCopiedCode(false)
                  }
                }}
              >
                {copiedCode ? <Check size={12} /> : <Copy size={12} />} {copiedCode ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setForm((value) => ({ ...value, code: roomCode() }))}
              >
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>
          </div>
        )}

        <div className="field">
          <span>Queue · pick at least one</span>
          <div className="track-picker">
            {SEED_TRACKS.map((seed) => (
              <button
                type="button"
                key={seed.id}
                className={`track-chip ${form.trackIds.includes(seed.id) ? 'selected' : ''}`}
                onClick={() => toggleTrack(seed.id)}
              >
                <span className="track-chip-art" style={{ '--c1': seed.c1, '--c2': seed.c2 }}>
                  {form.trackIds.includes(seed.id) ? <Check size={10} /> : null}
                </span>
                <span>
                  <strong>{seed.title}</strong>
                  <small>{seed.artist}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          {mode === 'edit' && (
            <button
              type="button"
              className={`text-btn danger-btn ${confirmDelete ? 'confirm' : ''}`}
              onClick={() => {
                if (confirmDelete) onDelete()
                else setConfirmDelete(true)
              }}
            >
              <Trash2 size={12} /> {confirmDelete ? 'Tap again to delete room' : 'Delete room'}
            </button>
          )}
          <span className="grow" />
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit">{mode === 'create' ? <Plus /> : <Check />} {mode === 'create' ? 'Create room' : 'Save changes'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function MessageText({ text, members, currentUserId, onTag }) {
  const parts = String(text).split(/(@[\w.]+)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (!part.startsWith('@')) return <span key={`${part}-${index}`}>{part}</span>
        const handle = part.slice(1).toLowerCase()
        const member = Object.values(members).find((candidate) => candidate?.handle === handle)
        const mine = member?.id === currentUserId
        return (
          <button
            key={`${part}-${index}`}
            className={`mention-pill ${mine ? 'mine' : ''}`}
            onClick={() => member && onTag(member)}
          >
            {part}
          </button>
        )
      })}
    </>
  )
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function synthVoiceWav(seconds = 3) {
  const sampleRate = 8000
  const duration = Math.max(0.8, Math.min(45, Number(seconds) || 3))
  const total = Math.floor(sampleRate * duration)
  const buffer = new ArrayBuffer(44 + total * 2)
  const view = new DataView(buffer)
  const write = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, total * 2, true)
  for (let index = 0; index < total; index += 1) {
    const t = index / sampleRate
    const envelope = Math.min(1, t * 7) * Math.min(1, (duration - t) * 5)
    const syllable = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.1 * t)
    const voice = Math.sin(2 * Math.PI * (180 + 40 * Math.sin(2 * Math.PI * 0.7 * t)) * t)
    const shimmer = 0.16 * Math.sin(2 * Math.PI * 720 * t)
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, (voice * syllable + shimmer) * envelope * 0.45)) * 0x7fff, true)
  }
  return `data:audio/wav;base64,${bufferToBase64(buffer)}`
}

function makeVoiceWaveform(seed = '', bars = 28) {
  const source = String(seed)
  let hash = 0
  for (let index = 0; index < source.length; index += 1) hash = (hash * 31 + source.charCodeAt(index)) % 100000
  return Array.from({ length: bars }, (_, index) => {
    const phase = Math.sin((hash + index * 37) * 0.017) * 0.5 + 0.5
    const wave = Math.sin((index + 1) * 0.83 + (hash % 17)) * 0.22
    return Math.min(1, Math.max(0.16, 0.3 + phase * 0.58 + wave))
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read voice note'))
    reader.readAsDataURL(blob)
  })
}

function VoiceNoteBubble({ message, isActive, onActivate, onDeactivate }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const duration = Math.max(1, Number(message.duration) || 1)
  const waveform = Array.isArray(message.waveform) && message.waveform.length
    ? message.waveform
    : makeVoiceWaveform(message.id)
  const pct = Math.min(1, elapsed / duration)

  useEffect(() => {
    if (isActive) return
    const audio = audioRef.current
    if (audio && !audio.paused) {
      audio.pause()
      setPlaying(false)
    }
  }, [isActive])

  useEffect(() => () => {
    const audio = audioRef.current
    if (audio) audio.pause()
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      onDeactivate()
      return
    }
    onActivate()
    const playback = audio.play()
    playback?.then?.(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  return (
    <div className={`voice-note-bubble ${playing ? 'playing' : ''}`} data-testid="voice-note-bubble">
      <audio
        ref={audioRef}
        src={message.voiceData}
        preload="metadata"
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime || 0)}
        onEnded={() => {
          setPlaying(false)
          setElapsed(0)
          onDeactivate()
        }}
      />
      <button className="voice-note-play" onClick={toggle} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>
        {playing ? <Pause /> : <Play />}
      </button>
      <div className="voice-note-wave" aria-hidden="true">
        {waveform.map((height, index) => (
          <i
            key={index}
            className={index / waveform.length <= pct ? 'played' : ''}
            style={{ height: `${Math.max(3, height * 22)}px` }}
          />
        ))}
      </div>
      <span className="voice-note-time">{formatTime(playing ? elapsed : duration)}</span>
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
  onSendVoice,
  onVoiceNotePlay,
  onReact,
  onClose,
  track,
  lyrics,
  progress,
  canControl,
  onSeek,
  onLock,
  onRetryLyrics,
  onDeleteMessage,
  onReply,
  replyTo,
  onCancelReply,
  open,
  currentUser,
  canModerate,
  memberRoles,
  translateOn,
  translating,
  onToggleTranslate,
  micOn,
  micLevel,
  speaking,
  duckTest,
  onToggleMic,
  onDuckTest,
  duckLevel,
}) {
  const members = useMembers()
  const chatRef = useRef(null)
  const inputRef = useRef(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  const [mention, setMention] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordHint, setRecordHint] = useState('')
  const [voicePlayingId, setVoicePlayingId] = useState(null)
  const highlightTimer = useRef(null)
  const recorderRef = useRef(null)
  const recordStreamRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordStartedAtRef = useRef(0)
  const recordCancelledRef = useRef(false)
  const finishingRef = useRef(false)
  const voiceFallbackRef = useRef(false)
  const typingMember = typingMemberId ? members[typingMemberId] : null
  const mentionMatches = mention
    ? room.members
      .map((id) => members[id])
      .filter(Boolean)
      .filter((member) => {
        const query = mention.query.toLowerCase()
        if (!query) return true
        return member.handle?.toLowerCase().includes(query) || member.name?.toLowerCase().includes(query)
      })
      .slice(0, 6)
    : []

  useEffect(() => {
    if (activeTab !== 'chat') return
    const node = chatRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages.length, typingMemberId, activeTab, room.id])

  useEffect(() => {
    setEmojiOpen(false)
    setMenuFor(null)
    setMention(null)
    setHighlightId(null)
  }, [room.id])

  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  useEffect(() => {
    onVoiceNotePlay(Boolean(voicePlayingId))
  }, [voicePlayingId, onVoiceNotePlay])

  useEffect(() => {
    return () => {
      recordCancelledRef.current = true
      clearInterval(recordTimerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* already stopped */ }
      }
      recordStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      onVoiceNotePlay(false)
    }
  }, [onVoiceNotePlay])

  useEffect(() => {
    setVoicePlayingId(null)
    if (recordStartedAtRef.current) {
      recordCancelledRef.current = true
      clearInterval(recordTimerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* already stopped */ }
      }
      recordStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      recordStreamRef.current = null
      recorderRef.current = null
      recordChunksRef.current = []
      recordStartedAtRef.current = 0
      finishingRef.current = false
      setRecording(false)
      setRecordSeconds(0)
      setRecordHint('')
    }
  }, [room.id])

  const stopRecordingHardware = () => {
    clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* already stopped */ }
    }
    recorderRef.current = null
    recordStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    recordStreamRef.current = null
    recordChunksRef.current = []
  }

  const resetRecording = () => {
    stopRecordingHardware()
    recordStartedAtRef.current = 0
    recordCancelledRef.current = false
    finishingRef.current = false
    voiceFallbackRef.current = false
    setRecording(false)
    setRecordSeconds(0)
    setRecordHint('')
  }

  const cancelRecording = () => {
    if (!recordStartedAtRef.current && !recording) return
    recordCancelledRef.current = true
    resetRecording()
  }

  const startRecording = async () => {
    if (recording || finishingRef.current || recordStartedAtRef.current) return
    finishingRef.current = false
    recordCancelledRef.current = false
    voiceFallbackRef.current = false
    recordChunksRef.current = []
    recordStartedAtRef.current = Date.now()
    setRecording(true)
    setRecordSeconds(0)
    setRecordHint('')
    recordTimerRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - recordStartedAtRef.current) / 1000)
      setRecordSeconds(seconds)
      if (seconds >= 45) finishRecording(false)
    }, 250)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder unavailable')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (recordCancelledRef.current || finishingRef.current || !recordStartedAtRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      recordStreamRef.current = stream
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined)
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        voiceFallbackRef.current = true
        setRecordHint('Mic unavailable — a demo voice clip will be sent.')
      }
      recorder.start(250)
      recorderRef.current = recorder
    } catch {
      if (!recordStartedAtRef.current || finishingRef.current) return
      voiceFallbackRef.current = true
      setRecordHint('Mic unavailable — a demo voice clip will be sent.')
    }
  }

  const finishRecording = async (discard = false) => {
    if (!recordStartedAtRef.current || finishingRef.current) return
    finishingRef.current = true
    clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
    const duration = Math.max(1, Math.min(45, (Date.now() - recordStartedAtRef.current) / 1000))
    const recorder = recorderRef.current
    if (discard) {
      recordCancelledRef.current = true
      resetRecording()
      return
    }
    setRecordHint('Sending voice note…')
    let dataUrl = ''
    try {
      if (recorder && recorder.state !== 'inactive' && !voiceFallbackRef.current) {
        dataUrl = await new Promise((resolve) => {
          let settled = false
          const complete = async () => {
            if (settled) return
            settled = true
            try {
              const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
              resolve(blob.size > 120 ? await blobToDataUrl(blob) : '')
            } catch {
              resolve('')
            }
          }
          recorder.onstop = complete
          try { recorder.stop() } catch { complete() }
          setTimeout(complete, 1500)
        })
      }
    } catch {
      dataUrl = ''
    }
    stopRecordingHardware()
    let sentDuration = duration
    if (!dataUrl) {
      sentDuration = Math.max(1.4, Math.min(8, duration))
      dataUrl = synthVoiceWav(sentDuration)
    }
    const seed = `${room.id}-${Date.now()}-${dataUrl.length}`
    onSendVoice?.({
      dataUrl,
      duration: Number(sentDuration.toFixed(1)),
      waveform: makeVoiceWaveform(seed),
    })
    recordStartedAtRef.current = 0
    recordCancelledRef.current = false
    finishingRef.current = false
    voiceFallbackRef.current = false
    setRecording(false)
    setRecordSeconds(0)
    setRecordHint('')
  }

  const handleDraftChange = (event) => {
    const value = event.target.value
    const cursor = event.target.selectionStart || value.length
    onDraft(value)
    const beforeCursor = value.slice(0, cursor)
    const match = beforeCursor.match(/(?:^|\s)@([\w.]{0,24})$/)
    if (match) setMention({ query: match[1], start: beforeCursor.length - match[1].length - 1 })
    else setMention(null)
  }

  const insertMention = (member) => {
    const start = mention ? mention.start : draft.length
    const end = mention ? mention.start + mention.query.length + 1 : draft.length
    const next = `${draft.slice(0, start)}@${member.handle} ${draft.slice(end)}`
    onDraft(next)
    setMention(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const scrollToMessage = (id) => {
    const node = chatRef.current?.querySelector(`[data-msg-id="${id}"]`)
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1800)
  }

  const submitMessage = () => {
    setMention(null)
    setEmojiOpen(false)
    onSend()
  }

  const roleOf = (userId) => memberRoles?.[userId] || (userId === room.dj ? 'dj' : 'listener')
  const currentLabel = currentUser?.handle || 'guest'

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
              <><Wifi /> {room.members.length} listener{room.members.length === 1 ? '' : 's'} · live</>
            ) : lyrics?.status === 'ready' && lyrics.type === 'plain' ? (
              <>Plain lyrics · LRCLIB</>
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

      {activeTab === 'chat' && room.private && (
        <div className="chat-live-mic" data-testid="chat-live-mic">
          <VoiceRow
            micOn={micOn}
            micLevel={micLevel}
            speaking={speaking}
            duckTest={duckTest}
            ducked={speaking}
            duckLevel={duckLevel}
            onToggleMic={onToggleMic}
            onDuckTest={onDuckTest}
          />
        </div>
      )}

      {activeTab === 'chat' ? (
        <>
          <div className="chat-body" ref={chatRef}>
            <div className="chat-day"><span>Tonight · {room.name}</span></div>
            {messages.map((message) => {
              if (message.system) {
                return (
                  <div className="msg-system" key={message.id}>
                    <ShieldCheck />
                    <span><MessageText text={message.text} members={members} currentUserId={currentUser?.id} onTag={insertMention} /></span>
                  </div>
                )
              }
              const author = members[message.author] || members.me || { name: 'Listener', handle: 'listener' }
              const mine = message.author === currentUser?.id
              const canDelete = mine || canModerate
              return (
                <div
                  className={`msg-row ${mine ? 'mine' : ''} ${highlightId === message.id ? 'highlight' : ''}`}
                  key={message.id}
                  data-msg-id={message.id}
                >
                  {!mine && <Avatar member={author} size="sm" />}
                  <div className="msg-main">
                    {!mine && (
                      <div className="msg-author">
                        {author.name}
                        <span className="msg-handle">@{author.handle}</span>
                        {roleOf(message.author) === 'dj' && <span className="dj-tag">DJ</span>}
                      </div>
                    )}
                    <div className={`bubble ${message.type === 'voice' ? 'voice' : ''}`}>
                      {message.replyTo && (
                        <button className="reply-quote" onClick={() => scrollToMessage(message.replyTo.id)}>
                          <strong>{message.replyTo.name || message.replyTo.handle}</strong>
                          <span>{message.replyTo.text || 'Voice note'}</span>
                        </button>
                      )}
                      {message.type === 'voice' && message.voiceData ? (
                        <VoiceNoteBubble
                          message={message}
                          isActive={voicePlayingId === message.id}
                          onActivate={() => setVoicePlayingId(message.id)}
                          onDeactivate={() => setVoicePlayingId((current) => (current === message.id ? null : current))}
                        />
                      ) : (
                        <MessageText text={message.text} members={members} currentUserId={currentUser?.id} onTag={insertMention} />
                      )}
                      <span className="bubble-meta">
                        {message.time}
                        {mine && (message.read ? <CheckCheck /> : <Check />)}
                      </span>
                      <div className="msg-actions">
                        <button className="msg-action" onClick={() => onReply(message)} aria-label="Reply to message">
                          <CornerUpLeft />
                        </button>
                        <button
                          className="msg-action"
                          onClick={() => setMenuFor((value) => (value === message.id ? null : message.id))}
                          aria-label="Message options"
                        >
                          <MoreHorizontal />
                        </button>
                        {menuFor === message.id && (
                          <div className="msg-menu">
                            <button onClick={() => { onReply(message); setMenuFor(null) }}><CornerUpLeft /> Reply</button>
                            <button onClick={() => { insertMention(author); setMenuFor(null) }}><AtSign /> Tag @{author.handle}</button>
                            <div className="msg-menu-emojis">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button key={emoji} onClick={() => { onReact(message.id, emoji); setMenuFor(null) }}>{emoji}</button>
                              ))}
                            </div>
                            {canDelete && (
                              <button className="danger" onClick={() => { onDeleteMessage(message.id); setMenuFor(null) }}>
                                <Trash2 /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
            {replyTo && (
              <div className="reply-bar">
                <span className="reply-bar-accent" />
                <div>
                  <strong>{replyTo.name} <span>@{replyTo.handle}</span></strong>
                  <p>{replyTo.text}</p>
                </div>
                <button className="icon-btn" onClick={onCancelReply} aria-label="Cancel reply"><X /></button>
              </div>
            )}
            {mention && mentionMatches.length > 0 && (
              <div className="mention-pop">
                <div className="mention-pop-label">Tag a member of {room.name}</div>
                {mentionMatches.map((member) => (
                  <button key={member.id} className="mention-option" onClick={() => insertMention(member)}>
                    <Avatar member={member} size="sm" />
                    <span>
                      <strong>{member.name}</strong>
                      <small>@{member.handle}</small>
                    </span>
                    <em>{ROLE_COPY[roleOf(member.id)]?.label || 'Listener'}</em>
                  </button>
                ))}
              </div>
            )}
            {recording ? (
              <div className="recording-console" data-testid="recording-bar">
                <span className="recording-dot" />
                <span className="recording-timer">{formatTime(recordSeconds)}</span>
                <div className="recording-wave" aria-hidden="true">
                  {[0.35, 0.68, 0.94, 0.52, 0.8, 0.42, 0.72, 0.58, 0.88, 0.46, 0.76, 0.62].map((height, index) => (
                    <i key={index} style={{ height: `${Math.max(3, height * 18)}px`, animationDelay: `${index * 0.08}s` }} />
                  ))}
                </div>
                <span className="recording-hint">{recordHint || 'Recording voice note…'}</span>
                <button className="record-cancel" onClick={cancelRecording}>Cancel</button>
                <button className="record-send" onClick={() => finishRecording(false)}>
                  <Send /> Send
                </button>
              </div>
            ) : (
              <>
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
                <button
                  className="emoji-btn"
                  onClick={() => {
                    const prefix = draft && !draft.endsWith(' ') ? ' ' : ''
                    const next = `${draft}${prefix}@`
                    onDraft(next)
                    setMention({ query: '', start: draft.length + prefix.length })
                    requestAnimationFrame(() => inputRef.current?.focus())
                  }}
                  aria-label="Mention a member"
                >
                  <AtSign />
                </button>
                <div className="composer-input">
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={(event) => {
                      if (mention && mentionMatches.length && event.key === 'Tab') {
                        event.preventDefault()
                        insertMention(mentionMatches[0])
                        return
                      }
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        submitMessage()
                      }
                    }}
                    placeholder={`Message the room as @${currentLabel}…`}
                    aria-label="Room message"
                  />
                  <button
                    className="voice-note-btn"
                    onClick={startRecording}
                    aria-label="Record voice note"
                    title="Record voice note"
                    data-testid="voice-note-btn"
                  >
                    <Mic />
                  </button>
                  <button className="send-btn" onClick={submitMessage} aria-label="Send message">
                    <Send />
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="social-note">
            <Lock size={9} /> {room.private ? 'Live mic is room-only · voice notes stay in chat' : 'Voice notes only · live mic is available in private rooms'}
          </div>
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
          translateOn={translateOn}
          translating={translating}
          onToggleTranslate={onToggleTranslate}
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
  onOpenFull,
  currentUser,
  pendingRequest,
  onRequestRole,
  onOpenMembers,
  onOpenSettings,
  roleRequests,
  onResolveRequest,
  onFindFull,
  onRetryFull,
  onLeaveRoom,
}) {
  const members = useMembers()
  const words = room.name.split(' ')
  const lastWord = words.pop()
  const linePeople = room.members
    .filter((id) => id !== currentUser?.id && members[id]?.showActivity !== false)
    .slice(0, 4)
  const linePositions = [15, 33, 54, 74]
  const total = duration || track?.duration || 0
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  const ready = track?.status === 'ready' && Boolean(track?.streamUrl || track?.youtubeVideoId)
  const failed = track?.status === 'error'
  const pending = track?.status === 'pending' || track?.status === 'resolving'
  const RoleIcon = ROLE_COPY[role]?.Icon || Headphones
  const requestable = role === 'listener' ? 'dj' : null

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
          <span>ROOM {room.code}</span>
        </div>
        <h1 className="room-title">
          {words.join(' ')} {words.length > 0 && ' '}<em>{lastWord}</em>
        </h1>
        <p className="room-sub">{room.description}</p>
        <div className="room-meta">
          <AvatarStack ids={room.members} size="sm" max={4} />
          <span className="meta-listeners"><b>{room.members.length}</b> in the room</span>
          <div className="meta-divider" />
          <span className="role-chip static">
            <RoleIcon />
            <span>Viewing as <b>{ROLE_COPY[role]?.label}</b></span>
          </span>
          {requestable && (
            <button
              className={`text-btn ${pendingRequest ? 'ghosted' : ''}`}
              onClick={() => onRequestRole(requestable)}
              disabled={Boolean(pendingRequest)}
              title={pendingRequest ? `${pendingRequest.requested} access pending approval` : undefined}
            >
              {pendingRequest ? <Clock3 size={12} /> : <ShieldCheck size={12} />}
              {pendingRequest ? 'Awaiting DJ approval' : 'Request DJ Role'}
            </button>
          )}
          <button className="text-btn" onClick={onOpenMembers}>
            <UsersRound size={12} /> Members · {room.members.length}
          </button>
          {role === 'admin' && (
            <button className="text-btn" onClick={onOpenSettings}>
              <Settings size={12} /> Room settings
            </button>
          )}
          <button className="text-btn" onClick={onInvite}>
            <UserPlus size={12} /> Invite
          </button>
          <button className="text-btn ghosted" onClick={onLeaveRoom}>
            <DoorOpen size={12} /> Leave
          </button>
        </div>
      </section>

      {role === 'admin' && roleRequests?.length > 0 && (
        <section className="request-banner">
          <div className="request-banner-copy">
            <span className="request-icon"><ShieldCheck /></span>
            <div>
              <strong>{roleRequests.length === 1 ? '1 role request' : `${roleRequests.length} role requests`} waiting</strong>
              <p>Listener and DJ members are asking for more access in {room.name}.</p>
            </div>
          </div>
          <div className="request-banner-list">
            {roleRequests.map((request) => {
              const requester = members[request.userId]
              return (
                <div className="request-row" key={request.id}>
                  <Avatar member={requester} size="sm" />
                  <span className="request-row-copy">
                    <strong>{requester?.name || request.userId}</strong>
                    <small>@{requester?.handle || 'listener'} · wants <b>{request.requested === 'admin' ? 'Admin' : 'DJ'}</b></small>
                  </span>
                  <button className="request-approve" onClick={() => onResolveRequest(request.id, true)}>
                    <Check size={12} /> Approve
                  </button>
                  <button className="request-decline" onClick={() => onResolveRequest(request.id, false)}>
                    <X size={12} /> Decline
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {role === 'admin' && roleRequests?.length === 0 && (
        <button className="chip-btn" onClick={onOpenMembers}>
          <ShieldCheck size={12} /> {room.members.length} members · manage roles
        </button>
      )}

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
                  const member = members[id]
                  if (!member) return null
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
            <span>{failed ? 'Source unavailable' : pending ? 'Finding the official source…' : track?.youtubeVideoId && !track?.streamUrl ? 'YouTube Music · full-length engine' : ready ? `Ad-free stream · ${track?.quality || '320 kbps'}` : 'Ready in the room'}</span>
            <span className="dot" />
            <span>{room.members.length} in the room</span>
            <span className={`dot`} />
            <span>{canControl ? 'You have control' : 'Listen-only mode'}</span>
            <span className="grow" />
            {(failed || track?.needsHydration) && (
              <button className="text-btn find-full" onClick={() => onRetryFull(track)}>
                <RefreshCw size={11} /> Retry Full Stream
              </button>
            )}
            <button className={`like-btn ${liked.includes(track?.id) ? 'liked' : ''}`} onClick={() => onLike(track?.id)} aria-label="Like track">
              <Heart />
            </button>
          </div>
        </div>
      </section>

      <div className="section-head">
        <div>
          <h3>The room queue</h3>
          <p>Everyone hears the same <b>1</b> at the same time.</p>
        </div>
        <div className="head-actions">
          <button className="text-btn" onClick={onSearch}><Plus /> Add a song</button>
          <span className="source-badge">{queue.length} {queue.length === 1 ? 'track' : 'tracks'}</span>
        </div>
      </div>

      <section className="queue">
        {queue.map((item, index) => {
          const active = index === currentIndex
          const itemReady = item?.status === 'ready' && Boolean(item?.streamUrl || item?.youtubeVideoId)
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
  buffering,
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
  inRoom,
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
          <button className="dock-play" onClick={onTogglePlay} aria-label={buffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}>
            {buffering ? <RefreshCw className="spin" /> : isPlaying ? <Pause /> : <Play />}
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
        {inRoom ? (
          <span className="dock-sync"><Wifi /> <b>{syncMs} ms</b></span>
        ) : (
          <span className="dock-sync solo"><Headphones /> <b>Solo</b></span>
        )}
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

function MobileNav({ view, chatOpen, onNavigate, onSearch, onChat, inRoom }) {
  return (
    <nav className="mobile-nav">
      <button className={(view === 'home' || (view === 'room' && !inRoom)) && !chatOpen ? 'active' : ''} onClick={() => onNavigate('home')}>
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
      {inRoom && (
        <button className={chatOpen ? 'active' : ''} onClick={onChat}>
          <MessageCircle /> Chat
        </button>
      )}
    </nav>
  )
}

function SearchOverlay({ onClose, onPlay, onQueue, onAddToPlaylist }) {
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
                    className="search-save"
                    onClick={(event) => {
                      event.stopPropagation()
                      onAddToPlaylist(track)
                    }}
                    aria-label="Add to playlist"
                    title="Add to playlist"
                  >
                    <ListPlus />
                  </button>
                  <button
                    className="search-add"
                    onClick={(event) => {
                      event.stopPropagation()
                      onQueue(track)
                    }}
                    aria-label="Add to queue"
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
          <span>JioSaavn · YouTube Music · iTunes artwork</span>
          <span className="right">Full-length engine</span>
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
  buffering,
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
  inRoom,
  translateOn,
  translating,
  onToggleTranslate,
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
            <span>{inRoom ? `Playing in ${room.name}` : 'Solo listening'}</span>
            <strong>{inRoom ? `${queue.length} tracks in the room queue · ${room.members.length} listeners` : `${queue.length} tracks in your queue · full control`}</strong>
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
                <button className="fp-play" onClick={onTogglePlay} aria-label={buffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}>
                  {buffering ? <RefreshCw className="spin" /> : isPlaying ? <Pause /> : <Play />}
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
                <p><Sparkles size={10} /> {lyrics?.status === 'ready' && lyrics.type === 'synced' ? 'Following the room, line by line' : lyrics?.status === 'ready' && lyrics.type === 'plain' ? 'Read along with the room' : 'Time-synced with playback'}</p>
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
              translateOn={translateOn}
              translating={translating}
              onToggleTranslate={onToggleTranslate}
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

function YouTubeBridge({ containerRef }) {
  return (
    <div className="yt-bridge" aria-hidden="true">
      <div ref={containerRef} />
    </div>
  )
}

function buildInitialQueues(rooms) {
  const queues = { [SOLO_ROOM_ID]: SEED_TRACKS.slice(0, 8).map((track) => track.id) }
  rooms.forEach((room) => {
    queues[room.id] = Array.isArray(room.trackIds) ? [...room.trackIds] : []
  })
  return queues
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

function isPlayableTrack(track) {
  return Boolean(track && (track.streamUrl || track.youtubeVideoId))
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

export default function App() {
  const [theme, setTheme] = useState(() => (readStorage(THEME_KEY, 'dark') === 'light' ? 'light' : 'dark'))
  const [accounts, setAccounts] = useState(loadUsers)
  const [currentUserId, setCurrentUserId] = useState(() => {
    const id = readActiveUserId()
    if (id && loadUsers()[id]) return id
    if (id) clearActiveSession()
    return null
  })
  const [view, setView] = useState('home')
  const [rooms, setRooms] = useState(() => loadStoredRooms().map(normalizeRoom).filter(Boolean))
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [soloQueue, setSoloQueue] = useState(() => SEED_TRACKS.slice(0, 8).map((seed) => seed.id))
  const [currentByRoom, setCurrentByRoom] = useState({ [SOLO_ROOM_ID]: 0 })
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.82)
  const [muted, setMuted] = useState(false)
  const [library, setLibrary] = useState(buildInitialLibrary)
  const [liked, setLiked] = useState(() => {
    const value = readUserValue(LIKES_KEY, currentUserId, [])
    return Array.isArray(value) ? value : []
  })
  const [playlists, setPlaylists] = useState(() => {
    const value = readUserValue(PLAYLISTS_KEY, currentUserId, [])
    return Array.isArray(value) ? value : []
  })
  const [recent, setRecent] = useState(() => {
    const value = readUserValue(RECENT_KEY, currentUserId, [])
    return Array.isArray(value) ? value : []
  })
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(readUserValue(SETTINGS_KEY, currentUserId, {}) || {}),
  }))
  const [translateOn, setTranslateOn] = useState(() => Boolean(settings.autoTranslate))
  const [translating, setTranslating] = useState(false)
  const [messages, setMessages] = useState(loadStoredMessages)
  const [invites, setInvites] = useState(loadInvites)
  const [typing, setTyping] = useState({})
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [chatOpen, setChatOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 1050))
  const [searchOpen, setSearchOpen] = useState(false)
  const [fullPlayer, setFullPlayer] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [joinRoomOpen, setJoinRoomOpen] = useState(false)
  const [roomEditor, setRoomEditor] = useState(null)
  const [playlistDialog, setPlaylistDialog] = useState(null)
  const [pendingPlaylistTrack, setPendingPlaylistTrack] = useState(null)
  const [addTrack, setAddTrack] = useState(null)
  const [activePlaylistId, setActivePlaylistId] = useState(null)
  const [toast, setToast] = useState(null)
  const [lyrics, setLyrics] = useState({ status: 'idle' })
  const [lyricsRefresh, setLyricsRefresh] = useState(0)
  const [syncMs, setSyncMs] = useState(14)
  const [seekSignal, setSeekSignal] = useState(0)
  const [joinPill, setJoinPill] = useState(null)
  const [micOn, setMicOn] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [duckTest, setDuckTest] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [streamRecovering, setStreamRecovering] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signin')
  const [authReason, setAuthReason] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [passcodeRoomId, setPasscodeRoomId] = useState(null)
  const [voiceNotePlaying, setVoiceNotePlaying] = useState(false)
  const [remoteVoice, setRemoteVoice] = useState({})
  const [cacheRevision, setCacheRevision] = useState(0)
  const [pendingRoomCode, setPendingRoomCode] = useState(() => (
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('room') || ''
  ))

  const audioRef = useRef(null)
  const loadedUrlRef = useRef('')
  const pendingSeekRef = useRef(null)
  const channelRef = useRef(null)
  const accountsJsonRef = useRef('')
  const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const activeRoomRef = useRef(activeRoomId)
  const roomsRef = useRef(rooms)
  const queueIdsRef = useRef([])
  const currentIndexRef = useRef(0)
  const isPlayingRef = useRef(false)
  const canControlRef = useRef(true)
  const currentUserRef = useRef(null)
  const memberIndexRef = useRef({})
  const messagesRef = useRef(messages)
  const settingsRef = useRef(settings)
  const invitesRef = useRef(invites)
  const toastTimerRef = useRef(null)
  const typingTimerRef = useRef(null)
  const typingBroadcastRef = useRef(null)
  const typingClearRef = useRef(null)
  const micRef = useRef({ stream: null, ctx: null, analyser: null, raf: null, loudAt: 0, quietAt: 0, recorder: null, mimeType: '' })
  const duckRef = useRef({ interval: null, timer: null })
  const ytPlayerRef = useRef(null)
  const ytContainerRef = useRef(null)
  const handleEndedRef = useRef(null)
  const hasInteractedRef = useRef(false)
  const pendingAuthActionRef = useRef(null)
  const stallTimerRef = useRef(null)
  const recoveryRef = useRef({ id: '', at: 0, active: false })
  const remoteVoiceTimersRef = useRef({})
  const remoteAudioQueueRef = useRef({ entries: {} })
  const acceptedInviteRoomsRef = useRef(new Set())

  const currentAccount = currentUserId ? accounts[currentUserId] : null
  const currentUser = useMemo(() => (
    currentAccount ? accountDisplay({ ...currentAccount, online: true }) : null
  ), [currentAccount])

  const activeRoom = activeRoomId ? rooms.find((room) => room.id === activeRoomId) || null : null
  const inRoom = Boolean(activeRoom)
  const role = inRoom ? activeRoom.roles?.[currentUserId] || 'listener' : 'listener'
  const canControl = !inRoom || role === 'admin' || role === 'dj'
  const canModerate = inRoom && role === 'admin'
  const remoteSpeaking = Object.keys(remoteVoice).length > 0
  const voiceSpeaking = speaking || remoteSpeaking
  const activeKey = activeRoomId || SOLO_ROOM_ID
  const queueIds = inRoom ? activeRoom.trackIds : soloQueue
  const queue = queueIds.map((id) => {
    if (library[id]) return library[id]
    if (SEED_BY_ID[id]) return { ...SEED_BY_ID[id], status: 'pending', streamUrl: null }
    return {
      id,
      title: 'Loading track…',
      artist: 'EchoSync',
      album: '',
      duration: 0,
      status: 'pending',
      c1: '#26303a',
      c2: '#a65845',
    }
  })
  const requestedIndex = currentByRoom[activeKey] ?? 0
  const currentIndex = queue.length ? Math.min(requestedIndex, queue.length - 1) : 0
  const track = queue[currentIndex] || EMPTY_TRACK
  const roomMessages = activeRoomId ? messages[activeRoomId] || [] : []
  const typingMemberId = activeRoomId ? typing[activeRoomId] || null : null
  const likedSet = Array.isArray(liked) ? liked : []
  const displayRoom = activeRoom || {
    id: SOLO_ROOM_ID,
    name: 'Solo listening',
    accent: '#f16b73',
    accent2: '#f2b38e',
    members: [],
    roles: {},
    requests: [],
    trackIds: soloQueue,
    code: '',
  }

  const publicUsers = useMemo(() => {
    const next = {}
    Object.entries(accounts).forEach(([id, account]) => {
      next[id] = publicAccount(accountDisplay({ ...account, online: id === currentUserId }), id === currentUserId)
    })
    return next
  }, [accounts, currentUserId])

  const memberIndex = useMemo(() => {
    const next = { ...publicUsers }
    if (currentUser) next[currentUser.id] = currentUser
    return next
  }, [publicUsers, currentUser])

  const pendingRequest = activeRoom?.requests?.find((request) => request.userId === currentUserId) || null
  const moderatorRequest = canModerate
    ? (activeRoom?.requests || []).find((request) => request.userId !== currentUserId) || null
    : null
  const pendingInvite = currentUser
    ? invites.find((invite) => invite.toUserId === currentUser.id) || null
    : null
  const shellChatOpen = inRoom && chatOpen
  const lyricsKey = track?.id || 'empty'

  useEffect(() => {
    activeRoomRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    roomsRef.current = rooms
  }, [rooms])

  useEffect(() => {
    queueIdsRef.current = queueIds
  }, [queueIds])

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    canControlRef.current = canControl
  }, [canControl])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    memberIndexRef.current = memberIndex
  }, [memberIndex])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    invitesRef.current = invites
  }, [invites])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStorage(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const raw = JSON.stringify(accounts)
    if (raw === accountsJsonRef.current) return
    accountsJsonRef.current = raw
    writeStorage(USERS_KEY, accounts)
  }, [accounts])

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== USERS_KEY || !event.newValue) return
      let incoming
      try {
        incoming = JSON.parse(event.newValue)
      } catch {
        return
      }
      if (!incoming || typeof incoming !== 'object') return
      accountsJsonRef.current = event.newValue
      setAccounts((previous) => {
        let changed = false
        const next = { ...previous }
        Object.entries(incoming).forEach(([id, account]) => {
          if (JSON.stringify(next[id]) !== JSON.stringify(account)) {
            next[id] = account
            changed = true
          }
        })
        return changed ? next : previous
      })
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    writeStorage(ROOMS_KEY, rooms)
  }, [rooms])

  useEffect(() => {
    writeStorage(MESSAGES_KEY, messages)
  }, [messages])

  useEffect(() => {
    writeStorage(INVITES_KEY, invites)
  }, [invites])

  useEffect(() => {
    if (!currentUserId) return
    writeUserValue(LIKES_KEY, currentUserId, liked)
  }, [currentUserId, liked])

  useEffect(() => {
    if (!currentUserId) return
    writeUserValue(PLAYLISTS_KEY, currentUserId, playlists)
  }, [currentUserId, playlists])

  useEffect(() => {
    if (!currentUserId) return
    writeUserValue(RECENT_KEY, currentUserId, recent)
  }, [currentUserId, recent])

  useEffect(() => {
    if (!currentUserId) return
    writeUserValue(SETTINGS_KEY, currentUserId, settings)
    streamQuality = settings.quality || 'high'
  }, [currentUserId, settings])

  useEffect(() => {
    writeStorage(TRANSLATE_KEY, translateOn)
  }, [translateOn])

  useEffect(() => {
    if (!currentUser) return
    const handleInteraction = () => {
      hasInteractedRef.current = true
    }
    window.addEventListener('pointerdown', handleInteraction, { once: true })
    window.addEventListener('keydown', handleInteraction, { once: true })
    return () => {
      window.removeEventListener('pointerdown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [currentUser])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 1050) setChatOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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
        else if (addTrack) setAddTrack(null)
        else if (playlistDialog) setPlaylistDialog(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen, fullPlayer, addTrack, playlistDialog])

  useEffect(() => {
    if (!currentUserId) return
    if (accounts[currentUserId]) return
    clearActiveSession()
    setCurrentUserId(null)
  }, [accounts, currentUserId])

  useEffect(() => {
    if (!activeRoomId) return
    if (rooms.some((room) => room.id === activeRoomId)) return
    setActiveRoomId(null)
    setView('home')
    setIsPlaying(false)
    audioRef.current?.pause()
  }, [rooms, activeRoomId])

  useEffect(() => {
    if (!currentUser) return
    const action = pendingAuthActionRef.current
    if (!action) return
    pendingAuthActionRef.current = null
    executeAuthIntent(action)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  useEffect(() => {
    if (currentUser || !pendingRoomCode) return
    setAuthMode('signin')
    setAuthReason(`Log in or sign up to join room ${normalizeRoomCode(pendingRoomCode)}.`)
    setAuthOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!currentUser || !pendingRoomCode) return
    const code = normalizeRoomCode(pendingRoomCode)
    const room = rooms.find((candidate) => normalizeRoomCode(candidate.code) === code)
    if (!room) {
      setJoinRoomOpen(true)
      return
    }
    if (room.private) acceptedInviteRoomsRef.current.add(room.id)
    setPendingRoomCode('')
    joinRoom(room)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, pendingRoomCode, rooms])

  useEffect(() => {
    if (!activeRoomId) return
    setDraft('')
    setReplyTo(null)
    setTyping({})
    setJoinPill(null)
  }, [activeRoomId])

  useEffect(() => () => {
    clearTimeout(toastTimerRef.current)
    clearTimeout(typingTimerRef.current)
    clearTimeout(typingBroadcastRef.current)
    clearTimeout(typingClearRef.current)
    clearInterval(duckRef.current.interval)
    clearTimeout(duckRef.current.timer)
    if (micRef.current.raf) cancelAnimationFrame(micRef.current.raf)
    if (micRef.current.recorder && micRef.current.recorder.state !== 'inactive') {
      try { micRef.current.recorder.stop() } catch { /* already stopped */ }
    }
    micRef.current.stream?.getTracks().forEach((streamTrack) => streamTrack.stop())
    if (micRef.current.ctx) micRef.current.ctx.close()
    cleanupAllRemoteVoice()
    audioRef.current?.pause()
  }, [])

  function hydrateUser(id) {
    const userLikes = readUserValue(LIKES_KEY, id, [])
    const userPlaylists = readUserValue(PLAYLISTS_KEY, id, [])
    const userRecent = readUserValue(RECENT_KEY, id, [])
    const userSettings = { ...DEFAULT_SETTINGS, ...(readUserValue(SETTINGS_KEY, id, {}) || {}) }
    setLiked(Array.isArray(userLikes) ? userLikes : [])
    setPlaylists(Array.isArray(userPlaylists) ? userPlaylists : [])
    setRecent(Array.isArray(userRecent) ? userRecent : [])
    setSettings(userSettings)
    setTranslateOn(Boolean(userSettings.autoTranslate))
    streamQuality = userSettings.quality || 'high'
    setActiveRoomId(null)
    setSoloQueue(SEED_TRACKS.slice(0, 8).map((seed) => seed.id))
    setCurrentByRoom({ [SOLO_ROOM_ID]: 0 })
    setActivePlaylistId(null)
    setView('home')
    setIsPlaying(false)
    setProgress(0)
    setDuration(0)
    setDraft('')
    setReplyTo(null)
    setJoinPill(null)
    setSearchOpen(false)
    setFullPlayer(false)
    setSettingsOpen(false)
    setMembersOpen(false)
    setJoinRoomOpen(false)
    setRoomEditor(null)
    setPlaylistDialog(null)
    setAddTrack(null)
    setPendingPlaylistTrack(null)
  }

  function finishAuth(id, remember) {
    writeActiveSession(id, remember)
    hydrateUser(id)
    setCurrentUserId(id)
    setAuthOpen(false)
    setAuthReason('')
    setAuthNotice('')
  }

  function signIn({ identifier, email, password, remember }) {
    const typed = String(identifier ?? email ?? '').trim().toLowerCase().replace(/^@/, '')
    const cleanHandle = slugifyHandle(typed)
    if (!typed || !password) return { error: 'Enter your email or username and password.' }
    const account = Object.values(accounts).find((candidate) => (
      candidate.email?.toLowerCase() === typed || candidate.handle?.toLowerCase() === cleanHandle
    ))
    if (!account) return { error: 'No account found. Check your email or username, or create one.' }
    if (account.password !== password) return { error: 'That password does not match.' }
    finishAuth(account.id, remember)
    setActivePlaylistId(null)
    showToast(`Welcome back, ${account.name.split(' ')[0]}`)
    return {}
  }

  function signUp({ email, username, handle, password, remember }) {
    const typed = String(email || '').trim().toLowerCase()
    const cleanHandle = slugifyHandle(username || handle || handleFromEmail(typed))
    if (!typed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) return { error: 'Enter a valid email address.' }
    if (cleanHandle.length < 3) return { error: 'Choose a username with at least 3 characters.' }
    if (!password || password.length < 4) return { error: 'Use at least 4 characters for your password.' }
    const taken = Object.values(accounts).some((candidate) => candidate.handle === cleanHandle)
    if (taken) return { error: 'That username is taken. Try another.' }
    if (Object.values(accounts).some((candidate) => candidate.email?.toLowerCase() === typed)) {
      return { error: 'That email is already registered. Log in instead.' }
    }
    let id = cleanHandle
    let suffix = 1
    while (accounts[id]) {
      suffix += 1
      id = `${cleanHandle}${suffix}`
    }
    const cleanName = displayNameFromHandle(cleanHandle)
    const chosen = randomAvatarPreset(id)
    const account = {
      id,
      name: cleanName,
      handle: cleanHandle,
      email: typed,
      password,
      initials: initials(cleanName),
      av1: chosen.av1,
      av2: chosen.av2,
      preset: chosen.id,
      showActivity: true,
      allowInvites: true,
      createdAt: Date.now(),
    }
    setAccounts((previous) => ({ ...previous, [id]: account }))
    finishAuth(id, remember)
    showToast(`Account created — welcome, ${cleanName.split(' ')[0]}`)
    return {}
  }

  function signOut() {
    clearActiveSession()
    setIsPlaying(false)
    audioRef.current?.pause()
    stopMic()
    setCurrentUserId(null)
    setLiked([])
    setPlaylists([])
    setRecent([])
    setSettings({ ...DEFAULT_SETTINGS })
    setTranslateOn(false)
    setActiveRoomId(null)
    setActivePlaylistId(null)
    setView('home')
    setSearchOpen(false)
    setFullPlayer(false)
    setSettingsOpen(false)
    setMembersOpen(false)
    setJoinRoomOpen(false)
    setRoomEditor(null)
    setPlaylistDialog(null)
    setAddTrack(null)
    setPendingRoomCode('')
    setPasscodeRoomId(null)
    setAuthOpen(false)
    setAuthReason('')
    setAuthNotice('')
    setDraft('')
    setReplyTo(null)
    showToast('Signed out — your account is waiting when you return.')
  }

  function saveProfile(patch) {
    if (!currentUserId || !accounts[currentUserId]) return { error: 'Sign in to edit your profile.' }
    const account = accounts[currentUserId]
    const cleanHandle = slugifyHandle(patch.handle || account.handle)
    const typed = String(patch.email ?? account.email ?? '').trim().toLowerCase()
    const cleanName = displayNameFromHandle(cleanHandle)
    if (cleanHandle.length < 3) return { error: 'Choose a username with at least 3 characters.' }
    if (!typed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) return { error: 'Enter a valid email address.' }
    if (Object.values(accounts).some((candidate) => candidate.id !== currentUserId && candidate.handle === cleanHandle)) {
      return { error: 'That username is already in use.' }
    }
    if (Object.values(accounts).some((candidate) => candidate.id !== currentUserId && candidate.email?.toLowerCase() === typed)) {
      return { error: 'That email belongs to another account.' }
    }
    const newPassword = String(patch.newPassword || '')
    let password = account.password
    if (newPassword) {
      if (String(patch.currentPassword || '') !== account.password) {
        return { error: 'Your current password does not match.' }
      }
      if (newPassword.length < 4) return { error: 'Use at least 4 characters for the new password.' }
      password = newPassword
    }
    setAccounts((previous) => ({
      ...previous,
      [currentUserId]: {
        ...previous[currentUserId],
        name: cleanName,
        handle: cleanHandle,
        email: typed,
        password,
        initials: initials(cleanName),
        showActivity: patch.showActivity !== undefined ? Boolean(patch.showActivity) : account.showActivity !== false,
        allowInvites: patch.allowInvites !== undefined ? Boolean(patch.allowInvites) : account.allowInvites !== false,
      },
    }))
    showToast(newPassword ? 'Profile and password updated' : 'Profile saved')
    return {}
  }

  function showToast(message, tone = 'info') {
    setToast({ id: Date.now() + Math.random(), message, tone })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3400)
  }

  function lockToast() {
    showToast(LOCK_MESSAGE, 'lock')
  }

  function addRecent(trackId) {
    if (!trackId || trackId === 'empty') return
    setRecent((previous) => [trackId, ...previous.filter((id) => id !== trackId)].slice(0, 30))
  }

  function rememberTrack(candidate) {
    if (!candidate?.id) return
    const entry = { ...candidate, status: candidate.status || 'ready' }
    setLibrary((previous) => ({
      ...previous,
      [candidate.id]: { ...(previous[candidate.id] || {}), ...entry },
    }))
    if (entry.streamUrl || entry.youtubeVideoId) saveLibraryEntry(candidate.id, entry)
  }

  function pushSystemMessage(roomId, text) {
    const message = { id: uid('sys'), system: true, text, time: clockNow(), reactions: [] }
    setMessages((previous) => ({ ...previous, [roomId]: [...(previous[roomId] || []), message] }))
    channelRef.current?.postMessage({ type: 'chat', roomId, sender: tabIdRef.current, message })
  }

  function broadcastRoom(room) {
    if (!room) return
    channelRef.current?.postMessage({ type: 'room-updated', sender: tabIdRef.current, room })
  }

  function requestRoomSync(roomId) {
    if (!roomId) return
    channelRef.current?.postMessage({
      type: 'join-sync-request',
      roomId,
      sender: tabIdRef.current,
      ts: Date.now(),
    })
    const stored = loadRoomStateSnapshot()
    if (stored?.roomId === roomId && stored.ts && Date.now() - stored.ts < 15000) applyRemoteState(stored)
  }

  function joinRoom(candidate, userId = currentUserId) {
    if (!candidate?.id) return
    if (!userId) {
      requireAuth(
        { type: 'joinRoom', roomId: candidate.id, roomCode: candidate.code },
        `Log in to join ${candidate.name}.`,
      )
      return
    }
    const isMember = candidate.members?.includes(userId)
    const isAdmin = candidate.roles?.[userId] === 'admin' || candidate.dj === userId || candidate.createdBy === userId
    const invited = invitesRef.current.some((invite) => invite.roomId === candidate.id && invite.toUserId === userId)
    const accessGranted = !candidate.private || isMember || isAdmin || invited || acceptedInviteRoomsRef.current.has(candidate.id)
    if (!accessGranted) {
      setPasscodeRoomId(candidate.id)
      return
    }
    acceptedInviteRoomsRef.current.delete(candidate.id)
    const wasMember = candidate.members.includes(userId)
    const roles = { ...(candidate.roles || {}) }
    if (!roles[userId]) roles[userId] = candidate.dj === userId ? 'admin' : 'listener'
    const nextRoom = wasMember
      ? { ...candidate, roles }
      : { ...candidate, members: [...candidate.members, userId], roles }
    if (!wasMember) {
      setRooms((previous) => previous.map((room) => (room.id === candidate.id ? nextRoom : room)))
      broadcastRoom(nextRoom)
      pushSystemMessage(candidate.id, `${accounts[userId]?.name || 'A listener'} joined ${candidate.name}`)
    }
    const changed = activeRoomId !== candidate.id
    if (changed) {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.currentTime = 0
      setIsPlaying(false)
      setProgress(0)
      setDuration(0)
      setDraft('')
      setReplyTo(null)
      setJoinPill(null)
      pendingSeekRef.current = null
    }
    setActiveRoomId(candidate.id)
    setCurrentByRoom((previous) => ({ ...previous, [candidate.id]: previous[candidate.id] || 0 }))
    setView('room')
    if (typeof window !== 'undefined' && window.innerWidth > 1050) setChatOpen(true)
    if (changed) setTimeout(() => requestRoomSync(candidate.id), 140)
    showToast(changed ? `Joined ${candidate.name}` : `You are already in ${candidate.name}`)
  }

  function joinRoomByCode(value) {
    const compact = normalizeRoomCode(value)
    if (!compact) return { error: 'Enter a room code like ES-4829.' }
    const room = rooms.find((candidate) => (
      normalizeRoomCode(candidate.code) === compact || candidate.id === value.trim()
    ))
    if (!room) return { error: 'No room matches that code. Check it with the host.' }
    if (room.private) acceptedInviteRoomsRef.current.add(room.id)
    joinRoom(room)
    setJoinRoomOpen(false)
    setPendingRoomCode('')
    return {}
  }

  function unlockPrivateRoom(value) {
    const room = rooms.find((candidate) => candidate.id === passcodeRoomId)
    if (!room) return { error: 'That room is no longer available.' }
    if (normalizeRoomCode(value) !== normalizeRoomCode(room.code)) {
      return { error: 'That passcode does not match. Ask the host for the ES-XXXX code.' }
    }
    acceptedInviteRoomsRef.current.add(room.id)
    setPasscodeRoomId(null)
    joinRoom(room)
    return {}
  }

  function createRoom(input) {
    if (!currentUserId) return
    const gradient = ROOM_GRADIENTS.find((option) => option.id === input.gradient) || ROOM_GRADIENTS[0]
    let code = roomCode()
    while (rooms.some((room) => room.code === code)) code = roomCode()
    const trackIds = input.trackIds?.length ? input.trackIds : SEED_TRACKS.slice(0, 6).map((seed) => seed.id)
    const room = {
      id: uid('room'),
      name: String(input.name || '').trim(),
      tagline: String(input.tagline || '').trim() || 'A room built for the moment.',
      description: String(input.description || '').trim() || String(input.tagline || '').trim() || 'A fresh listening room on EchoSync.',
      accent: gradient.accent,
      accent2: gradient.accent2,
      c1: gradient.c1,
      c2: gradient.c2,
      trackIds,
      members: [currentUserId],
      roles: { [currentUserId]: 'admin' },
      requests: [],
      listeners: Math.max(1, Number(input.listeners) || 1),
      private: Boolean(input.private),
      dj: currentUserId,
      code,
      leader: currentUserId,
      createdBy: currentUserId,
      createdAt: Date.now(),
    }
    setRooms((previous) => [...previous, room])
    setCurrentByRoom((previous) => ({ ...previous, [room.id]: 0 }))
    setActiveRoomId(room.id)
    setView('room')
    setRoomEditor(null)
    if (typeof window !== 'undefined' && window.innerWidth > 1050) setChatOpen(true)
    channelRef.current?.postMessage({ type: 'room-added', sender: tabIdRef.current, room })
    pushSystemMessage(room.id, `${currentUser?.name || 'You'} created this room · invite code ${room.code}`)
    showToast(`Room created — invite code ${room.code}`)
  }

  function updateRoom(patch) {
    if (!activeRoom || !canModerate) {
      lockToast()
      return
    }
    let nextCode = activeRoom.code
    if (patch.code) {
      nextCode = normalizeRoomCode(patch.code)
      while (rooms.some((room) => room.id !== activeRoom.id && normalizeRoomCode(room.code) === nextCode)) {
        nextCode = roomCode()
      }
    }
    const nextRoom = {
      ...activeRoom,
      ...patch,
      code: nextCode,
      trackIds: Array.isArray(patch.trackIds) && patch.trackIds.length
        ? patch.trackIds
        : activeRoom.trackIds,
    }
    setRooms((previous) => previous.map((room) => (room.id === nextRoom.id ? nextRoom : room)))
    broadcastRoom(nextRoom)
    if (Array.isArray(patch.trackIds)) {
      setCurrentByRoom((previous) => ({ ...previous, [nextRoom.id]: 0 }))
      pendingSeekRef.current = 0
      setProgress(0)
      announce({ index: 0, isPlaying: false, time: 0 })
      setIsPlaying(false)
      audioRef.current?.pause()
    }
    pushSystemMessage(nextRoom.id, `${currentUser?.name || 'Admin'} updated the room settings`)
    setRoomEditor(null)
    showToast('Room updated')
  }

  function deleteRoom() {
    if (!activeRoom || !canModerate) {
      lockToast()
      return
    }
    const roomId = activeRoom.id
    setRooms((previous) => previous.filter((room) => room.id !== roomId))
    setInvites((previous) => previous.filter((invite) => invite.roomId !== roomId))
    setMessages((previous) => {
      const next = { ...previous }
      delete next[roomId]
      return next
    })
    setIsPlaying(false)
    audioRef.current?.pause()
    stopMic()
    setActiveRoomId(null)
    setView('rooms')
    setRoomEditor(null)
    setMembersOpen(false)
    channelRef.current?.postMessage({ type: 'room-deleted', sender: tabIdRef.current, roomId })
    showToast('Room deleted')
  }

  async function copyInvite() {
    if (!activeRoom) return
    const url = `${window.location.origin}/?room=${encodeURIComponent(activeRoom.code)}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Invite link copied — listening is better together')
    } catch {
      showToast(`Share room code ${activeRoom.code} to invite a friend`)
    }
  }

  function inviteUser(query) {
    if (!activeRoom || !canModerate) {
      lockToast()
      return false
    }
    const raw = String(query || '').trim()
    if (!raw) return false
    const needle = raw.toLowerCase().replace(/^@/, '')
    const target = Object.values(accounts).find((account) => (
      account.handle?.toLowerCase() === needle
      || account.email?.toLowerCase() === raw.toLowerCase()
      || account.name?.toLowerCase() === needle
    ))
    if (!target) {
      showToast('No registered listener matches that search.', 'lock')
      return false
    }
    if (target.id === currentUserId) {
      showToast('You are already in this room.', 'lock')
      return false
    }
    if (activeRoom.members.includes(target.id)) {
      showToast(`${target.name} is already in ${activeRoom.name}.`, 'lock')
      return false
    }
    if (target.allowInvites === false) {
      showToast(`${target.name} is not accepting direct room invites.`, 'lock')
      return false
    }
    const duplicate = invitesRef.current.some((invite) => (
      invite.roomId === activeRoom.id && invite.toUserId === target.id
    ))
    if (duplicate) {
      showToast(`${target.name} already has a pending invite.`, 'lock')
      return false
    }
    const invite = {
      id: uid('invite'),
      roomId: activeRoom.id,
      roomName: activeRoom.name,
      roomCode: activeRoom.code,
      fromId: currentUserId,
      fromHandle: currentUser?.handle || 'listener',
      toUserId: target.id,
      createdAt: Date.now(),
    }
    setInvites((previous) => [...previous, invite])
    channelRef.current?.postMessage({ type: 'invite', sender: tabIdRef.current, invite })
    pushSystemMessage(activeRoom.id, `${currentUser?.name || 'An admin'} invited ${target.name}`)
    showToast(`Invite sent to ${target.name}`)
    return true
  }

  function resolveInvite(inviteId, accepted) {
    const invite = invitesRef.current.find((item) => item.id === inviteId)
    setInvites((previous) => previous.filter((item) => item.id !== inviteId))
    channelRef.current?.postMessage({ type: 'invite-resolved', sender: tabIdRef.current, inviteId })
    if (!invite || !accepted) return
    const room = roomsRef.current.find((candidate) => candidate.id === invite.roomId || candidate.code === invite.roomCode)
    if (!room) {
      showToast('That room is no longer available.', 'lock')
      return
    }
    acceptedInviteRoomsRef.current.add(room.id)
    joinRoom(room)
  }

  function requestRole(requested) {
    if (!activeRoom || role !== 'listener') return
    const existing = (activeRoom.requests || []).find((request) => request.userId === currentUserId)
    if (existing) {
      showToast('Your role request is still pending.')
      return
    }
    const request = {
      id: uid('req'),
      userId: currentUserId,
      requested: requested === 'admin' ? 'admin' : 'dj',
      at: Date.now(),
    }
    const nextRoom = { ...activeRoom, requests: [...(activeRoom.requests || []), request] }
    setRooms((previous) => previous.map((room) => (room.id === nextRoom.id ? nextRoom : room)))
    channelRef.current?.postMessage({ type: 'role-request', sender: tabIdRef.current, roomId: nextRoom.id, request })
    showToast('Request sent — a room Admin will review it.')
  }

  function resolveRoleRequest(requestId, approve) {
    if (!activeRoom || !canModerate) {
      lockToast()
      return
    }
    const request = (activeRoom.requests || []).find((item) => item.id === requestId)
    if (!request) return
    const roles = { ...(activeRoom.roles || {}) }
    if (approve) roles[request.userId] = request.requested
    const nextRoom = {
      ...activeRoom,
      roles,
      requests: activeRoom.requests.filter((item) => item.id !== requestId),
    }
    setRooms((previous) => previous.map((room) => (room.id === nextRoom.id ? nextRoom : room)))
    channelRef.current?.postMessage({
      type: 'role-resolved',
      sender: tabIdRef.current,
      roomId: nextRoom.id,
      requestId,
      userId: request.userId,
      role: request.requested,
      approved: Boolean(approve),
      roles,
    })
    const targetName = accounts[request.userId]?.name || 'A member'
    pushSystemMessage(
      nextRoom.id,
      approve
        ? `${targetName} is now ${request.requested === 'admin' ? 'Admin' : 'DJ'} in ${nextRoom.name}`
        : `Role request from ${targetName} was declined`,
    )
    showToast(approve ? 'Request approved' : 'Request declined')
  }

  function assignRole(userId, nextRole) {
    if (!activeRoom || !canModerate) {
      lockToast()
      return
    }
    if (!['admin', 'dj', 'listener'].includes(nextRole)) return
    const roles = { ...(activeRoom.roles || {}), [userId]: nextRole }
    if (!Object.values(roles).includes('admin')) {
      showToast('A room needs at least one Admin.', 'lock')
      return
    }
    const nextRoom = { ...activeRoom, roles }
    setRooms((previous) => previous.map((room) => (room.id === nextRoom.id ? nextRoom : room)))
    channelRef.current?.postMessage({
      type: 'role-resolved',
      sender: tabIdRef.current,
      roomId: nextRoom.id,
      requestId: null,
      userId,
      role: nextRole,
      approved: true,
      roles,
    })
    pushSystemMessage(nextRoom.id, `${accounts[userId]?.name || 'A member'} is now ${ROLE_COPY[nextRole]?.label || 'Listener'}`)
    showToast('Role updated')
  }

  function kickMember(userId) {
    if (!activeRoom || !canModerate || userId === currentUserId) {
      lockToast()
      return
    }
    const roles = { ...(activeRoom.roles || {}) }
    delete roles[userId]
    const nextRoom = {
      ...activeRoom,
      members: activeRoom.members.filter((id) => id !== userId),
      roles,
      requests: (activeRoom.requests || []).filter((request) => request.userId !== userId),
    }
    if (!Object.values(roles).includes('admin') && nextRoom.members[0]) {
      roles[nextRoom.members[0]] = 'admin'
    }
    setRooms((previous) => previous.map((room) => (room.id === nextRoom.id ? nextRoom : room)))
    broadcastRoom(nextRoom)
    pushSystemMessage(nextRoom.id, `Admin removed ${accounts[userId]?.name || 'a member'} from the room`)
    showToast('Member removed')
  }

  function leaveRoom() {
    if (!activeRoom) return
    const roomId = activeRoom.id
    const roles = { ...(activeRoom.roles || {}) }
    delete roles[currentUserId]
    const members = activeRoom.members.filter((id) => id !== currentUserId)
    const nextRoom = { ...activeRoom, members, roles }
    if (members.length && !Object.values(roles).includes('admin')) roles[members[0]] = 'admin'
    if (members.length) {
      setRooms((previous) => previous.map((room) => (room.id === roomId ? nextRoom : room)))
      broadcastRoom(nextRoom)
      pushSystemMessage(roomId, `${currentUser?.name || 'A listener'} left ${activeRoom.name}`)
    } else {
      setRooms((previous) => previous.filter((room) => room.id !== roomId))
      channelRef.current?.postMessage({ type: 'room-deleted', sender: tabIdRef.current, roomId })
    }
    setIsPlaying(false)
    audioRef.current?.pause()
    stopMic()
    setActiveRoomId(null)
    setView('rooms')
    setMembersOpen(false)
    setSettingsOpen(false)
    setDraft('')
    setReplyTo(null)
    showToast('You left the room')
  }

  function broadcastTyping(isTyping) {
    if (!activeRoomId || !currentUserId) return
    channelRef.current?.postMessage({
      type: 'typing',
      sender: tabIdRef.current,
      roomId: activeRoomId,
      userId: currentUserId,
      typing: Boolean(isTyping),
    })
  }

  function handleDraft(value) {
    setDraft(value)
    if (!activeRoomId) return
    clearTimeout(typingTimerRef.current)
    if (value.trim()) {
      broadcastTyping(true)
      typingTimerRef.current = setTimeout(() => broadcastTyping(false), 1800)
    } else {
      broadcastTyping(false)
    }
  }

  function sendMessage() {
    if (!activeRoom || !currentUserId || !draft.trim()) return
    const replySnapshot = replyTo
      ? { id: replyTo.id, name: replyTo.name, handle: replyTo.handle, text: replyTo.text.slice(0, 140) }
      : null
    const message = {
      id: uid('msg'),
      author: currentUserId,
      text: draft.trim().slice(0, 500),
      time: clockNow(),
      reactions: [],
      read: false,
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    }
    setMessages((previous) => ({ ...previous, [activeRoomId]: [...(previous[activeRoomId] || []), message] }))
    channelRef.current?.postMessage({
      type: 'chat',
      roomId: activeRoomId,
      sender: tabIdRef.current,
      message,
    })
    setDraft('')
    setReplyTo(null)
    clearTimeout(typingTimerRef.current)
    broadcastTyping(false)
  }

  function sendVoiceNote({ dataUrl, duration, waveform }) {
    if (!activeRoom || !currentUserId || !dataUrl) return
    const replySnapshot = replyTo
      ? { id: replyTo.id, name: replyTo.name, handle: replyTo.handle, text: replyTo.text || 'Voice note' }
      : null
    const message = {
      id: uid('msg'),
      author: currentUserId,
      type: 'voice',
      text: '',
      voiceData: dataUrl,
      duration: Math.max(1, Number(duration) || 1),
      waveform: Array.isArray(waveform) ? waveform : [],
      time: clockNow(),
      reactions: [],
      read: false,
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    }
    setMessages((previous) => ({ ...previous, [activeRoomId]: [...(previous[activeRoomId] || []), message] }))
    channelRef.current?.postMessage({
      type: 'chat',
      roomId: activeRoomId,
      sender: tabIdRef.current,
      message,
    })
    setReplyTo(null)
    clearTimeout(typingTimerRef.current)
    broadcastTyping(false)
  }

  function deleteMessage(messageId) {
    if (!activeRoomId) return
    setMessages((previous) => ({
      ...previous,
      [activeRoomId]: (previous[activeRoomId] || []).filter((message) => message.id !== messageId),
    }))
    channelRef.current?.postMessage({
      type: 'chat-delete',
      roomId: activeRoomId,
      sender: tabIdRef.current,
      messageId,
    })
    showToast('Message deleted')
  }

  function reactToMessage(messageId, emoji) {
    if (!activeRoomId) return
    const list = messagesRef.current[activeRoomId] || []
    const message = list.find((item) => item.id === messageId)
    if (!message) return
    const reactions = (message.reactions || []).map((reaction) => ({ ...reaction }))
    const found = reactions.findIndex((reaction) => reaction.emoji === emoji)
    if (found >= 0) {
      const existing = reactions[found]
      if (existing.mine) {
        if (existing.count <= 1) reactions.splice(found, 1)
        else reactions[found] = { ...existing, count: existing.count - 1, mine: false }
      } else {
        reactions[found] = { ...existing, count: existing.count + 1, mine: true }
      }
    } else {
      reactions.push({ emoji, count: 1, mine: true })
    }
    const updated = { ...message, reactions }
    setMessages((previous) => ({
      ...previous,
      [activeRoomId]: (previous[activeRoomId] || []).map((item) => (item.id === messageId ? updated : item)),
    }))
    channelRef.current?.postMessage({
      type: 'chat-updated',
      roomId: activeRoomId,
      sender: tabIdRef.current,
      message: updated,
    })
  }

  function rememberPlaylistTrack(candidate) {
    if (!candidate?.id) return
    rememberTrack(candidate)
  }

  function openCreatePlaylist(candidate = null) {
    if (requireAuth({ type: 'createPlaylist', track: candidate }, 'Log in to create playlists.')) return
    setPendingPlaylistTrack(candidate)
    setPlaylistDialog({ mode: 'create', playlist: null })
  }

  function openEditPlaylist(playlist) {
    if (requireAuth({ type: 'library' }, 'Log in to edit playlists.')) return
    setPendingPlaylistTrack(null)
    setPlaylistDialog({ mode: 'edit', playlist })
  }

  function submitPlaylist({ name, description }) {
    if (!currentUserId) return
    if (playlistDialog?.mode === 'edit' && playlistDialog.playlist) {
      const id = playlistDialog.playlist.id
      setPlaylists((previous) => previous.map((playlist) => (
        playlist.id === id ? { ...playlist, name, description } : playlist
      )))
      showToast('Playlist updated')
    } else {
      const playlist = {
        id: uid('playlist'),
        name,
        description,
        trackIds: pendingPlaylistTrack ? [pendingPlaylistTrack.id] : [],
        createdAt: Date.now(),
      }
      if (pendingPlaylistTrack) rememberPlaylistTrack(pendingPlaylistTrack)
      setPlaylists((previous) => [playlist, ...previous])
      setActivePlaylistId(playlist.id)
      setView('library')
      showToast('Playlist created')
    }
    setPlaylistDialog(null)
    setPendingPlaylistTrack(null)
  }

  function deletePlaylist(playlist) {
    if (!playlist) return
    setPlaylists((previous) => previous.filter((item) => item.id !== playlist.id))
    if (activePlaylistId === playlist.id) setActivePlaylistId(null)
    showToast('Playlist deleted')
  }

  function addTrackToPlaylist(playlistId, candidate) {
    if (!candidate?.id) return
    rememberPlaylistTrack(candidate)
    setPlaylists((previous) => previous.map((playlist) => (
      playlist.id === playlistId && !playlist.trackIds.includes(candidate.id)
        ? { ...playlist, trackIds: [...playlist.trackIds, candidate.id] }
        : playlist
    )))
    const playlist = playlists.find((item) => item.id === playlistId)
    showToast(`Added to ${playlist?.name || 'playlist'}`)
    setAddTrack(null)
  }

  function removeTrackFromPlaylist(playlistId, trackId) {
    setPlaylists((previous) => previous.map((playlist) => (
      playlist.id === playlistId
        ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
        : playlist
    )))
    showToast('Removed from playlist')
  }

  function openPlaylist(playlist) {
    if (requireAuth({ type: 'library' }, 'Log in to open your playlists.')) return
    setActivePlaylistId(playlist.id)
    setView('library')
  }

  function playPlaylist(playlist) {
    if (requireAuth(
      { type: 'playPlaylist', playlist },
      'Log in to play your saved playlists.',
    )) return
    if (!playlist?.trackIds?.length) {
      showToast('This playlist is still empty.', 'lock')
      return
    }
    playlist.trackIds.forEach((id) => {
      if (library[id]) rememberPlaylistTrack(library[id])
    })
    playSoloQueue(playlist.trackIds, 0)
  }

  function shufflePlaylist(playlist) {
    if (requireAuth({ type: 'shufflePlaylist', playlist }, 'Log in to play your saved playlists.')) return
    if (!playlist?.trackIds?.length) {
      showToast('This playlist is still empty.', 'lock')
      return
    }
    const shuffled = [...playlist.trackIds]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
    }
    playSoloQueue(shuffled, 0)
    showToast('Shuffling your playlist')
  }

  function toggleLike(trackId) {
    if (!trackId || trackId === 'empty') return
    if (requireAuth({ type: 'like', trackId }, 'Log in to save tracks to your library.')) return
    setLiked((previous) => (
      previous.includes(trackId)
        ? previous.filter((id) => id !== trackId)
        : [trackId, ...previous]
    ))
    showToast(liked.includes(trackId) ? 'Removed from your library' : 'Saved to your library')
  }

  function getPlaybackTime() {
    const audio = audioRef.current
    if (loadedUrlRef.current && audio) return audio.currentTime || 0
    const player = ytPlayerRef.current
    if (player?.getCurrentTime) return player.getCurrentTime() || 0
    return 0
  }

  function getPlaybackDuration() {
    const audio = audioRef.current
    if (loadedUrlRef.current && audio) return Number(audio.duration) || 0
    const player = ytPlayerRef.current
    if (player?.getDuration) return Number(player.getDuration()) || 0
    return 0
  }

  function roomSnapshot(overrides = {}) {
    const roomId = activeRoomRef.current
    if (!roomId) return null
    const index = currentIndexRef.current
    const snapshot = {
      type: 'state',
      roomId,
      sender: tabIdRef.current,
      index,
      trackId: queueIdsRef.current[index] || null,
      isPlaying: isPlayingRef.current,
      time: getPlaybackTime(),
      ts: Date.now(),
      ...overrides,
    }
    writeStorage(ROOM_STATE_KEY, snapshot)
    return snapshot
  }

  function announce(overrides = {}) {
    const snapshot = roomSnapshot(overrides)
    if (snapshot) channelRef.current?.postMessage(snapshot)
  }

  function applyRemoteState(data) {
    if (!data?.roomId || data.roomId !== activeRoomRef.current) return
    const roomQueue = queueIdsRef.current
    let index = typeof data.index === 'number' ? data.index : currentIndexRef.current
    if (typeof data.index !== 'number' && data.trackId) {
      const found = roomQueue.indexOf(data.trackId)
      if (found >= 0) index = found
    }
    if (roomQueue.length) index = Math.max(0, Math.min(index, roomQueue.length - 1))
    const indexChanged = index !== currentIndexRef.current
    if (indexChanged) {
      setCurrentByRoom((previous) => ({ ...previous, [data.roomId]: index }))
      setProgress(0)
    }
    setSyncMs(Math.max(2, Math.min(399, Math.round(Date.now() - (data.ts || Date.now())))))
    const elapsed = data.isPlaying ? Math.max(0, Date.now() - (data.ts || Date.now())) / 1000 : 0
    const target = Math.max(0, (data.time || 0) + elapsed)
    const drift = Math.abs(getPlaybackTime() - target)
    const lateJoin = !hasInteractedRef.current && data.isPlaying
    if (lateJoin) {
      pendingSeekRef.current = target
      setSeekSignal((value) => value + 1)
      setJoinPill({ time: target, roomName: activeRoomRef.current })
      setIsPlaying(Boolean(data.isPlaying))
      return
    }
    if (indexChanged || !data.heartbeat || drift > 0.35) {
      pendingSeekRef.current = target
      setSeekSignal((value) => value + 1)
    }
    if (typeof data.isPlaying === 'boolean') setIsPlaying(data.isPlaying)
    if (data.isPlaying) setJoinPill(null)
  }

  function beginPlayback(key, ids, index, candidate) {
    setCurrentByRoom((previous) => ({ ...previous, [key]: index }))
    setProgress(0)
    setDuration(candidate?.duration || 0)
    pendingSeekRef.current = null
    setJoinPill(null)
    setIsPlaying(true)
    if (candidate?.id) addRecent(candidate.id)
    if (key !== SOLO_ROOM_ID) announce({ index, time: 0, isPlaying: true })
  }

  async function ensurePlayable(candidate) {
    if (!candidate) return null
    if (
      (candidate.streamUrl || candidate.youtubeVideoId) &&
      !isPreviewTrack(candidate) &&
      isFullLengthTrack(candidate) &&
      candidate.status === 'ready'
    ) {
      return candidate
    }
    if (candidate.streamUrl && isPreviewTrack(candidate)) {
      clearResolvedStream(candidate.id)
    }
    setLibrary((previous) => ({
      ...previous,
      [candidate.id]: { ...(previous[candidate.id] || candidate), status: 'resolving' },
    }))
    try {
      const resolved = await resolveFullTrack(candidate)
      if (!resolved || (!resolved.streamUrl && !resolved.youtubeVideoId) || isPreviewTrack(resolved)) {
        throw new Error('No playable full-length source')
      }
      const ready = {
        ...candidate,
        ...resolved,
        id: candidate.id,
        c1: candidate.c1 || resolved.c1,
        c2: candidate.c2 || resolved.c2,
        cover: candidate.cover || resolved.cover || null,
        preview: false,
        needsHydration: false,
        status: 'ready',
      }
      setLibrary((previous) => ({ ...previous, [candidate.id]: ready }))
      saveLibraryEntry(candidate.id, ready)
      return ready
    } catch {
      setLibrary((previous) => ({
        ...previous,
        [candidate.id]: {
          ...(previous[candidate.id] || candidate),
          status: 'error',
          streamUrl: null,
          preview: false,
        },
      }))
      showToast(`Could not find a full stream for “${candidate.title || 'this track'}”.`, 'lock')
      return null
    }
  }

  async function playIndex(index) {
    if (!canControl) {
      lockToast()
      return
    }
    if (!queueIds.length) return
    const bounded = Math.max(0, Math.min(index, queueIds.length - 1))
    const candidate = queue[bounded] || library[queueIds[bounded]] || SEED_BY_ID[queueIds[bounded]]
    if (!candidate) return
    const playable = await ensurePlayable(candidate)
    if (!playable) return
    startPlaybackAt(bounded, playable)
  }

  function startPlaybackAt(index, candidate) {
    const key = activeRoomRef.current || SOLO_ROOM_ID
    beginPlayback(key, queueIdsRef.current, index, candidate)
  }

  async function togglePlay() {
    if (requireAuth({ type: 'togglePlay' }, 'Log in to play full tracks.')) return
    if (!canControl) {
      lockToast()
      return
    }
    if (!queueIds.length) {
      showToast('Add a song to start listening.')
      return
    }
    if (track.id === 'empty') {
      await playIndex(0)
      return
    }
    if (!track.streamUrl && !track.youtubeVideoId) {
      const playable = await ensurePlayable(track)
      if (!playable) return
      startPlaybackAt(currentIndex, playable)
      return
    }
    const next = !isPlaying
    setIsPlaying(next)
    if (next) setJoinPill(null)
    announce({ isPlaying: next, time: getPlaybackTime() })
  }

  async function nextTrack() {
    if (requireAuth({ type: 'next' }, 'Log in to play full tracks.')) return
    if (!canControl) {
      lockToast()
      return
    }
    if (!queueIds.length) return
    await playIndex((currentIndex + 1) % queueIds.length)
  }

  async function previousTrack() {
    if (requireAuth({ type: 'previous' }, 'Log in to play full tracks.')) return
    if (!canControl) {
      lockToast()
      return
    }
    if (getPlaybackTime() > 4) {
      seekTo(0)
      return
    }
    if (!queueIds.length) return
    await playIndex((currentIndex - 1 + queueIds.length) % queueIds.length)
  }

  function seekTo(seconds) {
    if (!canControl) {
      lockToast()
      return
    }
    if (!track.streamUrl && !track.youtubeVideoId) return
    const total = duration || track.duration || 0
    const target = Math.max(0, Math.min(Number(seconds) || 0, total || Number(seconds) || 0))
    const audio = audioRef.current
    if (track.streamUrl && audio) {
      try {
        audio.currentTime = target
      } catch {
        pendingSeekRef.current = target
        setSeekSignal((value) => value + 1)
      }
    } else if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(target, true)
    }
    setProgress(target)
    setJoinPill(null)
    announce({ time: target })
  }

  function handleVolume(value) {
    setVolume(value)
    setMuted(value === 0)
  }

  function handleEnded() {
    if (inRoom && !canControl) {
      setIsPlaying(false)
      return
    }
    if (!queueIds.length) {
      setIsPlaying(false)
      setProgress(0)
      return
    }
    const nextIndex = (currentIndex + 1) % queueIds.length
    const candidate = queue[nextIndex] || library[queueIds[nextIndex]] || SEED_BY_ID[queueIds[nextIndex]]
    if (!candidate) {
      setIsPlaying(false)
      return
    }
    ensurePlayable(candidate).then((playable) => {
      if (playable) startPlaybackAt(nextIndex, playable)
      else setIsPlaying(false)
    })
  }

  function clearStallTimer() {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
  }

  function handleAudioBuffering() {
    if (!track?.streamUrl || !isPlayingRef.current) return
    setBuffering(true)
    if (stallTimerRef.current) return
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null
      recoverCurrentStream('stalled')
    }, 4000)
  }

  function handleAudioReady() {
    clearStallTimer()
    setBuffering(false)
    setStreamRecovering(false)
    recoveryRef.current.active = false
  }

  async function recoverCurrentStream(reason = 'error') {
    const current = library[track?.id] || track
    if (!current?.id || current.id === 'empty') return
    if (!current.streamUrl && !current.youtubeVideoId) return
    if (recoveryRef.current.active) return
    if (recoveryRef.current.id === current.id && Date.now() - recoveryRef.current.at < 10000) return
    const resumeTime = Math.max(0, getPlaybackTime() || 0)
    const wasPlaying = isPlayingRef.current
    recoveryRef.current = { id: current.id, at: Date.now(), active: true }
    clearStallTimer()
    setBuffering(true)
    setStreamRecovering(true)
    evictLibraryEntry(current.id)
    clearResolvedStream(current.id)
    if (current.youtubeVideoId) clearResolvedStream(`yt:${current.youtubeVideoId}`)
    if (current.providerId) clearResolvedStream(`jio:${current.providerId}`)
    setLibrary((previous) => ({
      ...previous,
      [current.id]: {
        ...(previous[current.id] || current),
        streamUrl: null,
        status: 'resolving',
        preview: false,
      },
    }))
    if (reason === 'stalled') showToast('Stream stalled — finding a working source…')
    try {
      const resolved = await ensurePlayable({
        ...current,
        streamUrl: null,
        preview: false,
        needsHydration: true,
        status: 'pending',
      })
      if (!resolved?.streamUrl && !resolved?.youtubeVideoId) {
        setIsPlaying(false)
        setBuffering(false)
        setStreamRecovering(false)
        showToast('Playback stopped — no alternate source answered.', 'lock')
        return
      }
      pendingSeekRef.current = resumeTime
      setSeekSignal((value) => value + 1)
      setDuration(resolved.duration || current.duration || 0)
      if (wasPlaying) setIsPlaying(true)
      showToast('Recovered playback with a fresh stream')
    } catch {
      setIsPlaying(false)
      setBuffering(false)
      setStreamRecovering(false)
      showToast('That stream did not load. Try the next track.', 'lock')
    } finally {
      recoveryRef.current.active = false
      recoveryRef.current.at = Date.now()
    }
  }

  function handleAudioError() {
    setBuffering(false)
    if (!loadedUrlRef.current) return
    recoverCurrentStream('error')
  }

  function acceptJoin() {
    const stored = loadRoomStateSnapshot()
    let target = joinPill?.time || 0
    if (stored?.roomId === activeRoomId && stored.ts) {
      target = (stored.time || 0) + (stored.isPlaying ? Math.max(0, Date.now() - stored.ts) / 1000 : 0)
    }
    pendingSeekRef.current = target
    setSeekSignal((value) => value + 1)
    setIsPlaying(true)
    setJoinPill(null)
  }

  function addToActiveQueue(candidate) {
    if (!candidate?.id) return { ids: queueIds, index: -1 }
    rememberTrack(candidate)
    if (inRoom) {
      const ids = activeRoom.trackIds.includes(candidate.id)
        ? activeRoom.trackIds
        : [...activeRoom.trackIds, candidate.id]
      const index = ids.indexOf(candidate.id)
      if (!activeRoom.trackIds.includes(candidate.id)) {
        const nextRoom = { ...activeRoom, trackIds: ids }
        setRooms((previous) => previous.map((room) => (room.id === nextRoom.id ? nextRoom : room)))
        broadcastRoom(nextRoom)
      }
      return { ids, index }
    }
    const ids = soloQueue.includes(candidate.id) ? soloQueue : [...soloQueue, candidate.id]
    if (!soloQueue.includes(candidate.id)) setSoloQueue(ids)
    return { ids, index: ids.indexOf(candidate.id) }
  }

  async function playSearchTrack(candidate) {
    if (!candidate) return
    if (!inRoom && requireAuth(
      { type: 'playSolo', track: candidate },
      'Sign up to play full-length tracks. Your first listen starts right after.',
      'signup',
    )) return
    if (inRoom && !canControl) {
      lockToast()
      return
    }
    const playable = await ensurePlayable(candidate)
    if (!playable) return
    if (inRoom) {
      const { ids, index } = addToActiveQueue(playable)
      beginPlayback(activeRoom.id, ids, index, playable)
    } else {
      const ids = soloQueue.includes(playable.id) ? soloQueue : [...soloQueue, playable.id]
      const index = ids.indexOf(playable.id)
      setActiveRoomId(null)
      setSoloQueue(ids)
      setView((current) => (current === 'rooms' ? 'home' : current))
      beginPlayback(SOLO_ROOM_ID, ids, index, playable)
    }
    setSearchOpen(false)
    showToast(`Playing “${playable.title}”`)
  }

  function queueSearchTrack(candidate) {
    if (!candidate) return
    if (!inRoom && requireAuth(
      { type: 'queueSolo', track: candidate },
      'Log in to build your queue.',
    )) return
    if (inRoom && !canControl) {
      lockToast()
      return
    }
    const playable = ensurePlayable(candidate)
    playable.then((ready) => {
      if (!ready) return
      if (inRoom) {
        const ids = activeRoom.trackIds.includes(ready.id)
          ? activeRoom.trackIds
          : [...activeRoom.trackIds, ready.id]
        if (!activeRoom.trackIds.includes(ready.id)) {
          const nextRoom = { ...activeRoom, trackIds: ids }
          setRooms((previous) => previous.map((room) => (room.id === nextRoom.id ? nextRoom : room)))
          broadcastRoom(nextRoom)
        }
        showToast(`Added “${ready.title}” to ${activeRoom.name}`)
      } else {
        if (!soloQueue.includes(ready.id)) setSoloQueue((previous) => [...previous, ready.id])
        showToast(`Added “${ready.title}” to your queue`)
      }
    })
    setSearchOpen(false)
  }

  async function playSoloQueue(ids, startIndex = 0) {
    if (requireAuth({ type: 'togglePlay' }, 'Log in to play full tracks.')) return
    const clean = ids.filter(Boolean)
    if (!clean.length) return
    const index = Math.max(0, Math.min(startIndex, clean.length - 1))
    const candidate = library[clean[index]] || SEED_BY_ID[clean[index]]
    if (!candidate) return
    audioRef.current?.pause()
    setIsPlaying(false)
    setActiveRoomId(null)
    setSoloQueue(clean)
    setCurrentByRoom((previous) => ({ ...previous, [SOLO_ROOM_ID]: index }))
    setProgress(0)
    setDuration(candidate.duration || 0)
    const playable = await ensurePlayable(candidate)
    if (!playable) return
    beginPlayback(SOLO_ROOM_ID, clean, index, playable)
  }

  async function playSoloTrack(candidate) {
    if (!candidate?.id) return
    if (requireAuth(
      { type: 'playSolo', track: candidate },
      'Sign up to play full-length tracks. Your first listen starts right after.',
      'signup',
    )) return
    const playable = await ensurePlayable(candidate)
    if (!playable) return
    const ids = soloQueue.includes(playable.id) ? soloQueue : [...soloQueue, playable.id]
    const index = ids.indexOf(playable.id)
    audioRef.current?.pause()
    setIsPlaying(false)
    setActiveRoomId(null)
    setSoloQueue(ids)
    beginPlayback(SOLO_ROOM_ID, ids, index, playable)
  }

  function queueSoloTrack(candidate) {
    if (!candidate?.id) return
    if (requireAuth({ type: 'queueSolo', track: candidate }, 'Log in to build your queue.')) return
    rememberTrack(candidate)
    if (!soloQueue.includes(candidate.id)) {
      setSoloQueue((previous) => [...previous, candidate.id])
      showToast(`Added “${candidate.title}” to your queue`)
    }
  }

  async function findFullVersion(targetTrack) {
    if (!targetTrack || !canControl) {
      if (!canControl) lockToast()
      return
    }
    const current = library[targetTrack.id] || targetTrack
    const resumeTime = isPlaying ? getPlaybackTime() : 0
    showToast('Retrying every full-stream source…')
    clearResolvedStream(current.id)
    if (current.youtubeVideoId) clearResolvedStream(`yt:${current.youtubeVideoId}`)
    if (current.providerId) clearResolvedStream(`jio:${current.providerId}`)
    try {
      const resolved = await ensurePlayable({
        ...current,
        streamUrl: null,
        youtubeVideoId: null,
        preview: false,
        needsHydration: true,
        status: 'pending',
      })
      if (!resolved?.streamUrl && !resolved?.youtubeVideoId) {
        showToast('No full-length source is available for this track right now.', 'lock')
        return
      }
      const replacement = {
        ...current,
        ...resolved,
        id: current.id,
        status: 'ready',
        preview: false,
        needsHydration: false,
        c1: current.c1 || resolved.c1,
        c2: current.c2 || resolved.c2,
        cover: current.cover || resolved.cover,
      }
      setLibrary((previous) => ({ ...previous, [current.id]: replacement }))
      saveLibraryEntry(current.id, replacement)
      pendingSeekRef.current = resumeTime
      setSeekSignal((value) => value + 1)
      setDuration(replacement.duration || 0)
      showToast(`Full version ready — “${replacement.title}”`)
    } catch {
      showToast('Could not reach the music sources just now.', 'lock')
    }
  }

  const youtubeActive = Boolean(track?.youtubeVideoId && !track?.streamUrl)

  useEffect(() => {
    let cancelled = false
    if (!currentUser || !track?.title || !track?.artist || track.id === 'empty') {
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
  }, [lyricsKey, track?.title, track?.artist, lyricsRefresh, currentUser])

  useEffect(() => {
    if (!translateOn) {
      setTranslating(false)
      return undefined
    }
    if (lyrics.status !== 'ready' || !['synced', 'plain'].includes(lyrics.type) || !lyrics.lines?.length) return undefined
    if (lyrics.lines.every((line) => line.enText || !line.text?.trim())) return undefined
    const curated = CURATED_TRANSLATIONS[track?.id] || []
    if (curated.length) {
      setLyrics((previous) => ({
        ...previous,
        lines: previous.lines.map((line, index) => (
          curated[index] && !line.enText ? { ...line, enText: curated[index] } : line
        )),
      }))
    }
    let cancelled = false
    setTranslating(true)
    const publish = (next) => {
      if (cancelled) return
      setLyrics((previous) => (
        previous.status === 'ready' && ['synced', 'plain'].includes(previous.type)
          ? { ...previous, lines: next }
          : previous
      ))
    }
    translateLines(lyrics.lines, track, publish)
      .then(publish)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTranslating(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateOn, lyricsKey, lyrics.status, lyrics.type, lyricsRefresh])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const sourceUrl = track?.streamUrl || ''
    clearStallTimer()
    setBuffering(false)
    if (!sourceUrl) {
      audio.pause()
      if (loadedUrlRef.current) {
        audio.removeAttribute('src')
        audio.load()
      }
      loadedUrlRef.current = ''
      return
    }
    if (loadedUrlRef.current === sourceUrl) return
    loadedUrlRef.current = sourceUrl
    audio.src = sourceUrl
    audio.load()
    setProgress(0)
    setDuration(track?.duration || 0)
  }, [track?.streamUrl, track?.duration])

  useEffect(() => {
    if (!youtubeActive || !ytContainerRef.current) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy()
        } catch {
          /* ignore a partially-created player */
        }
        ytPlayerRef.current = null
      }
      return undefined
    }
    const container = ytContainerRef.current
    container.innerHTML = ''
    const host = document.createElement('div')
    container.appendChild(host)
    let cancelled = false
    let player = null

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !YT?.Player) return
        player = new YT.Player(host, {
          videoId: track.youtubeVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return
              const instance = event.target
              instance.setVolume(Math.round((muted ? 0 : volume) * 100))
              if (pendingSeekRef.current != null) instance.seekTo(pendingSeekRef.current, true)
              const total = instance.getDuration?.() || 0
              if (total > 0) setDuration(total)
              if (isPlayingRef.current) instance.playVideo()
            },
            onStateChange: (event) => {
              if (cancelled) return
              if (event.data === 0) {
                handleEndedRef.current?.()
              } else if (event.data === 1) {
                const total = event.target.getDuration?.() || 0
                if (total > 0) setDuration(total)
                setIsPlaying(true)
              }
            },
            onError: () => {
              if (cancelled) return
              showToast('The video engine failed — finding another source.', 'lock')
              if (isPlayingRef.current) recoverCurrentStream('video')
            },
          },
        })
        ytPlayerRef.current = player
      })
      .catch(() => {
        if (!cancelled) showToast('YouTube playback is unavailable right now.', 'lock')
      })

    return () => {
      cancelled = true
      try {
        player?.destroy()
      } catch {
        /* ignore */
      }
      if (ytPlayerRef.current === player) ytPlayerRef.current = null
      host.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeActive, track?.youtubeVideoId])

  useEffect(() => {
    if (!currentUser) return
    const audio = audioRef.current
    if (youtubeActive) {
      audio?.pause()
      const player = ytPlayerRef.current
      if (player?.playVideo) {
        if (isPlaying) player.playVideo()
        else player.pauseVideo()
      }
      return
    }
    if (!track?.streamUrl || !audio) return
    if (isPlaying) {
      const playback = audio.play()
      if (playback?.then) {
        playback.catch(() => {
          setIsPlaying(false)
          if (!hasInteractedRef.current) {
            setJoinPill({ time: getPlaybackTime(), roomName: activeRoomRef.current })
          } else {
            showToast('Playback was blocked. Press play once to continue.')
          }
        })
      }
    } else {
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, track?.streamUrl, youtubeActive, currentUser])

  useEffect(() => {
    const target = pendingSeekRef.current
    if (target == null) return undefined
    if (track?.streamUrl) {
      const audio = audioRef.current
      if (!audio) return undefined
      if (audio.readyState >= 1) {
        try {
          audio.currentTime = target
        } catch {
          /* ignore unseekable streams */
        }
        pendingSeekRef.current = null
        return undefined
      }
      const apply = () => {
        try {
          audio.currentTime = target
        } catch {
          /* ignore */
        }
        pendingSeekRef.current = null
      }
      audio.addEventListener('loadedmetadata', apply, { once: true })
      return () => audio.removeEventListener('loadedmetadata', apply)
    }
    if (youtubeActive && ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(target, true)
      pendingSeekRef.current = null
    }
    return undefined
  }, [seekSignal, track?.streamUrl, youtubeActive])

  useEffect(() => {
    const audio = audioRef.current
    const duckRatio = Math.max(0.05, Math.min(1, (settings.duckLevel || 20) / 100))
    const shouldDuck = speaking || remoteSpeaking || voiceNotePlaying
    const target = muted ? 0 : shouldDuck ? volume * duckRatio : volume
    const player = ytPlayerRef.current
    if (player?.setVolume) {
      player.setVolume(Math.round(target * 100))
      if (muted) player.mute?.()
      else player.unMute?.()
    }
    if (!audio) return undefined
    const start = audio.volume
    const startedAt = performance.now()
    let frame = 0
    const tick = (now) => {
      const ratio = Math.min(1, (now - startedAt) / 240)
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * ratio))
      if (ratio < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [speaking, remoteSpeaking, voiceNotePlaying, volume, muted, settings.duckLevel])

  useEffect(() => {
    if (!youtubeActive) return undefined
    const timer = setInterval(() => {
      const player = ytPlayerRef.current
      if (!player?.getCurrentTime) return
      const time = player.getCurrentTime() || 0
      setProgress(time)
      const total = player.getDuration?.() || 0
      if (total > 0) setDuration(total)
      if (isPlayingRef.current && player.getPlayerState) {
        const state = player.getPlayerState()
        if (state === 1) {
          handleAudioReady()
        } else if (state === 3 || state === 5) {
          setBuffering(true)
          if (!stallTimerRef.current) {
            stallTimerRef.current = setTimeout(() => {
              stallTimerRef.current = null
              recoverCurrentStream('video')
            }, 4000)
          }
        }
      }
    }, 500)
    return () => {
      clearInterval(timer)
      clearStallTimer()
    }
  }, [youtubeActive])

  useEffect(() => {
    if (!currentUserId || !isPlaying || !track?.id || track.id === 'empty') return
    addRecent(track.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, isPlaying, track?.id])

  function cleanupRemoteAudio(key) {
    const entry = remoteAudioQueueRef.current.entries[key]
    if (!entry) return
    delete remoteAudioQueueRef.current.entries[key]
    try {
      entry.audio.pause()
      entry.audio.removeAttribute('src')
      entry.audio.load()
    } catch {
      /* already detached */
    }
    if (entry.url) URL.revokeObjectURL(entry.url)
  }

  function cleanupAllRemoteVoice() {
    Object.keys(remoteAudioQueueRef.current.entries).forEach((key) => cleanupRemoteAudio(key))
    Object.values(remoteVoiceTimersRef.current).forEach((timer) => clearTimeout(timer))
    remoteVoiceTimersRef.current = {}
    setRemoteVoice({})
  }

  function drainRemoteAudio(key) {
    const entry = remoteAudioQueueRef.current.entries[key]
    if (!entry || entry.failed) return
    const sourceBuffer = entry.sourceBuffer
    if (!sourceBuffer || sourceBuffer.updating) return
    if (entry.queue.length) {
      const chunk = entry.queue.shift()
      try {
        sourceBuffer.appendBuffer(chunk)
      } catch {
        entry.failed = true
      }
      return
    }
    if (entry.ended && entry.mediaSource?.readyState === 'open') {
      try { entry.mediaSource.endOfStream() } catch { /* already ending */ }
    }
  }

  function pushRemoteAudioChunk(data) {
    if (data.roomId !== activeRoomRef.current || data.sender === tabIdRef.current) return
    const key = `${data.roomId}:${data.userId}`
    let entry = remoteAudioQueueRef.current.entries[key]
    if (!entry) {
      const audio = new Audio()
      audio.autoplay = true
      audio.preload = 'auto'
      entry = {
        key,
        audio,
        mediaSource: null,
        sourceBuffer: null,
        url: '',
        queue: [],
        ended: false,
        failed: false,
        mimeType: data.mimeType || 'audio/webm;codecs=opus',
      }
      remoteAudioQueueRef.current.entries[key] = entry
      audio.addEventListener('ended', () => cleanupRemoteAudio(key))
      const canStream = typeof MediaSource !== 'undefined'
        && MediaSource.isTypeSupported?.(entry.mimeType)
      if (canStream) {
        entry.mediaSource = new MediaSource()
        entry.url = URL.createObjectURL(entry.mediaSource)
        audio.src = entry.url
        entry.mediaSource.addEventListener('sourceopen', () => {
          if (!entry.mediaSource || remoteAudioQueueRef.current.entries[key] !== entry) return
          try {
            entry.sourceBuffer = entry.mediaSource.addSourceBuffer(entry.mimeType)
            entry.sourceBuffer.addEventListener('updateend', () => drainRemoteAudio(key))
          } catch {
            entry.failed = true
          }
          drainRemoteAudio(key)
        }, { once: true })
        audio.play().catch(() => {})
      } else {
        entry.failed = true
      }
    }
    if (data.chunk) {
      try {
        entry.queue.push(new Uint8Array(data.chunk))
        drainRemoteAudio(key)
      } catch {
        entry.failed = true
      }
    }
  }

  function stopRemoteAudio(roomId, userId) {
    const key = `${roomId}:${userId}`
    const entry = remoteAudioQueueRef.current.entries[key]
    if (!entry) return
    entry.ended = true
    drainRemoteAudio(key)
    setTimeout(() => cleanupRemoteAudio(key), 1400)
  }

  function markRemoteVoice(roomId, userId) {
    if (roomId !== activeRoomRef.current || userId === currentUserRef.current?.id) return
    setRemoteVoice((previous) => (previous[userId] ? previous : { ...previous, [userId]: true }))
    clearTimeout(remoteVoiceTimersRef.current[userId])
    remoteVoiceTimersRef.current[userId] = setTimeout(() => {
      setRemoteVoice((previous) => {
        const next = { ...previous }
        delete next[userId]
        return next
      })
      delete remoteVoiceTimersRef.current[userId]
      stopRemoteAudio(roomId, userId)
    }, 1500)
  }

  useEffect(() => {
    cleanupAllRemoteVoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel('echosync-room-sync')
    channelRef.current = channel

    channel.onmessage = (event) => {
      const data = event.data
      if (!data || data.sender === tabIdRef.current) return

      if (data.type === 'invite' && data.invite) {
        setInvites((previous) => (
          previous.some((invite) => invite.id === data.invite.id)
            ? previous
            : [...previous, data.invite]
        ))
        if (data.invite.toUserId === currentUserRef.current?.id) {
          showToast(`@${data.invite.fromHandle || 'a listener'} invited you to ${data.invite.roomName}`)
        }
        return
      }

      if (data.type === 'invite-resolved' && data.inviteId) {
        setInvites((previous) => previous.filter((invite) => invite.id !== data.inviteId))
        return
      }

      if (data.type === 'room-added' && data.room) {
        const incoming = normalizeRoom(data.room)
        if (!incoming) return
        setRooms((previous) => (
          previous.some((room) => room.id === incoming.id) ? previous : [...previous, incoming]
        ))
        return
      }

      if (data.type === 'room-updated' && data.room) {
        const incoming = normalizeRoom(data.room)
        if (!incoming) return
        setRooms((previous) => previous.map((room) => (room.id === incoming.id ? incoming : room)))
        return
      }

      if (data.type === 'room-deleted' && data.roomId) {
        setRooms((previous) => previous.filter((room) => room.id !== data.roomId))
        setInvites((previous) => previous.filter((invite) => invite.roomId !== data.roomId))
        setMessages((previous) => {
          const next = { ...previous }
          delete next[data.roomId]
          return next
        })
        if (activeRoomRef.current === data.roomId) {
          activeRoomRef.current = null
          setActiveRoomId(null)
          setView('home')
          setIsPlaying(false)
          audioRef.current?.pause()
          showToast('That room was closed by its host.', 'lock')
        }
        return
      }

      if (data.type === 'member-changed' && data.roomId) {
        setRooms((previous) => previous.map((room) => (
          room.id === data.roomId
            ? normalizeRoom({ ...room, members: data.members, roles: data.roles || room.roles })
            : room
        )))
        return
      }

      if (data.type === 'role-request' && data.request && data.roomId) {
        setRooms((previous) => previous.map((room) => {
          if (room.id !== data.roomId) return room
          if ((room.requests || []).some((request) => request.id === data.request.id)) return room
          return { ...room, requests: [...(room.requests || []), data.request] }
        }))
        return
      }

      if (data.type === 'role-resolved' && data.roomId) {
        setRooms((previous) => previous.map((room) => {
          if (room.id !== data.roomId) return room
          const requests = data.requestId
            ? (room.requests || []).filter((request) => request.id !== data.requestId)
            : room.requests || []
          const roles = data.roles
            ? data.roles
            : data.approved && data.userId && data.role
              ? { ...(room.roles || {}), [data.userId]: data.role }
              : room.roles
          return { ...room, requests, roles }
        }))
        if (data.userId === currentUserRef.current?.id) {
          showToast(
            data.approved
              ? `You are now ${ROLE_COPY[data.role]?.label || 'a member'} in this room`
              : 'Your role request was declined',
            data.approved ? 'info' : 'lock',
          )
        }
        return
      }

      if (data.type === 'chat' && data.roomId && data.message) {
        setMessages((previous) => {
          const list = previous[data.roomId] || []
          if (list.some((message) => message.id === data.message.id)) return previous
          return { ...previous, [data.roomId]: [...list, data.message] }
        })
        const me = currentUserRef.current
        const text = data.message.text || ''
        if (me && data.message.author !== me.id && text && data.roomId === activeRoomRef.current) {
          const escaped = me.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          if (new RegExp(`@${escaped}(?![\\w.])`, 'i').test(text)) {
            const sender = memberIndexRef.current[data.message.author]
            showToast(`${sender?.name?.split(' ')[0] || 'Someone'} tagged you in the room chat`)
          }
        }
        return
      }

      if (data.type === 'chat-updated' && data.roomId && data.message) {
        setMessages((previous) => ({
          ...previous,
          [data.roomId]: (previous[data.roomId] || []).map((message) => (
            message.id === data.message.id ? data.message : message
          )),
        }))
        return
      }

      if (data.type === 'chat-delete' && data.roomId && data.messageId) {
        setMessages((previous) => ({
          ...previous,
          [data.roomId]: (previous[data.roomId] || []).filter((message) => message.id !== data.messageId),
        }))
        return
      }

      if (data.type === 'voice-live-start' && data.roomId && data.userId) {
        markRemoteVoice(data.roomId, data.userId, data.mimeType)
        return
      }

      if (data.type === 'voice-chunk' && data.roomId && data.userId) {
        markRemoteVoice(data.roomId, data.userId, data.mimeType)
        pushRemoteAudioChunk(data)
        return
      }

      if (data.type === 'voice-live-stop' && data.roomId && data.userId) {
        clearTimeout(remoteVoiceTimersRef.current[data.userId])
        delete remoteVoiceTimersRef.current[data.userId]
        setRemoteVoice((previous) => {
          const next = { ...previous }
          delete next[data.userId]
          return next
        })
        stopRemoteAudio(data.roomId, data.userId)
        return
      }

      if (data.type === 'typing' && data.roomId) {
        if (data.roomId !== activeRoomRef.current) return
        if (data.typing) {
          clearTimeout(typingClearRef.current)
          setTyping((previous) => ({ ...previous, [data.roomId]: data.userId }))
          typingClearRef.current = setTimeout(() => {
            setTyping((previous) => {
              const next = { ...previous }
              delete next[data.roomId]
              return next
            })
          }, 2400)
        } else {
          setTyping((previous) => {
            const next = { ...previous }
            delete next[data.roomId]
            return next
          })
        }
        return
      }

      if (data.type === 'join-sync-request' && data.roomId) {
        if (data.roomId === activeRoomRef.current && canControlRef.current) {
          channel.postMessage(roomSnapshot({ heartbeat: false }))
        }
        return
      }

      if (data.type === 'state') applyRemoteState(data)
    }

    return () => {
      channel.close()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!activeRoomRef.current || !canControlRef.current || !isPlayingRef.current) return
      announce({ heartbeat: true })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    handleEndedRef.current = handleEnded
  })

  const cacheInfo = useMemo(() => {
    let bytes = 0
    const keys = [
      STREAM_CACHE_KEY,
      LIBRARY_CACHE_KEY,
      LYRIC_CACHE_KEY,
      TRANSLATION_CACHE_KEY,
      USERS_KEY,
      ROOMS_KEY,
      MESSAGES_KEY,
      PLAYLISTS_KEY,
      RECENT_KEY,
      SETTINGS_KEY,
    ]
    keys.forEach((key) => {
      try {
        bytes += (localStorage.getItem(key) || '').length * 2
      } catch {
        /* ignore */
      }
    })
    const streams = readStorage(STREAM_CACHE_KEY, {})
    const libraryCache = readStorage(LIBRARY_CACHE_KEY, {})
    const translations = readStorage(TRANSLATION_CACHE_KEY, {})
    return {
      size: formatBytes(bytes),
      streams: Object.keys(streams.streams || {}).length + Object.keys(libraryCache || {}).length,
      translations: Object.keys(translations || {}).length,
    }
  }, [cacheRevision, settingsOpen])

  function saveUserSettings(next) {
    const merged = { ...settings, ...next }
    setSettings(merged)
    streamQuality = merged.quality || 'high'
    if (next.autoTranslate !== undefined) setTranslateOn(Boolean(next.autoTranslate))
    showToast('Listening preferences saved')
  }

  function toggleTranslation() {
    const next = !translateOn
    setTranslateOn(next)
    setSettings((previous) => ({ ...previous, autoTranslate: next }))
  }

  function clearAllCaches() {
    clearPlaybackCaches()
    setLibrary(buildInitialLibrary())
    setCacheRevision((value) => value + 1)
    setLyrics({ status: 'idle' })
    setLyricsRefresh((value) => value + 1)
    showToast('Stream, lyric, and translation caches cleared')
  }

  async function toggleMic() {
    if (micOn) {
      stopMic()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('This browser cannot reach a microphone. Try the duck test instead.')
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
      if (activeRoom?.private && activeRoomId && currentUserId && typeof MediaRecorder !== 'undefined') {
        try {
          const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
          const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 24000 } : undefined)
          micRef.current.recorder = recorder
          micRef.current.mimeType = recorder.mimeType || mimeType || 'audio/webm'
          channelRef.current?.postMessage({
            type: 'voice-live-start',
            roomId: activeRoomId,
            userId: currentUserId,
            mimeType: micRef.current.mimeType,
            sender: tabIdRef.current,
          })
          recorder.ondataavailable = async (event) => {
            if (!event.data?.size) return
            try {
              const chunk = await event.data.arrayBuffer()
              channelRef.current?.postMessage({
                type: 'voice-chunk',
                roomId: activeRoomId,
                userId: currentUserId,
                mimeType: micRef.current.mimeType,
                chunk,
                sender: tabIdRef.current,
              })
            } catch {
              /* skip a dropped chunk */
            }
          }
          recorder.start(250)
        } catch {
          showToast('Mic is live locally, but live broadcast is unavailable in this browser.')
        }
      }
      setMicOn(true)
      showToast(activeRoom?.private ? 'Mic is live in the room — music ducks when you speak' : 'Mic is live — music ducks when you speak')
    } catch {
      showToast('Microphone unavailable. Try the duck test to preview voice ducking.')
    }
  }

  function stopMic() {
    if (micRef.current.raf) cancelAnimationFrame(micRef.current.raf)
    if (micRef.current.recorder && micRef.current.recorder.state !== 'inactive') {
      try { micRef.current.recorder.stop() } catch { /* already stopped */ }
    }
    if (activeRoomId && currentUserId) {
      channelRef.current?.postMessage({
        type: 'voice-live-stop',
        roomId: activeRoomId,
        userId: currentUserId,
        sender: tabIdRef.current,
      })
    }
    micRef.current.stream?.getTracks().forEach((streamTrack) => streamTrack.stop())
    micRef.current.ctx?.close()
    micRef.current = { stream: null, ctx: null, analyser: null, raf: null, loudAt: 0, quietAt: 0, recorder: null, mimeType: '' }
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
    showToast(`Duck test: a friend is talking — music dips to ${settings.duckLevel || 20}%`)
  }

  function openAuth(mode = 'signin', reason = '', notice = '') {
    pendingAuthActionRef.current = null
    setAuthMode(mode === 'signup' ? 'signup' : 'signin')
    setAuthReason(reason)
    setAuthNotice(notice)
    setAuthOpen(true)
  }

  function requireAuth(action, reason = 'Log in to continue.', mode = 'signin', notice = '') {
    if (currentUser) return false
    pendingAuthActionRef.current = action || null
    setAuthMode(mode === 'signup' ? 'signup' : 'signin')
    setAuthReason(reason)
    setAuthNotice(notice)
    setAuthOpen(true)
    return true
  }

  function executeAuthIntent(action) {
    if (!action || !currentUser) return
    if (action.type === 'playSolo') {
      if (action.track) playSoloTrack(action.track)
      return
    }
    if (action.type === 'queueSolo') {
      if (action.track) queueSoloTrack(action.track)
      return
    }
    if (action.type === 'playPlaylist') {
      if (action.playlist) playPlaylist(action.playlist)
      return
    }
    if (action.type === 'shufflePlaylist') {
      if (action.playlist) shufflePlaylist(action.playlist)
      return
    }
    if (action.type === 'togglePlay') {
      togglePlay()
      return
    }
    if (action.type === 'next') {
      nextTrack()
      return
    }
    if (action.type === 'previous') {
      previousTrack()
      return
    }
    if (action.type === 'like') {
      toggleLike(action.trackId)
      return
    }
    if (action.type === 'createRoom') {
      setRoomEditor('create')
      return
    }
    if (action.type === 'joinRoom') {
      const target = rooms.find((room) => room.id === action.roomId)
      if (target) joinRoom(target)
      else if (action.roomCode) {
        setPendingRoomCode(action.roomCode)
        setJoinRoomOpen(true)
      }
      return
    }
    if (action.type === 'joinCode') {
      setJoinRoomOpen(true)
      return
    }
    if (action.type === 'library') {
      setView('library')
      return
    }
    if (action.type === 'settings') {
      setSettingsOpen(true)
      return
    }
    if (action.type === 'createPlaylist') {
      openCreatePlaylist(action.track || null)
      return
    }
    if (action.type === 'addToPlaylist') {
      if (action.track) {
        rememberTrack(action.track)
        setAddTrack(action.track)
      }
    }
  }

  function navigateView(nextView) {
    if (nextView === 'library' && requireAuth(
      { type: 'library' },
      'Log in to open your library and saved playlists.',
    )) return
    if (nextView === 'home') {
      setActiveRoomId(null)
      setIsPlaying(false)
      audioRef.current?.pause()
      setJoinPill(null)
      setActivePlaylistId(null)
      setView('home')
    } else {
      setView(nextView)
    }
    if (typeof window !== 'undefined' && window.innerWidth <= 1050) setChatOpen(false)
  }

  function openProfile() {
    if (requireAuth({ type: 'settings' }, 'Log in to manage your profile and listening settings.')) return
    setSettingsOpen(true)
  }

  function requestCreateRoom() {
    if (requireAuth({ type: 'createRoom' }, 'Sign up to host a room and invite friends.', 'signup')) return
    setRoomEditor('create')
  }

  function requestJoinCode() {
    if (requireAuth({ type: 'joinCode' }, 'Log in to join a room with a code.')) return
    setJoinRoomOpen(true)
  }

  function requestAddToPlaylist(candidate) {
    if (!candidate) return
    if (requireAuth({ type: 'addToPlaylist', track: candidate }, 'Log in to save tracks to playlists.')) return
    rememberTrack(candidate)
    setAddTrack(candidate)
    setSearchOpen(false)
  }

  function requestEditRoom() {
    if (requireAuth({ type: 'settings' }, 'Log in to manage room settings.')) return
    setRoomEditor('edit')
  }

  const rootStyle = {
    '--accent': displayRoom.accent || '#f16b73',
    '--accent-2': displayRoom.accent2 || '#f2b38e',
  }

  return (
    <MembersContext.Provider value={memberIndex}>
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
          onCanPlay={handleAudioReady}
          onPlaying={handleAudioReady}
          onWaiting={handleAudioBuffering}
          onStalled={handleAudioBuffering}
          onEnded={handleEnded}
          onError={handleAudioError}
        />
        <YouTubeBridge containerRef={ytContainerRef} />

        <div className={`shell ${shellChatOpen ? '' : 'chat-collapsed'}`}>
          <Sidebar
            room={displayRoom}
            rooms={rooms}
            view={view}
            inRoom={inRoom}
            role={ROLE_COPY[role]?.label || 'Listener'}
            likedCount={likedSet.length}
            currentUser={currentUser}
            playlists={playlists}
            onNavigate={navigateView}
            onSearch={() => setSearchOpen(true)}
            onJoinRoom={joinRoom}
            onJoinCode={requestJoinCode}
            onInvite={copyInvite}
            onCreateRoom={requestCreateRoom}
            onOpenProfile={openProfile}
            onCreatePlaylist={() => openCreatePlaylist()}
            onOpenPlaylist={openPlaylist}
            onLeaveRoom={leaveRoom}
          />

          <main className="stage">
            {joinPill && inRoom && (
              <button className="join-live-pill" onClick={acceptJoin}>
                <span className="join-live-dot" />
                <span>
                  <small>LIVE ROOM PLAYING AT {formatTime(joinPill.time)}</small>
                  <strong>Tap to sync audio immediately</strong>
                </span>
                <AudioLines size={16} />
              </button>
            )}
            <StageBar
              room={displayRoom}
              view={view}
              inRoom={inRoom}
              theme={theme}
              currentUser={currentUser}
              chatOpen={chatOpen}
              onOpenProfile={openProfile}
              onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
              onSearch={() => setSearchOpen(true)}
              onToggleChat={() => setChatOpen((value) => !value)}
              onHome={() => navigateView('home')}
              onLogin={() => openAuth('signin')}
              onSignUp={() => openAuth('signup')}
            />

            <div className="stage-scroll">
              {view === 'home' && (
                <HomeView
                  currentUser={currentUser}
                  library={library}
                  liked={likedSet}
                  recentIds={recent}
                  playlists={playlists}
                  roomCount={rooms.length}
                  onPlayTrack={playSoloTrack}
                  onPlayPlaylist={playPlaylist}
                  onLike={toggleLike}
                  onSearch={() => setSearchOpen(true)}
                  onCreatePlaylist={() => openCreatePlaylist()}
                  onOpenPlaylist={openPlaylist}
                  onCreateRoom={requestCreateRoom}
                  onJoinCode={requestJoinCode}
                />
              )}

              {view === 'rooms' && (
                <RoomsView
                  rooms={rooms}
                  library={library}
                  currentRoom={activeRoom}
                  onJoin={joinRoom}
                  onCreate={requestCreateRoom}
                  onJoinCode={requestJoinCode}
                />
              )}

              {view === 'library' && (
                <LibraryView
                  library={library}
                  liked={likedSet}
                  recentIds={recent}
                  playlists={playlists}
                  currentUser={currentUser}
                  activePlaylistId={activePlaylistId}
                  onSelectPlaylist={setActivePlaylistId}
                  onPlay={playSoloTrack}
                  onLike={toggleLike}
                  onSearch={() => setSearchOpen(true)}
                  onCreatePlaylist={() => openCreatePlaylist()}
                  onPlayPlaylist={playPlaylist}
                  onRenamePlaylist={openEditPlaylist}
                  onDeletePlaylist={deletePlaylist}
                  onRemoveFromPlaylist={removeTrackFromPlaylist}
                  onShufflePlaylist={shufflePlaylist}
                  onOpenPlaylist={openPlaylist}
                />
              )}

              {view === 'room' && activeRoom && (
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
                  currentUser={currentUser}
                  pendingRequest={pendingRequest}
                  roleRequests={activeRoom.requests || []}
                  onRequestRole={requestRole}
                  onResolveRequest={resolveRoleRequest}
                  onOpenMembers={() => setMembersOpen(true)}
                  onOpenSettings={requestEditRoom}
                  onFindFull={findFullVersion}
                  onRetryFull={findFullVersion}
                  onLeaveRoom={leaveRoom}
                  onLock={lockToast}
                  onTogglePlay={togglePlay}
                  onNext={nextTrack}
                  onPrev={previousTrack}
                  onSeek={seekTo}
                  onVolume={handleVolume}
                  onToggleMute={() => setMuted((value) => !value)}
                  onLike={toggleLike}
                  onInvite={() => setMembersOpen(true)}
                  onSearch={() => setSearchOpen(true)}
                  onPlayIndex={playIndex}
                  onOpenFull={() => setFullPlayer(true)}
                />
              )}
            </div>

            <PlayerDock
              track={track}
              inRoom={inRoom}
              isPlaying={isPlaying}
              buffering={buffering || streamRecovering}
              progress={progress}
              duration={duration}
              liked={likedSet}
              syncMs={syncMs}
              volume={volume}
              muted={muted}
              onTogglePlay={togglePlay}
              onPrev={previousTrack}
              onNext={nextTrack}
              onLike={toggleLike}
              onVolume={handleVolume}
              onToggleMute={() => setMuted((value) => !value)}
              onOpenFull={() => setFullPlayer(true)}
            />

            <MobileNav
              view={view}
              inRoom={inRoom}
              chatOpen={chatOpen}
              onNavigate={navigateView}
              onSearch={() => setSearchOpen(true)}
              onChat={() => {
                setActiveTab('chat')
                setChatOpen(true)
              }}
            />
          </main>

          {inRoom && (
            <ChatPanel
              room={activeRoom}
              activeTab={activeTab}
              onTab={setActiveTab}
              messages={roomMessages}
              typingMemberId={typingMemberId}
              draft={draft}
              onDraft={handleDraft}
              onSend={sendMessage}
              onSendVoice={sendVoiceNote}
              onVoiceNotePlay={setVoiceNotePlaying}
              onReact={reactToMessage}
              onClose={() => setChatOpen(false)}
              track={track}
              lyrics={lyrics}
              progress={progress}
              canControl={canControl}
              onSeek={seekTo}
              onLock={lockToast}
              onRetryLyrics={() => setLyricsRefresh((value) => value + 1)}
              onDeleteMessage={deleteMessage}
              onReply={(message) => {
                const author = memberIndex[message.author] || {}
                setReplyTo({
                  id: message.id,
                  name: author.name || 'Listener',
                  handle: author.handle || 'listener',
                  text: message.type === 'voice' ? 'Voice note' : message.text,
                })
              }}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              currentUser={currentUser}
              canModerate={canModerate}
              memberRoles={activeRoom.roles || {}}
              translateOn={translateOn}
              translating={translating}
              onToggleTranslate={toggleTranslation}
              micOn={micOn}
              micLevel={micOn ? micLevel : remoteSpeaking ? 0.62 : 0}
              speaking={voiceSpeaking}
              duckTest={duckTest}
              onToggleMic={toggleMic}
              onDuckTest={runDuckTest}
              duckLevel={settings.duckLevel}
              open={chatOpen}
            />
          )}
          {shellChatOpen && <div className="chat-scrim" onClick={() => setChatOpen(false)} />}
        </div>

        {pendingInvite && (
          <InviteBanner
            invite={pendingInvite}
            onAccept={() => resolveInvite(pendingInvite.id, true)}
            onDecline={() => resolveInvite(pendingInvite.id, false)}
          />
        )}

        {moderatorRequest && activeRoom && (
          <RoleRequestPopup
            request={moderatorRequest}
            requester={memberIndex[moderatorRequest.userId]}
            roomName={activeRoom.name}
            onApprove={() => resolveRoleRequest(moderatorRequest.id, true)}
            onDecline={() => resolveRoleRequest(moderatorRequest.id, false)}
          />
        )}

        {searchOpen && (
          <SearchOverlay
            onClose={() => setSearchOpen(false)}
            onPlay={playSearchTrack}
            onQueue={queueSearchTrack}
            onAddToPlaylist={requestAddToPlaylist}
          />
        )}

        {fullPlayer && (
          <FullPlayer
            room={displayRoom}
            inRoom={inRoom}
            track={track}
            queue={queue}
            isPlaying={isPlaying}
            buffering={buffering || streamRecovering}
            progress={progress}
            duration={duration}
            syncMs={syncMs}
            volume={volume}
            muted={muted}
            liked={likedSet}
            lyrics={lyrics}
            canControl={canControl}
            onClose={() => setFullPlayer(false)}
            onTogglePlay={togglePlay}
            onPrev={previousTrack}
            onNext={nextTrack}
            onSeek={seekTo}
            onLock={lockToast}
            onLike={toggleLike}
            onVolume={handleVolume}
            onToggleMute={() => setMuted((value) => !value)}
            onRetryLyrics={() => setLyricsRefresh((value) => value + 1)}
            translateOn={translateOn}
            translating={translating}
            onToggleTranslate={toggleTranslation}
          />
        )}

        {settingsOpen && currentUser && (
          <SettingsModal
            user={currentUser}
            settings={settings}
            cacheInfo={cacheInfo}
            stats={{
              playlists: playlists.length,
              liked: likedSet.length,
              rooms: rooms.filter((room) => room.createdBy === currentUserId).length,
            }}
            onClose={() => setSettingsOpen(false)}
            onSaveProfile={saveProfile}
            onSaveSettings={saveUserSettings}
            onClearCache={clearAllCaches}
            onSignOut={signOut}
          />
        )}

        {membersOpen && activeRoom && (
          <MembersModal
            room={activeRoom}
            currentUserId={currentUserId}
            canModerate={canModerate}
            roles={activeRoom.roles || {}}
            members={memberIndex}
            users={publicUsers}
            requests={activeRoom.requests || []}
            onClose={() => setMembersOpen(false)}
            onInviteUser={inviteUser}
            onCopyLink={() => showToast('Invite link copied')}
            onKick={kickMember}
            onAssignRole={assignRole}
            onResolveRequest={resolveRoleRequest}
          />
        )}

        {roomEditor === 'edit' && activeRoom && (
          <RoomModal
            mode="edit"
            room={activeRoom}
            onClose={() => setRoomEditor(null)}
            onUpdate={updateRoom}
            onDelete={deleteRoom}
          />
        )}

        {roomEditor === 'create' && (
          <RoomModal
            mode="create"
            onClose={() => setRoomEditor(null)}
            onCreate={createRoom}
          />
        )}

        {joinRoomOpen && currentUser && (
          <JoinRoomModal
            onClose={() => setJoinRoomOpen(false)}
            onJoin={joinRoomByCode}
          />
        )}

        {passcodeRoomId && (
          <PasscodeModal
            room={rooms.find((room) => room.id === passcodeRoomId)}
            onClose={() => setPasscodeRoomId(null)}
            onUnlock={unlockPrivateRoom}
          />
        )}

        {authOpen && (
          <AuthModal
            mode={authMode}
            reason={authReason}
            notice={authNotice}
            pendingRoom={pendingRoomCode ? normalizeRoomCode(pendingRoomCode) : ''}
            onClose={() => {
              setAuthOpen(false)
              pendingAuthActionRef.current = null
              setAuthReason('')
              setAuthNotice('')
            }}
            onSwitch={(mode) => {
              setAuthMode(mode)
              setAuthReason('')
              setAuthNotice('')
            }}
            onSignIn={signIn}
            onSignUp={signUp}
          />
        )}

        {playlistDialog && (
          <PlaylistModal
            mode={playlistDialog.mode}
            playlist={playlistDialog.playlist}
            onClose={() => {
              setPlaylistDialog(null)
              setPendingPlaylistTrack(null)
            }}
            onSubmit={submitPlaylist}
          />
        )}

        {addTrack && (
          <AddToPlaylistModal
            track={addTrack}
            playlists={playlists}
            onClose={() => setAddTrack(null)}
            onAdd={(playlistId) => addTrackToPlaylist(playlistId, addTrack)}
            onCreate={(candidate) => {
              setAddTrack(null)
              openCreatePlaylist(candidate)
            }}
          />
        )}

        <Toast toast={toast} />
      </div>
    </MembersContext.Provider>
  )
}
