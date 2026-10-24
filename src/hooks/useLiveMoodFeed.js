import { useEffect, useRef, useState } from 'react'
import { fetchJioSearch } from '../lib/appServices.js'
import { collectMoodResults, moodQueries } from '../core/moodFeed.js'
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
        const tracks = collectMoodResults(results)
        setFeed({ mood, tracks, status: tracks.length ? 'ready' : 'error' })
      })
    return () => { cancelled = true }
  }, [mood, mood === 'all' ? artist : ''])
  return feed.mood === mood ? feed : { mood, tracks: [], status: 'loading' }
}
