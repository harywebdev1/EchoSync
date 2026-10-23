/** Position is in seconds; the caller supplies the authoritative wall-clock timestamp in ms.
 * Do not wrap at track duration here: queue advancement belongs to the room controller.
 */
export function getLiveRoomPosition(clock, nowMs) {
  if (!clock?.roomId) return 0
  const elapsed = clock.isPlaying ? Math.max(0, nowMs - (clock.updatedAt || nowMs)) / 1000 : 0
  return Math.max(0, (Number(clock.time) || 0) + elapsed)
}

/** Compare positions in seconds. Keep the exact difference for seek decisions;
 * milliseconds are rounded only for display, matching the existing telemetry store.
 */
export function computeMemberDrift(memberPositionSeconds, livePositionSeconds) {
  const seconds = Math.abs(memberPositionSeconds - livePositionSeconds)
  return { seconds, milliseconds: Math.round(seconds * 1000) }
}

export function classifyDrift(milliseconds) {
  if (milliseconds < 300) return 'green'
  if (milliseconds <= 1000) return 'amber'
  return 'red'
}

export function getDriftTone(milliseconds) {
  return { green: 'good', amber: 'fair', red: 'poor' }[classifyDrift(milliseconds)]
}

export function getDriftLabel(milliseconds) {
  return { green: 'Synced', amber: 'Drifting', red: 'Lagging' }[classifyDrift(milliseconds)]
}
