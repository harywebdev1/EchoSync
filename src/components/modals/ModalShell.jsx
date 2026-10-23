import { useRef, useId, useState, useEffect } from 'react'

export function ModalShell({ children, onClose, size = '' }) {
  const modalRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const previousFocusRef = useRef(
    typeof document !== 'undefined'
      && document.activeElement instanceof HTMLElement
      && !document.activeElement.closest('[role="dialog"]')
      ? document.activeElement
      : null,
  )
  const titleId = useId()
  const [labelledBy, setLabelledBy] = useState(titleId)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const node = modalRef.current
    if (!node) return undefined
    const heading = node.querySelector('h1') || node.querySelector('h2') || node.querySelector('h3')
    if (heading) {
      if (!heading.id) heading.id = titleId
      setLabelledBy(heading.id)
    } else {
      setLabelledBy('')
    }
    const focusables = () => [...node.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0)
    const first = focusables()[0]
    first?.focus({ preventScroll: true })
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      const target = previousFocusRef.current
      if (!node.isConnected && target instanceof HTMLElement && target.isConnected) {
        target.focus({ preventScroll: true })
      }
    }
  }, [titleId])

  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={modalRef}
        className={`modal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || undefined}
      >
        {children}
      </div>
    </div>
  )
}
