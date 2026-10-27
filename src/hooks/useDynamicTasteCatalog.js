import { useEffect, useRef, useState } from 'react'
import { topTasteLabels, tasteVibesForTrack } from '../core/tasteEngine.js'
import { mergeMoodCatalog } from '../core/moodFeed.js'

export async function refreshDynamicTasteCatalog(
  profile,
  { search, signal } = {}
) {
  const artists = topTasteLabels(profile?.artistWeights || profile?.artists, 3)
  const vibe =
    tasteVibesForTrack(profile?.sessionMomentum?.[0] || {})[0] ||
    topTasteLabels(profile?.vibeWeights, 1)[0]
  const queries = [
    ...new Set([
      ...artists.map((artist) => `${artist} songs`),
      ...(vibe ? [`${vibe} songs`] : []),
      ...(!artists.length
        ? [profile?.searches?.[0]?.query || 'Hindi Pakistani popular songs']
        : [])
    ])
  ]
  const results = await Promise.allSettled(
    queries.map((query) => search(query, 40, { signal, timeout: 7500 }))
  )
  if (signal?.aborted) return []
  if (results.every((result) => result.status === 'rejected'))
    throw new Error('Recommendation providers unavailable')
  return mergeMoodCatalog(
    results.flatMap((result) =>
      result.status === 'fulfilled' && Array.isArray(result.value)
        ? result.value
        : []
    ),
    []
  ).slice(0, 240)
}

export function useDynamicTasteCatalog(profile, userKey, search) {
  const [catalog, setCatalog] = useState({ tracks: [], status: 'loading' })
  const latest = useRef(profile)
  latest.current = profile
  const identity = useRef(userKey),
    cache = useRef(new Map())
  useEffect(() => {
    if (identity.current !== userKey) {
      identity.current = userKey
      cache.current.clear()
      setCatalog({ tracks: [], status: 'loading' })
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const cachedSearch = async (query, limit, options) => {
        const previous = cache.current.get(query)
        if (previous && Date.now() - previous.at < 60000) return previous.tracks
        const tracks = await search(query, limit, options)
        if (!controller.signal.aborted) {
          cache.current.set(query, { at: Date.now(), tracks })
          if (cache.current.size > 50)
            cache.current.delete(cache.current.keys().next().value)
        }
        return tracks
      }
      try {
        const tracks = await refreshDynamicTasteCatalog(latest.current, {
          search: cachedSearch,
          signal: controller.signal
        })
        if (!controller.signal.aborted)
          setCatalog((previous) => ({
            tracks: mergeMoodCatalog(tracks, previous.tracks).slice(0, 240),
            status: 'ready'
          }))
      } catch {
        if (!controller.signal.aborted)
          setCatalog((previous) => ({ ...previous, status: 'error' }))
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [userKey, profile?.events, search])
  return catalog
}
