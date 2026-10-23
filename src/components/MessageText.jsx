export function MessageText({ text, members, currentUserId, onTag }) {
  const parts = String(text).split(/(@[\w.]+)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (!part.startsWith('@')) return <span key={`${part}-${index}`}>{part}</span>
        const handle = part.slice(1).toLowerCase()
        const member = Object.values(members).find((candidate) => candidate?.handle === handle)
        const mine = member?.id === currentUserId
        return (
          <button
            key={`${part}-${index}`}
            className={`mention-pill ${mine ? 'mine' : ''}`}
            onClick={() => member && onTag(member)}
          >
            {part}
          </button>
        )
      })}
    </>
  )
}
