import { useSocial } from './SocialContext.jsx'
import { classifyDrift } from '../../core/roomSyncMath.js'
import { voteCount } from '../../core/roomVotes.js'
export function MemberDrift({roomId, userId}) {
  const social=useSocial(), sample=social.telemetry[roomId+':'+userId]
  const known=sample && Date.now()-sample.ts<6000
  const ms=known?Math.round(sample.seconds*1000):null
  const tone=known?classifyDrift(ms):'unknown'
  return <span className={'member-drift '+tone} title={known?`${ms} ms drift`:'No recent playback telemetry'}><i/>{known?{green:'Synced',amber:'Drifting',red:'Out of sync'}[tone]:'Awaiting sync'}</span>
}
export function RoomVote({room, trackId}) {
  const social=useSocial(), votes=room.queueVotes?.[trackId] || {}
  return <button className="room-vote" aria-label={`Upvote ${trackId}`} aria-pressed={Boolean(votes[social.currentUser?.id]?.active)} onKeyDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();social.toggleVote(trackId)}}>▲ {voteCount(votes)}</button>
}
