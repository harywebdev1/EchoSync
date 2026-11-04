export const LOUNGE_LIFETIME_MS = 24 * 60 * 60 * 1000
export function isFreshLoungeMessage(message, now = Date.now()) {
  const created = Number(message?.createdAt) || Date.parse(message?.created_at || '')
  return Number.isFinite(created) && created >= now - LOUNGE_LIFETIME_MS && created <= now + 60000
}
