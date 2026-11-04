// Pure YouTube Music InnerTube client (WEB_REMIX), the same public protocol
// used by music.youtube.com and sigma67/ytmusicapi. No API key, no third-party
// mirrors: search, artist radio and artist profiles all come from one upstream.
const INNERTUBE_BASE = 'https://music.youtube.com/youtubei/v1'
const CLIENT = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20260101.01.00',
  hl: 'en',
  gl: 'PK',
}
const SONGS_FILTER = 'EgWKAQIIAWoKEAkQBRAKEAMQBA=='
const MAX_BYTES = 4 * 1024 * 1024
const SEARCH_TTL = 1000 * 60 * 10
const RADIO_TTL = 1000 * 60 * 15
const ARTIST_TTL = 1000 * 60 * 30

const HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9',
  'x-youtube-client-name': '67',
  'x-youtube-client-version': CLIENT.clientVersion,
  origin: 'https://music.youtube.com',
  referer: 'https://music.youtube.com/',
}

function textOf(node) {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs)) return node.runs.map(run => run?.text || '').join('')
  if (typeof node.text === 'string') return node.text
  return ''
}

function runsOf(node) {
  return Array.isArray(node?.runs) ? node.runs : []
}

function walk(node, key, out = []) {
  if (!node || typeof node !== 'object') return out
  if (node[key]) out.push(node[key])
  for (const value of Object.values(node)) walk(value, key, out)
  return out
}

function firstOf(node, keys) {
  for (const key of keys) {
    const values = walk(node, key)
    if (values.length) return values[0]
  }
  return null
}

function parseDuration(value) {
  const text = String(value || '')
  const match = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/)
  if (!match) return 0
  if (match[3]) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  return Number(match[1]) * 60 + Number(match[2])
}

function upgradeArtwork(url) {
  const value = String(url || '')
  if (!value) return ''
  if (/googleusercontent\.com|ytimg\.com/.test(value)) {
    if (/=w\d+-h\d+/.test(value)) return value.replace(/=w\d+-h\d+[^?]*$/, '=w544-h544-l90-rj')
    return value
  }
  return value
}

function thumbUrl(node) {
  const thumbnails = walk(node, 'thumbnails')[0]
  if (!Array.isArray(thumbnails) || !thumbnails.length) return ''
  return upgradeArtwork(thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url)
}

// Artist banners are wide (roughly 1000×416). Upgrading them to a square crop
// would stretch the header, so keep the aspect and only raise the resolution.
function wideThumbUrl(node) {
  const thumbnails = walk(node, 'thumbnails')[0]
  if (!Array.isArray(thumbnails) || !thumbnails.length) return ''
  const raw = String(thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '')
  return raw.includes('=') ? raw.replace(/=w\d+-h\d+[^?]*$/, '=w1280-h532-l90-rj') : raw
}

function pageTypeOf(node) {
  return node?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || ''
}

function navPageType(item) {
  return pageTypeOf(item?.navigationEndpoint?.browseEndpoint) ||
    pageTypeOf(item?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint) ||
    pageTypeOf(item?.subtitle?.runs?.find(run => run?.navigationEndpoint?.browseEndpoint)?.navigationEndpoint?.browseEndpoint)
}

function browseIdOf(node) {
  return node?.browseEndpoint?.browseId ||
    node?.navigationEndpoint?.browseEndpoint?.browseId ||
    node?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
    ''
}

function artistRuns(runs = []) {
  const artists = []
  for (const run of runs) {
    const browse = run?.navigationEndpoint?.browseEndpoint
    if (!browse?.browseId || pageTypeOf(browse) !== 'MUSIC_PAGE_TYPE_ARTIST') continue
    const name = String(run.text || '').trim()
    if (!name) continue
    if (!artists.some(artist => artist.browseId === browse.browseId || artist.name.toLowerCase() === name.toLowerCase())) {
      artists.push({ name, browseId: browse.browseId })
    }
  }
  return artists
}

