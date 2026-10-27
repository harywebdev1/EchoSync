import { useSocial } from '../components/social/SocialContext.jsx'
import { MemberDrift, RoomVote } from '../components/social/RoomSocialControls.jsx'
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

export function RoomView({
  room,
  starterTracks = [], onStartTrack,
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
  onImportPlaylist, onResync,
}) {
  const social = useSocial()
  const [importOpen, setImportOpen] = useState(false)
  const members = useMembers()
  const words = room.name.split(' ')
  const lastWord = words.pop()
  const linePeople = room.members
    .filter((id) => id !== currentUser?.id && members[id]?.showActivity !== false)
    .slice(0, 4)
  const total = duration || track?.duration || 0
  const hasTrack = Boolean(queue.length && track?.id && !['empty', 'room-empty'].includes(track.id))
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
          {requestable && (
            <button
              className={`text-btn ${pendingRequest ? 'ghosted' : ''}`}
              onClick={() => onRequestRole(requestable)}
              disabled={Boolean(pendingRequest)}
              title={pendingRequest ? `${pendingRequest.requested} access pending approval` : undefined}
            >
              {pendingRequest ? <Check size={12} /> : <ShieldCheck size={12} />}
              {pendingRequest ? 'DJ role requested' : 'Request DJ Role'}
            </button>
          )}
          <button className="text-btn" onClick={onOpenMembers}>
            <UsersRound size={12} /> {room.members.length} {room.members.length === 1 ? 'member' : 'members'} · Manage roles
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

      {!hasTrack ? <section className="room-stage-empty"><h2>Room stage is ready</h2><p>Pick a starter song below or search above to kick off the session</p><div className="room-starters">{starterTracks.slice(0,4).map(item => <button key={item.id} disabled={!canControlRoom} onClick={() => onStartTrack(item)}><Cover track={item} /><strong>{item.title}</strong><span>{item.artist}</span><Play size={16} /></button>)}</div></section> : <section className={`now-card ${isPlaying ? 'is-playing' : ''}`}>
        <Cover track={track} size="cover-size-hero" playing={isPlaying} />
        <div className="now-main">
          <div className="now-kicker">
            <span className={isPlaying ? 'live-dot' : ''} style={isPlaying ? { color: room.accent } : undefined} />
            <span>NOW SPINNING IN ROOM</span>
            {pending && <span className="source-badge"><span className="spinner" style={{ width: 8, height: 8 }} /> Tuning</span>}
          </div>

          <h2 className="now-title" title={track?.title}>{track?.title || 'Finding a track…'}</h2>
          <p className="now-artist">
            {track?.artist || 'EchoSync'}
            {track?.album && <><span> · </span><span className="album">{track.album}</span></>}
          </p>

          <div className="room-stage-attribution">
            Hosted by {members[room.ownerId || room.dj || room.createdBy]?.name || 'the room admin'}
            <span className="host-badge">Admin</span>
            <span className="attribution-you">· You are {ROLE_COPY[role]?.label}</span>
          </div>
          <div className="room-sync-actions"><TelemetryPill className="room-transport-sync" /><button className="text-btn" onClick={onResync}><RefreshCw size={14} /> Resync</button><button className="text-btn" onClick={onOpenFull}><Maximize2 size={14} /> Open full player</button></div>
          <div className="now-foot">
            <span>{failed ? 'Source unavailable' : pending ? 'Finding the official source…' : track?.youtubeVideoId && !track?.streamUrl ? 'Full-length stream' : ready ? `Ad-free stream · ${track?.quality || '320 kbps'}` : 'Ready in the room'}</span>
            <span className="dot" />
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
      </section>}

      <div className="room-member-strip" aria-label="Room member sync">
        {room.members.map((id) => {
          const request = role === 'admin' ? (roleRequests || []).find((item) => item.userId === id) : null
          return (
            <div className="room-member-wrap" key={id}>
              {request && (
                <div className="inline-role-request" role="status">
                  <span>Wants {request.requested === 'admin' ? 'Admin' : 'DJ'} role</span>
                  <button type="button" className="inline-role-accept" onClick={() => onResolveRequest(request.id, true)} aria-label="Accept role request"><Check size={11} /> Accept</button>
                  <button type="button" className="inline-role-decline" onClick={() => onResolveRequest(request.id, false)} aria-label="Decline role request"><X size={11} /></button>
                </div>
              )}
              <button className="room-member" onClick={() => social.openProfile(id)} aria-label={`Open ${members[id]?.name || id}'s profile`}>
                <Avatar member={members[id]} size="sm" />
                <span>{members[id]?.name || id}</span>
                <MemberDrift roomId={room.id} userId={id} />
              </button>
            </div>
          )
        })}
        {canControlRoom && <button className="text-btn" onClick={social.forceResync}>⚡ Sync All</button>}
      </div>
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
        {queue.map((item, index) => ({item,index})).filter(({index}) => index >= currentIndex).map(({item,index}) => {
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
              {index > currentIndex && <RoomVote room={room} trackId={item.id}/>}
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
