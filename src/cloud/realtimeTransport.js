import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { createCloudAdapter, roomFromCloud, messageFromCloud } from './cloudAdapter.js'

// A single owner supplies the existing BroadcastChannel interface to Web hooks.
// Cloud messages come only from the database-authorized RPC, never client broadcasts.
export function createRealtimeTransport({ channelName='echosync-room-sync', Broadcast=globalThis.BroadcastChannel, getClient=getSupabaseClient, configured=isSupabaseConfigured(), onError=()=>{}, getContext=()=>({}) }={}) {
  const local=Broadcast?new Broadcast(channelName):null
  let refreshGeneration=0
  let closed=false, client, adapter, authSubscription, serial=Promise.resolve(), context={}, channels=new Map(), generation=0
  const presenceByTopic=new Map(), tracked=new Map(), connected=new Set()
  const seen=new Set(), callbacks=new Set(), pendingMessages=new Set(), pendingRooms=new Set()
  const result={onmessage:null,postMessage,close,setContext,subscribe(fn){callbacks.add(fn);return ()=>callbacks.delete(fn)},flush:()=>serial}
  function receive(data) {
    if(closed||!data)return
    if(data._eventId){if(seen.has(data._eventId))return;seen.add(data._eventId);if(seen.size>2000)seen.delete(seen.values().next().value)}
    result.onmessage?.({data});callbacks.forEach(fn=>fn(data))
  }
  if(local)local.onmessage=event=>receive(event.data)
  function publishPresence(){const people=[...new Map([...presenceByTopic.values()].flat().map(person=>[person.userId,person])).values()];receive({type:'cloud-presence',people,sender:'cloud-presence'})}
  async function updatePresence(topic,channel,user){
    if(!connected.has(topic)||(topic!=='echosync:lounge'&&!topic.startsWith('echosync:room:')))return
    const visible=user&&context.userId===user.id&&context.sharing!==false
    if(visible&&!tracked.get(topic)){tracked.set(topic,true);await channel.track({userId:user.id,online:true})}
    if(!visible&&tracked.get(topic)){tracked.delete(topic);await channel.untrack?.()}
  }
  function fail(error){if(!closed)onError(error)}
  function enqueue(action){serial=serial.then(()=>closed?undefined:action()).catch(fail);return serial}
  function postMessage(event) {
    const data={...event,_eventId:event._eventId||globalThis.crypto?.randomUUID?.()||Math.random().toString(36)}
    const owner=context.userId
    if(configured&&data.message?.id)pendingMessages.add(data.message.id)
    if(configured&&data.type==='room-added'&&data.room?.id)pendingRooms.add(data.room.id)
    local?.postMessage(data)
    if(configured) enqueue(async()=>{await ready;if(!client)return; const session=await client.auth.getSession();if(session.error)throw session.error;if(!session.data?.session){if(!['channel-profile','member-telemetry'].includes(data.type))throw new Error('Sign in to sync with the cloud');return} if(owner && session.data.session.user.id!==owner)throw new Error('Account changed before sync; action was not sent');await adapter.publish(data,getContext().library||{});if(data.message?.id)pendingMessages.delete(data.message.id);if(data.type==='room-added')pendingRooms.delete(data.room?.id)})
  }
  async function refresh() {
    if(closed||!adapter)return
    const ticket=++refreshGeneration
    const [profiles,rooms,history,playlists]=await Promise.all([adapter.directory(),adapter.rooms(),adapter.history(),adapter.playlists()])
    if(closed||ticket!==refreshGeneration)return
    receive({type:'cloud-directory',profiles,playlists,sender:'cloud-directory'});publishPresence()
    receive({type:'cloud-rooms',rooms,pending:[...pendingRooms],sender:'cloud-db'})
    const session=await client.auth.getSession();if(session.data?.session?.user){const owned=await adapter.loadOwn(session.data.session.user.id);if(closed||ticket!==refreshGeneration)return;receive({type:'cloud-own',...owned,sender:'cloud-db'})}
    for(const row of rooms||[]) {
      receive({type:'cloud-tracks',tracks:row.queue||[],sender:'cloud-db'})
      receive({type:'room-added',room:roomFromCloud(row),sender:'cloud-db'})
      receive({type:'room-updated',room:roomFromCloud(row),sender:'cloud-db'})
      if(row.id===context.roomId && row.playback_clock?.ts)receive({...row.playback_clock,type:'state',roomId:row.id,sender:'cloud-db',_eventId:'snapshot:'+row.id+':'+row.playback_clock.ts+':'+generation,heartbeat:false})
    }
    receive({type:'cloud-history',rows:history||[],pending:[...pendingMessages],sender:'cloud-db'})
  }
  function incoming(payload) {
    if(!payload?._server)return
    if(payload.type==='directory-changed'){refresh().catch(fail);return}
    if(payload.track?.id)receive({type:'cloud-tracks',tracks:[payload.track],sender:'cloud-db'})
    if(payload.cloudRoom)receive({type:'cloud-tracks',tracks:payload.cloudRoom.queue||[],sender:'cloud-db'})
    receive(payload)
  }
  async function setContext(next={}) {
    context={...context,...next};const ticket=++generation
    if(!configured)return
    try {
      await ready;await serial;if(closed||ticket!==generation)return
      const session=await client.auth.getSession();if(session.error)throw session.error
      const user=session.data?.session?.user
      const wanted=new Set(['echosync:lounge','echosync:directory'])
      if(user)wanted.add('echosync:user:'+user.id)
      if(user&&context.roomId) {
        const row=await adapter.join(context.roomId,context.roomCode)
        if(closed||ticket!==generation)return
        if(row){receive({type:'cloud-tracks',tracks:row.queue||[],sender:'cloud-db'});receive({type:'room-updated',room:roomFromCloud(row),sender:'cloud-db'})}
        wanted.add('echosync:room:'+context.roomId)
      }
      for(const [topic,channel]of channels)if(!wanted.has(topic)){channels.delete(topic);presenceByTopic.delete(topic);tracked.delete(topic);connected.delete(topic);await client.removeChannel(channel)}
      for(const topic of wanted)if(!channels.has(topic)){
        const channel=client.channel(topic,{config:{private:true,presence:{key:user?.id||'guest'}}})
        channels.set(topic,channel)
        channel.on('broadcast',{event:'event'},({payload})=>incoming(payload))
        channel.on('presence',{event:'sync'},()=>{
          const people=Object.values(channel.presenceState()).flat();presenceByTopic.set(topic,people);publishPresence()
        })
        channel.subscribe(status=>{
          if(status==='SUBSCRIBED'){
            connected.add(topic)
            updatePresence(topic,channel,user).catch(fail)
            refresh().catch(fail)
          }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){connected.delete(topic);tracked.delete(topic);fail(new Error('Realtime connection unavailable; reconnecting'))}
        })
      }
      for(const [topic,channel]of channels)updatePresence(topic,channel,user).catch(fail)
      publishPresence()
    }catch(error){fail(error)}
  }
  const ready=configured?Promise.resolve().then(getClient).then(async value=>{
    if(closed||!value)return;client=value;adapter=createCloudAdapter(client)
    const auth=client.auth.onAuthStateChange(()=>{setTimeout(()=>{if(!closed)setContext(context)},0)})
    authSubscription=auth.data?.subscription
  }).catch(fail):Promise.resolve()
  if(configured)ready.then(()=>{if(!closed)setContext(context)})
  function close(){closed=true;generation++;local?.close();authSubscription?.unsubscribe();for(const channel of channels.values())client?.removeChannel(channel);channels.clear();callbacks.clear()}
  return result
}