const SEPARATOR = /^\s*[•·]\s*$/
const TIME = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/
const YEAR = /^\s*(19|20)\d{2}\s*$/
const TYPE_WORD = /^(song|video|album|single|ep|playlist|artist)$/i
const COUNT_TEXT = /^(?:\d+(?:\.\d+)?\s*[KMB]?\s+(?:plays?|views?|subscribers?)|[\d.,]+\s*[KMB]?\s+subscribers?)$/i

function flexColumns(item) {
  return (item?.flexColumns || []).map(column => column?.musicResponsiveListItemFlexColumnRenderer?.text || null)
}

function detailParts(item) {
  const columns = flexColumns(item)
  const title = textOf(columns[0]).trim()
  // Search rows keep type/artist/album/duration in one detail column, while
  // artist top-song shelves split artists, plays and album into separate
  // columns. Read every column after the title so album credits survive.
  const runs = columns.slice(1).flatMap((column) => {
    const own = runsOf(column)
    if (own.length) return own
    const text = textOf(column).trim()
    return text ? [{ text }] : []
  })
  const fixed = textOf(item?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text).trim()
  const duration = parseDuration(runs.map(run => run.text).join(' ')) || parseDuration(fixed)
  // Detail rows are "Type • Artist • Album • Year" but some rows drop the type
  // or the artist (artist top-song lists keep only "Song • 4:40"). Read the
  // first token that is neither the type nor a count so a duration can never
  // be mistaken for a singer.
  const tokens = runs.filter(run => run && !SEPARATOR.test(run.text || '') && String(run.text || '').trim())
  const type = TYPE_WORD.test(String(tokens[0]?.text || '').trim()) ? String(tokens[0].text).trim() : ''
  const candidate = type ? tokens[1] : tokens[0]
  const candidateText = candidate ? String(candidate.text || '').trim() : ''
  const artistText = candidateText && !TIME.test(candidateText) && !YEAR.test(candidateText) && !COUNT_TEXT.test(candidateText)
    ? candidateText
    : ''
  const artists = artistRuns(runs)
  const albumRun = runs.find(run => pageTypeOf(run?.navigationEndpoint?.browseEndpoint) === 'MUSIC_PAGE_TYPE_ALBUM')
  const album = albumRun ? { name: String(albumRun.text || '').trim(), browseId: albumRun.navigationEndpoint.browseEndpoint.browseId } : null
  const yearRun = [...runs].reverse().find(run => YEAR.test(run.text || ''))
  const year = yearRun ? String(yearRun.text).trim() : ''
  const extras = runs
    .filter(run => run && !SEPARATOR.test(run.text || '') && !TIME.test(run.text || '') && !YEAR.test(run.text || '') && !COUNT_TEXT.test(String(run.text || '').trim()))
    .filter(run => !artistRuns([run]).length && pageTypeOf(run?.navigationEndpoint?.browseEndpoint) !== 'MUSIC_PAGE_TYPE_ALBUM')
    .map(run => String(run.text || '').trim())
    .filter(Boolean)
    .filter(value => !/^[&+,/|·•x]+$/i.test(value))
    .filter(value => value !== type && value !== artistText && !artists.some(artist => artist.name === value))
  const plays = textOf(columns[2]).trim()
  return { title, type, duration, artists, artistText, album, year, extras, plays }
}

