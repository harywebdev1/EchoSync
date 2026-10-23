import { useState } from 'react'
import { ModalShell } from './ModalShell.jsx'
import { X, KeyRound, AlertCircle, DoorOpen } from 'lucide-react'

export function JoinRoomModal({ onClose, onJoin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onClose} size="modal-join">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> JOIN A ROOM</span>
          <h2>Enter the room code</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close join room"><X /></button>
      </div>
      <form
        className="modal-body"
        onSubmit={(event) => {
          event.preventDefault()
          const result = onJoin(code)
          if (result?.error) setError(result.error)
        }}
      >
        <div className="join-code-art"><KeyRound /></div>
        <p className="join-hint">Ask the host for their <b>ES-####</b> code, or open their invite link. You’ll join as a Listener.</p>
        <label className="field">
          <span>Room code</span>
          <input value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError('') }} placeholder="ES-4829" autoFocus />
        </label>
        {error && <span className="auth-error"><AlertCircle size={12} /> {error}</span>}
        <div className="modal-actions">
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit"><DoorOpen size={12} /> Join room</button>
        </div>
      </form>
    </ModalShell>
  )
}
