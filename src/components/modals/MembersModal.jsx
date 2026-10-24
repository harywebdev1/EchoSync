import { MemberDrift } from '../social/RoomSocialControls.jsx'
import { useSocial } from '../social/SocialContext.jsx'
import { useState } from 'react'
import { ModalShell } from './ModalShell.jsx'
import { X, Check, Copy, Link2, UserRoundPlus, Send, ShieldCheck, Disc3, Headphones, UserMinus, Shield } from 'lucide-react'
import { Avatar } from '../Avatar'
import { TelemetryPill } from '../TelemetryPill'
import { ROLE_COPY } from '../shared/roomRoles'

export function MembersModal({
  room,
  currentUserId,
  canModerate,
  roles,
  members,
  users,
  requests,
  onClose,
  onInviteUser,
  onCopyLink,
  onKick,
  onAssignRole,
  onResolveRequest,
}) {
  const social=useSocial()
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const code = room.code || 'ES-0000'

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      /* clipboard can be unavailable */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const copyLink = async () => {
    const link = `${window.location.origin}/?room=${encodeURIComponent(code)}`
    try {
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1600)
    } catch {
      /* clipboard can be unavailable */
    }
    onCopyLink?.(link)
  }

  const matches = canModerate && query.trim()
    ? Object.values(users)
      .filter((user) => user.id !== currentUserId && !room.members.includes(user.id))
      .filter((user) => {
        const needle = query.trim().toLowerCase().replace(/^@/, '')
        return user.handle?.toLowerCase().includes(needle) || user.email?.toLowerCase().includes(needle) || user.name?.toLowerCase().includes(needle)
      })
      .slice(0, 5)
    : []

  const submit = (event) => {
    event.preventDefault()
    if (onInviteUser(query)) setQuery('')
  }

  return (
    <ModalShell onClose={onClose} size="modal-members">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> {room.name}</span>
          <h2>Members, invites & roles</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close members"><X /></button>
      </div>
      <div className="modal-body">
        <div className="invite-code-row">
          <button className={`invite-code ${copied ? 'copied' : ''}`} onClick={copyCode}>
            <span>
              <small>ROOM CODE</small>
              <strong>{code}</strong>
            </span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <em>{copied ? 'Copied' : 'Click to copy'}</em>
          </button>
          <button className={`invite-link-btn ${linkCopied ? 'copied' : ''}`} onClick={copyLink}>
            {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
            <span>{linkCopied ? 'Link copied' : 'Copy invite link'}</span>
            <small>Anyone with the link joins as Listener</small>
          </button>
        </div>

        {canModerate && (
          <form className="add-member" onSubmit={submit}>
            <div className="add-member-copy">
              <strong>Invite a registered listener</strong>
              <small>Search by @handle, name, or email. They receive a live invite banner.</small>
            </div>
            <div className="add-member-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="@handle, name, or email" />
              <button className="primary-btn" type="submit"><UserRoundPlus /> Invite</button>
            </div>
            {matches.length > 0 && (
              <div className="invite-search-list">
                {matches.map((user) => (
                  <button type="button" key={user.id} className="invite-search-row" onClick={() => { onInviteUser(user.handle); setQuery('') }}>
                    <Avatar member={user} size="sm" />
                    <span>
                      <strong>{user.name}</strong>
                      <small>@{user.handle} · {user.email}</small>
                    </span>
                    <em><Send size={10} /> Send invite</em>
                  </button>
                ))}
              </div>
            )}
            {query.trim() && !matches.length && <span className="modal-hint">No registered listener matches that search.</span>}
          </form>
        )}

        {canModerate && requests.length > 0 && (
          <div className="pending-requests">
            <span className="modal-hint">PENDING REQUESTS</span>
            {requests.map((request) => (
              <div className="pending-row" key={request.id}>
                <Avatar member={members[request.userId]} size="sm" />
                <span>
                  <strong>{members[request.userId]?.name || request.userId}</strong>
                  <small>Wants {request.requested === 'admin' ? 'Admin' : 'DJ'} access</small>
                </span>
                <button className="request-approve" onClick={() => onResolveRequest(request.id, true)}><Check size={12} /> Approve</button>
                <button className="request-decline" onClick={() => onResolveRequest(request.id, false)}><X size={12} /> Decline</button>
              </div>
            ))}
          </div>
        )}

        <div className="member-list">
          <span className="modal-hint">{room.members.length} IN THE ROOM</span>
          {room.members.map((id) => {
            const member = members[id]
            const memberRole = roles[id] || 'listener'
            const isSelf = id === currentUserId
            return (
              <div className="member-row" key={id}>
                <button className="lounge-avatar-btn" onClick={()=>social.openProfile(id)} aria-label={`Open ${member?.name || id}'s profile`}><Avatar member={member} size="sm" online={member?.online && member?.showActivity !== false} /></button>
                <span className="member-copy">
                  <strong>{member?.name || id} {isSelf && <em>you</em>}</strong>
                  <small>
                    @{member?.handle || id}
                    {member?.online && member?.showActivity !== false && (
                      <em className="member-live"><span className="live-dot" /> Listening</em>
                    )}
                    <MemberDrift roomId={room.id} userId={id}/>
                  </small>
                </span>
                {canModerate && !isSelf ? (
                  <select
                    className={`role-select ${memberRole}`}
                    value={memberRole}
                    onChange={(event) => onAssignRole(id, event.target.value)}
                    aria-label={`Role for ${member?.name || id}`}
                  >
                    <option value="listener">Listener</option>
                    <option value="dj">DJ</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className={`role-label ${memberRole}`}>
                    {memberRole === 'admin' ? <ShieldCheck /> : memberRole === 'dj' ? <Disc3 /> : <Headphones />}
                    {ROLE_COPY[memberRole]?.label || 'Listener'}
                  </span>
                )}
                {canModerate && !isSelf && (
                  <button className="icon-btn member-kick" onClick={() => onKick(id)} aria-label={`Remove ${member?.name || id}`}>
                    <UserMinus />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="social-note"><Shield size={9} /> Admins decide who plays what. DJs can control the queue.</div>
      </div>
    </ModalShell>
  )
}
