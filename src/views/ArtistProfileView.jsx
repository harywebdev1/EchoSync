import { createPortal } from 'react-dom'
import { ModalShell } from '../components/modals/ModalShell.jsx'
import { distinctAlbum } from '../core/songDisplay.js'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Disc3,
  Heart,
  ListPlus,
  Play,
  Radio,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react'
import { ArtistLinks } from '../components/ArtistLinks.jsx'
import { Cover } from '../components/Cover'
import { fetchYtArtist, fetchYtAlbum } from '../lib/appServices.js'
import { formatTime } from '../lib/time'

const WIDE_SIZE = '=w1280-h532-l90-rj'
const SQUARE_SIZE = '=w544-h544-l90-rj'

function wideArtwork(url = '') {
  const raw = String(url || '').trim()
  if (!raw || !/googleusercontent\.com|ytimg\.com/.test(raw)) return raw
  if (/=w\d+-h\d+/.test(raw)) return raw.replace(/=w\d+-h\d+[^?]*$/, WIDE_SIZE)
  return `${raw}${WIDE_SIZE}`
}

function squareArtwork(url = '') {
  const raw = String(url || '').trim()
  if (!raw || !/googleusercontent\.com|ytimg\.com/.test(raw)) return raw
  if (/=w\d+-h\d+/.test(raw)) return raw.replace(/=w\d+-h\d+[^?]*$/, SQUARE_SIZE)
  return `${raw}${SQUARE_SIZE}`
}

