import { useLayoutEffect, useRef } from 'react'

const KEY = '__echoOverlay'

// Only owned same-document entries are traversed. The original route/state is preserved.
export function useOverlayHistory(overlays) {
  const latest = useRef(overlays)
  const runtime = useRef(null)
  if (!runtime.current) {
    const existing = window.history.state?.[KEY]
    runtime.current = { owner: existing?.owner || `echo-${Date.now()}-${Math.random()}`, stack: existing?.stack || [], pending: false, internal: false }
  }
  useLayoutEffect(() => { latest.current = overlays })
  useLayoutEffect(() => {
    const state = runtime.current
    const marker = () => {
      const value = window.history.state?.[KEY]
      return value?.owner === state.owner ? value : null
    }
    const write = (method, stack) => window.history[method]({ ...(window.history.state || {}), [KEY]: { owner: state.owner, stack } }, '')
    const back = () => { state.pending = true; state.internal = true; window.history.back() }
    const reconcile = () => {
      if (state.pending) return
      const open = latest.current.filter(item => item.open).map(item => item.id)
      const kept = state.stack.filter(id => open.includes(id))
      const added = open.filter(id => !state.stack.includes(id))
      const removed = kept.length < state.stack.length
      if (removed && added.length && marker()) {
        state.stack = [...kept, ...added]
        write('replaceState', state.stack)
      } else if (removed) {
        // UI dismissal traverses the owned entry instead of leaving an empty Back stop.
        if (marker()) back()
        else { state.stack = kept; reconcile() }
      } else {
        for (const id of added) {
          state.stack = [...state.stack, id]
          write('pushState', state.stack)
        }
      }
    }
    const pop = () => {
      const target = marker()
      const open = new Set(latest.current.filter(item => item.open).map(item => item.id))
      const desired = (target?.stack || []).filter(id => open.has(id))
      const internal = state.internal
      state.pending = false
      state.internal = false
      if (!internal) {
        for (const id of [...state.stack].reverse()) {
          if (!desired.includes(id)) latest.current.find(item => item.id === id)?.onClose()
        }
      }
      state.stack = desired
      if (target && !desired.length) back()
      else if (internal) reconcile()
    }
    state.reconcile = reconcile
    window.addEventListener('popstate', pop)
    reconcile()
    return () => { window.removeEventListener('popstate', pop); state.reconcile = null }
  }, [])
  useLayoutEffect(() => { runtime.current.reconcile?.() })
}
