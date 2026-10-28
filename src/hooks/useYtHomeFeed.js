import { useEffect, useMemo, useState } from 'react'
import { fetchYtSearch, fetchYtRadio } from '../lib/appServices.js'
import { topTasteLabels } from '../core/listenerProfile.js'
import { getCanonicalSongStem } from '../core/trackIdentity.js'

// Home is a set of YouTube Music shelves: artist seeds (or the PK/IN/Global
// defaults), the recent track's own RDAMVM radio, and two discovery searches.
const DEFAULT_SEEDS = ['Atif Aslam', 'Arijit Singh', 'Diljit Dosanjh', 'The Weeknd']

function takeUnique(lists, limit, reserved = new Set()) {
  const seen = new Set(reserved)
  const out = []
  for (const list of lists) {
    for (const track of Array.isArray(list) ? list : []) {
      const stem = getCanonicalSongStem(track)
      if (!track?.id || !stem || seen.has(stem) || track.preview) continue
      seen.add(stem)
      out.push(track)
      if (out.length >= limit) return out
    }
  }
  return out
}

export function useYtHomeFeed({ profile, recentTracks = [], libraryTracks = [], liked = [] } = {}) {
  const artists = useMemo(() => topTasteLabels(profile?.artists, 3), [profile?.updatedAt])
  const artistKey = artists.join('|')
  const recentKey = recentTracks.map((track) => track?.id).filter(Boolean).join('|')
  const libraryKey = libraryTracks.map((track) => track?.id).filter(Boolean).slice(0, 80).join('|')
  const likedKey = liked.join('|')
  const [feed, setFeed] = useState({ quick: [], mixed: [], fresh: [], familiar: [], supermix: [], status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const seeds = (artists.length ? artists : DEFAULT_SEEDS).slice(0, 3)
    const recentVideoId = recentTracks.find((track) => track?.youtubeVideoId)?.youtubeVideoId
    setFeed((previous) => ({ ...previous, status: 'loading' }))
    const tasks = [
      ...seeds.map((name) => fetchYtSearch(`${name} songs`, 24, { timeout: 9000 })),
      recentVideoId ? fetchYtRadio(recentVideoId, { limit: 25 }) : Promise.resolve([]),
      fetchYtSearch('new Bollywood songs', 24, { timeout: 9000 }),
      fetchYtSearch('global pop hits', 20, { timeout: 9000 }),
    ]
    Promise.allSettled(tasks).then((results) => {
      if (cancelled) return
      const at = (index) => (results[index]?.status === 'fulfilled' && Array.isArray(results[index].value)
        ? results[index].value
        : [])
      const artistLists = seeds.map((_, index) => at(index))
      const radio = at(seeds.length)
      const discoveryLists = [at(seeds.length + 1), at(seeds.length + 2)]
      const quick = takeUnique([...artistLists, ...discoveryLists], 20)
      const mixed = takeUnique([radio, ...artistLists], 16)
      const fresh = takeUnique([...discoveryLists, ...artistLists], 16)
      const familiar = takeUnique(
        [[...recentTracks, ...liked.map((id) => libraryTracks.find((track) => track?.id === id)).filter(Boolean)], libraryTracks],
        12,
      )
      setFeed({
        quick,
        mixed,
        fresh,
        familiar,
        supermix: mixed.length ? mixed : quick,
        status: quick.length || mixed.length ? 'ready' : 'error',
      })
    })
    return () => { cancelled = true }
    // Keys keep the effect stable while arrays are rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistKey, recentKey, libraryKey, likedKey])

  return feed
}
