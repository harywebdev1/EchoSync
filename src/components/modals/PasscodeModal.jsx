import { useState } from 'react'
import { ModalShell } from './ModalShell.jsx'
import { X, Lock, AlertCircle, KeyRound } from 'lucide-react'

export function PasscodeModal({ room, onClose, onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onClose} size="modal-join">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> PRIVATE ROOM</span>
          <h2>{room?.name || 'Locked room'}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close passcode"><X /></button>
      </div>
      <form
        className="modal-body"
        onSubmit={(event) => {
          event.preventDefault()
          const result = onUnlock(code)
          if (result?.error) setError(result.error)
        }}
      >
        <div className="join-code-art private-code-art"><Lock /></div>
        <p className="join-hint">This room is private. Enter its <b>ES-XXXX</b> passcode, or open the host’s invite link.</p>
        <label className="field">
          <span>Room passcode</span>
          <input
            value={code}
            onChange={(event) => { setCode(event.target.value.toUpperCase()); setError('') }}
            placeholder="ES-4829"
            autoFocus
            data-testid="private-room-code"
          />
        </label>
        {error && <span className="auth-error"><AlertCircle size={12} /> {error}</span>}
        <div className="modal-actions">
          <button type="button" className="text-btn ghosted" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit"><KeyRound size={12} /> Unlock room</button>
        </div>
      </form>
    </ModalShell>
  )
}
