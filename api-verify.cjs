const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const fs = require('node:fs')
let passed = 0

;(async () => {
  const [{ createMediaHandler }, { createYoutubeAudioHandler }, mediaRoute, youtubeRoute] = await Promise.all([
    import('./server/media.js'), import('./server/youtubeAudio.js'), import('./api/media.js'), import('./api/youtube-audio.js'),
  ])
  const servers = []
  async function endpoint(handler) {
    const server = createServer((req, res) => { Promise.resolve(handler(req, res)).catch(error => res.destroy(error)) })
    servers.push(server)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${server.address().port}`
  }
  async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }
  const mediaPath = url => '/api/media?url=' + encodeURIComponent(url)
  const target = 'https://r1.googlevideo.com/stream'
  try {
    await check('serverless entrypoints import as Node handlers without initializing upstream clients', () => {
      assert.equal(typeof mediaRoute.default, 'function'); assert.equal(typeof youtubeRoute.default, 'function')
    })
    await check('media validation rejects unsupported methods, malformed URLs and disallowed targets before fetch', async () => {
      let calls = 0
      const base = await endpoint(createMediaHandler({ fetchImpl: () => { calls++; throw new Error('Unexpected fetch') } }))
      assert.equal((await fetch(base + '/api/media', { method: 'OPTIONS' })).status, 204)
      assert.equal((await fetch(base + mediaPath(target), { method: 'POST' })).status, 405)
      assert.equal((await fetch(base + '/api/media')).status, 400)
      for (const url of ['https://127.0.0.1/a', 'https://googlevideo.com.evil.test/a', 'http://r1.googlevideo.com/a', 'https://user:secret@r1.googlevideo.com/a', 'https://r1.googlevideo.com:8080/a', 'file:///etc/passwd']) {
        assert.equal((await fetch(base + mediaPath(url))).status, 403, url)
      }
      assert.equal(calls, 0)
    })
    await check('audio range requests stream real bytes and preserve 206, seeking and cache headers', async () => {
      const seen = []
      const base = await endpoint(createMediaHandler({ fetchImpl: async (url, options) => {
        seen.push({ url: String(url), ...options })
        return new Response(Buffer.from('audio'), { status: 206, headers: { 'content-type': 'audio/mp4', 'content-length': '5', 'content-range': 'bytes 20-24/200', 'accept-ranges': 'bytes', etag: 'fixture', 'cache-control': 'private, max-age=10' } })
      } }))
      const response = await fetch(base + mediaPath(target), { headers: { Range: 'bytes=20-24' } })
      assert.equal(response.status, 206); assert.equal(await response.text(), 'audio')
      for (const [name, value] of Object.entries({ 'content-type': 'audio/mp4', 'content-range': 'bytes 20-24/200', 'accept-ranges': 'bytes', etag: 'fixture' })) assert.equal(response.headers.get(name), value)
      assert.equal(seen[0].headers.range, 'bytes=20-24')
      assert.equal(seen[0].redirect, 'manual')
      assert.equal(response.headers.get('access-control-allow-origin'), '*')
      await (await fetch(base + mediaPath(target))).text()
      assert.equal(seen[1].headers.range, 'bytes=0-1048575')
      await (await fetch(base + mediaPath(target), { headers: { range: 'bytes=20-9000000' } })).text()
      assert.equal(seen[2].headers.range, 'bytes=20-1048595')
      await (await fetch(base + mediaPath(target), { headers: { range: 'bytes=-20' } })).text()
      assert.equal(seen[3].headers.range, 'bytes=-20')
      for (const range of ['bytes=1-2,4-5', 'bytes=20-10', 'bytes=-', 'bytes=9007199254740992-']) assert.equal((await fetch(base + mediaPath(target), { headers: { range } })).status, 416)
      assert.equal(seen.length, 4)
    })
    await check('HEAD reaches upstream as HEAD; artwork and Saavn audio are classified by content intent', async () => {
      const seen = []
      const base = await endpoint(createMediaHandler({ fetchImpl: async (url, options) => {
        seen.push(options)
        return new Response(options.method === 'HEAD' ? null : 'ok', { headers: { 'content-type': 'audio/mp4', 'content-length': options.method === 'HEAD' ? '5000000' : '2' } })
      } }))
      const head = await fetch(base + mediaPath(target), { method: 'HEAD' })
      assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), '5000000'); assert.equal(seen[0].method, 'HEAD')
      await (await fetch(base + mediaPath('https://aac.saavncdn.com/song.m4a'))).text()
      assert.equal(seen[1].headers.range, 'bytes=0-1048575')
      await (await fetch(base + mediaPath('https://c.saavncdn.com/cover.jpg'), { headers: { accept: 'image/webp,image/*' } })).text()
      assert.equal(seen[2].headers.range, undefined)
    })
    await check('every redirect is validated; loops terminate and upstream errors retain their HTTP status', async () => {
      let calls = 0
      const denied = await endpoint(createMediaHandler({ fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }) } }))
      assert.equal((await fetch(denied + mediaPath(target))).status, 403); assert.equal(calls, 1)
      calls = 0
      const loop = await endpoint(createMediaHandler({ fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: target } }) } }))
      assert.equal((await fetch(loop + mediaPath(target))).status, 502); assert.equal(calls, 6)
      const gone = await endpoint(createMediaHandler({ fetchImpl: async () => new Response('Gone', { status: 410 }) }))
      assert.equal((await fetch(gone + mediaPath(target))).status, 410)
    })
    await check('oversized responses are rejected instead of buffering full songs', async () => {
      let cancelled = false
      const base = await endpoint(createMediaHandler({ fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { 'content-length': '5000000' } }) }))
      assert.equal((await fetch(base + mediaPath(target))).status, 502); assert.equal(cancelled, true)
    })
    await check('upstream deadlines abort fetch; disconnects cancel in-progress streaming', async () => {
      let aborted = false
      const timeout = await endpoint(createMediaHandler({ timeoutMs: 25, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')) }, { once: true })) }))
      assert.equal((await fetch(timeout + mediaPath(target))).status, 504); assert.equal(aborted, true)
      let cancel
      const cancelled = new Promise(resolve => { cancel = resolve })
      const streaming = await endpoint(createMediaHandler({ fetchImpl: async (_, { signal }) => {
        signal.addEventListener('abort', cancel, { once: true })
        return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])) }, cancel }))
      } }))
      const controller = new AbortController()
      const response = await fetch(streaming + mediaPath(target), { signal: controller.signal })
      await response.body.getReader().read()
      controller.abort()
      await Promise.race([cancelled, new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect did not cancel upstream')), 2000))])
    })
    await check('YouTube route accepts the existing path and rewritten query, validates IDs and returns the payload', async () => {
      const seen = []
      const payload = { url: target, duration: 180, mimeType: 'audio/mp4', bitrate: 128000 }
      const base = await endpoint(createYoutubeAudioHandler({ resolve: async id => { seen.push(id); return payload } }))
      for (const route of ['/api/youtube/audio/dQw4w9WgXcQ', '/api/youtube-audio?videoId=dQw4w9WgXcQ']) {
        const response = await fetch(base + route)
        assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), payload)
      }
      assert.equal((await fetch(base + '/api/youtube-audio?videoId=bad')).status, 400)
      assert.equal((await fetch(base + '/api/youtube-audio', { method: 'POST' })).status, 405)
      assert.deepEqual(seen, ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'])
    })
    await check('YouTube timeout and resolver failures are bounded and do not leak upstream secrets', async () => {
      for (const resolve of [() => Promise.reject(new Error('secret signed URL')), () => new Promise(() => {})]) {
        const base = await endpoint(createYoutubeAudioHandler({ resolve, timeoutMs: 25 }))
        const response = await fetch(base + '/api/youtube/audio/dQw4w9WgXcQ')
        assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'Unable to resolve audio' })
      }
    })
    await check('Vercel rewrites preserve API routes and exclude API/assets from SPA fallback', () => {
      const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
      const youtube = config.rewrites.find(route => route.source === '/api/youtube/audio/:videoId')
      assert.equal(youtube.destination, '/api/youtube-audio?videoId=:videoId')
      const spa = new RegExp('^' + config.rewrites.at(-1).source + '$')
      assert.equal(spa.test('/library'), true); assert.equal(spa.test('/room/ES-TEST'), true)
      assert.equal(spa.test('/api/media'), false); assert.equal(spa.test('/api/unknown'), false); assert.equal(spa.test('/assets/app.js'), false)
      assert.equal(config.outputDirectory, 'dist'); assert.equal(config.functions['api/media.js'].maxDuration, 30)
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      assert.ok(pkg.dependencies['youtubei.js']); assert.equal(pkg.devDependencies['youtubei.js'], undefined)
    })
    console.log(`Application API verification: ${passed} checks passed (controlled upstream, no live-provider claims)`)
  } finally {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
