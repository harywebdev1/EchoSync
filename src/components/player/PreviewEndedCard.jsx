import { Headphones, LogIn, RotateCcw, X } from 'lucide-react'

export function PreviewEndedCard({ visible, onSignIn, onReplay, onDismiss }) {
  if (!visible) return null
  return (
    <div className="preview-ended-card" role="status" data-testid="preview-ended-card">
      <span className="preview-ended-icon" aria-hidden="true"><Headphones size={15} /></span>
      <p>30s preview ended · Sign in for free full-length streaming</p>
      <div className="preview-ended-actions">
        <button type="button" className="preview-ended-signin" onClick={onSignIn}>
          <LogIn size={13} aria-hidden="true" /> Sign in
        </button>
        <button type="button" className="preview-ended-replay" onClick={onReplay}>
          <RotateCcw size={13} aria-hidden="true" /> Replay 30s
        </button>
        <button type="button" className="preview-ended-close" onClick={onDismiss} aria-label="Dismiss preview notice">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
