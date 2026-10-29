import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Music2, Play, Plus, Radio, Shuffle } from 'lucide-react'
import { mergeMoodCatalog, allocateHomeShelves } from '../core/moodFeed.js'
import { useLiveMoodFeed } from '../hooks/useLiveMoodFeed.js'
import { useYtHomeFeed } from '../hooks/useYtHomeFeed.js'
import { Cover } from '../components/Cover'
import { ArtistLinks } from '../components/ArtistLinks.jsx'
import { TrackCard } from '../components/TrackCard'
import { HOME_MOODS, rankListenerTracks, topTasteLabels } from '../core/listenerProfile.js'

function Collage({ tracks, className = '' }) {
  if (!tracks.length) return <div className={`home-collage empty-playlist-cover ${className}`}><Music2/></div>
  return <div className={`home-collage ${className}`} aria-label="Your listening artwork">{Array.from({ length: 4 }, (_, i) => <Cover key={i} track={tracks[i % Math.max(tracks.length, 1)]} size="" />)}</div>
}

function HeroShowcase({ tracks, onPlay, onPrefetch }) {
  if (!tracks.length) return null
  const loop = tracks.length > 1 ? [...tracks, ...tracks] : tracks
  return <div className="hero-carousel" aria-label="Featured tracks">
    <div className="hero-carousel-track">
      {loop.map((track, index) => (
        <button
          key={`${track.id}-${index}`}
          type="button"
          className="hero-carousel-tile"
          onClick={() => onPlay(track)}
          onMouseEnter={() => onPrefetch?.(track)}
          onFocus={() => onPrefetch?.(track)}
          aria-label={`Play ${track.title} by ${track.artist}`}
          aria-hidden={index >= tracks.length ? 'true' : undefined}
          tabIndex={index >= tracks.length ? -1 : 0}
        >
          <Cover track={track} size="" />
          <span className="hero-carousel-copy"><strong>{track.title}</strong><span>{track.artist}</span></span>
          <span className="hero-carousel-play" aria-hidden="true"><Play /></span>
        </button>
      ))}
    </div>
  </div>
}

function Shelf({ title, subtitle, tracks, liked, onPlay, onLike, onOpenArtist }) {
  const scroll = useRef(null)
  if (!tracks.length) return null
  return <section className="home-section home-shelf">
    <div className="home-section-head"><div><p>{subtitle}</p><h2>{title}</h2></div><div className="shelf-arrows"><button className="icon-btn" aria-label={`Scroll ${title} left`} onClick={() => scroll.current?.scrollBy({ left: -380, behavior: 'smooth' })}><ChevronLeft /></button><button className="icon-btn" aria-label={`Scroll ${title} right`} onClick={() => scroll.current?.scrollBy({ left: 380, behavior: 'smooth' })}><ChevronRight /></button></div></div>
    <div className="shelf-scroll" ref={scroll}>{tracks.map(track => <TrackCard key={track.id} track={track} liked={liked.includes(track.id)} onPlay={onPlay} contextTracks={tracks} onLike={onLike} onOpenArtist={onOpenArtist} />)}</div>
  </section>
}

