import { Heart, ListPlus, Play } from 'lucide-react'
import { Cover } from '../Cover'
import { useSocial } from './SocialContext.jsx'
export function SongDrop({ track }) {
  const social = useSocial()
  if (!track?.id) return null
  return <div className="song-drop" data-testid="song-drop">
    <Cover track={track} /><div className="song-drop-copy"><strong>{track.title}</strong><span>{track.artist}</span></div>
    <div className="song-drop-actions">
      <button onClick={()=>social.play(track)} aria-label={`Play shared ${track.title}`}><Play size={14}/> Play</button>
      <button onClick={()=>social.like(track)} aria-label={`Like shared ${track.title}`} aria-pressed={social.liked?.includes(track.id)}><Heart size={14}/> Like</button>
      <button onClick={()=>social.queue(track)} aria-label={`Queue shared ${track.title}`}><ListPlus size={14}/> Queue</button>
    </div>
  </div>
}
