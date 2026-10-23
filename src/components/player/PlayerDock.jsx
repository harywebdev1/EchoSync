import {
  Heart,
  ListMusic,
  ListPlus,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Cover } from '../Cover'
import { TelemetryPill } from '../TelemetryPill'
import { formatTime } from '../../lib/time'
import { usePlaybackProgress } from '../../state/playbackStore'

function QueueBadge({ count }) {
  return <b className="queue-count-badge">{count > 99 ? '99+' : count}</b>
}

export function PlayerDock({
  track,
  isPlaying,
  buffering,
  duration,
  liked,
  volume,
  muted,
  onTogglePlay,
  onPrev,
  onNext,
  onLike,
  onAddToPlaylist,
  onVolume,
  onToggleMute,
  onSeek,
  onOpenFull,
  onToggleQueue,
  onCycleRepeat,
  onToggleShuffle,
  repeatMode = 'off',
  shuffleEnabled = false,
  queueCount = 0,
  queueOpen = false,
  inRoom,
  canSeek = true,
}) {
  const liveProgress = usePlaybackProgress()
  const total = duration || track?.duration || 0
  const pct = total ? Math.min(100, Math.max(0, (liveProgress / total) * 100)) : 0
  const repeatLabel = repeatMode === 'one'
    ? 'Repeat: Current Track'
    : repeatMode === 'all'
      ? 'Repeat: Queue'
      : 'Repeat: Off'
  return (
    <div className="player-dock" data-testid="player-dock">
      <div className="dock-track">
        <button type="button" className="dock-cover" onClick={onOpenFull} aria-label="Open full player">
          <Cover track={track} size="cover-size-md" playing={isPlaying} />
        </button>
        <button type="button" className="dock-copy" onClick={onOpenFull}>
          <strong title={track?.title || 'Nothing playing'}>{track?.title || 'Nothing playing'}</strong>
          <span>{track?.artist || 'EchoSync'}</span>
        </button>
        <div className="dock-quick-actions">
          <button
            className={`like-btn dock-like ${liked.includes(track?.id) ? 'liked' : ''}`}
            onClick={() => onLike(track)}
            aria-label="Like track"
          >
            <Heart />
          </button>
          <button
            className="icon-btn dock-add"
            onClick={() => onAddToPlaylist(track)}
            aria-label="Add to playlist"
            title="Add to playlist"
          >
            <ListPlus />
          </button>
        </div>
      </div>
      <div className="dock-center">
        <div className="dock-buttons">
          <button
            className={`icon-btn dock-mode ${shuffleEnabled ? 'active' : ''}`}
            onClick={onToggleShuffle}
            aria-label={`Shuffle: ${shuffleEnabled ? 'On' : 'Off'}`}
            aria-pressed={shuffleEnabled}
            title={`Shuffle: ${shuffleEnabled ? 'On' : 'Off'}`}
            data-testid="shuffle-btn"
            disabled={inRoom}
          >
            <Shuffle />
          </button>
          <button className="icon-btn dock-skip" onClick={onPrev} aria-label="Previous track"><SkipBack /></button>
          <button className="dock-play" onClick={onTogglePlay} aria-label={buffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}>
            {buffering ? <RefreshCw className="spin" /> : isPlaying ? <Pause /> : <Play />}
          </button>
          <button className="icon-btn dock-skip" onClick={onNext} aria-label="Next track"><SkipForward /></button>
          <button
            className={`icon-btn dock-mode ${repeatMode !== 'off' ? 'active' : ''}`}
            onClick={onCycleRepeat}
            aria-label={repeatLabel}
            title={repeatLabel}
            data-testid="repeat-btn"
            disabled={inRoom}
          >
            {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
          </button>
          <button
            className={`icon-btn dock-mode dock-queue ${queueOpen ? 'active' : ''}`}
            onClick={onToggleQueue}
            aria-label={`Up Next queue, ${queueCount} tracks`}
            title={inRoom ? 'Queue is available outside rooms' : 'Playback queue'}
            data-testid="queue-btn"
            disabled={inRoom}
          >
            <ListMusic />
            {queueCount > 0 && <QueueBadge count={queueCount} />}
          </button>
        </div>
        <div className="dock-time">
          <span>{formatTime(liveProgress)}</span>
          <input
            className="dock-seek"
            data-testid="dock-seek"
            style={{ '--seek-pct': `${pct}%` }}
            type="range"
            min="0"
            max={total || 1}
            step="0.1"
            value={Math.min(liveProgress, total || liveProgress)}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={!canSeek || !total}
            aria-label="Seek playback"
          />
          <span>{formatTime(total)}</span>
        </div>
      </div>
      <div className="dock-actions">
        {inRoom && <TelemetryPill compact className="dock-sync-pill" />}
        <div className="dock-volume">
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
        <button className="icon-btn dock-expand" onClick={onOpenFull} aria-label="Expand player"><Maximize2 /></button>
      </div>
    </div>
  )
}
