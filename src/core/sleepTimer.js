export const SLEEP_MODES = ['off', '15m', '30m', 'end-of-track']
export function createSleepTimer(mode = 'off', now = Date.now()) {
  if (!SLEEP_MODES.includes(mode)) mode = 'off'
  return { mode, endOfTrack: mode === 'end-of-track', deadline: mode === '15m' ? now + 15 * 60_000 : mode === '30m' ? now + 30 * 60_000 : null }
}
export function sleepRemaining(timer, now = Date.now()) {
  return timer.deadline == null ? 0 : Math.max(0, timer.deadline - now)
}
export function sleepExpired(timer, now = Date.now()) {
  return timer.deadline != null && now >= timer.deadline
}
