import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSleepTimer, sleepExpired, sleepRemaining } from '../core/sleepTimer.js'

export function useSleepTimer(onExpire) {
  const [timer, setTimer] = useState(() => createSleepTimer())
  const [remainingMs, setRemainingMs] = useState(0)
  const active = useRef(timer)
  const expire = useRef(onExpire)
  useEffect(() => { expire.current = onExpire })
  const finish = useCallback(() => {
    if (active.current.mode === 'off') return false
    active.current = createSleepTimer()
    setTimer(active.current)
    setRemainingMs(0)
    expire.current()
    return true
  }, [])
  const select = useCallback(mode => {
    active.current = createSleepTimer(mode)
    setTimer(active.current)
    setRemainingMs(sleepRemaining(active.current))
  }, [])
  useEffect(() => {
    if (timer.deadline == null) return undefined
    const tick = () => {
      if (sleepExpired(active.current)) finish()
      else setRemainingMs(sleepRemaining(active.current))
    }
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [timer, finish])
  const onTrackEnded = useCallback(() => active.current.endOfTrack ? finish() : false, [finish])
  const sleepTimer = useMemo(() => ({ ...timer, remainingMs }), [timer, remainingMs])
  return { sleepTimer, setSleepTimer: select, onSleepTrackEnded: onTrackEnded }
}
