import { useState } from 'react'
import { Crown, DoorOpen, ShieldCheck, X } from 'lucide-react'
import { ModalShell } from './ModalShell.jsx'
import { Avatar } from '../Avatar'

export function LeaveRoomModal({ prompt, room, members = {}, onClose, onAssignLeave }) {
  const candidates = (prompt?.members || []).filter(Boolean)
  const [assignee, setAssignee] = useState(candidates[0] || '')

  return (
    <ModalShell onClose={onClose} size="modal-members">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {room?.name || 'Listening room'}</span>
          <h2>Assign an Admin or DJ before leaving</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close leave room dialog"><X /></button>
      </div>
      <div className="modal-body">
        <p className="leave-handover-copy">
          You are the Admin of this room. Pick someone to keep the queue moving before you leave —
          the room stays saved and you can rejoin as Admin anytime.
        </p>
        <div className="leave-handover-list">
          {candidates.map((id) => {
            const member = members[id] || {}
            const active = assignee === id
            return (
              <button
                type="button"
                key={id}
                className={`leave-handover-row ${active ? 'active' : ''}`}
                onClick={() => setAssignee(id)}
                aria-pressed={active}
              >
                <Avatar member={member} size="sm" />
                <span className="leave-handover-copy-cell">
                  <strong>{member.name || id}</strong>
                  <small>@{member.handle || 'listener'}</small>
                </span>
                <span className="leave-handover-role">
                  {active ? <Crown size={12} /> : <ShieldCheck size={12} />}
                  {active ? 'New Admin' : 'Make Admin'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="leave-handover-actions">
          <button type="button" className="text-btn" onClick={onClose}>Stay in room</button>
          <button
            type="button"
            className="primary-btn"
            disabled={!assignee}
            onClick={() => onAssignLeave?.(assignee)}
          >
            <DoorOpen size={14} /> Assign &amp; Leave
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
