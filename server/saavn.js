import { officialUrl, normalizeOfficialPayload } from './jiosaavn.js'
import { cleanTitleCore } from '../src/core/songStem.js'
import { searchSimilarity, phoneticNormalize } from '../src/core/searchRanking.js'

// JioSaavn's official endpoint is authoritative but returns few complete rows
// for some artists. The mirror fills the gap and may return loosely related
// rows; similarity ranks them without discarding valid provider results.
const MIRROR_BASES = ['https://saavn-api-zeta.vercel.app', 'https://saavn-api-seven.vercel.app']
const PROVIDER_TIMEOUT = 3200
const OFFICIAL_TIMEOUT = PROVIDER_TIMEOUT
const MIRROR_TIMEOUT = PROVIDER_TIMEOUT
const MAX_BYTES = 2 * 1024 * 1024
const NOISE_TITLE = /\b(tribute|cover|karaoke|instrumental|lo[\s-]?fi|remix)\b/i
// Full-catalog providers win ties against user-upload mirrors; upload titles
// that only mention the artist in passing are pushed down unless the listener
// explicitly asked for a remix/mashup/cover.
const UPLOAD_NOISE = /\b(official\s*(audio|video)|lyric\s*video|lyrics|prod\.?\s*by|type\s*beat|remix|mashup|bootleg|slowed|reverb|reaction)\b/i
const PROVIDER_BONUS = { jiosaavn: 45, deezer: 40, youtube: 10, audius: -10 }

// Universal catalog sources. Every provider is optional: a slow or blocked
// upstream can never hold the merged response past its own 3.2s budget.
const DEEZER_SEARCH = 'https://api.deezer.com/search'
const PIPED_BASES = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.reallyaweso.me']
const INVIDIOUS_BASES = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be']
const AUDIUS_BASES = ['https://discoveryprovider.audius.co/v1', 'https://discoveryprovider2.audius.co/v1']

async function readJson(response) {
  const reader = response.body?.getReader(); const chunks = []; let size = 0
  if (!reader) throw new Error('Empty provider response')
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) { await response.cancel(); throw new Error('Oversized provider response') }; chunks.push(Buffer.from(value)) }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const HEADERS = {
  accept: 'application/json',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.jiosaavn.com/',
}

function rowTitle(row) {
  return String(row?.title || row?.name || row?.song || row?.trackName || '')
}

function rowArtist(row) {
  const primary = Array.isArray(row?.artists?.primary)
    ? row.artists.primary.map(artist => artist?.name).filter(Boolean)
    : []
  return primary.join(', ') ||
    String(row?.primaryArtists || row?.artist || row?.subtitle?.split(' - ').slice(1).join(' - ') || '')
}

function rowAlbum(row) {
  return String(row?.album?.name || row?.album || '')
}

function durationOf(row) {
  const seconds = Number(row?.duration) || 0
  return seconds
}

function isUsable(row) {
  const duration = durationOf(row)
  if (duration > 0 && duration < 60) return false
  const downloads = Array.isArray(row?.downloadUrl) ? row.downloadUrl : []
  return downloads.some(item => item?.url) || Boolean(row?.previewUrl || row?.streamUrl || row?.youtubeVideoId || row?.id)
}

function popularityOf(row) {
  const plays = Number(row?.playCount)
  if (Number.isFinite(plays) && plays > 0) return plays
  const rank = Number(row?.rank)
  return Number.isFinite(rank) && rank > 0 ? Math.max(0, 1000000 - rank) : 0
}

function relevanceScore(row, query) {
  const rawTitle = rowTitle(row)
  const similarity = searchSimilarity({title:rawTitle,artist:rowArtist(row),album:rowAlbum(row),playCount:row.playCount},query)
  // Literal prefixes cannot override a closer phonetic full-title match.
  const noise = NOISE_TITLE.test(rawTitle) && !NOISE_TITLE.test(query) ? 250 : 0
  return similarity * 1000 - noise
}

function rankRows(rows, query) {
  return rows
    .map((row, index) => ({ row, index, score: relevanceScore(row, query) }))
    .filter(({ row, score }) => {
      return isUsable(row)
    })
    .sort((a, b) => b.score - a.score || popularityOf(b.row) - popularityOf(a.row) || a.index - b.index)
}

