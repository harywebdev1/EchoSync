import { RoomVote } from '../social/RoomSocialControls.jsx'
import { QUEUE_FILTERS, filterUpcomingQueue } from '../../core/queueFilters.js'
import { memo, useState } from 'react'
import { AudioLines, ChevronDown, ChevronUp, ListMusic, Shuffle, Trash2, X } from 'lucide-react'
import { Cover } from '../Cover'

export const QueueDrawer = memo(function QueueDrawer({
  open = true,
  room = null,
  queue,
  filterMode = 'All', onFilter, liked, recent, tasteProfile,
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
  const [undo,setUndo] = useState(null)
  const upcoming = filterUpcomingQueue(queue, currentIndex, room ? 'All' : filterMode, { liked, recent, tasteProfile })
  return (
    <aside hidden={!open} style={!open ? { display: 'none' } : undefined} className={`${open ? 'social ' : ''}solo-queue-drawer mobile-open`} data-testid="solo-queue-drawer" aria-label="Up Next queue">
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
          <h3>Queue</h3>
          <p>{queue.length ? `${Math.max(0,queue.length-currentIndex-1)} upcoming · 1 current` : 'Your queue is empty'}</p>
        </div>
        {!room && <div className="queue-drawer-actions">
          <button className="text-btn" onClick={onShuffle} disabled={!queue.length}>
            <Shuffle size={12} /> Shuffle queue
          </button>
          <button className="text-btn queue-clear-btn" onClick={onClear} disabled={!queue.length}>
            <Trash2 size={12} /> Clear queue
          </button>
        </div>}
      </div>

      {undo && <div className="queue-undo" role="status">Removed from queue <button className="text-btn" onClick={()=>{undo.action();setUndo(null)}}>Undo</button></div>}
      <div className="queue-now-card" data-testid="queue-now-playing">
        <Cover track={track} size="cover-size-sm" playing={isPlaying} />
        <div>
          <span className="queue-now-label"><AudioLines /> {isPlaying ? 'Now playing' : 'Paused'}</span>
          <strong>{track?.title || 'Nothing playing'}</strong>
          <small>{track?.artist || 'EchoSync'}</small>
        </div>
      </div>

      {!room && <div className="queue-filter-chips" role="group" aria-label="Queue filters">
        {QUEUE_FILTERS.map(mode => <button key={mode} type="button" aria-pressed={filterMode === mode} onClick={() => onFilter(mode)}>{mode}</button>)}
      </div>}
      <div className="queue-drawer-list">
        <div className="queue-drawer-list-head">
          <span>Up next in queue</span>
          <b>{upcoming.length}</b>
        </div>
        {upcoming.length === 0 ? (
          <div className="queue-empty queue-drawer-empty">
            <span className="empty-icon"><ListMusic /></span>
            <strong>{filterMode === 'All' ? 'No tracks waiting' : 'No matches for this filter'}</strong>
            <p>{filterMode === 'All' ? 'Add songs from Search to build what plays next.' : 'Try All to see the rest of your queue.'}</p>
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
            {room && <RoomVote room={room} trackId={item.id}/>}
            {!room && <details className="queue-drawer-row-actions"><summary aria-label={`Actions for ${item?.title || "track"}`}>•••</summary>
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
                onClick={() => {const action=onRemove(index);if(action)setUndo({action})}}
                aria-label={`Remove ${item?.title || 'track'} from queue`}
                title="Remove from queue"
              >
                <X />
              </button>
            </details>}
          </div>
        ))}
      </div>
    </aside>
  )
})
