import {
  Globe2,
  Heart,
  Home,
  Library,
  MessageCircle,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search, UserRound, SkipForward,
} from 'lucide-react'
import { Cover } from './Cover'
import { usePlaybackProgress } from '../state/playbackStore'

export function MobileMiniPlayer({
  track,
  isPlaying,
  buffering,
  duration,
  liked,
  onTogglePlay,
  onLike, onNext,
  onOpenFull,
}) {
  const progress = usePlaybackProgress()
  if (!track?.id || track.id === 'empty') return null
  const total = duration || track?.duration || 0
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  return (
    <div className="mobile-mini" data-testid="mobile-mini-player">
      <button type="button" className="mini-art" onClick={onOpenFull} aria-label="Open full player">
        <Cover track={track} size="" playing={isPlaying} />
      </button>
      <button type="button" className="mini-copy" aria-label={`Open full player for ${track.title || 'current track'}`} onClick={onOpenFull}>
        <strong>{track.title || 'Nothing playing'}</strong>
        <span>{track.artist || 'EchoSync'}</span>
      </button>
      <button
        type="button"
        className="mini-play"
        onClick={onTogglePlay}
        aria-label={buffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}
      >
        {buffering ? <RefreshCw className="spin" /> : isPlaying ? <Pause /> : <Play />}
      </button>
      <button type="button" className="mini-next" onClick={onNext} aria-label="Next track"><SkipForward/></button>
      <span className="mini-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
    </div>
  )
}

export function MobileBottomBar({
  view,
  inRoom,
  chatOpen,
  loungeOpen,
  unreadLoungeCount = 0,
  unreadRoomCount = 0,
  likedCount = 0,
  onNavigate,
  onSearch, onAccount,
  onChat,
  onLounge,
}) {
  const homeActive = view === 'home'
  const roomsActive = view === 'rooms' || (view === 'room' && inRoom)
  const libraryActive = view === 'library'
  return (
    <nav className="mobile-nav mobile-bottom-bar" aria-label="Primary">
      <button className={homeActive ? 'active' : ''} onClick={() => onNavigate('home')}>
        <span className="tab-icon"><Home /></span>
        <span>Home</span>
      </button>
      <button className={roomsActive && !chatOpen ? 'active' : ''} onClick={() => onNavigate('rooms')}>
        <span className="tab-icon"><Radio /></span>
        <span>Rooms</span>
        {unreadRoomCount > 0 && (
          <b className="mobile-tab-badge">{unreadRoomCount > 99 ? '99+' : unreadRoomCount}</b>
        )}
      </button>
      <button
        className={`mobile-lounge-btn ${loungeOpen ? 'active' : ''}`}
        onClick={onLounge}
        data-testid="lounge-mobile-btn"
      >
        <span className="tab-icon"><Globe2 /></span>
        <span>Lounge</span>
        {unreadLoungeCount > 0 && (
          <b className="mobile-tab-badge" data-testid="lounge-mobile-unread">
            {unreadLoungeCount > 99 ? '99+' : unreadLoungeCount}
          </b>
        )}
      </button>
      <button className={`${libraryActive ? 'active' : ''} ${chatOpen && inRoom ? 'room-chat-open' : ''}`} onClick={() => onNavigate('library')}>
        <span className="tab-icon"><Library /></span>
        <span>Library</span>
        {likedCount > 0 && <b className="mobile-tab-badge subtle">{likedCount > 99 ? '99+' : likedCount}</b>}
        {inRoom && chatOpen && (
          <span className="mobile-chat-indicator" aria-label="Room chat open">
            <MessageCircle />
          </span>
        )}
      </button>
      <button onClick={onAccount}><span className="tab-icon"><UserRound/></span><span>Account</span></button>
    </nav>
  )
}
