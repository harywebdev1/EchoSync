import { Radio, Plus, Lock, Globe2, Headphones, KeyRound, UsersRound, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { Cover } from '../components/Cover'
import { AvatarStack } from '../components/shared/AvatarStack'

export function RoomsView({ rooms, library, currentRoom, currentUser, onJoin, onCreate, onJoinCode, onEditRoom, onDeleteRoom }) {
  return (
    <div className="rooms-view">
      <div className="eyebrow">
        <span className="live-pill"><Radio size={9} /> DISCOVER</span>
        <span className="seg" />
        <span>{rooms.length} {rooms.length === 1 ? 'ROOM' : 'ROOMS'} SAVED</span>
        <span className="grow" />
        <button className="text-btn" onClick={onJoinCode}><KeyRound size={11} /> Join with code</button>
      </div>
      <h1 className="page-title">Find your <em>frequency.</em></h1>
      <p className="page-sub">Small rooms, shared speakers, and a queue that moves together. Start one, invite a friend, or join with a code.</p>

      {!rooms.length&&<div className="rooms-empty-banner" role="status">No rooms saved yet — Start a room below to host a session, or click 'Join with code' if a friend shared a private invite code.</div>}
      <div className="rooms-grid">
        <button className="room-card create-room-card" onClick={onCreate}>
          <div className="rc-create-glyph"><Plus /></div>
          <h2 className="rc-title">Start a room</h2>
          <p className="rc-sub">Pick a vibe, invite the room, and become its Admin.</p>
          <div className="rc-foot">
            <span className="rc-join"><UsersRound size={11} /> Create listening room</span>
          </div>
        </button>
        {rooms.map((room) => {
          const firstCover = room.trackIds.map((id) => library[id]?.cover).find(Boolean)
          const members = room.members || []
          const saved = members.length === 0
          const owned = Boolean(currentUser?.id && (room.ownerId || room.createdBy) === currentUser.id)
          const joined = currentRoom && room.id === currentRoom.id
          return (
            <div
              key={room.id}
              className="room-card"
              style={{ '--rc1': room.c1, '--rc2': room.c2 }}
              role="button"
              tabIndex={0}
              onClick={() => onJoin(room)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onJoin(room)
                }
              }}
            >
              {firstCover && <img src={firstCover} alt="" />}
              <div className="rc-top">
                <span className={`rc-live ${saved ? 'saved' : ''}`}><span className="live-dot" /> {saved ? 'SAVED' : 'LIVE'}</span>
                {room.private
                  ? <span className="rc-private"><Lock size={9} /> Private</span>
                  : <span className="rc-public"><Globe2 size={9} /> Public</span>}
                <span className="rc-listeners">{saved ? 'No one inside · Rejoin anytime' : `${members.length} in the room`}</span>
              </div>
              <h2 className="rc-title">{room.name}</h2>
              <p className="rc-sub">{room.tagline}</p>
              <div className="rc-foot">
                <AvatarStack ids={members} size="xs" max={3} />
                <span>{saved ? 'Saved room' : `${members.length} member${members.length === 1 ? '' : 's'}`}</span>
                <span className="rc-join"><Headphones size={11} /> {joined ? 'You’re here' : saved ? (owned ? 'Rejoin as Admin' : 'Join room') : 'Join room'}</span>
              </div>
              {owned && (
                <div className="rc-owner-actions" onClick={(event) => event.stopPropagation()}>
                  {!joined && (
                    <button type="button" className="rc-owner-btn" onClick={() => onJoin(room)}>
                      <RotateCcw size={11} /> Rejoin
                    </button>
                  )}
                  <button type="button" className="rc-owner-btn" aria-label={`Edit ${room.name}`} onClick={() => onEditRoom?.(room)}>
                    <Pencil size={11} /> Edit room
                  </button>
                  <button type="button" className="rc-owner-btn danger" aria-label={`Delete ${room.name}`} onClick={() => onDeleteRoom?.(room)}>
                    <Trash2 size={11} /> Delete room
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
