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
      const h = ref.current?.offsetHeight || 220
      setPosition({
        left: Math.max(8, Math.min(innerWidth - 248, r.right - 240)),
        top: Math.max(8, Math.min(innerHeight - h - 8, r.bottom + 6))
      })
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
        👤 View profile
      </button>
      {onPlay && (
        <button role="menuitem" onClick={run(onPlay)}>
          🎵 Play song
        </button>
      )}
      {onDelete && (
        <button role="menuitem" className="danger" onClick={run(onDelete)}>
          🗑 Delete message
        </button>
      )}
    </div>,
    document.querySelector('.app') || document.body
  )
}
