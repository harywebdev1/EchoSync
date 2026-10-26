import { useState, useRef } from 'react'
import {
  loadUsers,
  readActiveUserId,
  clearActiveSession,
  loadStoredRooms,
  normalizeRoom,
  loadTasteProfile,
  buildInitialLibrary,
  mergeLikedTracks,
  readUserValue,
  LIKES_KEY,
  likedIdsFrom,
  PLAYLISTS_KEY,
  sanitizePlaylist,
  RECENT_KEY,
  safeText,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadDailyFeedCache,
  buildDailyStarterFeed,
  fillDailyFeed,
  validDailyTracks,
  loadStoredMessages,
  loadInvites,
  loadLoungeMessages,
} from '../lib/appServices.js'
import { usePlaybackState } from './usePlaybackState.js'

export function useAppState() {
  const [queueFilter, setQueueFilter] = useState('All')
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
const [tasteProfile, setTasteProfile] = useState(() => loadTasteProfile(currentUserId))
const [library, setLibrary] = useState(() => {
    const base = buildInitialLibrary()
    return mergeLikedTracks(base, readUserValue(LIKES_KEY, currentUserId || 'guest', [])).library
  })
const [liked, setLiked] = useState(() => (
    likedIdsFrom(readUserValue(LIKES_KEY, currentUserId || 'guest', []))
  ))
const [playlists, setPlaylists] = useState(() => {
    const value = readUserValue(PLAYLISTS_KEY, currentUserId, [])
    return Array.isArray(value) ? value.map(sanitizePlaylist).filter(Boolean) : []
  })
const [recent, setRecent] = useState(() => {
    const value = readUserValue(RECENT_KEY, currentUserId || 'guest', [])
    return Array.isArray(value) ? value.map((id) => safeText(id)).filter(Boolean) : []
  })
const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(readUserValue(SETTINGS_KEY, currentUserId, {}) || {}),
  }))
const [translateOn, setTranslateOn] = useState(() => Boolean(settings.autoTranslate))
const [translating, setTranslating] = useState(false)
const [dailyFeed, setDailyFeed] = useState(() => {
    const dayKey = new Date().toISOString().slice(0, 10)
    const userKey = currentUserId || 'guest'
    const cached = loadDailyFeedCache(dayKey)
    const starter = buildDailyStarterFeed(dayKey, userKey, library)
    return cached ? fillDailyFeed(cached, starter, userKey) : starter
  })
const [dailyStatus, setDailyStatus] = useState(() => (
    validDailyTracks(dailyFeed?.trending, 6).length ? 'ready' : 'loading'
  ))
