import { officialUrl, normalizeOfficialPayload } from './jiosaavn.js'
import { cleanTitleCore } from '../src/core/songStem.js'

// JioSaavn's official endpoint is authoritative but returns few complete rows
// for some artists. The mirror fills the gap and may return loosely related
// rows, so everything from it is ranked and relevance-filtered before merging.
const MIRROR_BASES = ['https://saavn-api-zeta.vercel.app', 'https://saavn-api-seven.vercel.app']
const OFFICIAL_TIMEOUT = 3500
const MIRROR_TIMEOUT = 3500
const MAX_BYTES = 2 * 1024 * 1024
const JUNK_TITLE = /\b(karaoke|ringtone|tribute|made famous|in the style of|originally performed|nightcore|sped up|speed up|8d audio|8-d audio)\b/i

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

function normalizeWords(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function queryTokens(query) {
  return [...new Set(normalizeWords(query).split(' ').filter(token => token.length > 1 || /\d/.test(token)))]
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

function isPlayable(row) {
  const duration = Number(row?.duration) || 0
  if (duration > 0 && duration < 60) return false
  const downloads = Array.isArray(row?.downloadUrl) ? row.downloadUrl : []
  return downloads.some(item => item?.url)
}

function isJunk(row) {
  return JUNK_TITLE.test(`${rowTitle(row)} ${rowAlbum(row)}`)
}

function relevanceScore(row, query) {
  const tokens = queryTokens(query)
  if (!tokens.length) return 0
  const title = cleanTitleCore(rowTitle(row))
  const artist = normalizeWords(rowArtist(row))
  const album = normalizeWords(rowAlbum(row))
  if (!title && !artist) return 0
  const queryCore = cleanTitleCore(query)
  const haystack = `${title} ${artist} ${album}`
  const present = tokens.filter(token => haystack.includes(token))
  if (!present.length) return 0
  let score = 0
  if (queryCore && title === queryCore) score += 140
  else if (queryCore && title.startsWith(queryCore)) score += 95
  else if (queryCore && title.includes(queryCore)) score += 65
  if (present.length === tokens.length) score += 45
  if (normalizeWords(rowArtist(row)).includes(normalizeWords(query))) score += 55
  else if (present.some(token => artist.includes(token))) score += 18
  if (normalizeWords(rowAlbum(row)).includes(normalizeWords(query))) score += 20
  score += present.length * 10
  const plays = Number(row?.playCount)
  if (Number.isFinite(plays) && plays > 0) score += Math.min(10, Math.log10(plays))
  return score
}

function rankRows(rows, query, { strict = false } = {}) {
  const tokens = queryTokens(query)
  const threshold = Math.max(1, Math.ceil(tokens.length / 2))
  return rows
    .map((row, index) => ({ row, index, score: relevanceScore(row, query) }))
    .filter(({ row, score }) => {
      if (isJunk(row) || !isPlayable(row)) return false
      if (!strict) return true
      const haystack = `${normalizeWords(rowTitle(row))} ${normalizeWords(rowArtist(row))} ${normalizeWords(rowAlbum(row))}`
      const matched = tokens.filter(token => haystack.includes(token)).length
      return score > 0 && matched >= threshold
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
}

function mergeAndRank(official, mirror, query, limit) {
  const strict = rankRows(mirror, query, { strict: true })
  const loose = rankRows(mirror, query)
  // Never let an odd query collapse a valid mirror into zero rows.
  const mirrorRows = strict.length ? strict : loose
  const combined = [
    ...rankRows(official, query),
    ...mirrorRows.map(item => ({ ...item, score: item.score - 4, index: item.index + official.length })),
  ]
  const seen = new Set()
  const deduped = []
  for (const entry of combined.sort((a, b) => b.score - a.score || a.index - b.index)) {
    const stem = cleanTitleCore(rowTitle(entry.row))
    if (!stem || seen.has(stem)) continue
    seen.add(stem)
    deduped.push(entry.row)
    if (deduped.length >= limit) break
  }
  return deduped
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
    const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 12))
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
            const raw = await request(target.url, target.source === 'jiosaavn-direct' ? Math.min(3200, remaining()) : Math.min(2500, remaining()))
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

      let officialRows = []
      let officialOk = false
      try {
        const raw = await request(officialUrl(route, params), Math.min(OFFICIAL_TIMEOUT, remaining()))
        const data = normalizeOfficialPayload(raw, true)
        officialRows = Array.isArray(data?.data?.results) ? data.data.results : []
        officialOk = true
      } catch (error) {
        if (error?.status && error.status !== 429) state.lastStatus = error.status
      }

      const officialPlayable = officialRows.filter(row => !isJunk(row) && isPlayable(row)).length
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

      if (!officialRows.length && !mirrorRows.length) {
        if (state.validEmpty && !controller.signal.aborted) {
          if (!res.destroyed) { res.setHeader('X-EchoSync-Catalog', 'mirror-fallback'); res.statusCode = 200; res.end(JSON.stringify({ data: { results: [], total: 0 } })) }
          return
        }
        fail(controller.signal.aborted ? 504 : state.lastStatus, controller.signal.aborted ? 'Catalog request timed out' : 'Catalog provider unavailable')
        return
      }

      let results = mergeAndRank(officialRows, mirrorRows, query, limit)
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
          const strict = rankRows(extraRows, query, { strict: true })
          const pool = (strict.length ? strict : rankRows(extraRows, query)).map(entry => entry.row)
          const seen = new Set(results.map(row => cleanTitleCore(rowTitle(row))))
          for (const row of pool) {
            const stem = cleanTitleCore(rowTitle(row))
            if (!stem || seen.has(stem) || isJunk(row) || !isPlayable(row)) continue
            seen.add(stem)
            results.push(row)
            if (results.length >= limit) break
          }
        }
      }
      if (!res.destroyed) {
        res.setHeader('X-EchoSync-Catalog', mirrorRows.length ? (officialPlayable ? 'official+mirror' : 'mirror-fallback') : 'jiosaavn-direct')
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