function parseSongItem(item, fallbackArtist = null) {
  const videoId = String(item?.playlistItemData?.videoId || item?.navigationEndpoint?.watchEndpoint?.videoId || flexColumns(item)?.[0]?.runs?.find(run => run?.navigationEndpoint?.watchEndpoint?.videoId)?.navigationEndpoint?.watchEndpoint?.videoId || '')
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  const fallback = typeof fallbackArtist === 'string'
    ? (fallbackArtist.trim() ? { name: fallbackArtist.trim(), browseId: '' } : null)
    : (fallbackArtist?.name ? { name: String(fallbackArtist.name).trim(), browseId: String(fallbackArtist.browseId || '') } : null)
  const parts = detailParts(item)
  const artists = parts.artists.length
    ? parts.artists
    : parts.artistText
      ? [{ name: parts.artistText, browseId: '' }]
      : (fallback?.name ? [fallback] : [])
  const artist = artists.map(entry => entry.name).join(', ') || fallback?.name || 'YouTube Music'
  return {
    id: `yt-${videoId}`,
    videoId,
    provider: 'youtube',
    providerLabel: 'YouTube Music',
    title: parts.title || 'Unknown track',
    artist,
    artists,
    album: { name: parts.album?.name || parts.extras.find(value => !/^\d+(?:\.\d+)?[KMB]?\s+(?:plays?|views?)$/i.test(value)) || 'Single', browseId: parts.album?.browseId || '' },
    cover: thumbUrl(item) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: parts.duration,
    year: parts.year,
    plays: parts.plays,
    streamUrl: null,
    previewUrl: null,
    needsHydration: true,
    quality: 'YouTube Music',
  }
}

function parseArtistItem(item) {
  const parts = detailParts(item)
  const browseId = navPageType(item) === 'MUSIC_PAGE_TYPE_ARTIST' ? browseIdOf(item) : ''
  if (!browseId) return null
  const subtitle = textOf(flexColumns(item)?.[1] || {}).replace(/^Artist\s*[•·]\s*/i, '').trim()
  return {
    name: parts.title,
    browseId,
    subscribers: subtitle,
    avatar: thumbUrl(item),
  }
}

function parseAlbumItem(item) {
  const browseId = navPageType(item) === 'MUSIC_PAGE_TYPE_ALBUM' ? browseIdOf(item) : ''
  if (!browseId) return null
  const parts = detailParts(item)
  return {
    name: parts.title,
    browseId,
    type: parts.type || 'Album',
    artists: parts.artists,
    year: parts.year,
    cover: thumbUrl(item),
  }
}

