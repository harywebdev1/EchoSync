import { useEffect, useRef } from 'react'

export function usePanelFocus() {
  const ref = useRef(null)
  useEffect(() => {
    const panel = ref.current, previous = document.activeElement
    if (!panel) return
    const items = () => [...panel.querySelectorAll('button:not(:disabled),summary,input,select,a[href],[tabindex="0"]')].filter(e => e.getClientRects().length)
    items()[0]?.focus({preventScroll:true})
    const trap = event => {
      if (event.key !== 'Tab') return
      const list = items(), first = list[0], last = list.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    panel.addEventListener('keydown', trap)
    return () => { panel.removeEventListener('keydown',trap); if(previous?.isConnected) previous.focus({preventScroll:true}) }
  }, [])
  return ref
}
