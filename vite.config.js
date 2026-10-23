import { Readable } from 'node:stream'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Innertube } from 'youtubei.js'

const ARTWORK_HOSTS = [
  'mzstatic.com',
  'saavncdn.com',
  'scdn.co',
  'spotifycdn.com',
  'dzcdn.net',
  'googleusercontent.com',
]
const MEDIA_HOSTS = ['googlevideo.com', 'odycdn.com', 'youtube.com', 'ytimg.com', ...ARTWORK_HOSTS]
const MEDIA_CHUNK_SIZE = 1024 * 1024
const MEDIA_UPSTREAM_TIMEOUT = 15_000

function mediaRange(value) {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(String(value || '').trim())
  if (!match) return `bytes=0-${MEDIA_CHUNK_SIZE - 1}`
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : start + MEDIA_CHUNK_SIZE - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return `bytes=0-${MEDIA_CHUNK_SIZE - 1}`
  return `bytes=${start}-${Math.max(start, end)}`
}

function isAllowedMediaHost(hostname = '') {
  const host = hostname.toLowerCase()
  return MEDIA_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

function isArtworkHost(hostname = '') {
  const host = hostname.toLowerCase()
  return ARTWORK_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

let youtubeClientPromise = null
const youtubeAudioCache = new Map()
const youtubeAudioInflight = new Map()

function youtubeClient() {
  if (!youtubeClientPromise) {
    youtubeClientPromise = Innertube.create({ lang: 'en', location: 'US' }).catch((error) => {
      youtubeClientPromise = null
      throw error
    })
  }
  return youtubeClientPromise
}

async function extractYouTubeAudio(videoId) {
  const cached = youtubeAudioCache.get(videoId)
  if (cached && cached.expiresAt > Date.now()) return cached.data
  if (youtubeAudioInflight.has(videoId)) return youtubeAudioInflight.get(videoId)
  const task = (async () => {
    const client = await youtubeClient()
    let lastError = null
    for (const clientType of ['VISIONOS', 'IOS', 'ANDROID_VR']) {
      try {
        const info = await client.getBasicInfo(videoId, { client: clientType })
        const format = info.chooseFormat({ type: 'audio', quality: 'best' })
        if (!format?.url) continue
        const data = {
          url: format.url,
          mimeType: format.mime_type || 'audio/mp4',
          bitrate: Number(format.bitrate || format.average_bitrate) || 0,
          duration: Number(info.basic_info?.duration) || Math.round(Number(format.approx_duration_ms || 0) / 1000) || 0,
          title: info.basic_info?.title || '',
          author: info.basic_info?.author || '',
          thumbnail: info.basic_info?.thumbnail?.[0]?.url || '',
        }
        youtubeAudioCache.set(videoId, { data, expiresAt: Date.now() + 1000 * 60 * 15 })
        return data
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('No playable audio format found')
  })().finally(() => youtubeAudioInflight.delete(videoId))
  youtubeAudioInflight.set(videoId, task)
  return task
}

async function youtubeAudioHandler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  const requestUrl = new URL(req.originalUrl || req.url, 'http://localhost')
  const match = requestUrl.pathname.match(/\/api\/youtube\/audio\/([A-Za-z0-9_-]{6,20})\/?$/)
  if (!match) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid video id' }))
    return
  }
  try {
    const data = await extractYouTubeAudio(match[1])
    res.end(JSON.stringify(data))
  } catch {
    res.statusCode = 502
    res.end(JSON.stringify({ error: 'Unable to resolve audio' }))
  }
}

function youtubeAudioResolver() {
  const register = (server) => {
    youtubeClient().catch(() => {})
    server.middlewares.use('/api/youtube/audio', youtubeAudioHandler)
  }
  return {
    name: 'echosync-youtube-audio',
    configureServer: register,
    configurePreviewServer: register,
  }
}

async function mediaProxyHandler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Content-Type')
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }
  let target
  try {
    const requestUrl = new URL(req.originalUrl || req.url, 'http://localhost')
    target = requestUrl.searchParams.get('url')
  } catch {
    res.statusCode = 400
    res.end('Invalid media URL')
    return
  }
  let parsed
  try {
    parsed = new URL(target)
  } catch {
    res.statusCode = 400
    res.end('Invalid media URL')
    return
  }
  if (!/^https?:$/.test(parsed.protocol) || !isAllowedMediaHost(parsed.hostname)) {
    res.statusCode = 403
    res.end('Media host is not allowed')
    return
  }
  const artwork = isArtworkHost(parsed.hostname) || String(req.headers.accept || '').startsWith('image/')
  const headers = {
    accept: artwork
      ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      : '*/*',
    'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
  }
  if (artwork) {
    headers.referer = `${parsed.protocol}//${parsed.hostname}/`
  } else {
    headers.origin = 'https://www.youtube.com'
    headers.referer = 'https://www.youtube.com/'
    headers.range = mediaRange(req.headers.range)
  }
  let upstream
  let current = parsed
  const controller = new AbortController()
  const abortUpstream = () => controller.abort()
  res.on('close', abortUpstream)
  try {
    for (let hop = 0; hop < 6; hop += 1) {
      if (!isAllowedMediaHost(current.hostname)) {
        throw new Error('Redirected to a disallowed media host')
      }
      const timeout = setTimeout(() => controller.abort(), MEDIA_UPSTREAM_TIMEOUT)
      try {
        upstream = await fetch(current, { headers, redirect: 'manual', signal: controller.signal })
      } finally {
        clearTimeout(timeout)
      }
      const location = upstream.headers.get('location')
      if (upstream.status >= 300 && upstream.status < 400 && location) {
        current = new URL(location, current)
        continue
      }
      break
    }
    if (!upstream) throw new Error('Media request failed')
  } catch {
    res.off('close', abortUpstream)
    if (!res.destroyed) {
      res.statusCode = 502
      res.end('Unable to reach the media stream')
    }
    return
  }
  res.statusCode = upstream.status
  const passthrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'last-modified',
    'etag',
  ]
  passthrough.forEach((name) => {
    const value = upstream.headers.get(name)
    if (value) res.setHeader(name, value)
  })
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method === 'HEAD' || !upstream.body || upstream.status === 204 || upstream.status === 304) {
    res.off('close', abortUpstream)
    res.end()
    return
  }
  res.off('close', abortUpstream)
  const body = Readable.fromWeb(upstream.body)
  res.on('close', () => body.destroy())
  body.on('error', () => {
    if (!res.headersSent) res.statusCode = 502
    res.destroy()
  })
  body.pipe(res)
}

