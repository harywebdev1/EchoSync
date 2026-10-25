export const cloudFingerprint=value=>JSON.stringify(value,(_key,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry)
const unwrap = result => { if(result?.error) throw new Error(result.error.message || 'Cloud request failed'); return result?.data }
const unique = items => [...new Map(items.filter(t=>t?.id).map(t=>[t.id,t])).values()]
export const EVENT_ALIASES={ROOM_STATE:'state',CLOCK_SYNC:'state',FORCE_RESYNC:'FORCE_RESYNC',QUEUE_VOTE:'room-vote',MEMBER_TELEMETRY:'member-telemetry',ROLE_UPDATE:'role-resolved',CHAT_MESSAGE:'chat',VOICE_NOTE:'chat'}
export function roomToCloud(room,library={}) {
  return {id:room.id,code:room.code,name:room.name,tagline:room.tagline,description:room.description,gradient:room.gradient,privacy:room.private?'private':'public',host_id:room.createdBy||room.dj||room.leader,queue:(room.trackIds||[]).map(id=>library[id]||{id}),members:room.members||[],roles:room.roles||{},metadata:{accent:room.accent,accent2:room.accent2,c1:room.c1,c2:room.c2,requests:room.requests||[],queueVotes:room.queueVotes||{},queueOrder:room.queueOrder||room.trackIds||[]}}
}
export function roomFromCloud(row) {
  return {...row.metadata,id:row.id,code:row.code,name:row.name,tagline:row.tagline,description:row.description,gradient:row.gradient,private:row.privacy==='private',createdBy:row.host_id,dj:row.host_id,leader:row.host_id,trackIds:(row.queue||[]).map(t=>t.id),members:row.members||[],roles:row.roles||{},cloud:true}
}
export function messageFromCloud(row) {
  return {id:row.id,author:row.author_id,userName:row.author_name,authorHandle:row.author_handle,type:row.kind,system:row.kind==='system',text:row.text||'',track:row.song_payload,voiceData:row.voice_url||'',duration:row.voice_duration,replyTo:row.reply_to,reactions:Array.isArray(row.reactions)?row.reactions:[],createdAt:Date.parse(row.created_at),time:new Date(row.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),read:true}
}
export function createCloudAdapter(client) {
  const query=async builder=>unwrap(await builder)
  return {
    client,
    async authenticate(mode,input) {
      return unwrap(await (mode==='signup'?client.auth.signUp({email:input.email,password:input.password,options:{data:{username:input.username||input.handle}}}):client.auth.signInWithPassword({email:input.identifier||input.email,password:input.password})))
    },
    async google(origin) {return query(client.auth.signInWithOAuth({provider:'google',options:{redirectTo:origin}}))},
    async loadOwn(userId) {
      const profile=await query(client.from('profiles').select('*').eq('id',userId).maybeSingle())
      const playlists=await query(client.from('playlists').select('*').eq('owner_id',userId))
      return {profile,playlists:playlists||[]}
    },
    async hydrate(user,local={}) {
      const owned=await this.loadOwn(user.id), previous=owned.profile
      const migrate=!previous?.privacy_settings?.local_migrated
      const liked=unique([...(previous?.liked_tracks||[]),...(migrate?local.likes||[]:[])])
      const taste={...(migrate?local.taste||{}:{}),...(previous?.taste_profile||{})}
      if(migrate){taste.tuned=[...new Set([...(local.taste?.tuned||[]),...(previous?.taste_profile?.tuned||[])])];taste.events=Math.max(local.taste?.events||0,previous?.taste_profile?.events||0);taste.searches=[...new Map([...(local.taste?.searches||[]),...(previous?.taste_profile?.searches||[])].map(entry=>[entry.query,entry])).values()].slice(-12)}
      if(migrate) for(const key of ['artists','genres','vibes','languages']) {taste[key]={...taste[key]};for(const [id,value] of Object.entries(local.taste?.[key]||{})){const old=taste[key][id];if(!old || Number(value.weight)>Number(old.weight))taste[key][id]=value}}
      const baseName=user.user_metadata?.username||user.user_metadata?.preferred_username||user.email?.split('@')[0]||'listener'
      const profile={id:user.id,username:previous?.username||baseName.toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,24)+'_'+user.id.slice(0,8),display_name:previous?.display_name||user.user_metadata?.full_name||baseName,email:user.email,taste_profile:taste,liked_tracks:liked,privacy_settings:{showActivity:true,allowInvites:true,...previous?.privacy_settings},activity_status:previous?.activity_status||{}}
      await query(client.from('profiles').upsert(profile))
      let playlists=owned.playlists
      if(migrate) {
        const incoming=(local.playlists||[]).map(p=>({id:user.id+':'+p.id,owner_id:user.id,name:p.name,description:p.description||'',visibility:p.visibility==='private'?'private':'public',tracks:(p.trackIds||[]).map(id=>local.library?.[id]||{id,title:'Unavailable track',artist:'',duration:0,status:'pending'})}))
        for(const playlist of incoming) await query(client.from('playlists').upsert(playlist))
        playlists=[...playlists,...incoming.filter(p=>!playlists.some(old=>old.id===p.id))]
        profile.privacy_settings.local_migrated=true
        await query(client.from('profiles').upsert(profile))
      }
      return {profile,playlists}
    },
    async saveLibrary(userId,data) {
      await query(client.rpc('echosync_save_library',{
        p_profile:{id:userId,liked_tracks:data.likes,taste_profile:data.taste,privacy_settings:data.privacy,activity_status:data.activity},
        p_playlists:data.playlists.map(p=>({id:p.id,name:p.name,description:p.description||'',visibility:p.visibility==='private'?'private':'public',tracks:p.trackIds.map(id=>data.library[id]||{id,title:'Unavailable track',duration:0})})),
      }))
    },
    async directory() {return query(client.from('profile_directory').select('*'))},
    async playlists() {return query(client.from('playlists').select('*'))},
    async rooms() {return query(client.from('rooms').select('*'))},
    async history() {return (await query(client.from('messages').select('*').order('created_at',{ascending:false}).limit(200))||[]).reverse()},
    async publish(event,library={}) {
      const type=EVENT_ALIASES[event.type]||event.type
      const payload={...event,type}
      if(type==='voice-chunk' && event.chunk)payload.chunk=Array.from(new Uint8Array(event.chunk))
      if(event.room) payload.cloudRoom=roomToCloud(event.room,library)
      if(type==='state'||type==='FORCE_RESYNC') payload.track=library[event.trackId]||null
      return query(client.rpc('echosync_event',{p_event:payload}))
    },
    async join(roomId,code) {return query(client.rpc('echosync_join_room',{p_room_id:roomId,p_code:code||''}))},
    async uploadVoice(dataUrl,userId) {
      const response=await fetch(dataUrl),blob=await response.blob()
      if(blob.size<=120 || blob.size>10*1024*1024 || !/^audio\//.test(blob.type))throw new Error('No usable recording captured')
      const path=userId+'/'+crypto.randomUUID()+({ 'audio/wav':'.wav','audio/mp4':'.m4a','audio/ogg':'.ogg' }[blob.type.split(';')[0]]||'.webm')
      await query(client.storage.from('voice-notes').upload(path,blob,{contentType:blob.type.split(';')[0],upsert:false}))
      const url=client.storage.from('voice-notes').getPublicUrl(path).data?.publicUrl
      if(!url?.startsWith('https://'))throw new Error('Voice upload did not return an HTTPS URL')
      return url
    },
  }
}
