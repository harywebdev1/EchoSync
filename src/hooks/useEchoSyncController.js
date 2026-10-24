import { useSocialFeatures } from './useSocialFeatures.js'
import { useOverlayHistory } from './useOverlayHistory.js'
import { useStableActions } from './useStableActions.js'
import { useEffect, useMemo, useCallback, useRef } from 'react'
import {
  consumeStorageFailure,
  accountDisplay,
  SOLO_ROOM_ID,
  SEED_BY_ID,
  ROOM_EMPTY_TRACK,
  EMPTY_TRACK,
  publicAccount,
  writeStorage,
  PUBLIC_LOUNGE_KEY,
  trimBoundedSet,
  THEME_KEY,
  USERS_KEY,
  ROOMS_KEY,
  MESSAGES_KEY,
  INVITES_KEY,
  writeUserValue,
  LIKES_KEY,
  sanitizeTrack,
  PLAYLISTS_KEY,
  RECENT_KEY,
  SETTINGS_KEY,
  TASTE_PROFILE_KEY,
  buildDailyStarterFeed,
  loadDailyFeedCache,
  fillDailyFeed,
  tasteSummary,
  buildDailyFeed,
  saveDailyFeedCache,
  TRANSLATE_KEY,
  clearActiveSession,
  normalizeRoomCode,
  rememberBoundedId,
  readUserValue,
  DEFAULT_SETTINGS,
  saveLibraryEntry,
  likedIdsFrom,
  mergeLikedTracks,
  loadTasteProfile,
  writeActiveSession,
  slugifyHandle,
  handleFromEmail,
  displayNameFromHandle,
  randomAvatarPreset,
  LOCK_MESSAGE,
  safeText,
  uid,
  clockNow,
  ROOM_GRADIENTS,
  roomCode,
  normalizeLoungeMessage,
  LOUNGE_MESSAGE_LIMIT,
  likedTrackId,
  fetchLyrics,
  CURATED_TRANSLATIONS,
  translateLines,
  STREAM_CACHE_KEY,
  LIBRARY_CACHE_KEY,
  LYRIC_CACHE_KEY,
  TRANSLATION_CACHE_KEY,
  readStorage,
  formatBytes,
  clearPlaybackCaches,
  buildInitialLibrary,
  persistTrackArtwork,
  replaceTrackArtwork,
  fetchArtworkFallback,
} from '../lib/appServices.js'
import { useAppState } from './useAppState.js'
import { startNetworkMonitor, setPreferredStreamQuality } from '../services/networkMonitor'
import { topTasteLabels, TASTE_VIBES, applyTasteSignal, buildTasteSuggestions } from '../core/tasteEngine.js'
import { playbackProgressStore } from '../state/playbackStore'
import { initials, normalizeArtworkUrl } from '../lib/media'
import { clearPreloadSession } from '../services/preloadManager'
import { ROLE_COPY } from '../components/shared/roomRoles'
import { usePlaybackEngine } from './usePlaybackEngine.js'
import { useRoomSync } from './useRoomSync.js'
import { useTrackPalette } from './useTrackPalette.js'

