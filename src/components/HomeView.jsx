import { useMemo, useState } from 'react'
import { ArrowRight, ListPlus, Music2, Play, Plus, Radio, RefreshCw, Search, Sparkles } from 'lucide-react'
import { Cover } from './Cover'
import { SkeletonShelf, TrackCard } from './TrackCard'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music' },
  { id: 'for-you', label: 'For You' },
  { id: 'chill', label: 'Chill' },
  { id: 'focus', label: 'Focus' },
]

const CHILL_PATTERN = /(chill|slow|lofi|lo-fi|acoustic|soft|night|moon|raat|dil|sukoon|peace|calm|dream)/i
const FOCUS_PATTERN = /(instrumental|piano|ambient|focus|study|theme|score|soundtrack|classical|meditat)/i

function uniqueTracks(tracks) {
  const seen = new Set()
  return tracks.filter((track) => {
    if (!track?.id || seen.has(track.id)) return false
    seen.add(track.id)
    return true
  })
}

function fillTracks(primary, fallback, limit = 6) {
  return uniqueTracks([...primary, ...fallback]).slice(0, limit)
}

function Shelf({ title, eyebrow, tracks, liked, playingId, onPlay, onLike }) {
  if (!tracks.length) return null
  return (
    <section className="home-section home-shelf">
      <div className="home-section-head">
        <div>
          {eyebrow && <span className="home-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <span className="shelf-count">{tracks.length} tracks</span>
      </div>
      <div className="shelf-scroll">
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            liked={liked.includes(track.id)}
            playing={playingId === track.id}
            onPlay={() => onPlay(track, tracks)}
            onLike={onLike}
          />
        ))}
      </div>
    </section>
  )
}

