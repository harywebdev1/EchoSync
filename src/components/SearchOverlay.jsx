import { useEffect, useLayoutEffect, useRef, useState, useMemo, Fragment } from 'react'
import {
  AudioLines,
  Clock3,
  Headphones, Heart,
  ListPlus,
  Play,
  Plus,
  Radio,
  X,
} from 'lucide-react'
import { Cover } from './Cover'
import { getCanonicalSongStem } from '../core/songStem.js'

const SEARCH_CATEGORIES = [
  { id: 'coke-studio-indie', label: 'Coke Studio & Indie', query: 'Coke Studio indie songs', c1: '#633317', c2: '#e9a665' },
  { id: 'sufi-qawwali', label: 'Sufi & Qawwali', query: 'Sufi qawwali songs', c1: '#4a3516', c2: '#d4ad58' },
  { id: 'punjabi-hits', label: 'Punjabi Hits', query: 'Punjabi hits', c1: '#173c31', c2: '#54c897' },
  { id: 'bollywood-fresh', label: 'Bollywood Fresh', query: 'new Bollywood songs', c1: '#4a1f31', c2: '#e78c9f' },
  { id: 'late-night-lofi', label: 'Late Night Lo-Fi', query: 'late night lofi songs', c1: '#282547', c2: '#a395e4' },
  { id: 'global-charts', label: 'Global Charts', query: 'global chart hits', c1: '#19325b', c2: '#75a6ee' },
  { id: 'workout-energy', label: 'Workout Energy', query: 'workout energy songs', c1: '#541f20', c2: '#ec7f73' },
  { id: 'spiritual-naat', label: 'Spiritual & Naat', query: 'Naat spiritual songs', c1: '#1d4339', c2: '#86d1ab' },
]