function rowImage(url) {
  return url ? [{ quality: '500x500', url }] : []
}

function deezerRow(item) {
  const id = item?.id
  const title = String(item?.title_short || item?.title || '').trim()
  if (!id || !title) return null
  return {
    id: `dz-${id}`,
    provider: 'deezer',
    providerId: String(id),
    name: title,
    duration: Number(item.duration) || 0,
    previewUrl: item.preview || null,
    image: rowImage(item.album?.cover_big || item.album?.cover_medium || item.album?.cover),
    artists: { primary: item.artist?.name ? [{ name: item.artist.name }] : [] },
    album: { name: item.album?.title || 'Single' },
    externalUrl: item.link || null,
    playCount: Number(item.rank) || 0,
  }
}

function youtubeRow(item, source) {
  const videoId = source === 'piped'
    ? String(item?.url || '').split('v=')[1]?.split('&')[0]
    : String(item?.videoId || '')
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) return null
  const title = String(item?.title || '').trim()
  if (!title) return null
  const thumb = source === 'piped'
    ? item?.thumbnail
    : (Array.isArray(item?.videoThumbnails)
        ? (item.videoThumbnails.find(entry => entry?.quality === 'maxresdefault') || item.videoThumbnails.at(-1))?.url
        : null)
  return {
    id: `yt-${videoId}`,
    provider: 'youtube',
    providerId: videoId,
    youtubeVideoId: videoId,
    name: title,
    duration: Number(source === 'piped' ? item?.duration : item?.lengthSeconds) || 0,
    image: rowImage(thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
    artists: { primary: [{ name: item?.uploaderName || item?.author || 'YouTube' }] },
    album: { name: 'YouTube' },
    playCount: Number(item?.views) || 0,
  }
}