export function HomeView({
  currentUser,
  library,
  liked = [],
  recentIds = [],
  playlists = [],
  dailyFeed,
  dailyStatus,
  tasteProfile,
  onOpenTaste,
  onRefreshDaily,
  roomCount = 0,
  onPlayTrack,
  onPlayPlaylist,
  onLike,
  onAddToPlaylist,
  onSearch,
  onCreatePlaylist,
  onOpenPlaylist,
  onCreateRoom,
}) {
  const [filter, setFilter] = useState('all')
  const recent = uniqueTracks(recentIds.map((id) => library[id]).filter(Boolean))
  const dailyUser = dailyFeed?.users?.[currentUser?.id || 'guest'] || {}
  const madeForYou = Array.isArray(dailyUser.madeForYou) ? dailyUser.madeForYou : []
  const basedOnRecent = Array.isArray(dailyUser.basedOnRecent) ? dailyUser.basedOnRecent : []
  const trending = Array.isArray(dailyFeed?.trending) ? dailyFeed.trending : []
  const firstName = currentUser?.name?.trim().split(/\s+/)[0] || ''
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()
  const loading = dailyStatus === 'loading'

  const allTracks = useMemo(
    () => uniqueTracks([...madeForYou, ...recent, ...basedOnRecent, ...trending]),
    [madeForYou, recent, basedOnRecent, trending],
  )
  const quickTracks = useMemo(() => {
    if (filter === 'music') return fillTracks(trending, allTracks)
    if (filter === 'for-you') return fillTracks(madeForYou, allTracks)
    if (filter === 'chill') return fillTracks(allTracks.filter((track) => CHILL_PATTERN.test(`${track.title} ${track.artist} ${track.album || ''}`)), allTracks)
    if (filter === 'focus') return fillTracks(allTracks.filter((track) => FOCUS_PATTERN.test(`${track.title} ${track.artist} ${track.album || ''}`)), allTracks)
    return fillTracks(allTracks, recent)
  }, [filter, trending, madeForYou, allTracks, recent])

  const madeShelf = madeForYou.length ? madeForYou.slice(0, 10) : trending.slice(0, 10)
  const freshShelf = basedOnRecent.length
    ? basedOnRecent.slice(0, 10)
    : trending.slice(3).concat(trending.slice(0, 3)).slice(0, 10)
  const playingId = recent[0]?.id || ''

  return (
    <div className="home-view home-v2" data-testid="home-v2">
      <header className="home-top">
        <div>
          <span className="home-kicker">{greeting}</span>
          <h1 className="home-greeting">{firstName ? <>Welcome back, <em>{firstName}</em>.</> : 'Find your next favorite.'}</h1>
          <p className="home-sub">Your recent rotation, fresh picks, and rooms that listen together.</p>
        </div>
        <div className="home-top-actions">
          <button className="home-search-btn" onClick={onSearch}><Search /> Search</button>
          <button className="home-room-btn" onClick={onCreateRoom}><Radio /> {roomCount > 0 ? `${roomCount} live room${roomCount === 1 ? '' : 's'}` : 'Start a room'}</button>
        </div>
      </header>

      <div className="home-chips" role="group" aria-label="Quick access filter">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            className={`home-chip ${filter === item.id ? 'active' : ''}`}
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            data-filter={item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="quick-grid" data-testid="quick-grid">
        {quickTracks.map((track, index) => (
          <button
            type="button"
            className="quick-card"
            key={track.id}
            onClick={() => onPlayTrack(track, quickTracks)}
            style={{ '--quick-delay': `${index * 35}ms` }}
          >
            <span className="quick-art"><Cover track={track} size="" /></span>
            <span className="quick-copy">
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </span>
            <span className="quick-play"><Play /></span>
          </button>
        ))}
        {!quickTracks.length && loading && Array.from({ length: 6 }, (_, index) => (
          <span className="quick-card quick-skeleton" key={index}>
            <span className="quick-art" />
            <span className="quick-copy"><i /><i /></span>
          </span>
        ))}
      </div>

      {recent.length > 0 && (
        <Shelf
          title="Jump back in"
          eyebrow="Recently played"
          tracks={recent.slice(0, 10)}
          liked={liked}
          playingId={playingId}
          onPlay={onPlayTrack}
          onLike={onLike}
        />
      )}

      <section className="home-section home-shelf">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">Picked for your taste</span>
            <h2>{firstName ? `Made for ${firstName}` : 'Made for you'}</h2>
          </div>
          <button className="text-btn shelf-action" onClick={onRefreshDaily} disabled={loading}>
            <RefreshCw className={loading ? 'spin' : ''} size={13} /> Refresh
          </button>
        </div>
        {loading && !madeShelf.length ? (
          <SkeletonShelf />
        ) : madeShelf.length ? (
          <div className="shelf-scroll">
            {madeShelf.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                liked={liked.includes(track.id)}
                playing={playingId === track.id}
                onPlay={() => onPlayTrack(track, madeShelf)}
                onLike={onLike}
              />
            ))}
          </div>
        ) : (
          <div className="home-empty">
            <span className="empty-icon"><Sparkles /></span>
            <div><strong>Your mix is warming up</strong><span>Play a few songs and this shelf will start learning your taste.</span></div>
            <button className="text-btn" onClick={onSearch}><Search size={12} /> Find music</button>
          </div>
        )}
      </section>

      <Shelf
        title="Trending now"
        eyebrow="Today's rotation"
        tracks={trending.slice(0, 10)}
        liked={liked}
        playingId={playingId}
        onPlay={onPlayTrack}
        onLike={onLike}
      />

      {(freshShelf.length > 0 || recent.length > 0) && (
        <Shelf
          title="Fresh discoveries"
          eyebrow="New lanes from your listening"
          tracks={freshShelf}
          liked={liked}
          playingId={playingId}
          onPlay={onPlayTrack}
          onLike={onLike}
        />
      )}

      {(!tasteProfile || tasteProfile.events === 0) && (
        <section className="home-taste-card">
          <span className="taste-card-icon"><Sparkles /></span>
          <div>
            <strong>Shape what you hear next</strong>
            <span>Pick a few vibes so recommendations feel more like you.</span>
          </div>
          <button className="text-btn" onClick={onOpenTaste}>Tune your taste <ArrowRight size={13} /></button>
        </section>
      )}

      <section className="home-section home-playlists">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">Your library</span>
            <h2>Playlists</h2>
          </div>
          <button className="text-btn shelf-action" onClick={onCreatePlaylist}><Plus size={13} /> New playlist</button>
        </div>
        {playlists.length === 0 ? (
          <button className="playlist-create-card" onClick={onCreatePlaylist}>
            <ListPlus />
            <strong>Make your first playlist</strong>
            <span>Name it, add songs, make it yours.</span>
          </button>
        ) : (
          <div className="playlist-grid">
            {playlists.map((playlist) => {
              const covers = playlist.trackIds.map((id) => library[id]).filter(Boolean).slice(0, 4)
              return (
                <button key={playlist.id} className="playlist-card" onClick={() => onOpenPlaylist(playlist)}>
                  <div className="playlist-mosaic">
                    {covers.length ? covers.map((cover) => (
                      <span key={cover.id} style={cover.cover ? { backgroundImage: `url(${cover.cover})` } : { background: `linear-gradient(135deg, ${cover.c1}, ${cover.c2})` }} />
                    )) : <span className="mosaic-empty"><Music2 /></span>}
                  </div>
                  <strong>{playlist.name}</strong>
                  <span>{playlist.trackIds.length} track{playlist.trackIds.length === 1 ? '' : 's'}</span>
                  <em onClick={(event) => { event.stopPropagation(); onPlayPlaylist(playlist) }} role="button" tabIndex={0}>
                    <Play size={11} /> Play
                  </em>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
