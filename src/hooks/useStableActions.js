import { useLayoutEffect, useMemo, useRef } from 'react'

// Stable UI command identities dispatch to the latest committed controller closure.
export function useStableActions(model) {
  const committed = useRef(model)
  useLayoutEffect(() => { committed.current = model })
  const actions = useMemo(() => Object.fromEntries(Object.keys(model)
    .filter(key => typeof model[key] === 'function')
    .map(key => [key, (...args) => committed.current[key](...args)])), [])
  return { ...model, ...actions }
}
