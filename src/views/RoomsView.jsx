import { Radio, Plus, Lock, Globe2, Headphones, KeyRound, UsersRound } from 'lucide-react'
import { Cover } from '../components/Cover'
import { AvatarStack } from '../components/shared/AvatarStack'

export function RoomsView({ rooms, library, currentRoom, onJoin, onCreate, onJoinCode }) {
  return (
    <div className="rooms-view">
      <div className="eyebrow">
        <span className="live-pill"><Radio size={9} /> DISCOVER</span>
        <span className="seg" />
        <span>{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</span>
        <span className="grow" />
        {rooms.length > 0 && <button className="text-btn" onClick={onJoinCode}><KeyRound size={11} /> Join with code</button>}
      </div>
      <h1 className="page-title">Find your <em>frequency.</em></h1>
      <p className="page-sub">Listen together, wherever you are.</p>

      {!rooms.length && <section className="rooms-empty-banner"><Radio/><h2>No rooms yet</h2><p>Start a listening session or join a friend with a code.</p><button className="primary-btn" onClick={onCreate}>Start a room</button><button className="text-btn" onClick={onJoinCode}>Join with code</button></section>}
      <div className="rooms-grid">
        {rooms.length > 0 && <button className="room-card create-room-card" onClick={onCreate}>
          <div className="rc-create-glyph"><Plus /></div>
          <h2 className="rc-title">Start a room</h2>
          <p className="rc-sub">Pick a vibe, invite the room, and become its Admin.</p>
          <div className="rc-foot">
            <span className="rc-join"><UsersRound size={11} /> Create listening room</span>
          </div>
        </button>
        }
        {rooms.map((room) => {
          const firstCover = room.trackIds.map((id) => library[id]?.cover).find(Boolean)
          return (
            <button
              key={room.id}
              className="room-card"
              style={{ '--rc1': room.c1, '--rc2': room.c2 }}
              onClick={() => onJoin(room)}
            >
              {firstCover && <img src={firstCover} alt="" />}
              <div className="rc-top">
                <span className="rc-live"><Headphones size={12} /> Listening room</span>
                {room.private
                  ? <span className="rc-private"><Lock size={9} /> Private</span>
                  : <span className="rc-public"><Globe2 size={9} /> Public</span>}
                <span className="rc-listeners">{room.members.length} in the room</span>
              </div>
              <h2 className="rc-title">{room.name}</h2>
              <p className="rc-sub">{room.tagline}</p>
              <div className="rc-foot">
                <AvatarStack ids={room.members} size="xs" max={3} />
                <span>{room.members.length} member{room.members.length === 1 ? '' : 's'}</span>
                <span className="rc-join"><Headphones size={11} /> {currentRoom && room.id === currentRoom.id ? 'You’re here' : 'Join room'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
