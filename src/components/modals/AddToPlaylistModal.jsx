import { ModalShell } from './ModalShell.jsx'
import { X, Plus, ListMusic, Check } from 'lucide-react'

export function AddToPlaylistModal({ track, playlists, onClose, onAdd, onCreate }) {
  return (
    <ModalShell onClose={onClose} size="modal-add-playlist">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> ADD TO PLAYLIST</span>
          <h2>{track?.title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close add to playlist"><X /></button>
      </div>
      <div className="modal-body">
        <button className="new-playlist-row" onClick={() => onCreate(track)}>
          <span className="new-playlist-glyph"><Plus /></span>
          <span><strong>New playlist</strong><small>Create one and add this song</small></span>
        </button>
        <div className="add-playlist-list">
          {playlists.length === 0 && <p className="modal-hint">No playlists yet. Create one above.</p>}
          {playlists.map((playlist) => {
            const added = playlist.trackIds.includes(track?.id)
            return (
              <button key={playlist.id} className={`add-playlist-row ${added ? 'added' : ''}`} onClick={() => onAdd(playlist.id)}>
                <span className="new-playlist-glyph"><ListMusic /></span>
                <span>
                  <strong>{playlist.name}</strong>
                  <small>{playlist.trackIds.length} track{playlist.trackIds.length === 1 ? '' : 's'}</small>
                </span>
                {added ? <span className="added-tag"><Check size={11} /> Added</span> : <Plus size={14} />}
              </button>
            )
          })}
        </div>
      </div>
    </ModalShell>
  )
}
