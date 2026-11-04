import { useCallback, useState } from 'react'
export function useNotifications(setToast) {
  const [notifications, setNotifications] = useState([])
  const notify = useCallback((message, tone = 'info') => {
    const category = /mention|message|chat/i.test(message) ? 'chat' : /room|role|DJ|joined|left|invite/i.test(message) ? 'room' : /song|queue|playlist|track/i.test(message) ? 'music' : 'system'
    const titles = { chat: 'Chat', room: 'Room activity', music: 'Your music', system: tone === 'lock' ? 'Attention needed' : 'EchoSync' }
    const entry = typeof message === 'object' ? { ...message } : { message, title: titles[category], subtitle: message, category, tone }
    entry.id = Date.now() + Math.random()
    entry.createdAt = Date.now()
    entry.unread = true
    setNotifications(previous => [entry, ...previous].slice(0, 15))
    setToast(entry)
  }, [setToast])
  const markNotificationsRead = useCallback(() => setNotifications(previous => previous.map(item => ({ ...item, unread:false }))), [])
  const clearNotifications = useCallback(() => setNotifications([]), [])
  return { notifications, notify, markNotificationsRead, clearNotifications }
}
