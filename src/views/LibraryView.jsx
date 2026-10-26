import { useSocial } from '../components/social/SocialContext.jsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Radio,
  Search,
  Library,
  Plus,
  Heart,
  Play,
  X,
  ListMusic,
  Music2,
  Pencil,
  Trash2,
  Clock3,
  ListPlus,
  Shuffle,
} from 'lucide-react'
import { formatTime } from '../lib/time'
import { Cover } from '../components/Cover'

export function LibraryView({
  searchTracks,
  library,
  liked,
  recentIds,
  playlists,
  currentUser,
  activePlaylistId,
  onSelectPlaylist,
  onPlay,
  onLike,
  onAddToPlaylist,
  onAddToActivePlaylist,
  onSearch,
  onCreatePlaylist,
  onPlayPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onRemoveFromPlaylist,
  onShufflePlaylist,
  onOpenPlaylist,
  onImportPlaylist,
}) {
  const social=useSocial()
  const detailRef = useRef(null)
  useLayoutEffect(() => { if (activePlaylistId) detailRef.current?.closest('.stage-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }, [activePlaylistId])
  const [tab, setTab] = useState('playlists')
  const [playlistQuery, setPlaylistQuery] = useState('')
  const [playlistResults, setPlaylistResults] = useState([])
  const [playlistSearchStatus, setPlaylistSearchStatus] = useState('idle')
  const likedTracks = liked.map((id) => library[id]).filter(Boolean)
  const recent = recentIds.map((id) => library[id]).filter(Boolean)
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) || null
  const playlistTracks = activePlaylist ? activePlaylist.trackIds.map((id) => library[id]).filter(Boolean) : []

  useEffect(() => {
    if (activePlaylistId) setTab('playlists')
  }, [activePlaylistId])

  useEffect(() => {
    setPlaylistQuery('')
    setPlaylistResults([])
    setPlaylistSearchStatus('idle')
  }, [activePlaylistId])

  useEffect(() => {
    const trimmed = playlistQuery.trim()
    if (!activePlaylist || trimmed.length < 2) {
      setPlaylistResults([])
      setPlaylistSearchStatus('idle')
      return undefined
    }
    let cancelled = false
    setPlaylistSearchStatus('loading')
    const timer = setTimeout(() => {
      searchTracks(trimmed)
        .then((tracks) => {
          if (cancelled) return
          const existing = new Set(activePlaylist.trackIds)
          setPlaylistResults(tracks.filter((track) => !existing.has(track.id)).slice(0, 8))
          setPlaylistSearchStatus('ready')
        })
        .catch(() => {
          if (!cancelled) setPlaylistSearchStatus('error')
        })
    }, 340)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTracks, playlistQuery, activePlaylist])

  return (
    <div className={`library-view ${activePlaylist ? 'has-playlist-detail' : ''}`}>
      <header className="library-hero">
      <div className="eyebrow">
        <span className="live-pill"><Library size={9} /> YOUR LIBRARY</span>
        <span className="seg" />
        <span>{playlists.length} PLAYLISTS · {likedTracks.length} LIKED</span>
      </div>
      <h1 className="page-title">Everything that sounds like <em>you.</em></h1>
      <p className="page-sub">Your playlists, your liked songs, and the music you keep returning to. All in one place.</p>

      </header>

      {activePlaylist ? (
        <section ref={detailRef} className="playlist-detail">
          <button className="text-btn" onClick={() => onSelectPlaylist(null)}>← Back to Library</button>
          <div className="playlist-detail-head">
            <div className="playlist-mosaic large">
              {playlistTracks.slice(0, 4).map((cover) => (
                <span key={cover.id} style={cover.cover ? { backgroundImage: `url(${cover.cover})` } : { background: `linear-gradient(135deg, ${cover.c1}, ${cover.c2})` }} />
              ))}
              {!playlistTracks.length && <span className="mosaic-empty"><ListMusic /></span>}
            </div>
            <div className="playlist-detail-copy">
              <span className="eyebrow"><span className="seg" /> PLAYLIST</span>
              <h2>{activePlaylist.name}</h2>
              <p>{activePlaylist.description || `Made by ${currentUser?.name || 'you'} · ${playlistTracks.length} track${playlistTracks.length === 1 ? '' : 's'}`}</p>
              <div className="playlist-detail-actions"><button className="text-btn" aria-label="Playlist visibility" onClick={()=>social.toggleVisibility(activePlaylist.id)}>{activePlaylist.visibility==='private'?'🔒 Private':'🌐 Public'}</button>
                <button className="primary-btn" disabled={!playlistTracks.length} onClick={() => onPlayPlaylist(activePlaylist)}><Play /> Play</button>
                <button className="text-btn" disabled={!playlistTracks.length} onClick={() => onShufflePlaylist(activePlaylist)}><Shuffle size={12} /> Shuffle</button>
                <details className="playlist-actions-menu"><summary aria-label="Playlist actions">More</summary>
                <button className="text-btn" disabled={!playlistTracks.length} onClick={() => onImportPlaylist?.(activePlaylist)}><Radio size={12} /> Add to Room</button>
                <button className="text-btn" onClick={() => onRenamePlaylist(activePlaylist)}><Pencil size={12} /> Edit</button>
                <button className="text-btn danger-btn" onClick={() => onDeletePlaylist(activePlaylist)}><Trash2 size={12} /> Delete</button>
                </details>
              </div>
            </div>
          </div>

          <div className="playlist-quick-add">
            <form className="playlist-search" onSubmit={(event) => event.preventDefault()}>
              <Search size={14} />
              <input
                value={playlistQuery}
                onChange={(event) => setPlaylistQuery(event.target.value)}
                placeholder="Find a song to add to this playlist..."
                aria-label="Search songs to add to playlist"
              />
              {playlistSearchStatus === 'loading' && <span className="spinner" />}
              <button type="button" className="text-btn playlist-global-search" onClick={onSearch}>
                <Search size={12} /> Global search
              </button>
            </form>
            {playlistSearchStatus === 'ready' && playlistResults.length > 0 && (
              <div className="playlist-search-results">
                {playlistResults.map((track) => (
                  <div key={track.id} className="playlist-search-row">
                    <Cover track={track} size="cover-size-sm" />
                    <div className="queue-copy">
                      <strong>{track.title}</strong>
                      <span>{track.artist}</span>
                    </div>
                    <span className="dur">{formatTime(track.duration)}</span>
                    <button
                      className="search-save"
                      onClick={() => onAddToActivePlaylist(track)}
                      aria-label="Add to this playlist"
                      title="Add to this playlist"
                    >
                      <Plus />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {playlistSearchStatus === 'ready' && playlistResults.length === 0 && (
              <p className="playlist-search-note">No new songs matched that search. Try another title or artist.</p>
            )}
            {playlistSearchStatus === 'error' && (
              <p className="playlist-search-note">Search is unavailable right now. Try again in a moment.</p>
            )}
          </div>

          <div className="library-list">
            {playlistTracks.length === 0 ? (
              <div className="library-empty">
                <span className="empty-icon"><ListMusic /></span>
                <h4>This playlist is waiting</h4>
                <p>Search above for a song, then tap + to add it here.</p>
                <button className="text-btn" onClick={onSearch}><Search size={12} /> Find songs</button>
              </div>
            ) : playlistTracks.map((track, index) => (
                <div className="library-row" key={track.id} role="button" tabIndex={0} onClick={() => onPlay(track, playlistTracks)} onKeyDown={event => {if(event.target === event.currentTarget && ['Enter',' '].includes(event.key)){event.preventDefault();onPlay(track,playlistTracks)}}}>
                <span className="num">{String(index + 1).padStart(2, '0')}</span>
                <Cover track={track} size="cover-size-sm" />
                <div className="queue-copy">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </div>
                <span className="album">{track.album || 'Single'}</span>
                <span className="dur">{formatTime(track.duration)}</span>
                <button
                  className="queue-heart queue-add"
                  onClick={(event) => { event.stopPropagation(); onAddToPlaylist(track) }}
                  aria-label="Add to playlist"
                  title="Add to playlist"
                >
                  <ListPlus />
                </button>
                <button
                  className="queue-heart"
                  onClick={(event) => { event.stopPropagation(); onRemoveFromPlaylist(activePlaylist.id, track.id) }}
                  aria-label="Remove from playlist"
                  title="Remove from playlist"
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="library-tabs">
            <button className={tab === 'playlists' ? 'active' : ''} onClick={() => setTab('playlists')}><ListMusic /> Playlists</button>
            <button className={tab === 'liked' ? 'active' : ''} onClick={() => setTab('liked')}><Heart /> Liked songs</button>
            <button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}><Clock3 /> Recently played</button>
            <span className="grow" />
            <div className="library-head-actions">
              {tab === 'liked' && likedTracks.length > 0 && (
                <button
                  className="text-btn"
                  onClick={() => onImportPlaylist?.({ id: 'liked', name: 'Liked songs', trackIds: likedTracks.map((track) => track.id) })}
                >
                  <Radio size={12} /> Add Liked to Room
                </button>
              )}
              <button className="text-btn" onClick={onCreatePlaylist}><Plus /> New playlist</button>
            </div>
          </div>

          {tab === 'playlists' && (
            playlists.length === 0 ? (
              <div className="library-empty">
                <span className="empty-icon"><ListMusic /></span>
                <h4>No playlists yet</h4>
                <p>Create one and start collecting the songs that matter.</p>
                <button className="primary-btn" onClick={onCreatePlaylist}><Plus /> Create playlist</button>
              </div>
            ) : (
              <div className="playlist-grid library-grid">
                {playlists.map((playlist) => {
                  const covers = playlist.trackIds.map((id) => library[id]).filter(Boolean).slice(0, 4)
                  return (
                    <button key={playlist.id} className="playlist-card" onClick={() => onOpenPlaylist(playlist)}>
                      <div className="playlist-mosaic">
                        {covers.length ? covers.map((cover) => (
                          <span key={cover.id} style={cover.cover ? { backgroundImage: `url(${cover.cover})` } : { background: `linear-gradient(135deg, ${cover.c1}, ${cover.c2})` }} />
                        )) : <span className="mosaic-empty"><Music2 /></span>}
                      </div>
                      <span
                        className="playlist-room-btn"
                        role="button"
                        tabIndex={0}
                        title="Add playlist to Room"
                        aria-label={`Add ${playlist.name} to Room`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onImportPlaylist?.(playlist)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          event.stopPropagation()
                          onImportPlaylist?.(playlist)
                        }}
                      >
                        <Radio size={11} />
                      </span>
                      <span role="button" tabIndex={0} className="playlist-visibility" aria-label={`Visibility of ${playlist.name}`} onClick={event=>{event.stopPropagation();social.toggleVisibility(playlist.id)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();social.toggleVisibility(playlist.id)}}}>{playlist.visibility==='private'?'🔒 Private':'🌐 Public'}</span><strong>{playlist.name}</strong>
                      <span>{playlist.trackIds.length} track{playlist.trackIds.length === 1 ? '' : 's'}</span>
                      {playlist.trackIds.length > 0 && <em onClick={(event) => { event.stopPropagation(); onPlayPlaylist(playlist) }} role="button" tabIndex={0}>
                        <Play size={11} /> Play
                      </em>}
                    </button>
                  )
                })}
              </div>
            )
          )}

          {tab === 'liked' && (
            <div className="library-list">
              {likedTracks.length === 0 ? (
                <div className="library-empty">
                  <span className="empty-icon"><Music2 /></span>
                  <h4>Your liked songs live here</h4>
                  <p>Tap the heart on any song to save it.</p>
                  <button className="text-btn" onClick={onSearch}><Search size={12} /> Find something new</button>
                </div>
              ) : likedTracks.map((track, index) => (
              <div className="library-row" key={track.id} role="button" tabIndex={0} onClick={() => onPlay(track, playlistTracks)}>
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <Cover track={track} size="cover-size-sm" />
                  <div className="queue-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                  </div>
                  <span className="album">{track.album || 'Single'}</span>
                  <span className="dur">{formatTime(track.duration)}</span>
                  <button className="queue-heart queue-add" onClick={(event) => { event.stopPropagation(); onAddToPlaylist(track) }} aria-label="Add to playlist" title="Add to playlist">
                    <ListPlus />
                  </button>
                  <button className="queue-heart liked" onClick={(event) => { event.stopPropagation(); onLike(track) }} aria-label="Unlike track">
                    <Heart />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'recent' && (
            <div className="library-list">
              {recent.length === 0 ? (
                <div className="library-empty">
                  <span className="empty-icon"><Clock3 /></span>
                  <h4>Nothing played yet</h4>
                  <p>Songs you play will show up here.</p>
                  <button className="text-btn" onClick={onSearch}><Search size={12} /> Play something</button>
                </div>
              ) : recent.map((track, index) => (
                <div className="library-row" key={`${track.id}-${index}`} role="button" tabIndex={0} onClick={() => onPlay(track, recent)}>
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <Cover track={track} size="cover-size-sm" />
                  <div className="queue-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                  </div>
                  <span className="album">{track.album || 'Single'}</span>
                  <span className="dur">{formatTime(track.duration)}</span>
                  <button className="queue-heart queue-add" onClick={(event) => { event.stopPropagation(); onAddToPlaylist(track) }} aria-label="Add to playlist" title="Add to playlist">
                    <ListPlus />
                  </button>
                  <button className={`queue-heart ${liked.includes(track.id) ? 'liked' : ''}`} onClick={(event) => { event.stopPropagation(); onLike(track) }} aria-label="Like track">
                    <Heart />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
