import { Heart, Play } from 'lucide-react'
import { Cover } from './Cover'

export function TrackCard({ track, liked = false, playing = false, onPlay, onLike }) {
  return (
    <article className={`track-card ${playing ? 'is-playing' : ''}`} data-testid="track-card">
      <div className="track-card-art-wrap">
        <button
          type="button"
          className="track-card-art"
          onClick={onPlay}
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
        <span title={track?.artist}>{track?.artist || 'EchoSync'}</span>
      </div>
    </article>
  )
}

export function SkeletonShelf({ count = 6 }) {
  return (
    <div className="shelf-scroll skeleton-shelf" aria-label="Loading recommendations" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <span className="skeleton-art" />
          <span className="skeleton-line wide" />
          <span className="skeleton-line" />
        </div>
      ))}
    </div>
  )
}
