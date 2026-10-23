import { BellRing } from 'lucide-react'

export function InviteBanner({ invite, onAccept, onDecline }) {
  if (!invite) return null
  return (
    <div className="live-invite-banner">
      <span className="live-invite-icon"><BellRing /></span>
      <div>
        <strong>🎵 @{invite.fromHandle || 'a listener'} invited you to join room {invite.roomName}</strong>
        <span>Code {invite.roomCode} · you’ll join as a Listener</span>
      </div>
      <button className="primary-btn" onClick={onAccept}>Accept & Join</button>
      <button className="text-btn ghosted" onClick={onDecline}>Decline</button>
    </div>
  )
}
