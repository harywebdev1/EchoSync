import { Fragment } from 'react'

function artistList(track) {
  const artists = Array.isArray(track?.artists) ? track.artists.filter((artist) => artist?.name) : []
  if (artists.length) return artists
  const name = String(track?.artist || '').trim()
  if (!name) return []
  return name
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ name: part }))
}

// Artist names stay individually clickable even inside row buttons: the click
// stops propagation so it never starts playback by accident.
export function ArtistLinks({ track, onOpenArtist, fallback = 'EchoSync', className = '' }) {
  const artists = artistList(track)
  if (!onOpenArtist || !artists.length) {
    return <span className={className}>{track?.artist || fallback}</span>
  }
  return (
    <span className={`artist-links ${className}`.trim()}>
      {artists.map((artist, index) => (
        <Fragment key={`${artist.browseId || artist.name}-${index}`}>
          {index > 0 && <span className="artist-sep">, </span>}
          <button
            type="button"
            className="artist-link"
            onClick={(event) => {
              event.stopPropagation()
              onOpenArtist(artist)
            }}
            title={`Open ${artist.name}`}
          >
            {artist.name}
          </button>
        </Fragment>
      ))}
    </span>
  )
}