function mediaProxy() {
  const register = (server) => {
    server.middlewares.use('/api/media', mediaProxyHandler)
  }
  return {
    name: 'echosync-media-proxy',
    configureServer: register,
    configurePreviewServer: register,
  }
}

const proxy = (target, rewrite) => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite,
  configure: (proxy) => {
    proxy.on('proxyRes', (proxyRes) => {
      delete proxyRes.headers['www-authenticate']
      delete proxyRes.headers['WWW-Authenticate']
      delete proxyRes.headers['proxy-authenticate']
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), youtubeAudioResolver(), mediaProxy()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/saavn': proxy('https://saavn.sumit.co', (path) => path.replace(/^\/api\/saavn/, '')),
      '/api/piped/kavin': proxy('https://pipedapi.kavin.rocks', (path) => path.replace(/^\/api\/piped\/kavin/, '')),
      '/api/piped/coffee': proxy('https://api.piped.private.coffee', (path) => path.replace(/^\/api\/piped\/coffee/, '')),
      '/api/piped/adminforge': proxy('https://pipedapi.adminforge.de', (path) => path.replace(/^\/api\/piped\/adminforge/, '')),
      '/api/piped/ducks': proxy('https://pipedapi.ducks.party', (path) => path.replace(/^\/api\/piped\/ducks/, '')),
      '/api/invidious/tux': proxy('https://inv.tux.pizza', (path) => path.replace(/^\/api\/invidious\/tux/, '')),
      '/api/invidious/nerd': proxy('https://invidious.nerdvpn.de', (path) => path.replace(/^\/api\/invidious\/nerd/, '')),
      '/api/invidious/f5': proxy('https://invidious.f5.si', (path) => path.replace(/^\/api\/invidious\/f5/, '')),
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api/saavn': proxy('https://saavn.sumit.co', (path) => path.replace(/^\/api\/saavn/, '')),
      '/api/piped/kavin': proxy('https://pipedapi.kavin.rocks', (path) => path.replace(/^\/api\/piped\/kavin/, '')),
      '/api/piped/coffee': proxy('https://api.piped.private.coffee', (path) => path.replace(/^\/api\/piped\/coffee/, '')),
      '/api/piped/adminforge': proxy('https://pipedapi.adminforge.de', (path) => path.replace(/^\/api\/piped\/adminforge/, '')),
      '/api/piped/ducks': proxy('https://pipedapi.ducks.party', (path) => path.replace(/^\/api\/piped\/ducks/, '')),
      '/api/invidious/tux': proxy('https://inv.tux.pizza', (path) => path.replace(/^\/api\/invidious\/tux/, '')),
      '/api/invidious/nerd': proxy('https://invidious.nerdvpn.de', (path) => path.replace(/^\/api\/invidious\/nerd/, '')),
      '/api/invidious/f5': proxy('https://invidious.f5.si', (path) => path.replace(/^\/api\/invidious\/f5/, '')),
    },
  },
})
