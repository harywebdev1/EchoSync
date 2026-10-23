import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Clock3,
  Headphones,
  ListPlus,
  Play,
  Plus,
  Radio,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { Cover } from './Cover'

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
  onPlay,
  onQueue,
  onAddToPlaylist,
  onSearch,
  suggestions = [],
  recentSearches = [],
  onSearchCommit,
  onRemoveRecentSearch,
  onClearRecentSearches,
  tasteTracks = [],
  onOpenTaste,
  context = { mode: 'solo', roomName: '' },
  canControlRoom = false,
  pendingTrackId = '',
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const inputRef = useRef(null)
  const latestQuery = useRef('')

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setStatus('idle')
      setResults([])
      return undefined
    }
    latestQuery.current = trimmed
    setStatus('loading')
    const timer = setTimeout(async () => {
      onSearchCommit?.(trimmed)
      try {
        const found = await onSearch(trimmed)
        if (latestQuery.current !== trimmed) return
        setResults(found)
        setStatus('ready')
      } catch {
        if (latestQuery.current === trimmed) setStatus('error')
      }
    }, 380)
    return () => clearTimeout(timer)
  }, [query, onSearch])

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
  const picks = tasteTracks.slice(0, 5)

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="search-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-top">
          <Search />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a song, an artist, a mood..."
          />
          <span className="esc-key">ESC</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close search"><X /></button>
        </div>

        <div className={`search-context-pill ${context.mode}`} data-testid="search-context">
          {context.mode === 'room' ? (
            <>
              <Radio size={12} />
              <span>Playing in Room: {context.roomName || 'Room'}</span>
              {!canControlRoom && <b>Admin/DJ only</b>}
            </>
          ) : (
            <>
              <Headphones size={12} />
              <span>Listening privately</span>
            </>
          )}
        </div>

        <div className="search-results">
          {status === 'idle' && (
            <div className="search-idle">
              <div className="search-idle-head">
                <div>
                  <h4>What should play next?</h4>
                  <p>Search by song, artist, mood, or lyric. Every result opens a playable stream.</p>
                </div>
                <button className="text-btn search-tune-btn" onClick={onOpenTaste}>
                  <Sparkles size={12} /> Tune your taste
                </button>
              </div>

              {recent.length > 0 && (
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
                  <span>Suggested for your taste</span>
                  <b>{fallbackSuggestions.length ? 'personalised' : 'start with a vibe'}</b>
                </div>
                {fallbackSuggestions.length ? (
                  <div className="suggestion-chips">
                    {fallbackSuggestions.map((suggestion) => (
                      <button key={suggestion.label} onClick={() => runQuery(suggestion.query)}>{suggestion.label}</button>
                    ))}
                  </div>
                ) : (
                  <p className="search-idle-note">Tune a few vibes and this space will start shaping itself around you.</p>
                )}
              </section>

              {picks.length > 0 && (
                <section className="search-block">
                  <div className="search-caption"><span>Picked for you</span><b>{picks.length} tracks</b></div>
                  <div className="search-mini-grid">
                    {picks.map((track) => (
                      <button key={track.id} className="search-mini-card" onClick={() => onPlay(track, picks)}>
                        <Cover track={track} size="" />
                        <span className="search-mini-play"><Play /></span>
                        <strong>{track.title}</strong>
                        <span>{track.artist}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="search-block search-browse">
                <div className="search-caption"><span>Browse vibes</span><b>{SEARCH_CATEGORIES.length} moods</b></div>
                <div className="browse-vibe-grid">
                  {SEARCH_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      className="browse-vibe-card"
                      style={{ '--vibe-1': category.c1, '--vibe-2': category.c2 }}
                      onClick={() => runQuery(category.query)}
                    >
                      <span>{category.label}</span>
                      <Search size={13} />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {status === 'loading' && (
            <div className="search-loading"><span className="spinner" /> Searching the catalogue...</div>
          )}

          {status === 'ready' && results.length === 0 && (
            <div className="no-results">
              <span>No streams found for "{query}". Try another spelling or artist.</span>
              <button className="text-btn" onClick={onOpenTaste}><Sparkles size={12} /> Refine your taste</button>
            </div>
          )}

          {status === 'error' && (
            <div className="no-results">Search is unavailable right now. Try again in a moment.</div>
          )}

          {status === 'ready' && results.length > 0 && (
            <>
              <div className="search-caption"><span>Top results</span><b>{results.length} streams</b></div>
              {results.map((track) => (
                <div
                  key={track.id}
                  className="search-result"
                  role="button"
                  tabIndex={0}
                  data-provider={track.provider}
                  data-track-id={track.id}
                  onClick={() => onPlay(track, results)}
                  onKeyDown={(event) => event.key === 'Enter' && onPlay(track, results)}
                >
                  <Cover track={track} size="cover-size-sm" />
                  <div className="search-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}{track.preview ? ' / preview' : ''}</span>
                    {pendingTrackId === track.id && <span className="search-pending-copy">Loading stream...</span>}
                  </div>
                  <button
                    className="search-play"
                    onClick={(event) => {
                      event.stopPropagation()
                      onPlay(track, results)
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
                      onAddToPlaylist(track)
                    }}
                    aria-label="Add to playlist"
                    title="Add to playlist"
                  >
                    <ListPlus />
                  </button>
                  <button
                    className="search-add"
                    onClick={(event) => {
                      event.stopPropagation()
                      onQueue(track)
                    }}
                    aria-label={context.mode === 'room' ? 'Add to Room Queue' : 'Add to Solo Queue'}
                    title={context.mode === 'room' ? 'Add to Room Queue' : 'Add to Solo Queue'}
                    disabled={context.mode === 'room' && !canControlRoom}
                  >
                    <Plus />
                    <span>{context.mode === 'room' ? 'Room Queue' : 'Solo Queue'}</span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="search-foot">
          <AudioLines />
          <span>Music, artwork, and lyrics</span>
          <span className="right">Search the catalogue</span>
        </div>
      </div>
    </div>
  )
}
