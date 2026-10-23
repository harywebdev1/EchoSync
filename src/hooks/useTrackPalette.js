import { useMemo, useState, useEffect } from 'react'
import { paletteFromTrack, extractArtworkPalette } from '../lib/appServices.js'

export function useTrackPalette(track) {
  const trackKey = track?.id && track.id !== 'empty' ? track.id : ''
  const cover = track?.cover || ''
  const fallback = useMemo(
    () => paletteFromTrack(track),
    [trackKey, cover, track?.c1, track?.c2, track?.artist, track?.title],
  )
  const [palette, setPalette] = useState(fallback)

  useEffect(() => {
    setPalette(fallback)
    if (!cover || !trackKey) return undefined
    let cancelled = false
    extractArtworkPalette(cover)
      .then((extracted) => {
        if (!cancelled && extracted) setPalette({ ...fallback, ...extracted })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [fallback, cover, trackKey])

  return palette
}
