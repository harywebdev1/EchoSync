const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const fs = require('node:fs')
let passed = 0

const artistEndpoint = browseId => ({
  browseEndpoint: {
    browseId,
    browseEndpointContextSupportedConfigs: {
      browseEndpointContextMusicConfig: { pageType: 'MUSIC_PAGE_TYPE_ARTIST' },
    },
  },
})
const albumEndpoint = browseId => ({
  browseEndpoint: {
    browseId,
    browseEndpointContextSupportedConfigs: {
      browseEndpointContextMusicConfig: { pageType: 'MUSIC_PAGE_TYPE_ALBUM' },
    },
  },
})
const runs = list => ({ runs: list })
const flex = text => ({ musicResponsiveListItemFlexColumnRenderer: { text } })
const thumb = url => ({ musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url, width: 120, height: 120 }] } } })

function songRow({ videoId, title, artist, artistId, album = 'Album', albumId = 'MPREalbum01', length = '3:45' }) {
  return {
    playlistItemData: { videoId },
    flexColumns: [
      flex(runs([{ text: title }])),
      flex(runs([
        { text: 'Song' },
        { text: ' â€¢ ' },
        { text: artist, navigationEndpoint: artistEndpoint(artistId) },
        { text: ' â€¢ ' },
        { text: album, navigationEndpoint: albumEndpoint(albumId) },
        { text: ' â€¢ ' },
        { text: '2023' },
        { text: ' â€¢ ' },
        { text: length },
      ])),
    ],
    thumbnail: thumb('https://lh3.googleusercontent.com/song=w120-h120-l90-rj'),
  }
}

const searchPayload = {
  contents: [
    {
      itemSectionRenderer: {
        contents: [
          { musicResponsiveListItemRenderer: songRow({ videoId: 'VIDEO000001', title: 'Pasoori', artist: 'Ali Sethi', artistId: 'UCaliSethi01', album: 'Coke Studio Season 14', albumId: 'MPREcoke01' }) },
          { musicResponsiveListItemRenderer: songRow({ videoId: 'VIDEO000002', title: 'Kesariya', artist: 'Arijit Singh', artistId: 'UCarijit001' }) },
        ],
      },
    },
  ],
}

const radioPayload = {
  contents: [
    {
      playlistPanelRenderer: {
        contents: [
          {
            playlistPanelVideoRenderer: {
              videoId: 'VIDEO000001',
              title: runs([{ text: 'Pasoori' }]),
              longBylineText: runs([{ text: 'Ali Sethi', navigationEndpoint: artistEndpoint('UCaliSethi01') }, { text: ' â€¢ ' }, { text: 'Coke Studio Season 14' }, { text: ' â€¢ ' }, { text: '2023' }]),
              lengthText: runs([{ text: '3:45' }]),
              thumbnail: thumb('https://lh3.googleusercontent.com/seed=w120-h120-l90-rj'),
            },
          },
          {
            playlistPanelVideoRenderer: {
              videoId: 'VIDEO000003',
              title: runs([{ text: 'Paniyon Sa' }]),
              longBylineText: runs([{ text: 'Atif Aslam', navigationEndpoint: artistEndpoint('UCatifAslam1') }, { text: ' â€¢ ' }, { text: 'Satyameva Jayate' }, { text: ' â€¢ ' }, { text: '2018' }]),
              lengthText: runs([{ text: '4:05' }]),
              thumbnail: thumb('https://lh3.googleusercontent.com/radio=w120-h120-l90-rj'),
            },
          },
        ],
      },
    },
  ],
}

const artistPayload = {
  header: {
    musicImmersiveHeaderRenderer: {
      title: runs([{ text: 'Ali Sethi' }]),
      description: runs([{ text: 'Pakistani singer and composer.' }]),
      subscriptionButton: { subscribeButtonRenderer: { subscriberCountText: runs([{ text: '2.1M subscribers' }]) } },
      thumbnail: thumb('https://lh3.googleusercontent.com/banner=w1200-h1200-l90-rj'),
    },
  },
  contents: [
    {
      musicShelfRenderer: {
        title: runs([{ text: 'Top songs' }]),
        contents: [{ musicResponsiveListItemRenderer: songRow({ videoId: 'VIDEO000001', title: 'Pasoori', artist: 'Ali Sethi', artistId: 'UCaliSethi01' }) }],
      },
    },
  ],
}

function innertubeFixture(url) {
  const path = new URL(url).pathname
  if (path.endsWith('/search')) return searchPayload
  if (path.endsWith('/next')) return radioPayload
  if (path.endsWith('/browse')) return artistPayload
  return {}
}

