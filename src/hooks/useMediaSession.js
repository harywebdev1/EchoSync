import { useEffect, useRef } from 'react'

export function publishMediaSessionPosition(position, duration) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession?.setPositionState) return
  if (!Number.isFinite(duration) || duration <= 0) return
  try {
    navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.max(0, Math.min(duration, position || 0)) })
  } catch { /* Position state is optional on some platforms. */ }
}

// OS media controls use the latest committed commands without re-registering listeners.
export function useMediaSession({ track, isPlaying, duration, canControl, commands }) {
  const latest = useRef(commands)
  useEffect(() => { latest.current = commands })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return undefined
    const session = navigator.mediaSession
    const handlers = {
      play: () => latest.current.play(),
      pause: () => latest.current.pause(),
      nexttrack: () => latest.current.next(),
      previoustrack: () => latest.current.previous(),
      seekto: ({ seekTime }) => latest.current.seek(seekTime),
      seekforward: ({ seekOffset = 10 }) => latest.current.seek(latest.current.position() + seekOffset),
      seekbackward: ({ seekOffset = 10 }) => latest.current.seek(latest.current.position() - seekOffset),
    }
    const registered = []
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        // A null handler can restore the browser's default media controls, bypassing room roles.
        session.setActionHandler(action, canControl ? handler : () => {})
        registered.push(action)
      } catch { /* Some browsers implement only a subset of Media Session actions. */ }
    }
    return () => {
      for (const action of registered) session.setActionHandler(action, null)
    }
  }, [canControl])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return undefined
    const session = navigator.mediaSession
    const hasTrack = Boolean(track?.id && track.id !== 'empty')
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = hasTrack ? new MediaMetadata({
        title: track.title || '', artist: track.artist || '', album: track.album || '',
        artwork: track.cover ? [{ src: track.cover }] : [],
      }) : null
    }
    session.playbackState = hasTrack ? (isPlaying ? 'playing' : 'paused') : 'none'
    const total = Number(duration || track?.duration)
    if (session.setPositionState) {
      try {
        if (hasTrack && Number.isFinite(total) && total > 0) publishMediaSessionPosition(commands.position(), total)
        else session.setPositionState()
      } catch { /* Metadata can precede a seekable stream on some platforms. */ }
    }
    return () => {
      session.metadata = null
      session.playbackState = 'none'
    }
  }, [track?.id, track?.title, track?.artist, track?.album, track?.cover, track?.duration, duration, isPlaying])
}
