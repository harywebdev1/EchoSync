const ORIGIN = 'https://saavn.sumit.co'
const MAX_BYTES = 2 * 1024 * 1024

export function createSaavnHandler({ fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  return async function saavnHandler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Cache-Control', 'no-store')
    const fail = (status, error) => { if (!res.destroyed) { res.statusCode = status; res.end(JSON.stringify({ error })) } }
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET, OPTIONS'); fail(405, 'Method not allowed'); return }
    const incoming = new URL(req.originalUrl || req.url, 'http://localhost')
    const suffix = incoming.pathname.replace(/^\/api\/saavn\/?/, '')
    const route = req.query?.route ?? incoming.searchParams.get('route') ?? suffix
    // Only the catalog operations used by the app can reach the fixed upstream.
    if (typeof route !== 'string' || !/^(?:api\/search\/songs|api\/songs\/[A-Za-z0-9_-]+)$/.test(route)) {
      fail(400, 'Invalid catalog route'); return
    }
    const url = new URL('/' + route, ORIGIN)
    for (const key of ['query', 'limit', 'page']) {
      const value = req.query?.[key] ?? incoming.searchParams.get(key)
      if (value != null) {
        if (typeof value !== 'string' || value.length > 512) { fail(400, 'Invalid catalog query'); return }
        url.searchParams.set(key, value)
      }
    }
    const controller = new AbortController()
    const abort = () => controller.abort()
    res.once('close', abort)
    const timer = setTimeout(abort, timeoutMs)
    try {
      const upstream = await fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } })
      const reader = upstream.body?.getReader()
      let size = 0
      const chunks = []
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Catalog response too large') }
            chunks.push(Buffer.from(value))
          }
        } finally { reader.releaseLock() }
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!res.destroyed) { res.statusCode = upstream.status; res.end(JSON.stringify(data)) }
    } catch { fail(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'Catalog request timed out' : 'Catalog provider unavailable') }
    finally { clearTimeout(timer); res.off('close', abort); controller.abort() }
  }
}

export const saavnHandler = createSaavnHandler()
