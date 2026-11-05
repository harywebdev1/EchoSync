import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient.js'
import { useSocial } from '../components/social/SocialContext.jsx'
import { Cover } from '../components/Cover.jsx'

export function PublicPlaylistView({ id, localPlaylist, library, onPlay, onSignIn }) {
  const social=useSocial()
  const [state,setState]=useState({status:'loading',playlist:null})
  useEffect(()=>{
    let cancelled=false
    setState({status:'loading',playlist:null})
    ;(async()=>{
      const client=await getSupabaseClient()
      let playlist
      if(client){ const result=await client.from('playlists').select('id,name,description,visibility,tracks').eq('id',id).eq('visibility','public').maybeSingle();if(result.error)throw result.error;playlist=result.data }
      else if(localPlaylist?.visibility==='public') playlist={...localPlaylist,tracks:localPlaylist.trackIds.map(key=>library[key]).filter(Boolean)}
      if(!cancelled)setState({status:playlist?'ready':'missing',playlist})
    })().catch(()=>{if(!cancelled)setState({status:'error',playlist:null})})
    return()=>{cancelled=true}
  },[id,localPlaylist?.id,localPlaylist?.visibility])
  if(state.status!=='ready')return <section className="library-page"><h2>{state.status==='loading'?'Loading playlist…':state.status==='error'?'Playlist could not load':'Playlist is private or unavailable'}</h2></section>
  const playlist=state.playlist,tracks=playlist.tracks || []
  return <section className="library-page public-playlist"><span className="eyebrow">PUBLIC PLAYLIST</span><h1>{playlist.name}</h1><p>{playlist.description}</p><div className="playlist-detail-actions"><button className="primary-btn" disabled={!tracks.length} onClick={()=>onPlay(tracks[0],tracks)}>▶ Play Playlist</button><button className="text-btn" onClick={()=>social.currentUser?social.savePublicPlaylist(playlist):onSignIn()}>+ Save to Library</button></div>{tracks.map(track=><div className="search-result" key={track.id}><Cover track={track}/><div className="search-copy"><strong>{track.title}</strong><span>{track.artist}</span></div><button className="icon-btn" aria-label={'Play '+track.title} onClick={()=>onPlay(track,tracks)}>▶</button></div>)}</section>
}
