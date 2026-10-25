import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabaseClient.js'
import { createCloudAdapter, cloudFingerprint, mergeMigrationTaste } from '../cloud/cloudAdapter.js'

export function useCloudBackend(options) {
  const latest=useRef(options);latest.current=options
  const configured=isSupabaseConfigured(), [readyId,setReadyId]=useState(null)
  const adapterRef=useRef(null), applied=useRef(null), pending=useRef(null), privacy=useRef({}), mounted=useRef(true)
  const migration=useRef(null), migrationDone=useRef(false)
  const epoch=useRef(0), seenOwn=useRef(''), dirty=useRef(false)
  const ownSignature=data=>cloudFingerprint({likes:data.profile?.liked_tracks,taste:data.profile?.taste_profile,privacy:data.profile?.privacy_settings,recent:data.profile?.activity_status?.recent,playlists:[...(data.playlists||[])].sort((a,b)=>a.id.localeCompare(b.id)).map(p=>({id:p.id,name:p.name,description:p.description||'',visibility:p.visibility,tracks:p.tracks}))})
  if(!migration.current)migration.current=(options.currentUser?.cloud?{likes:[],playlists:[],taste:{},library:{}}:options.legacyMigration?.() || {likes:options.liked.map(id=>options.library[id]).filter(Boolean),playlists:options.playlists,taste:options.tasteProfile,library:options.library})
  async function accept(session) {
    const user=session?.user
    if(!user){epoch.current++;if(applied.current){applied.current=null;setReadyId(null);latest.current.onSignedOut()}else latest.current.clearLocalIdentity();return}
    if(applied.current===user.id)return
    if(pending.current){await pending.current.catch(()=>{});if(applied.current===user.id)return}
    const ticket=++epoch.current
    pending.current=(async()=>{
      const client=await getSupabaseClient(),adapter=createCloudAdapter(client);adapterRef.current=adapter
      if(!migrationDone.current&&!latest.current.currentUser?.cloud){const o=latest.current;migration.current={...migration.current,likes:[...(migration.current?.likes||[]),...o.liked.map(id=>o.library[id]).filter(Boolean)],taste:mergeMigrationTaste(migration.current?.taste,o.tasteProfile),library:o.library,playlists:o.playlists.length?o.playlists:migration.current?.playlists||[]}}
      const data=await adapter.hydrate(user,migration.current)
      if(!mounted.current || ticket!==epoch.current)return
      seenOwn.current=ownSignature(data)
      migration.current={likes:[],playlists:[],taste:{},library:{}};migrationDone.current=true
      privacy.current=data.profile.privacy_settings||{}
      applied.current=user.id
      latest.current.onHydrate(user,data)
      setReadyId(user.id)
    })().catch(error=>{if(mounted.current)latest.current.showToast('Cloud sign-in could not load your library: '+error.message);throw error}).finally(()=>{pending.current=null})
    return pending.current
  }
  useEffect(()=>{
    mounted.current=true
    if(!configured)return
    let subscription
    getSupabaseClient().then(async client=>{
      if(!mounted.current)return
      adapterRef.current=createCloudAdapter(client)
      const auth=client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{if(mounted.current)accept(session).then(()=>{if(event==='PASSWORD_RECOVERY')latest.current.onPasswordRecovery?.()}).catch(()=>{})},0)})
      subscription=auth.data?.subscription
      const result=await client.auth.getSession();if(result.error)throw result.error
      await accept(result.data?.session)
    }).catch(error=>{if(mounted.current)latest.current.showToast('Cloud connection unavailable: '+error.message)})
    return ()=>{mounted.current=false;subscription?.unsubscribe()}
  },[configured])
  const saveQueue=useRef(Promise.resolve()), saveTimer=useRef(null)
  const [retry,setRetry]=useState(0)
  function libraryData(){
    const o=latest.current,visible=o.currentUser.showActivity!==false
    return {likes:o.liked.map(id=>o.library[id]).filter(Boolean),taste:o.tasteProfile,privacy:{...privacy.current,showActivity:visible,allowInvites:o.currentUser.allowInvites!==false},activity:{recent:o.recent,room:visible&&o.roomPlaybackActive&&o.activeRoom&&!o.activeRoom.private?{id:o.activeRoom.id,name:o.activeRoom.name}:null,track:visible&&o.isPlaying?o.track:null,rotation:visible?o.recent.slice(0,3).map(id=>o.library[id]).filter(Boolean):[]},playlists:o.playlists,library:o.library}
  }
  useEffect(()=>{if(!configured)return;const retry=()=>setRetry(n=>n+1);window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)},[configured])
  useEffect(()=>{
    if(!configured||!readyId||options.currentUser?.id!==readyId)return
    dirty.current=true
    const timer=setTimeout(()=>{
      const data=libraryData()
      saveQueue.current=saveQueue.current.then(async()=>{await adapterRef.current.saveLibrary(readyId,data);seenOwn.current=ownSignature(await adapterRef.current.loadOwn(readyId));dirty.current=false}).catch(error=>latest.current.showToast("Changes weren't saved to the cloud — Retry after reconnecting: "+error.message))
    },800)
    saveTimer.current=timer
    return ()=>clearTimeout(timer)
  },[retry,configured,readyId,options.currentUser,options.liked,options.playlists,options.tasteProfile,options.library,options.recent,options.track?.id,options.isPlaying,options.activeRoom?.id,options.roomPlaybackActive])
  function handleOwn(data){if(!data.profile || data.profile.id!==applied.current || dirty.current)return;const signature=ownSignature(data);if(signature===seenOwn.current)return;seenOwn.current=signature;privacy.current=data.profile.privacy_settings||{};latest.current.onRemoteLibrary(data)}
  async function join(code,roomId=null){const client=await getSupabaseClient();return createCloudAdapter(client).join(roomId,code)}
  async function auth(mode,input) {
    try {
      const client=await getSupabaseClient(),adapter=createCloudAdapter(client)
      const data=await adapter.authenticate(mode,input)
      if(data.session)await accept(data.session)
      else latest.current.showToast('Check your email to confirm your account, then sign in')
      return {}
    }catch(error){return {error:error.message}}
  }
  async function resetPassword(email) {
    if(!configured)return {message:'Local accounts cannot receive reset emails. Your listening data stays on this device; enable cloud sign-in for email recovery.'}
    try{const client=await getSupabaseClient();const result=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(result.error)throw result.error;return {message:'If an account exists for this email, a password reset link is on its way.'}}catch(error){return{error:error.message}}
  }
  async function completePasswordRecovery(password){try{const client=await getSupabaseClient();const result=await client.auth.updateUser({password});if(result.error)throw result.error;return{message:'Password updated. You can keep listening.'}}catch(error){return{error:error.message}}}
  async function google() {
    if(!configured){latest.current.showToast('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Google Sign-In');return}
    try {const client=await getSupabaseClient();await createCloudAdapter(client).google(window.location.origin)}catch(error){latest.current.showToast(error.message)}
  }
  async function signOut() {
    try {clearTimeout(saveTimer.current);await saveQueue.current;if(dirty.current&&applied.current){await adapterRef.current.saveLibrary(applied.current,libraryData());dirty.current=false} const client=await getSupabaseClient();const result=await client.auth.signOut();if(result.error)throw result.error;applied.current=null;setReadyId(null);latest.current.onSignedOut()}catch(error){latest.current.showToast('Could not sign out: '+error.message)}
  }
  async function saveProfile(patch) {
    try {
      const client=await getSupabaseClient(),user=latest.current.currentUser
      if(patch.newPassword){const check=await client.auth.signInWithPassword({email:user.email,password:patch.currentPassword});if(check.error)throw check.error}
      if(patch.newPassword||patch.email!==user.email){const result=await client.auth.updateUser({...(patch.newPassword?{password:patch.newPassword}:{}),...(patch.email!==user.email?{email:patch.email}:{})});if(result.error)throw result.error}
      const result=await client.from('profiles').update({username:patch.handle,display_name:patch.handle,privacy_settings:{...privacy.current,showActivity:patch.showActivity,allowInvites:patch.allowInvites}}).eq('id',user.id)
      if(result.error)throw result.error
      privacy.current={...privacy.current,showActivity:patch.showActivity,allowInvites:patch.allowInvites}
      latest.current.updatePublicAccount(patch)
      latest.current.showToast('Profile saved. Email changes may require confirmation.')
      return {}
    }catch(error){return {error:error.message}}
  }
  async function uploadVoice(dataUrl) {
    const client=await getSupabaseClient(),session=await client.auth.getSession()
    if(session.error)throw session.error
    const id=session.data?.session?.user?.id
    if(!id)throw new Error('Sign in before sending a voice note')
    return createCloudAdapter(client).uploadVoice(dataUrl,id)
  }
  return {configured,readyId,auth,resetPassword,completePasswordRecovery,google,signOut,saveProfile,uploadVoice,handleOwn,join}
}
