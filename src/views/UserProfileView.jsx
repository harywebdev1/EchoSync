import { useMemo } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Globe2,
  Headphones,
  Heart,
  ListMusic,
  Lock,
  Pencil,
  Play,
  Radio,
  Settings,
  Share2,
  UserPlus,
  Users,
} from 'lucide-react'
import { ArtistLinks } from '../components/ArtistLinks.jsx'
import { Avatar } from '../components/Avatar'
import { Cover } from '../components/Cover'
import { displayNameFromHandle } from '../lib/appServices.js'
import { normalizeHandle } from '../lib/router.js'
import { formatTime } from '../lib/time'

function uniqueTracks(list) {
  const seen = new Set()
  return list.filter((track) => {
    if (!track?.id || seen.has(track.id)) return false
    seen.add(track.id)
    return true
  })
}

function ChannelSongs({ title, tracks, liked, onPlay, onQueue, onLike, onOpenArtist, empty }) {
  if (!tracks.length) {
    return empty ? (
      <section className="profile-section" aria-label={title}>
        <div className="profile-section-head"><h2>{title}</h2></div>
        <p className="channel-empty-note">{empty}</p>
      </section>
    ) : null
  }
  return (
    <section className="profile-section" aria-label={title}>
      <div className="profile-section-head"><h2>{title}</h2><span className="profile-section-count"><Headphones size={13} /> {tracks.length}</span></div>
      <div className="channel-song-list">
        {tracks.map((song) => (
          <div
            className="channel-song-row"
            key={song.id}
            role="button"
            tabIndex={0}
            onClick={() => onPlay?.(song, tracks)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onPlay?.(song, tracks)
              }
            }}
          >
            <Cover track={song} size="cover-size-sm" />
            <div className="channel-song-copy">
              <strong>{song.title}</strong>
              <span><ArtistLinks track={song} onOpenArtist={onOpenArtist} /></span>
            </div>
            <span className="channel-song-album">{song.album || 'Single'}</span>
            <span className="channel-song-duration">{song.duration ? formatTime(song.duration) : '—'}</span>
            <button
              className={`channel-song-icon ${liked.includes(song.id) ? 'liked' : ''}`}
              onClick={(event) => { event.stopPropagation(); onLike?.(song) }}
              aria-label={liked.includes(song.id) ? `Unlike ${song.title}` : `Like ${song.title}`}
            >
              <Heart fill={liked.includes(song.id) ? 'currentColor' : 'none'} />
            </button>
            <button
              className="channel-song-icon"
              onClick={(event) => { event.stopPropagation(); onQueue?.(song) }}
              aria-label={`Add ${song.title} to queue`}
              title="Add to queue"
            >
              <ListMusic />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function PlaylistCard({ playlist, onPlay }) {
  const [first] = playlist.tracks || []
  const locked = playlist.visibility === 'private'
  return (
    <article className="channel-playlist-card">
      <span className="channel-playlist-cover">
        {first ? <Cover track={first} size="" /> : <MusicPlaceholder />}
        {locked && <span className="channel-playlist-lock"><Lock size={12} /> Private</span>}
      </span>
      <strong>{playlist.name}</strong>
      <small>{playlist.tracks?.length || 0} {(playlist.tracks?.length || 0) === 1 ? 'song' : 'songs'}</small>
      <button
        type="button"
        className="channel-playlist-play"
        disabled={locked || !playlist.tracks?.length}
        onClick={() => onPlay?.(playlist)}
      >
        <Play /> Play
      </button>
    </article>
  )
}

function MusicPlaceholder() {
  return <span className="channel-playlist-placeholder"><ListMusic /></span>
}

export function UserProfileView({
  profile,
  currentUser,
  members = {},
  rooms = [],
  playlists = [],
  library = {},
  liked = [],
  recentIds = [],
  track,
  profileFor,
  onBack,
  onPlay,
  onQueue,
  onLike,
  onJoinRoom,
  onOpenSettings,
  onOpenArtist,
  onInvite,
  showToast,
}) {
  const handle = normalizeHandle(profile?.handle || '')
  const member = useMemo(() => {
    const directory = Object.values(members || {}).filter(Boolean)
    return directory.find((entry) => normalizeHandle(entry.handle) === handle)
      || (normalizeHandle(currentUser?.handle) === handle ? currentUser : null)
  }, [members, currentUser, handle])

  const isOwn = Boolean(currentUser && (member?.id === currentUser.id || normalizeHandle(currentUser.handle) === handle))
  const userId = member?.id || (isOwn ? currentUser?.id : '') || ''
  const live = useMemo(() => {
    if (!userId || !profileFor) return null
    try { return profileFor(userId) } catch { return null }
  }, [userId, profileFor])

  const name = member?.name || displayNameFromHandle(handle)
  const avatar = member || { name, handle, initials: name.slice(0, 2).toUpperCase(), av1: '#7c5cff', av2: '#31d7c6' }
  const bio = member?.bio || (isOwn ? 'Your music, your rotation, your listening community.' : 'EchoSync listener.')

  const rotation = useMemo(() => {
    if (isOwn) return uniqueTracks([...recentIds, ...liked].map((id) => library[id]).filter(Boolean)).slice(0, 10)
    return uniqueTracks(live?.rotation || []).slice(0, 10)
  }, [isOwn, recentIds, liked, library, live])

  const channelPlaylists = useMemo(() => {
    if (isOwn) {
      return playlists.map((playlist) => ({
        ...playlist,
        tracks: (playlist.trackIds || []).map((id) => library[id]).filter(Boolean),
      }))
    }
    return (live?.playlists || []).map((playlist) => ({ ...playlist, tracks: playlist.tracks || [] }))
  }, [isOwn, playlists, library, live])

  const hostedRooms = useMemo(() => {
    if (!userId) return []
    return rooms.filter((room) => {
      if (!room || room.private || room.isPrivate) return false
      const owner = room.ownerId || room.createdBy || room.dj
      return owner === userId
    })
  }, [rooms, userId])

  const activity = isOwn
    ? (track && track.id !== 'empty' ? track : null)
    : (live?.activity || null)

  const stats = [
    { label: 'Playlists', value: channelPlaylists.length },
    { label: 'Liked songs', value: isOwn ? liked.length : (live?.likedCount ?? 0) },
    { label: 'Rooms hosted', value: hostedRooms.length },
  ]

  const share = async () => {
    const url = typeof window === 'undefined'
      ? `/@${handle}`
      : `${window.location.origin}/@${encodeURIComponent(handle)}`
    try {
      await navigator.clipboard.writeText(url)
      showToast?.('Channel link copied')
    } catch {
      showToast?.('Could not copy the channel link')
    }
  }

  if (!handle || (!member && !isOwn)) {
    return (
      <div className="channel-page" data-testid="user-profile">
        <div className="channel-header">
          <button className="profile-back" onClick={onBack} data-testid="profile-back"><ArrowLeft /> Back</button>
          <div className="profile-empty" role="status">
            <Users />
            <h2>This channel is not here.</h2>
            <p>The handle @{handle || 'unknown'} does not belong to a listener yet.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="channel-page"
      data-testid="user-profile"
      style={{ '--channel-av1': avatar.av1 || '#7c5cff', '--channel-av2': avatar.av2 || '#31d7c6' }}
    >
      <header className="channel-header">
        <div className="channel-wash" aria-hidden="true" />
        <button className="profile-back" onClick={onBack} data-testid="profile-back"><ArrowLeft /> Back</button>
        <div className="channel-identity">
          <span className="channel-avatar">
            <Avatar member={avatar} />
            {member?.online && <i className="channel-online" />}
          </span>
          <div className="channel-copy">
            <span className="channel-kicker"><Globe2 size={12} /> Listener channel</span>
            <h1 className="channel-name">
              {name}
              {member?.cloud && <BadgeCheck className="channel-verified" aria-label="Verified listener" />}
            </h1>
            <span className="channel-handle-pill">@{handle}</span>
            <p className="channel-bio">{bio}</p>
            <div className="channel-stats">
              {stats.map((stat) => (
                <span key={stat.label}><b>{stat.value}</b> {stat.label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="channel-actions">
          {isOwn ? (
            <>
              <button className="channel-action primary" onClick={onOpenSettings}><Pencil /> Edit profile</button>
              <button className="channel-action glass" onClick={onOpenSettings}><Settings /> Settings</button>
            </>
          ) : (
            <button className="channel-action primary" onClick={() => onInvite?.(member)}><UserPlus /> Invite to room</button>
          )}
          <button className="channel-action glass" onClick={share}><Share2 /> Share channel</button>
        </div>
      </header>

      {activity && (
        <div className="channel-live" data-testid="channel-live">
          <span className="channel-live-dot" />
          <div>
            <span className="channel-live-label">🎧 Listening to</span>
            <strong>{activity.title}</strong>
            <small> · <ArtistLinks track={activity} onOpenArtist={onOpenArtist} /></small>
          </div>
          <button className="channel-live-play" onClick={() => onPlay?.(activity, [activity], { radio: true })}><Play /> Listen along</button>
        </div>
      )}

      <div className="channel-body">
        <ChannelSongs
          title="Songs on repeat"
          tracks={rotation}
          liked={liked}
          onPlay={onPlay}
          onQueue={onQueue}
          onLike={onLike}
          onOpenArtist={onOpenArtist}
          empty={isOwn ? 'Play a few songs and your repeat rotation appears here.' : 'No public listening activity right now.'}
        />

        <section className="profile-section" aria-label="Public playlists">
          <div className="profile-section-head">
            <h2>Public playlists</h2>
            <span className="profile-section-count"><ListMusic size={13} /> {channelPlaylists.filter((playlist) => playlist.visibility !== 'private').length}</span>
          </div>
          {channelPlaylists.length ? (
            <div className="channel-playlist-row">
              {channelPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id || playlist.name}
                  playlist={playlist}
                  onPlay={(item) => {
                    const tracks = item.tracks || []
                    if (tracks[0]) onPlay?.(tracks[0], tracks)
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="channel-empty-note">{isOwn ? 'Create a playlist and share it from your channel.' : 'No public playlists shared yet.'}</p>
          )}
        </section>

        <section className="profile-section" aria-label="Listening rooms">
          <div className="profile-section-head">
            <h2>Listening rooms</h2>
            <span className="profile-section-count"><Radio size={13} /> {hostedRooms.length}</span>
          </div>
          {hostedRooms.length ? (
            <div className="channel-room-row">
              {hostedRooms.map((room) => (
                <article className="channel-room-card" key={room.id}>
                  <span className="channel-room-glyph" style={{ '--room-accent': room.accent || avatar.av1 }}>
                    <Radio />
                  </span>
                  <div>
                    <strong>{room.name}</strong>
                    <small>{room.members?.length || 0} {(room.members?.length || 0) === 1 ? 'listener' : 'listeners'} · {(room.trackIds || []).length} songs</small>
                  </div>
                  <button className="channel-room-join" onClick={() => onJoinRoom?.(room)}>
                    <Play /> Join
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="channel-empty-note">{isOwn ? 'Host a room and it will show up on your channel.' : 'No public rooms hosted right now.'}</p>
          )}
        </section>
      </div>
    </div>
  )
}