const [dailyRefresh, setDailyRefresh] = useState(0)
const [sidebarOpen, setSidebarOpen] = useState(false)
const [messages, setMessages] = useState(loadStoredMessages)
const [invites, setInvites] = useState(loadInvites)
const [typing, setTyping] = useState({})
const [draft, setDraft] = useState('')
const [replyTo, setReplyTo] = useState(null)
const [activeTab, setActiveTab] = useState('chat')
const [chatOpen, setChatOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 1050))
const [unreadRoomCounts, setUnreadRoomCounts] = useState({})
const [latestRoomPreview, setLatestRoomPreview] = useState({})
const [loungeMessages, setLoungeMessages] = useState(loadLoungeMessages)
const [loungeOpen, setLoungeOpen] = useState(false)
const [loungeUnreadCount, setLoungeUnreadCount] = useState(0)
const [latestLoungePreview, setLatestLoungePreview] = useState(null)
const [loungeDraft, setLoungeDraft] = useState('')
const [loungeReplyTo, setLoungeReplyTo] = useState(null)
const [loungeTyping, setLoungeTyping] = useState({})
const [loungeVoicePlaying, setLoungeVoicePlaying] = useState(false)
const [loungeInvitingId, setLoungeInvitingId] = useState('')
const [searchOpen, setSearchOpen] = useState(false)
const [searchContext, setSearchContext] = useState({ mode: 'solo', roomId: null, roomName: '' })
const [fullPlayer, setFullPlayer] = useState(false)
const [queueOpen, setQueueOpen] = useState(false)
const [settingsOpen, setSettingsOpen] = useState(false)
const [tasteOpen, setTasteOpen] = useState(false)
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
const [joinPill, setJoinPill] = useState(null)
const [micOn, setMicOn] = useState(false)
const [micLevel, setMicLevel] = useState(0)
const [speaking, setSpeaking] = useState(false)
const [duckTest, setDuckTest] = useState(false)
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
const channelRef = useRef(null)
const accountsJsonRef = useRef('')
const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
const activeRoomRef = useRef(activeRoomId)
const roomsRef = useRef(rooms)
const roomQueueRef = useRef([])
const roomControlRef = useRef(false)
const roomClockRef = useRef({ roomId: null, index: 0, trackId: null, time: 0, updatedAt: 0, isPlaying: false })
const libraryRef = useRef({})
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
const pendingAuthActionRef = useRef(null)
const remoteVoiceTimersRef = useRef({})
const remoteAudioQueueRef = useRef({ entries: {} })
const acceptedInviteRoomsRef = useRef(new Set())
const roomPreviewTimersRef = useRef({})
const receivedChatIdsRef = useRef(new Set())
const receivedLoungeIdsRef = useRef(new Set(loungeMessages.map((message) => message.id)))
const loungeMessagesRef = useRef(loungeMessages)
const loungeOpenRef = useRef(loungeOpen)
const loungeUnreadRef = useRef(0)
const loungePreviewTimerRef = useRef(null)
const loungeTypingClearRef = useRef({})
const lastLoungeTypingRef = useRef(0)
const loungeInviteGuardRef = useRef(new Set())
const viewRef = useRef(view)
const chatOpenRef = useRef(chatOpen)
const searchRoomRef = useRef(null)
const searchTargetRef = useRef({ mode: 'solo', roomId: null })
  const playback = usePlaybackState()
  return { ...playback, queueFilter, setQueueFilter,
    accounts,
    setAccounts,
    currentUserId,
    setCurrentUserId,
    view,
    setView,
    rooms,
    setRooms,
    activeRoomId,
    setActiveRoomId,
    tasteProfile,
    setTasteProfile,
    library,
    setLibrary,
    liked,
    setLiked,
    playlists,
    setPlaylists,
    recent,
    setRecent,
    settings,
    setSettings,
    translateOn,
    setTranslateOn,
    translating,
    setTranslating,
    dailyFeed,
    setDailyFeed,
    dailyStatus,
    setDailyStatus,
    dailyRefresh,
    setDailyRefresh,
    sidebarOpen,
    setSidebarOpen,
    messages,
    setMessages,
    invites,
    setInvites,
    typing,
    setTyping,
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    activeTab,
    setActiveTab,
    chatOpen,
    setChatOpen,
    unreadRoomCounts,
    setUnreadRoomCounts,
    latestRoomPreview,
    setLatestRoomPreview,
    loungeMessages,
    setLoungeMessages,
    loungeOpen,
    setLoungeOpen,
    loungeUnreadCount,
    setLoungeUnreadCount,
    latestLoungePreview,
    setLatestLoungePreview,
    loungeDraft,
    setLoungeDraft,
    loungeReplyTo,
    setLoungeReplyTo,
    loungeTyping,
    setLoungeTyping,
    loungeVoicePlaying,
    setLoungeVoicePlaying,
    loungeInvitingId,
    setLoungeInvitingId,
    searchOpen,
    setSearchOpen,
    searchContext,
    setSearchContext,
    fullPlayer,
    setFullPlayer,
    queueOpen,
    setQueueOpen,
    settingsOpen,
    setSettingsOpen,
    tasteOpen,
    setTasteOpen,
    membersOpen,
    setMembersOpen,
    joinRoomOpen,
    setJoinRoomOpen,
    roomEditor,
    setRoomEditor,
    playlistDialog,
    setPlaylistDialog,
    pendingPlaylistTrack,
    setPendingPlaylistTrack,
    addTrack,
    setAddTrack,
    activePlaylistId,
    setActivePlaylistId,
    toast,
    setToast,
    lyrics,
    setLyrics,
    lyricsRefresh,
    setLyricsRefresh,
    joinPill,
    setJoinPill,
    micOn,
    setMicOn,
    micLevel,
    setMicLevel,
    speaking,
    setSpeaking,
    duckTest,
    setDuckTest,
    authOpen,
    setAuthOpen,
    authMode,
    setAuthMode,
    authReason,
    setAuthReason,
    authNotice,
    setAuthNotice,
    passcodeRoomId,
    setPasscodeRoomId,
    voiceNotePlaying,
    setVoiceNotePlaying,
    remoteVoice,
    setRemoteVoice,
    cacheRevision,
    setCacheRevision,
    pendingRoomCode,
    setPendingRoomCode,
    channelRef,
    accountsJsonRef,
    tabIdRef,
    activeRoomRef,
    roomsRef,
    roomQueueRef,
    roomControlRef,
    roomClockRef,
    libraryRef,
    currentUserRef,
    memberIndexRef,
    messagesRef,
    settingsRef,
    invitesRef,
    toastTimerRef,
    typingTimerRef,
    typingBroadcastRef,
    typingClearRef,
    micRef,
    duckRef,
    pendingAuthActionRef,
    remoteVoiceTimersRef,
    remoteAudioQueueRef,
    acceptedInviteRoomsRef,
    roomPreviewTimersRef,
    receivedChatIdsRef,
    receivedLoungeIdsRef,
    loungeMessagesRef,
    loungeOpenRef,
    loungeUnreadRef,
    loungePreviewTimerRef,
    loungeTypingClearRef,
    lastLoungeTypingRef,
    loungeInviteGuardRef,
    viewRef,
    chatOpenRef,
    searchRoomRef,
    searchTargetRef }
}
