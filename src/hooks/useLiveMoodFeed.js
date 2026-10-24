import { useEffect, useRef, useState } from 'react'
import { fetchJioSearch } from '../lib/appServices.js'
import { moodQueries } from '../core/moodFeed.js'
import { topTasteLabels } from '../core/tasteEngine.js'

// Immediate local ranking stays in Home. Only the latest mood request can publish.
export function useLiveMoodFeed(mood, profile) {
  const rotation = useRef(Math.floor(Math.random() * 1000000))
  const [feed, setFeed] = useState({ mood, tracks: [], status: 'loading' })
  const artist = topTasteLabels(profile?.artists, 1)[0] || ''
  useEffect(() => {
    let cancelled = false
    setFeed(previous => ({ mood, tracks: previous.mood === mood ? previous.tracks : [], status: 'loading' }))
    const queries = moodQueries(mood, [artist], rotation.current++)
    Promise.allSettled(queries.map(query => fetchJioSearch(query, 30, { fresh: true, page: 1 + rotation.current % 2 })))
      .then(results => {
        if (cancelled) return
        const seen = new Set()
        const tracks = results.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(track => {
          if (!track?.id || seen.has(track.id) || track.preview || !(Number(track.duration) >= 60)) return false
          seen.add(track.id); return true
        })
        setFeed({ mood, tracks, status: tracks.length ? 'ready' : 'error' })
      })
    return () => { cancelled = true }
  }, [mood, mood === 'all' ? artist : ''])
  return feed.mood === mood ? feed : { mood, tracks: [], status: 'loading' }
}
