import { SleepTimerControl } from './SleepTimerControl.jsx'
import {
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  ChevronDown,
  Sparkles,
  ListMusic,
  RefreshCw,
  ListPlus,
  Shuffle,
  Repeat,
  Repeat1,
  ArrowRight,
} from 'lucide-react'
import { formatTime } from '../../lib/time'
import { usePlaybackProgress } from '../../state/playbackStore'
import { Cover } from '../Cover'
import { TelemetryPill } from '../TelemetryPill'
import { LyricsPanel } from './LyricsPanel'

function SoloQueueBadge({ count }) {
  return <b className="queue-count-badge">{count > 99 ? '99+' : count}</b>
}

function FullPlayerTimeline({ total, canControl, onSeek, onLock }) {
  const progress = usePlaybackProgress()
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  return (
    <>
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
        onKeyDown={(event) => {
          if (!canControl) {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') onLock()
            return
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            onSeek(Math.min(total, progress + 5))
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            onSeek(Math.max(0, progress - 5))
          }
        }}
      >
        <div className="timeline-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="time-row">
        <b>{formatTime(progress)}</b>
        <span>{canControl ? 'CLICK TO SEEK' : 'SYNCED TO ROOM'}</span>
        <span>{formatTime(total)}</span>
      </div>
    </>
  )
}

export function FullScreenPlayer({
  room,
  sleepTimer, onSleepTimer,
  track,
  queue,
  isPlaying,
  buffering,
  duration,
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
  onAddToPlaylist,
  onVolume,
  onToggleMute,
  onRetryLyrics,
  onToggleQueue,
  onCycleRepeat,
  onToggleShuffle,
  repeatMode = 'off',
  shuffleEnabled = false,
  queueCount = 0,
  inRoom,
  translateOn,
  translating,
  onToggleTranslate,
}) {
  const total = duration || track?.duration || 0
  return (
    <div className="full-player">
      {track?.cover && <div className="fp-bg" style={{ backgroundImage: `url(${track.cover})` }} />}
      <div className="fp-scrim" />
      <div className="fp-inner">
        <header className="fp-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close full player"><ChevronDown /></button>
          <div className="fp-head-copy">
            <span>{inRoom ? `Playing in ${room.name}` : 'Your listening session'}</span>
            <strong>{inRoom ? `${queue.length} tracks in the room queue · ${room.members.length} listeners` : `${queue.length} tracks in your queue`}</strong>
          </div>
          <div className="head-spacer" />
        </header>

        <div className="fp-body">
          <div className="fp-left">
            <div className="fp-art-wrap">
              <Cover track={track} size="" playing={isPlaying} />
            </div>
            <div className="fp-info">
              <div className="fp-kicker">
                <span className="live-dot" style={{ color: room.accent }} />
                <span>{isPlaying ? 'Playing now' : inRoom ? 'Paused in room' : 'Paused'}{track?.quality ? ' · ' + track.quality : ''}</span>
              </div>
              <h2 className="fp-title">{track?.title}</h2>
              <p className="fp-artist">{track?.artist}{track?.album ? ` · ${track.album}` : ''}</p>


              <div className="fp-timeline">
                <FullPlayerTimeline
                  total={total}
                  canControl={canControl}
                  onSeek={onSeek}
                  onLock={onLock}
                />
              </div>

              <div className="fp-controls">
                <button
                  className={`icon-btn ${shuffleEnabled ? 'active' : ''}`}
                  onClick={onToggleShuffle}
                  aria-label={`Shuffle: ${shuffleEnabled ? 'On' : 'Off'}`}
                  aria-pressed={shuffleEnabled}
                  disabled={inRoom}
                >
                  <Shuffle />
                </button>
                <button className="icon-btn" onClick={onPrev} aria-label="Previous"><SkipBack /></button>
                <button className="fp-play" onClick={onTogglePlay} aria-label={buffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}>
                  {buffering ? <RefreshCw className="spin" /> : isPlaying ? <Pause /> : <Play />}
                </button>
                <button className="icon-btn" onClick={onNext} aria-label="Next"><SkipForward /></button>
                <button
                  className={`icon-btn ${repeatMode !== 'off' ? 'active' : ''}`}
                  onClick={onCycleRepeat}
                  aria-label={repeatMode === 'one' ? 'Repeat: Current Track' : repeatMode === 'all' ? 'Repeat: Queue' : 'Repeat: Off'}
                  disabled={inRoom}
                >
                  {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
                </button>

              </div>

              <div className="fp-bottom-row">
                <button
                  className="icon-btn fp-queue-btn"
                  onClick={onToggleQueue}
                  aria-label={`Up Next queue, ${queueCount} tracks`}
                  title={inRoom ? 'Room queue' : 'Playback queue'}

                >
                  <ListMusic />
                  {queueCount > 0 && <SoloQueueBadge count={queueCount} />}
                </button>
                <SleepTimerControl compact timer={sleepTimer} onChange={onSleepTimer} />
                <button className={`like-btn ${liked.includes(track?.id) ? 'liked' : ''}`} onClick={() => onLike(track)} aria-label="Like track"><Heart /></button>
                <button className="icon-btn" onClick={() => onAddToPlaylist(track)} aria-label="Add to playlist" title="Add to playlist"><ListPlus /></button>
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
                {inRoom && track?.id !== 'empty' ? <TelemetryPill detail className="fp-sync-pill" /> : null}
              </div>
            </div>
          </div>

          <div className="fp-right">
            <div className="social-head">
              <div className="social-head-copy">
                <h3>Live lyrics</h3>
                <p>
                  <Sparkles size={10} />
                  {' '}
                  {lyrics?.status === 'ready' && lyrics.type === 'synced'
                    ? (inRoom ? 'Following the room, line by line' : 'Following along, line by line')
                    : lyrics?.status === 'ready' && lyrics.type === 'plain'
                      ? (inRoom ? 'Read along with the room' : 'Read along with playback')
                      : 'Time-synced with playback'}
                </p>
              </div>
            </div>
            <LyricsPanel
              track={track}
              lyrics={lyrics}
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
