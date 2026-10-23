import { useMembers } from './MembersContext'
import { Avatar } from '../Avatar'

export function AvatarStack({ ids = [], size = 'xs', max = 4 }) {
  const members = useMembers()
  return (
    <div className="avatar-stack">
      {ids.slice(0, max).map((id) => (
        <Avatar key={id} member={members[id]} size={size} />
      ))}
    </div>
  )
}
