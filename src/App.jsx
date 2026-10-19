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
} from 'lucide-react'

const SAAVN_BASES = ['https://saavn.sumit.co']
let saavnCooldownUntil = 0
const ITUNES_BASE = 'https://itunes.apple.com/search'
const LRCLIB_BASE = 'https://lrclib.net/api'
const LIBRARY_CACHE_KEY = 'echosync.library.v1'
const LYRIC_CACHE_KEY = 'echosync.lyrics.v1'
const LIKES_KEY = 'echosync.likes.v1'
const THEME_KEY = 'echosync.theme.v1'
const ACCOUNTS_KEY = 'echosync_accounts'
const ACTIVE_USER_KEY = 'echosync_active_user'
const ROOMS_KEY = 'echosync_rooms.v1'
const ROOM_STATE_KEY = 'echosync_room_state.v1'
const TRANSLATE_KEY = 'echosync_translate.v1'
const TRANSLATION_CACHE_KEY = 'echosync.translation_cache.v1'
const LOCK_MESSAGE = '🔒 Listener Mode: Only Room Admin or DJ can control playback'

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

function roomCode(seed = '') {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `ECHO-${code}${seed ? seed.slice(-2).toUpperCase() : ''}`.slice(0, 11)
}

function handleFromEmail(email = '') {
  return slugifyHandle(String(email).split('@')[0])
}

function nameFromEmail(email = '') {
  const prefix = String(email).split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (!prefix) return 'New Listener'
  return prefix.split(' ').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
}

function readSessionUser() {
  try {
    return sessionStorage.getItem(ACTIVE_USER_KEY) || localStorage.getItem(ACTIVE_USER_KEY) || 'me'
  } catch {
    return 'me'
  }
}

function writeSessionUser(id) {
  try {
    sessionStorage.setItem(ACTIVE_USER_KEY, id)
    localStorage.setItem(ACTIVE_USER_KEY, id)
  } catch {
    /* session storage can be unavailable */
  }
}

function loadStoredRooms() {
  const stored = readStorage(ROOMS_KEY, null)
  return Array.isArray(stored) && stored.length ? stored : null
}

