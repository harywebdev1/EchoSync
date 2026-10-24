import { officialUrl, normalizeOfficialPayload } from './jiosaavn.js'
const FALLBACKS = ['https://saavn.dev', 'https://saavn.sumit.co']
const MAX_BYTES = 2 * 1024 * 1024
async function readJson(response) {
  const reader = response.body?.getReader(); const chunks = []; let size = 0
  if (!reader) throw new Error('Empty provider response')
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Oversized provider response') }; chunks.push(Buffer.from(value)) }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
export function createSaavnHandler({ fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
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
    const controller = new AbortController(), abort = () => controller.abort()
    res.once('close', abort); const timer = setTimeout(abort, timeoutMs)
    let lastStatus = 502
    try {
      const targets = [officialUrl(route, params), ...FALLBACKS.map(base => new URL('/' + route + (params.size ? '?' + params : ''), base))]
      for (let index = 0; index < targets.length && !controller.signal.aborted; index++) {
        const attempt = new AbortController(), cancel = () => attempt.abort()
        controller.signal.addEventListener('abort', cancel, { once: true })
        const deadline = setTimeout(cancel, index === 0 ? Math.min(4500, timeoutMs) : 1700)
        try {
          const response = await fetchImpl(targets[index], { signal: attempt.signal, redirect: 'error', headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0', referer: 'https://www.jiosaavn.com/' } })
          if (!response.ok) { lastStatus = response.status; await response.body?.cancel(); continue }
          const raw = await readJson(response)
          const data = index === 0 ? normalizeOfficialPayload(raw, route === 'api/search/songs') : raw
          if (index === 0 && route === 'api/search/songs' && raw?.results?.length && !data.data.results.length) throw new Error('Official media unavailable')
          // A valid empty search is authoritative; malformed/error payloads are not.
          if (index === 0 && !(Array.isArray(raw?.results) || raw?.songs || (route !== 'api/search/songs' && raw && typeof raw === 'object' && Object.values(raw).some(x => x?.id)))) throw new Error('Invalid official response')
          if (!res.destroyed) { res.setHeader('X-EchoSync-Catalog', index === 0 ? 'jiosaavn-direct' : 'mirror-fallback'); res.statusCode = 200; res.end(JSON.stringify(data)) }; return
        } catch { if (lastStatus === 200) lastStatus = 502 }
        finally { clearTimeout(deadline); controller.signal.removeEventListener('abort', cancel) }
      }
      fail(controller.signal.aborted ? 504 : lastStatus, controller.signal.aborted ? 'Catalog request timed out' : 'Catalog provider unavailable')
    } finally { clearTimeout(timer); res.off('close', abort); controller.abort() }
  }
}
export const saavnHandler = createSaavnHandler()
