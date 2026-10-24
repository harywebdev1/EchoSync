export function voteCount(votes = {}) { return Object.values(votes).filter(vote => vote?.active).length }
export function rankRoomQueue(ids, currentIndex, votes = {}, original = ids) {
  const order = [...new Set([...original, ...ids])]
  const prefix = ids.slice(0, currentIndex + 1)
  return [...prefix, ...ids.slice(currentIndex + 1).sort((a,b) => voteCount(votes[b]) - voteCount(votes[a]) || order.indexOf(a) - order.indexOf(b))]
}
export function mergeVote(votes, trackId, userId, change) {
  const previous = votes?.[trackId]?.[userId]
  if (!Number.isFinite(change?.ts) || (previous && (previous.ts > change.ts || (previous.ts === change.ts && String(previous.op) >= String(change.op))))) return votes || {}
  return { ...votes, [trackId]: { ...votes?.[trackId], [userId]: { active: change.active === true, ts: change.ts, op: String(change.op || '') } } }
}
