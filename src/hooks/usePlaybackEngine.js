import { alternateVideoIds } from '../core/playbackCandidates.js'
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
  resolveVideoId,
  fetchYtSearch,
  primeInstantPreview,
  loadRoomStateSnapshot,
  preResolvedStream,
  fetchYtRadio,
} from '../lib/appServices.js'
import { playbackProgressStore, setLiveTelemetry } from '../state/playbackStore'
import { preloadQueueWindow, preloadCandidateAt, getPreloadedTrack } from '../services/preloadManager'
import { useEffect, useRef } from 'react'
import { useMediaSession, publishMediaSessionPosition } from './useMediaSession.js'

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
    audioRef, youtubeRef, youtubeHostRef,
    sleepPausedRef,
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
    autoplayTracks,
  },
}) {
  const listeningRef = useRef({id:null,seconds:0,lastTime:0,awarded:false,completed:false})
  function learnListening(time) {
    const item=listeningRef.current
    if(item.id!==track?.id) listeningRef.current={id:track?.id,seconds:0,lastTime:time,awarded:false,completed:false}
    const live=listeningRef.current
    if(isPlaying) live.seconds+=Math.max(0,Math.min(1,time-live.lastTime))
    live.lastTime=time
    if(live.seconds>=60&&!live.awarded){live.awarded=true;recordTasteSignal('listened',{track})}
  }
  const radioActive = useRef(false)
  const guestPreviewRef = useRef(false)
  const previewGateRef = useRef(false)
  const previewUpgradeRef = useRef(false)
  const prefetchInFlightRef = useRef(new Set())
  const upgradeInFlightRef = useRef(new Set())
  const radioPrimedRef = useRef(new Set())
  const openPreviewGateRef = useRef(() => {})
  const pendingNativeRef = useRef(new Map())
  const blockedVideoIdsRef = useRef(new Set())
  const retryRef = useRef({ id: null, count: 0, busy: false })
  const frameActive = Boolean(track?.youtubeVideoId && !track?.streamUrl && track?.status === 'ready')
  const frameState = useRef(null)
  const duck = speaking || remoteSpeaking || voiceNotePlaying || loungeVoicePlaying
  frameState.current = {
    playing: isPlaying && !sleepPausedRef.current,
    get time() { return roomPlaybackActive ? roomClockTime() : (pendingSeekRef.current ?? progressRef.current) },
    volume: muted ? 0 : volume * (settings.normalization ? 0.9 : 1) * crossfadeGain * (duck ? Math.max(.05,(settings.duckLevel || 20)/100) : 1),
  }
  useEffect(() => {
    if (!frameActive || !youtubeHostRef.current) return undefined
    let cancelled = false, bridge
    const id = track.id
    audioRef.current?.pause()
    const fail = async (reason, code) => {
      if (cancelled || queueIdsRef.current[currentIndexRef.current] !== id) return
      if (reason !== 'short' && (code == null || [2,5,100,101,150].includes(code))) {
        blockedVideoIdsRef.current.add(track.youtubeVideoId)
        if (retryRef.current.id !== id) retryRef.current = { id, count:0, busy:false }
        const retry = retryRef.current
        if (retry.busy) return
        retry.busy = true
        let ids = alternateVideoIds(track, [], blockedVideoIdsRef.current)
        if (!ids.length && retry.count < 3) {
          const matches = await withTimeout(fetchYtSearch(track.title + ' ' + track.artist + ' audio', 20, { fresh:true }), 4000, 'Alternate lookup').catch(() => [])
          ids = alternateVideoIds(track, matches, blockedVideoIdsRef.current)
        }
        retry.busy = false
        if (cancelled || queueIdsRef.current[currentIndexRef.current] !== id) return
        if (ids.length && retry.count < 3) {
          retry.count++
          const next = { ...track, youtubeVideoId:ids[0], videoId:ids[0], streamUrl:null, playbackPath:'iframe', altVideoIds:ids.slice(1), status:'ready' }
          libraryRef.current = { ...libraryRef.current, [id]:next }
          setLibrary(previous => ({ ...previous, [id]:next }))
          return
        }
      }
      const nativeTask=pendingNativeRef.current.get(id)
      if(nativeTask && reason!=='short') {
        const native=await withTimeout(nativeTask,14000,'Native completion').catch(()=>null)
        if(cancelled) return
        if(native?.streamUrl && isFullLengthTrack(native)) {
          const ready=sanitizeTrack({...track,...native,id,status:'ready',playbackPath:'audio'})
          libraryRef.current={...libraryRef.current,[id]:ready};setLibrary(previous=>({...previous,[id]:ready}));return
        }
      }
      setIsPlaying(false); isPlayingRef.current = false
      setBuffering(false); setStreamRecovering(false)
      setLibrary(previous => ({ ...previous, [id]: { ...previous[id], status:'error' } }))
      showToast(reason === 'short' ? 'Track blocked: full-length audio must be at least 60 seconds' : 'Audio stream unavailable. Try another track.', 'lock')
    }
    import('../services/youtubePlayer.js').then(({createYouTubeBridge}) => {
      if (cancelled) return null
      return createYouTubeBridge({
        host:youtubeHostRef.current, videoId:track.youtubeVideoId, state:() => frameState.current,
        onDuration:total => {
          if (cancelled) return
          setDuration(guestPreviewRef.current ? Math.min(total,GUEST_PREVIEW_SECONDS) : total)
          setLibrary(previous => {
            if (previous[id]?.duration === total) return previous
            const next = { ...previous, [id]: { ...previous[id], duration:total } }
            libraryRef.current = next
            return next
          })
          pendingSeekRef.current = null
        },
        onPlaying:() => { if (!cancelled) { setBuffering(false); setStreamRecovering(false) } },
        onProgress:(time,total) => {
          if (cancelled) return
          if (guestPreviewRef.current && time >= GUEST_PREVIEW_SECONDS) { youtubeRef.current?.pauseVideo(); updatePlaybackProgress(GUEST_PREVIEW_SECONDS); openPreviewGate(); return }
          learnListening(time); updatePlaybackProgress(time); publishMediaSessionPosition(time,total)
        },
        onEnded:() => { if (!cancelled) handleEndedRef.current?.() }, onError:fail,
        onBlocked:() => { if (!cancelled) { setIsPlaying(false); setBuffering(false) } },
      })
    }).then(instance => { bridge = instance; if (cancelled) instance?.destroy(); else youtubeRef.current = instance }).catch(() => fail('unavailable'))
    return () => { cancelled = true; bridge?.destroy(); if (youtubeRef.current === bridge) youtubeRef.current = null }
  }, [frameActive, track?.id, track?.youtubeVideoId])
  useEffect(() => {
    if (!frameActive) return
    if (isPlaying && !sleepPausedRef.current) youtubeRef.current?.playVideo()
    else youtubeRef.current?.pauseVideo()
    youtubeRef.current?.setVolume()
  }, [frameActive, isPlaying, volume, muted, crossfadeGain, duck, settings.duckLevel, settings.normalization])

  async function iframeCandidate(candidate, resumeTime = 0) {
    if (!isFullLengthTrack(candidate)) return null
    const known = candidate.youtubeVideoId || candidate.videoId || (String(candidate.id).startsWith('yt-') ? candidate.id.slice(3) : '')
    const videoId = /^[A-Za-z0-9_-]{11}$/.test(known) ? known : await withTimeout(resolveVideoId(candidate),3500,'Video lookup timed out').catch(() => '')
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
    const ready = sanitizeTrack({ ...candidate, streamUrl:null, previewUrl:null, youtubeVideoId:videoId, playbackPath:'iframe', preview:false, status:'ready', needsHydration:false })
    if (queueIdsRef.current[currentIndexRef.current] === candidate.id) {
      audioRef.current?.pause(); pendingSeekRef.current = resumeTime
    }
    libraryRef.current = { ...libraryRef.current, [candidate.id]:ready }
    setLibrary(previous => ({ ...previous, [candidate.id]:ready }))
    return ready
  }
  useEffect(() => {
    // Remote Room commands can select catalog-only tracks without a local click.
    if (isPlaying && track?.id && track.id !== 'empty' && !track.streamUrl && track.status === 'pending') ensurePlayable(track)
  }, [isPlaying, track?.id, track?.streamUrl, track?.status])

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
    if (frameActive) { youtubeRef.current?.seekTo(0); setIsPlaying(true); return }
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
    youtubeRef.current?.pauseVideo()
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
        const timer = setTimeout(done, 3500)
        audio.addEventListener('loadedmetadata', done)
        audio.addEventListener('error', done)
        audio.addEventListener('emptied', onEmptied)
      })
    }
    if (attemptId !== playAttemptIdRef.current || source !== audio.getAttribute('src')) return false
    if (audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration < 60) {
      audio.pause?.()
      setIsPlaying(false)
      showToast('Track blocked: full-length audio must be at least 60 seconds', 'lock')
      return false
    }
    if (audio.error || audio.readyState < 1 || !Number.isFinite(audio.duration)) {
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
    if (youtubeRef.current?.active) return youtubeRef.current.getCurrentTime()
    const audio = audioRef.current
    if (loadedUrlRef.current && audio) return audio.currentTime || 0
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
    if (previousTrack?.id && previousTrack.id !== 'empty' && candidate?.id) {
      if (sameTrack && elapsed > 0.5) recordTasteSignal('replay', { track: previousTrack })
      else if (!sameTrack && elapsed > 0.5 && !listeningRef.current.completed) recordTasteSignal('skip', { track: previousTrack, elapsed })
    }
    listeningRef.current={id:candidate?.id,seconds:0,lastTime:0,awarded:false,completed:false}
    sleepPausedRef.current = false
    isPlayingRef.current = key === SOLO_ROOM_ID || (activeRoomRef.current === key)
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
      if (activeRoomRef.current !== key) {
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
    import('../services/youtubePlayer.js').then(module=>module.warmYouTubeApi()).catch(()=>{})
    if (!candidate?.id) return null
    // A hovered card has already resolved its stream in the prefetch map.
    const pre = options.forceRefresh ? null : preResolvedStream(candidate)
    if (pre && (pre.streamUrl || pre.youtubeVideoId)) {
      candidate = { ...candidate, ...pre, id: candidate.id, cover: candidate.cover || pre.cover }
    }
    const fullDirect = Boolean(candidate.streamUrl) && isFullLengthTrack(candidate) && !isPreviewTrack(candidate)
    const playbackUrl = fullDirect ? candidate.streamUrl : null
    const youtubeVideoId = candidate.youtubeVideoId
    const staged = sanitizeTrack({
      ...candidate,
      streamUrl: playbackUrl,
      youtubeVideoId,
      preview: false,
      needsHydration: false,
      status: playbackUrl ? 'ready' : 'resolving',
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
          status: merged.streamUrl ? 'ready' : 'resolving',
        },
      }
    })
    return staged
  }

  // Warm the stream for a hovered or visible card so the click can attach
  // immediately from the pre-resolved map.
  function prefetchTrack(candidate) {
    if (!candidate?.id) return
    primeInstantPreview(candidate)
    if (!currentUser) return
    const existing = libraryRef.current?.[candidate.id]
    if (existing?.streamUrl || !candidate.youtubeVideoId) return
    if (prefetchInFlightRef.current.has(candidate.id)) return
    prefetchInFlightRef.current.add(candidate.id)
    resolveFullTrack(candidate)
      .then((ready) => {
        if (!ready || (!ready.streamUrl && !ready.youtubeVideoId) || !isFullLengthTrack(ready)) return
        setLibrary((previous) => {
          const entry = previous[candidate.id]
          if (entry?.streamUrl) return previous
          return {
            ...previous,
            [candidate.id]: sanitizeTrack({ ...entry, ...ready, id: candidate.id, preview: false, status: 'ready' }),
          }
        })
      })
      .catch(() => {})
      .finally(() => prefetchInFlightRef.current.delete(candidate.id))
  }

  // Playing any track immediately fills Up Next from that track's official
  // RDAMVM radio. The queue keeps its current order; radio rows are appended.
  function primeRadioQueue(candidate) {
    const videoId = candidate?.youtubeVideoId
    if (activeRoomRef.current) return
    const room = null
    if (!videoId || (!room && radioActive.current)) return
    if (room && (!canControlRoom || roomClockRef.current.lastActorId !== currentUser?.id || currentIndex < queue.length - 2)) return
    const primeKey = (room?.id || 'solo') + ':' + videoId
    if (radioPrimedRef.current.has(primeKey)) return
    radioPrimedRef.current.add(primeKey)
    fetchYtRadio(videoId, { limit: 25, artist: candidate.artist })
      .then((tracks) => {
        if (room && activeRoomRef.current !== room.id) return
        const latestRoom = room ? roomsRef.current.find(item => item.id === room.id) : null
        const existing = new Set(latestRoom?.trackIds || soloQueueRef.current)
        const extra = (Array.isArray(tracks) ? tracks : [])
          .filter((item) => item?.id && item.id !== candidate.id && !existing.has(item.id))
        if (!extra.length) return
        libraryRef.current = { ...libraryRef.current, ...Object.fromEntries(extra.map(item => [item.id, sanitizeTrack(item)])) }
        setLibrary((previous) => {
          const next = { ...previous }
          extra.forEach((item) => { next[item.id] = sanitizeTrack(item) })
          return next
        })
        extra.forEach((item) => saveLibraryEntry(item.id, item))
        if (latestRoom) commitRoomQueue(latestRoom, [...latestRoom.trackIds, ...extra.map(item => item.id)])
        else commitSoloQueue([...soloQueueRef.current, ...extra.map((item) => item.id)], { currentId: candidate.id })
      })
      .catch(() => {})
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
      if (!resolved?.streamUrl) {
        try {
          resolved = await withTimeout(resolveByMetadata(candidate, { forceRefresh: true }), 9000, 'Fallback lookup timed out')
        } catch {
          resolved = null
        }
      }
      if (!resolved?.streamUrl) return
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
    if (!isFullLengthTrack(candidate)) return null
    if (!forceRefresh && candidate.playbackPath === 'iframe' && !candidate.streamUrl) return iframeCandidate(candidate, progressRef.current)
    const pre = forceRefresh ? null : preResolvedStream(candidate)
    if (pre && (pre.streamUrl || pre.youtubeVideoId)) {
      candidate = sanitizeTrack({ ...candidate, ...pre, id: candidate.id, cover: candidate.cover || pre.cover })
    }
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
      (candidate.streamUrl && isFullLengthTrack(candidate) && !isPreviewTrack(candidate)),
    )
    const existingReady = libraryRef.current[candidate.id]
    if (direct && existingReady?.streamUrl === candidate.streamUrl && existingReady.status === 'ready') return existingReady
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

    try {
      let resolved = null
      const nativeTask=resolveFullTrack(candidate,{forceRefresh,budget:14000})
      pendingNativeRef.current.set(candidate.id,nativeTask)
      if(pendingNativeRef.current.size>100)pendingNativeRef.current.delete(pendingNativeRef.current.keys().next().value)
      nativeTask.then(native=>{
        const current=libraryRef.current[candidate.id]
        if(!native?.streamUrl || !isFullLengthTrack(native) || !isPlayingRef.current || queueIdsRef.current[currentIndexRef.current]!==candidate.id || current?.playbackPath!=='iframe' || youtubeRef.current?.ready)return
        const ready=sanitizeTrack({...candidate,...native,id:candidate.id,status:'ready',playbackPath:'audio'})
        libraryRef.current={...libraryRef.current,[candidate.id]:ready};setLibrary(previous=>({...previous,[candidate.id]:ready}))
      }).catch(()=>{})
      try {
        resolved = await withTimeout(
          nativeTask,
          1200,
          'Primary stream lookup timed out',
        )
      } catch {
        resolved = null
      }
      if (!resolved?.streamUrl && !candidate.youtubeVideoId) {
        resolved = await withTimeout(
          resolveByMetadata(candidate, { forceRefresh }),
          fast ? 2600 : 9000,
          'Fallback stream lookup timed out',
        )
      }
      if (!resolved?.streamUrl) {
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
      const fallback = await iframeCandidate(candidate)
      if (fallback) return fallback
      if (queueIdsRef.current[currentIndexRef.current] === candidate.id) {
        setIsPlaying(false)
        setBuffering(false)
        showToast('Audio stream unavailable. Try another track.', 'lock')
      }
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
    // Guest access limits are separate from source validation: never use preview URLs.
    return ensurePlayable(candidate)
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
    const key = activeRoomRef.current ? activeRoomRef.current : SOLO_ROOM_ID
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
    if (!track.streamUrl && !frameActive) {
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
    if (frameActive) { if (next) youtubeRef.current?.playVideo(); else youtubeRef.current?.pauseVideo() }
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
      } catch {
        /* ignore */
      }
      updatePlaybackProgress(GUEST_PREVIEW_SECONDS)
      setIsPlaying(false)
      audioRef.current?.pause()
        openPreviewGate()
      return
    }
    if (!track.streamUrl && !frameActive) return
    const total = duration || track.duration || 0
    const target = Math.max(0, Math.min(Number(seconds) || 0, total || Number(seconds) || 0))
    const audio = audioRef.current
    if (frameActive) youtubeRef.current?.seekTo(target)
    else if (track.streamUrl && audio) {
      try {
        audio.currentTime = target
      } catch {
        pendingSeekRef.current = target
        setSeekSignal((value) => value + 1)
      }
    }
    updatePlaybackProgress(target)
    setJoinPill(null)
    if (roomPlaybackActive) {
      setRoomClock({ time: target })
      announce({ time: target, command: 'SEEK' })
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
    if(track?.id && track.id!=='empty' && !listeningRef.current.completed) {recordTasteSignal('complete',{track,affinityAwarded:listeningRef.current.awarded});listeningRef.current.completed=true}
    const nativeNextIndex = currentIndex + 1 < queueIds.length ? currentIndex + 1 : repeatMode === 'all' ? 0 : -1
    const warmedNext = nativeNextIndex >= 0 ? getPreloadedTrack(queueIds[nativeNextIndex]) : null
    if (repeatMode !== 'one' && warmedNext?.streamUrl && (!roomPlaybackActive || (canControlRoom && roomClockRef.current.lastActorId === currentUser?.id))) {
      const audio = audioRef.current
      if (audio) {
        loadedUrlRef.current = warmedNext.streamUrl
        audio.src = warmedNext.streamUrl
        audio.play()?.catch(() => { setIsPlaying(false); showToast('Tap Play to continue playback') })
        startPlaybackAt(nativeNextIndex, warmedNext)
        return
      }
    }
    if (roomPlaybackActive) {
      if (!canControlRoom) {
        setIsPlaying(false)
        return
      }
      const clock = roomClockRef.current
      const room = roomsRef.current.find(item => item.id === activeRoomRef.current)
      if (clock.lastActorId !== currentUser?.id) return
      if (room && clock.index === room.trackIds.length - 1) {
        const endedId = room.trackIds[clock.index]
        const key = room.id + ':ended:' + endedId + ':' + clock.stateVersion
        if (radioPrimedRef.current.has(key)) return
        radioPrimedRef.current.add(key)
        setRoomClock({ ...clock, isPlaying:false, time:getPlaybackTime() })
        fetchYtRadio(track.youtubeVideoId || track.videoId, { limit:1, artist:track.artist }).then(tracks => {
          const latest = roomsRef.current.find(item => item.id === room.id)
          if (!latest || activeRoomRef.current !== room.id || roomClockRef.current.lastActorId !== currentUser?.id || latest.trackIds.at(-1) !== endedId) return
          const next = tracks.find(item => item?.id && item.id !== endedId)
          if (!next) { setIsPlaying(false); announce({isPlaying:false}); return }
          libraryRef.current={...libraryRef.current,[next.id]:sanitizeTrack(next)}
          rememberTrack(next)
          const ids = [...latest.trackIds, next.id]
          commitRoomQueue(latest, ids)
          startRoomQueueAt(room.id, ids, ids.length - 1)
          announce({ index:ids.length - 1, time:0, isPlaying:true })
        }).catch(() => { setIsPlaying(false); announce({isPlaying:false}) })
      } else advanceRoomClock()
      return
    }
    if (inRoom && !canControl) {
      setIsPlaying(false)
      return
    }

    if (!queueIds.length) {
      setIsPlaying(false)
      updatePlaybackProgress(0)
      return
    }
    if (repeatMode === 'one') {
      const audio = audioRef.current
      setBuffering(false)
      if (frameActive) { youtubeRef.current?.seekTo(0); youtubeRef.current?.playVideo(); updatePlaybackProgress(0) }
      else if (track.streamUrl && audio) {
        try {
          audio.currentTime = 0
        } catch {
          /* ignore unseekable stream */
        }
        updatePlaybackProgress(0)
        safeAudioPlay(audio, ++playAttemptIdRef.current)
      }
      setIsPlaying(true)
      return
    }
    const nextIndex = currentIndex + 1
    if (nextIndex >= queueIds.length) {
      if (repeatMode !== 'all' && !radioActive.current) {
        if (autoplay && typeof autoplayTracks === 'function') {
          Promise.resolve(autoplayTracks(track))
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

  useEffect(() => {
    if (!track?.id || !isPlaying) return
    preloadQueueWindow({ queue, currentIndex, repeatMode, resolve: ensurePlayable })

  }, [track?.id, queueIds.join('|'), currentIndex, repeatMode, isPlaying])

  function maybePreloadNext(audio) {
    if (!audio || !queueIds.length || repeatMode === 'one') return
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration
    if (!total) return
    let nextIndex = currentIndex + 1
    if (nextIndex >= queueIds.length) {
      if (repeatMode !== 'all' && !radioActive.current) return
      nextIndex = 0
    }
    const candidate = queue[nextIndex] || library[queueIds[nextIndex]]
    if (candidate) preloadCandidateAt([candidate], 0, ensurePlayable)
  }

  function maybeCrossfade(audio) {
    if (document.hidden) return
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
    const startLevel = audio.volume
    const startedAt = performance.now()
    const fadeMs = Math.max(250, Math.min(remaining * 1000, seconds * 1000))

    const applyLevel = (level) => {
      const safe = Math.max(0, Math.min(1, level))
      audio.volume = safe
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

  // Recover only through native audio URLs; unavailable providers stay unavailable.
  function streamAlternatives(current) {
    const list = []
    const direct = String(current?.streamUrl || '')
    if (direct) list.push(direct)
    const pre = preResolvedStream(current)
    if (pre?.streamUrl && pre.streamUrl !== direct) list.push(pre.streamUrl)
    return list
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
    const fallback = await iframeCandidate(current, resumeTime)
    if (fallback) { setIsPlaying(wasPlaying); setBuffering(false); setStreamRecovering(false); return true }
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
    iframeCandidate(library[track?.id] || track, getPlaybackTime()).then(fallback => { if (!fallback) recoverCurrentStream('error') })
  }

  function acceptJoin() {
    const stored = loadRoomStateSnapshot()
    let target = joinPill?.time || 0
    if (roomClockRef.current?.roomId === activeRoomId) target = roomClockTime()
    else if (stored?.roomId === activeRoomId && stored.ts) {
      target = (stored.time || 0) + (stored.isPlaying ? Math.max(0, Date.now() - stored.ts) / 1000 : 0)
    }
    pendingSeekRef.current = target
    setSeekSignal((value) => value + 1)
    const playing = Boolean(roomClockRef.current?.isPlaying ?? stored?.isPlaying)
    setIsPlaying(playing)
    if (!playing) audioRef.current?.pause()
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
      announce({ command: 'QUEUE_UPDATE' })
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
    recordTasteSignal('searchPlay',{track:candidate})
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
    if(activeRoomRef.current){searchTargetRef.current={mode:'room',roomId:activeRoomRef.current};return playSearchTrack(candidate,contextTracks)}
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
    primeRadioQueue(staged)
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
            learnListening(time)
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
            publishMediaSessionPosition(time, audio.duration, audio.playbackRate)
            if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.buffered.length) {
              const end = audio.buffered.end(audio.buffered.length - 1)
              setLiveTelemetry({ bufferedPct: Math.min(100, Math.round((end / audio.duration) * 100)) })
            }
            maybePreloadNext(audio)
            maybeCrossfade(audio)
          }

  function handleLoadedMetadata(event) {
            const audio = event.currentTarget
            if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 60) {
              audio.pause()
              playAttemptIdRef.current += 1
              setIsPlaying(false)
              isPlayingRef.current = false
              setBuffering(false)
              setLibrary(previous => ({ ...previous, [track.id]: { ...previous[track.id], streamUrl:null, status:'error' } }))
              clearResolvedStream(track.id)
              if (track.youtubeVideoId) clearResolvedStream(`yt:${track.youtubeVideoId}`)
              showToast('Track blocked: full-length audio must be at least 60 seconds', 'lock')
              return
            }
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
    const audio = audioRef.current
    if (frameActive || !track?.streamUrl || !audio) return
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
  }, [frameActive, isPlaying, track?.id, track?.streamUrl, currentUser, recoverySignal])

  useEffect(() => {
    const target = pendingSeekRef.current
    if (target != null && frameActive && youtubeRef.current?.ready) { youtubeRef.current.seekTo(target); pendingSeekRef.current = null; return undefined }
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
    return undefined
  }, [frameActive, seekSignal, track?.streamUrl])

  useEffect(() => {
    const audio = audioRef.current
    const duckRatio = Math.max(0.05, Math.min(1, (settings.duckLevel || 20) / 100))
    const shouldDuck = speaking || remoteSpeaking || voiceNotePlaying || loungeVoicePlaying
    const normalizationGain = settings.normalization ? 0.9 : 1
    const target = muted ? 0 : (shouldDuck ? volume * duckRatio : volume) * normalizationGain * crossfadeGain
    if (!audio) return undefined
    if (document.hidden) { audio.volume = target; return undefined }
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
    const stopBackgroundFade = () => {
      if (!document.hidden) return
      if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current)
      fadeFrameRef.current = null
      crossfadeLockRef.current = false
      crossfadeGainRef.current = 1
      setCrossfadeGain(1)
    }
    document.addEventListener('visibilitychange', stopBackgroundFade)
    return () => document.removeEventListener('visibilitychange', stopBackgroundFade)
  }, [])


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
      rate: () => youtubeRef.current?.active ? youtubeRef.current.getPlaybackRate() : audioRef.current?.playbackRate || 1,
    },
  })

  return {
    sleepTimer, setSleepTimer,
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
