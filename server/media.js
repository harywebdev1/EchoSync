import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MEDIA_HOSTS = ['googlevideo.com', 'odycdn.com', 'youtube.com', 'ytimg.com', 'mzstatic.com', 'saavncdn.com', 'scdn.co', 'spotifycdn.com', 'dzcdn.net', 'googleusercontent.com']
const CHUNK_BYTES = 1024 * 1024
const ARTWORK_BYTES = 4 * 1024 * 1024
const allowed = url => url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
  && MEDIA_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))

function boundedRange(value) {
  if (!value) return `bytes=0-${CHUNK_BYTES - 1}`
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value).trim())
  if (!match || (!match[1] && !match[2])) return null
  if (!match[1]) {
    const suffix = Number(match[2])
    return Number.isSafeInteger(suffix) && suffix > 0 ? `bytes=-${Math.min(suffix, CHUNK_BYTES)}` : null
  }
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : start + CHUNK_BYTES - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) return null
  return `bytes=${start}-${Math.min(end, start + CHUNK_BYTES - 1)}`
}

export function createMediaHandler({ fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  return async function mediaHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Content-Type')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const fail = (status, message) => { if (!res.destroyed && !res.headersSent) { res.statusCode = status; res.end(message) } }
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD, OPTIONS'); fail(405, 'Method not allowed'); return }
    let target
    try {
      const requestUrl = new URL(req.originalUrl || req.url, 'http://localhost')
      const raw = req.query?.url ?? requestUrl.searchParams.get('url')
      if (typeof raw !== 'string') throw new Error('Missing URL')
      target = new URL(raw)
    } catch { fail(400, 'Invalid media URL'); return }
    if (!allowed(target)) { fail(403, 'Media host is not allowed'); return }
    const artwork = String(req.headers.accept || '').startsWith('image/') || /\.(?:jpe?g|png|gif|webp|avif|svg)$/i.test(target.pathname)
    const range = boundedRange(req.headers.range)
    if (req.headers.range && !range) { fail(416, 'Unsupported byte range'); return }
    const headers = { accept: req.headers.accept || '*/*', 'accept-encoding': 'identity', 'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
      referer: artwork ? `${target.origin}/` : 'https://www.youtube.com/' }
    if (!artwork) headers.origin = 'https://www.youtube.com'
    if (!artwork || req.headers.range) headers.range = range
    const controller = new AbortController()
    const abort = () => controller.abort()
    res.once('close', abort)
    const timeout = setTimeout(abort, timeoutMs)
    let upstream
    try {
      for (let hop = 0; hop <= 5; hop++) {
        if (!allowed(target)) { fail(403, 'Redirected media host is not allowed'); return }
        upstream = await fetchImpl(target, { method: req.method, headers, redirect: 'manual', signal: controller.signal })
        const location = upstream.headers.get('location')
        if (upstream.status >= 300 && upstream.status < 400 && location) {
          await upstream.body?.cancel()
          if (hop === 5) throw new Error('Too many redirects')
          target = new URL(location, target)
          continue
        }
        break
      }
      const limit = artwork ? ARTWORK_BYTES : CHUNK_BYTES
      if (req.method !== 'HEAD' && Number(upstream.headers.get('content-length')) > limit) {
        await upstream.body?.cancel()
        fail(502, 'Upstream ignored the bounded media request')
        return
      }
      res.statusCode = upstream.status
      for (const name of ['content-type', 'content-range', 'accept-ranges', 'cache-control', 'last-modified', 'etag']) {
        const value = upstream.headers.get(name)
        if (value) res.setHeader(name, value)
      }
      // Fetch transparently decompresses encoded bodies; do not forward their compressed length.
      if (!upstream.headers.get('content-encoding') && upstream.headers.has('content-length')) res.setHeader('Content-Length', upstream.headers.get('content-length'))
      if (req.method === 'HEAD' || !upstream.body || [204, 304].includes(upstream.status)) {
        await upstream.body?.cancel()
        res.end()
        return
      }
      let bytes = 0
      const bound = new Transform({ transform(chunk, encoding, callback) {
        bytes += chunk.length
        callback(bytes > limit ? new Error('Media response exceeded the bounded request') : null, chunk)
      } })
      // Await the complete stream so a serverless invocation cannot finish after headers alone.
      await pipeline(Readable.fromWeb(upstream.body), bound, res, { signal: controller.signal })
    } catch {
      if (res.headersSent) res.destroy()
      else fail(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'Media request timed out' : 'Unable to reach the media stream')
    } finally {
      clearTimeout(timeout)
      res.off('close', abort)
      controller.abort()
    }
  }
}

export const mediaHandler = createMediaHandler()
