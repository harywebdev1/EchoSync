import {
  loadRoomStateSnapshot,
  SEED_BY_ID,
  writeStorage,
  ROOM_STATE_KEY,
  normalizeLoungeMessage,
  rememberBoundedId,
  LOUNGE_TYPING_MS,
  normalizeRoom,
} from '../lib/appServices.js'
import { getLiveRoomPosition, computeMemberDrift } from '../core/roomSyncMath.js'
import { recordRoomDrift } from '../services/networkMonitor'
import { useEffect } from 'react'
import { resetRoomTelemetry } from '../state/playbackStore'
import { ROLE_COPY } from '../components/shared/roomRoles'

export function useRoomSync({
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
    getPlaybackTime,
    updatePlaybackProgress,
    ensurePlayable,
    beginPlayback,
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
}) {
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
    if (stored?.roomId === roomId && stored.ts && Date.now() - stored.ts < 15000) {
      applyRemoteState(stored)
    }
  }

  function setRoomClock(patch = {}) {
    const previous = roomClockRef.current || {}
    roomClockRef.current = {
      ...previous,
      ...patch,
      updatedAt: patch.updatedAt ?? Date.now(),
    }
    return roomClockRef.current
  }

  function roomClockTime(clock = roomClockRef.current) {
    return getLiveRoomPosition(clock, Date.now())
  }

  function roomTrackDuration(clock = roomClockRef.current) {
    const item = libraryRef.current[clock?.trackId] || SEED_BY_ID[clock?.trackId]
    return Number(item?.duration) || 0
  }

  function syncRoomClockFromPlayback(overrides = {}) {
    const roomId = activeRoomRef.current
    if (!roomId) return null
    const index = currentIndexRef.current
    const clock = roomClockRef.current
    const trackId = roomQueueRef.current[index] || null
    const wallTime = roomClockTime(clock)
    const audio = audioRef.current
    const liveTime = getPlaybackTime()
    const sameTrack = Boolean(clock?.trackId && clock.trackId === trackId)
    const ready = Boolean(audio && Number.isFinite(audio.duration) && audio.duration > 0 && audio.readyState >= 2)
    const closeToWall = clock?.isPlaying
      ? Math.abs(liveTime - wallTime) <= 2
      : liveTime > 0
    const trusted = sameTrack && ready && (wallTime < 1 || closeToWall)
    return setRoomClock({
      roomId,
      index,
      trackId,
      time: trusted ? liveTime : wallTime,
      isPlaying: isPlayingRef.current,
      ...overrides,
    })
  }

  function suspendRoomPlayback() {
    if (!activeRoomRef.current) return null
    const clock = viewRef.current === 'room' ? syncRoomClockFromPlayback() : roomClockRef.current
    audioRef.current?.pause()
    setIsPlaying(false)
    setJoinPill(null)
    setBuffering(false)
    return clock
  }

  function resumeRoomOnEntry(roomId = activeRoomRef.current) {
    if (!roomId) return
    activeRoomRef.current = roomId
    setActiveRoomId(roomId)
    let clock = roomClockRef.current
    if (clock?.roomId !== roomId) {
      clock = setRoomClock({
        roomId,
        index: 0,
        trackId: roomQueueRef.current[0] || null,
        time: 0,
        isPlaying: false,
      })
    }
    const index = Math.max(0, Math.min(Number(clock.index) || 0, Math.max(0, roomQueueRef.current.length - 1)))
    const itemId = roomQueueRef.current[index]
    const item = libraryRef.current[itemId] || SEED_BY_ID[itemId]
    const target = roomClockTime(clock)
    setCurrentByRoom((previous) => ({ ...previous, [roomId]: index }))
    pendingSeekRef.current = target
    setSeekSignal((value) => value + 1)
    updatePlaybackProgress(target)
    setDuration(Number(item?.duration) || 0)
    setIsPlaying(Boolean(clock.isPlaying))
    if (clock.isPlaying) setJoinPill(null)
    setView('room')
    viewRef.current = 'room'
    setTimeout(() => requestRoomSync(roomId), 120)
  }

  function advanceRoomClock({ broadcast = true } = {}) {
    const roomId = activeRoomRef.current
    if (!roomId) return false
    const room = roomsRef.current.find((candidate) => candidate.id === roomId)
    const ids = room?.trackIds || roomQueueRef.current || []
    const clock = roomClockRef.current
    if (!ids.length) {
      setRoomClock({ roomId, index: 0, trackId: null, time: 0, isPlaying: false })
      if (viewRef.current === 'room') setIsPlaying(false)
      if (broadcast) announce({ index: 0, time: 0, isPlaying: false })
      return false
    }
    const current = Math.max(0, Math.min(Number(clock.index) || 0, ids.length - 1))
    const nextIndex = current + 1
    if (nextIndex >= ids.length) {
      const endedAt = roomClockTime(clock)
      setRoomClock({ roomId, index: current, trackId: ids[current] || null, time: endedAt, isPlaying: false })
      if (viewRef.current === 'room') {
        setIsPlaying(false)
        updatePlaybackProgress(endedAt)
      }
      if (broadcast) announce({ index: current, time: endedAt, isPlaying: false })
      return false
    }
    const nextId = ids[nextIndex]
    setRoomClock({ roomId, index: nextIndex, trackId: nextId, time: 0, isPlaying: true })
    setCurrentByRoom((previous) => ({ ...previous, [roomId]: nextIndex }))
    if (viewRef.current === 'room') {
      const candidate = libraryRef.current[nextId] || SEED_BY_ID[nextId]
      if (candidate) {
        ensurePlayable(candidate).then((playable) => {
          if (!playable || activeRoomRef.current !== roomId || roomClockRef.current.index !== nextIndex) return
          beginPlayback(roomId, roomQueueRef.current, nextIndex, playable)
        })
      }
    }
    if (broadcast) announce({ index: nextIndex, time: 0, isPlaying: true })
    return true
  }

  function roomSnapshot(overrides = {}) {
    const roomId = activeRoomRef.current
    if (!roomId) return null
    if (viewRef.current === 'room') {
      const clockOverrides = {}
      if (Object.prototype.hasOwnProperty.call(overrides, 'isPlaying')) clockOverrides.isPlaying = overrides.isPlaying
      if (Object.prototype.hasOwnProperty.call(overrides, 'time')) clockOverrides.time = overrides.time
      if (Object.prototype.hasOwnProperty.call(overrides, 'index')) clockOverrides.index = overrides.index
      syncRoomClockFromPlayback(clockOverrides)
    }
    const clock = roomClockRef.current
    const index = Math.max(0, Math.min(Number(clock.index) || 0, Math.max(0, roomQueueRef.current.length - 1)))
    const snapshot = {
      type: 'state',
      roomId,
      sender: tabIdRef.current,
      index,
      trackId: roomQueueRef.current[index] || null,
      isPlaying: Boolean(clock.isPlaying),
      time: roomClockTime(clock),
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
    const room = roomsRef.current.find((candidate) => candidate.id === data.roomId)
    const roomQueue = room?.trackIds || roomQueueRef.current
    let index = typeof data.index === 'number' ? data.index : currentIndexRef.current
    if (typeof data.index !== 'number' && data.trackId) {
      const found = roomQueue.indexOf(data.trackId)
      if (found >= 0) index = found
    }
    if (roomQueue.length) index = Math.max(0, Math.min(index, roomQueue.length - 1))
    const nextPlaying = data.isPlaying === undefined
      ? Boolean(roomClockRef.current.isPlaying)
      : Boolean(data.isPlaying)
    const baseTime = Math.max(0, Number(data.time) || 0)
    const stamp = Number(data.ts) || Date.now()
    setRoomClock({
      roomId: data.roomId,
      index,
      trackId: roomQueue[index] || data.trackId || null,
      time: baseTime,
      updatedAt: stamp,
      isPlaying: nextPlaying,
    })
    if (index !== currentIndexRef.current) {
      setCurrentByRoom((previous) => ({ ...previous, [data.roomId]: index }))
    }
    if (viewRef.current !== 'room') return
    const indexChanged = index !== currentIndexRef.current
    if (indexChanged) {
      updatePlaybackProgress(0)
      const candidate = libraryRef.current[roomQueue[index]] || SEED_BY_ID[roomQueue[index]]
      if (candidate && !candidate.streamUrl && !candidate.youtubeVideoId) {
        ensurePlayable(candidate)
      }
    }
    const target = roomClockTime()
    const drift = computeMemberDrift(getPlaybackTime(), target).seconds
    recordRoomDrift(drift)
    const lateJoin = !hasInteractedRef.current && nextPlaying
    if (lateJoin) {
      pendingSeekRef.current = target
      setSeekSignal((value) => value + 1)
      setJoinPill({ time: target, roomName: activeRoomRef.current })
      setIsPlaying(true)
      return
    }
    if (indexChanged || !data.heartbeat || drift > 0.35) {
      pendingSeekRef.current = target
      setSeekSignal((value) => value + 1)
    }
    setIsPlaying(nextPlaying)
    if (nextPlaying) setJoinPill(null)
  }

  useEffect(() => {
    if (!roomPlaybackActive) {
      resetRoomTelemetry()
      return undefined
    }
    const sample = () => {
      if (document.visibilityState === 'hidden') return
      recordRoomDrift(computeMemberDrift(getPlaybackTime(), roomClockTime()).seconds)
    }
    sample()
    const timer = setInterval(sample, 1500)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sample()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomPlaybackActive, activeRoomId])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel('echosync-room-sync')
    channelRef.current = channel

    channel.onmessage = (event) => {
      const data = event.data
      if (!data || data.sender === tabIdRef.current) return

      if ((data.type === 'invite' || data.type === 'room-invite') && data.invite) {
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

      if (data.type === 'lounge-message' && data.message) {
        const normalized = normalizeLoungeMessage(data.message)
        if (!normalized) return
        const isFreshMessage = !receivedLoungeIdsRef.current.has(normalized.id)
        if (isFreshMessage) {
          rememberBoundedId(receivedLoungeIdsRef.current, normalized.id)
          rememberLoungeUnread(normalized)
        }
        upsertLoungeMessage(normalized)
        setLoungeTyping((previous) => {
          if (!previous[normalized.author]) return previous
          const next = { ...previous }
          delete next[normalized.author]
          return next
        })
        return
      }

      if (data.type === 'lounge-reaction' && data.messageId) {
        applyLoungeReaction(data)
        return
      }

      if (data.type === 'lounge-delete' && data.messageId) {
        removeLoungeMessage(data.messageId)
        return
      }

      if (data.type === 'lounge-typing' && data.userId) {
        if (data.userId === currentUserRef.current?.id) return
        setLoungeTyping((previous) => ({ ...previous, [data.userId]: data.userId }))
        clearTimeout(loungeTypingClearRef.current[data.userId])
        loungeTypingClearRef.current[data.userId] = setTimeout(() => {
          setLoungeTyping((previous) => {
            if (!previous[data.userId]) return previous
            const next = { ...previous }
            delete next[data.userId]
            return next
          })
          delete loungeTypingClearRef.current[data.userId]
        }, LOUNGE_TYPING_MS)
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
        if (incoming.id === activeRoomRef.current) {
          const clock = roomClockRef.current
          const currentTrackId = clock.trackId || roomQueueRef.current[clock.index] || null
          const found = currentTrackId ? incoming.trackIds.indexOf(currentTrackId) : -1
          const nextIndex = incoming.trackIds.length
            ? Math.max(0, Math.min(found >= 0 ? found : clock.index, incoming.trackIds.length - 1))
            : 0
          roomQueueRef.current = incoming.trackIds
          setRoomClock({
            roomId: incoming.id,
            index: nextIndex,
            trackId: incoming.trackIds[nextIndex] || null,
            time: found >= 0 ? roomClockTime(clock) : 0,
            isPlaying: Boolean(clock.isPlaying && incoming.trackIds.length),
          })
          setCurrentByRoom((previous) => ({ ...previous, [incoming.id]: nextIndex }))
          if (viewRef.current === 'room') {
            updatePlaybackProgress(found >= 0 ? roomClockTime(clock) : 0)
            if (!incoming.trackIds.length) {
              setIsPlaying(false)
              audioRef.current?.pause()
            }
          }
        }
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
        setUnreadRoomCounts((previous) => {
          const next = { ...previous }
          delete next[data.roomId]
          return next
        })
        clearRoomPreview(data.roomId)
        if (activeRoomRef.current === data.roomId) {
          const snapshot = soloSnapshotRef.current
          soloResumeRef.current = snapshot?.track
            ? { track: snapshot.track, time: snapshot.currentTime || 0, queue: snapshot.queue || [], index: snapshot.index || 0 }
            : null
          activeRoomRef.current = null
          setActiveRoomId(null)
          setView('home')
          viewRef.current = 'home'
          setIsPlaying(false)
          audioRef.current?.pause()
          updatePlaybackProgress(0)
          setDuration(0)
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
        const messageId = data.message.id
        const isFreshMessage = !receivedChatIdsRef.current.has(messageId)
        if (isFreshMessage) {
          rememberBoundedId(receivedChatIdsRef.current, messageId)
          const isVisible = viewRef.current === 'room'
            && chatOpenRef.current
            && activeRoomRef.current === data.roomId
          if (!isVisible) rememberRoomUnread(data.roomId, data.message)
        }
        setMessages((previous) => {
          const list = previous[data.roomId] || []
          if (list.some((message) => message.id === messageId)) return previous
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
      const roomId = activeRoomRef.current
      if (!roomId) return
      if (viewRef.current === 'room') syncRoomClockFromPlayback()
      const clock = roomClockRef.current
      if (!clock.isPlaying) return
      const duration = roomTrackDuration(clock)
      const live = roomClockTime(clock)
      if (duration > 0 && live >= duration - 0.15 && viewRef.current !== 'room') {
        if (!roomControlRef.current) return
        advanceRoomClock()
        return
      }
      if (roomControlRef.current) announce({ heartbeat: true })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return {
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
  }
}
