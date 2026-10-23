export function Avatar({ member, size = '', online = false, className = '' }) {
  if (!member) return null
  return (
    <span
      className={`avatar ${size} ${className}`}
      style={{ '--av1': member.av1, '--av2': member.av2 }}
      title={member.name ? `${member.name} @${member.handle || ''}` : undefined}
    >
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : member.initials}
      {online && <i className="avatar-online" />}
    </span>
  )
}
