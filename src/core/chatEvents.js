// Delivery IDs, never message text, identify duplicate events. A listener may
// legitimately leave and rejoin with the same announcement text.
export function conversationEntries(messages) {
  const seen = new Set(), entries = []
  for (const message of messages) {
    if (message.id && seen.has(message.id)) continue
    if (message.id) seen.add(message.id)
    const previous = entries.at(-1)
    if (message.system && previous?.system) previous.notices.push(message)
    else entries.push(message.system ? { ...message, notices: [message] } : message)
  }
  return entries
}
