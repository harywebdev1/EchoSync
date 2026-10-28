import { useSleepTimer } from './useSleepTimer.js'
import {
  clearResolvedStream,
  evictLibraryEntry,
  RESUME_RELOAD_TIMEOUT,
  RESUME_ADVANCE_TIMEOUT,
  seededShuffle,
  SOLO_ROOM_ID,
  SEED_BY_ID,
  sanitizeTrack,
  isFullLengthTrack,
  isPreviewTrack,
  saveLibraryEntry,
  withTimeout,
  resolveFullTrack,
  resolveByMetadata,
  findInstantPreview,
  primeInstantPreview,
  loadRoomStateSnapshot,
  loadYouTubeApi,
} from '../lib/appServices.js'
import { playbackProgressStore, setLiveTelemetry } from '../state/playbackStore'
import { preloadQueueWindow, preloadCandidateAt } from '../services/preloadManager'
import { useEffect, useRef } from 'react'
import { useMediaSession, publishMediaSessionPosition } from './useMediaSession.js'
import { buildArtistRadio } from '../core/tasteEngine.js'
import { omniStreamChain } from '../core/omniMusicEngine.js'

const GUEST_PREVIEW_SECONDS = 30
export const GUEST_PREVIEW_BANNER = 'Sign in to hear full tracks.'

