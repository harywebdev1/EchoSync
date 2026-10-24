import { trackArtworkSources } from '../lib/media.js'
import { useMemo, useState, useEffect } from 'react'
import { paletteFromTrack, extractArtworkPalette, resolveTrackArtwork } from '../lib/appServices.js'

export function useTrackPalette(track) {
  const trackKey = track?.id && track.id !== 'empty' ? track.id : ''
  const cover = resolveTrackArtwork(track) || ''
  const fallback = useMemo(
    () => paletteFromTrack(track),
    [trackKey, cover, track?.c1, track?.c2, track?.artist, track?.title],
  )
  const [palette, setPalette] = useState(fallback)

  useEffect(() => {
    setPalette(fallback)
    if (!cover || !trackKey) return undefined
    let cancelled = false
    ;(async () => {
      for (const source of trackArtworkSources(track)) {
        const extracted = await extractArtworkPalette(source)
        if (cancelled) return
        if (extracted) { setPalette({ ...fallback, ...extracted }); return }
      }
    })()
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [fallback, cover, trackKey])

  return palette
}