function loadRoomStateSnapshot() {
  return readStorage(ROOM_STATE_KEY, {})
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
  { id: 'afreen-afreen', title: 'Afreen Afreen', artist: 'Rahat Fateh Ali Khan', album: 'Coke Studio Season 9', duration: 400, allowPreview: true, c1: '#2f2a1d', c2: '#b28e4a', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music71/v4/95/ff/b0/95ffb0d1-ba72-767e-a4e4-6e7989524b03/190394811402.jpg/600x600bb.jpg' },
  { id: 'raataan-lambiyan', title: 'Raataan Lambiyan', artist: 'Jubin Nautiyal', album: 'Shershaah', duration: 230, c1: '#232b35', c2: '#a06a6a', cover: 'https://c.saavncdn.com/238/Shershaah-Original-Motion-Picture-Soundtrack--Hindi-2021-20210815181610-500x500.jpg' },
  { id: 'kabira', title: 'Kabira', artist: 'Tochi Raina', album: 'Yeh Jawaani Hai Deewani', duration: 224, c1: '#2d2a20', c2: '#a88654', cover: 'https://c.saavncdn.com/440/Yeh-Jawaani-Hai-Deewani-2013-500x500.jpg' },
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

const DEFAULT_ACCOUNTS = {
  me: { id: 'me', name: 'Haris Mujahid', handle: 'haris', email: 'haris.mujahid@gmail.com', password: 'echosync', initials: 'HM', av1: '#eda272', av2: '#a14e58', preset: 'rose', online: true },
  usman: { id: 'usman', name: 'Usman Ali', handle: 'usman.ali', email: 'usman.ali@gmail.com', password: 'echosync', initials: 'UA', av1: '#6b9ae7', av2: '#343e87', preset: 'ocean', online: true },
  zara: { id: 'zara', name: 'Zara Khan', handle: 'zara.k', email: 'zara.khan@gmail.com', password: 'echosync', initials: 'ZK', av1: '#db7ea5', av2: '#763e76', preset: 'orchid', online: true },
  bilal: { id: 'bilal', name: 'Bilal Ahmed', handle: 'bilal.ahmed', email: 'bilal.ahmed@gmail.com', password: 'echosync', initials: 'BA', av1: '#60b9a7', av2: '#296d70', preset: 'jade', online: true },
  sana: { id: 'sana', name: 'Sana Iqbal', handle: 'sana.iqbal', email: 'sana.iqbal@gmail.com', password: 'echosync', initials: 'SI', av1: '#d9aa59', av2: '#8d5c34', preset: 'amber', online: true },
  ayaan: { id: 'ayaan', name: 'Ayaan Raza', handle: 'ayaan.r', email: 'ayaan.raza@gmail.com', password: 'echosync', initials: 'AR', av1: '#9187dc', av2: '#514093', preset: 'violet', online: false },
}

function accountDisplay(account) {
  if (!account) return { id: 'guest', name: 'Guest Listener', handle: 'guest', initials: 'GL', av1: '#7d8794', av2: '#3d4650', online: false }
  return {
    ...account,
    initials: account.initials || initials(account.name || account.handle || 'Echo'),
  }
}

const MembersContext = createContext({ ...MEMBERS, ...DEFAULT_ACCOUNTS })

function useMembers() {
  return useContext(MembersContext)
}

function rolesForRoom(room) {
  const matrix = {}
  room.members.forEach((id) => {
    if (id === room.dj) matrix[id] = 'dj'
    else matrix[id] = id === 'me' ? DEFAULT_ROLES[room.id] || 'listener' : 'listener'
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

function roleLabelFor(room, matrix, userId) {
  return matrix?.[room.id]?.[userId] || (userId === 'me' ? DEFAULT_ROLES[room.id] || 'listener' : 'listener')
}

function randomAvatarPreset(seed = '') {
  const value = seed || uid('av')
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) % 9973
  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length]
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
  const stale = []
  SEED_TRACKS.forEach((seed) => {
    const cached = cache[seed.id]
    const stalePreview = cached?.preview && !seed.allowPreview && seed.duration > 60
    if (stalePreview) stale.push(seed.id)
    library[seed.id] = cached && !stalePreview
      ? { ...seed, ...cached, id: seed.id, status: 'ready' }
      : { ...seed, status: 'pending', streamUrl: null, cover: null }
  })
  if (stale.length) {
    const stored = readStorage(LIBRARY_CACHE_KEY, {})
    stale.forEach((id) => delete stored[id])
    writeStorage(LIBRARY_CACHE_KEY, stored)
  }
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
    providerId: raw.id,
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
    if (!track.preview && duration < 40 && seed.duration > 60) return -1
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
  if (Date.now() < saavnCooldownUntil) return track
  for (const base of SAAVN_BASES) {
    try {
      const payload = await fetchJson(`${base}/api/songs/${track.providerId}`, { timeout: 5200 })
      const raw = Array.isArray(payload?.data) ? payload.data[0] : payload?.data?.songs?.[0] || payload?.data
      if (raw?.downloadUrl) {
        const normalized = normalizeSaavn(raw)
        if (normalized.streamUrl) return { ...track, ...normalized, cover: track.cover || normalized.cover }
      }
    } catch (error) {
      if (error?.status === 429) {
        saavnCooldownUntil = Date.now() + 10 * 60 * 1000
        return track
      }
    }
  }
  return track
}

async function fetchJioSearch(query, limit = 12) {
  if (Date.now() < saavnCooldownUntil) return []
  for (const base of SAAVN_BASES) {
    try {
      const payload = await fetchJson(
        `${base}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`,
        { timeout: 4200 },
      )
      const results = payload?.data?.results || payload?.data?.songs?.results || []
      if (Array.isArray(results) && results.length) {
        return results.map(normalizeSaavn)
      }
    } catch (error) {
      if (error?.status === 429) {
        saavnCooldownUntil = Date.now() + 10 * 60 * 1000
        return []
      }
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
  return [...jio.filter((track) => track.streamUrl), ...itunes].filter((track) => {
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
    const searchTitle = seed.searchTitle || seed.title
    const primaryQuery = `${searchTitle} ${seed.artist}`
    const finalize = (best) => ({ ...seed, ...best, id: seed.id, c1: seed.c1, c2: seed.c2, cover: seed.cover || best.cover || null })

    let candidates = await fetchJioSearch(primaryQuery, 16)
    let ranked = rankCandidates(candidates, seed)
    for (const entry of ranked.slice(0, 3)) {
      const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track)
      if (hydrated?.streamUrl) return finalize(hydrated)
    }

    candidates = await fetchItunesSearch(primaryQuery, 16)
    let best = chooseBest(candidates, seed)
    if (best) return finalize(best)

    candidates = await fetchJioSearch(searchTitle, 16)
    ranked = rankCandidates(candidates, seed)
    for (const entry of ranked.slice(0, 3)) {
      const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track)
      if (hydrated?.streamUrl) return finalize(hydrated)
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

async function translateLine(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`
  const payload = await fetchJson(url, { timeout: 3500 })
  const pieces = Array.isArray(payload?.[0]) ? payload[0] : []
  return pieces.map((piece) => (Array.isArray(piece) ? piece[0] : '') || '').join('').trim()
}

async function translateLines(lines, track, onProgress) {
  const cache = readStorage(TRANSLATION_CACHE_KEY, {}) || {}
  const curated = CURATED_TRANSLATIONS[track?.id] || []
  const results = [...lines]
  const deadline = Date.now() + 7000
  let cacheDirty = false
  let cursor = 0

  const worker = async () => {
    while (cursor < results.length && Date.now() < deadline) {
      const index = cursor
      cursor += 1
      const line = results[index]
      if (!line?.text?.trim() || line.enText) continue
      if (curated[index]) {
        results[index] = { ...line, enText: curated[index] }
        onProgress?.([...results])
        continue
      }
      const cacheKey = `${track?.id || 'track'}::${index}::${line.text}`
      if (cache[cacheKey]) {
        results[index] = { ...line, enText: cache[cacheKey] }
        continue
      }
      let translated = ''
      try {
        translated = await translateLine(line.text)
      } catch {
        translated = ''
      }
      if (translated && translated.toLowerCase() !== line.text.trim().toLowerCase()) {
        cache[cacheKey] = translated
        cacheDirty = true
        results[index] = { ...line, enText: translated }
        onProgress?.([...results])
      }
    }
  }

  await Promise.all(Array.from({ length: 10 }, () => worker()))
  if (cacheDirty) writeStorage(TRANSLATION_CACHE_KEY, cache)
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
  currentUser,
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
          <button onClick={onCreateRoom} aria-label="Create room"><Plus size={13} /></button>
        </div>
        <div className="room-list">
          {rooms.map((item) => (
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
          <Avatar member={currentUser} online />
          <span className="profile-meta">
            <strong>{currentUser?.name || 'Sign in'}</strong>
            <span>@{currentUser?.handle || 'guest'} · <Crown size={10} /> {role}</span>
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
  currentUser,
  onOpenProfile,
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
        <button className="icon-btn account-mobile" onClick={onOpenProfile} aria-label="Account and profile">
          <Avatar member={currentUser} />
        </button>
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

function RoomsView({ rooms, library, currentRoom, onJoin, onCreate }) {
  return (
    <div className="rooms-view">
      <div className="eyebrow">
        <span className="live-pill"><Radio size={9} /> DISCOVER</span>
        <span className="seg" />
        <span>{String(rooms.length).padStart(2, '0')} ROOMS LIVE</span>
      </div>
      <h1 className="page-title">Find your <em>frequency.</em></h1>
      <p className="page-sub">Small rooms, shared speakers, and a queue that moves together. Step into a room and stay a while.</p>

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
          <div className="plain-lyrics">{lyrics.plain}</div>
        )}

        {lyrics?.status === 'ready' && lyrics.type === 'synced' && (
          <>
            {lyrics.lines.map((line, index) => {
              const translated = translateOn ? line.enText : null
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
            : lyrics?.status === 'loading'
              ? 'finding words…'
              : lyrics?.status === 'error'
                ? 'unavailable'
                : 'time-synced lyrics'}
        </span>
        {lyrics?.status === 'ready' && lyrics.type === 'synced' && onToggleTranslate && (
          <button
            className={`translate-btn ${translateOn ? 'on' : ''}`}
            onClick={onToggleTranslate}
            disabled={translating}
          >
            <Globe />
            {translating ? 'Translating…' : translateOn ? 'Showing English' : 'Translate to English'}
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

function AccountModal({ accounts, currentUserId, currentUser, onClose, onSignIn, onSignUp, onSignOut, onSaveProfile, onSwitchUser }) {
  const [tab, setTab] = useState('profile')
  const [authMode, setAuthMode] = useState('signin')
  const [form, setForm] = useState({
    name: currentUser.name || '',
    email: currentUser.email || '',
    handle: currentUser.handle || '',
    preset: currentUser.preset || 'rose',
    avatarUrl: currentUser.avatarUrl || '',
  })
  const [auth, setAuth] = useState({ name: '', email: '', handle: '', password: '' })
  const [authHint, setAuthHint] = useState('')

  useEffect(() => {
    setForm({
      name: currentUser.name || '',
      email: currentUser.email || '',
      handle: currentUser.handle || '',
      preset: currentUser.preset || 'rose',
      avatarUrl: currentUser.avatarUrl || '',
    })
  }, [currentUser])

  const selectedPreset = AVATAR_PRESETS.find((preset) => preset.id === form.preset) || AVATAR_PRESETS[0]
  const preview = accountDisplay({
    ...currentUser,
    name: form.name || currentUser.name,
    initials: initials(form.name || currentUser.name),
    av1: selectedPreset.av1,
    av2: selectedPreset.av2,
    avatarUrl: form.avatarUrl.trim(),
  })

  const submitProfile = (event) => {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return
    onSaveProfile({
      name,
      email: form.email.trim(),
      handle: slugifyHandle(form.handle || form.email) || currentUser.handle,
      preset: selectedPreset.id,
      av1: selectedPreset.av1,
      av2: selectedPreset.av2,
      avatarUrl: form.avatarUrl.trim(),
    })
  }

  const quickFillFromGoogle = () => {
    const email = auth.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setAuthHint('Enter a Gmail address above, then tap Quick Fill.')
      return
    }
    const existing = Object.values(accounts).find((account) => account.email?.toLowerCase() === email)
    if (existing) {
      setAuth({ name: existing.name, email, handle: existing.handle, password: existing.password })
      setAuthMode('signin')
      setAuthHint(`Welcome back, ${existing.name.split(' ')[0]} — password filled.`)
      return
    }
    setAuth({
      name: nameFromEmail(email),
      email,
      handle: slugifyHandle(handleFromEmail(email)),
      password: '',
      preset: randomAvatarPreset(email).id,
    })
    setAuthMode('signup')
    setAuthHint(`Filled from ${email} — pick a password to create the account.`)
  }

  const submitAuth = (event) => {
    event.preventDefault()
    if (authMode === 'signin') {
      onSignIn(auth.email, auth.password)
      return
    }
    if (!auth.name.trim() || !auth.email.trim() || !auth.password) return
    onSignUp({
      name: auth.name,
      email: auth.email,
      password: auth.password,
      handle: auth.handle,
      preset: auth.preset,
    })
  }

  const demoAccounts = Object.values(accounts).filter((account) => DEFAULT_ACCOUNTS[account.id])

  return (
    <ModalShell onClose={onClose} size="modal-account">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> ACCOUNT</span>
          <h2>{tab === 'profile' ? 'Your listening identity' : 'Sign in or switch'}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close account"><X /></button>
      </div>
      <div className="modal-tabs">
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRoundPlus /> Profile</button>
        <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}><UsersRound /> Accounts</button>
      </div>

      {tab === 'profile' ? (
        <form className="modal-body profile-form" onSubmit={submitProfile}>
          <div className="profile-top">
            <Avatar member={preview} size="avatar-xl" online />
            <div>
              <strong>{preview.name}</strong>
              <span>@{preview.handle} · {preview.email}</span>
              <small>Avatar shows across every room and chat.</small>
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Display name</span>
              <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Your name" />
            </label>
            <label className="field">
              <span>@handle</span>
              <input value={form.handle} onChange={(event) => setForm((value) => ({ ...value, handle: event.target.value }))} placeholder="your.handle" />
            </label>
          </div>
          <label className="field">
            <span>Gmail address</span>
            <input type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} placeholder="you@gmail.com" />
          </label>

          <div className="field">
            <span>Avatar preset</span>
            <div className="preset-grid">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={`preset-swatch ${form.preset === preset.id ? 'selected' : ''}`}
                  style={{ '--av1': preset.av1, '--av2': preset.av2 }}
                  onClick={() => setForm((value) => ({ ...value, preset: preset.id }))}
                  aria-label={`${preset.id} avatar`}
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Or paste an image URL</span>
            <input value={form.avatarUrl} onChange={(event) => setForm((value) => ({ ...value, avatarUrl: event.target.value }))} placeholder="https://…" />
          </label>

          <div className="modal-actions">
            <button type="button" className="text-btn ghosted" onClick={onSignOut}><LogOut size={12} /> Sign out</button>
            <button type="submit" className="primary-btn">Save profile</button>
          </div>
        </form>
      ) : (
        <div className="modal-body auth-body">
          <div className="demo-accounts">
            <span className="modal-hint">Demo accounts · tap to fill</span>
            <div className="demo-chips">
              {demoAccounts.map((account) => (
                <button
                  key={account.id}
                  className={`demo-chip ${account.id === currentUserId ? 'active' : ''}`}
                  onClick={() => {
                    setAuth({ name: account.name, email: account.email, handle: account.handle, password: account.password })
                    setAuthMode('signin')
                  }}
                >
                  <Avatar member={account} size="xs" />
                  <span>{account.name.split(' ')[0]}<small>@{account.handle}</small></span>
                </button>
              ))}
            </div>
          </div>

          <div className="auth-switch">
            <button className={authMode === 'signin' ? 'active' : ''} onClick={() => setAuthMode('signin')}>Sign in</button>
            <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === 'signup' && (
              <label className="field">
                <span>Display name</span>
                <input value={auth.name} onChange={(event) => setAuth((value) => ({ ...value, name: event.target.value }))} placeholder="Your name" />
              </label>
            )}
            <label className="field">
              <span>Gmail address</span>
              <input type="email" value={auth.email} onChange={(event) => setAuth((value) => ({ ...value, email: event.target.value }))} placeholder="you@gmail.com" autoComplete="email" />
            </label>
            <button className="text-btn google-quick" type="button" onClick={quickFillFromGoogle}>
              <Globe size={12} /> Continue with Google (Quick Fill)
            </button>
            {authHint && <span className="modal-hint">{authHint}</span>}
            {authMode === 'signup' && (
              <label className="field">
                <span>@handle (optional)</span>
                <input value={auth.handle} onChange={(event) => setAuth((value) => ({ ...value, handle: event.target.value }))} placeholder="your.handle" />
              </label>
            )}
            <label className="field">
              <span>Password</span>
              <input type="password" value={auth.password} onChange={(event) => setAuth((value) => ({ ...value, password: event.target.value }))} placeholder="••••••••" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} />
            </label>
            <button className="primary-btn full" type="submit">
              <KeyRound />
              {authMode === 'signin' ? 'Sign in to EchoSync' : 'Create my account'}
            </button>
          </form>

          <div className="switch-list">
            <span className="modal-hint">Switch this tab’s view instantly</span>
            {Object.values(accounts).map((account) => (
              <button key={account.id} className={`switch-row ${account.id === currentUserId ? 'active' : ''}`} onClick={() => onSwitchUser(account.id)}>
                <Avatar member={account} size="sm" online={account.id === currentUserId} />
                <span>
                  <strong>{account.name}</strong>
                  <small>@{account.handle} · {account.email}</small>
                </span>
                {account.id === currentUserId ? <span className="switch-current"><Check /> Current</span> : <span className="switch-hint">Use view</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  )
}

function MembersModal({
  room,
  currentUserId,
  canModerate,
  roles,
  members,
  requests,
  onClose,
  onAddMember,
  onKick,
  onAssignRole,
  onResolveRequest,
}) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const code = room.code || `ECHO-${room.id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}`

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      /* clipboard can be unavailable */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const submit = (event) => {
    event.preventDefault()
    if (onAddMember(query)) setQuery('')
  }

  return (
    <ModalShell onClose={onClose} size="modal-members">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {room.name}</span>
          <h2>Members & roles</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close members"><X /></button>
      </div>
      <div className="modal-body">
        <button className={`invite-code ${copied ? 'copied' : ''}`} onClick={copyCode}>
          <span>
            <small>INVITE CODE</small>
            <strong>{code}</strong>
          </span>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <em>{copied ? 'Copied' : 'Click to copy'}</em>
        </button>

        {canModerate && (
          <form className="add-member" onSubmit={submit}>
            <div className="add-member-copy">
              <strong>Add someone</strong>
              <small>Invite by Gmail address or @handle. New people join as Listeners.</small>
            </div>
            <div className="add-member-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="friend@gmail.com or @handle" />
              <button className="primary-btn" type="submit"><UserRoundPlus /> Add</button>
            </div>
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
                <Avatar member={member} size="sm" online={member?.online} />
                <span className="member-copy">
                  <strong>{member?.name || id} {isSelf && <em>you</em>}</strong>
                  <small>@{member?.handle || id}</small>
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
    listeners: room?.listeners || 8,
    trackIds: room?.trackIds ? [...room.trackIds] : SEED_TRACKS.slice(0, 6).map((seed) => seed.id),
  }))
  const [confirmDelete, setConfirmDelete] = useState(false)

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
              <option value="open">Open · anyone with the code</option>
              <option value="private">Private · invite only</option>
            </select>
          </label>
          <label className="field">
            <span>Listener count</span>
            <input type="number" min="1" max="9999" value={form.listeners} onChange={(event) => setForm((value) => ({ ...value, listeners: event.target.value }))} />
          </label>
        </div>

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
}) {
  const members = useMembers()
  const chatRef = useRef(null)
  const inputRef = useRef(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  const [mention, setMention] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const highlightTimer = useRef(null)
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
                    <div className="bubble">
                      {message.replyTo && (
                        <button className="reply-quote" onClick={() => scrollToMessage(message.replyTo.id)}>
                          <strong>{message.replyTo.name || message.replyTo.handle}</strong>
                          <span>{message.replyTo.text}</span>
                        </button>
                      )}
                      <MessageText text={message.text} members={members} currentUserId={currentUser?.id} onTag={insertMention} />
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
              <button className="send-btn" onClick={submitMessage} aria-label="Send message">
                <Send />
              </button>
            </div>
          </div>
          <div className="social-note"><Lock size={9} /> Room chat stays in this room · replies and tags are live</div>
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
  micOn,
  micLevel,
  speaking,
  duckTest,
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
  currentUser,
  pendingRequest,
  onRequestRole,
  onOpenMembers,
  onOpenSettings,
  roleRequests,
  onResolveRequest,
  onFindFull,
}) {
  const members = useMembers()
  const words = room.name.split(' ')
  const lastWord = words.pop()
  const linePeople = room.members.filter((id) => id !== currentUser?.id).slice(0, 4)
  const linePositions = [15, 33, 54, 74]
  const total = duration || track?.duration || 0
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  const ready = track?.status === 'ready' && Boolean(track?.streamUrl)
  const failed = track?.status === 'error'
  const pending = track?.status === 'pending' || track?.status === 'resolving'
  const RoleIcon = ROLE_COPY[role]?.Icon || Headphones
  const requestable = role === 'listener' ? 'dj' : role === 'dj' ? 'admin' : null

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
              {pendingRequest
                ? `Awaiting ${pendingRequest.requested === 'admin' ? 'Admin' : 'DJ'} approval`
                : `Request ${requestable === 'admin' ? 'Admin' : 'DJ'} access`}
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
            <span>{failed ? 'Source unavailable' : pending ? 'Finding the official source…' : track?.preview ? 'Official preview · 30 seconds' : ready ? 'Ad-free stream · 320 kbps' : 'Ready in the room'}</span>
            <span className="dot" />
            <span>{room.listeners.toLocaleString()} in the room</span>
            <span className={`dot`} />
            <span>{canControl ? 'You have control' : 'Listen-only mode'}</span>
            <span className="grow" />
            {track?.preview && (
              <button className="text-btn find-full" onClick={() => onFindFull(track)}>
                <Search size={11} /> Find Full Version
              </button>
            )}
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
          <span className="source-badge">{queue.length} {queue.length === 1 ? 'track' : 'tracks'}</span>
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
  const [accounts, setAccounts] = useState(() => {
    const stored = readStorage(ACCOUNTS_KEY, null)
    if (stored && typeof stored === 'object' && Object.keys(stored).length) {
      return { ...DEFAULT_ACCOUNTS, ...stored }
    }
    return { ...DEFAULT_ACCOUNTS }
  })
  const [currentUserId, setCurrentUserId] = useState(() => readSessionUser() || 'me')
  const [rooms, setRooms] = useState(() => loadStoredRooms() || ROOMS)
  const [activeRoomId, setActiveRoomId] = useState(() => {
    const initialRooms = loadStoredRooms() || ROOMS
    const fromUrl = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('room')
    if (fromUrl && initialRooms.some((room) => room.id === fromUrl)) return fromUrl
    return initialRooms[0].id
  })
  const [roles, setRoles] = useState(() => roleMatrixFromRooms(loadStoredRooms() || ROOMS))
  const [roleRequests, setRoleRequests] = useState({})
  const [authOpen, setAuthOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createRoomOpen, setCreateRoomOpen] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [joinPill, setJoinPill] = useState(null)
  const [translateOn, setTranslateOn] = useState(() => readStorage(TRANSLATE_KEY, false) === true)
  const [translating, setTranslating] = useState(false)
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
  const queuesRef = useRef(queues)
  const isPlayingRef = useRef(false)
  const controlRef = useRef(false)
  const hasInteractedRef = useRef(false)
  const roomsRef = useRef(rooms)
  const currentUserRef = useRef(null)
  const memberIndexRef = useRef({})
  const joinTargetRef = useRef(null)
  const toastTimerRef = useRef(null)
  const chatTimersRef = useRef([])
  const micRef = useRef({ stream: null, ctx: null, analyser: null, raf: null, loudAt: 0, quietAt: 0 })
  const duckRef = useRef({ interval: null, timer: null })

  const activeRoom = rooms.find((room) => room.id === activeRoomId) || rooms[0]
  const role = roles[activeRoomId]?.[currentUserId] || 'listener'
  const canControl = role === 'admin' || role === 'dj'
  const canModerate = role === 'admin'
  const currentUser = useMemo(() => {
    const account = accounts[currentUserId]
    if (account) return accountDisplay(account)
    const preset = randomAvatarPreset(currentUserId)
    return accountDisplay({
      id: currentUserId,
      name: nameFromEmail(`${currentUserId}@echosync.app`),
      handle: slugifyHandle(currentUserId) || 'listener',
      email: `${currentUserId}@echosync.app`,
      preset: preset.id,
      av1: preset.av1,
      av2: preset.av2,
      online: true,
    })
  }, [accounts, currentUserId])
  const memberIndex = useMemo(() => {
    const merged = { ...MEMBERS, ...accounts }
    merged[currentUserId] = currentUser
    return merged
  }, [accounts, currentUser, currentUserId])
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
    roomsRef.current = rooms
  }, [rooms])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    memberIndexRef.current = memberIndex
  }, [memberIndex])

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    controlRef.current = canControl
  }, [canControl])

  useEffect(() => {
    queuesRef.current = queues
  }, [queues])

  useEffect(() => {
    const markInteraction = () => {
      hasInteractedRef.current = true
    }
    window.addEventListener('pointerdown', markInteraction, { once: true })
    window.addEventListener('keydown', markInteraction, { once: true })
    return () => {
      window.removeEventListener('pointerdown', markInteraction)
      window.removeEventListener('keydown', markInteraction)
    }
  }, [])

  useEffect(() => {
    writeStorage(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    writeStorage(LIKES_KEY, liked)
  }, [liked])

  useEffect(() => {
    writeStorage(ACCOUNTS_KEY, accounts)
  }, [accounts])

  useEffect(() => {
    writeStorage(ROOMS_KEY, rooms)
  }, [rooms])

  useEffect(() => {
    writeSessionUser(currentUserId)
  }, [currentUserId])

  useEffect(() => {
    writeStorage(TRANSLATE_KEY, translateOn)
  }, [translateOn])

  useEffect(() => {
    if (!translateOn) {
      setTranslating(false)
      return undefined
    }
    if (lyrics.status !== 'ready' || lyrics.type !== 'synced' || !lyrics.lines?.length) return undefined
    if (lyrics.lines.every((line) => line.enText || !line.text?.trim())) return undefined
    const curated = CURATED_TRANSLATIONS[track?.id] || []
    if (curated.length) {
      setLyrics((previous) => {
        if (previous.status !== 'ready' || previous.type !== 'synced') return previous
        return {
          ...previous,
          lines: previous.lines.map((line, index) => (
            curated[index] && !line.enText ? { ...line, enText: curated[index] } : line
          )),
        }
      })
    }
    let cancelled = false
    setTranslating(true)
    const publish = (next) => {
      if (cancelled) return
      setLyrics((previous) => (previous.status === 'ready' && previous.type === 'synced' ? { ...previous, lines: next } : previous))
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
  }, [translateOn, lyricsKey, lyrics.status, lyricsRefresh])

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
      if (playback?.then) {
        playback.then(() => {
          joinTargetRef.current = null
          setJoinPill(null)
        }).catch(() => {
          setIsPlaying(false)
          if (joinTargetRef.current != null) {
            setJoinPill({ time: joinTargetRef.current, roomName: activeRoomRef.current })
            joinTargetRef.current = null
          } else {
            showToast('Press play once to let the room join you in audio.')
          }
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

    const applyState = (data) => {
      setSyncMs(Math.max(2, Math.min(399, Math.round(Date.now() - data.ts))))
      const roomQueue = queuesRef.current[data.roomId] || []
      let index = typeof data.index === 'number' ? data.index : currentIndexRef.current
      if (typeof data.index !== 'number' && data.trackId) {
        const found = roomQueue.indexOf(data.trackId)
        if (found >= 0) index = found
      }
      const indexChanged = index !== currentIndexRef.current
      if (indexChanged) setCurrentByRoom((previous) => ({ ...previous, [data.roomId]: index }))
      const elapsed = data.isPlaying ? Math.max(0, Date.now() - data.ts) / 1000 : 0
      const target = (data.time || 0) + elapsed
      const actual = audioRef.current?.currentTime ?? 0
      const drift = Math.abs(actual - target)
      const lateJoin = !hasInteractedRef.current && !controlRef.current && data.isPlaying
      if (lateJoin) {
        joinTargetRef.current = target
        pendingSeekRef.current = target
        setSeekSignal((value) => value + 1)
        setCurrentByRoom((previous) => ({ ...previous, [data.roomId]: index }))
        setIsPlaying(true)
        return
      }
      if (indexChanged || !data.heartbeat || drift > 0.25) {
        pendingSeekRef.current = target
        setSeekSignal((value) => value + 1)
      }
      if (typeof data.isPlaying === 'boolean') setIsPlaying(data.isPlaying)
    }

    channel.onmessage = (event) => {
      const data = event.data
      if (!data || data.sender === tabIdRef.current) return

      if (data.type === 'room-added' && data.room) {
        setRooms((previous) => (previous.some((room) => room.id === data.room.id) ? previous : [...previous, data.room]))
        setRoles((previous) => (
          previous[data.room.id] ? previous : { ...previous, [data.room.id]: { [data.room.dj]: 'admin' } }
        ))
        if (Array.isArray(data.room.trackIds)) {
          setQueues((previous) => ({ ...previous, [data.room.id]: [...data.room.trackIds] }))
        }
        return
      }

      if (data.type === 'room-updated' && data.room) {
        setRooms((previous) => previous.map((room) => (room.id === data.room.id ? { ...room, ...data.room } : room)))
        if (Array.isArray(data.room.trackIds)) {
          setQueues((previous) => ({ ...previous, [data.room.id]: [...data.room.trackIds] }))
        }
        return
      }

      if (data.type === 'room-deleted' && data.roomId) {
        setRooms((previous) => previous.filter((room) => room.id !== data.roomId))
        setRoles((previous) => {
          const next = { ...previous }
          delete next[data.roomId]
          return next
        })
        setQueues((previous) => {
          const next = { ...previous }
          delete next[data.roomId]
          return next
        })
        setMessages((previous) => {
          const next = { ...previous }
          delete next[data.roomId]
          return next
        })
        if (activeRoomRef.current === data.roomId) {
          setIsPlaying(false)
          audioRef.current?.pause()
          const fallback = roomsRef.current.find((room) => room.id !== data.roomId)
          if (fallback) {
            activeRoomRef.current = fallback.id
            setActiveRoomId(fallback.id)
          }
        }
        return
      }

      if (data.type === 'member-changed' && data.roomId) {
        setRooms((previous) => previous.map((room) => (
          room.id === data.roomId && Array.isArray(data.members) ? { ...room, members: data.members } : room
        )))
        if (data.roles) setRoles((previous) => ({ ...previous, [data.roomId]: data.roles }))
        return
      }

      if (data.roomId !== activeRoomRef.current) return

      if (data.type === 'chat' && data.message) {
        setMessages((previous) => {
          const list = previous[data.roomId] || []
          if (list.some((message) => message.id === data.message.id)) return previous
          return { ...previous, [data.roomId]: [...list, data.message] }
        })
        const me = currentUserRef.current
        const text = data.message.text || ''
        if (me && data.message.author !== me.id && text) {
          const escaped = me.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          if (new RegExp(`@${escaped}(?![\\w.])`, 'i').test(text)) {
            const sender = memberIndexRef.current[data.message.author]
            showToast(`${sender?.name?.split(' ')[0] || 'Someone'} tagged you in the room chat`)
          }
        }
        return
      }

      if (data.type === 'chat-delete' && data.messageId) {
        setMessages((previous) => ({
          ...previous,
          [data.roomId]: (previous[data.roomId] || []).filter((message) => message.id !== data.messageId),
        }))
        return
      }

      if (data.type === 'join-sync-request') {
        channel.postMessage(roomSnapshot({ heartbeat: false }))
        return
      }

      if (data.type === 'role-request' && data.request) {
        setRoleRequests((previous) => {
          const list = previous[data.roomId] || []
          if (list.some((request) => request.id === data.request.id)) return previous
          return { ...previous, [data.roomId]: [...list, data.request] }
        })
        return
      }

      if (data.type === 'role-resolved') {
        setRoleRequests((previous) => ({
          ...previous,
          [data.roomId]: data.requestId
            ? (previous[data.roomId] || []).filter((request) => request.id !== data.requestId)
            : previous[data.roomId],
        }))
        if (data.approved && data.userId && data.role) {
          setRoles((previous) => ({
            ...previous,
            [data.roomId]: { ...(previous[data.roomId] || {}), [data.userId]: data.role },
          }))
          if (data.userId === currentUserRef.current?.id) {
            showToast(`You're now ${ROLE_COPY[data.role]?.label || 'a member'} in this room`)
          }
        } else if (data.userId === currentUserRef.current?.id) {
          showToast('Your role request was declined', 'lock')
        }
        return
      }

      if (data.type === 'state') applyState(data)
    }

    channel.postMessage({ type: 'join-sync-request', roomId: activeRoomRef.current, sender: tabIdRef.current, ts: Date.now() })
    const stored = loadRoomStateSnapshot()
    if (stored?.roomId === activeRoomRef.current && stored.ts && Date.now() - stored.ts < 15000) applyState(stored)
    return () => {
      channel.close()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!controlRef.current || !isPlayingRef.current) return
      announce({ heartbeat: true })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function roomSnapshot(overrides = {}) {
    const snapshot = {
      type: 'state',
      roomId: activeRoomRef.current,
      sender: tabIdRef.current,
      index: currentIndexRef.current,
      trackId: (queuesRef.current[activeRoomRef.current] || [])[currentIndexRef.current] || null,
      isPlaying: isPlayingRef.current,
      time: audioRef.current?.currentTime || 0,
      ts: Date.now(),
      ...overrides,
    }
    writeStorage(ROOM_STATE_KEY, snapshot)
    return snapshot
  }

  function announce(overrides = {}) {
    channelRef.current?.postMessage(roomSnapshot(overrides))
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
    setJoinPill(null)
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

  function ensureMembership(roomId, userId) {
    setRooms((previous) => previous.map((room) => (
      room.id === roomId && !room.members.includes(userId) ? { ...room, members: [...room.members, userId] } : room
    )))
    setRoles((previous) => {
      const matrix = previous[roomId] || {}
      if (matrix[userId]) return previous
      return { ...previous, [roomId]: { ...matrix, [userId]: 'listener' } }
    })
  }

  function pushSystemMessage(roomId, text) {
    const message = { id: uid('sys'), system: true, text, time: clockNow(), reactions: [] }
    setMessages((previous) => ({ ...previous, [roomId]: [...(previous[roomId] || []), message] }))
    channelRef.current?.postMessage({ type: 'chat', roomId, sender: tabIdRef.current, message })
  }

  function switchUser(userId) {
    setCurrentUserId(userId)
    ensureMembership(activeRoomId, userId)
    showToast(`Viewing as ${accounts[userId]?.name || userId}`)
  }

  function signIn(email, password) {
    const typed = email.trim().toLowerCase()
    const account = Object.values(accounts).find((candidate) => candidate.email?.toLowerCase() === typed)
    if (!account) {
      showToast('No account with that email. Create one instead.', 'lock')
      return false
    }
    if (account.password !== password) {
      showToast('That password doesn’t match.', 'lock')
      return false
    }
    setCurrentUserId(account.id)
    ensureMembership(activeRoomId, account.id)
    setAuthOpen(false)
    showToast(`Welcome back, ${account.name.split(' ')[0]}`)
    return true
  }

  function signUp({ name, email, password, handle, preset: presetId }) {
    const typed = email.trim().toLowerCase()
    if (Object.values(accounts).some((candidate) => candidate.email?.toLowerCase() === typed)) {
      showToast('That email is already registered. Sign in instead.', 'lock')
      return false
    }
    const cleanHandle = slugifyHandle(handle || handleFromEmail(typed))
    const id = cleanHandle || uid('user')
    if (accounts[id]) {
      showToast('That handle is taken — try another.', 'lock')
      return false
    }
    const preset = AVATAR_PRESETS.find((option) => option.id === presetId) || randomAvatarPreset(id)
    const account = {
      id,
      name: name.trim(),
      handle: cleanHandle,
      email: typed,
      password,
      initials: initials(name),
      av1: preset.av1,
      av2: preset.av2,
      preset: preset.id,
      online: true,
    }
    setAccounts((previous) => ({ ...previous, [id]: account }))
    setCurrentUserId(id)
    ensureMembership(activeRoomId, id)
    setAuthOpen(false)
    showToast(`Account created — welcome, ${account.name.split(' ')[0]}`)
    return true
  }

  function signOut() {
    setCurrentUserId('me')
    setAuthOpen(false)
    showToast('Signed out — you can sign back in anytime')
  }

  function saveProfile(patch) {
    setAccounts((previous) => ({
      ...previous,
      [currentUserId]: {
        ...previous[currentUserId],
        ...patch,
        initials: initials(patch.name || currentUser.name),
      },
    }))
    showToast('Profile saved')
  }

  function joinRoom(room) {
    const changed = room.id !== activeRoomId
    ensureMembership(room.id, currentUserId)
    if (changed) {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.currentTime = 0
      setIsPlaying(false)
      setProgress(0)
      setDuration(0)
      setDraft('')
      setReplyTo(null)
      setJoinPill(null)
      setActiveRoomId(room.id)
      setTimeout(() => {
        channelRef.current?.postMessage({ type: 'join-sync-request', roomId: room.id, sender: tabIdRef.current, ts: Date.now() })
      }, 60)
    }
    setView('room')
    if (typeof window !== 'undefined' && window.innerWidth <= 1050) setChatOpen(false)
    showToast(changed ? `Joined ${room.name}` : `You’re already in ${room.name}`)
  }

  function requestRole(requested) {
    const roomId = activeRoomId
    const existing = (roleRequests[roomId] || []).find((request) => request.userId === currentUserId)
    if (existing) {
      showToast(`Your ${existing.requested === 'admin' ? 'Admin' : 'DJ'} request is still pending`)
      return
    }
    const request = { id: uid('req'), userId: currentUserId, requested, at: Date.now() }
    setRoleRequests((previous) => ({ ...previous, [roomId]: [...(previous[roomId] || []), request] }))
    pushSystemMessage(roomId, `${currentUser.name} requested ${requested === 'admin' ? 'Admin' : 'DJ'} access`)
    channelRef.current?.postMessage({ type: 'role-request', roomId, sender: tabIdRef.current, request })
    showToast('Request sent — a room Admin will review it')
  }

  function resolveRoleRequest(requestId, approve) {
    const roomId = activeRoomId
    const request = (roleRequests[roomId] || []).find((item) => item.id === requestId)
    if (!request) return
    setRoleRequests((previous) => ({ ...previous, [roomId]: (previous[roomId] || []).filter((item) => item.id !== requestId) }))
    if (approve) {
      setRoles((previous) => ({ ...previous, [roomId]: { ...(previous[roomId] || {}), [request.userId]: request.requested } }))
      pushSystemMessage(roomId, `${accounts[request.userId]?.name || 'A member'} is now ${request.requested === 'admin' ? 'Admin' : 'DJ'} in ${activeRoom.name}`)
    } else {
      pushSystemMessage(roomId, `Role request from ${accounts[request.userId]?.name || 'a member'} was declined`)
    }
    channelRef.current?.postMessage({
      type: 'role-resolved',
      roomId,
      sender: tabIdRef.current,
      requestId,
      userId: request.userId,
      role: request.requested,
      approved: approve,
    })
    showToast(approve ? 'Request approved' : 'Request declined')
  }

  function createRoom(input) {
    const gradient = ROOM_GRADIENTS.find((option) => option.id === input.gradient) || ROOM_GRADIENTS[0]
    const id = `${slugifyHandle(input.name) || 'room'}-${Math.random().toString(36).slice(2, 6)}`
    const trackIds = input.trackIds?.length ? input.trackIds : SEED_TRACKS.slice(0, 6).map((seed) => seed.id)
    const room = {
      id,
      name: input.name.trim(),
      tagline: input.tagline?.trim() || 'A room built for the moment.',
      description: input.description?.trim() || input.tagline?.trim() || 'A fresh listening room on EchoSync.',
      accent: gradient.accent,
      accent2: gradient.accent2,
      trackIds,
      members: [currentUserId],
      listeners: Math.max(2, Number(input.listeners) || 2),
      private: Boolean(input.private),
      dj: currentUserId,
      c1: gradient.c1,
      c2: gradient.c2,
      code: roomCode(id),
      createdBy: currentUserId,
      createdAt: Date.now(),
    }
    setRooms((previous) => [...previous, room])
    setQueues((previous) => ({ ...previous, [room.id]: [...trackIds] }))
    setRoles((previous) => ({ ...previous, [room.id]: { [currentUserId]: 'admin' } }))
    setActiveRoomId(room.id)
    setView('room')
    setCreateRoomOpen(false)
    pushSystemMessage(room.id, `${currentUser.name} created this room · invite code ${room.code}`)
    channelRef.current?.postMessage({ type: 'room-added', sender: tabIdRef.current, room })
    showToast(`Room created — invite code ${room.code}`)
  }

  function updateRoom(patch) {
    const roomId = activeRoomId
    const updatedRoom = { ...activeRoom, ...patch }
    setRooms((previous) => previous.map((room) => (room.id === roomId ? { ...room, ...patch } : room)))
    channelRef.current?.postMessage({ type: 'room-updated', sender: tabIdRef.current, room: updatedRoom })
    if (Array.isArray(patch.trackIds)) {
      setQueues((previous) => ({ ...previous, [roomId]: [...patch.trackIds] }))
      setCurrentByRoom((previous) => ({ ...previous, [roomId]: 0 }))
      pendingSeekRef.current = 0
      setProgress(0)
      announce({ index: 0, time: 0 })
    }
    pushSystemMessage(roomId, `${currentUser.name} updated the room settings`)
    setSettingsOpen(false)
    showToast('Room updated')
  }

  function deleteRoom() {
    const roomId = activeRoomId
    if (rooms.length <= 1) {
      showToast('EchoSync needs at least one room.', 'lock')
      return
    }
    const remaining = rooms.filter((room) => room.id !== roomId)
    setRooms(remaining)
    setRoles((previous) => {
      const next = { ...previous }
      delete next[roomId]
      return next
    })
    setQueues((previous) => {
      const next = { ...previous }
      delete next[roomId]
      return next
    })
    setMessages((previous) => {
      const next = { ...previous }
      delete next[roomId]
      return next
    })
    setIsPlaying(false)
    audioRef.current?.pause()
    setActiveRoomId(remaining[0].id)
    setSettingsOpen(false)
    channelRef.current?.postMessage({ type: 'room-deleted', sender: tabIdRef.current, roomId })
    showToast('Room deleted')
  }

  function addMember(input) {
    const roomId = activeRoomId
    const query = input.trim().toLowerCase()
    if (!query) return false
    const byHandle = query.startsWith('@') ? query.slice(1) : null
    const existing = Object.values(accounts).find((account) => (
      account.email?.toLowerCase() === query
      || (byHandle && account.handle === byHandle)
      || (!byHandle && account.handle === query)
    ))
    let account = existing
    if (!account) {
      if (!query.includes('@')) {
        showToast('Add members by Gmail address or @handle.', 'lock')
        return false
      }
      const email = query
      const id = slugifyHandle(handleFromEmail(email)) || uid('user')
      if (accounts[id]) {
        showToast('They’re already on EchoSync — try their @handle.', 'lock')
        return false
      }
      const preset = randomAvatarPreset(id)
      const displayName = nameFromEmail(email)
      account = {
        id,
        name: displayName,
        handle: slugifyHandle(handleFromEmail(email)),
        email,
        password: uid('pw'),
        initials: initials(displayName),
        av1: preset.av1,
        av2: preset.av2,
        preset: preset.id,
        online: false,
      }
      setAccounts((previous) => ({ ...previous, [id]: account }))
      showToast(`Invited ${account.name} to EchoSync`)
    }
    if (activeRoom.members.includes(account.id)) {
      showToast(`${account.name} is already in ${activeRoom.name}`)
      return true
    }
    ensureMembership(roomId, account.id)
    const members = activeRoom.members.includes(account.id) ? activeRoom.members : [...activeRoom.members, account.id]
    channelRef.current?.postMessage({
      type: 'member-changed',
      sender: tabIdRef.current,
      roomId,
      members,
      roles: { ...(roles[roomId] || {}), [account.id]: roles[roomId]?.[account.id] || 'listener' },
    })
    pushSystemMessage(roomId, `${account.name} joined ${activeRoom.name}`)
    showToast(`${account.name} added to ${activeRoom.name}`)
    return true
  }

  function kickMember(userId) {
    const roomId = activeRoomId
    if (userId === currentUserId) {
      showToast('You can’t remove your own session.', 'lock')
      return
    }
    setRooms((previous) => previous.map((room) => (
      room.id === roomId ? { ...room, members: room.members.filter((id) => id !== userId) } : room
    )))
    setRoles((previous) => {
      const matrix = { ...(previous[roomId] || {}) }
      delete matrix[userId]
      return { ...previous, [roomId]: matrix }
    })
    const nextRoles = { ...(roles[roomId] || {}) }
    delete nextRoles[userId]
    channelRef.current?.postMessage({
      type: 'member-changed',
      sender: tabIdRef.current,
      roomId,
      members: activeRoom.members.filter((id) => id !== userId),
      roles: nextRoles,
    })
    pushSystemMessage(roomId, `Admin removed @${accounts[userId]?.handle || userId} from the room`)
    showToast('Member removed')
  }

  function assignRole(userId, nextRole) {
    const roomId = activeRoomId
    const nextRoles = { ...(roles[roomId] || {}), [userId]: nextRole }
    setRoles((previous) => ({ ...previous, [roomId]: nextRoles }))
    channelRef.current?.postMessage({
      type: 'role-resolved',
      sender: tabIdRef.current,
      roomId,
      requestId: null,
      userId,
      role: nextRole,
      approved: true,
    })
    pushSystemMessage(roomId, `${accounts[userId]?.name || 'A member'} is now ${nextRole === 'admin' ? 'Admin' : nextRole === 'dj' ? 'DJ' : 'Listener'}`)
    showToast('Role updated')
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

  async function findFullVersion(previewTrack) {
    if (!previewTrack) return
    showToast('Searching for the full-length version…')
    try {
      const candidates = await fetchJioSearch(`${previewTrack.title} ${previewTrack.artist}`, 16)
      const ranked = rankCandidates(candidates, { ...previewTrack, preview: false })
      for (const entry of ranked.slice(0, 4)) {
        const hydrated = entry.track.streamUrl ? entry.track : await hydrateJioTrack(entry.track)
        if (hydrated?.streamUrl && (hydrated.duration || 0) > 60) {
          const replacement = {
            ...hydrated,
            id: previewTrack.id,
            status: 'ready',
            preview: false,
            c1: previewTrack.c1,
            c2: previewTrack.c2,
          }
          setLibrary((previous) => ({ ...previous, [previewTrack.id]: replacement }))
          saveLibraryEntry(previewTrack.id, replacement)
          pendingSeekRef.current = 0
          setProgress(0)
          setDuration(replacement.duration || 0)
          showToast(`Full version found — “${replacement.title}”`)
          return
        }
      }
      showToast('No full-length stream found for this one — keeping the preview.', 'lock')
    } catch {
      showToast('Could not reach the music source just now.', 'lock')
    }
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
    const replySnapshot = replyTo
      ? { id: replyTo.id, name: replyTo.name, handle: replyTo.handle, text: replyTo.text.slice(0, 140) }
      : null
    const message = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: currentUserId,
      text: text.slice(0, 500),
      time: clockNow(),
      reactions: [],
      read: false,
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    }
    setMessages((previous) => ({ ...previous, [roomId]: [...(previous[roomId] || []), message] }))
    broadcastChat(message)
    setDraft('')
    setReplyTo(null)

    const mentionMatch = text.match(/@([\w.]+)/)
    const mentioned = mentionMatch
      ? senderRoom.members.map((id) => memberIndex[id]).find((member) => member?.handle === mentionMatch[1].toLowerCase())
      : null
    const others = senderRoom.members.filter((id) => id !== currentUserId && memberIndex[id])
    const responderId = mentioned?.id || others[Math.floor(Math.random() * others.length)]?.id || 'usman'
    const responder = memberIndex[responderId]
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
        ...(replySnapshot && Math.random() > 0.45 ? { replyTo: replySnapshot } : {}),
      }
      setMessages((previous) => ({
        ...previous,
        [roomId]: (previous[roomId] || [])
          .map((item) => (item.id === message.id ? { ...item, read: true } : item))
          .concat(reply),
      }))
      if (mentioned && responder) {
        showToast(`${responder.name.split(' ')[0]} was tagged in ${activeRoom.name}`)
      }
    }, 2800 + Math.random() * 1100)
    chatTimersRef.current.push(typingTimer, replyTimer)
  }

  function deleteMessage(messageId) {
    const roomId = activeRoomId
    setMessages((previous) => ({
      ...previous,
      [roomId]: (previous[roomId] || []).filter((message) => message.id !== messageId),
    }))
    channelRef.current?.postMessage({ type: 'chat-delete', roomId, sender: tabIdRef.current, messageId })
    showToast('Message deleted')
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
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      <div className={`shell ${chatOpen ? '' : 'chat-collapsed'}`}>
        <Sidebar
          room={activeRoom}
          rooms={rooms}
          view={view}
          role={ROLE_COPY[role]?.label}
          likedCount={liked.length}
          currentUser={currentUser}
          onNavigate={(nextView) => {
            setView(nextView)
            if (typeof window !== 'undefined' && window.innerWidth <= 1050 && nextView !== 'room') setChatOpen(false)
          }}
          onSearch={() => setSearchOpen(true)}
          onJoinRoom={joinRoom}
          onInvite={copyInvite}
          onCreateRoom={() => setCreateRoomOpen(true)}
          onOpenProfile={() => setAuthOpen(true)}
        />

        <main className="stage">
          {joinPill && (
            <button className="join-live-pill" onClick={acceptJoin}>
              <span className="join-live-dot" />
              <span>
                <small>🔊 LIVE ROOM PLAYING AT {formatTime(joinPill.time)}</small>
                <strong>Tap to Sync Audio Immediately</strong>
              </span>
              <AudioLines size={16} />
            </button>
          )}
          <StageBar
            room={activeRoom}
            view={view}
            theme={theme}
            currentUser={currentUser}
            onOpenProfile={() => setAuthOpen(true)}
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
                currentUser={currentUser}
                pendingRequest={(roleRequests[activeRoomId] || []).find((request) => request.userId === currentUserId)}
                roleRequests={roleRequests[activeRoomId] || []}
                onRequestRole={requestRole}
                onResolveRequest={resolveRoleRequest}
                onOpenMembers={() => setMembersOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onFindFull={findFullVersion}
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
              <RoomsView
                rooms={rooms}
                library={library}
                currentRoom={activeRoom}
                onJoin={joinRoom}
                onCreate={() => setCreateRoomOpen(true)}
              />
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
          onDeleteMessage={deleteMessage}
          onReply={(message) => {
            const author = memberIndex[message.author] || {}
            setReplyTo({ id: message.id, name: author.name || 'Listener', handle: author.handle || 'listener', text: message.text })
          }}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          currentUser={currentUser}
          canModerate={canModerate}
          memberRoles={roles[activeRoomId] || {}}
          translateOn={translateOn}
          translating={translating}
          onToggleTranslate={() => setTranslateOn((value) => !value)}
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

      {authOpen && (
        <AccountModal
          accounts={accounts}
          currentUserId={currentUserId}
          currentUser={currentUser}
          onClose={() => setAuthOpen(false)}
          onSignIn={signIn}
          onSignUp={signUp}
          onSignOut={signOut}
          onSaveProfile={saveProfile}
          onSwitchUser={switchUser}
        />
      )}

      {membersOpen && (
        <MembersModal
          room={activeRoom}
          currentUserId={currentUserId}
          canModerate={canModerate}
          roles={roles[activeRoomId] || {}}
          members={memberIndex}
          requests={roleRequests[activeRoomId] || []}
          onClose={() => setMembersOpen(false)}
          onAddMember={addMember}
          onKick={kickMember}
          onAssignRole={assignRole}
          onResolveRequest={resolveRoleRequest}
        />
      )}

      {settingsOpen && (
        <RoomModal
          mode="edit"
          room={activeRoom}
          onClose={() => setSettingsOpen(false)}
          onUpdate={updateRoom}
          onDelete={deleteRoom}
        />
      )}

      {createRoomOpen && (
        <RoomModal
          mode="create"
          onClose={() => setCreateRoomOpen(false)}
          onCreate={createRoom}
        />
      )}

      <Toast toast={toast} />
    </div>
    </MembersContext.Provider>
  )
}