export function usePlaybackEngine({
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
    guestPreview,
    setGuestPreview,
    setPreviewCard,
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
    autoplay,
  },
  actions: {
    showToast,
    closeLounge,
    stopMic,
    setRoomClock,
    announce,
    addRecent,
    recordTasteSignal,
    lockToast,
    requireAuth,
    roomClockTime,
    advanceRoomClock,
    broadcastRoom,
    syncRoomClockFromPlayback,
    rememberTrack,
    closeSearchExperience,
    suspendRoomPlayback,
  },
}) {
  const radioActive = useRef(false)
  const guestPreviewRef = useRef(false)
  const previewGateRef = useRef(false)
  const previewUpgradeRef = useRef(false)
  const prefetchInFlightRef = useRef(new Set())
  const upgradeInFlightRef = useRef(new Set())
  const openPreviewGateRef = useRef(() => {})

  useEffect(() => {
    guestPreviewRef.current = Boolean(guestPreview)
    if (!guestPreview) {
      previewGateRef.current = false
      setPreviewCard(false)
    }
  }, [guestPreview, setPreviewCard])

  function openPreviewGate() {
    previewGateRef.current = true
    guestPreviewRef.current = true
    setGuestPreview(true)
    setIsPlaying(false)
    isPlayingRef.current = false
    setBuffering(false)
    setPreviewCard(true)
  }
  openPreviewGateRef.current = openPreviewGate

  // Dismissible end-card action: restart the same 30 second preview without
  // forcing the auth modal on the listener.
  function replayGuestPreview() {
    setPreviewCard(false)
    previewGateRef.current = false
    sleepPausedRef.current = false
    const audio = audioRef.current
    if (audio && track?.streamUrl) {
      try {
        audio.currentTime = 0
      } catch {
        /* metadata may still settle */
      }
      updatePlaybackProgress(0)
      setIsPlaying(true)
      return
    }
    if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(0, true)
      updatePlaybackProgress(0)
      setIsPlaying(true)
      return
    }
    if (track?.id) startGuestPreview(track, queue)
  }

  function previewSeconds(track) {
    const full = Number(track?.duration) || GUEST_PREVIEW_SECONDS
    return Math.min(GUEST_PREVIEW_SECONDS, Math.max(1, full))
  }

  // A shelf can contain dozens of rows. Persisting each one before the click
  // repaints delays the dock update, so context catalog writes run one task
  // later while the selected track takes over the player immediately.
  function rememberContextTracks(context, keepId) {
    const pending = context.filter((item) => item?.id && item.id !== keepId)
    if (!pending.length) return
    setTimeout(() => {
      pending.forEach((item) => rememberTrack(item))
    }, 0)
  }

  const { sleepTimer, setSleepTimer: selectSleepTimer, onSleepTrackEnded } = useSleepTimer(() => {
    sleepPausedRef.current = true
    playAttemptIdRef.current += 1
    clearAdvanceCheck()
    clearStallTimer()
    if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current)
    audioRef.current?.pause()
    ytPlayerRef.current?.pauseVideo?.()
    isPlayingRef.current = false
    setIsPlaying(false)
    setBuffering(false)
    setStreamRecovering(false)
    crossfadeLockRef.current = false
    crossfadeGainRef.current = 1
    setCrossfadeGain(1)
  })

  function setSleepTimer(mode) {
    if (mode === 'end-of-track') {
      if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current)
      crossfadeLockRef.current = false
      crossfadeGainRef.current = 1
      setCrossfadeGain(1)
    }
    selectSleepTimer(mode)
  }

  useEffect(() => { selectSleepTimer('off'); sleepPausedRef.current = false }, [currentUserId, selectSleepTimer])

  function safeYouTubePlay(player) {
    if (sleepPausedRef.current) return
    player?.playVideo?.()
  }

  async function safeAudioPlay(audio, attemptId) {
    if (sleepPausedRef.current) return false
    if (!audio?.play) return false
    const source = audio.getAttribute('src')
    if (audio.readyState < 1) {
      await new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer)
          audio.removeEventListener('loadedmetadata', done)
          audio.removeEventListener('error', done)
          audio.removeEventListener('emptied', onEmptied)
          resolve()
        }
        const onEmptied = () => { if (source !== audio.getAttribute('src')) done() }
        const timer = setTimeout(done, 15000)
        audio.addEventListener('loadedmetadata', done)
        audio.addEventListener('error', done)
        audio.addEventListener('emptied', onEmptied)
      })
    }
    if (attemptId !== playAttemptIdRef.current || source !== audio.getAttribute('src')) return false
    if (audio.error || audio.readyState < 1) {
      if (!recoveryRef.current.active) await recoverCurrentStream('initial', { force: true, fast: false, wasPlaying: true })
      return false
    }
    try {
      await audio.play()
      return true
    } catch (error) {
      if (attemptId !== playAttemptIdRef.current) return false
      const actuallyPlaying = Boolean(audio && !audio.paused && !audio.ended)
      if (actuallyPlaying) { setIsPlaying(true); return true }
      if (error?.name === 'AbortError') {
        await Promise.resolve()
        if (attemptId !== playAttemptIdRef.current || sleepPausedRef.current || source !== audio.getAttribute('src')) return false
        try { await audio.play(); if (attemptId !== playAttemptIdRef.current || sleepPausedRef.current) return false; setIsPlaying(true); return true } catch { /* bounded fresh-resolution recovery below */ }
        if (!recoveryRef.current.active) await recoverCurrentStream('initial', { force: true, fast: false, wasPlaying: true })
        return false
      }
      if (error?.name === 'NotAllowedError') {
        if (!hasInteractedRef.current) {
          setJoinPill({ time: getPlaybackTime(), roomName: activeRoomRef.current })
        }
        return false
      }
      setIsPlaying(false)
      return false
    }
  }

  function clearAdvanceCheck() {
    if (advanceCheckRef.current) {
      clearTimeout(advanceCheckRef.current)
      advanceCheckRef.current = null
    }
  }

  function waitForMediaReady(audio, timeout = RESUME_RELOAD_TIMEOUT) {
    return new Promise((resolve) => {
      let settled = false
      const finish = (ready) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        audio.removeEventListener('loadedmetadata', onReady)
        audio.removeEventListener('canplay', onReady)
        audio.removeEventListener('error', onError)
        resolve(ready)
      }
      const onReady = () => finish(true)
      const onError = () => finish(false)
      const timer = setTimeout(() => finish(false), timeout)
      audio.addEventListener('loadedmetadata', onReady, { once: true })
      audio.addEventListener('canplay', onReady, { once: true })
      audio.addEventListener('error', onError, { once: true })
    })
  }

  async function retryDirectUrl(audio, sourceUrl, resumeTime, attemptId) {
    if (!audio || !sourceUrl || attemptId !== playAttemptIdRef.current) return false
    resumeAttemptRef.current.directRetry = true
    try {
      const base = sourceUrl.split('#')[0]
      const retryUrl = `${base}#t=${Math.max(0, Number(resumeTime) || 0).toFixed(2)}`
      loadedUrlRef.current = retryUrl
      audio.pause()
      audio.src = retryUrl
      audio.load()
      const ready = await waitForMediaReady(audio)
      if (!ready || attemptId !== playAttemptIdRef.current) return false
      try {
        audio.currentTime = Math.max(0, Number(resumeTime) || 0)
      } catch {
        /* metadata may still settle */
      }
      const played = await safeAudioPlay(audio, attemptId)
      return played && !audio.paused
    } finally {
      resumeAttemptRef.current.directRetry = false
    }
  }

  function scheduleAdvanceCheck(audio, attemptId, startAt, resumeTime) {
    clearAdvanceCheck()
    if (!audio || !isPlayingRef.current) return
    advanceCheckRef.current = setTimeout(() => {
      advanceCheckRef.current = null
      if (attemptId !== playAttemptIdRef.current || !isPlayingRef.current) return
      const currentTime = Number(audio.currentTime) || 0
      if (!audio.paused && currentTime > startAt + 0.12) return
      recoverCurrentStream('resume', {
        resumeTime: Math.max(currentTime, Number(resumeTime) || 0, progressRef.current),
        wasPlaying: true,
        fast: true,
        force: true,
      })
    }, RESUME_ADVANCE_TIMEOUT)
  }

  function getPlaybackTime() {
    const audio = audioRef.current
    if (loadedUrlRef.current && audio) return audio.currentTime || 0
    const player = ytPlayerRef.current
    if (player?.getCurrentTime) return player.getCurrentTime() || 0
    return 0
  }

  function updatePlaybackProgress(value) {
    const safe = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
    progressRef.current = safe
    playbackProgressStore.set(safe)
  }

  function buildSoloPlayOrder(ids, currentId, shuffle = false) {
    const clean = [...new Set((ids || []).filter(Boolean))]
    if (!shuffle) return clean
    const hasCurrent = currentId && clean.includes(currentId)
    const rest = hasCurrent ? clean.filter((id) => id !== currentId) : clean
    const shuffled = seededShuffle(rest, shuffleSeedRef.current)
    return hasCurrent ? [currentId, ...shuffled] : shuffled
  }

  function commitSoloQueue(nextIds, options = {}) {
    const clean = [...new Set((nextIds || []).filter(Boolean))]
    const currentId = options.currentId || track?.id || ''
    let nextOrder = []
    if (shuffleEnabled) {
      if (Array.isArray(options.order)) {
        const known = options.order.filter((id) => clean.includes(id))
        nextOrder = [...known, ...clean.filter((id) => !known.includes(id))]
      } else if (options.shuffle) {
        nextOrder = buildSoloPlayOrder(clean, currentId, true)
      } else {
        const previous = soloPlayOrderRef.current.filter((id) => clean.includes(id))
        nextOrder = [...previous, ...clean.filter((id) => !previous.includes(id))]
      }
    }
    soloQueueRef.current = clean
    soloPlayOrderRef.current = shuffleEnabled ? nextOrder : clean
    setSoloQueue(clean)
    setSoloPlayOrder(shuffleEnabled ? nextOrder : [])
    return shuffleEnabled ? nextOrder : clean
  }

  function cycleRepeatMode() {
    if (inRoom) return
    const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'
    setSettings((previous) => ({ ...previous, repeatMode: nextMode }))
    showToast(nextMode === 'off' ? 'Repeat off' : nextMode === 'all' ? 'Repeat queue' : 'Repeat current track')
  }

  function toggleShuffleMode() {
    if (inRoom) return
    if (!soloQueue.length) {
      showToast('Add a song before enabling shuffle.')
      return
    }
    const nextEnabled = !shuffleEnabled
    const currentId = track?.id
    shuffleSeedRef.current += 1
    if (nextEnabled) {
      const order = buildSoloPlayOrder(soloQueue, currentId, true)
      setSoloPlayOrder(order)
      setSettings((previous) => ({ ...previous, shuffleEnabled: true }))
      setCurrentByRoom((previous) => ({
        ...previous,
        [SOLO_ROOM_ID]: Math.max(0, order.indexOf(currentId)),
      }))
      showToast('Shuffle on')
    } else {
      setSoloPlayOrder([])
      setSettings((previous) => ({ ...previous, shuffleEnabled: false }))
      setCurrentByRoom((previous) => ({
        ...previous,
        [SOLO_ROOM_ID]: Math.max(0, soloQueue.indexOf(currentId)),
      }))
      showToast('Shuffle off — natural queue restored')
    }
  }

  function shuffleSoloQueue() {
    if (!soloQueue.length) {
      showToast('Add a song before shuffling the queue.')
      return
    }
    const currentId = track?.id
    shuffleSeedRef.current += 1
    const order = buildSoloPlayOrder(soloQueue, currentId, true)
    setSoloPlayOrder(order)
    if (!shuffleEnabled) setSettings((previous) => ({ ...previous, shuffleEnabled: true }))
    setCurrentByRoom((previous) => ({
      ...previous,
      [SOLO_ROOM_ID]: Math.max(0, order.indexOf(currentId)),
    }))
    showToast('Queue shuffled')
  }

  function reorderSoloQueue(index, direction) {
    if (inRoom) return
    const activeIds = shuffleEnabled ? soloPlaybackIds : soloQueue
    const target = index + direction
    if (index < 0 || index >= activeIds.length || target < 0 || target >= activeIds.length) return
    const nextActive = [...activeIds]
    const [moved] = nextActive.splice(index, 1)
    nextActive.splice(target, 0, moved)
    if (shuffleEnabled) {
      setSoloPlayOrder(nextActive)
      soloPlayOrderRef.current = nextActive
    } else {
      setSoloQueue(nextActive)
      soloQueueRef.current = nextActive
    }
  }

  function removeSoloQueueTrack(index) {
    if (inRoom) return
    const activeIds = shuffleEnabled ? soloPlaybackIds : soloQueue
    if (index < 0 || index >= activeIds.length) return
    const removingCurrent = activeIds[index] === track?.id
    if (removingCurrent) return
    const id = activeIds[index]
    const nextNatural = soloQueue.filter((item) => item !== id)
    const nextOrder = shuffleEnabled
      ? soloPlayOrderRef.current.filter((item) => item !== id)
      : nextNatural
    commitSoloQueue(nextNatural, { order: shuffleEnabled ? nextOrder : undefined, currentId: track?.id })
    if (index < currentIndex) {
      setCurrentByRoom((previous) => ({
        ...previous,
        [SOLO_ROOM_ID]: Math.max(0, (previous[SOLO_ROOM_ID] ?? currentIndex) - 1),
      }))
    }
  }

  function clearSoloQueue() {
    radioActive.current = false
    if (inRoom) return
    playAttemptIdRef.current += 1
    clearAdvanceCheck()
    audioRef.current?.pause()
    setIsPlaying(false)
    setBuffering(false)
    commitSoloQueue([])
    setCurrentByRoom((previous) => ({ ...previous, [SOLO_ROOM_ID]: 0 }))
    updatePlaybackProgress(0)
    setDuration(0)
    showToast('Queue cleared')
  }

  function toggleQueuePanel() {
    setQueueOpen((previous) => {
      const next = !previous
      if (next) {
        setChatOpen(false)
        setFullPlayer(false)
        if (loungeOpen) closeLounge()
      }
      return next
    })
  }

  function captureSoloSnapshot() {
    if (activeRoomRef.current) return
    const index = currentByRoom[SOLO_ROOM_ID] ?? 0
    soloSnapshotRef.current = {
      track: track?.id && track.id !== 'empty' ? track.id : null,
      currentTime: getPlaybackTime(),
      isPlaying: false,
      queue: [...soloQueue],
      index,
    }
    soloResumeRef.current = null
  }

  function leaveRoomPlayback() {
    if (!activeRoomRef.current) return
    const snapshot = soloSnapshotRef.current
    soloResumeRef.current = snapshot?.track
      ? { track: snapshot.track, time: snapshot.currentTime || 0, queue: snapshot.queue || [], index: snapshot.index || 0 }
      : null
    stopMic()
    audioRef.current?.pause()
    setIsPlaying(false)
    setActiveRoomId(null)
    activeRoomRef.current = null
    setJoinPill(null)
    updatePlaybackProgress(0)
    setDuration(0)
    pendingSeekRef.current = null
    searchRoomRef.current = null
    searchTargetRef.current = { mode: 'solo', roomId: null }
    setRoomClock({ roomId: null, index: 0, trackId: null, time: 0, isPlaying: false })
  }

  function beginPlayback(key, ids, index, candidate) {
    const previousTrack = track
    const elapsed = Number(progressRef.current) || 0
    const sameTrack = Boolean(candidate?.id && previousTrack?.id === candidate.id)
    if (key === SOLO_ROOM_ID && previousTrack?.id && previousTrack.id !== 'empty' && candidate?.id) {
      if (sameTrack && elapsed > 0.5) recordTasteSignal('replay', { track: previousTrack })
      else if (!sameTrack && elapsed > 0.5 && elapsed < 15) recordTasteSignal('skip', { track: previousTrack })
    }
    sleepPausedRef.current = false
    isPlayingRef.current = key === SOLO_ROOM_ID || (viewRef.current === 'room' && activeRoomRef.current === key)
    playAttemptIdRef.current += 1
    clearAdvanceCheck()
    progressRef.current = 0
    playbackProgressStore.set(0)
    setCurrentByRoom((previous) => ({ ...previous, [key]: index }))
    updatePlaybackProgress(0)
    setDuration(guestPreviewRef.current ? previewSeconds(candidate) : (candidate?.duration || 0))
    pendingSeekRef.current = null
    // Re-selecting the active Quick Pick must restart even when React batches
    // the pause/play state updates and the source URL stays identical.
    if (candidate?.id === track?.id || (candidate?.streamUrl && candidate.streamUrl === track?.streamUrl)) {
      pendingSeekRef.current = 0
      setSeekSignal(value => value + 1)
      setRecoverySignal(value => value + 1)
    }
    resumeAttemptRef.current = { id: 0, trackId: candidate?.id || '', resumeTime: 0, validate: false, directRetry: false }
    setJoinPill(null)
    if (key !== SOLO_ROOM_ID) {
      radioActive.current = false
      setRoomClock({
        roomId: key,
        index,
        trackId: candidate?.id || ids[index] || null,
        time: 0,
        isPlaying: true,
      })
      if (viewRef.current !== 'room' || activeRoomRef.current !== key) {
        setIsPlaying(false)
      } else {
        setIsPlaying(true)
      }
      announce({ index, time: 0, isPlaying: true })
    } else {
      setIsPlaying(true)
    }
    if (candidate?.id) {
      addRecent(candidate.id)
      recordTasteSignal('play', { track: candidate })
    }

  }

  // Publish a track to the library before its stream resolves so artwork,
  // title and the loading ring appear on the very next frame. When no
  // full-length URL is known, a provider preview starts audibly in the same
  // tick while the full stream resolves in the background.
  function stageTrack(candidate, options = {}) {
    if (!candidate?.id) return null
    const usePreview = options.usePreview === true
    const fullDirect = Boolean(candidate.streamUrl) && isFullLengthTrack(candidate) && !isPreviewTrack(candidate)
    // A YouTube audio download proxied through our media route is megabytes of
    // audio: useful for members, far too slow for a 30 second guest preview.
    const heavyYouTubeStream = /googlevideo\.com/i.test(String(candidate.streamUrl || ''))
    const previewUrl = usePreview
      ? (candidate.previewUrl || (candidate.streamUrl && isPreviewTrack(candidate) ? candidate.streamUrl : null) || (heavyYouTubeStream ? null : candidate.streamUrl) || null)
      : (candidate.previewUrl || (candidate.streamUrl && isPreviewTrack(candidate) ? candidate.streamUrl : null))
    const playbackUrl = fullDirect ? candidate.streamUrl : previewUrl
    const playingPreview = Boolean(playbackUrl) && !fullDirect
    const youtubeVideoId = playbackUrl ? undefined : candidate.youtubeVideoId
    const staged = sanitizeTrack({
      ...candidate,
      streamUrl: playbackUrl,
      youtubeVideoId,
      preview: usePreview ? Boolean(candidate.preview) : playingPreview,
      needsHydration: false,
      status: playbackUrl || youtubeVideoId ? 'ready' : 'resolving',
    })
    setLibrary((previous) => {
      const existing = previous[staged.id]
      const merged = sanitizeTrack({
        ...existing,
        ...staged,
        streamUrl: staged.streamUrl || existing?.streamUrl || null,
        youtubeVideoId: staged.youtubeVideoId || existing?.youtubeVideoId || undefined,
        cover: staged.cover || existing?.cover || null,
      })
      return {
        ...previous,
        [staged.id]: {
          ...merged,
          status: merged.streamUrl || merged.youtubeVideoId ? 'ready' : 'resolving',
        },
      }
    })
    return staged
  }

  // Warm the stream for a hovered or visible card so the click can attach
  // immediately. Guests get the preview resolved; members hydrate the full
  // stream in the background.
  function prefetchTrack(candidate) {
    if (!candidate?.id) return
    primeInstantPreview(candidate)
    if (!currentUser) return
    const existing = libraryRef.current?.[candidate.id]
    if (existing?.streamUrl || existing?.youtubeVideoId) return
    if (prefetchInFlightRef.current.has(candidate.id)) return
    prefetchInFlightRef.current.add(candidate.id)
    resolveFullTrack(candidate)
      .then((ready) => {
        if (!ready || (!ready.streamUrl && !ready.youtubeVideoId) || !isFullLengthTrack(ready)) return
        setLibrary((previous) => {
          const entry = previous[candidate.id]
          if (entry?.streamUrl || entry?.youtubeVideoId) return previous
          return {
            ...previous,
            [candidate.id]: sanitizeTrack({ ...entry, ...ready, id: candidate.id, preview: false, status: 'ready' }),
          }
        })
      })
      .catch(() => {})
      .finally(() => prefetchInFlightRef.current.delete(candidate.id))
  }

  // Resolve a full-length stream for a track that is already playing a
  // provider preview. Fire-and-forget so the first audible frame is never
  // blocked by a network round trip.
  function upgradeToFullStream(candidate) {
    const id = candidate?.id
    if (!id || upgradeInFlightRef.current.has(id)) return
    upgradeInFlightRef.current.add(id)
    ;(async () => {
      let resolved = null
      try {
        resolved = await withTimeout(
          resolveFullTrack({ ...candidate, streamUrl: null, preview: false }, { forceRefresh: true }),
          8000,
          'Full stream lookup timed out',
        )
      } catch {
        resolved = null
      }
      if (!resolved || (!resolved.streamUrl && !resolved.youtubeVideoId)) {
        try {
          resolved = await withTimeout(resolveByMetadata(candidate, { forceRefresh: true }), 9000, 'Fallback lookup timed out')
        } catch {
          resolved = null
        }
      }
      if (!resolved || (!resolved.streamUrl && !resolved.youtubeVideoId)) return
      const ready = sanitizeTrack({
        ...candidate,
        ...resolved,
        id,
        c1: candidate.c1 || resolved.c1,
        c2: candidate.c2 || resolved.c2,
        cover: candidate.cover || resolved.cover || null,
        preview: false,
        needsHydration: false,
        status: 'ready',
      })
      if (queueIdsRef.current[currentIndexRef.current] === id) {
        const audio = audioRef.current
        const resume = Math.max(0, Number(audio?.currentTime) || 0)
        if (ready.streamUrl && !ready.youtubeVideoId && resume > 1) {
          pendingSeekRef.current = resume
          setSeekSignal((value) => value + 1)
        }
      }
      setLibrary((previous) => {
        const entry = previous[id]
        if (entry?.streamUrl && !entry.preview && entry.streamUrl !== candidate.previewUrl) return previous
        return { ...previous, [id]: ready }
      })
      saveLibraryEntry(id, ready)
    })().finally(() => upgradeInFlightRef.current.delete(id))
  }

  async function ensurePlayable(rawCandidate, options = {}) {
    if (!rawCandidate) return null
    const forceRefresh = Boolean(options.forceRefresh)
    const fast = Boolean(options.fast)
    let candidate = sanitizeTrack(rawCandidate)
    if (!candidate.id) return null
    if (forceRefresh) {
      evictLibraryEntry(candidate.id)
      clearResolvedStream(candidate.id)
      if (candidate.youtubeVideoId) clearResolvedStream(`yt:${candidate.youtubeVideoId}`)
      if (candidate.providerId) clearResolvedStream(`jio:${candidate.providerId}`)
      candidate = sanitizeTrack({
        ...candidate,
        streamUrl: null,
        needsHydration: true,
        preview: false,
        status: 'resolving',
      })
    }
    const direct = Boolean(
      !forceRefresh &&
      ((candidate.streamUrl && isFullLengthTrack(candidate) && !isPreviewTrack(candidate)) || candidate.youtubeVideoId),
    )
    const staged = sanitizeTrack({
      ...candidate,
      preview: false,
      status: direct ? 'ready' : 'resolving',
    })
    setLibrary((previous) => {
      const existing = previous[candidate.id]
      return {
        ...previous,
        [candidate.id]: sanitizeTrack({
          ...existing,
          ...staged,
          streamUrl: staged.streamUrl || existing?.streamUrl || null,
          youtubeVideoId: staged.youtubeVideoId || existing?.youtubeVideoId || undefined,
          cover: staged.cover || existing?.cover || null,
          status: direct ? 'ready' : 'resolving',
        }),
      }
    })
    if (direct) {
      saveLibraryEntry(candidate.id, staged)
      return staged
    }

    // No full stream yet: play a provider preview immediately (Deezer MP3,
    // JioSaavn clip or a fast Apple preview) while the full stream hydrates.
    let previewUrl = candidate.previewUrl || (candidate.streamUrl && isPreviewTrack(candidate) ? candidate.streamUrl : null)
    if (!previewUrl && !forceRefresh) {
      try {
        previewUrl = await withTimeout(findInstantPreview(candidate), fast ? 900 : 1400, 'Preview lookup timed out')
      } catch {
        previewUrl = null
      }
    }
    if (previewUrl && !forceRefresh) {
      const previewTrack = sanitizeTrack({
        ...candidate,
        streamUrl: previewUrl,
        preview: true,
        needsHydration: false,
        status: 'ready',
      })
      setLibrary((previous) => ({
        ...previous,
        [candidate.id]: sanitizeTrack({
          ...previous[candidate.id],
          ...previewTrack,
          youtubeVideoId: undefined,
        }),
      }))
      upgradeToFullStream(candidate)
      return previewTrack
    }

    try {
      let resolved = null
      try {
        resolved = await withTimeout(
          resolveFullTrack(candidate, { forceRefresh }),
          fast ? 3200 : 6000,
          'Primary stream lookup timed out',
        )
      } catch {
        resolved = null
      }
      if (!resolved || (!resolved.streamUrl && !resolved.youtubeVideoId)) {
        resolved = await withTimeout(
          resolveByMetadata(candidate, { forceRefresh }),
          fast ? 2600 : 9000,
          'Fallback stream lookup timed out',
        )
      }
      if (!resolved || (!resolved.streamUrl && !resolved.youtubeVideoId)) {
        throw new Error('No playable source')
      }
      const ready = sanitizeTrack({
        ...candidate,
        ...resolved,
        id: candidate.id,
        c1: candidate.c1 || resolved.c1,
        c2: candidate.c2 || resolved.c2,
        cover: candidate.cover || resolved.cover || null,
        preview: false,
        needsHydration: false,
        status: 'ready',
      })
      setLibrary((previous) => ({ ...previous, [candidate.id]: ready }))
      saveLibraryEntry(candidate.id, ready)
      return ready
    } catch {
      setLibrary((previous) => ({
        ...previous,
        [candidate.id]: {
          ...(previous[candidate.id] || candidate),
          status: 'error',
          streamUrl: previous[candidate.id]?.streamUrl || null,
          preview: previous[candidate.id]?.preview === true,
        },
      }))
      return null
    } finally {
      setLibrary((previous) => {
        const entry = previous[candidate.id]
        if (!entry || entry.status !== 'resolving') return previous
        return { ...previous, [candidate.id]: { ...entry, status: 'error' } }
      })
    }
  }

  async function prepareGuestPreview(candidate) {
    const source = sanitizeTrack(candidate)
    if (!source.id) return null
    // A proxied YouTube audio download is a full-length stream, not a preview.
    const heavyYouTubeStream = /googlevideo\.com/i.test(String(source.streamUrl || ''))
    let previewUrl = source.previewUrl || (heavyYouTubeStream ? null : source.streamUrl) || null
    let resolved = null
    // Start the full-stream lookup immediately so a slow preview never adds to
    // the total wait; the first available source is the one that plays.
    const fullTask = (!source.streamUrl && !source.youtubeVideoId)
      ? withTimeout(resolveFullTrack({ ...source, preview: false }), 5200, 'Preview lookup timed out').catch(() => null)
      : Promise.resolve(null)
    if (!previewUrl) {
      // Prewarmed tracks resolve from memory instantly; a cold lookup still
      // gets a realistic budget on slow connections.
      try {
        previewUrl = await withTimeout(primeInstantPreview(source), 2600, 'Preview lookup timed out')
      } catch {
        previewUrl = null
      }
    }
    if (!previewUrl) {
      resolved = await fullTask
    }
    if (!previewUrl && !resolved?.streamUrl && !resolved?.youtubeVideoId) {
      try {
        resolved = await withTimeout(resolveByMetadata(source), 6000, 'Preview lookup timed out')
      } catch {
        resolved = null
      }
    }
    // A preview resolved in the background is a free, reliable fallback for
    // the primary stream: keep it attached so recovery never runs dry.
    if (!previewUrl) {
      try {
        previewUrl = await primeInstantPreview(source)
      } catch {
        previewUrl = null
      }
    }
    const streamUrl = previewUrl || resolved?.streamUrl || null
    const youtubeVideoId = resolved?.youtubeVideoId || (!streamUrl ? source.youtubeVideoId : '')
    if (!streamUrl && !youtubeVideoId) return null
    return sanitizeTrack({
      ...source,
      ...(resolved || {}),
      id: source.id,
      title: source.title,
      artist: source.artist,
      album: source.album,
      duration: source.duration || resolved?.duration || 0,
      cover: source.cover || resolved?.cover || null,
      previewUrl: source.previewUrl || previewUrl,
      streamUrl,
      youtubeVideoId: youtubeVideoId || undefined,
      preview: false,
      needsHydration: false,
      status: 'ready',
    })
  }

  async function startGuestPreview(candidate, contextTracks = null, options = {}) {
    if (!candidate?.id) return
    radioActive.current = options.radio === true
    // Synchronous stage: the dock, artwork and loading ring update in the same
    // tick as the click. Stream resolution continues in the background.
    guestPreviewRef.current = true
    previewGateRef.current = false
    setGuestPreview(true)
    setPreviewCard(false)
    const staged = stageTrack(candidate, { usePreview: true }) || candidate
    const context = Array.isArray(contextTracks) ? contextTracks.filter((item) => item?.id) : []
    rememberContextTracks(context, staged.id)
    const contextIds = context.map((item) => item.id)
    const naturalIds = contextIds.includes(staged.id)
      ? contextIds
      : soloQueue.includes(staged.id)
        ? soloQueue
        : [...soloQueue, staged.id]
    const playOrder = commitSoloQueue(naturalIds, {
      currentId: staged.id,
      shuffle: shuffleEnabled,
    })
    const index = Math.max(0, playOrder.indexOf(staged.id))
    const wasRoomView = viewRef.current === 'room'
    if (wasRoomView) suspendRoomPlayback()
    soloResumeRef.current = null
    if (wasRoomView) {
      setView('home')
      viewRef.current = 'home'
    }
    audioRef.current?.pause()
    setIsPlaying(false)
    beginPlayback(SOLO_ROOM_ID, playOrder, index, staged)
    const publish = (playable) => {
      if (!playable) return false
      setLibrary((previous) => ({
        ...previous,
        [playable.id]: sanitizeTrack({
          ...previous[playable.id],
          ...playable,
          title: previous[playable.id]?.title || playable.title,
          cover: previous[playable.id]?.cover || playable.cover,
        }),
      }))
      return true
    }
    const attempt = async (round) => {
      const playable = await prepareGuestPreview(candidate).catch(() => null)
      if (publish(playable)) return
      // A congested link can time out every provider at once. Retry silently
      // instead of leaving the listener with a paused player.
      if (round >= 2) return
      if (!guestPreviewRef.current) return
      setTimeout(() => {
        if (guestPreviewRef.current && isPlayingRef.current) attempt(round + 1)
      }, 1500 * (round + 1))
    }
    await attempt(0)
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
    if (!currentUser) {
      startGuestPreview(candidate, queue)
      return
    }
    const staged = stageTrack(candidate) || candidate
    startPlaybackAt(bounded, staged)
    ensurePlayable(candidate).then((playable) => {
      if (!playable) return
      setLibrary((previous) => ({ ...previous, [playable.id]: sanitizeTrack({ ...previous[playable.id], ...playable }) }))
    }).catch(() => {})
  }

  function startPlaybackAt(index, candidate) {
    const key = viewRef.current === 'room' && activeRoomRef.current ? activeRoomRef.current : SOLO_ROOM_ID
    const ids = key === SOLO_ROOM_ID
      ? (shuffleEnabled ? soloPlayOrderRef.current : soloQueueRef.current)
      : queueIdsRef.current
    beginPlayback(key, ids, index, candidate)
  }

  async function togglePlay() {
    if (!currentUser && guestPreviewRef.current && Number(progressRef.current) >= GUEST_PREVIEW_SECONDS - 0.1) {
      openPreviewGate()
      return
    }
    if (sleepPausedRef.current) {
      sleepPausedRef.current = false
      if (roomPlaybackActive) { pendingSeekRef.current = roomClockTime(); setSeekSignal(value => value + 1) }
      setIsPlaying(true)
      return
    }
    if (!canControl) {
      lockToast()
      return
    }
    if (!queueIds.length) {
      showToast('Add a song to start listening.')
      return
    }
    if (!currentUser) {
      if (track.id === 'empty') {
        await playIndex(0)
        return
      }
      if (!guestPreviewRef.current) {
        await startGuestPreview(track, queue)
        return
      }
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
    const audio = audioRef.current
    const time = roomPlaybackActive ? roomClockTime() : getPlaybackTime()
    if (next && !roomPlaybackActive) {
      const resumeTime = Math.max(0, Number(audio?.currentTime) || Number(progressRef.current) || time || 0)
      const pausedFor = lastPauseAtRef.current ? Date.now() - lastPauseAtRef.current : Number.POSITIVE_INFINITY
      const networkNoSource = Number(audio?.networkState) === 2
      resumeAttemptRef.current = {
        id: 0,
        trackId: track.id,
        resumeTime,
        validate: Boolean(
          track.streamUrl &&
          !youtubeActive &&
          (pausedFor > 45000 || Number(audio?.readyState) < 2 || audio?.error || networkNoSource)
        ),
        directRetry: false,
      }
      progressRef.current = resumeTime
      playbackProgressStore.set(resumeTime)
    } else if (!next) {
      playAttemptIdRef.current += 1
      clearAdvanceCheck()
    }
    setIsPlaying(next)
    if (next) setJoinPill(null)
    if (roomPlaybackActive) {
      setRoomClock({ time, isPlaying: next })
      announce({ isPlaying: next, time })
    }
  }

  async function nextTrack() {
    if (!canControl) {
      lockToast()
      return
    }
    if (!queueIds.length) return
    await playIndex((currentIndex + 1) % queueIds.length)
  }

  async function previousTrack() {
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
    if (!currentUser && guestPreviewRef.current && Number(seconds) > GUEST_PREVIEW_SECONDS) {
      try {
        if (track.streamUrl) audioRef.current.currentTime = GUEST_PREVIEW_SECONDS
        else ytPlayerRef.current?.seekTo?.(GUEST_PREVIEW_SECONDS, true)
      } catch {
        /* ignore */
      }
      updatePlaybackProgress(GUEST_PREVIEW_SECONDS)
      setIsPlaying(false)
      audioRef.current?.pause()
      ytPlayerRef.current?.pauseVideo?.()
      openPreviewGate()
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
    updatePlaybackProgress(target)
    setJoinPill(null)
    if (roomPlaybackActive) {
      setRoomClock({ time: target })
      announce({ time: target })
    }
  }

  function handleVolume(value) {
    setVolume(value)
    setMuted(value === 0)
  }

  function handleEnded() {
    if (sleepPausedRef.current) return
    if (onSleepTrackEnded()) return
    if (!currentUser && guestPreviewRef.current) {
      setIsPlaying(false)
      isPlayingRef.current = false
      audioRef.current?.pause()
      updatePlaybackProgress(GUEST_PREVIEW_SECONDS)
      openPreviewGate()
      return
    }
    if (roomPlaybackActive) {
      if (!canControlRoom) {
        setIsPlaying(false)
        return
      }
      advanceRoomClock()
      return
    }
    if (inRoom && !canControl) {
      setIsPlaying(false)
      return
    }
    if (track?.id && track.id !== 'empty') recordTasteSignal('complete', { track })
    if (!queueIds.length) {
      setIsPlaying(false)
      updatePlaybackProgress(0)
      return
    }
    if (repeatMode === 'one') {
      const audio = audioRef.current
      const player = ytPlayerRef.current
      setBuffering(false)
      if (track.streamUrl && audio) {
        try {
          audio.currentTime = 0
        } catch {
          /* ignore unseekable stream */
        }
        updatePlaybackProgress(0)
        safeAudioPlay(audio, ++playAttemptIdRef.current)
      } else if (player?.seekTo) {
        player.seekTo(0, true)
        if (player.playVideo) safeYouTubePlay(player)
        updatePlaybackProgress(0)
      }
      setIsPlaying(true)
      return
    }
    const nextIndex = currentIndex + 1
    if (nextIndex >= queueIds.length) {
      if (repeatMode !== 'all' && !radioActive.current) {
        if (autoplay && typeof actions.autoplayTracks === 'function') {
          Promise.resolve(actions.autoplayTracks(track))
            .then((tracks) => {
              const list = Array.isArray(tracks) ? tracks.filter((item) => item?.id) : []
              if (!list.length) {
                setIsPlaying(false)
                const endedAt = Math.max(Number(duration) || 0, Number(getPlaybackTime()) || 0)
                updatePlaybackProgress(endedAt)
                return
              }
              const next = list.find((item) => item.id !== track?.id) || list[0]
              radioActive.current = true
              playSoloTrack(next, list, { radio: true })
            })
            .catch(() => setIsPlaying(false))
          return
        }
        setIsPlaying(false)
        const endedAt = Math.max(Number(duration) || 0, Number(getPlaybackTime()) || 0)
        updatePlaybackProgress(endedAt)
        return
      }
      const candidate = queue[0] || library[queueIds[0]] || SEED_BY_ID[queueIds[0]]
      if (!candidate) {
        setIsPlaying(false)
        return
      }
      ensurePlayable(candidate).then((playable) => {
        if (playable) startPlaybackAt(0, playable)
        else setIsPlaying(false)
      })
      return
    }
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

  function maybePreloadNext(audio) {
    if (!audio || !queueIds.length || repeatMode === 'one') return
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration
    if (!total || audio.currentTime / total < 0.55) return
    let nextIndex = currentIndex + 1
    if (nextIndex >= queueIds.length) {
      if (repeatMode !== 'all' && !radioActive.current) return
      nextIndex = 0
    }
    const candidate = queue[nextIndex] || library[queueIds[nextIndex]]
    if (candidate) preloadCandidateAt([candidate], 0, ensurePlayable)
  }

  function maybeCrossfade(audio) {
    if (sleepTimer.endOfTrack) return
    if (!settings.crossfade || inRoom || crossfadeLockRef.current || !audio || !queueIds.length) return
    if (repeatMode === 'one') return
    if (currentIndex + 1 >= queueIds.length && repeatMode !== 'all' && !radioActive.current) return
    const seconds = Math.max(0, Number(settings.crossfadeSeconds) || 0)
    if (seconds < 1) return
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration
    if (!total) return
    const remaining = total - audio.currentTime
    if (remaining <= 0 || remaining > seconds) return

    crossfadeLockRef.current = true
    const player = ytPlayerRef.current
    const startLevel = youtubeActive && player?.getVolume
      ? player.getVolume() / 100
      : audio.volume
    const startedAt = performance.now()
    const fadeMs = Math.max(250, Math.min(remaining * 1000, seconds * 1000))

    const applyLevel = (level) => {
      const safe = Math.max(0, Math.min(1, level))
      audio.volume = safe
      if (player?.setVolume) player.setVolume(Math.round(safe * 100))
    }

    const tick = (now) => {
      const ratio = Math.min(1, (now - startedAt) / fadeMs)
      applyLevel(startLevel * (1 - ratio))
      if (ratio < 1) {
        fadeFrameRef.current = requestAnimationFrame(tick)
        return
      }
      fadeFrameRef.current = null
      audio.pause()
      setCrossfadeGain(0)
      crossfadeGainRef.current = 0
      Promise.resolve(nextTrack()).finally(() => {
        setTimeout(() => {
          setCrossfadeGain(1)
          crossfadeGainRef.current = 1
          crossfadeLockRef.current = false
        }, 120)
      })
    }
    if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current)
    fadeFrameRef.current = requestAnimationFrame(tick)
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
    const audio = audioRef.current
    // A slow link buffers for seconds before the first frame. Give the initial
    // load a generous grace period and only swap sources when a stream that
    // was already playing stops making progress.
    const started = Number(audio?.currentTime) > 0.35
    const grace = started ? 5000 : 12000
    const mark = Number(audio?.currentTime) || 0
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null
      const element = audioRef.current
      if (!element || element.paused) return
      const advanced = (Number(element.currentTime) || 0) > mark + 0.05
      if (!element.error && advanced) {
        handleAudioBuffering()
        return
      }
      recoverCurrentStream('stalled', { fast: true, force: true })
    }, grace)
  }

  function handleAudioReady() {
    const audio = audioRef.current
    if (Number(audio?.duration) >= 60 && !audio.error) {
      preloadQueueWindow({ queue, currentIndex, repeatMode: radioActive.current ? 'all' : repeatMode, resolve: ensurePlayable })
    }
    clearStallTimer()
    setBuffering(false)
    setStreamRecovering(false)
    recoveryRef.current.active = false
  }

  // Silent, local fallback ladder: alternate Saavn bitrate, the same-origin
  // media proxy (only for hosts the proxy may fetch), then the provider
  // preview. No lookup, no toast, no dead air.
  function streamAlternatives(current) {
    return omniStreamChain(current)
  }

  async function trySwapStream(audio, url, resumeTime, attemptId) {
    if (!audio || !url || attemptId !== playAttemptIdRef.current) return false
    try {
      audio.pause()
      loadedUrlRef.current = url
      audio.src = url
      audio.load()
      const ready = await waitForMediaReady(audio, 2500)
      if (!ready || attemptId !== playAttemptIdRef.current) return false
      try {
        audio.currentTime = Math.max(0, Number(resumeTime) || 0)
      } catch {
        /* previews may start at zero */
      }
      const played = await safeAudioPlay(audio, attemptId)
      return Boolean(played && !audio.paused)
    } catch {
      return false
    }
  }

  async function recoverCurrentStream(reason = 'error', options = {}) {
    const current = library[track?.id] || track
    if (!current?.id || current.id === 'empty') return false
    if (!current.streamUrl && !current.youtubeVideoId && !current.previewUrl) return false
    if (recoveryRef.current.active) return false
    if (reason === 'initial' && recoveryRef.current.id === current.id && Date.now() - recoveryRef.current.at < 10000) return false
    if (!options.force && recoveryRef.current.id === current.id && Date.now() - recoveryRef.current.at < 10000) return false
    const resumeTime = Math.max(0, Number(options.resumeTime) || getPlaybackTime() || progressRef.current || 0)
    const wasPlaying = options.wasPlaying === undefined ? isPlayingRef.current : Boolean(options.wasPlaying)
    recoveryRef.current = { id: current.id, at: Date.now(), active: true }
    clearStallTimer()
    clearAdvanceCheck()
    setBuffering(true)
    setStreamRecovering(true)
    if (!wasPlaying) setIsPlaying(false)

    // First choice: an alternate stream that is already known.
    if (wasPlaying) {
      const audio = audioRef.current
      const attemptId = ++playAttemptIdRef.current
      for (const nextUrl of streamAlternatives(current)) {
        const played = await trySwapStream(audio, nextUrl, resumeTime, attemptId)
        if (!played || queueIdsRef.current[currentIndexRef.current] !== current.id) continue
        const isPreview = nextUrl === current.previewUrl
        const next = sanitizeTrack({
          ...current,
          streamUrl: nextUrl,
          youtubeVideoId: undefined,
          preview: isPreview,
          needsHydration: false,
          status: 'ready',
        })
        setLibrary((previous) => ({ ...previous, [current.id]: next }))
        if (!isPreview) saveLibraryEntry(current.id, next)
        pendingSeekRef.current = resumeTime
        playbackProgressStore.set(resumeTime)
        updatePlaybackProgress(resumeTime)
        if (isPreview) upgradeToFullStream(current)
        recoveryRef.current.active = false
        setStreamRecovering(false)
        setBuffering(false)
        return true
      }
    }

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
    try {
      const resolved = await ensurePlayable({
        ...current,
        streamUrl: null,
        previewUrl: null,
        youtubeVideoId: null,
        preview: false,
        needsHydration: true,
        status: 'pending',
      }, { forceRefresh: true, fast: options.fast !== false })
      if (sleepPausedRef.current || queueIdsRef.current[currentIndexRef.current] !== current.id) return false
      if (!resolved?.streamUrl && !resolved?.youtubeVideoId) {
        setIsPlaying(false)
        setBuffering(false)
        setStreamRecovering(false)
        return false
      }
      pendingSeekRef.current = resumeTime
      playbackProgressStore.set(resumeTime)
      updatePlaybackProgress(resumeTime)
      setSeekSignal((value) => value + 1)
      setDuration(resolved.duration || current.duration || 0)
      if (wasPlaying) {
        setIsPlaying(true)
        setRecoverySignal((value) => value + 1)
      }
      return true
    } catch {
      setIsPlaying(false)
      setBuffering(false)
      setStreamRecovering(false)
      return false
    } finally {
      recoveryRef.current.active = false
      recoveryRef.current.at = Date.now()
    }
  }

  function handleAudioError() {
    setBuffering(false)
    if (resumeAttemptRef.current.directRetry) return
    if (!loadedUrlRef.current) return
    const current = library[track?.id] || track
    if (current?.youtubeVideoId) {
      const resumeTime = Math.max(0, getPlaybackTime() || 0)
      loadedUrlRef.current = ''
      pendingSeekRef.current = resumeTime
      audioRef.current?.pause()
      clearResolvedStream(current.id)
      clearResolvedStream(`yt:${current.youtubeVideoId}`)
      const fallback = {
        ...current,
        streamUrl: null,
        status: 'ready',
        preview: false,
        needsHydration: false,
      }
      setLibrary((previous) => ({ ...previous, [current.id]: fallback }))
      saveLibraryEntry(current.id, fallback)
      setStreamRecovering(true)
      setIsPlaying(true)
      return
    }
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

  function commitRoomQueue(room, nextIds) {
    const nextRoom = { ...room, trackIds: [...new Set(nextIds.filter(Boolean))] }
    roomQueueRef.current = nextRoom.trackIds
    roomsRef.current = roomsRef.current.map((candidate) => (candidate.id === nextRoom.id ? nextRoom : candidate))
    setRooms((previous) => previous.map((candidate) => (candidate.id === nextRoom.id ? nextRoom : candidate)))
    broadcastRoom(nextRoom)
    return nextRoom
  }

  function placeRoomAt(roomId, ids, index, time, isPlaying) {
    setRoomClock({
      roomId,
      index,
      trackId: ids[index] || null,
      time,
      isPlaying: Boolean(isPlaying && ids.length),
    })
    setCurrentByRoom((previous) => ({ ...previous, [roomId]: index }))
  }

  function startRoomQueueAt(roomId, ids, index) {
    const candidate = libraryRef.current[ids[index]] || SEED_BY_ID[ids[index]]
    if (!candidate) return
    ensurePlayable(candidate).then((playable) => {
      if (!playable || activeRoomRef.current !== roomId || roomQueueRef.current[index] !== candidate.id) return
      beginPlayback(roomId, ids, index, playable)
    })
  }

  function addTrackToRoomQueue(room, trackId) {
    const ids = (room.trackIds || []).includes(trackId) ? room.trackIds : [...(room.trackIds || []), trackId]
    if (ids.length !== (room.trackIds || []).length) commitRoomQueue(room, ids)
    return { room: { ...room, trackIds: ids }, ids, index: ids.indexOf(trackId) }
  }

  function removeRoomQueueTrack(index) {
    const room = activeRoom
    if (!room) return
    if (!canControlRoom) {
      lockToast()
      return
    }
    if (viewRef.current === 'room') syncRoomClockFromPlayback()
    const ids = [...room.trackIds]
    const bounded = Math.max(0, Math.min(Number(index) || 0, ids.length - 1))
    if (bounded < 0 || bounded >= ids.length) return
    const clock = roomClockRef.current
    const current = Math.max(0, Math.min(Number(clock.index) || 0, ids.length - 1))
    const removingCurrent = bounded === current
    const wasPlaying = Boolean(clock.isPlaying)
    const nextIds = ids.filter((_, itemIndex) => itemIndex !== bounded)
    let nextIndex = current
    if (bounded < current) nextIndex = current - 1
    else if (removingCurrent) nextIndex = Math.min(current, Math.max(0, nextIds.length - 1))
    const nextTime = removingCurrent ? 0 : roomClockTime(clock)
    commitRoomQueue(room, nextIds)
    if (removingCurrent) {
      audioRef.current?.pause()
      if (viewRef.current === 'room') {
        updatePlaybackProgress(0)
        setDuration(Number((libraryRef.current[nextIds[nextIndex]] || SEED_BY_ID[nextIds[nextIndex]])?.duration) || 0)
      }
    }
    placeRoomAt(room.id, nextIds, nextIndex, nextTime, wasPlaying)
    if (removingCurrent && nextIds.length && wasPlaying) startRoomQueueAt(room.id, nextIds, nextIndex)
    announce({ index: nextIndex, time: nextTime, isPlaying: Boolean(nextIds.length && wasPlaying) })
    if (!nextIds.length) {
      setIsPlaying(false)
      if (viewRef.current === 'room') {
        updatePlaybackProgress(0)
        setDuration(0)
      }
      showToast('Room queue cleared')
    }
  }

  function clearRoomQueue() {
    const room = activeRoom
    if (!room) return
    if (!canControlRoom) {
      lockToast()
      return
    }
    commitRoomQueue(room, [])
    audioRef.current?.pause()
    setIsPlaying(false)
    updatePlaybackProgress(0)
    setDuration(0)
    placeRoomAt(room.id, [], 0, 0, false)
    announce({ index: 0, time: 0, isPlaying: false })
    showToast('Room queue cleared')
  }

  function importPlaylistToRoom(playlist) {
    const room = activeRoom
    if (!room) {
      showToast('Join a room before adding a playlist.', 'lock')
      return
    }
    if (!canControlRoom) {
      lockToast()
      return
    }
    const incoming = (playlist?.trackIds || []).filter((id) => libraryRef.current[id] || SEED_BY_ID[id])
    const base = room.trackIds || []
    const additions = incoming.filter((id) => !base.includes(id))
    if (!additions.length) {
      showToast(`No new tracks to add to ${room.name}`)
      return
    }
    const nextIds = [...base, ...additions]
    const idle = !roomClockRef.current.isPlaying || !base.length
    const startIndex = base.length
    commitRoomQueue(room, nextIds)
    if (idle) {
      audioRef.current?.pause()
      const item = libraryRef.current[nextIds[startIndex]] || SEED_BY_ID[nextIds[startIndex]]
      placeRoomAt(room.id, nextIds, startIndex, 0, true)
      if (viewRef.current === 'room') {
        updatePlaybackProgress(0)
        setDuration(Number(item?.duration) || 0)
        setIsPlaying(false)
      }
      startRoomQueueAt(room.id, nextIds, startIndex)
      announce({ index: startIndex, time: 0, isPlaying: true })
    } else {
      announce({ heartbeat: true })
    }
    showToast(`Added ${additions.length} track${additions.length === 1 ? '' : 's'} to ${room.name}`)
  }

  function searchRoomTarget() {
    const target = searchTargetRef.current
    if (target.mode !== 'room' || !target.roomId) return null
    return roomsRef.current.find((room) => room.id === target.roomId) || null
  }

  async function playSearchTrack(candidate, contextTracks = null) {
    if (!candidate) return
    radioActive.current = false
    const targetRoom = searchRoomTarget()
    const requestId = playRequestRef.current.seq + 1
    if (targetRoom) {
      const targetRole = targetRoom.roles?.[currentUserId]
      if (targetRole !== 'admin' && targetRole !== 'dj') {
        lockToast()
        return
      }
    } else if (!currentUser) {
      startGuestPreview(candidate, contextTracks)
      return
    }
    if (playRequestRef.current.id === candidate.id) return
    playRequestRef.current = { seq: requestId, id: candidate.id }
    setPendingPlayId(candidate.id)
    if (!targetRoom) {
      const context = Array.isArray(contextTracks) ? contextTracks.filter((item) => item?.id) : []
      rememberContextTracks(context, candidate.id)
      const staged = stageTrack(candidate) || candidate
      const contextIds = context.map((item) => item.id)
      const naturalIds = contextIds.includes(staged.id)
        ? contextIds
        : soloQueue.includes(staged.id)
          ? soloQueue
          : [...soloQueue, staged.id]
      const playOrder = commitSoloQueue(naturalIds, {
        currentId: staged.id,
        shuffle: shuffleEnabled,
      })
      const index = Math.max(0, playOrder.indexOf(staged.id))
      const nextView = viewRef.current === 'rooms' ? 'home' : viewRef.current
      viewRef.current = nextView
      setView(nextView)
      beginPlayback(SOLO_ROOM_ID, playOrder, index, staged)
      showToast(`Playing "${staged.title}"`)
    }
    try {
      const playable = await ensurePlayable(candidate)
      if (requestId !== playRequestRef.current.seq) return
      if (!playable) return
      if (targetRoom) {
        const room = roomsRef.current.find((item) => item.id === targetRoom.id)
        if (!room || room.id !== activeRoomRef.current) return
        const { ids, index } = addTrackToRoomQueue(room, playable.id)
        beginPlayback(room.id, ids, index, playable)
        if (viewRef.current !== 'room') {
          viewRef.current = 'room'
          setView('room')
        }
        showToast(`Playing "${playable.title}"`)
      } else {
        setLibrary((previous) => ({ ...previous, [playable.id]: sanitizeTrack({ ...previous[playable.id], ...playable }) }))
      }
    } finally {
      if (requestId === playRequestRef.current.seq) {
        playRequestRef.current = { seq: requestId, id: '' }
        setPendingPlayId('')
      }
    }
  }

  function queueSearchTrack(candidate) {
    if (!candidate) return
    const targetRoom = searchRoomTarget()
    if (targetRoom) {
      const targetRole = targetRoom.roles?.[currentUserId]
      if (targetRole !== 'admin' && targetRole !== 'dj' && targetRole !== 'listener') {
        lockToast()
        return
      }
    } else if (requireAuth(
      { type: 'queueSolo', track: candidate },
      'Log in to build your queue.',
    )) return
    const targetRoomId = targetRoom?.id || null
    ensurePlayable(candidate).then((ready) => {
      if (!ready) return
      if (targetRoomId) {
        const room = roomsRef.current.find((item) => item.id === targetRoomId)
        if (!room || room.id !== activeRoomRef.current) return
        addTrackToRoomQueue(room, ready.id)
        showToast(`Added "${ready.title}" to ${room.name}`)
      } else {
        if (!soloQueueRef.current.includes(ready.id)) {
          commitSoloQueue([...soloQueueRef.current, ready.id], { currentId: track?.id })
        }
        showToast(`Added "${ready.title}" to your queue`)
      }
    })
  }

  async function playSoloQueue(ids, startIndex = 0) {
    radioActive.current = false
    const clean = ids.filter(Boolean)
    if (!clean.length) return
    const index = Math.max(0, Math.min(startIndex, clean.length - 1))
    const candidate = library[clean[index]] || SEED_BY_ID[clean[index]]
    if (!candidate) return
    if (!currentUser) {
      startGuestPreview(candidate, clean.map((id) => library[id] || SEED_BY_ID[id]).filter(Boolean))
      return
    }
    const wasRoomView = viewRef.current === 'room'
    if (wasRoomView) suspendRoomPlayback()
    soloResumeRef.current = null
    if (wasRoomView) {
      setView('home')
      viewRef.current = 'home'
    }
    audioRef.current?.pause()
    setIsPlaying(false)
    const staged = stageTrack(candidate) || candidate
    const playOrder = commitSoloQueue(clean, {
      currentId: staged.id,
      shuffle: shuffleEnabled,
    })
    const playIndex = Math.max(0, playOrder.indexOf(staged.id))
    beginPlayback(SOLO_ROOM_ID, playOrder, playIndex, staged)
    ensurePlayable(candidate).then((playable) => {
      if (!playable) return
      setLibrary((previous) => ({ ...previous, [playable.id]: sanitizeTrack({ ...previous[playable.id], ...playable }) }))
    }).catch(() => {})
  }

  function startTasteRadio(candidate, tracks) {
    return playSoloTrack(candidate, tracks, { radio: true })
  }

  async function playSoloTrack(candidate, contextTracks = null, options = {}) {
    if (!candidate?.id) return
    if (!currentUser) {
      startGuestPreview(candidate, contextTracks, options)
      return
    }
    radioActive.current = options.radio === true
    setPreviewCard(false)
    const context = Array.isArray(contextTracks) ? contextTracks.filter((item) => item?.id) : []
    rememberContextTracks(context, candidate.id)
    const staged = stageTrack(candidate) || candidate
    const contextIds = context.map((item) => item.id)
    const naturalIds = contextIds.includes(staged.id)
      ? contextIds
      : soloQueue.includes(staged.id)
        ? soloQueue
        : [...soloQueue, staged.id]
    const playOrder = commitSoloQueue(naturalIds, {
      currentId: staged.id,
      shuffle: shuffleEnabled,
    })
    const index = Math.max(0, playOrder.indexOf(staged.id))
    const wasRoomView = viewRef.current === 'room'
    if (wasRoomView) suspendRoomPlayback()
    soloResumeRef.current = null
    if (wasRoomView) {
      setView('home')
      viewRef.current = 'home'
    }
    audioRef.current?.pause()
    setIsPlaying(false)
    beginPlayback(SOLO_ROOM_ID, playOrder, index, staged)
    ensurePlayable(candidate).then((playable) => {
      if (!playable) return
      setLibrary((previous) => ({ ...previous, [playable.id]: sanitizeTrack({ ...previous[playable.id], ...playable }) }))
    }).catch(() => {})
  }

  function queueSoloTrack(candidate) {
    if (!candidate?.id) return
    if (requireAuth({ type: 'queueSolo', track: candidate }, 'Log in to build your queue.')) return
    rememberTrack(candidate)
    if (!soloQueueRef.current.includes(candidate.id)) {
      commitSoloQueue([...soloQueueRef.current, candidate.id], { currentId: track?.id })
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
      if (!resolved?.streamUrl && !resolved?.youtubeVideoId) return
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
    } catch {
      /* the current preview keeps playing; the user can retry silently */
    }
  }

  function handleTimeUpdate(event) {
            const audio = event.currentTarget
            const time = audio.currentTime || 0
            progressRef.current = time
            playbackProgressStore.set(time)
            if (!currentUser && guestPreviewRef.current && time >= GUEST_PREVIEW_SECONDS - 0.05) {
              audio.pause()
              setIsPlaying(false)
              isPlayingRef.current = false
              progressRef.current = GUEST_PREVIEW_SECONDS
              playbackProgressStore.set(GUEST_PREVIEW_SECONDS)
              openPreviewGate()
              return
            }
            publishMediaSessionPosition(time, audio.duration)
            if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.buffered.length) {
              const end = audio.buffered.end(audio.buffered.length - 1)
              setLiveTelemetry({ bufferedPct: Math.min(100, Math.round((end / audio.duration) * 100)) })
            }
            maybePreloadNext(audio)
            maybeCrossfade(audio)
          }

  function handleLoadedMetadata(event) {
            const audio = event.currentTarget
            if (!currentUser && guestPreviewRef.current) {
              if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(Math.min(audio.duration, GUEST_PREVIEW_SECONDS))
              if (pendingSeekRef.current != null) {
                try {
                  audio.currentTime = Math.min(pendingSeekRef.current, GUEST_PREVIEW_SECONDS)
                } catch {
                  /* ignore */
                }
                pendingSeekRef.current = null
              }
              return
            }
            if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
            if (pendingSeekRef.current != null) {
              try {
                audio.currentTime = pendingSeekRef.current
              } catch {
                /* ignore unseekable previews */
              }
              pendingSeekRef.current = null
            }
          }

  useEffect(() => {
    if (previousShuffleRef.current === shuffleEnabled) return
    previousShuffleRef.current = shuffleEnabled
    if (roomPlaybackActive) return
    const currentId = track?.id
    if (!currentId || !soloQueue.length) return
    const ids = shuffleEnabled ? soloPlaybackIds : soloQueue
    setCurrentByRoom((previous) => ({
      ...previous,
      [SOLO_ROOM_ID]: Math.max(0, ids.indexOf(currentId)),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffleEnabled, soloQueue.length, roomPlaybackActive])

  useEffect(() => {
    if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current)
    fadeFrameRef.current = null
    crossfadeLockRef.current = false
    crossfadeGainRef.current = 1
    setCrossfadeGain(1)
  }, [track?.id])

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
    updatePlaybackProgress(0)
    setDuration(guestPreviewRef.current ? previewSeconds(track) : (track?.duration || 0))
  }, [track?.streamUrl, track?.duration])

  // A guest preview auto-upgrades the instant the account is created or the
  // listener signs in: same track, same position, now the full-length stream.
  useEffect(() => {
    if (!currentUser || !guestPreviewRef.current || previewUpgradeRef.current) return
    const current = track
    if (!current?.id || current.id === 'empty') {
      guestPreviewRef.current = false
      setGuestPreview(false)
      return
    }
    previewUpgradeRef.current = true
    const resumeTime = Math.max(0, Number(audioRef.current?.currentTime) || Number(progressRef.current) || 0)
    const wasPlaying = isPlayingRef.current
    ;(async () => {
      try {
        const playable = await ensurePlayable({
          ...current,
          streamUrl: null,
          youtubeVideoId: null,
          previewUrl: null,
          preview: false,
          needsHydration: true,
          status: 'pending',
        })
        if (!playable) return
        guestPreviewRef.current = false
        previewGateRef.current = false
        setGuestPreview(false)
        setLibrary((previous) => ({ ...previous, [playable.id]: playable }))
        pendingSeekRef.current = playable.duration
          ? Math.min(resumeTime, Math.max(0, playable.duration - 3))
          : resumeTime
        setSeekSignal((value) => value + 1)
        setDuration(playable.duration || 0)
        if (wasPlaying) {
          setIsPlaying(true)
          isPlayingRef.current = true
        }
      } finally {
        previewUpgradeRef.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

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
              instance.setVolume(Math.round((muted ? 0 : volume) * (settings.normalization ? 0.9 : 1) * crossfadeGain * 100))
              if (pendingSeekRef.current != null) instance.seekTo(pendingSeekRef.current, true)
              const total = instance.getDuration?.() || 0
              if (total > 0) setDuration(guestPreviewRef.current ? Math.min(total, GUEST_PREVIEW_SECONDS) : total)
              if (isPlayingRef.current) safeYouTubePlay(instance)
            },
            onStateChange: (event) => {
              if (cancelled) return
              if (event.data === 0) {
                handleEndedRef.current?.()
              } else if (event.data === 1) {
                const total = event.target.getDuration?.() || 0
                if (total > 0) setDuration(guestPreviewRef.current ? Math.min(total, GUEST_PREVIEW_SECONDS) : total)
                setBuffering(false)
                setStreamRecovering(false)
                setIsPlaying(true)
              }
            },
            onError: () => {
              if (cancelled) return
              if (isPlayingRef.current) recoverCurrentStream('video')
            },
          },
        })
        ytPlayerRef.current = player
      })
      .catch(() => {
        /* the silent audio fallback owns recovery */
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
    const audio = audioRef.current
    if (youtubeActive) {
      audio?.pause()
      const player = ytPlayerRef.current
      if (player?.playVideo) {
        if (isPlaying) safeYouTubePlay(player)
        else player.pauseVideo()
      }
      return
    }
    if (!track?.streamUrl || !audio) return
    if (isPlaying) {
      const attemptId = ++playAttemptIdRef.current
      const resume = resumeAttemptRef.current
      const shouldValidate = resume.trackId === track.id && resume.validate
      resumeAttemptRef.current.validate = false
      const startAt = Number(audio.currentTime) || 0
      const resumeTime = Math.max(0, Number(resume.resumeTime) || startAt)
      ;(async () => {
        if (shouldValidate) {
          const directWorked = await retryDirectUrl(audio, track.streamUrl, resumeTime, attemptId)
          if (attemptId !== playAttemptIdRef.current) return
          if (directWorked) {
            setIsPlaying(true)
            scheduleAdvanceCheck(audio, attemptId, Number(audio.currentTime) || resumeTime, resumeTime)
            return
          }
          const recovered = await recoverCurrentStream('resume', {
            resumeTime,
            wasPlaying: true,
            fast: true,
            force: true,
          })
          if (!recovered) setIsPlaying(false)
          return
        }
        const played = await safeAudioPlay(audio, attemptId)
        if (attemptId !== playAttemptIdRef.current) return
        if (played) scheduleAdvanceCheck(audio, attemptId, startAt, resumeTime)
      })()
    } else {
      playAttemptIdRef.current += 1
      clearAdvanceCheck()
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, track?.id, track?.streamUrl, youtubeActive, currentUser, recoverySignal])

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
    const shouldDuck = speaking || remoteSpeaking || voiceNotePlaying || loungeVoicePlaying
    const normalizationGain = settings.normalization ? 0.9 : 1
    const target = muted ? 0 : (shouldDuck ? volume * duckRatio : volume) * normalizationGain * crossfadeGain
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
  }, [speaking, remoteSpeaking, voiceNotePlaying, loungeVoicePlaying, volume, muted, settings.duckLevel, settings.normalization, crossfadeGain])

  useEffect(() => {
    if (!youtubeActive) return undefined
    const timer = setInterval(() => {
      const player = ytPlayerRef.current
      if (!player?.getCurrentTime) return
      const time = player.getCurrentTime() || 0
      progressRef.current = time
      playbackProgressStore.set(time)
      if (guestPreviewRef.current && time >= GUEST_PREVIEW_SECONDS) {
        player.pauseVideo?.()
        setIsPlaying(false)
        isPlayingRef.current = false
        progressRef.current = GUEST_PREVIEW_SECONDS
        playbackProgressStore.set(GUEST_PREVIEW_SECONDS)
        openPreviewGateRef.current()
        return
      }
      const total = player.getDuration?.() || 0
      publishMediaSessionPosition(time, total)
      if (total > 0) setDuration(guestPreviewRef.current ? Math.min(total, GUEST_PREVIEW_SECONDS) : total)
      if (isPlayingRef.current && player.getPlayerState) {
        const state = player.getPlayerState()
        if (state === 1) {
          handleAudioReady()
        } else if (state === 3 || state === 5) {
          setBuffering(true)
          if (!stallTimerRef.current) {
            stallTimerRef.current = setTimeout(() => {
              stallTimerRef.current = null
              recoverCurrentStream('video', { fast: true, force: true })
            }, 6000)
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
    if (!isPlaying || !track?.id || track.id === 'empty') return
    addRecent(track.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, isPlaying, track?.id])

  useEffect(() => {
    handleEndedRef.current = handleEnded
  })

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      playAttemptIdRef.current += 1
      playRequestRef.current.seq += 1
      clearAdvanceCheck()
      clearStallTimer()
      if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current)
      audio?.pause()
    }
  }, [])
  // Read native position only after the source/seek effects above have applied.
  useMediaSession({
    track, isPlaying, duration, canControl,
    commands: {
      play: () => { if (!isPlayingRef.current) return togglePlay() },
      pause: () => { if (isPlayingRef.current) return togglePlay() },
      next: nextTrack,
      previous: previousTrack,
      seek: seekTo,
      position: getPlaybackTime,
    },
  })

  return {
    sleepTimer, setSleepTimer,
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
    stageTrack,
    prefetchTrack,
    replayGuestPreview,
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
  }
}