function audiusRow(item) {
  const id = item?.id
  const title = String(item?.title || '').trim()
  if (!id || !title) return null
  return {
    id: `au-${id}`,
    provider: 'audius',
    providerId: String(id),
    name: title,
    duration: Number(item.duration) || 0,
    streamUrl: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(id)}/stream?app_name=ECHOSYNC`,
    image: rowImage(item.artwork?.['480x480'] || item.artwork?.['150x150']),
    artists: { primary: [{ name: item?.user?.name || 'Audius' }] },
    album: { name: item?.album_backlink ? 'Audius' : 'Single' },
    playCount: Number(item?.play_count) || 0,
  }
}

// Merge every provider into one canonical, de-duplicated list. When a title
// exists on more than one source we keep the richest row and graft on the
// stream/preview fields the others found, so a guest always has a preview and
// a member always has a playable path.
function mergeProviders(groups, query, limit) {
  const ranked = []
  const penalizeNoise = !UPLOAD_NOISE.test(query)
  groups.forEach((rows, groupIndex) => {
    rankRows(rows, query).forEach((entry, index) => {
      const provider = entry.row.provider || 'jiosaavn'
      const title = rowTitle(entry.row)
      const noise = penalizeNoise && UPLOAD_NOISE.test(title) ? 40 : 0
      // Multi-hour compilations and DJ sets are rarely what a song query means.
      const longPlay = durationOf(entry.row) > 900 && !/\b(mix|mashup|lofi|playlist|compilation)\b/i.test(query) ? 60 : 0
      ranked.push({
        row: entry.row,
        score: entry.score - groupIndex * 3 + (PROVIDER_BONUS[provider] || 0) - noise - longPlay,
        index: index + groupIndex * 1000,
      })
    })
  })
  ranked.sort((a, b) => b.score - a.score || popularityOf(b.row) - popularityOf(a.row) || a.index - b.index)
  const pool = ranked
  const byStem = new Map()
  const ordered = []
  for (const entry of pool) {
    const row = entry.row
    const stem = cleanTitleCore(rowTitle(row))
    if (!stem) continue
    const existing = byStem.get(stem)
    if (!existing) {
      const copy = {
        ...row,
        provider: row.provider || 'jiosaavn',
        providerId: row.providerId || String(row.id || ''),
      }
      byStem.set(stem, copy)
      ordered.push(copy)
      continue
    }
    const names = item => rowArtist(item).split(/,|&|;|\bfeat\.?\s|\bft\.?\s/i).map(phoneticNormalize).filter(Boolean)
    const artists = names(existing), peers = names(row)
    // Canonical title dedupe must never graft a cover's audio onto an original artist.
    if(!artists.some(name=>peers.includes(name)) && !(existing.provider===row.provider && existing.providerId===row.providerId))continue
    if (!existing.previewUrl && row.previewUrl) existing.previewUrl = row.previewUrl
    if (!existing.streamUrl && row.streamUrl) existing.streamUrl = row.streamUrl
    if (!existing.youtubeVideoId && row.youtubeVideoId) existing.youtubeVideoId = row.youtubeVideoId
    if (!existing.downloadUrl?.length && row.downloadUrl?.length) existing.downloadUrl = row.downloadUrl
    if ((!existing.image || !existing.image.length) && row.image?.length) existing.image = row.image
    if (!Number(existing.duration) && Number(row.duration)) existing.duration = row.duration
  }
  return ordered.slice(0, limit)
}

export function createSaavnHandler({ fetchImpl = globalThis.fetch, timeoutMs = 9000 } = {}) {
  return async function saavnHandler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.setHeader('Cache-Control', 'no-store')
    const fail = (status, error) => { if (!res.destroyed) { res.statusCode = status; res.end(JSON.stringify({ error })) } }
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET, OPTIONS'); fail(405, 'Method not allowed'); return }
    const incoming = new URL(req.originalUrl || req.url, 'http://localhost')
    const route = req.query?.route ?? incoming.searchParams.get('route') ?? incoming.pathname.replace(/^\/api\/saavn\/?/, '')
    if (typeof route !== 'string' || !/^(?:api\/search\/songs|api\/songs\/[A-Za-z0-9_-]+)$/.test(route)) { fail(400, 'Invalid catalog route'); return }
    const params = new URLSearchParams()
    for (const key of ['query', 'limit', 'page']) {
      const value = req.query?.[key] ?? incoming.searchParams.get(key)
      if (value != null) { if (typeof value !== 'string' || value.length > 512) { fail(400, 'Invalid catalog query'); return }; params.set(key, value) }
    }
    for (const [key, max] of [['limit', 50], ['page', 100]]) if (params.has(key) && (!/^\d+$/.test(params.get(key)) || +params.get(key) < 1 || +params.get(key) > max)) { fail(400, 'Invalid catalog pagination'); return }

    const search = route === 'api/search/songs'
    const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 50))
    const query = params.get('query') || ''
    const controller = new AbortController()
    const abort = () => controller.abort()
    res.once('close', abort)
    const timer = setTimeout(abort, timeoutMs)
    const state = { lastStatus: 502, validEmpty: false }
    const startedAt = Date.now()
    const remaining = () => timeoutMs - (Date.now() - startedAt)

    async function request(target, budget) {
      if (controller.signal.aborted) throw new Error('aborted')
      if (budget <= 0) throw new Error('deadline')
      const attempt = new AbortController()
      const cancel = () => attempt.abort()
      controller.signal.addEventListener('abort', cancel, { once: true })
      const deadline = setTimeout(cancel, Math.max(1, Math.min(budget, remaining())))
      try {
        const response = await fetchImpl(target, { signal: attempt.signal, redirect: 'error', headers: HEADERS })
        if (!response.ok) {
          state.lastStatus = response.status
          await response.body?.cancel()
          throw Object.assign(new Error('Provider status'), { status: response.status })
        }
        return await readJson(response)
      } finally {
        clearTimeout(deadline)
        controller.signal.removeEventListener('abort', cancel)
      }
    }

    function searchRows(payload) {
      const rows = payload?.data?.results || payload?.data?.songs?.results
      return Array.isArray(rows) ? rows : null
    }

    async function provider(urls, parse) {
      const deadline = Date.now() + PROVIDER_TIMEOUT
      for (const url of urls) {
        const budget = Math.min(PROVIDER_TIMEOUT, deadline - Date.now(), remaining())
        if (controller.signal.aborted || budget < 120) break
        try {
          const rows = parse(await request(url, budget))
          if (rows?.length) return rows
        } catch { /* next alias, never fatal */ }
      }
      return []
    }

    const deezerTask = (searchQuery = query) => provider(
      [`${DEEZER_SEARCH}?q=${encodeURIComponent(searchQuery)}&limit=30`],
      payload => (Array.isArray(payload?.data) ? payload.data.map(deezerRow).filter(Boolean) : []),
    )
    const youtubeTask = () => Promise.all([
      provider(PIPED_BASES.map(base => `${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`),
        payload => (Array.isArray(payload?.items) ? payload.items.map(item => youtubeRow(item, 'piped')).filter(Boolean) : [])),
      provider(INVIDIOUS_BASES.map(base => `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`),
        payload => (Array.isArray(payload) ? payload.map(item => youtubeRow(item, 'invidious')).filter(Boolean) : [])),
    ]).then(groups => groups.flat())
    const audiusTask = () => provider(
      AUDIUS_BASES.map(base => `${base}/tracks/search?query=${encodeURIComponent(query)}&app_name=ECHOSYNC&limit=10`),
      payload => (Array.isArray(payload?.data) ? payload.data.map(audiusRow).filter(Boolean) : []),
    )

    try {
      if (!search) {
        // Song detail keeps the simple fixed-origin failover.
        const detailTargets = [
          { url: officialUrl(route, params), normalize: true, source: 'jiosaavn-direct' },
          ...MIRROR_BASES.map(base => ({ url: new URL('/' + route + (params.size ? '?' + params : ''), base), normalize: false, source: 'mirror-fallback' })),
        ]
        for (const target of detailTargets) {
          if (controller.signal.aborted) break
          try {
            const raw = await request(target.url, Math.min(3200, remaining()))
            const data = target.normalize ? normalizeOfficialPayload(raw, false) : raw
            const hasSong = Array.isArray(data?.data)
              ? data.data.length > 0
              : Boolean(raw && typeof raw === 'object' && Object.values(raw).some(value => value?.id))
            if (!hasSong) throw new Error('Invalid catalog response')
            if (!res.destroyed) { res.setHeader('X-EchoSync-Catalog', target.source); res.statusCode = 200; res.end(JSON.stringify(data)) }
            return
          } catch { /* next fixed-origin provider */ }
        }
        fail(controller.signal.aborted ? 504 : state.lastStatus, controller.signal.aborted ? 'Catalog request timed out' : 'Catalog provider unavailable')
        return
      }

      // Every provider runs in parallel inside its own budget. JioSaavn keeps
      // authority; the aggregate only enriches and fills what it cannot reach.
      const officialTask = (async () => {
        try {
          const officialParams = new URLSearchParams(params)
          officialParams.set('limit', '40')
          const raw = await request(officialUrl(route, officialParams), Math.min(OFFICIAL_TIMEOUT, remaining()))
          const data = normalizeOfficialPayload(raw, true)
          return { rows: Array.isArray(data?.data?.results) ? data.data.results : [], ok: true }
        } catch (error) {
          if (error?.status && error.status !== 429) state.lastStatus = error.status
          return { rows: [], ok: false }
        }
      })()
      const autocompletePromise = query.trim() ? (async () => {
        try {
          const url = officialUrl(route, params)
          url.searchParams.set('__call', 'autocomplete.get')
          url.searchParams.set('query', query)
          const payload = await request(url, Math.min(OFFICIAL_TIMEOUT, remaining()))
          return normalizeOfficialPayload({results:payload?.songs?.data || payload?.data?.songs?.data || []}, true).data.results
        } catch { return [] }
      })() : Promise.resolve([])
      const deezerPromise = query.trim() ? deezerTask() : Promise.resolve([])
      const youtubePromise = query.trim() ? youtubeTask() : Promise.resolve([])
      const audiusPromise = query.trim() ? audiusTask() : Promise.resolve([])

      const correctedDeezer = Promise.all([officialTask,autocompletePromise]).then(async ([official,autocomplete])=>{
        const candidates=[...official.rows,...autocomplete].map(row=>({row,score:searchSimilarity({title:rowTitle(row)},query)})).sort((a,b)=>b.score-a.score)
        const best=candidates[0]
        const corrected=best?.score>=.75 ? cleanTitleCore(rowTitle(best.row)) : ''
        if(!corrected || corrected===query.toLowerCase().trim() || controller.signal.aborted || remaining()<150)return []
        return deezerTask(corrected)
      })
      const [official, external, autocompleteRows, correctedRows] = await Promise.all([
        officialTask,
        Promise.all([deezerPromise, youtubePromise, audiusPromise]),
        autocompletePromise, correctedDeezer,
      ])
      let officialRows = [...official.rows, ...autocompleteRows]
      const officialOk = official.ok
      const officialPlayable = officialRows.filter(isUsable).length
      const needsMirror = !officialOk || officialPlayable < 10
      let mirrorRows = []
      if (needsMirror && !controller.signal.aborted) {
        for (const base of MIRROR_BASES) {
          if (controller.signal.aborted || remaining() < 150) break
          try {
            const target = new URL('/' + route + (params.size ? '?' + params : ''), base)
            const raw = await request(target, Math.min(MIRROR_TIMEOUT, remaining()))
            const rows = searchRows(raw)
            if (!rows) throw new Error('Invalid catalog response')
            if (!rows.length) { state.validEmpty = true; continue }
            mirrorRows = rows
            break
          } catch { /* next mirror alias */ }
        }
      }

      const deezerRows = [...(external[0] || []),...correctedRows]
      const youtubeRows = external[1] || []
      const audiusRows = external[2] || []

      if (!officialRows.length && !mirrorRows.length && !deezerRows.length && !youtubeRows.length && !audiusRows.length) {
        if (state.validEmpty && !controller.signal.aborted) {
          if (!res.destroyed) { res.setHeader('X-EchoSync-Catalog', 'mirror-fallback'); res.statusCode = 200; res.end(JSON.stringify({ data: { results: [], total: 0 } })) }
          return
        }
        fail(controller.signal.aborted ? 504 : state.lastStatus, controller.signal.aborted ? 'Catalog request timed out' : 'Catalog provider unavailable')
        return
      }

      let results = mergeProviders([officialRows, mirrorRows, deezerRows, youtubeRows, audiusRows], query, limit)
      // High-recall continuation: when a title-heavy query collapses to fewer
      // than fifteen canonical stems, pull the next result page and keep only
      // rows that still match the query tokens. Dedupe stays canonical.
      if (results.length < Math.min(15, limit) && !controller.signal.aborted && remaining() > 200) {
        const nextPage = new URLSearchParams(params)
        nextPage.set('page', String((Number(params.get('page')) || 1) + 1))
        let extraRows = []
        try {
          const raw = await request(officialUrl(route, nextPage), Math.min(2500, remaining()))
          extraRows = normalizeOfficialPayload(raw, true)?.data?.results || []
        } catch { /* recall is additive, never fatal */ }
        if (!extraRows.length) {
          for (const base of MIRROR_BASES) {
            if (controller.signal.aborted || remaining() < 150) break
            try {
              const target = new URL('/' + route + (nextPage.size ? '?' + nextPage : ''), base)
              const rows = searchRows(await request(target, Math.min(2000, remaining())))
              if (!rows?.length) continue
              extraRows = rows
              break
            } catch { /* next mirror alias */ }
          }
        }
        if (extraRows.length) {
          const pool = rankRows(extraRows, query).map(entry => entry.row)
          const seen = new Set(results.map(row => cleanTitleCore(rowTitle(row))))
          for (const entry of pool) {
            const row = entry?.row ? entry.row : entry
            const stem = cleanTitleCore(rowTitle(row))
            if (!stem || seen.has(stem) || !isUsable(row)) continue
            seen.add(stem)
            results.push({
              ...row,
              provider: row.provider || 'jiosaavn',
              providerId: row.providerId || String(row.id || ''),
            })
            if (results.length >= limit) break
          }
        }
      }
      if (!res.destroyed) {
        const sources = []
        if (officialPlayable || officialRows.length) sources.push('jiosaavn-direct')
        if (mirrorRows.length) sources.push('mirror-fallback')
        if (deezerRows.length) sources.push('deezer')
        if (youtubeRows.length) sources.push('youtube')
        if (audiusRows.length) sources.push('audius')
        res.setHeader('X-EchoSync-Catalog', sources.join('+') || 'jiosaavn-direct')
        res.statusCode = 200
        res.end(JSON.stringify({ data: { results, total: results.length } }))
      }
    } finally {
      clearTimeout(timer)
      res.off('close', abort)
      controller.abort()
    }
  }
}
export const saavnHandler = createSaavnHandler()
