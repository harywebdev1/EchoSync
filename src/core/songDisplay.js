export function distinctAlbum(track) {
  const album = typeof track?.album === 'object' ? track.album?.name : track?.album
  const name = String(album || '').trim()
  return !name ||
    name.toLowerCase() === 'single' ||
    name.toLowerCase() ===
      String(track?.title || '')
        .trim()
        .toLowerCase()
    ? ''
    : name
}
