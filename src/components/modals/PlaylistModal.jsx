import { useState } from 'react'
import { ModalShell } from './ModalShell.jsx'
import { X, Save, Plus } from 'lucide-react'

export function PlaylistModal({ mode, playlist, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: playlist?.name || '',
    description: playlist?.description || '',
  })
  return (
    <ModalShell onClose={onClose} size="modal-playlist">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {mode === 'edit' ? 'EDIT PLAYLIST' : 'NEW PLAYLIST'}</span>
          <h2>{mode === 'edit' ? 'Make it feel right' : 'A new collection'}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close playlist"><X /></button>
      </div>
      <form
        className="modal-body"
        onSubmit={(event) => {
          event.preventDefault()
          if (!form.name.trim()) return
          onSubmit({ name: form.name.trim(), description: form.description.trim() })
        }}
      >
        <label className="field">
          <span>Playlist name</span>
          <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Late night, full volume" autoFocus />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={3} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="What is this playlist for?" />
        </label>
        <div className="modal-actions">
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit">{mode === 'edit' ? <Save size={12} /> : <Plus size={12} />} {mode === 'edit' ? 'Save playlist' : 'Create playlist'}</button>
        </div>
      </form>
    </ModalShell>
  )
}
