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
    await check('Saavn shared handler covers search, song lookup and the production rewrite without forwarding an arbitrary host', async () => {
      const { createSaavnHandler } = await import('./server/saavn.js')
      const route = await import('./api/saavn.js')
      assert.equal(typeof route.default, 'function')
      const requests = []
      const song = { id: 'song', title: 'Fixture Song', image: 'https://c.saavncdn.com/953/poster-150x150.jpg', more_info: { duration: '180', '320kbps': 'true', encrypted_media_url: 'ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDyzuqGTOuWwLCDJLDzxR2mfeGuSltMxpC8EVSLt0T06A18y5d+wSWdIRw7tS9a8Gtq', artistMap: { primary_artists: [{ name: 'Artist' }] } } }
      const base = await endpoint(createSaavnHandler({ fetchImpl: async (url, options) => {
        requests.push({ url: String(url), options })
        const parsed = new URL(url)
        if (parsed.hostname === 'www.jiosaavn.com') {
          return Response.json(parsed.searchParams.get('__call') === 'search.getResults' ? { results: [song] } : { song })
        }
        return Response.json({ data: { results: [] } })
      } }))
      for (const path of ['/api/saavn/api/search/songs?query=Atif%20Aslam&limit=30', '/api/saavn?route=api%2Fsearch%2Fsongs&query=Atif%20Aslam&limit=30']) {
        const response = await fetch(base + path)
        assert.equal(response.status, 200)
        assert.match(response.headers.get('content-type'), /application\/json/)
        assert.equal(response.headers.get('access-control-allow-origin'), '*')
        assert.equal((await response.json()).data.results[0].duration, 180)
      }
      const officialSearches = requests.filter(({ url }) => {
        const parsed = new URL(url)
        return parsed.origin === 'https://www.jiosaavn.com' && parsed.searchParams.get('__call') === 'search.getResults'
      })
      assert.ok(officialSearches.length >= 2)
      assert.equal(new URL(officialSearches[0].url).searchParams.get('q'), 'Atif Aslam')
      assert.equal(new URL(officialSearches[0].url).searchParams.get('n'), '40')
      await (await fetch(base + '/api/saavn/api/songs/abc_123')).json()
      const detail = requests.find(({ url }) => new URL(url).searchParams.get('__call') === 'song.getDetails')
      assert.equal(new URL(detail.url).searchParams.get('pids'), 'abc_123')
      for (const path of ['/api/saavn?route=https://evil.test', '/api/saavn/api/admin', '/api/saavn?route=../private']) assert.equal((await fetch(base + path)).status, 400)
      assert.equal((await fetch(base + '/api/saavn', { method: 'POST' })).status, 405)
      assert.equal((await fetch(base + '/api/saavn', { method: 'OPTIONS' })).status, 204)
      const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
      assert.equal(config.rewrites.find(item => item.source === '/api/saavn/:route*').destination, '/api/saavn?route=:route*')
    })
    await check('search fans out to JioSaavn, Deezer and YouTube in parallel and preserves streams and previews', async () => {
      const { createSaavnHandler } = await import('./server/saavn.js')
      const song = { id: 'jio-merged', title: 'Jio Night', image: 'https://c.saavncdn.com/953/poster-150x150.jpg', more_info: { duration: '200', '320kbps': 'true', encrypted_media_url: 'ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDyzuqGTOuWwLCDJLDzxR2mfeGuSltMxpC8EVSLt0T06A18y5d+wSWdIRw7tS9a8Gtq', artistMap: { primary_artists: [{ name: 'Jio Artist' }] } } }
      const seen = []
      const base = await endpoint(createSaavnHandler({ fetchImpl: async url => {
        const parsed = new URL(url)
        seen.push(parsed.hostname)
        if (parsed.hostname === 'www.jiosaavn.com') return Response.json({ results: [song] })
        if (parsed.hostname === 'api.deezer.com') {
          return Response.json({ data: [{ id: 77, title_short: 'Deezer Night', duration: 205, preview: 'https://cdns-preview.dzcdn.net/stream/preview.mp3', artist: { name: 'Deezer Artist' }, album: { title: 'Deezer Album', cover_big: 'https://e-cdns-images.dzcdn.net/cover.jpg' }, link: 'https://www.deezer.com/track/77', rank: 900 }] })
        }
        if (parsed.pathname === '/search') {
          return Response.json({ items: [{ url: '/watch?v=abc123def45', title: 'Piped Night', duration: 220, uploaderName: 'Piped Artist', thumbnail: 'https://i.ytimg.com/vi/abc123def45/hqdefault.jpg', views: 1200 }] })
        }
        return Response.json({ data: { results: [] } })
      } }))
      const response = await fetch(base + '/api/saavn/api/search/songs?query=night&limit=20')
      assert.equal(response.status, 200)
      const rows = (await response.json()).data.results
      const providers = new Set(rows.map(row => row.provider))
      assert.ok(providers.has('jiosaavn'))
      assert.ok(providers.has('deezer'))
      assert.ok(providers.has('youtube'))
      const deezer = rows.find(row => row.provider === 'deezer')
      assert.equal(deezer.duration, 205)
      assert.equal(deezer.previewUrl, 'https://cdns-preview.dzcdn.net/stream/preview.mp3')
      assert.equal(deezer.image[0].url, 'https://e-cdns-images.dzcdn.net/cover.jpg')
      const youtube = rows.find(row => row.provider === 'youtube')
      assert.equal(youtube.youtubeVideoId, 'abc123def45')
      assert.equal(youtube.duration, 220)
      assert.ok(seen.includes('api.deezer.com'))
      assert.match(response.headers.get('x-echosync-catalog'), /jiosaavn-direct/)
      assert.match(response.headers.get('x-echosync-catalog'), /deezer/)
      assert.match(response.headers.get('x-echosync-catalog'), /youtube/)
    })
    await check('official DES known vector, 320/160 URLs, artwork and fixed-origin mirror fallback', async () => {
      const { decryptMediaUrl, normalizeOfficialSong } = await import('./server/jiosaavn.js')
      const encrypted = 'ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDyzuqGTOuWwLCDJLDzxR2mfeGuSltMxpC8EVSLt0T06A18y5d+wSWdIRw7tS9a8Gtq'
      assert.equal(decryptMediaUrl(encrypted), 'https://aac.saavncdn.com/953/9b1581a4c5948df2b42e16132e02ed51_96.mp4')
      assert.throws(() => decryptMediaUrl('not valid'))
      const song = normalizeOfficialSong({ id: 'id', title: 'Song &amp; Soul', image: 'https://c.saavncdn.com/a-150x150.jpg', more_info: { encrypted_media_url: encrypted, '320kbps': 'true', duration: '200' } })
      assert.equal(song.name, 'Song & Soul'); assert.equal(song.duration, 200)
      assert.match(song.downloadUrl[0].url, /_320.mp4$/); assert.match(song.downloadUrl[1].url, /_160.mp4$/)
      assert.equal(song.image[0].url, 'https://c.saavncdn.com/a-500x500.jpg')
      const { createSaavnHandler } = await import('./server/saavn.js')
      const seen = []
      const base = await endpoint(createSaavnHandler({ fetchImpl: async url => {
        const parsed = new URL(url)
        seen.push(parsed.hostname)
        if (parsed.hostname === 'www.jiosaavn.com') return new Response('', { status: 503 })
        if (parsed.hostname.startsWith('saavn-api')) return Response.json({ data: { results: [song] } })
        return Response.json({ data: { results: [] } })
      } }))
      const response = await fetch(base + '/api/saavn/api/search/songs?query=test&limit=5')
      assert.equal(response.status, 200); assert.equal(response.headers.get('x-echosync-catalog'), 'mirror-fallback')
      assert.ok(seen.includes('www.jiosaavn.com'))
      assert.ok(seen.includes('saavn-api-zeta.vercel.app'))
      assert.equal((await response.json()).data.results[0].id, 'id')
    })
    await check('Saavn timeout, non-JSON failure and upstream JSON status are reported honestly', async () => {
      const { createSaavnHandler } = await import('./server/saavn.js')
      const timeout = await endpoint(createSaavnHandler({ timeoutMs: 25, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))) }))
      assert.equal((await fetch(timeout + '/api/saavn/api/search/songs?query=test')).status, 504)
      const invalid = await endpoint(createSaavnHandler({ fetchImpl: async () => new Response('<html>upstream secret</html>') }))
      assert.equal((await fetch(invalid + '/api/saavn/api/songs/test')).status, 502)
      const limited = await endpoint(createSaavnHandler({ fetchImpl: async () => Response.json({ error: 'Rate limited' }, { status: 429 }) }))
      assert.equal((await fetch(limited + '/api/saavn/api/songs/test')).status, 429)
    })
    await check('empty and malformed search responses fail over; all valid empty mirrors stay empty',async()=>{
      const {createSaavnHandler}=await import('./server/saavn.js')
      let calls=0
      const base=await endpoint(createSaavnHandler({fetchImpl:async()=>{calls++;return Response.json(calls===1?{results:[]}:calls===2?{error:'unavailable'}:{data:{results:[{id:'mirror',title:'Mirror Song',duration:180,downloadUrl:[{quality:'160kbps',url:'https://aac.saavncdn.com/mirror_160.mp4'}]}]}})}}))
      const result=await fetch(base+'/api/saavn/api/search/songs?query=empty');assert.equal(result.status,200);assert.equal((await result.json()).data.results[0].id,'mirror');assert.ok(calls>=6)
      const empty=await endpoint(createSaavnHandler({fetchImpl:async url=>Response.json(new URL(url).hostname==='www.jiosaavn.com'?{results:[]}:{data:{results:[]}})}))
      const response=await fetch(empty+'/api/saavn/api/search/songs?query=unmatched');assert.equal(response.status,200);assert.deepEqual((await response.json()).data.results,[])
    })
    await check('high recall preserves 50 valid unique provider songs, autocomplete and fuzzy title hits',async()=>{
      const {createSaavnHandler}=await import('./server/saavn.js');const calls=[]
      const base=await endpoint(createSaavnHandler({fetchImpl:async value=>{const url=new URL(value);calls.push(url);if(url.hostname==='www.jiosaavn.com'){const make=i=>({id:'j'+i,title:i===0?'Pasoori':'Catalog Song '+i,more_info:{duration:'180',artistMap:{primary_artists:[{name:'Ali Sethi'}]}}});return Response.json(url.searchParams.get('__call')==='autocomplete.get'?{songs:{data:[{id:'auto',title:'Pasoori Acoustic',more_info:{duration:'180'}}]}}:{results:Array.from({length:40},(_,i)=>make(i))})}if(url.hostname==='api.deezer.com')return Response.json({data:Array.from({length:30},(_,i)=>({id:1000+i,title:'Deezer Song '+i,duration:180,artist:{name:'Other'},album:{title:'Album'}}))});return Response.json([])}}))
      const payload=await(await fetch(base+'/api/saavn/api/search/songs?query=pasuri&limit=50')).json();assert.equal(payload.data.results.length,50);assert.equal(payload.data.results[0].name,'Pasoori');assert.equal(new Set(payload.data.results.map(t=>t.name)).size,50);assert.ok(payload.data.results.some(t=>t.id==='auto'));assert.ok(calls.some(u=>u.searchParams.get('__call')==='autocomplete.get'));assert.equal(calls.find(u=>u.hostname==='api.deezer.com').searchParams.get('limit'),'30')
    })
    await check('catalog-derived spelling expansion promotes original artists and never borrows a cover stream',async()=>{
      const {createSaavnHandler}=await import('./server/saavn.js');const searches=[]
      const encrypted='ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDyzuqGTOuWwLCDJLDzxR2mfeGuSltMxpC8EVSLt0T06A18y5d+wSWdIRw7tS9a8Gtq'
      const base=await endpoint(createSaavnHandler({fetchImpl:async value=>{const url=new URL(value);if(url.hostname==='www.jiosaavn.com')return Response.json({results:[{id:'cover',title:'Pasoori',play_count:'100',more_info:{duration:180,encrypted_media_url:encrypted,artistMap:{primary_artists:[{name:'Cover Artist'}]}}}]});if(url.hostname==='api.deezer.com'){searches.push(url.searchParams.get('q'));return Response.json({data:url.searchParams.get('q')==='pasoori'?[{id:123,title:'Pasoori',duration:230,rank:400000,artist:{name:'Ali Sethi'},preview:'https://cdns-preview.dzcdn.net/original.mp3'}]:[]})}return Response.json([])}}))
      const rows=(await(await fetch(base+'/api/saavn/api/search/songs?query=pasuri&limit=50')).json()).data.results
      assert.ok(searches.includes('pasuri'));assert.ok(searches.includes('pasoori'));assert.equal(rows[0].artists.primary[0].name,'Ali Sethi');assert.equal(rows[0].provider,'deezer');assert.equal(rows[0].downloadUrl,undefined,'Cover audio was attached to the original artist');assert.equal(rows[0].previewUrl,'https://cdns-preview.dzcdn.net/original.mp3')
    })
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
