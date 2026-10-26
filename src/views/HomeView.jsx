import { memo, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Music2, Play, Plus, Radio, Shuffle, Sparkles } from 'lucide-react'
import { mergeMoodCatalog, allocateHomeShelves } from '../core/moodFeed.js'
import { useLiveMoodFeed } from '../hooks/useLiveMoodFeed.js'
import { Cover } from '../components/Cover'
import { TrackCard } from '../components/TrackCard'
import { HOME_MOODS, buildQuickPicksAndRadio, rankHomeTracks, topTasteLabels } from '../core/tasteEngine.js'

function Collage({ tracks, className = '' }) {
  if (!tracks.length) return <div className={`home-collage empty-playlist-cover ${className}`}><Music2/></div>
  return <div className={`home-collage ${className}`} aria-label="Your listening artwork">{Array.from({ length: 4 }, (_, i) => <Cover key={i} track={tracks[i % Math.max(tracks.length, 1)]} size="" />)}</div>
}

function HeroShowcase({ tracks, onPlay }) {
  if (!tracks.length) return null
  return <div className="hero-showcase" aria-label="Featured tracks">
    {Array.from({ length: 4 }, (_, index) => {
      const track = tracks[index % tracks.length]
      return <button key={`${track.id}-${index}`} type="button" className="hero-showcase-tile" onClick={() => onPlay(track)} aria-label={`Play ${track.title} by ${track.artist}`}>
        <Cover track={track} size="" />
        <span className="hero-showcase-play" aria-hidden="true"><Play /></span>
      </button>
    })}
  </div>
}

function Shelf({ title, subtitle, tracks, liked, onPlay, onLike }) {
  const scroll = useRef(null)
  if (!tracks.length) return null
  return <section className="home-section home-shelf">
    <div className="home-section-head"><div><p>{subtitle}</p><h2>{title}</h2></div><div className="shelf-arrows"><button className="icon-btn" aria-label={`Scroll ${title} left`} onClick={() => scroll.current?.scrollBy({ left: -380, behavior: 'smooth' })}><ChevronLeft /></button><button className="icon-btn" aria-label={`Scroll ${title} right`} onClick={() => scroll.current?.scrollBy({ left: 380, behavior: 'smooth' })}><ChevronRight /></button></div></div>
    <div className="shelf-scroll" ref={scroll}>{tracks.map(track => <TrackCard key={track.id} track={track} liked={liked.includes(track.id)} onPlay={onPlay} contextTracks={tracks} onLike={onLike} />)}</div>
  </section>
}