export function SearchOverlay({
  onClose,
  query, onQueryChange, liked = [], onLike,
  onPlay,
  onQueue,
  onPrefetch,
  onAddToPlaylist,
  onSearch,
  catalog = {},
  suggestions = [],
  recentSearches = [],
  onSearchCommit,
  onRemoveRecentSearch,
  onClearRecentSearches,
  tasteTracks = [],
  context = { mode: 'solo', roomName: '' },
  canControlRoom = false,
  canAddToRoom = canControlRoom,
  pendingTrackId = '',
}) {
  const setQuery = onQueryChange
  const prefetchTimer = useRef(0)
  const cancelPrefetch = () => {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current)
    prefetchTimer.current = 0
  }
  const schedulePrefetch = (track) => {
    if (!onPrefetch || !track?.id) return
    cancelPrefetch()
    prefetchTimer.current = setTimeout(() => onPrefetch(track), 120)
  }
  useEffect(() => () => cancelPrefetch(), [])
  const [anchor, setAnchor] = useState({})
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')

  const [retry,setRetry]=useState(0)
  const callbacks=useRef({onSearch,onSearchCommit});callbacks.current={onSearch,onSearchCommit}
  useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose])
  useEffect(()=>{
    const trimmed=query.trim();let cancelled=false,deadline
    if(trimmed.length<2){setStatus('idle');setResults([]);return}
    setStatus('loading');setResults([])
    const controller=new AbortController()
    // Official Saavn has a 3.5s deadline before mirror failover, so a healthy
    // high-recall response can legitimately take longer than five seconds.
    const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>{controller.abort();reject(new Error('Search timed out'))},12000)})
    const timer=setTimeout(async()=>{
      callbacks.current.onSearchCommit?.(trimmed)
      try{const found=await Promise.race([callbacks.current.onSearch(trimmed,{signal:controller.signal,retry:retry>0}),timeout]);if(!cancelled){setResults(found);setStatus('ready')}}
      catch{if(!cancelled)setStatus('error')}
      finally{clearTimeout(deadline)}
    },150)
    return()=>{cancelled=true;clearTimeout(timer);clearTimeout(deadline);controller.abort()}
  },[query,retry])
  const instant=useMemo(()=>{
    const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean)
    if(query.trim().length<2)return[]
    const seen=new Set()
    return Object.values(catalog).filter(t=>{
      if(!t?.id||t.preview||(t.duration>0&&t.duration<60))return false
      if(!words.every(word=>(t.title+' '+t.artist).toLowerCase().includes(word)))return false
      const stem=getCanonicalSongStem(t)
      if(!stem||seen.has(stem))return false
      seen.add(stem);return true
    }).slice(0,20)
  },[catalog,query])
  const visibleResults=useMemo(()=>{
    const seen=new Set(),merged=[]
    for(const track of [...results,...instant]){
      if(!track?.id)continue
      const stem=getCanonicalSongStem(track)
      if(!stem||seen.has(stem))continue
      seen.add(stem);merged.push(track)
    }
    return merged
  },[results,instant])

  useLayoutEffect(() => {
    const place = () => {
      const rect = document.querySelector('.canonical-search')?.getBoundingClientRect()
      if (rect) setAnchor({ '--search-top': rect.bottom + 10 + 'px', '--search-center': rect.left + rect.width / 2 + 'px' })
    }
    place(); window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [])
  const runQuery = (value) => {
    const next = String(value || '').trim()
    if (!next) return
    setQuery(next)
  }

  const fallbackSuggestions = suggestions.length
    ? suggestions
    : [...new Set(tasteTracks.map((track) => track.artist).filter(Boolean))]
      .slice(0, 4)
      .map((artist) => ({ label: artist, query: `${artist} songs` }))
  const recent = recentSearches.filter(Boolean).slice(0, 6)
  const picks = useMemo(() => tasteTracks.filter((track, index, list) =>
    track?.id && list.findIndex((item) => getCanonicalSongStem(item) === getCanonicalSongStem(track)) === index,
  ).slice(0, 5), [tasteTracks])

  return (
    <div className="search-command-root" style={anchor}>
      <button className="search-dismiss" aria-label="Dismiss search" onClick={onClose} />
      <section id="search-command-surface" className="search-modal search-command-surface" aria-label="Search results">
        <button className="icon-btn search-compact-close" onClick={onClose} aria-label="Close search"><X /></button>
        {context.mode === 'room' && <div className="search-room-context" data-testid="search-context"><Radio size={14} /> {context.roomName}{!canAddToRoom && ' · Admin/DJ only'}</div>}
        <div className="search-results">
          {status === 'idle' && (
            <div className="search-idle">
              {(
                <section className="search-block search-recent" data-testid="search-recent">
                  <div className="search-caption">
                    <span>Recent searches</span>
                    <button className="text-btn" onClick={onClearRecentSearches}>Clear all</button>
                  </div>

                  <div className="recent-search-list">
                    {recent.map((item) => (
                      <span key={item} className="recent-search-chip">
                        <button className="recent-search-go" onClick={() => runQuery(item)}>
                          <Clock3 size={11} /> {item}
                        </button>
                        <button
                          className="recent-search-remove"
                          onClick={() => onRemoveRecentSearch?.(item)}
                          aria-label={`Remove ${item} from recent searches`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className="search-block" data-testid="search-suggestions">
                <div className="search-caption">
                  <span>Trending & picked for you</span>
                </div>
                {fallbackSuggestions.length ? (
                  <div className="suggestion-chips">
                    {fallbackSuggestions.map((suggestion) => (
                      <button key={suggestion.label} onClick={() => runQuery(suggestion.query)}>{suggestion.label}</button>
                    ))}
                    {SEARCH_CATEGORIES.slice(0, 4).map(category => <button key={category.id} onClick={() => runQuery(category.query)}>{category.label}</button>)}
                  </div>
                ) : (
                  <p className="search-idle-note">Search any song, artist or mood to start listening.</p>
                )}
              </section>

              {picks.length > 0 && (
                <section className="search-block">
                  <div className="search-caption"><span>Quick Picks for You</span></div>
                  <div className="search-quick-rows">{picks.map(track => <div className="search-quick-row" key={track.id} onMouseEnter={() => schedulePrefetch(track)} onMouseLeave={cancelPrefetch}><Cover track={track} /><div><strong>{track.title}</strong><span>{track.artist}</span></div><button className="icon-btn" aria-label={`Play ${track.title}`} onClick={() => onPlay(track, picks)}><Play /></button><button className="icon-btn" aria-label={`Queue ${track.title}`} onClick={() => onQueue(track)} disabled={context.mode === 'room' && !canAddToRoom}><Plus /></button></div>)}</div>
                </section>
              )}
            </div>
          )}

          {status === 'loading' && (
            <div className="search-loading"><span className="spinner" /> Searching the catalogue...</div>
          )}

          {status === 'ready' && visibleResults.length === 0 && (
            <div className="no-results">
              <span>No streams found for "{query}". Try another spelling or artist.</span>
            </div>
          )}

          {status === 'error' && (
            <div className="search-recovery" role="status">Live search is taking too long or unavailable. Instant matches are still playable. <button className="text-btn" onClick={()=>setRetry(n=>n+1)}>↻ Retry search</button></div>
          )}

          {instant.length>0 && status!=='ready' && <h3 className="instant-label">Instant matches</h3>}
          {visibleResults.length > 0 && (
            <>
              <div className="search-caption"><span>Top result</span><b>{results.length} streams</b></div>
              {visibleResults.map((track, index) => (
                <Fragment key={track.id}>{index === 1 && <h3 className="search-song-heading">Songs</h3>}<div
                  key={track.id}
                  className={`search-result ${index === 0 ? 'search-top-result' : ''}`}
                  role="button"
                  tabIndex={0}
                  data-provider={track.provider}
                  data-track-id={track.id}
                  onMouseEnter={() => schedulePrefetch(track)}
                  onMouseLeave={cancelPrefetch}
                  onFocus={() => schedulePrefetch(track)}
                  onBlur={cancelPrefetch}
                  onClick={() => onPlay(track, visibleResults)}
                  onKeyDown={(event) => event.key === 'Enter' && onPlay(track, visibleResults)}
                >
                  <Cover track={track} size="cover-size-sm" />
                  <div className="search-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}{track.preview ? ' / preview' : ''}</span>
                    {pendingTrackId === track.id && <span className="search-pending-copy">Loading stream...</span>}
                  </div>
                  <button
                    className="search-play"
                    disabled={context.mode === 'room' && !canControlRoom}
                    onClick={(event) => {
                      event.stopPropagation()
                      onPlay(track, visibleResults)
                    }}
                    aria-label={context.mode === 'room' ? 'Play in Room' : 'Play in Solo Mode'}
                    title={context.mode === 'room' ? 'Play in Room' : 'Play in Solo Mode'}
                  >
                    {pendingTrackId === track.id ? <span className="spinner" /> : <Play />}
                  </button>
                  <button
                    className="search-save"
                    onClick={(event) => {
                      event.stopPropagation()
                      onLike(track)
                    }}
                    aria-label={`${liked.includes(track.id) ? 'Unlike' : 'Like'} ${track.title}`}
                    title="Like song"
                  >
                    <Heart fill={liked.includes(track.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="search-add"
                    onClick={(event) => {
                      event.stopPropagation()
                      onQueue(track)
                    }}
                    aria-label={context.mode === 'room' ? 'Add to Room Queue' : 'Add to Solo Queue'}
                    title={context.mode === 'room' ? 'Add to Room Queue' : 'Add to Solo Queue'}
                    disabled={context.mode === 'room' && !canAddToRoom}
                  >
                    <Plus />
                    <span>{context.mode === 'room' ? 'Room Queue' : 'Solo Queue'}</span>
                  </button>
                </div></Fragment>
              ))}
            </>
          )}
        </div>


      </section>
    </div>
  )
}
