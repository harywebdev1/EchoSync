import { useEffect, useRef, useState } from 'react'
import { loadTasteProfile, readUserValue, PLAYLISTS_KEY, RECENT_KEY, LIKES_KEY, sanitizeTrack, uid, clockNow } from '../lib/appServices.js'
import { mergeVote, rankRoomQueue } from '../core/roomVotes.js'
import { computeMemberDrift } from '../core/roomSyncMath.js'

export function useSocialFeatures(options) {
  const latest = useRef(options); latest.current = options
  const [profiles, setProfiles] = useState({}), [telemetry, setTelemetry] = useState({}), [profileId, setProfileId] = useState(null)
  const now = () => latest.current
  const send = data => now().channelRef.current?.postMessage({ ...data, sender: now().tabIdRef.current })
  function snapshot() {
    const o = now(), user = o.currentUser
    if (!user) return null
    const visible = user.showActivity !== false
    const tracks = ids => [...new Set(ids)].map(id => o.library[id]).filter(Boolean).slice(0, 50).map(sanitizeTrack)
    return {
      userId: user.id, ts: Date.now(), sharing: visible,
      taste: visible ? o.tasteProfile : null,
      rotation: visible ? tracks([...o.recent, ...o.liked]).slice(0,3) : [],
      activity: visible && o.isPlaying && o.track?.id !== 'empty' ? sanitizeTrack(o.track) : null,
      room: visible && o.roomPlaybackActive && o.activeRoom && !o.activeRoom.private ? { id: o.activeRoom.id, name: o.activeRoom.name } : null,
      playlists: o.playlists.filter(p => p.visibility !== 'private').map(p => ({ id:p.id, name:p.name, visibility:'public', tracks:tracks(p.trackIds) })),
    }
  }
  function profileFor(id) {
    const o = now()
    if (id === o.currentUser?.id) return snapshot()
    const live = profiles[id]
    if (live && Date.now()-live.ts < 6000) return live
    const user = o.members[id]
    const tracks = ids => [...new Set(ids)].map(key => o.library[key]).filter(Boolean).slice(0,3)
    // Persisted public collections remain available offline; live activity never does.
    return { sharing: user?.showActivity !== false, taste: user?.showActivity !== false ? loadTasteProfile(id) : null,
      rotation: user?.showActivity !== false ? tracks([...readUserValue(RECENT_KEY,id,[]), ...readUserValue(LIKES_KEY,id,[])]) : [],
      playlists: readUserValue(PLAYLISTS_KEY,id,[]).filter(p=>p.visibility !== 'private').map(p=>({...p, tracks:p.trackIds.map(key=>o.library[key]).filter(Boolean)})) }
  }
  function applyVote(data) {
    const o = now(), room = o.roomsRef.current.find(r=>r.id===data.roomId)
    if (!room || !room.members.includes(data.userId) || !room.trackIds.includes(data.trackId)) return
    const votes = mergeVote(room.queueVotes || {}, data.trackId, data.userId, data.change)
    if (votes === room.queueVotes) return
    const active = o.activeRoomRef.current === room.id
    const index = active ? o.roomClockRef.current.index : 0
    const original = [...new Set([...(room.queueOrder || room.trackIds), ...room.trackIds])]
    const updated = {...room, queueVotes:votes, queueOrder:original, trackIds:rankRoomQueue(room.trackIds,index,votes,original)}
    o.roomsRef.current = o.roomsRef.current.map(r=>r.id===room.id?updated:r)
    if (active) o.roomQueueRef.current = updated.trackIds
    o.setRooms(previous=>previous.map(r=>r.id===room.id?updated:r))
  }
  function handleEvent(data) {
    const o = now()
    if (data.type === 'channel-profile' && data.profile?.userId && o.members[data.profile.userId]) {
      if (Number.isFinite(data.profile.ts) && Math.abs(Date.now()-data.profile.ts)<15000) setProfiles(previous=>previous[data.profile.userId]?.ts>data.profile.ts?previous:{...previous,[data.profile.userId]:data.profile}); return true
    }
    if (data.type === 'room-vote') { applyVote(data); return true }
    if (data.type === 'room-updated' && data.room?.id) {
      const current=o.roomsRef.current.find(r=>r.id===data.room.id)
      if (current) {
        let merged=current.queueVotes || {}
        for (const [trackId, users] of Object.entries(data.room.queueVotes || {})) for (const [userId, change] of Object.entries(users)) merged=mergeVote(merged,trackId,userId,change)
        const ids=data.room.trackIds || [], original=[...new Set([...(current.queueOrder || current.trackIds),...(data.room.queueOrder || []),...ids])]
        const index=data.room.id===o.activeRoomRef.current?Math.max(0,ids.indexOf(o.roomClockRef.current.trackId)):0
        data.room={...data.room,queueVotes:merged,queueOrder:original,trackIds:rankRoomQueue(ids,index,merged,original)}
      }
      return false
    }
    if (data.type === 'member-telemetry') {
      const room = o.roomsRef.current.find(r=>r.id===data.roomId)
      if (room?.members.includes(data.userId) && Number.isFinite(data.seconds)) setTelemetry(p=>({...p,[data.roomId+':'+data.userId]:{ seconds:Math.max(0,data.seconds), ts:Date.now() }}))
      return true
    }
    if (data.type === 'FORCE_RESYNC') {
      const room = o.roomsRef.current.find(r=>r.id===data.roomId)
      if (room && ['admin','dj'].includes(room.roles?.[data.userId]) && data.roomId===o.activeRoomRef.current && Number.isFinite(data.time) && Math.abs(Date.now()-data.ts)<15000) o.applyRemoteState({...data, heartbeat:false})
      return true
    }
    return false
  }
  useEffect(() => {
    const publish = () => {
      const o = now(), profile = snapshot()
      if (profile) send({type:'channel-profile',profile})
      if (o.roomPlaybackActive && o.activeRoom && o.currentUser && o.track?.id !== 'empty') {
        const seconds = computeMemberDrift(o.getPlaybackTime(),o.roomClockTime()).seconds
        const key = o.activeRoom.id+':'+o.currentUser.id
        setTelemetry(p=>({...p,[key]:{seconds,ts:Date.now()}}))
        send({type:'member-telemetry',roomId:o.activeRoom.id,userId:o.currentUser.id,seconds})
      }
    }
    publish(); const timer=setInterval(publish,2000); return ()=>clearInterval(timer)
  }, [])
  useEffect(() => { const profile=snapshot(); if(profile) send({type:'channel-profile',profile}) }, [options.currentUser?.id, options.currentUser?.showActivity, options.playlists])
  function toggleVote(trackId) {
    const o=now(), room=o.activeRoom
    if (!room || !room.members.includes(o.currentUser?.id) || room.trackIds.indexOf(trackId)<=o.roomClockRef.current.index) return
    const data={type:'room-vote',roomId:room.id,trackId,userId:o.currentUser.id,change:{active:!room.queueVotes?.[trackId]?.[o.currentUser.id]?.active,ts:Date.now(),op:uid('vote')}}
    applyVote(data); send(data)
  }
  function forceResync() {
    const o=now()
    if (!o.activeRoom || !['admin','dj'].includes(o.activeRoom.roles?.[o.currentUser?.id])) return
    send({...o.roomSnapshot(),type:'FORCE_RESYNC',userId:o.currentUser.id}); o.showToast('Sync All sent to room listeners')
  }
  function shareSong(target) {
    const o=now(), track=o.track?.id!=='empty' ? o.track : o.library[o.recent[0]]
    if (!o.currentUser || !track?.id) { o.showToast('Play a song before sharing'); return }
    const message={id:uid('song'),author:o.currentUser.id,userName:o.currentUser.name,authorHandle:o.currentUser.handle,type:'song',track:sanitizeTrack(track),text:track.title,time:clockNow(),createdAt:Date.now(),reactions:[]}
    if (target==='room') {
      if (!o.activeRoom?.members.includes(o.currentUser.id)) return
      o.setMessages(p=>({...p,[o.activeRoom.id]:[...(p[o.activeRoom.id]||[]),message]}))
      send({type:'chat',roomId:o.activeRoom.id,message})
    } else { o.upsertLoungeMessage(message); send({type:'lounge-message',message}) }
  }
  function savePublicPlaylist(playlist) {
    const o=now(); if (!o.currentUser || !playlist?.tracks?.length) return
    playlist.tracks.forEach(o.rememberTrack)
    o.setPlaylists(p=>[{id:uid('playlist'),name:playlist.name,visibility:'public',trackIds:playlist.tracks.map(t=>t.id)},...p]); o.showToast('Playlist saved to your library')
  }
  function toggleVisibility(id) { now().setPlaylists(p=>p.map(item=>item.id===id?{...item,visibility:item.visibility==='private'?'public':'private'}:item)) }
  function playPlaylist(playlist) { const o=now(); playlist.tracks.forEach(o.rememberTrack); if(playlist.tracks[0]) o.playSearchTrack(playlist.tracks[0],playlist.tracks) }
  function play(candidate) { now().playSearchTrack(candidate) }
  return { profiles, telemetry, profileId, openProfile:setProfileId, closeProfile:()=>setProfileId(null), profileFor, handleEvent, shareSong, toggleVote, forceResync, savePublicPlaylist, toggleVisibility, playPlaylist, play, like:options.toggleLike, queue:options.queueSoloTrack, liked:options.liked, currentUser:options.currentUser, currentTaste:options.tasteProfile, joinRoom:options.joinRoom, invite:options.inviteLoungeUser, rooms:options.rooms }
}