function dedupe(list, keyOf) {
  const seen = new Set()
  return list.filter(item => {
    const key = keyOf(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// The top result card is a full song/video header for song queries and an
// artist header for artist queries. Its list only holds related covers, so the
// header must be parsed as the first row — never the related list.
function parseCardSong(card) {
  if (!card) return null
  const buttonVideoId = (card.buttons || [])
    .map(button => button?.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId)
    .find(Boolean)
  const videoId = String(card?.onTap?.watchEndpoint?.videoId || buttonVideoId || '')
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  return parseSongItem({
    playlistItemData: { videoId },
    flexColumns: [
      { musicResponsiveListItemFlexColumnRenderer: { text: card.title } },
      { musicResponsiveListItemFlexColumnRenderer: { text: card.subtitle } },
    ],
    thumbnail: card.thumbnail,
  })
}

function parseSearch(payload, limit = 50) {
  const card = walk(payload, 'musicCardShelfRenderer')[0] || null
  const cardArtistBrowseId = card ? (browseIdOf(card.title) || browseIdOf(card)) : ''
  const cardIsArtist = Boolean(cardArtistBrowseId) && navPageType(card) === 'MUSIC_PAGE_TYPE_ARTIST'
  const cardItems = new Set(cardIsArtist ? walk(card, 'musicResponsiveListItemRenderer') : [])
  const cardArtist = cardIsArtist ? {
    name: textOf(card.title).trim(),
    browseId: cardArtistBrowseId,
    subscribers: textOf(card.subtitle).split('•').slice(1).join('•').trim(),
    avatar: thumbUrl(card),
  } : null
  const cardSongs = card
    ? (cardIsArtist
      ? walk(card, 'musicResponsiveListItemRenderer').map(item => parseSongItem(item, cardArtist)).filter(Boolean)
      : [parseCardSong(card)].filter(Boolean))
    : []
  const items = walk(payload, 'musicResponsiveListItemRenderer').filter(item => !cardItems.has(item))
  const songs = []
  const artists = []
  const albums = []
  for (const item of items) {
    const type = detailParts(item).type.toLowerCase()
    const pageType = navPageType(item)
    if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || /^artist/.test(type)) {
      const artist = parseArtistItem(item)
      if (artist) artists.push(artist)
      continue
    }
    if (pageType === 'MUSIC_PAGE_TYPE_ALBUM' || /^(album|single|ep)$/.test(type)) {
      const album = parseAlbumItem(item)
      if (album) albums.push(album)
      continue
    }
    const song = parseSongItem(item)
    if (song) songs.push(song)
  }
  if (cardArtist?.browseId) artists.unshift(cardArtist)
  const allSongs = dedupe([...cardSongs, ...songs], song => song.videoId)
  // The top result is what the listener asked for, so its credited artists must
  // be clickable cards even when the search response returned no artist row.
  const lead = new Set((allSongs[0]?.artists || []).map(entry => entry.name.toLowerCase()))
  const leadCards = (allSongs[0]?.artists || [])
    .filter(entry => entry.browseId && !artists.some(artist => artist.browseId === entry.browseId))
    .map(entry => ({ name: entry.name, browseId: entry.browseId, subscribers: '', avatar: allSongs[0]?.cover || '' }))
  // Keep the artist cards in the same order a listener sees them: whoever sings
  // the top result comes first, followed by the upstream order.
  const orderedArtists = [...leadCards, ...artists].sort(
    (a, b) => Number(lead.has(String(b.name).toLowerCase())) - Number(lead.has(String(a.name).toLowerCase())),
  )
  return {
    songs: allSongs.slice(0, limit),
    artists: dedupe(orderedArtists, artist => artist.browseId || String(artist.name).toLowerCase()).slice(0, 12),
    albums: dedupe(albums, album => album.browseId || album.name.toLowerCase()).slice(0, 12),
  }
}

function mergeSearchResults(primary, secondary, limit) {
  const songs = new Map()
  for (const song of [...(primary.songs || []), ...(secondary.songs || [])]) {
    const existing = songs.get(song.videoId)
    if (!existing) { songs.set(song.videoId, song); continue }
    // Top-result rows omit duration/album metadata. The songs-filter pass has
    // it, so fill the gaps without changing the upstream order.
    const merged = { ...existing }
    if (!merged.duration && song.duration) merged.duration = song.duration
    if (!merged.year && song.year) merged.year = song.year
    if ((!merged.artists || merged.artists.every(artist => !artist.browseId)) && (song.artists || []).some(artist => artist.browseId)) {
      merged.artists = song.artists
      merged.artist = song.artist
    }
    if ((!merged.album?.name || merged.album.name === 'Single') && song.album?.name && song.album.name !== 'Single') {
      merged.album = song.album
    }
    if (!merged.cover && song.cover) merged.cover = song.cover
    songs.set(song.videoId, merged)
  }
  return {
    songs: [...songs.values()].slice(0, limit),
    artists: dedupe([...(primary.artists || []), ...(secondary.artists || [])], artist => artist.browseId || artist.name.toLowerCase()).slice(0, 12),
    albums: dedupe([...(primary.albums || []), ...(secondary.albums || [])], album => album.browseId || album.name.toLowerCase()).slice(0, 12),
  }
}

function parseRadio(payload, seedVideoId, limit = 25) {
  const queue = walk(payload, 'playlistPanelRenderer')[0] ||
    walk(payload, 'musicQueueRenderer')[0] ||
    payload
  const panel = walk(queue, 'playlistPanelVideoRenderer')
  const songs = []
  for (const entry of panel) {
    const videoId = String(entry?.videoId || entry?.navigationEndpoint?.watchEndpoint?.videoId || '')
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || videoId === seedVideoId) continue
    const byline = runsOf(entry.longBylineText)
    const bullet = byline.findIndex(run => /^\s*[•·]\s*$/.test(run.text || ''))
    const artistPart = bullet >= 0 ? byline.slice(0, bullet) : byline
    const albumPart = bullet >= 0 ? byline.slice(bullet + 1) : []
    const artists = artistRuns(artistPart)
    const artist = (artists.length ? artists.map(item => item.name).join(', ') : textOf(entry.longBylineText).split('•')[0]).trim()
    const album = albumPart.length ? { name: textOf({ runs: albumPart }).replace(/\s*[•·]\s*\d{4}\s*$/, '').trim(), browseId: browseIdOf(albumPart.find(run => run?.navigationEndpoint?.browseEndpoint)) } : { name: '', browseId: '' }
    songs.push({
      id: `yt-${videoId}`,
      videoId,
      provider: 'youtube',
      providerLabel: 'YouTube Music',
      title: textOf(entry.title).trim() || 'Unknown track',
      artist: artist || 'YouTube Music',
      artists: artists.length ? artists : [{ name: artist || 'YouTube Music', browseId: '' }],
      album,
      cover: thumbUrl(entry) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: parseDuration(textOf(entry.lengthText)),
      year: (textOf(entry.longBylineText).match(/\b(19|20)\d{2}\b/) || [''])[0],
      streamUrl: null,
      previewUrl: null,
      needsHydration: true,
      quality: 'YouTube Music',
      radio: true,
    })
    if (songs.length >= limit) break
  }
  return songs
}

function parseTwoRowItem(item) {
  const browseId = navPageType(item) === 'MUSIC_PAGE_TYPE_ARTIST' ? browseIdOf(item) : (item?.navigationEndpoint?.browseEndpoint?.browseId || '')
  const pageType = navPageType(item)
  const name = textOf(item.title).trim()
  if (!name) return null
  if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') {
    return { kind: 'artist', name, browseId, avatar: thumbUrl(item), subtitle: textOf(item.subtitle) }
  }
  return {
    kind: 'album',
    name,
    browseId,
    cover: thumbUrl(item),
    year: textOf(item.subtitle).trim(),
    type: pageType === 'MUSIC_PAGE_TYPE_ALBUM' ? 'Album' : /EP|Single/i.test(textOf(item.subtitle)) ? 'Single' : 'Album',
  }
}

function carouselTitle(carousel) {
  return textOf(carousel?.header?.musicCarouselShelfBasicHeaderRenderer?.title).trim()
}

function parseArtist(payload, nameHint = '') {
  const header = firstOf(payload, ['musicImmersiveHeaderRenderer', 'musicResponsiveHeaderRenderer', 'musicVisualHeaderRenderer'])
  const name = textOf(header?.title).trim() || nameHint
  const description = textOf(header?.description).trim()
  const subscribers = textOf(header?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText) ||
    textOf(header?.monthlyListenerCount) ||
    textOf(header?.subscriberCountText)
  const banner = wideThumbUrl(header)
  const shelf = walk(payload, 'musicShelfRenderer').find(entry => /songs/i.test(textOf(entry.title))) || walk(payload, 'musicShelfRenderer')[0] || null
  const songs = shelf
    ? walk(shelf, 'musicResponsiveListItemRenderer').map(item => parseSongItem(item, name)).filter(Boolean)
    : []
  const albums = []
  const relatedArtists = []
  for (const carousel of walk(payload, 'musicCarouselShelfRenderer')) {
    const title = carouselTitle(carousel)
    if (/album|single|ep/i.test(title)) {
      for (const row of walk(carousel, 'musicTwoRowItemRenderer')) {
        const album = parseTwoRowItem(row)
        if (album?.kind === 'album') albums.push({ ...album, type: /single|ep/i.test(title) ? 'Single' : 'Album' })
      }
    }
    if (/fans|similar|related/i.test(title)) {
      for (const row of walk(carousel, 'musicTwoRowItemRenderer')) {
        const artist = parseTwoRowItem(row)
        if (artist?.kind === 'artist') relatedArtists.push({ name: artist.name, browseId: artist.browseId, avatar: artist.avatar, subscribers: artist.subtitle })
      }
    }
  }
  const avatar = thumbUrl(header?.foregroundThumbnail) || songs[0]?.cover || banner
  return {
    name,
    browseId: browseIdOf(header) || '',
    banner,
    avatar,
    bio: description,
    description,
    subscribers,
    songs: dedupe(songs, song => song.videoId).slice(0, 25),
    albums: dedupe(albums, album => album.browseId || album.name.toLowerCase()).slice(0, 24),
    relatedArtists: dedupe(relatedArtists, artist => artist.browseId || artist.name.toLowerCase()).slice(0, 12),
  }
}

async function readJson(response) {
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (text.length > MAX_BYTES) throw new Error('Oversized upstream response')
    return JSON.parse(text)
  }
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await response.cancel()
        throw new Error('Oversized upstream response')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function createYtmusicHandler({ fetchImpl = globalThis.fetch, timeoutMs = 9000 } = {}) {
  const cache = new Map()

  const remember = (key, ttl, data) => {
    const now = Date.now()
    for (const [entryKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(entryKey)
    if (cache.size >= 300) cache.delete(cache.keys().next().value)
    cache.set(key, { expiresAt: now + ttl, data })
    return data
  }

  return async function ytmusicHandler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Cache-Control', 'no-store')
    const fail = (status, error) => { if (!res.destroyed) { res.statusCode = status; res.end(JSON.stringify({ error })) } }
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET, OPTIONS'); fail(405, 'Method not allowed'); return }

    const incoming = new URL(req.originalUrl || req.url, 'http://localhost')
    const param = (key) => {
      const value = req.query?.[key] ?? incoming.searchParams.get(key)
      return typeof value === 'string' ? value : ''
    }
    const route = param('route')
    const legacySearch = /(?:^|\/)api\/search\/songs$/.test(route) || /\/api\/search\/songs$/.test(incoming.pathname)
    const action = param('action') || (legacySearch ? 'search' : param('q') || param('query') ? 'search' : '')
    const limit = Math.min(60, Math.max(1, Number(param('limit')) || (action === 'radio' ? 25 : 50)))

    const controller = new AbortController()
    const abort = () => controller.abort()
    res.once('close', abort)
    const timer = setTimeout(abort, timeoutMs)

    async function innertube(path, body, budget = timeoutMs) {
      if (controller.signal.aborted) throw new Error('aborted')
      const attempt = new AbortController()
      const cancel = () => attempt.abort()
      controller.signal.addEventListener('abort', cancel, { once: true })
      const deadline = setTimeout(cancel, Math.max(1, Math.min(budget, timeoutMs)))
      try {
        const response = await fetchImpl(`${INNERTUBE_BASE}/${path}?prettyPrint=false`, {
          method: 'POST',
          headers: { ...HEADERS, 'content-type': 'application/json' },
          body: JSON.stringify({ context: { client: CLIENT }, ...body }),
          signal: attempt.signal,
          redirect: 'error',
        })
        if (!response.ok) {
          const status = Number(response.status) || 502
          try { await response.body?.cancel?.() } catch { /* ignore */ }
          throw Object.assign(new Error('InnerTube provider status'), { status })
        }
        return await readJson(response)
      } finally {
        clearTimeout(deadline)
        controller.signal.removeEventListener('abort', cancel)
      }
    }

    try {
      if (action === 'search') {
        const query = (param('q') || param('query')).trim().slice(0, 200)
        if (!query) { fail(400, 'Missing search query'); return }
        const key = `search:${query.toLowerCase()}:${limit}`
        const cached = cache.get(key)
        if (cached && cached.expiresAt > Date.now() && !res.destroyed) {
          res.setHeader('X-EchoSync-Catalog', 'ytmusic-cache')
          res.end(JSON.stringify(cached.data))
          return
        }
        const [unfiltered, filtered] = await Promise.all([
          innertube('search', { query }),
          innertube('search', { query, params: SONGS_FILTER }).catch(() => null),
        ])
        const top = parseSearch(unfiltered, limit)
        const songsOnly = filtered ? parseSearch(filtered, limit) : { songs: [], artists: [], albums: [] }
        const data = mergeSearchResults(top, songsOnly, limit)
        remember(key, SEARCH_TTL, data)
        if (!res.destroyed) {
          res.setHeader('X-EchoSync-Catalog', 'ytmusic-web-remix')
          res.end(JSON.stringify(data))
        }
        return
      }

      if (action === 'radio') {
        const videoId = param('videoId')
        if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) { fail(400, 'Invalid video id'); return }
        const key = `radio:${videoId}:${limit}`
        const cached = cache.get(key)
        if (cached && cached.expiresAt > Date.now() && !res.destroyed) {
          res.setHeader('X-EchoSync-Catalog', 'ytmusic-radio-cache')
          res.end(JSON.stringify(cached.data))
          return
        }
        const payload = await innertube('next', { videoId, playlistId: `RDAMVM${videoId}`, isAudioOnly: true })
        const data = { songs: parseRadio(payload, videoId, limit), videoId, artist: param('artist') }
        remember(key, RADIO_TTL, data)
        if (!res.destroyed) {
          res.setHeader('X-EchoSync-Catalog', 'ytmusic-radio')
          res.end(JSON.stringify(data))
        }
        return
      }

      if (action === 'album') {
        let browseId = param('browseId')
        if (browseId && !/^[A-Za-z0-9_-]{10,80}$/.test(browseId)) { fail(400, 'Invalid album id'); return }
        if (!browseId) {
          const name = param('name').trim().slice(0, 160)
          if (!name) { fail(400, 'Missing album id or name'); return }
          const found = parseSearch(await innertube('search', { query: name }), 30).albums[0]
          browseId = found?.browseId
          if (!browseId) { fail(404, 'Album not found'); return }
        }
        const key = 'album:' + browseId
        const cached = cache.get(key)
        if (cached && cached.expiresAt > Date.now()) { res.end(JSON.stringify(cached.data)); return }
        const payload = await innertube('browse', { browseId })
        const songs = dedupe(walk(payload, 'musicResponsiveListItemRenderer').map(item => parseSongItem(item)).filter(Boolean), song => song.videoId)
        const data = { browseId, songs }
        remember(key, ARTIST_TTL, data)
        if (!res.destroyed) res.end(JSON.stringify(data))
        return
      }
      if (action === 'artist') {
        let browseId = param('browseId')
        const name = param('name').trim().slice(0, 160)
        if (browseId && !/^[A-Za-z0-9_-]{10,40}$/.test(browseId)) { fail(400, 'Invalid artist id'); return }
        if (!browseId) {
          if (!name) { fail(400, 'Missing artist id or name'); return }
          const payload = await innertube('search', { query: name })
          const found = parseSearch(payload, 10).artists[0]
          if (!found?.browseId) { fail(404, 'Artist not found'); return }
          browseId = found.browseId
        }
        const key = `artist:${browseId}`
        const cached = cache.get(key)
        if (cached && cached.expiresAt > Date.now() && !res.destroyed) {
          res.setHeader('X-EchoSync-Catalog', 'ytmusic-artist-cache')
          res.end(JSON.stringify(cached.data))
          return
        }
        const payload = await innertube('browse', { browseId })
        const data = { ...parseArtist(payload, name), browseId }
        remember(key, ARTIST_TTL, data)
        if (!res.destroyed) {
          res.setHeader('X-EchoSync-Catalog', 'ytmusic-artist')
          res.end(JSON.stringify(data))
        }
        return
      }

      fail(400, 'Unsupported action')
    } catch (error) {
      const status = controller.signal.aborted ? 504 : (error?.status && error.status >= 400 && error.status < 600 ? error.status : 502)
      fail(status, status === 504 ? 'YouTube Music request timed out' : 'YouTube Music provider unavailable')
    } finally {
      clearTimeout(timer)
      res.off('close', abort)
      controller.abort()
    }
  }
}

export const ytmusicHandler = createYtmusicHandler()

// Parsers are exported for the integrity suite: the response shapes are the
// contract, and they are verified against frozen InnerTube fixtures.
export { parseSearch, parseRadio, parseArtist, parseSongItem, mergeSearchResults }
