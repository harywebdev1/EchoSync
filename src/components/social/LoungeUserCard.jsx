import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { loadTasteProfile } from '../../lib/appServices.js'
import { topTasteLabels, normalizeTasteProfile, computeTasteMatchPercentage } from '../../core/tasteEngine.js'
import { X, UserPlus, Play, ListPlus } from 'lucide-react'
import { Avatar } from '../Avatar'
import { Cover } from '../Cover'
import { useSocial } from './SocialContext.jsx'
export function LoungeUserCard({ member, currentUser, room, inviting, onClose, onInvite }) {
  const social=useSocial()
  const closeRef=useRef(onClose); closeRef.current=onClose
  useEffect(()=>{
    const previous=document.activeElement
    document.querySelector('.channel-profile .lounge-user-close')?.focus({preventScroll:true})
    const close=event=>{if(event.key==='Escape')closeRef.current?.()}
    const outside=event=>{if(!event.target.closest('.channel-profile'))closeRef.current?.()}
    document.addEventListener('keydown',close); document.addEventListener('pointerdown',outside)
    return ()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);if(previous?.isConnected)previous.focus({preventScroll:true})}
  },[])
  if (!member) return null
  const profile=social.profileFor?.(member.id) || {}, own=social.currentTaste || loadTasteProfile(currentUser?.id)
  const visible=member.showActivity!==false && profile.sharing!==false
  const target=visible?normalizeTasteProfile(profile.taste):null
  const labels=p=>[...topTasteLabels(p?.artists,8),...topTasteLabels(p?.vibes,8)]
  const right=labels(target), left=labels(own).map(x=>x.toLowerCase())
  const shared=right.filter(x=>left.includes(x.toLowerCase())).slice(0,2)
  const hasSignals=profile=>['artists','genres','vibes','languages'].some(key=>Object.values(profile?.[key] || {}).some(entry=>Number(entry?.weight ?? entry)>0))
  const ready=hasSignals(own) && hasSignals(target)
  const join=profile.room && social.rooms?.find(r=>r.id===profile.room.id&&!r.private)
  const disabled=member.id===currentUser?.id || room?.members?.includes(member.id) || member.allowInvites===false || inviting
  const playList=playlist=>{if(playlist.tracks[0]) social.playPlaylist?.(playlist)}
  return createPortal(<div className="lounge-user-card channel-profile" role="dialog" aria-label={`${member.name}'s musical channel`} data-testid="lounge-user-card">
    <button className="lounge-user-close" onClick={onClose} aria-label="Close user card"><X/></button>
    <div className="channel-ambient" aria-hidden="true"/>
    <div className="lounge-user-top"><Avatar member={member} size="lg" online={member.online}/><div><strong>{member.name}</strong><span>@{member.handle}</span></div></div>
    <div className="taste-match" data-testid="taste-match">{ready?`✨ ${computeTasteMatchPercentage(own,target)}% Taste Match`:visible?'New listener · Building taste profile':'Listening activity is private'}</div>
    {shared.length>0 && <p className="shared-taste">Shared: {shared.join(' · ')}</p>}
    {visible && profile.activity && <div className="channel-activity"><p>🎧 Listening to {profile.activity.title} · {profile.activity.artist}</p><button className="primary-btn" onClick={()=>social.play(profile.activity)}><Play size={14}/> Listen along</button></div>}
    {visible && join && <div className="channel-activity"><p>📻 In Room: {join.name}</p><button className="text-btn" onClick={()=>social.joinRoom(join)}>Join Room</button></div>}
    {visible && <section><h4>Songs on Repeat</h4>{profile.rotation?.slice(0,3).map(track=><button className="channel-track" key={track.id} onClick={()=>social.play(track)}><Cover track={track}/><span><strong>{track.title}</strong><small>{track.artist}</small></span><Play size={16}/></button>)}{!profile.rotation?.length&&<p>No shared tracks yet.</p>}</section>}
    <section><h4>Public playlists</h4>{profile.playlists?.filter(p=>p.visibility!=='private').map(playlist=><div className="channel-playlist" key={playlist.id}><strong>{playlist.name}</strong><span>{playlist.tracks.length} tracks</span><div><button disabled={!playlist.tracks.length} onClick={()=>playList(playlist)}><Play size={14}/> Play</button><button disabled={!playlist.tracks.length} onClick={()=>social.savePublicPlaylist(playlist)}><ListPlus size={14}/> Save to Library</button></div></div>)}{!profile.playlists?.filter(p=>p.visibility!=='private').length&&<p>No public playlists yet.</p>}</section>
    <section><h4>Saved Rooms</h4>{(social.rooms || []).filter(r=>!r.private && r.members?.includes(member.id)).map(r=><button key={r.id} className="channel-room" onClick={()=>social.joinRoom(r)}>{r.name} · Join room</button>)}{!(social.rooms || []).some(r=>!r.private && r.members?.includes(member.id)) && <p>No shared rooms yet.</p>}</section>
    <button className="lounge-invite-btn" disabled={disabled} onClick={()=>onInvite?.(member)} data-testid="lounge-invite-btn"><UserPlus/> {disabled?'Invite unavailable':`🔒 Invite @${member.handle} to Private Room`}</button>
  </div>, document.querySelector('.app') || document.body)
}
