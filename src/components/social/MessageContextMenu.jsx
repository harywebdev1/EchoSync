import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
export function MessageContextMenu({
  anchor,
  onClose,
  onReply,
  onProfile,
  onPlay,
  onDelete,
  onReact
}) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [position, setPosition] = useState({ left: 8, top: 8 })
  useLayoutEffect(() => {
    const previous = document.activeElement
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const node = ref.current
      const w = node?.offsetWidth || 240
      const h = node?.offsetHeight || 260
      const margin = 8
      const gap = 6
      const scroller = anchor.closest('.chat-body')
      const bounds = scroller?.getBoundingClientRect()
      const topLimit = Math.max(margin, (bounds?.top ?? 0) + margin)
      const bottomLimit = Math.min(innerHeight - margin, (bounds?.bottom ?? innerHeight) - margin)
      const below = r.bottom + gap
      const above = r.top - gap - h
      const fitsBelow = below + h <= bottomLimit
      const fitsAbove = above >= topLimit
      let top
      if (fitsBelow) top = below
      else if (fitsAbove) top = above
      else top = Math.max(topLimit, Math.min(bottomLimit - h, below))
      const left = Math.max(margin, Math.min(innerWidth - w - margin, r.right - w))
      setPosition({ left, top })
    }
    place()
    ref.current?.querySelector('button')?.focus({ preventScroll: true })
    const dismiss = (e) => {
      if (!ref.current?.contains(e.target) && !anchor.contains(e.target))
        closeRef.current()
    }
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab') {
        const buttons = [...ref.current.querySelectorAll('button')]
        const index = buttons.indexOf(document.activeElement)
        e.preventDefault()
        buttons[
          (index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        ]?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', key, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', key, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [anchor])
  const run = (action) => () => {
    action?.()
    onClose()
  }
  return createPortal(
    <div
      ref={ref}
      className="message-context-menu"
      role="menu"
      aria-label="Message actions"
      style={position}
    >
      <div className="message-reaction-row">
        {['❤️', '🔥', '👏', '😂', '😮'].map((emoji) => (
          <button
            key={emoji}
            role="menuitem"
            aria-label={'React ' + emoji}
            onClick={run(() => onReact(emoji))}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button role="menuitem" onClick={run(onReply)}>
        ↩ Reply
      </button>
      <button role="menuitem" onClick={run(onProfile)}>
        👤 View channel
      </button>
      {onPlay && (
        <button role="menuitem" onClick={run(onPlay)}>
          🎵 Play track
        </button>
      )}
      {onDelete && (
        <button role="menuitem" className="danger" onClick={run(onDelete)}>
          🗑 Delete
        </button>
      )}
    </div>,
    document.querySelector('.app') || document.body
  )
}
