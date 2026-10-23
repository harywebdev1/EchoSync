import { ModalShell } from './ModalShell.jsx'
import { X, Sparkles } from 'lucide-react'
import { TastePicker } from './TastePicker.jsx'

export function TasteModal({ profile, onClose, onSave }) {
  return (
    <ModalShell onClose={onClose} size="modal-taste">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> TASTE PROFILE</span>
          <h2>Tune Your Taste</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close taste tuning"><X /></button>
      </div>
      <div className="modal-body taste-modal-body">
        <div className="taste-intro">
          <span className="taste-intro-glyph"><Sparkles /></span>
          <div>
            <h3>Tell EchoSync what moves you.</h3>
            <p>Your picks shape Search suggestions, daily mixes, and the shortcuts waiting when you open search. Change them whenever you like.</p>
          </div>
        </div>
        <TastePicker selected={profile.tuned} onSave={onSave} onSkip={onClose} />
      </div>
    </ModalShell>
  )
}
