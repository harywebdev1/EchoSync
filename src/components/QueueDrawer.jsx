import { AudioLines, ChevronDown, ChevronUp, ListMusic, Shuffle, Trash2, X } from 'lucide-react'
import { Cover } from './Cover'

export function QueueDrawer({
  queue,
  currentIndex,
  track,
  isPlaying,
  onClose,
  onPlayIndex,
  onMove,
  onRemove,
  onClear,
  onShuffle,
}) {
  const upcoming = queue
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.index > currentIndex)
  return (
    <aside className="social solo-queue-drawer mobile-open" data-testid="solo-queue-drawer" aria-label="Up Next queue">
      <div className="social-top">
        <div className="social-tabs">
          <span className="social-tab active"><ListMusic /> Up Next</span>
        </div>
        <button className="icon-btn social-close" onClick={onClose} aria-label="Close queue">
          <X />
        </button>
      </div>
      <div className="queue-drawer-head">
        <div>
          <span className="eyebrow"><span className="seg" /> PLAYBACK</span>
          <h3>Up Next</h3>
          <p>{queue.length ? `${queue.length} track${queue.length === 1 ? '' : 's'} in your listening session` : 'Your queue is empty'}</p>
        </div>
        <div className="queue-drawer-actions">
          <button className="text-btn" onClick={onShuffle} disabled={!queue.length}>
            <Shuffle size={12} /> Shuffle queue
          </button>
          <button className="text-btn queue-clear-btn" onClick={onClear} disabled={!queue.length}>
            <Trash2 size={12} /> Clear queue
          </button>
        </div>
      </div>

      <div className="queue-now-card" data-testid="queue-now-playing">
        <Cover track={track} size="cover-size-sm" playing={isPlaying} />
        <div>
          <span className="queue-now-label"><AudioLines /> Now playing</span>
          <strong>{track?.title || 'Nothing playing'}</strong>
          <small>{track?.artist || 'EchoSync'}</small>
        </div>
      </div>

      <div className="queue-drawer-list">
        <div className="queue-drawer-list-head">
          <span>Up next in queue</span>
          <b>{upcoming.length}</b>
        </div>
        {upcoming.length === 0 ? (
          <div className="queue-empty queue-drawer-empty">
            <span className="empty-icon"><ListMusic /></span>
            <strong>No tracks waiting</strong>
            <p>Add songs from Search to build what plays next.</p>
          </div>
        ) : upcoming.map(({ item, index }) => (
          <div className="queue-drawer-row" key={`${item?.id || 'track'}-${index}`} data-testid="queue-drawer-row">
            <button
              type="button"
              className="queue-drawer-main"
              onClick={() => onPlayIndex(index)}
              aria-label={`Play ${item?.title || 'track'} now`}
            >
              <span className="queue-index">{String(index + 1).padStart(2, '0')}</span>
              <Cover track={item} size="cover-size-sm" />
              <span className="queue-copy">
                <strong>{item?.title || 'Untitled track'}</strong>
                <small>{item?.artist || 'EchoSync'}</small>
              </span>
            </button>
            <div className="queue-drawer-row-actions">
              <button
                className="icon-btn"
                onClick={() => onMove(index, -1)}
                disabled={index <= currentIndex + 1}
                aria-label={`Move ${item?.title || 'track'} up`}
                title="Move up"
              >
                <ChevronUp />
              </button>
              <button
                className="icon-btn"
                onClick={() => onMove(index, 1)}
                disabled={index >= queue.length - 1}
                aria-label={`Move ${item?.title || 'track'} down`}
                title="Move down"
              >
                <ChevronDown />
              </button>
              <button
                className="icon-btn queue-drawer-remove"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${item?.title || 'track'} from queue`}
                title="Remove from queue"
              >
                <X />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
