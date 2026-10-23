import { loadTasteProfile } from '../../lib/appServices.js'
import { useMemo } from 'react'
import { topTasteLabels, extractTopVibeTags } from '../../core/tasteEngine.js'
import { X, UserPlus } from 'lucide-react'
import { Avatar } from '../Avatar'

export function LoungeUserCard({ member, currentUser, room, inviting, onClose, onInvite }) {
  const profile = member?.id ? loadTasteProfile(member.id) : null
  const taste = useMemo(() => {
    if (!profile) return []
    return [...new Set([
      ...topTasteLabels(profile.artists, 2),
      ...topTasteLabels(profile.genres, 2),
      ...extractTopVibeTags(profile, 1),
    ])].slice(0, 3)
  }, [profile])
  if (!member) return null
  const self = member.id === currentUser?.id
  const alreadyInRoom = Boolean(room?.members?.includes(member.id))
  const invitesClosed = member.allowInvites === false
  const disabled = self || alreadyInRoom || invitesClosed || inviting
  const label = self
    ? 'This is you'
    : alreadyInRoom
      ? 'Already in this room'
      : invitesClosed
        ? 'Invites closed'
        : inviting
          ? 'Sending invite…'
          : 'Invite to Private Room'
  return (
    <div className="lounge-user-card" data-testid="lounge-user-card">
      <button className="lounge-user-close" onClick={onClose} aria-label="Close user card"><X /></button>
      <div className="lounge-user-top">
        <Avatar member={member} size="lg" online={Boolean(member.online || self)} />
        <div>
          <strong>{member.name}</strong>
          <span>@{member.handle}</span>
          <small className={member.online || self ? 'online' : ''}>
            <i /> {member.online || self ? 'Online now' : 'EchoSync listener'}
          </small>
        </div>
      </div>
      <div className="lounge-user-taste">
        <span className="lounge-user-label">LISTENING DNA</span>
        {member.showActivity === false ? (
          <p>Keeps their listening taste private.</p>
        ) : taste.length ? (
          <div>{taste.map((item) => <span key={item}>{item}</span>)}</div>
        ) : (
          <p>Taste profile is still warming up.</p>
        )}
      </div>
      <button
        className="lounge-invite-btn"
        onClick={() => onInvite?.(member)}
        disabled={disabled}
        data-testid="lounge-invite-btn"
      >
        <UserPlus /> {label}
      </button>
    </div>
  )
}