// Connects session, library and community actions to the playback/sync hooks.
export function useEchoSyncController() {

  useEffect(() => {
    const notify = () => {
      if (!consumeStorageFailure()) return
      showToast("Changes weren't saved (storage full)", 'lock')
    }
    window.addEventListener('echosync-storage-failure', notify)
    notify()
    return () => window.removeEventListener('echosync-storage-failure', notify)
  }, [])

  const { queueFilter, setQueueFilter, sleepPausedRef,
    theme,
    setTheme,
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
    soloQueue,
    setSoloQueue,
    soloPlayOrder,
    setSoloPlayOrder,
    currentByRoom,
    setCurrentByRoom,
    tasteProfile,
    setTasteProfile,
    isPlaying,
    setIsPlaying,
    duration,
    setDuration,
    volume,
    setVolume,
    muted,
    setMuted,
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
    crossfadeGain,
    setCrossfadeGain,
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
    pendingPlayId,
    setPendingPlayId,
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
    seekSignal,
    setSeekSignal,
    recoverySignal,
    setRecoverySignal,
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
    buffering,
    setBuffering,
    streamRecovering,
    setStreamRecovering,
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
    audioRef,
    loadedUrlRef,
    pendingSeekRef,
    progressRef,
    lastPauseAtRef,
    playAttemptIdRef,
    resumeAttemptRef,
    advanceCheckRef,
    channelRef,
    accountsJsonRef,
    tabIdRef,
    activeRoomRef,
    roomsRef,
    queueIdsRef,
    roomQueueRef,
    currentIndexRef,
    isPlayingRef,
    canControlRef,
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
    ytPlayerRef,
    ytContainerRef,
    handleEndedRef,
    hasInteractedRef,
    pendingAuthActionRef,
    stallTimerRef,
    recoveryRef,
    crossfadeGainRef,
    crossfadeLockRef,
    fadeFrameRef,
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
    soloSnapshotRef,
    soloResumeRef,
    soloQueueRef,
    soloPlayOrderRef,
    shuffleSeedRef,
    previousShuffleRef,
    searchRoomRef,
    searchTargetRef,
    playRequestRef,
  } = useAppState()

  const currentAccount = currentUserId ? accounts[currentUserId] : null

  const dailyDayKey = new Date().toISOString().slice(0, 10)

  const currentUser = useMemo(() => (
    currentAccount ? accountDisplay({ ...currentAccount, online: true }) : null
  ), [currentAccount])

  const activeRoom = activeRoomId ? rooms.find((room) => room.id === activeRoomId) || null : null

  const inRoom = Boolean(activeRoom)

  const roomPlaybackActive = Boolean(activeRoom && view === 'room')

  const role = inRoom ? activeRoom.roles?.[currentUserId] || 'listener' : 'listener'

  const canControlRoom = role === 'admin' || role === 'dj'

  const canControl = !roomPlaybackActive || canControlRoom

  const canModerate = roomPlaybackActive && role === 'admin'

  const remoteSpeaking = Object.keys(remoteVoice).length > 0

  const voiceSpeaking = speaking || remoteSpeaking

  const repeatMode = ['off', 'all', 'one'].includes(settings.repeatMode) ? settings.repeatMode : 'off'

  const shuffleEnabled = Boolean(settings.shuffleEnabled)

  const soloPlaybackIds = useMemo(() => shuffleEnabled && soloQueue.length
    ? [
        ...new Set([
          ...soloPlayOrder.filter((id) => soloQueue.includes(id)),
          ...soloQueue.filter((id) => !soloPlayOrder.includes(id)),
        ]),
      ]
    : soloQueue, [shuffleEnabled, soloQueue, soloPlayOrder])

  const activeKey = roomPlaybackActive ? activeRoom.id : SOLO_ROOM_ID

  const queueIds = roomPlaybackActive ? activeRoom.trackIds : soloPlaybackIds

  const queue = useMemo(() => queueIds.map((id) => {
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
  }), [queueIds, library])

  const requestedIndex = currentByRoom[activeKey] ?? 0

  const currentIndex = queue.length ? Math.min(requestedIndex, queue.length - 1) : 0

  const track = queue[currentIndex] || (roomPlaybackActive ? ROOM_EMPTY_TRACK : EMPTY_TRACK)

  const roomMessages = activeRoomId ? messages[activeRoomId] || [] : []

  const typingMemberId = activeRoomId ? typing[activeRoomId] || null : null

  const likedSet = Array.isArray(liked) ? liked : []

  const displayRoom = roomPlaybackActive && activeRoom ? activeRoom : {
    id: SOLO_ROOM_ID,
    name: 'Your listening session',
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

  const shellChatOpen = inRoom && view === 'room' && chatOpen

  const shellQueueOpen = queueOpen

  const shellDrawerOpen = shellChatOpen || loungeOpen || shellQueueOpen

  const activeRoomUnread = activeRoomId ? unreadRoomCounts[activeRoomId] || 0 : 0

  const loungeTypingId = Object.values(loungeTyping)[0] || null

  const loungeTypingMember = loungeTypingId
    ? (memberIndex[loungeTypingId] || { id: loungeTypingId, name: 'Someone', handle: 'listener' })
    : null

  const lyricsKey = track?.id || 'empty'

  useEffect(() => {
    startNetworkMonitor()
  }, [])

  useEffect(() => {
    activeRoomRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  useEffect(() => {
    loungeOpenRef.current = loungeOpen
    if (!loungeOpen) {
      setLoungeVoicePlaying(false)
      return
    }
    setLoungeUnreadCount(0)
    loungeUnreadRef.current = 0
    setLatestLoungePreview(null)
    clearTimeout(loungePreviewTimerRef.current)
  }, [loungeOpen])

  useEffect(() => {
    loungeMessagesRef.current = loungeMessages
    writeStorage(PUBLIC_LOUNGE_KEY, loungeMessages)
  }, [loungeMessages])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !loungeOpenRef.current) return
      setLoungeUnreadCount(0)
      loungeUnreadRef.current = 0
      setLatestLoungePreview(null)
      clearTimeout(loungePreviewTimerRef.current)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    trimBoundedSet(receivedChatIdsRef.current)
    trimBoundedSet(receivedLoungeIdsRef.current)
    trimBoundedSet(acceptedInviteRoomsRef.current)
  }, [])

  useEffect(() => () => {
    clearTimeout(loungePreviewTimerRef.current)
    Object.values(loungeTypingClearRef.current).forEach((timer) => clearTimeout(timer))
  }, [])

  useEffect(() => {
    if (view !== 'room') setChatOpen(false)
    if (view === 'room') setQueueOpen(false)
  }, [view])

  useEffect(() => {
    if (searchOpen) setChatOpen(false)
  }, [searchOpen])

  useEffect(() => {
    if (fullPlayer) setQueueOpen(false)
  }, [fullPlayer])

  useEffect(() => {
    if (!activeRoomId || view !== 'room') return
    setUnreadRoomCounts((previous) => {
      if (!previous[activeRoomId]) return previous
      const next = { ...previous }
      delete next[activeRoomId]
      return next
    })
    clearRoomPreview(activeRoomId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, view, chatOpen])

  useEffect(() => () => {
    Object.values(roomPreviewTimersRef.current).forEach((timer) => clearTimeout(timer))
  }, [])

  useEffect(() => {
    roomsRef.current = rooms
  }, [rooms])

  useEffect(() => {
    queueIdsRef.current = queueIds
  }, [queueIds])

  useEffect(() => {
    soloQueueRef.current = soloQueue
  }, [soloQueue])

  useEffect(() => {
    soloPlayOrderRef.current = soloPlaybackIds
  }, [soloPlaybackIds])

  useEffect(() => {
    if (!isPlaying) lastPauseAtRef.current = Date.now()
  }, [isPlaying])

  useEffect(() => {
    roomQueueRef.current = activeRoom?.trackIds || []
  }, [activeRoom])

  useEffect(() => {
    libraryRef.current = library
  }, [library])

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
    roomControlRef.current = canControlRoom
  }, [canControlRoom])

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
    const visible = liked.filter((id) => library[id])
    if (visible.length !== liked.length) {
      setLiked(visible)
      return
    }
    writeUserValue(
      LIKES_KEY,
      currentUserId,
      visible.map((id) => sanitizeTrack(library[id])),
    )
  }, [currentUserId, liked, library])

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
    setPreferredStreamQuality(settings.quality || 'high')
  }, [currentUserId, settings])

  useEffect(() => {
    writeUserValue(TASTE_PROFILE_KEY, currentUserId || 'guest', tasteProfile)
  }, [currentUserId, tasteProfile])

  useEffect(() => {
    const userKey = currentUserId || 'guest'
    const starter = buildDailyStarterFeed(dailyDayKey, userKey, library)
    const existing = loadDailyFeedCache(dailyDayKey)
    const existingUser = existing?.users?.[userKey]
    if (existing) {
      setDailyFeed(fillDailyFeed(existing, starter, userKey))
      if (existingUser && dailyRefresh === 0) {
        setDailyStatus('ready')
        return undefined
      }
    }
    let cancelled = false
    setDailyStatus('loading')
    const taste = {
      ...tasteSummary(library, likedSet, recent, playlists),
      profileArtists: topTasteLabels(tasteProfile.artists, 4),
      profileLanguages: topTasteLabels(tasteProfile.languages, 2),
      profileVibes: tasteProfile.tuned
        .map((id) => TASTE_VIBES.find((vibe) => vibe.id === id))
        .filter(Boolean),
      profileSearches: tasteProfile.searches.slice(0, 2).map((entry) => entry.query),
      profileEvents: tasteProfile.events,
    }
    buildDailyFeed({
      dayKey: dailyDayKey,
      userKey,
      taste,
      rotation: dailyRefresh,
      existing,
    })
      .then((feed) => {
        if (cancelled) return
        const users = { ...(existing?.users || {}), ...feed.users }
        const next = fillDailyFeed(
          { dayKey: dailyDayKey, builtAt: feed.builtAt, liveCount: feed.liveCount, trending: feed.trending, users },
          starter,
          userKey,
        )
        setDailyFeed(next)
        setDailyStatus('ready')
        saveDailyFeedCache(dailyDayKey, next)
      })
      .catch(() => {
        if (cancelled) return
        setDailyStatus((previous) => (previous === 'ready' ? 'ready' : 'error'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyDayKey, currentUserId, dailyRefresh])

  useEffect(() => {
    if (!sidebarOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 880) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) && !event.target?.isContentEditable)) {
        event.preventDefault()
        openSearchExperience()
      }
      if (event.key === 'Escape') {
        if (searchOpen) closeSearchExperience()
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
    leaveRoomPlayback()
    setView('home')
    viewRef.current = 'home'
  }, [rooms, activeRoomId])

  useEffect(() => {
    if (view === 'room' || !activeRoomId) return
    audioRef.current?.pause()
    setIsPlaying(false)
    setJoinPill(null)
  }, [view, activeRoomId])

  useEffect(() => {
    if (activeRoomId) return
    const resume = soloResumeRef.current
    if (!resume?.track || track?.id !== resume.track) return
    soloResumeRef.current = null
    pendingSeekRef.current = resume.time || 0
    setSeekSignal((value) => value + 1)
    updatePlaybackProgress(resume.time || 0)
    setDuration(track?.duration || 0)
  }, [activeRoomId, track?.id, track?.streamUrl])

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
    if (room.private) rememberBoundedId(acceptedInviteRoomsRef.current, room.id)
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
    ;(Array.isArray(userLikes) ? userLikes : []).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return
      const track = sanitizeTrack(entry)
      if (track.id) saveLibraryEntry(track.id, track)
    })
    setLiked(likedIdsFrom(userLikes))
    setLibrary((previous) => mergeLikedTracks(previous, userLikes).library)
    setPlaylists(Array.isArray(userPlaylists) ? userPlaylists : [])
    setRecent(Array.isArray(userRecent) ? userRecent : [])
    setTasteProfile(loadTasteProfile(id))
    setSettings(userSettings)
    setTranslateOn(Boolean(userSettings.autoTranslate))
    setPreferredStreamQuality(userSettings.quality || 'high')
    setActiveRoomId(null)
    setSoloQueue([])
    setSoloPlayOrder([])
    soloQueueRef.current = []
    soloPlayOrderRef.current = []
    setCurrentByRoom({ [SOLO_ROOM_ID]: 0 })
    setActivePlaylistId(null)
    setView('home')
    setIsPlaying(false)
    playbackProgressStore.set(0)
    progressRef.current = 0
    updatePlaybackProgress(0)
    setDuration(0)
    setDraft('')
    setReplyTo(null)
    setJoinPill(null)
    setSearchOpen(false)
    setFullPlayer(false)
    setSettingsOpen(false)
    setTasteOpen(false)
    setMembersOpen(false)
    setJoinRoomOpen(false)
    setRoomEditor(null)
    soloSnapshotRef.current = { track: null, currentTime: 0, isPlaying: false, queue: [], index: 0 }
    soloResumeRef.current = null
    searchRoomRef.current = null
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
    clearPreloadSession()
    setIsPlaying(false)
    audioRef.current?.pause()
    stopMic()
    setCurrentUserId(null)
    setLiked([])
    setPlaylists([])
    setRecent([])
    setSoloQueue([])
    setSoloPlayOrder([])
    soloQueueRef.current = []
    soloPlayOrderRef.current = []
    setCurrentByRoom({ [SOLO_ROOM_ID]: 0 })
    setTasteProfile(loadTasteProfile('guest'))
    setSettings({ ...DEFAULT_SETTINGS })
    setTranslateOn(false)
    setActiveRoomId(null)
    setActivePlaylistId(null)
    setView('home')
    setSearchOpen(false)
    searchRoomRef.current = null
    setFullPlayer(false)
    setSettingsOpen(false)
    setTasteOpen(false)
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

  function recordTasteSignal(type, payload = {}) {
    setTasteProfile((previous) => applyTasteSignal(previous, type, payload))
  }

  function recordSearchQuery(query) {
    const clean = safeText(query)
    if (!clean) return
    recordTasteSignal('search', { query: clean })
  }

  function removeRecentSearch(query) {
    setTasteProfile((previous) => ({
      ...previous,
      searches: previous.searches.filter((entry) => entry.query !== query),
      updatedAt: Date.now(),
    }))
  }

  function clearRecentSearches() {
    setTasteProfile((previous) => ({ ...previous, searches: [], updatedAt: Date.now() }))
  }

  function saveTasteVibes(vibes) {
    recordTasteSignal('tune', { vibes })
    setTasteOpen(false)
    setDailyRefresh((value) => value + 1)
    showToast(vibes.length ? 'Your taste map has been tuned' : 'Taste preferences cleared')
  }

  function rememberTrack(candidate) {
    if (!candidate?.id) return
    const entry = sanitizeTrack({ ...candidate, status: candidate.status || 'ready' })
    setLibrary((previous) => ({
      ...previous,
      [entry.id]: sanitizeTrack({ ...(previous[entry.id] || {}), ...entry }),
    }))
    saveLibraryEntry(entry.id, entry)
  }

  function pushSystemMessage(roomId, text) {
    const message = { id: uid('sys'), system: true, text, time: clockNow(), reactions: [] }
    setMessages((previous) => ({ ...previous, [roomId]: [...(previous[roomId] || []), message] }))
    channelRef.current?.postMessage({ type: 'chat', roomId, sender: tabIdRef.current, message })
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
      if (activeRoomRef.current && viewRef.current === 'room') syncRoomClockFromPlayback()
      captureSoloSnapshot()
      audioRef.current?.pause()
      setIsPlaying(false)
      updatePlaybackProgress(0)
      setDuration(0)
      setDraft('')
      setReplyTo(null)
      setJoinPill(null)
      pendingSeekRef.current = null
      setRoomClock({
        roomId: candidate.id,
        index: 0,
        trackId: candidate.trackIds?.[0] || null,
        time: 0,
        isPlaying: false,
      })
    }
    activeRoomRef.current = candidate.id
    setActiveRoomId(candidate.id)
    setCurrentByRoom((previous) => ({ ...previous, [candidate.id]: previous[candidate.id] || 0 }))
    if (!changed && viewRef.current !== 'room') {
      resumeRoomOnEntry(candidate.id)
    } else {
      setView('room')
      viewRef.current = 'room'
    }
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
    if (room.private) rememberBoundedId(acceptedInviteRoomsRef.current, room.id)
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
    rememberBoundedId(acceptedInviteRoomsRef.current, room.id)
    setPasscodeRoomId(null)
    joinRoom(room)
    return {}
  }

  function createRoom(input, options = {}) {
    if (!currentUserId) return null
    const gradient = ROOM_GRADIENTS.find((option) => option.id === input.gradient) || ROOM_GRADIENTS[0]
    let code = roomCode()
    while (rooms.some((room) => room.code === code)) code = roomCode()
    const starter = input.starterTrack && !input.starterTrack.preview && Number(input.starterTrack.duration) >= 60 ? sanitizeTrack(input.starterTrack) : null
    if (starter) rememberTrack(starter)
    const trackIds = starter ? [starter.id] : (input.trackIds || []).filter(id => library[id] && Number(library[id].duration) >= 60).slice(0,1)
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
      private: Boolean(input.private),
      dj: currentUserId,
      code,
      leader: currentUserId,
      createdBy: currentUserId,
      createdAt: Date.now(),
    }
    captureSoloSnapshot()
    audioRef.current?.pause()
    setIsPlaying(false)
    updatePlaybackProgress(0)
    setDuration(0)
    pendingSeekRef.current = null
    setRooms((previous) => [...previous, room])
    setCurrentByRoom((previous) => ({ ...previous, [room.id]: 0 }))
    activeRoomRef.current = room.id
    setActiveRoomId(room.id)
    setView('room')
    viewRef.current = 'room'
    setRoomEditor(null)
    if (typeof window !== 'undefined' && window.innerWidth > 1050) setChatOpen(true)
    channelRef.current?.postMessage({ type: 'room-added', sender: tabIdRef.current, room })
    pushSystemMessage(room.id, `${currentUser?.name || 'You'} created this room · invite code ${room.code}`)
    if (starter) ensurePlayable(starter).then(ready => { if (ready && activeRoomRef.current === room.id) beginPlayback(room.id, [ready.id], 0, ready) })
    if (!options.silent) showToast(`Room created — invite code ${room.code}`)
    return room
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
      updatePlaybackProgress(0)
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
    setUnreadRoomCounts((previous) => {
      const next = { ...previous }
      delete next[roomId]
      return next
    })
    clearRoomPreview(roomId)
    leaveRoomPlayback()
    setView('rooms')
    viewRef.current = 'rooms'
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

  function inviteLoungeUser(userId) {
    if (requireAuth(null, 'Log in to invite someone to a private room.')) return false
    if (!currentUser || !userId) return false
    const target = accounts[userId] || publicUsers[userId]
    if (!target) {
      showToast('That listener is no longer available.', 'lock')
      return false
    }
    if (target.id === currentUserId) {
      showToast('That is you.')
      return false
    }
    if (target.allowInvites === false) {
      showToast(`${target.name} is not accepting direct room invites.`, 'lock')
      return false
    }
    if (loungeInviteGuardRef.current.has(target.id)) return false
    loungeInviteGuardRef.current.add(target.id)
    setLoungeInvitingId(target.id)
    const timer = setTimeout(() => {
      loungeInviteGuardRef.current.delete(target.id)
      setLoungeInvitingId((current) => (current === target.id ? '' : current))
    }, 4000)
    let room = null
    if (activeRoom && activeRoom.private && role === 'admin' && viewRef.current === 'room') {
      room = activeRoom
    } else {
      const myHandle = currentUser.handle || 'listener'
      const theirHandle = target.handle || 'listener'
      room = createRoom({
        name: `@${myHandle} × @${theirHandle} Lounge`,
        tagline: 'A private listening room, opened from the Public Lounge.',
        description: `A private room for @${myHandle} and @${theirHandle}.`,
        gradient: 'midnight',
        private: true,
      }, { silent: true })
    }
    if (!room) {
      clearTimeout(timer)
      loungeInviteGuardRef.current.delete(target.id)
      setLoungeInvitingId('')
      return false
    }
    if (room.members.includes(target.id)) {
      showToast(`${target.name} is already in ${room.name}.`, 'lock')
      clearTimeout(timer)
      loungeInviteGuardRef.current.delete(target.id)
      setLoungeInvitingId('')
      return false
    }
    const duplicate = invitesRef.current.some((invite) => (
      invite.roomId === room.id && invite.toUserId === target.id
    ))
    if (duplicate) {
      showToast(`${target.name} already has a pending invite to ${room.name}.`, 'lock')
      clearTimeout(timer)
      loungeInviteGuardRef.current.delete(target.id)
      setLoungeInvitingId('')
      return false
    }
    if (room === activeRoom && viewRef.current !== 'room') {
      setView('room')
      viewRef.current = 'room'
    }
    const invite = {
      id: uid('invite'),
      roomId: room.id,
      roomName: room.name,
      roomCode: room.code,
      fromId: currentUserId,
      fromHandle: currentUser.handle || 'listener',
      toUserId: target.id,
      createdAt: Date.now(),
    }
    setInvites((previous) => [...previous, invite])
    channelRef.current?.postMessage({ type: 'room-invite', sender: tabIdRef.current, invite })
    pushSystemMessage(room.id, `${currentUser.name || 'An admin'} invited ${target.name}`)
    showToast(`Invited @${target.handle || target.name} to ${room.name}`)
    closeLounge()
    clearTimeout(timer)
    setTimeout(() => {
      loungeInviteGuardRef.current.delete(target.id)
      setLoungeInvitingId((current) => (current === target.id ? '' : current))
    }, 1100)
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
    rememberBoundedId(acceptedInviteRoomsRef.current, room.id)
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
    leaveRoomPlayback()
    setView('rooms')
    viewRef.current = 'rooms'
    setUnreadRoomCounts((previous) => {
      const next = { ...previous }
      delete next[roomId]
      return next
    })
    clearRoomPreview(roomId)
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

  function clearRoomPreview(roomId) {
    if (!roomId) return
    clearTimeout(roomPreviewTimersRef.current[roomId])
    delete roomPreviewTimersRef.current[roomId]
    setLatestRoomPreview((previous) => {
      if (!previous[roomId]) return previous
      const next = { ...previous }
      delete next[roomId]
      return next
    })
  }

  function rememberRoomUnread(roomId, message) {
    if (!roomId || !message) return
    const member = memberIndexRef.current[message.author]
    const sender = message.userName || member?.name || member?.handle || 'Someone'
    const rawText = message.type === 'voice' ? '🎙️ Voice note' : String(message.text || 'New message')
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 74)
    setUnreadRoomCounts((previous) => ({
      ...previous,
      [roomId]: Math.min(99, (previous[roomId] || 0) + 1),
    }))
    setLatestRoomPreview((previous) => ({
      ...previous,
      [roomId]: { id: message.id, sender, text },
    }))
    clearTimeout(roomPreviewTimersRef.current[roomId])
    roomPreviewTimersRef.current[roomId] = setTimeout(() => {
      setLatestRoomPreview((previous) => {
        if (!previous[roomId]) return previous
        const next = { ...previous }
        delete next[roomId]
        return next
      })
      delete roomPreviewTimersRef.current[roomId]
    }, 6000)
  }

  function rememberLoungeUnread(message) {
    if (!message || message.author === currentUserRef.current?.id) return
    if (loungeOpenRef.current && document.visibilityState === 'visible') return
    const sender = message.authorHandle || 'listener'
    const rawText = message.type === 'voice' ? '🎙️ Voice note' : String(message.text || 'New message')
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 74)
    setLoungeUnreadCount((previous) => {
      const next = Math.min(999, previous + 1)
      loungeUnreadRef.current = next
      return next
    })
    setLatestLoungePreview({ id: message.id, sender, text })
    clearTimeout(loungePreviewTimerRef.current)
    loungePreviewTimerRef.current = setTimeout(() => setLatestLoungePreview(null), 6000)
  }

  function upsertLoungeMessage(message) {
    const normalized = normalizeLoungeMessage(message)
    if (!normalized) return
    setLoungeMessages((previous) => {
      const index = previous.findIndex((item) => item.id === normalized.id)
      const next = index >= 0
        ? previous.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item))
        : [...previous, normalized]
      return next.slice(-LOUNGE_MESSAGE_LIMIT)
    })
  }

  function applyLoungeReaction({ messageId, emoji, userId, userName, active }) {
    if (!messageId || !emoji || !userId) return
    setLoungeMessages((previous) => previous.map((message) => {
      if (message.id !== messageId) return message
      const reactions = (message.reactions || []).map((reaction) => ({
        ...reaction,
        userIds: Array.isArray(reaction.userIds) ? [...reaction.userIds] : [],
      }))
      const index = reactions.findIndex((reaction) => reaction.emoji === emoji)
      if (active) {
        if (index >= 0) {
          const reaction = reactions[index]
          if (!reaction.userIds.includes(userId)) {
            reaction.userIds.push(userId)
            reaction.count = Math.max(reaction.count + 1, reaction.userIds.length)
          }
        } else {
          reactions.push({ emoji, count: 1, userIds: [userId], users: userName ? [{ id: userId, name: userName }] : [] })
        }
      } else if (index >= 0) {
        const reaction = reactions[index]
        const hadUser = reaction.userIds.includes(userId)
        reaction.userIds = reaction.userIds.filter((id) => id !== userId)
        if (hadUser) reaction.count = Math.max(reaction.userIds.length, reaction.count - 1)
        if (!reaction.userIds.length) reactions.splice(index, 1)
      }
      return { ...message, reactions }
    }))
  }

  function removeLoungeMessage(messageId) {
    if (!messageId) return
    setLoungeMessages((previous) => previous.filter((message) => message.id !== messageId))
  }

  function openLounge() {
    setLoungeOpen(true)
    setChatOpen(false)
    setSidebarOpen(false)
    setLoungeUnreadCount(0)
    loungeUnreadRef.current = 0
    setLatestLoungePreview(null)
    clearTimeout(loungePreviewTimerRef.current)
  }

  function closeLounge() {
    setLoungeOpen(false)
    setLoungeVoicePlaying(false)
  }

  function openRoomChat(tab = 'chat') {
    setLoungeOpen(false)
    setChatOpen(true)
    setActiveTab(tab)
  }

  function handleLoungeDraft(value) {
    setLoungeDraft(value)
    if (!currentUserId || !value.trim()) return
    const now = Date.now()
    if (now - lastLoungeTypingRef.current < 900) return
    lastLoungeTypingRef.current = now
    channelRef.current?.postMessage({
      type: 'lounge-typing',
      sender: tabIdRef.current,
      userId: currentUserId,
      userName: currentUser?.name || 'Listener',
      authorHandle: currentUser?.handle || 'listener',
    })
  }

  function sendLoungeMessage() {
    if (!loungeDraft.trim()) return
    if (requireAuth(null, 'Log in to join the Public Lounge conversation.')) return
    if (!currentUser) return
    const replySnapshot = loungeReplyTo
      ? {
          id: loungeReplyTo.id,
          name: loungeReplyTo.name,
          handle: loungeReplyTo.handle,
          text: loungeReplyTo.text.slice(0, 180),
        }
      : null
    const message = {
      id: uid('lounge'),
      author: currentUserId,
      userName: currentUser.name || 'Listener',
      authorHandle: currentUser.handle || 'listener',
      text: loungeDraft.trim().slice(0, 1000),
      time: clockNow(),
      createdAt: Date.now(),
      reactions: [],
      read: true,
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    }
    upsertLoungeMessage(message)
    channelRef.current?.postMessage({
      type: 'lounge-message',
      sender: tabIdRef.current,
      message,
    })
    setLoungeDraft('')
    setLoungeReplyTo(null)
  }

  function sendLoungeVoiceNote({ dataUrl, duration, waveform }) {
    if (!dataUrl) return
    if (requireAuth(null, 'Log in to send a voice note in the Public Lounge.')) return
    if (!currentUser) return
    const replySnapshot = loungeReplyTo
      ? {
          id: loungeReplyTo.id,
          name: loungeReplyTo.name,
          handle: loungeReplyTo.handle,
          text: loungeReplyTo.text || 'Voice note',
        }
      : null
    const message = {
      id: uid('lounge'),
      author: currentUserId,
      userName: currentUser.name || 'Listener',
      authorHandle: currentUser.handle || 'listener',
      type: 'voice',
      text: '',
      voiceData: dataUrl,
      duration: Math.max(1, Math.min(45, Number(duration) || 1)),
      waveform: Array.isArray(waveform) ? waveform : [],
      time: clockNow(),
      createdAt: Date.now(),
      reactions: [],
      read: true,
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    }
    upsertLoungeMessage(message)
    channelRef.current?.postMessage({
      type: 'lounge-message',
      sender: tabIdRef.current,
      message,
    })
    setLoungeReplyTo(null)
  }

  function reactToLoungeMessage(messageId, emoji) {
    if (!emoji) return
    if (requireAuth(null, 'Log in to react in the Public Lounge.')) return
    if (!currentUser) return
    const message = loungeMessagesRef.current.find((item) => item.id === messageId)
    if (!message) return
    const reaction = (message.reactions || []).find((item) => item.emoji === emoji)
    const active = !(reaction?.userIds || []).includes(currentUserId)
    applyLoungeReaction({
      messageId,
      emoji,
      userId: currentUserId,
      userName: currentUser.name,
      active,
    })
    channelRef.current?.postMessage({
      type: 'lounge-reaction',
      sender: tabIdRef.current,
      messageId,
      emoji,
      userId: currentUserId,
      userName: currentUser.name || 'Listener',
      active,
    })
  }

  function deleteLoungeMessage(messageId) {
    if (!currentUser) return
    const message = loungeMessagesRef.current.find((item) => item.id === messageId)
    if (!message || message.author !== currentUser.id) return
    removeLoungeMessage(messageId)
    channelRef.current?.postMessage({
      type: 'lounge-delete',
      sender: tabIdRef.current,
      messageId,
    })
    showToast('Lounge message deleted')
  }

  function sendMessage() {
    if (!activeRoom || !currentUserId || !draft.trim()) return
    const replySnapshot = replyTo
      ? { id: replyTo.id, name: replyTo.name, handle: replyTo.handle, text: replyTo.text.slice(0, 140) }
      : null
    const message = {
      id: uid('msg'),
      author: currentUserId,
      userName: currentUser?.name || 'Listener',
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
      userName: currentUser?.name || 'Listener',
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
        visibility: 'public',
      }
      if (pendingPlaylistTrack) {
        rememberPlaylistTrack(pendingPlaylistTrack)
        recordTasteSignal('playlist', { track: pendingPlaylistTrack })
      }
      setPlaylists((previous) => [playlist, ...previous])
      setActivePlaylistId(playlist.id)
      navigateView('library')
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
    const playlist = playlists.find((item) => item.id === playlistId)
    const alreadyAdded = Boolean(playlist?.trackIds.includes(candidate.id))
    setPlaylists((previous) => previous.map((item) => (
      item.id === playlistId && !item.trackIds.includes(candidate.id)
        ? { ...item, trackIds: [...item.trackIds, candidate.id] }
        : item
    )))
    if (!alreadyAdded) recordTasteSignal('playlist', { track: candidate })
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
    navigateView('library')
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

  function toggleLike(trackOrId) {
    const trackId = likedTrackId(trackOrId)
    if (!trackId || trackId === 'empty') return
    const candidate = trackOrId && typeof trackOrId === 'object'
      ? trackOrId
      : library[trackId] || SEED_BY_ID[trackId] || null
    if (requireAuth({ type: 'like', trackId, track: candidate }, 'Log in to save tracks to your library.')) return
    const removing = liked.includes(trackId)
    if (!removing && candidate) {
      rememberTrack(candidate)
      recordTasteSignal('like', { track: candidate })
    }
    setLiked((previous) => (
      previous.includes(trackId)
        ? previous.filter((id) => id !== trackId)
        : [trackId, ...previous]
    ))
    showToast(removing ? 'Removed from your library' : 'Saved to your library')
  }

  async function startRoomTrack(candidate) {
    const roomId = activeRoomRef.current
    if (!roomId || !canControlRoom) { lockToast(); return }
    const playable = await ensurePlayable(candidate)
    if (!playable || activeRoomRef.current !== roomId) return
    const room = roomsRef.current.find(item => item.id === roomId)
    if (!room) return
    const { ids, index } = addTrackToRoomQueue(room, playable.id)
    beginPlayback(roomId, ids, index, playable)
  }

  function openSearchExperience() {
    document.getElementById('canonical-search-input')?.focus()
    const targetRoom = viewRef.current === 'room' ? activeRoomRef.current : null
    const room = targetRoom ? roomsRef.current.find((candidate) => candidate.id === targetRoom) : null
    searchTargetRef.current = {
      mode: targetRoom ? 'room' : 'solo',
      roomId: targetRoom || null,
    }
    searchRoomRef.current = null
    setSearchContext({
      mode: targetRoom ? 'room' : 'solo',
      roomId: targetRoom || null,
      roomName: room?.name || '',
    })
    setSearchOpen(true)
  }

  function closeSearchExperience() {
    searchRoomRef.current = null
    setSearchOpen(false)
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
    if (lyrics.translatable === false || lyrics.language === 'en' || lyrics.language === 'hi') {
      setTranslating(false)
      return undefined
    }
    if (lyrics.lines.every((line) => line.enText || !(line.sourceText || line.text)?.trim())) return undefined
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

  const {
    blockShortPlayback,
    safeYouTubePlay,
    safeAudioPlay,
    clearAdvanceCheck,
    waitForMediaReady,
    retryDirectUrl,
    scheduleAdvanceCheck,
    getPlaybackTime,
    updatePlaybackProgress,
    buildSoloPlayOrder,
    commitSoloQueue,
    cycleRepeatMode,
    toggleShuffleMode,
    shuffleSoloQueue,
    reorderSoloQueue,
    removeSoloQueueTrack,
    clearSoloQueue,
    toggleQueuePanel,
    captureSoloSnapshot,
    leaveRoomPlayback,
    beginPlayback,
    ensurePlayable,
    playIndex,
    startPlaybackAt,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    handleVolume,
    handleEnded,
    maybePreloadNext,
    maybeCrossfade,
    clearStallTimer,
    handleAudioBuffering,
    handleAudioReady,
    recoverCurrentStream,
    handleAudioError,
    acceptJoin,
    commitRoomQueue,
    placeRoomAt,
    startRoomQueueAt,
    addTrackToRoomQueue,
    removeRoomQueueTrack,
    clearRoomQueue,
    importPlaylistToRoom,
    searchRoomTarget,
    startTasteRadio,
    playSearchTrack,
    queueSearchTrack,
    playSoloQueue,
    playSoloTrack,
    queueSoloTrack,
    findFullVersion,
    handleTimeUpdate,
    handleLoadedMetadata,
    sleepTimer, setSleepTimer,
  } = usePlaybackEngine({
    state: {
      setIsPlaying,
      setBuffering,
      setLibrary,
      setJoinPill,
      setSoloQueue,
      setSoloPlayOrder,
      setSettings,
      soloQueue,
      setCurrentByRoom,
      setDuration,
      setQueueOpen,
      setChatOpen,
      setFullPlayer,
      loungeOpen,
      currentByRoom,
      setActiveRoomId,
      library,
      isPlaying,
      duration,
      setSeekSignal,
      setVolume,
      setMuted,
      settings,
      setCrossfadeGain,
      setStreamRecovering,
      setRecoverySignal,
      joinPill,
      activeRoomId,
      setRooms,
      currentUserId,
      setPendingPlayId,
      setView,
      muted,
      volume,
      crossfadeGain,
      recoverySignal,
      seekSignal,
      speaking,
      voiceNotePlaying,
      loungeVoicePlaying,
    },
    refs: {
      loadedUrlRef,
      playAttemptIdRef,
      hasInteractedRef,
      activeRoomRef,
      advanceCheckRef,
      resumeAttemptRef,
      isPlayingRef,
      progressRef,
      audioRef,
      sleepPausedRef,
      ytPlayerRef,
      shuffleSeedRef,
      soloPlayOrderRef,
      soloQueueRef,
      soloSnapshotRef,
      soloResumeRef,
      pendingSeekRef,
      searchRoomRef,
      searchTargetRef,
      viewRef,
      libraryRef,
      queueIdsRef,
      currentIndexRef,
      lastPauseAtRef,
      crossfadeLockRef,
      fadeFrameRef,
      crossfadeGainRef,
      stallTimerRef,
      recoveryRef,
      roomQueueRef,
      roomsRef,
      roomClockRef,
      playRequestRef,
      previousShuffleRef,
      ytContainerRef,
      handleEndedRef,
    },
    model: {
      track,
      shuffleEnabled,
      inRoom,
      repeatMode,
      soloPlaybackIds,
      currentIndex,
      canControl,
      queueIds,
      queue,
      roomPlaybackActive,
      youtubeActive,
      canControlRoom,
      activeRoom,
      currentUser,
      remoteSpeaking,
    },
    actions: {
      showToast,
      closeLounge,
      stopMic,
      setRoomClock: (...args) => setRoomClock(...args),
      announce: (...args) => announce(...args),
      addRecent,
      recordTasteSignal,
      lockToast,
      requireAuth,
      roomClockTime: (...args) => roomClockTime(...args),
      advanceRoomClock: (...args) => advanceRoomClock(...args),
      broadcastRoom: (...args) => broadcastRoom(...args),
      syncRoomClockFromPlayback: (...args) => syncRoomClockFromPlayback(...args),
      rememberTrack,
      closeSearchExperience,
      suspendRoomPlayback: (...args) => suspendRoomPlayback(...args),
    },
  })

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

  const social = useSocialFeatures({ currentUser, tasteProfile, library, playlists, recent, liked: likedSet, members:memberIndex, rooms, activeRoom, roomPlaybackActive, isPlaying, track,
    channelRef, tabIdRef, roomsRef, activeRoomRef, roomClockRef, roomQueueRef, setRooms, setMessages, setPlaylists,
    rememberTrack, toggleLike, queueSoloTrack, playSearchTrack: (candidate, context) => { searchTargetRef.current = { mode: 'solo', roomId: null }; viewRef.current = 'home'; setView('home'); return playSearchTrack(candidate, context) }, playPlaylist, joinRoom, inviteLoungeUser, showToast, upsertLoungeMessage,
    getPlaybackTime: (...args)=>getPlaybackTime(...args), roomClockTime: (...args)=>roomClockTime(...args),
    roomSnapshot: (...args)=>roomSnapshot(...args), applyRemoteState: (...args)=>applyRemoteState(...args),
  })
  const socialRef = useRef(social); socialRef.current = social
  const {
    broadcastRoom,
    requestRoomSync,
    setRoomClock,
    roomClockTime,
    roomTrackDuration,
    syncRoomClockFromPlayback,
    suspendRoomPlayback,
    resumeRoomOnEntry,
    advanceRoomClock,
    roomSnapshot,
    announce,
    applyRemoteState,
  } = useRoomSync({
    state: {
      setIsPlaying,
      setJoinPill,
      setBuffering,
      setActiveRoomId,
      setCurrentByRoom,
      setSeekSignal,
      setDuration,
      setView,
      activeRoomId,
      setInvites,
      setLoungeTyping,
      setRooms,
      setMessages,
      setUnreadRoomCounts,
      setRemoteVoice,
      setTyping,
    },
    refs: {
      channelRef,
      tabIdRef,
      roomClockRef,
      libraryRef,
      activeRoomRef,
      currentIndexRef,
      roomQueueRef,
      audioRef,
      sleepPausedRef,
      isPlayingRef,
      viewRef,
      pendingSeekRef,
      roomsRef,
      hasInteractedRef,
      currentUserRef,
      receivedLoungeIdsRef,
      loungeTypingClearRef,
      soloSnapshotRef,
      soloResumeRef,
      receivedChatIdsRef,
      chatOpenRef,
      memberIndexRef,
      remoteVoiceTimersRef,
      typingClearRef,
      canControlRef,
      roomControlRef,
    },
    model: {
      roomPlaybackActive,
    },
    actions: {
      handleSocialEvent: data => socialRef.current.handleEvent(data),
      getPlaybackTime: (...args) => getPlaybackTime(...args),
      updatePlaybackProgress: (...args) => updatePlaybackProgress(...args),
      ensurePlayable: (...args) => ensurePlayable(...args),
      beginPlayback: (...args) => beginPlayback(...args),
      showToast,
      rememberLoungeUnread,
      upsertLoungeMessage,
      applyLoungeReaction,
      removeLoungeMessage,
      clearRoomPreview,
      rememberRoomUnread,
      markRemoteVoice,
      pushRemoteAudioChunk,
      stopRemoteAudio,
    },
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
    setPreferredStreamQuality(merged.quality || 'high')
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
    clearPreloadSession()
    setLibrary(() => mergeLikedTracks(
      buildInitialLibrary(),
      readUserValue(LIKES_KEY, currentUserId, []),
    ).library)
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
      toggleLike(action.track || action.trackId)
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
    if (viewRef.current === 'room' && nextView !== 'room') {
      suspendRoomPlayback()
      setFullPlayer(false)
    }
    if (nextView === 'room' && activeRoomRef.current) {
      if (viewRef.current !== 'room') resumeRoomOnEntry(activeRoomRef.current)
      setFullPlayer(false)
      return
    }
    if (nextView === 'home') {
      setJoinPill(null)
      setActivePlaylistId(null)
      setView('home')
    } else {
      setView(nextView)
    }
    viewRef.current = nextView
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

  function refreshDailyFeed() {
    setDailyRefresh((value) => value + 1)
  }

  function requestEditRoom() {
    if (requireAuth({ type: 'settings' }, 'Log in to manage room settings.')) return
    setRoomEditor('edit')
  }

  const healArtwork = useCallback((trackId, cover) => {
    const safeCover = normalizeArtworkUrl(cover)
    if (!trackId || !safeCover) return
    persistTrackArtwork(trackId, safeCover)
    setLibrary((previous) => (
      previous[trackId] ? { ...previous, [trackId]: { ...previous[trackId], cover: safeCover } } : previous
    ))
    setDailyFeed((previous) => {
      const updateUser = (user) => ({
        ...user,
        madeForYou: replaceTrackArtwork(user?.madeForYou, trackId, safeCover),
        basedOnRecent: replaceTrackArtwork(user?.basedOnRecent, trackId, safeCover),
      })
      return {
        ...previous,
        trending: replaceTrackArtwork(previous.trending, trackId, safeCover),
        users: Object.fromEntries(Object.entries(previous.users || {}).map(([id, user]) => [id, updateUser(user)])),
      }
    })
  }, [])

  const artworkContextValue = useMemo(() => ({
    heal: healArtwork,
    fallback: fetchArtworkFallback,
  }), [healArtwork])

  const searchDailyUser = dailyFeed?.users?.[currentUserId || 'guest'] || {}

  const searchSuggestions = buildTasteSuggestions(tasteProfile, searchDailyUser, dailyFeed?.trending)

  const searchTasteTracks = (searchDailyUser.madeForYou?.length ? searchDailyUser.madeForYou : dailyFeed?.trending) || []

  const recentSearches = tasteProfile.searches.map((entry) => entry.query).filter(Boolean)

  const trackPalette = useTrackPalette(track)

  const accent = trackPalette?.accent || displayRoom.accent || '#f16b73'

  const accent2 = trackPalette?.accent2 || displayRoom.accent2 || '#f2b38e'

  const rootStyle = {
    '--accent': accent,
    '--accent-2': accent2,
    '--song-accent': accent,
    '--song-accent-rgb': trackPalette?.accentRgb || '145, 100, 210',
    '--song-accent-2': accent2,
    '--song-glow': trackPalette?.glow || `color-mix(in srgb, ${accent} 30%, transparent)`,
    '--song-surface': trackPalette?.surface || `color-mix(in srgb, ${accent} 13%, #0b0c0f)`,
  }

  useOverlayHistory([
    { id: 'full-player', open: Boolean(fullPlayer), onClose: () => { setFullPlayer(false) } },
    { id: 'queue', open: Boolean(shellQueueOpen), onClose: () => { setQueueOpen(false) } },
    { id: 'lounge', open: Boolean(loungeOpen), onClose: () => { closeLounge() } },
    { id: 'chat', open: Boolean(shellChatOpen), onClose: () => { setChatOpen(false) } },
    { id: 'search', open: Boolean(searchOpen), onClose: () => { closeSearchExperience() } },
    { id: 'taste', open: Boolean(tasteOpen), onClose: () => { setTasteOpen(false) } },
    { id: 'settings', open: Boolean(settingsOpen), onClose: () => { setSettingsOpen(false) } },
    { id: 'members', open: Boolean(membersOpen), onClose: () => { setMembersOpen(false) } },
    { id: 'room-editor', open: Boolean(roomEditor), onClose: () => { setRoomEditor(null) } },
    { id: 'join-room', open: Boolean(joinRoomOpen), onClose: () => { setJoinRoomOpen(false) } },
    { id: 'passcode', open: Boolean(passcodeRoomId), onClose: () => { setPasscodeRoomId(null) } },
    { id: 'auth', open: Boolean(authOpen), onClose: () => { setAuthOpen(false) } },
    { id: 'playlist', open: Boolean(playlistDialog), onClose: () => { setPlaylistDialog(null); setPendingPlaylistTrack(null) } },
    { id: 'add-playlist', open: Boolean(addTrack), onClose: () => { setAddTrack(null) } },
  ])

  return useStableActions({
    social,
    queueFilter, setQueueFilter, sleepTimer, setSleepTimer,
    queueSoloTrack, startTasteRadio,
    startRoomTrack,
    artworkContextValue,
    memberIndex,
    theme,
    rootStyle,
    audioRef,
    ytContainerRef,
    track,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleAudioReady,
    handleAudioBuffering,
    handleEnded,
    handleAudioError,
    shellDrawerOpen,
    displayRoom,
    rooms,
    view,
    roomPlaybackActive,
    role,
    likedSet,
    library,
    currentUser,
    playlists,
    navigateView,
    openSearchExperience,
    joinRoom,
    requestJoinCode,
    copyInvite,
    requestCreateRoom,
    openProfile,
    openCreatePlaylist,
    openPlaylist,
    leaveRoom,
    unreadRoomCounts,
    latestRoomPreview,
    loungeOpen,
    loungeUnreadCount,
    latestLoungePreview,
    openLounge,
    sidebarOpen,
    setSidebarOpen,
    joinPill,
    inRoom,
    acceptJoin,
    chatOpen,
    activeRoomUnread,
    setTheme,
    setChatOpen,
    openAuth,
    closeLounge,
    activeRoom,
    activePlaylistId,
    recent,
    dailyFeed,
    dailyStatus,
    tasteProfile,
    setTasteOpen,
    refreshDailyFeed,
    playSoloTrack,
    playPlaylist,
    toggleLike,
    requestAddToPlaylist,
    setActivePlaylistId,
    addTrackToPlaylist,
    openEditPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    shufflePlaylist,
    importPlaylistToRoom,
    queue,
    currentIndex,
    isPlaying,
    duration,
    canControl,
    volume,
    muted,
    pendingRequest,
    requestRole,
    resolveRoleRequest,
    setMembersOpen,
    requestEditRoom,
    findFullVersion,
    lockToast,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    handleVolume,
    setMuted,
    playIndex,
    setFullPlayer,
    canControlRoom,
    removeRoomQueueTrack,
    clearRoomQueue,
    buffering,
    streamRecovering,
    toggleQueuePanel,
    cycleRepeatMode,
    toggleShuffleMode,
    repeatMode,
    shuffleEnabled,
    shellQueueOpen,
    activeTab,
    setLoungeOpen,
    setActiveTab,
    roomMessages,
    typingMemberId,
    draft,
    handleDraft,
    sendMessage,
    sendVoiceNote,
    setVoiceNotePlaying,
    reactToMessage,
    lyrics,
    setLyricsRefresh,
    deleteMessage,
    setReplyTo,
    replyTo,
    canModerate,
    translateOn,
    translating,
    toggleTranslation,
    micOn,
    micLevel,
    remoteSpeaking,
    voiceSpeaking,
    duckTest,
    toggleMic,
    runDuckTest,
    settings,
    setQueueOpen,
    reorderSoloQueue,
    removeSoloQueueTrack,
    clearSoloQueue,
    shuffleSoloQueue,
    loungeMessages,
    loungeTypingMember,
    loungeDraft,
    handleLoungeDraft,
    sendLoungeMessage,
    sendLoungeVoiceNote,
    setLoungeVoicePlaying,
    reactToLoungeMessage,
    deleteLoungeMessage,
    setLoungeReplyTo,
    loungeReplyTo,
    openRoomChat,
    inviteLoungeUser,
    loungeInvitingId,
    queueOpen,
    pendingInvite,
    resolveInvite,
    moderatorRequest,
    searchOpen,
    closeSearchExperience,
    playSearchTrack,
    queueSearchTrack,
    searchSuggestions,
    recentSearches,
    recordSearchQuery,
    removeRecentSearch,
    clearRecentSearches,
    searchTasteTracks,
    searchContext,
    pendingPlayId,
    fullPlayer,
    tasteOpen,
    saveTasteVibes,
    settingsOpen,
    cacheInfo,
    currentUserId,
    setSettingsOpen,
    saveProfile,
    saveUserSettings,
    clearAllCaches,
    signOut,
    membersOpen,
    publicUsers,
    inviteUser,
    showToast,
    kickMember,
    assignRole,
    roomEditor,
    setRoomEditor,
    updateRoom,
    deleteRoom,
    createRoom,
    joinRoomOpen,
    setJoinRoomOpen,
    joinRoomByCode,
    passcodeRoomId,
    setPasscodeRoomId,
    unlockPrivateRoom,
    authOpen,
    authMode,
    authReason,
    authNotice,
    pendingRoomCode,
    setAuthOpen,
    pendingAuthActionRef,
    setAuthReason,
    setAuthNotice,
    setAuthMode,
    signIn,
    signUp,
    playlistDialog,
    setPlaylistDialog,
    setPendingPlaylistTrack,
    submitPlaylist,
    addTrack,
    setAddTrack,
    toast,
  })

}
