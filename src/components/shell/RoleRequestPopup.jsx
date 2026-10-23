import { BellRing, Check, X } from 'lucide-react'

export function RoleRequestPopup({ request, requester, roomName, onApprove, onDecline }) {
  if (!request) return null
  return (
    <div className="role-request-popup">
      <span className="role-request-icon"><BellRing /></span>
      <div>
        <strong>🔔 @{requester?.handle || request.userId} is requesting {request.requested === 'admin' ? 'Admin' : 'DJ'} permissions</strong>
        <span>in {roomName}</span>
      </div>
      <button className="request-approve" onClick={onApprove}><Check size={12} /> Approve {request.requested === 'admin' ? 'Admin' : 'DJ'}</button>
      <button className="request-decline" onClick={onDecline}><X size={12} /> Decline</button>
    </div>
  )
}