export const HomeView = memo(function HomeView({ dynamicCatalogTracks = [], currentUser, library, liked = [], recentIds = [], playlists = [], dailyFeed, tasteProfile, onPlayTrack, onStartRadio, onLike, onQueue, onOpenArtist, onPrefetch, onCreatePlaylist, onOpenPlaylist, onPlayPlaylist, onCreateRoom }) {
  const [mood, setMood] = useState('all')
  const live = useLiveMoodFeed(mood, tasteProfile)
  const recent = useMemo(() => recentIds.map(id => library[id]).filter(Boolean), [recentIds, library])
  const home = useYtHomeFeed({
    profile: tasteProfile,
    recentTracks: recent,
    libraryTracks: useMemo(() => Object.values(library), [library]),
    liked,
  })
  const options = useMemo(() => ({ profile: tasteProfile, liked, recent: recentIds, mood }), [tasteProfile, liked, recentIds, mood])
  const catalog = useMemo(() => {
    const daily = dailyFeed?.users?.[currentUser?.id || 'guest'] || {}
    return mergeMoodCatalog(
      [...live.tracks, ...home.quick, ...home.mixed, ...home.fresh],
      [...(daily.madeForYou || []), ...(daily.basedOnRecent || []), ...(dailyFeed?.trending || []), ...dynamicCatalogTracks, ...Object.values(library)],
    )
  }, [dailyFeed, currentUser?.id, library, live.tracks, home.quick, home.mixed, home.fresh, dynamicCatalogTracks])
  const ranked = useMemo(() => rankListenerTracks(catalog, options), [catalog, options])
  const quickPool = useMemo(() => mergeMoodCatalog([...live.tracks, ...home.quick], []), [live.tracks, home.quick])
  const sections = useMemo(
    () => allocateHomeShelves(
      quickPool,
      home.familiar.length ? home.familiar : ranked,
      home.fresh.length ? home.fresh : ranked,
    ),
    [quickPool, home.familiar, home.fresh, ranked],
  )
  const quickPicks = sections.quickPicks
  const radio = home.supermix.length ? home.supermix : quickPicks
  const guest = !currentUser || !recentIds.length
  const quickGrid = useRef(null), [quickPage, setQuickPage] = useState(0)
  const pages = Math.max(1, Math.ceil(quickPicks.length / 4))
  const movePage = direction => { const node = quickGrid.current; if (node) node.scrollTo({ left: (node.clientWidth + 16) * Math.max(0, Math.min(pages - 1, quickPage + direction)), behavior: 'smooth' }) }
  const collage = recent.length >= 4 ? recent : (ranked.length ? ranked : quickPicks)
  const showcaseTracks = useMemo(() => {
    const seen = new Set()
    return [...radio, ...quickPicks, ...recent, ...ranked].filter((track) => {
      if (!track?.id || seen.has(track.id)) return false
      seen.add(track.id)
      return true
    }).slice(0, 10)
  }, [radio, quickPicks, recent, ranked])
  const playHero = track => onPlayTrack(track, radio)
  // Buffer the first audible frame of the tracks the listener can see first.
  useEffect(() => {
    if (!onPrefetch) return undefined
    const queue = [...showcaseTracks.slice(0, 2), ...quickPicks.slice(0, 2)]
    const seen = new Set()
    const unique = queue.filter((track) => {
      if (!track?.id || seen.has(track.id)) return false
      seen.add(track.id)
      return true
    })
    const timers = unique.map((track, index) => setTimeout(() => onPrefetch(track), 500 * index))
    return () => timers.forEach(clearTimeout)
  }, [onPrefetch, showcaseTracks, quickPicks])
  const firstName = currentUser?.name?.trim().split(/\s+/)[0] || 'music lover'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const artists = topTasteLabels(tasteProfile?.artists, 2)
  const tint = HOME_MOODS.find(item => item.id === mood)?.tint || '#a78bfa'
  const mixes = [
    { title: 'My Supermix', subtitle: guest ? 'Your everyday mix' : 'Your favorites', tracks: radio },
    { title: 'Desi & Coke Studio Mix', subtitle: 'Coke Studio and desi classics', tracks: rankListenerTracks(catalog, { ...options, mood: 'sufi' }).slice(0, 16) },
    { title: 'Late Night Vibes', subtitle: 'Slow songs for late nights', tracks: rankListenerTracks(catalog, { ...options, mood: 'night' }).slice(0, 16) },
    { title: 'Discovery Mix', subtitle: 'Outside your usual rotation', tracks: home.fresh.length ? home.fresh.slice(0, 16) : radio },
  ]
  const playQuick = track => onPlayTrack(track, [...home.mixed, ...quickPicks])
  return <div className="home-view home-v2 home-v81" data-testid="home-v2" style={{ '--mood-tint': tint }}>
    <div className="home-chips" role="group" aria-label="Mood filters">{HOME_MOODS.map(item => <button key={item.id} className={`home-chip ${mood === item.id ? 'active' : ''}`} aria-pressed={mood === item.id} onClick={() => setMood(item.id)}>{item.label}{mood === item.id && live.status === 'loading' && <span className="mood-loading" aria-label="Loading fresh tracks" />}</button>)}</div>
    <header className="home-hero">
      <div className="home-hero-copy"><span className="home-kicker">Home</span><h1>{!currentUser ? 'Welcome to EchoSync.' : <>{greeting}, <em>{firstName}.</em></>}</h1><p>{!currentUser ? 'Search any song, or start a listening room.' : artists.length ? `More ${artists.join(' & ')}.` : 'Based on what you play.'}</p>
        <div className="home-hero-actions"><button className="primary-btn" disabled={!radio.length} onClick={() => onPlayTrack(radio[0], radio)}><Play /> Play Supermix</button><button className="secondary-btn" disabled={!radio.length} onClick={() => onStartRadio(radio[0], radio)}><Shuffle /> Start Radio</button><button className="text-btn" onClick={onCreateRoom}><Radio /> Create Room</button></div>
      </div>
      <HeroShowcase tracks={showcaseTracks} onPlay={playHero} onPrefetch={onPrefetch} />
    </header>
    {live.status === 'error' && home.status === 'error' && <p className="mood-notice" role="status">Live picks are offline. Showing your saved rotation.</p>}
    <section className="home-section quick-picks-section"><div className="home-section-head"><div><h2>Quick picks</h2></div><span className="quick-radio-note"><Radio size={16} /> A song starts a radio</span></div>
      <div className="quick-grid" data-testid="quick-grid" ref={quickGrid} onScroll={e=>setQuickPage(Math.round(e.currentTarget.scrollLeft/(e.currentTarget.clientWidth+16)))}>{quickPicks.map(track => <article className="quick-card" key={track.id}>
        <div className="quick-main" onMouseEnter={() => onPrefetch?.(track)}>
          <button className="quick-art-btn" onClick={() => playQuick(track)} onFocus={() => onPrefetch?.(track)} aria-label={`Play ${track.title}`}><span className="quick-art"><Cover track={track} size="" /><span className="quick-play"><Play /></span></span></button>
          <span className="quick-copy"><button className="quick-title-btn" onClick={() => playQuick(track)}><strong>{track.title}</strong></button><ArtistLinks track={track} onOpenArtist={onOpenArtist} /></span>
        </div>
        <button className={`quick-like icon-btn ${liked.includes(track.id) ? 'liked' : ''}`} onClick={() => onLike(track)} aria-label={`Like ${track.title}`}><Heart fill={liked.includes(track.id) ? 'currentColor' : 'none'} /></button><button className="quick-add icon-btn" onClick={() => onQueue(track)} aria-label={`Queue ${track.title}`}><Plus /></button>
      </article>)}</div>
      <div className="quick-pagination"><button className="icon-btn" aria-label="Previous Quick picks page" disabled={quickPage===0} onClick={()=>movePage(-1)}><ChevronLeft/></button><span>Page {quickPage+1} of {pages}</span><button className="icon-btn" aria-label="Next Quick picks page" disabled={quickPage>=pages-1} onClick={()=>movePage(1)}><ChevronRight/></button></div>
      {!quickPicks.length && <p className="home-empty">Nothing here yet. Search for a song to start.</p>}
    </section>
    <Shelf title={guest ? 'Popular right now' : 'Listen again'} subtitle={guest ? 'Trending this week' : 'Recently played'} tracks={sections.familiar} liked={liked} onPlay={onPlayTrack} onLike={onLike} onOpenArtist={onOpenArtist} />
    <Shelf title="Mixed for you" subtitle="From your YouTube Music radio" tracks={home.mixed} liked={liked} onPlay={onPlayTrack} onLike={onLike} onOpenArtist={onOpenArtist} />
    <section className="home-section home-mixes"><div className="home-section-head"><div><h2>Mixes</h2></div></div><div className="mix-scroll">{mixes.map(mix => <button key={mix.title} className="home-mix-card" disabled={!mix.tracks.length} onClick={() => onPlayTrack(mix.tracks[0], mix.tracks)}><Collage tracks={mix.tracks} /><strong>{mix.title}</strong><span>{mix.subtitle}</span></button>)}</div></section>
    <Shelf title="Fresh discoveries" subtitle="New to you" tracks={sections.fresh} liked={liked} onPlay={onPlayTrack} onLike={onLike} onOpenArtist={onOpenArtist} />
    {liked.length > 0 && <Shelf title="Forgotten favorites" subtitle="Not played lately" tracks={ranked.filter(track => liked.includes(track.id) && !recentIds.includes(track.id)).slice(0, 12)} liked={liked} onPlay={onPlayTrack} onLike={onLike} onOpenArtist={onOpenArtist} />}
    {playlists.length > 0 && <section className="home-section home-playlists"><div className="home-section-head"><h2>Your playlists</h2><button className="text-btn" onClick={onCreatePlaylist}><Plus size={16} /> New playlist</button></div><div className="playlist-grid">{playlists.map(playlist => <article className="home-playlist-item" key={playlist.id}><button onClick={() => onOpenPlaylist(playlist)}><Collage tracks={playlist.trackIds.map(id => library[id]).filter(Boolean)} /><strong>{playlist.name}</strong><span>{playlist.trackIds.length} tracks</span></button><button className="text-btn" disabled={!playlist.trackIds.length} onClick={() => onPlayPlaylist(playlist)}><Play size={16} /> Play playlist</button></article>)}</div></section>}
  </div>
})
HomeView.displayName = 'HomeView'
