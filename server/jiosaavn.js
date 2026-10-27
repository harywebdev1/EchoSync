import { createDecipheriv, getCiphers } from 'node:crypto'

const KEY = Buffer.from('38346591')
export function decryptMediaUrl(encrypted) {
  if (typeof encrypted !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted) || encrypted.length > 4096) throw new Error('Invalid encrypted media')
  // OpenSSL 3 commonly disables single DES. EDE with K1=K2=K3 is exactly DES,
  // preserving the protocol without enabling a legacy provider or shell flags.
  const native = getCiphers().includes('des-ecb')
  const decipher = createDecipheriv(native ? 'des-ecb' : 'des-ede3', native ? KEY : Buffer.concat([KEY, KEY, KEY]), null)
  const plain = Buffer.concat([decipher.update(encrypted, 'base64'), decipher.final()]).toString('utf8').replace(/\0+$/, '').trim()
  const url = new URL(plain.replace(/^http:/, 'https:'))
  if (url.protocol !== 'https:' || !/(^|\.)saavncdn\.com$/i.test(url.hostname) || url.username || url.password || url.port) throw new Error('Invalid media origin')
  return url.href
}
const text = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/<[^>]*>/g, '').trim()
export function normalizeOfficialSong(raw, {allowUnresolved = false} = {}) {
  const info = raw?.more_info || raw || {}
  if (!raw?.id) return null
  let source
  const encrypted = info.encrypted_media_url || raw.encrypted_media_url
  try { source = decryptMediaUrl(encrypted) } catch { if (!allowUnresolved || encrypted) return null }
  const supports320 = String(info['320kbps'] ?? raw['320kbps']).toLowerCase() === 'true'
  const atQuality = quality => source.replace(/_(?:96|160|320)\.mp4(?=\?|$)/, `_${quality}.mp4`)
  const primary = info.artistMap?.primary_artists || []
  const artist = primary.map(a => text(a.name)).filter(Boolean).join(', ') || text(info.primary_artists || raw.primary_artists || raw.subtitle?.split(' - ')[0])
  const art = String(raw.image || '').replace(/^http:/, 'https:').replace(/-\d+x\d+(\.[a-z]+)(?=\?|$)/i, '-500x500$1')
  return {
    id: String(raw.id), name: text(raw.title || raw.song || raw.name), duration: Number(info.duration || raw.duration) || 0,
    primaryArtists: artist, artists: { primary: primary.map(a => ({ name: text(a.name) })) }, album: { name: text(info.album || raw.album) },
    language: text(info.language || raw.language), year: text(raw.year || info.year),
    image: art ? [{ quality: '500x500', url: art }] : [],
    downloadUrl: source ? [...(supports320 ? [{ quality: '320kbps', url: atQuality(320) }] : []), { quality: '160kbps', url: atQuality(160) }, { quality: '96kbps', url: atQuality(96) }] : [],
  }
}
export function officialUrl(route, params) {
  const url = new URL('https://www.jiosaavn.com/api.php')
  const search = route === 'api/search/songs'
  for (const [key, value] of Object.entries({ __call: search ? 'search.getResults' : 'song.getDetails', _format: 'json', _marker: '0', api_version: '4', ctx: 'web6dot0', ...(search ? { q: params.get('query') || '', n: params.get('limit') || '12', p: params.get('page') || '1' } : { pids: route.split('/').pop() }) })) url.searchParams.set(key, value)
  return url
}
export function normalizeOfficialPayload(data, search) {
  const rows = search ? data?.results : data?.songs || data
  const values = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? Object.values(rows) : []
  const songs = values.map(row => normalizeOfficialSong(row, {allowUnresolved: search})).filter(Boolean)
  return search ? { data: { results: songs, total: Number(data.total) || songs.length } } : { data: songs }
}
