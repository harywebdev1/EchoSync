import { useEffect, useRef, useState } from 'react'
import { Check, Lock, X } from 'lucide-react'

const DISMISS_AFTER = 3200
const EXIT_MS = 180

/**
 * The one and only notification surface in the app.
 *
 * Every transient toast and the persistent preview-ended notice render inside
 * this fixed viewport so nothing can drift into a view or drawer. Only one
 * notification exists at a time — a newer toast replaces the previous one.
 */
export function ToastViewport({ toast, onDismiss, children }) {
  const [leaving, setLeaving] = useState(false)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss
  const activeIdRef = useRef(null)

  useEffect(() => {
    activeIdRef.current = toast?.id ?? null
    if (!toast) {
      setLeaving(false)
      return undefined
    }
    setLeaving(false)
    const leaveTimer = setTimeout(() => setLeaving(true), DISMISS_AFTER)
    const removeTimer = setTimeout(() => {
      if (activeIdRef.current === toast.id) dismissRef.current?.()
    }, DISMISS_AFTER + EXIT_MS)
    return () => {
      clearTimeout(leaveTimer)
      clearTimeout(removeTimer)
    }
  }, [toast?.id])

  const dismissNow = () => {
    if (!toast) return
    const id = toast.id
    setLeaving(true)
    setTimeout(() => {
      if (activeIdRef.current === id) dismissRef.current?.()
    }, EXIT_MS)
  }

  return (
    <div className="es-toast-viewport" aria-live="polite" aria-atomic="true">
      {toast ? (
        <div
          key={toast.id}
          className={`es-toast ${toast.tone || ''} ${leaving ? 'leaving' : ''}`}
          role="status"
        >
          <span className="es-toast-icon" aria-hidden="true">
            {toast.tone === 'lock' ? <Lock /> : <Check />}
          </span>
          <span className="es-toast-message">{toast.message}</span>
          <button
            type="button"
            className="es-toast-close"
            onClick={dismissNow}
            aria-label="Dismiss notification"
          >
            <X />
          </button>
        </div>
      ) : children}
    </div>
  )
}