function shuffleList(list) {
  const next = [...list]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

function ArtistHeroSkeleton({ onBack }) {
  return (
    <div className="artist-page" data-testid="artist-profile">
      <div className="artist-hero is-loading">
        <button className="profile-back" onClick={onBack}><ArrowLeft /> Back</button>
        <div className="artist-hero-content">
          <span className="artist-kicker">Artist</span>
          <span className="artist-skeleton-line title" />
          <span className="artist-skeleton-line short" />
          <span className="artist-skeleton-line" />
        </div>
      </div>
    </div>
  )
}

export function ArtistProfileView({
  profile,
  liked = [],
  onBack,
  onOpenArtist,
  onPlay,
  onQueue,
  onLike,
  showToast,
}) {
  const [artist, setArtist] = useState(null)
  const [status, setStatus] = useState('loading')
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [albumSheet, setAlbumSheet] = useState(null)
  const [albumBusy, setAlbumBusy] = useState('')
  const key = `${profile?.browseId || ''}:${profile?.slug || ''}:${profile?.name || ''}`

  useEffect(() => {
    let cancelled = false
    setArtist(null)
    setStatus('loading')
    setExpanded(false)
    setShowAll(false)
    fetchYtArtist({ browseId: profile?.browseId, name: profile?.name })
      .then((data) => {
        if (cancelled) return
        if (data?.name) {
          setArtist(data)
          setStatus('ready')
        } else {
          setStatus('error')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => { cancelled = true }
  }, [key])

  const name = artist?.name || profile?.name || 'Artist'
  const songs = artist?.songs || []
  const albums = artist?.albums || []
  const related = artist?.relatedArtists || []
  const banner = wideArtwork(artist?.banner || artist?.avatar || '')
  const bio = artist?.bio || artist?.description || ''
  const subscribers = artist?.subscribers || 'Artist on YouTube Music'
  const shownSongs = showAll ? songs : songs.slice(0, 5)
  const canPlay = songs.length > 0

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/artist/${profile?.slug || ''}`
    return `${window.location.origin}/artist/${encodeURIComponent(profile?.slug || '')}${profile?.browseId ? `?id=${encodeURIComponent(profile.browseId)}` : ''}`
  }, [profile?.slug, profile?.browseId])

  const startShuffle = () => {
    if (!canPlay) return
    const shuffled = shuffleList(songs)
    onPlay?.(shuffled[0], shuffled, { radio: true })
  }

  const startRadio = () => {
    if (!canPlay) return
    onPlay?.(songs[0], songs, { radio: true })
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast?.('Artist link copied')
    } catch {
      showToast?.('Could not copy the artist link')
    }
  }

  const playAlbum = async (album) => {
    if (!album?.name || albumBusy) return
    setAlbumBusy(album.browseId || album.name)
    try {
      const tracks = await fetchYtAlbum({ browseId:album.browseId, name:`${album.name} ${name}` })
      if (tracks.length) setAlbumSheet({ ...album, tracks })
      else showToast?.(`No playable songs found for ${album.name}`)
    } catch {
      showToast?.(`Could not open ${album.name}`)
    } finally {
      setAlbumBusy('')
    }
  }

  if (status === 'loading') return <ArtistHeroSkeleton onBack={onBack} />

  return (
    <div className="artist-page" data-testid="artist-profile">
      {albumSheet && createPortal(<ModalShell onClose={() => setAlbumSheet(null)} size="modal-album"><div className="modal-head"><h2>{albumSheet.name}</h2><button className="text-btn" onClick={() => setAlbumSheet(null)}>Close</button></div><div className="album-actions"><button className="primary-btn" onClick={() => onPlay?.(albumSheet.tracks[0], albumSheet.tracks)}>▶ Play Album</button><button className="text-btn" onClick={() => { const tracks = shuffleList(albumSheet.tracks); onPlay?.(tracks[0], tracks) }}>🔀 Shuffle</button></div><div className="album-tracklist">{albumSheet.tracks.map(item => <button className="fp-queue-row" key={item.id} onClick={() => onPlay?.(item, albumSheet.tracks)}><Cover track={item} size="cover-size-sm" /><span><strong>{item.title}</strong><small>{item.artist}</small></span></button>)}</div></ModalShell>, document.querySelector('.app') || document.body)}
      <section className="artist-hero" style={banner ? { '--artist-banner': `url("${banner}")` } : undefined}>
        <div className="artist-hero-art" aria-hidden="true" />
        <div className="artist-hero-melt" aria-hidden="true" />
        <button className="profile-back" onClick={onBack} data-testid="profile-back"><ArrowLeft /> Back</button>
        <div className="artist-hero-content">
          <span className="artist-kicker"><Sparkles size={12} /> Artist</span>
          <h1 className="artist-name">
            {name}

          </h1>
          <p className="artist-subscribers">{subscribers}</p>
          {bio && (
            <div className={`artist-bio-wrap ${expanded ? 'expanded' : ''}`}>
              <p className="artist-bio">{bio}</p>
              {bio.length > 150 && (
                <button className="artist-bio-toggle" onClick={() => setExpanded((value) => !value)}>
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}
          <div className="artist-actions">
            <button className="artist-action primary" onClick={startShuffle} disabled={!canPlay}>
              <Play /> Shuffle
            </button>
            <button className="artist-action glass" onClick={startRadio} disabled={!canPlay}>
              <Radio /> Start radio
            </button>
            <button className="artist-action glass" onClick={share}>
              <Share2 /> Share
            </button>
          </div>
        </div>
      </section>

      {status === 'error' ? (
        <div className="artist-body">
          <div className="profile-empty" role="status">
            <Disc3 />
            <h2>We couldn't load this artist right now.</h2>
            <p>Check the connection and try opening {name} again.</p>
          </div>
        </div>
      ) : (
        <div className="artist-body">
          {songs.length > 0 && (
            <section className="profile-section" aria-label={`Songs by ${name}`}>
              <div className="profile-section-head">
                <h2>Songs</h2>
                {songs.length > 5 && (
                  <button className="profile-show-all" onClick={() => setShowAll((value) => !value)}>
                    {showAll ? 'Show less' : `Show all ${songs.length}`}
                  </button>
                )}
              </div>
              <div className="artist-song-list">
                {shownSongs.map((song) => (
                  <div
                    className="artist-song-row"
                    key={song.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPlay?.(song, songs)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onPlay?.(song, songs)
                      }
                    }}
                  >
                    <Cover track={song} size="cover-size-sm" />
                    <div className="artist-song-copy">
                      <strong>{song.title}</strong>
                      <span className="artist-song-credit">
                        <ArtistLinks track={song} onOpenArtist={onOpenArtist} />
                      </span>
                    </div>
                    <div className="song-row-actions">
                      <span className="artist-song-album">{distinctAlbum(song)}</span>
                      <button
                        className={`artist-song-icon ${liked.includes(song.id) ? 'liked' : ''}`}
                        onClick={(event) => { event.stopPropagation(); onLike?.(song) }}
                        aria-label={liked.includes(song.id) ? `Unlike ${song.title}` : `Like ${song.title}`}
                      >
                        <Heart fill={liked.includes(song.id) ? 'currentColor' : 'none'} />
                      </button>
                      <span className="artist-song-duration">{song.duration ? formatTime(song.duration) : '—'}</span>
                      <button
                        className="artist-song-icon artist-song-add"
                        onClick={(event) => { event.stopPropagation(); onQueue?.(song) }}
                        aria-label={`Add ${song.title} to queue`}
                        title="Add to queue"
                      >
                        <ListPlus />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {albums.length > 0 && (
            <section className="profile-section" aria-label={`Albums and singles by ${name}`}>
              <div className="profile-section-head"><h2>Albums &amp; singles</h2></div>
              <div className="artist-album-row">
                {albums.map((album) => (
                  <button
                    key={album.browseId || album.name}
                    className="artist-album-card"
                    onClick={() => playAlbum(album)}
                    disabled={albumBusy === (album.browseId || album.name)}
                    aria-label={`Open ${album.name}`}
                  >
                    <span
                      className="artist-album-art"
                      style={album.cover ? { backgroundImage: `url("${squareArtwork(album.cover)}")` } : undefined}
                    >
                      {!album.cover && <Disc3 />}
                      <span className="artist-album-play"><Play /></span>
                    </span>
                    <strong>{album.name}</strong>
                    <small>{[album.year, album.type || 'Album'].filter(Boolean).join(' · ')}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section className="profile-section" aria-label={`Artists similar to ${name}`}>
              <div className="profile-section-head">
                <h2>Fans might also like</h2>
                <span className="profile-section-count"><Users size={13} /> {related.length}</span>
              </div>
              <div className="artist-related-row">
                {related.map((entry) => (
                  <button
                    key={entry.browseId || entry.name}
                    className="artist-related-card"
                    onClick={() => onOpenArtist?.({ name: entry.name, browseId: entry.browseId })}
                    aria-label={`Open ${entry.name}`}
                  >
                    <span
                      className="artist-related-avatar"
                      style={entry.avatar ? { backgroundImage: `url("${squareArtwork(entry.avatar)}")` } : undefined}
                    >
                      {!entry.avatar && <Users />}
                    </span>
                    <strong>{entry.name}</strong>
                    <small>{entry.subscribers || 'Artist'}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {songs.length === 0 && albums.length === 0 && related.length === 0 && (
            <div className="profile-empty" role="status">
              <Disc3 />
              <h2>No songs found yet.</h2>
              <p>Try another artist or search for their latest release.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
