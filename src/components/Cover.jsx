import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AudioLines } from 'lucide-react'
import { artworkThumbUrl, initials, normalizeArtworkUrl } from '../lib/media'

export const ArtworkContext = createContext({ heal: () => {}, fallback: null })

export function Cover({ track, size = 'cover-size-sm', className = '', showQuality = false, playing = false }) {
  const artwork = useContext(ArtworkContext)
  const [imageSrc, setImageSrc] = useState(() => normalizeArtworkUrl(track?.cover))
  const attemptedRef = useRef('')

  useEffect(() => {
    setImageSrc(normalizeArtworkUrl(track?.cover))
  }, [track?.id, track?.cover])

  useEffect(() => {
    if (imageSrc || !track?.id || attemptedRef.current === track.id || typeof artwork.fallback !== 'function') return undefined
    attemptedRef.current = track.id
    let cancelled = false
    artwork.fallback(track)
      .then((cover) => {
        if (cancelled || !cover) return
        setImageSrc(cover)
        artwork.heal?.(track.id, cover)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [imageSrc, track, artwork])

  return (
    <div
      className={`cover ${size} ${playing ? 'playing' : ''} ${className}`.trim()}
      style={{ '--c1': track?.c1 || '#26303a', '--c2': track?.c2 || '#a65845' }}
    >
      {imageSrc && (
        <img
          src={size === 'cover-size-sm' || size === 'cover-size-md' ? artworkThumbUrl(imageSrc) : imageSrc}
          alt=""
          loading={size === 'cover-size-hero' ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageSrc(null)}
        />
      )}
      {!imageSrc && (
        <div className="cover-fallback">
          <span className="cover-glyph">{initials(track?.title || 'Echo')}</span>
        </div>
      )}
      {showQuality && track?.quality && (
        <span className="quality-badge"><AudioLines /> {track.quality}</span>
      )}
    </div>
  )
}
