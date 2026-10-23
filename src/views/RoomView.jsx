import { useState } from 'react'
import {
  Plus,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  X,
  Headphones,
  ListMusic,
  UserPlus,
  Check,
  RefreshCw,
  Maximize2,
  Settings,
  Trash2,
  ShieldCheck,
  UsersRound,
  Clock3,
  ListPlus,
  DoorOpen,
  ArrowRight,
} from 'lucide-react'
import { formatTime } from '../lib/time'
import { usePlaybackProgress } from '../state/playbackStore'
import { useMembers } from '../components/shared/MembersContext'
import { AvatarStack } from '../components/shared/AvatarStack'
import { ROLE_COPY } from '../components/shared/roomRoles'
import { Cover } from '../components/Cover'
import { Avatar } from '../components/Avatar'
import { TelemetryPill } from '../components/TelemetryPill'

function RoomTimeline({ total, canControl, onSeek, onLock, ready, linePeople, members }) {
  const progress = usePlaybackProgress()
  const pct = total ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0
  const linePositions = [15, 33, 54, 74]
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
  )
}

export function RoomView({
  room,
  track,
  queue,
  currentIndex,
  isPlaying,
  duration,
  canControl,
  role,
  volume,
  muted,
  liked,
  onLock,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolume,
  onToggleMute,
  onLike,
  onAddToPlaylist,
  onInvite,
  onSearch,
  onPlayIndex,
  onOpenFull,
  currentUser,
  pendingRequest,
  onRequestRole,
  onOpenMembers,
  onOpenSettings,
  roleRequests,
  onResolveRequest,
  onFindFull,
  onRetryFull,
  onLeaveRoom,
  playlists = [],
  likedTracks = [],
  canControlRoom = false,
  onRemoveQueueTrack,
  onClearQueue,
  onImportPlaylist,
}) {
  const [importOpen, setImportOpen] = useState(false)
  const members = useMembers()
  const words = room.name.split(' ')
  const lastWord = words.pop()
  const linePeople = room.members
    .filter((id) => id !== currentUser?.id && members[id]?.showActivity !== false)
    .slice(0, 4)
  const total = duration || track?.duration || 0
  const ready = track?.status === 'ready' && Boolean(track?.streamUrl || track?.youtubeVideoId)
  const failed = track?.status === 'error'
  const pending = track?.status === 'pending' || track?.status === 'resolving'
  const RoleIcon = ROLE_COPY[role]?.Icon || Headphones
  const requestable = role === 'listener' ? 'dj' : null

  return (
    <>
      <section className="room-head">
        <div className="eyebrow">
          <span className="live-pill"><span className="live-dot" /> LIVE</span>
          <span className="seg" />
          <span>{room.private ? 'PRIVATE ROOM' : 'OPEN ROOM'}</span>
          <span className="seg" />
          <span>ROOM {room.code}</span>
        </div>
        <h1 className="room-title">
          {words.join(' ')} {words.length > 0 && ' '}<em>{lastWord}</em>
        </h1>
        <p className="room-sub">{room.description}</p>
        <div className="room-meta">
          <AvatarStack ids={room.members} size="sm" max={4} />
          <span className="meta-listeners"><b>{room.members.length}</b> in the room</span>
          <TelemetryPill className="room-head-sync" />
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
              {pendingRequest ? 'Awaiting DJ approval' : 'Request DJ Role'}
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
          <button className="text-btn ghosted" onClick={onLeaveRoom}>
            <DoorOpen size={12} /> Leave
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
          <ShieldCheck size={12} /> {room.members.length} {room.members.length === 1 ? 'member' : 'members'} · manage roles
        </button>
      )}

      <section className={`now-card ${isPlaying ? 'is-playing' : ''}`}>
        <Cover track={track} size="cover-size-hero" showQuality playing={isPlaying} />
        <div className="now-main">
          <div className="now-kicker">
            <span className={isPlaying ? 'live-dot' : ''} style={isPlaying ? { color: room.accent } : undefined} />
            <span>{isPlaying ? 'PLAYING NOW' : 'UP NEXT IN THE ROOM'}</span>
            {pending && <span className="source-badge"><span className="spinner" style={{ width: 8, height: 8 }} /> Tuning</span>}
          </div>

          <h2 className="now-title" title={track?.title}>{track?.title || 'Finding a track…'}</h2>
          <p className="now-artist">
            {track?.artist || 'EchoSync'}
            {track?.album && <><span> · </span><span className="album">{track.album}</span></>}
          </p>

          <div className="listening-block">
            <RoomTimeline
              total={total}
              canControl={canControl}
              onSeek={onSeek}
              onLock={onLock}
              ready={ready}
              linePeople={linePeople}
              members={members}
            />
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
            <TelemetryPill className="room-transport-sync" />
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
            <span>{failed ? 'Source unavailable' : pending ? 'Finding the official source…' : track?.youtubeVideoId && !track?.streamUrl ? 'Full-length stream' : ready ? `Ad-free stream · ${track?.quality || '320 kbps'}` : 'Ready in the room'}</span>
            <span className="dot" />
            <span>{room.members.length} in the room</span>
            <span className={`dot`} />
            <span>{canControl ? 'You have control' : 'Listen-only mode'}</span>
            <span className="grow" />
            {(failed || track?.needsHydration) && (
              <button className="text-btn find-full" onClick={() => onRetryFull(track)}>
                <RefreshCw size={11} /> Retry Full Stream
              </button>
            )}
            <button className={`like-btn ${liked.includes(track?.id) ? 'liked' : ''}`} onClick={() => onLike(track)} aria-label="Like track">
              <Heart />
            </button>
          </div>
        </div>
      </section>

      <div className="section-head">
        <div>
          <h3>The room queue</h3>
          <p>{queue.length
            ? <>Everyone hears the same <b>{queue.length}</b> {queue.length === 1 ? 'track' : 'tracks'} at the same time.</>
            : 'The queue is empty until someone adds a song.'}</p>
        </div>
        <div className="head-actions">
          <button className="text-btn" onClick={onSearch}><Plus /> Add a song</button>
          {canControlRoom && (
            <div className="room-import-wrap">
              <button className="text-btn" onClick={() => setImportOpen((value) => !value)} aria-expanded={importOpen}>
                <ListPlus /> Import playlist
              </button>
              {importOpen && (
                <div className="room-import-popover">
                  <span className="room-import-label">Add a playlist to the room</span>
                  <button
                    onClick={() => {
                      onImportPlaylist?.({ id: 'liked', name: 'Liked songs', trackIds: likedTracks.map((track) => track.id) })
                      setImportOpen(false)
                    }}
                  >
                    <Heart size={12} />
                    <span>Liked songs</span>
                    <b>{likedTracks.length}</b>
                  </button>
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => {
                        onImportPlaylist?.(playlist)
                        setImportOpen(false)
                      }}
                    >
                      <ListMusic size={12} />
                      <span>{playlist.name}</span>
                      <b>{playlist.trackIds.length}</b>
                    </button>
                  ))}
                  {!playlists.length && !likedTracks.length && (
                    <p>No saved playlists yet.</p>
                  )}
                </div>
              )}
            </div>
          )}
          {canControlRoom && queue.length > 0 && (
            <button className="text-btn queue-clear-btn" onClick={onClearQueue}><Trash2 /> Clear queue</button>
          )}
          <span className="source-badge">{queue.length} {queue.length === 1 ? 'track' : 'tracks'}</span>
        </div>
      </div>

      <section className="queue room-queue">
        {queue.length === 0 && (
          <div className="queue-empty room-queue-empty">
            <span className="empty-icon"><ListMusic /></span>
            <strong>The queue is waiting</strong>
            <p>Add the first song and everyone will hear it in sync.</p>
            <button className="text-btn" onClick={onSearch}><Plus size={12} /> Add a song</button>
          </div>
        )}
        {queue.map((item, index) => {
          const active = index === currentIndex
          const itemReady = item?.status === 'ready' && Boolean(item?.streamUrl || item?.youtubeVideoId)
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
                <span className="queue-dur">{itemReady ? formatTime(item.duration) : '—'}</span>
              </div>
              <button
                className={`queue-heart ${liked.includes(item?.id) ? 'liked' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onLike(item)
                }}
                aria-label="Like track"
              >
                <Heart />
              </button>
              <button
                className="queue-more queue-add"
                onClick={(event) => {
                  event.stopPropagation()
                  onAddToPlaylist(item)
                }}
                aria-label="Add to playlist"
                title="Add to playlist"
              >
                <ListPlus />
              </button>
              {canControlRoom && (
                <button
                  className="queue-more queue-remove"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveQueueTrack?.(index)
                  }}
                  aria-label={`Remove ${item?.title || 'track'} from room queue`}
                  title="Remove from room queue"
                >
                  <Trash2 />
                </button>
              )}
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
