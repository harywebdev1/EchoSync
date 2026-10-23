import { useState } from 'react'
import { ROOM_GRADIENTS, roomCode } from '../../lib/appServices.js'
import { ModalShell } from './ModalShell.jsx'
import { X, Lock, Globe2, Check, Copy, RefreshCw, Trash2, Plus } from 'lucide-react'

export function RoomModal({ mode, room, onClose, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(() => ({
    name: room?.name || '',
    tagline: room?.tagline || '',
    description: room?.description || '',
    gradient: ROOM_GRADIENTS.find((gradient) => gradient.accent === room?.accent)?.id || ROOM_GRADIENTS[0].id,
    private: Boolean(room?.private),
    code: room?.code || roomCode(),
    trackIds: mode === 'edit' && Array.isArray(room?.trackIds) ? [...room.trackIds] : [],
  }))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const submit = (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      name: form.name,
      tagline: form.tagline,
      description: form.description,
      private: form.private,
      code: mode === 'edit' ? form.code : undefined,
      trackIds: form.trackIds,
    }
    if (mode === 'create') onCreate({ ...payload, gradient: form.gradient })
    else onUpdate(payload)
  }

  return (
    <ModalShell onClose={onClose} size="modal-room">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {mode === 'create' ? 'NEW ROOM' : 'ROOM SETTINGS'}</span>
          <h2>{mode === 'create' ? 'Start a listening room' : `Tune ${room?.name}`}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close room editor"><X /></button>
      </div>
      <form className="modal-body room-form" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span>Room name</span>
            <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Sunday Slow Jams" />
          </label>
          <label className="field">
            <span>Tagline</span>
            <input value={form.tagline} onChange={(event) => setForm((value) => ({ ...value, tagline: event.target.value }))} placeholder="One line about the vibe" />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea rows={2} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="What happens in this room?" />
        </label>

        <div className="field">
          <span>Room gradient</span>
          <div className="gradient-grid">
            {ROOM_GRADIENTS.map((gradient) => (
              <button
                type="button"
                key={gradient.id}
                className={`gradient-swatch ${form.gradient === gradient.id ? 'selected' : ''}`}
                style={{ '--c1': gradient.c1, '--c2': gradient.c2 }}
                onClick={() => setForm((value) => ({ ...value, gradient: gradient.id }))}
                aria-label={`${gradient.id} gradient`}
              />
            ))}
          </div>
        </div>

        <label className="field">
          <span>Room privacy</span>
          <select value={form.private ? 'private' : 'open'} onChange={(event) => setForm((value) => ({ ...value, private: event.target.value === 'private' }))}>
            <option value="open">Public — 1-click join</option>
            <option value="private">Private — passcode or invite</option>
          </select>
        </label>

        {mode === 'edit' && (
          <div className={`room-code-box ${form.private ? 'locked' : ''}`}>
            <div className="room-code-copy">
              <span>{form.private ? <Lock size={12} /> : <Globe2 size={12} />} Room passcode</span>
              <code data-testid="room-code">{form.code}</code>
              <small>{form.private ? 'Required to enter unless a member invites you.' : 'Share it for code joins; public rooms still open in one click.'}</small>
            </div>
            <div className="room-code-actions">
              <button
                type="button"
                className="text-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(form.code)
                    setCopiedCode(true)
                    setTimeout(() => setCopiedCode(false), 1800)
                  } catch {
                    setCopiedCode(false)
                  }
                }}
              >
                {copiedCode ? <Check size={12} /> : <Copy size={12} />} {copiedCode ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setForm((value) => ({ ...value, code: roomCode() }))}
              >
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>
          </div>
        )}

        <div className="settings-note room-queue-note">
          {mode === 'create'
            ? 'The room starts empty. Add songs together once everyone arrives.'
            : form.trackIds.length
              ? 'This room already has a shared queue.'
              : 'The room queue is empty. Add songs together once everyone arrives.'}
        </div>

        <div className="modal-actions">
          {mode === 'edit' && (
            <button
              type="button"
              className={`text-btn danger-btn ${confirmDelete ? 'confirm' : ''}`}
              onClick={() => {
                if (confirmDelete) onDelete()
                else setConfirmDelete(true)
              }}
            >
              <Trash2 size={12} /> {confirmDelete ? 'Tap again to delete room' : 'Delete room'}
            </button>
          )}
          <span className="grow" />
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit">{mode === 'create' ? <Plus /> : <Check />} {mode === 'create' ? 'Create room' : 'Save changes'}</button>
        </div>
      </form>
    </ModalShell>
  )
}
