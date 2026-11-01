// One ordering tuple per room; actor breaks simultaneous wall-clock ties.
export function commandStamp(event) {
  return {
    version: Number(event?.stateVersion ?? event?.room?.stateVersion ?? event?.ts) || 0,
    actor: String(event?.lastActorId || event?.room?.lastActorId || event?.userId || event?.sender || ''),
  }
}
export function compareCommands(a, b) {
  const left = commandStamp(a),
    right = commandStamp(b)
  return left.version - right.version || left.actor.localeCompare(right.actor)
}
export function driftCorrection(local, target, { explicit = false, loaded = false } = {}) {
  const delta = target - local,
    drift = Math.abs(delta)
  if (explicit || loaded || drift > 3) return { seek: true, rate: 1 }
  return { seek: false, rate: drift < 0.5 ? 1 : delta > 0 ? 1.03 : 0.97 }
}