export const HomeView = memo(function HomeView({ currentUser, library, liked = [], recentIds = [], playlists = [], dailyFeed, tasteProfile, onOpenTaste, onPlayTrack, onStartRadio, onLike, onQueue, onCreatePlaylist, onOpenPlaylist, onPlayPlaylist, onCreateRoom }) {
  const [mood, setMood] = useState('all')
  const live = useLiveMoodFeed(mood, tasteProfile)
  const options = useMemo(() => ({ profile: tasteProfile, liked, recent: recentIds, mood }), [tasteProfile, liked, recentIds, mood])
  const catalog = useMemo(() => {
    const daily = dailyFeed?.users?.[currentUser?.id || 'guest'] || {}
    return mergeMoodCatalog(live.tracks, [...(daily.madeForYou || []), ...(daily.basedOnRecent || []), ...(dailyFeed?.trending || []), ...Object.values(library)])
  }, [dailyFeed, currentUser?.id, library, live.tracks])
  const { quickPicks: rawQuick, radio } = useMemo(() => buildQuickPicksAndRadio(catalog, options), [catalog, options])
  const recent = useMemo(() => recentIds.map(id => library[id]).filter(Boolean), [recentIds, library])
  const ranked = useMemo(() => rankHomeTracks(catalog, options), [catalog, options])
  const fresh = ranked.filter(track => !recentIds.includes(track.id))
  const listenAgain = recent.length ? rankHomeTracks(recent, options) : ranked.filter(track => liked.includes(track.id)).length ? ranked.filter(track => liked.includes(track.id)) : ranked.slice(0, 10)
  const sections=useMemo(()=>allocateHomeShelves(rawQuick,[...listenAgain,...ranked],fresh),[rawQuick,listenAgain,ranked,fresh])
  const quickPicks=sections.quickPicks
  const guest=!currentUser || !recentIds.length
  const quickGrid=useRef(null),[quickPage,setQuickPage]=useState(0)
  const pages=Math.max(1,Math.ceil(quickPicks.length/4))
  const movePage=direction=>{const node=quickGrid.current;if(node)node.scrollTo({left:(node.clientWidth+16)*Math.max(0,Math.min(pages-1,quickPage+direction)),behavior:'smooth'})}
  const collage = recent.length >= 4 ? recent : ranked
  const showcaseTracks = useMemo(() => {
    const seen = new Set()
    return [...recent, ...ranked].filter((track) => {
      if (!track?.id || seen.has(track.id)) return false
      seen.add(track.id)
      return true
    }).slice(0, 4)
  }, [recent, ranked])
  const playHero = track => onPlayTrack(track, ranked)
  const firstName = currentUser?.name?.trim().split(/\s+/)[0] || 'music lover'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const artists = topTasteLabels(tasteProfile?.artists, 2)
  const tint = HOME_MOODS.find(item => item.id === mood).tint
  const mixes = [
    { title: 'My Supermix', subtitle: guest ? 'Explore curated mixes' : 'Your favorites, beautifully connected', tracks: radio },
    { title: 'Desi & Coke Studio Mix', subtitle: 'Voices that feel like home', tracks: rankHomeTracks(catalog, { ...options, mood: 'sufi' }).slice(0, 16) },
    { title: 'Late Night Vibes', subtitle: 'Let the day fade away', tracks: rankHomeTracks(catalog, { ...options, mood: 'night' }).slice(0, 16) },
    { title: 'Discovery Mix', subtitle: 'A little outside your usual rotation', tracks: fresh.length ? fresh.slice(0, 16) : radio },
  ]
  const playQuick = track => onPlayTrack(track, buildQuickPicksAndRadio(catalog, options, track).radio)
  return <div className="home-view home-v2 home-v81" data-testid="home-v2" style={{ '--mood-tint': tint }}>
    <div className="home-chips" role="group" aria-label="Mood filters">{HOME_MOODS.map(item => <button key={item.id} className={`home-chip ${mood === item.id ? 'active' : ''}`} aria-pressed={mood === item.id} onClick={() => setMood(item.id)}>{item.label}{mood === item.id && live.status === 'loading' && <span className="mood-loading" aria-label="Loading fresh tracks" />}</button>)}</div>
    <header className="home-hero">
      <div className="home-hero-copy"><span className="home-kicker">Made for your moment</span><h1>{!currentUser ? 'Welcome to EchoSync.' : <>{greeting}, <em>{firstName}.</em></>}</h1><p>{!currentUser ? 'Stream full tracks instantly, explore curated mixes, or jump into a live listening room.' : artists.length ? `A little ${artists.join(', ')}, a few familiar favorites, and something new to fall for.` : 'The songs you come back to. The ones you haven’t met yet. All in one place.'}</p>
        <div className="home-hero-actions"><button className="primary-btn" disabled={!radio.length} onClick={() => onPlayTrack(radio[0], radio)}><Play /> Play Supermix</button><button className="secondary-btn" disabled={!radio.length} onClick={() => onStartRadio(radio[0], radio)}><Shuffle /> Start Radio</button><button className="text-btn" onClick={onCreateRoom}><Radio /> Create Room</button></div>
      </div>
      <HeroShowcase tracks={showcaseTracks} onPlay={playHero} />
    </header>
    {live.status === 'error' && <p className="mood-notice" role="status">Live picks are unavailable. Enjoy your saved rotation while we reconnect.</p>}
    <section className="home-section quick-picks-section"><div className="home-section-head"><div><p>Your next great listen</p><h2>Quick picks</h2></div><span className="quick-radio-note"><Radio size={16} /> A song starts a radio</span></div>
      <div className="quick-grid" data-testid="quick-grid" ref={quickGrid} onScroll={e=>setQuickPage(Math.round(e.currentTarget.scrollLeft/(e.currentTarget.clientWidth+16)))}>{quickPicks.map(track => <article className="quick-card" key={track.id}>
        <button className="quick-main" onClick={() => playQuick(track)} aria-label={`Play ${track.title}`}><span className="quick-art"><Cover track={track} size="" /><span className="quick-play"><Play /></span></span><span className="quick-copy"><strong>{track.title}</strong><span>{track.artist}</span></span></button>
        <button className={`quick-like icon-btn ${liked.includes(track.id) ? 'liked' : ''}`} onClick={() => onLike(track)} aria-label={`Like ${track.title}`}><Heart fill={liked.includes(track.id) ? 'currentColor' : 'none'} /></button><button className="quick-add icon-btn" onClick={() => onQueue(track)} aria-label={`Queue ${track.title}`}><Plus /></button>
      </article>)}</div>
      <div className="quick-pagination"><button className="icon-btn" aria-label="Previous Quick picks page" disabled={quickPage===0} onClick={()=>movePage(-1)}><ChevronLeft/></button><span>Page {quickPage+1} of {pages}</span><button className="icon-btn" aria-label="Next Quick picks page" disabled={quickPage>=pages-1} onClick={()=>movePage(1)}><ChevronRight/></button></div>
      {!quickPicks.length && <p className="home-empty">Your picks are warming up. Try a search above to find a favorite.</p>}
    </section>
    <Shelf title={guest ? "Popular right now" : "Listen again"} subtitle={guest ? "Trending hits to explore" : "Always worth another play"} tracks={sections.familiar} liked={liked} onPlay={onPlayTrack} onLike={onLike} />
    <section className="home-section home-mixes"><div className="home-section-head"><div><p>{guest ? "Handpicked stations across Bollywood, Sufi, and Late Night vibes" : "A soundtrack for every side of you"}</p><h2>{guest ? "Explore curated mixes" : "Mixed for you"}</h2></div></div><div className="mix-scroll">{mixes.map(mix => <button key={mix.title} className="home-mix-card" disabled={!mix.tracks.length} onClick={() => onPlayTrack(mix.tracks[0], mix.tracks)}><Collage tracks={mix.tracks} /><strong>{mix.title}</strong><span>{mix.subtitle}</span></button>)}</div></section>
    <Shelf title="Fresh discoveries" subtitle="Make room for a new favorite" tracks={sections.fresh} liked={liked} onPlay={onPlayTrack} onLike={onLike} />
    {liked.length > 0 && <Shelf title="Forgotten favorites" subtitle="A welcome return to your rotation" tracks={ranked.filter(track => liked.includes(track.id) && !recentIds.includes(track.id)).slice(0, 12)} liked={liked} onPlay={onPlayTrack} onLike={onLike} />}
    {!tasteProfile?.events && <section className="home-taste-card"><Sparkles /><div><strong>Make this feel more like you</strong><span>Choose a few artists and moods you love.</span></div><button className="text-btn" onClick={onOpenTaste}>Tune your taste</button></section>}
    {playlists.length > 0 && <section className="home-section home-playlists"><div className="home-section-head"><h2>Your playlists</h2><button className="text-btn" onClick={onCreatePlaylist}><Plus size={16} /> New playlist</button></div><div className="playlist-grid">{playlists.map(playlist => <article className="home-playlist-item" key={playlist.id}><button onClick={() => onOpenPlaylist(playlist)}><Collage tracks={playlist.trackIds.map(id => library[id]).filter(Boolean)} /><strong>{playlist.name}</strong><span>{playlist.trackIds.length} tracks</span></button><button className="text-btn" disabled={!playlist.trackIds.length} onClick={() => onPlayPlaylist(playlist)}><Play size={16} /> Play playlist</button></article>)}</div></section>}
  </div>
})
HomeView.displayName = 'HomeView'
