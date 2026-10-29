import { memo } from 'react'
import { Heart, Play } from 'lucide-react'
import { Cover } from './Cover'
import { ArtistLinks } from './ArtistLinks.jsx'

export const TrackCard = memo(function TrackCard({ track, liked = false, playing = false, onPlay, onLike, onOpenArtist, contextTracks }) {
  return (
    <article className={`track-card ${playing ? 'is-playing' : ''}`} data-testid="track-card">
      <div className="track-card-art-wrap">
        <button
          type="button"
          className="track-card-art"
          onClick={() => onPlay(track, contextTracks)}
          aria-label={`Play ${track?.title || 'track'}`}
        >
          <Cover track={track} size="" playing={playing} />
          <span className="track-card-play"><Play /></span>
        </button>
        <button
          type="button"
          className={`track-card-like ${liked ? 'liked' : ''}`}
          onClick={() => onLike?.(track)}
          aria-label={liked ? `Unlike ${track?.title || 'track'}` : `Like ${track?.title || 'track'}`}
        >
          <Heart />
        </button>
      </div>
      <div className="track-card-copy">
        <strong title={track?.title}>{track?.title || 'Untitled track'}</strong>
        <span title={track?.artist}><ArtistLinks track={track} onOpenArtist={onOpenArtist} /></span>
      </div>
    </article>
  )
})