;(async () => {
  const [{ createMediaHandler }, { createYoutubeAudioHandler }, { createYtmusicHandler }, mediaRoute, youtubeRoute, ytmusicRoute, saavnRoute] = await Promise.all([
    import('./server/media.js'),
    import('./server/youtubeAudio.js'),
    import('./server/ytmusicHandler.js'),
    import('./api/media.js'),
    import('./api/youtube-audio.js'),
    import('./api/ytmusic.js'),
    import('./api/saavn.js'),
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
    await check('ytmusic and its saavn alias search one WEB_REMIX upstream without touching any legacy provider', async () => {
      const calls = []
      const base = await endpoint(createYtmusicHandler({
        fetchImpl: async (url, options) => {
          calls.push({ url: new URL(url), body: JSON.parse(options.body) })
          return Response.json(innertubeFixture(url))
        },
      }))
      const cases = [
        ['/api/ytmusic?action=search&q=Atif%20Aslam&limit=2', 'Atif Aslam'],
        ['/api/saavn/api/search/songs?query=Hasan%20Raheem&limit=2', 'Hasan Raheem'],
        ['/api/saavn?route=api%2Fsearch%2Fsongs&query=Kaavish&limit=2', 'Kaavish'],
      ]
      for (const [path] of cases) {
        const response = await fetch(base + path)
        assert.equal(response.status, 200, path)
        assert.match(response.headers.get('content-type'), /application\/json/)
        assert.equal(response.headers.get('access-control-allow-origin'), '*')
        const payload = await response.json()
        assert.equal(payload.songs.length, 2)
        assert.equal(payload.songs[0].id, 'yt-VIDEO000001')
        assert.equal(payload.songs[0].artists[0].browseId, 'UCaliSethi01')
        assert.equal(payload.songs[0].duration, 225)
      }
      assert.ok(calls.length >= 4)
      for (const call of calls) {
        assert.equal(call.url.origin, 'https://music.youtube.com')
        assert.deepEqual(call.body.context.client, { clientName: 'WEB_REMIX', clientVersion: '1.20260101.01.00', hl: 'en', gl: 'PK' })
      }
      for (const [, query] of cases) assert.ok(calls.some(call => call.body.query === query), query)
      assert.ok(calls.some(call => call.body.params === 'EgWKAQIIAWoKEAkQBRAKEAMQBA=='))
    })

    await check('radio uses RDAMVM and artist profiles return the full browse payload', async () => {
      const calls = []
      const base = await endpoint(createYtmusicHandler({
        fetchImpl: async (url, options) => {
          calls.push({ url: new URL(url), body: JSON.parse(options.body) })
          return Response.json(innertubeFixture(url))
        },
      }))
      const radio = await (await fetch(base + '/api/ytmusic?action=radio&videoId=VIDEO000001')).json()
      assert.equal(radio.songs.length, 1)
      assert.equal(radio.songs[0].videoId, 'VIDEO000003')
      assert.equal(calls[0].url.pathname, '/youtubei/v1/next')
      assert.equal(calls[0].body.playlistId, 'RDAMVMVIDEO000001')
      assert.equal(calls[0].body.isAudioOnly, true)

      const artist = await (await fetch(base + '/api/ytmusic?action=artist&browseId=UCaliSethi01')).json()
      assert.equal(artist.name, 'Ali Sethi')
      assert.equal(artist.bio, 'Pakistani singer and composer.')
      assert.equal(artist.subscribers, '2.1M subscribers')
      assert.equal(artist.songs.length, 1)
      assert.equal(calls[1].url.pathname, '/youtubei/v1/browse')
      assert.equal(calls[1].body.browseId, 'UCaliSethi01')
      const albumResponse=await fetch(base + '/api/ytmusic?action=album&browseId=MPREalbum01')
      assert.equal(albumResponse.status,200)
      const album=await albumResponse.json()
      assert.equal(album.browseId,'MPREalbum01')
      assert.ok(album.songs.length>0)
      assert.equal(calls[2].body.browseId,'MPREalbum01')
    })

    await check('invalid actions are rejected before fetch and failures stay honest', async () => {
      let calls = 0
      const base = await endpoint(createYtmusicHandler({ fetchImpl: async () => { calls++; return Response.json({}) } }))
      for (const path of [
        '/api/ytmusic?action=search',
        '/api/ytmusic?action=search&q=%20',
        '/api/ytmusic?action=radio&videoId=short',
        '/api/ytmusic?action=artist&browseId=..%2Fprivate',
        '/api/ytmusic?action=artist',
        '/api/ytmusic?action=album&browseId=..%2Fprivate',
        '/api/ytmusic?action=album',
        '/api/ytmusic?action=deezer',
      ]) assert.equal((await fetch(base + path)).status, 400, path)
      assert.equal((await fetch(base + '/api/ytmusic', { method: 'POST' })).status, 405)
      assert.equal((await fetch(base + '/api/ytmusic', { method: 'OPTIONS' })).status, 204)
      assert.equal(calls, 0)

      const timeout = await endpoint(createYtmusicHandler({ timeoutMs: 25, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) }))
      assert.equal((await fetch(timeout + '/api/ytmusic?action=search&q=test')).status, 504)

      const upstream = await endpoint(createYtmusicHandler({ fetchImpl: async () => new Response('<html>upstream secret</html>') }))
      const broken = await fetch(upstream + '/api/ytmusic?action=search&q=test')
      assert.equal(broken.status, 502)
      assert.deepEqual(await broken.json(), { error: 'YouTube Music provider unavailable' })

      const limited = await endpoint(createYtmusicHandler({ fetchImpl: async () => new Response('', { status: 429 }) }))
      assert.equal((await fetch(limited + '/api/ytmusic?action=search&q=test')).status, 429)
    })

    await check('serverless entrypoints import as Node handlers without initializing upstream clients', () => {
      for (const route of [mediaRoute, youtubeRoute, ytmusicRoute, saavnRoute]) assert.equal(typeof route.default, 'function')
      assert.equal(ytmusicRoute.default, saavnRoute.default)
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

    await check('HEAD reaches upstream as HEAD; artwork and YouTube audio are classified by content intent', async () => {
      const seen = []
      const base = await endpoint(createMediaHandler({ fetchImpl: async (url, options) => {
        seen.push(options)
        return new Response(options.method === 'HEAD' ? null : 'ok', { headers: { 'content-type': 'audio/mp4', 'content-length': options.method === 'HEAD' ? '5000000' : '2' } })
      } }))
      const head = await fetch(base + mediaPath(target), { method: 'HEAD' })
      assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), '5000000'); assert.equal(seen[0].method, 'HEAD')
      await (await fetch(base + mediaPath('https://rr1.googlevideo.com/videoplayback?id=1'))).text()
      assert.equal(seen[1].headers.range, 'bytes=0-1048575')
      await (await fetch(base + mediaPath('https://lh3.googleusercontent.com/cover=w544-h544-l90-rj'), { headers: { accept: 'image/webp,image/*' } })).text()
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

    await check('YouTube audio route accepts the existing path and rewritten query, validates IDs and returns the payload', async () => {
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

    await check('Vercel rewrites preserve API routes, serve SPA deep links and never expose legacy providers', () => {
      const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
      assert.equal(config.rewrites.find(route => route.source === '/api/ytmusic/:route*').destination, '/api/ytmusic?route=:route*')
      assert.equal(config.rewrites.find(route => route.source === '/api/saavn/:route*').destination, '/api/saavn?route=:route*')
      const youtube = config.rewrites.find(route => route.source === '/api/youtube/audio/:videoId')
      assert.equal(youtube.destination, '/api/youtube-audio?videoId=:videoId')
      assert.equal(config.rewrites.at(-1).source, '/((?!api/).*)')
      const spa = new RegExp('^' + config.rewrites.at(-1).source + '$')
      for (const path of ['/', '/rooms', '/library', '/room/ES-TEST', '/artist/atif-aslam', '/@hary']) {
        assert.equal(spa.test(path), true, path)
      }
      assert.equal(spa.test('/api/media'), false); assert.equal(spa.test('/api/unknown'), false)
      // Vercel resolves static files before rewrites, so the catch-all may name
      // /assets/*; API traffic must still never hit index.html.
      assert.equal(spa.test('/assets/app.js'), true)
      assert.equal(config.outputDirectory, 'dist')
      assert.equal(config.functions['api/media.js'].maxDuration, 30)
      assert.equal(config.functions['api/ytmusic.js'].maxDuration, 20)
      assert.equal(config.functions['api/saavn.js'].maxDuration, 20)
      assert.doesNotMatch(JSON.stringify(config), /piped|invidious|deezer|jiosaavn/i)
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      assert.ok(pkg.dependencies['youtubei.js']); assert.equal(pkg.devDependencies['youtubei.js'], undefined)
      for (const file of ['api/ytmusic.js', 'api/saavn.js', 'server/ytmusicHandler.js']) assert.ok(fs.existsSync(file), file)
      for (const file of ['server/jiosaavn.js', 'server/saavnHandler.js', 'src/core/omniMusicEngine.js', 'src/core/tasteEngine.js', 'src/core/songStem.js']) {
        assert.equal(fs.existsSync(file), false, `${file} must stay deleted`)
      }
    })

    console.log(`Application API verification: ${passed} checks passed (controlled upstream, no live-provider claims)`)
  } finally {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  }
})().catch(error => { console.error(error); process.exitCode = 1 })

