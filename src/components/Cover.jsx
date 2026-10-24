import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines } from 'lucide-react'
import { initials, resolveTrackArtwork, trackArtworkSources } from '../lib/media'

export const ArtworkContext = createContext({ heal: () => {}, fallback: null })

export function Cover({ track, size = 'cover-size-sm', className = '', showQuality = false, playing = false }) {
  const artwork = useContext(ArtworkContext)
  const canonical = resolveTrackArtwork(track)
  const signature = JSON.stringify(trackArtworkSources(track))
  const sources = useMemo(() => {
    const originals = JSON.parse(signature)
    return [...originals, ...originals.filter(url => /^https:\/\//.test(url)).map(url => `/api/media?url=${encodeURIComponent(url)}`)]
  }, [signature])
  const key = `${track?.id}:${signature}`
  const [attempt, setAttempt] = useState({ key, index: 0, fallback: null })
  const state = attempt.key === key ? attempt : { key, index: 0, fallback: null }
  const imageSrc = sources[state.index] || state.fallback
  const attempted = useRef('')
  useEffect(() => {
    if (imageSrc || !track?.id || attempted.current === key || typeof artwork.fallback !== 'function') return
    attempted.current = key
    let cancelled = false
    artwork.fallback(track).then(url => {
      if (cancelled || !url || sources.includes(url)) return
      setAttempt({ key, index: sources.length, fallback: url })
      artwork.heal?.(track.id, url)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [key, imageSrc, artwork])
  return <div className={`cover ${size} ${playing ? 'playing' : ''} ${className}`.trim()} data-artwork={canonical || ''} style={{ '--c1': track?.c1 || '#26303a', '--c2': track?.c2 || '#a65845' }}>
    {imageSrc ? <img src={imageSrc} alt="" loading={playing || size === 'cover-size-hero' ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setAttempt({ key, index: state.index + 1, fallback: null })} /> : <div className="cover-fallback"><span className="cover-glyph">{initials(track?.title || 'Echo')}</span></div>}
    {showQuality && track?.quality && <span className="quality-badge"><AudioLines /> {track.quality}</span>}
  </div>
}
