import { Lock, Check } from 'lucide-react'

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`toast ${toast.tone || ''}`} key={toast.id} role="status" aria-live="polite">
      {toast.tone === 'lock' ? <Lock /> : <Check />}
      <span>{toast.message}</span>
    </div>
  )
}
