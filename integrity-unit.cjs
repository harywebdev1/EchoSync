const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createServer } = require('node:http')
const read = path => fs.readFileSync(`${__dirname}/${path}`, 'utf8').replaceAll('\r\n', '\n')
const app = read('src/lib/appServices.js') + '\n' + read('src/hooks/usePlaybackEngine.js')
function section(source, start, end) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(from >= 0 && to > from, `Missing source section ${start}`)
  return source.slice(from, to)
}
let passed = 0
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`) }

// ---------------------------------------------------------------------------
// Frozen InnerTube fixtures. These mirror the WEB_REMIX shapes that
// music.youtube.com returns: musicCardShelfRenderer, flex columns with
// navigation runs, playlistPanelVideoRenderer radio rows and immersive headers.
// ---------------------------------------------------------------------------
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
const thumbnails = url => ({ musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url, width: 120, height: 120 }] } } })
const flex = text => ({ musicResponsiveListItemFlexColumnRenderer: { text } })
const runs = list => ({ runs: list })

function songRow({ videoId, title, artist, artistId, album = 'Album', albumId = 'MPREalbum01', year = '2023', length = '3:45', cover = 'https://lh3.googleusercontent.com/art=w120-h120-l90-rj' }) {
  return {
    playlistItemData: { videoId },
    flexColumns: [
      flex(runs([{ text: title }])),
      flex(runs([
        { text: 'Song' },
        { text: ' • ' },
        { text: artist, navigationEndpoint: artistEndpoint(artistId) },
        { text: ' • ' },
        { text: album, navigationEndpoint: albumEndpoint(albumId) },
        { text: ' • ' },
        { text: year },
        { text: ' • ' },
        { text: length },
      ])),
    ],
    thumbnail: thumbnails(cover),
  }
}

function artistRow({ name, browseId, subscribers = '1.2M subscribers', cover = 'https://lh3.googleusercontent.com/artist=w120-h120-l90-rj' }) {
  return {
    navigationEndpoint: artistEndpoint(browseId),
    flexColumns: [
      flex(runs([{ text: name }])),
      flex(runs([{ text: 'Artist' }, { text: ' • ' }, { text: subscribers }])),
    ],
    thumbnail: thumbnails(cover),
  }
}

function albumRow({ name, browseId, artist = 'Ali Sethi', artistId = 'UCaliSethi01', year = '2023' }) {
  return {
    navigationEndpoint: albumEndpoint(browseId),
    flexColumns: [
      flex(runs([{ text: name }])),
      flex(runs([
        { text: 'Album' },
        { text: ' • ' },
        { text: artist, navigationEndpoint: artistEndpoint(artistId) },
        { text: ' • ' },
        { text: year },
      ])),
    ],
    thumbnail: thumbnails('https://lh3.googleusercontent.com/album=w120-h120-l90-rj'),
  }
}

const searchPayload = {
  contents: [
    {
      musicCardShelfRenderer: {
        title: runs([{ text: 'Ali Sethi', navigationEndpoint: artistEndpoint('UCaliSethi01') }]),
        subtitle: runs([{ text: 'Artist' }, { text: ' • ' }, { text: '2M subscribers' }]),
        thumbnail: thumbnails('https://lh3.googleusercontent.com/card=w120-h120-l90-rj'),
        contents: [
          {
            musicResponsiveListItemRenderer: songRow({
              videoId: 'CARDVIDEO01', title: 'Pasoori', artist: 'Ali Sethi', artistId: 'UCaliSethi01',
            }),
          },
        ],
      },
    },
    {
      itemSectionRenderer: {
        contents: [
          {
            musicResponsiveListItemRenderer: songRow({
              videoId: 'SONGVIDEO02', title: 'Kesariya', artist: 'Arijit Singh',
              artistId: 'UCarijit001', album: 'Brahmastra', albumId: 'MPREbrahma1',
            }),
          },
          { musicResponsiveListItemRenderer: artistRow({ name: 'Ali Sethi', browseId: 'UCaliSethi01', subscribers: '2M subscribers' }) },
          { musicResponsiveListItemRenderer: albumRow({ name: 'Coke Studio Season 14', browseId: 'MPREcoke01' }) },
        ],
      },
    },
  ],
}

function radioEntry({ videoId, title, artist, artistId, album, albumId, year = '2023', length = '4:05' }) {
  return {
    videoId,
    title: runs([{ text: title }]),
    longBylineText: runs([
      { text: artist, navigationEndpoint: artistEndpoint(artistId) },
      { text: ' • ' },
      { text: album, navigationEndpoint: albumEndpoint(albumId) },
      { text: ' • ' },
      { text: year },
    ]),
    lengthText: runs([{ text: length }]),
    thumbnail: thumbnails('https://lh3.googleusercontent.com/radio=w120-h120-l90-rj'),
  }
}

const radioPayload = {
  contents: [
    {
      playlistPanelRenderer: {
        contents: [
          {
            playlistPanelVideoRenderer: radioEntry({
              videoId: 'SEEDVIDEO01', title: 'Pasoori', artist: 'Ali Sethi',
              artistId: 'UCaliSethi01', album: 'Coke Studio Season 14', albumId: 'MPREcoke01',
            }),
          },
          {
            playlistPanelVideoRenderer: radioEntry({
              videoId: 'NEXTVIDEO02', title: 'Paniyon Sa', artist: 'Atif Aslam',
              artistId: 'UCatifAslam1', album: 'Satyameva Jayate', albumId: 'MPREpaniyon', length: '4:05',
            }),
          },
        ],
      },
    },
  ],
}

function twoRowItem({ name, browseId, pageType, subtitle, cover = 'https://lh3.googleusercontent.com/row=w120-h120-l90-rj' }) {
  return {
    title: runs([{ text: name }]),
    subtitle: runs([{ text: subtitle }]),
    navigationEndpoint: {
      browseEndpoint: {
        browseId,
        browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType } },
      },
    },
    thumbnail: thumbnails(cover),
  }
}

const artistPayload = {
  header: {
    musicImmersiveHeaderRenderer: {
      title: runs([{ text: 'Ali Sethi' }]),
      description: runs([{ text: 'Ali Sethi is a Pakistani singer and composer.' }]),
      subscriptionButton: {
        subscribeButtonRenderer: { subscriberCountText: runs([{ text: '2.1M subscribers' }]) },
      },
      thumbnail: thumbnails('https://lh3.googleusercontent.com/banner=w1200-h1200-l90-rj'),
    },
  },
  contents: [
    {
      musicShelfRenderer: {
        title: runs([{ text: 'Top songs' }]),
        contents: [
          {
            musicResponsiveListItemRenderer: songRow({
              videoId: 'TOPSONG0001', title: 'Pasoori', artist: 'Ali Sethi', artistId: 'UCaliSethi01',
            }),
          },
        ],
      },
    },
    {
      musicCarouselShelfRenderer: {
        header: { musicCarouselShelfBasicHeaderRenderer: { title: runs([{ text: 'Albums' }]) } },
        contents: [
          {
            musicTwoRowItemRenderer: twoRowItem({
              name: 'Coke Studio Season 14', browseId: 'MPREcoke01',
              pageType: 'MUSIC_PAGE_TYPE_ALBUM', subtitle: 'Album • 2023',
            }),
          },
        ],
      },
    },
    {
      musicCarouselShelfRenderer: {
        header: { musicCarouselShelfBasicHeaderRenderer: { title: runs([{ text: 'Fans might also like' }]) } },
        contents: [
          {
            musicTwoRowItemRenderer: twoRowItem({
              name: 'Kaavish', browseId: 'UCkaavish01',
              pageType: 'MUSIC_PAGE_TYPE_ARTIST', subtitle: '800K subscribers',
            }),
          },
        ],
      },
    },
  ],
}

;(async () => {
  const servers = []
  async function endpoint(handler) {
    const server = createServer((req, res) => { Promise.resolve(handler(req, res)).catch(error => res.destroy(error)) })
    servers.push(server)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${server.address().port}`
  }

  try {
    const [lrc, room, storage, identity, profile] = await Promise.all([
      import('./src/core/lrcParser.js'), import('./src/core/roomSyncMath.js'),
      import('./src/core/storageAdapter.js'), import('./src/core/trackIdentity.js'),
      import('./src/core/listenerProfile.js'),
    ])
    const { parseSearch, parseRadio, parseArtist, createYtmusicHandler, mergeSearchResults } = await import('./server/ytmusicHandler.js')

    await check('canonical artwork resolves provider shapes without inventing thumbnail URLs', async () => {
      const { resolveTrackArtwork, trackArtworkSources } = await import('./src/lib/media.js')
      assert.equal(resolveTrackArtwork({ artwork: [{ url: 'https://cdn.test/500.jpg' }], cover: '//cdn.test/cover.jpg' }), 'https://cdn.test/500.jpg')
      assert.equal(resolveTrackArtwork({ artwork: 'javascript:bad', image: { url: 'http://cdn.test/a.jpg' } }), 'https://cdn.test/a.jpg')
      assert.deepEqual(trackArtworkSources({ cover: '/original.jpg', thumbnail: '/original.jpg', albumArt: '/album.jpg' }), ['/original.jpg', '/album.jpg'])
      assert.equal(resolveTrackArtwork({}), null)
    })

    await check('one canonical identity per song removes release noise and movie suffixes', () => {
      const stem = identity.getCanonicalSongStem
      assert.equal(stem({ title: 'Apna Bana Le (From "Bhediya")' }), stem({ title: '  Apna Bana Le ' }))
      assert.equal(stem({ title: 'Kesariya (Trending Version)' }), stem({ title: 'Kesariya' }))
      assert.equal(stem({ title: 'Pasoori - Slowed + Reverb' }), stem({ title: 'Pasoori' }))
      assert.equal(stem({ title: 'Tu Jhoom (Official Audio)' }), stem({ title: 'Tu Jhoom' }))
      assert.equal(stem({ title: 'Audio' }), 'audio')
      assert.equal(stem({ name: 'Arz Kiya Hai' }), 'arz kiya hai')
      assert.notEqual(stem({title:'Husn',artist:'Anuv Jain'}),stem({title:'Husn',artist:'Another Artist'}))
    })

    await check('live mood queries rotate and fresh metadata preserves user IDs without duplicate songs', async () => {
      const { moodQueries, mergeMoodCatalog, MOOD_QUERIES } = await import('./src/core/moodFeed.js')
      for (const mood of Object.keys(MOOD_QUERIES)) assert.notDeepEqual(moodQueries(mood, [], 0), moodQueries(mood, [], 1))
      assert.equal(moodQueries('all', ['Atif Aslam'], 0)[0], 'Atif Aslam hits')
      const local = [{ id: 'liked-id', title: 'Song', artist: 'Artist', streamUrl: 'expired' }]
      const fresh = [{ id: 'yt-provider', title: 'Song', artist: 'Artist', streamUrl: 'fresh', cover: '/real.jpg' }]
      const result = mergeMoodCatalog(fresh, local)
      assert.equal(result.length, 1)
      assert.equal(result[0].id, 'liked-id')
      assert.equal(result[0].streamUrl, 'fresh')
      assert.equal(local[0].streamUrl, 'expired')
    })

    await check('seed resolution dedupes work, releases promises and keeps the caller identity', async () => {
      const source = section(app, 'const resolutionPromises = new Map()', '// Every search hits YouTube Music exactly like music.youtube.com does.')
      const promises = new Map()
      let lookups = 0
      const scope = {
        resolutionPromises: promises,
        cachedResolvedStream: () => null,
        resolveFullTrack: async () => {
          lookups += 1
          return { streamUrl: `stream-${lookups}`, youtubeVideoId: 'dQw4w9WgXcQ', cover: 'cover.jpg' }
        },
      }
      const resolve = vm.runInNewContext(source + '\nresolveSeed', scope)
      const seed = { id: 'seed-id', title: 'Song', artist: 'Artist' }
      const first = await resolve(seed)
      assert.equal(first.streamUrl, 'stream-1')
      assert.equal(first.id, 'seed-id')
      assert.equal(promises.size, 0)
      const second = await resolve(seed)
      assert.equal(second.cover, 'cover.jpg')
      assert.equal(second.id, 'seed-id')
      scope.resolveFullTrack = async () => null
      await assert.rejects(() => resolve({ id: 'missing', title: 'Nope' }), error => error.code === 'UNRESOLVED')
      assert.equal(promises.size, 0)
    })

    await check('Home shelves keep the mood on top, drop previews and never repeat a stem', async () => {
      const tracks = Array.from({ length: 22 }, (_, i) => ({
        id: String(i), title: i === 9 ? 'Sufi acoustic' : `Song ${i}`,
        artist: i === 6 ? 'Atif Aslam' : 'Other', duration: 180,
      }))
      tracks.push({ ...tracks[0] }, { id: 'short', duration: 30 }, { id: 'preview', duration: 180, preview: true }, { id: 'unknown', title: 'Unknown Duration Song', duration: 0 })
      const options = { profile: { artists: { 'atif aslam': { name: 'Atif Aslam', weight: 9 } } }, mood: 'sufi' }
      const before = JSON.stringify([tracks, options])
      const ranked = profile.rankListenerTracks(tracks, options)
      assert.equal(ranked[0].id, '9')
      assert.ok(ranked.some(track => track.id === 'unknown'))
      assert.ok(!ranked.some(track => ['short', 'preview'].includes(track.id)))
      assert.equal(new Set(ranked.map(track => identity.getCanonicalSongStem(track))).size, ranked.length)
      assert.deepEqual(ranked, profile.rankListenerTracks(tracks, options))
      assert.equal(profile.rankListenerTracks(tracks, { profile: options.profile })[0].id, '6')
      assert.deepEqual(profile.rankListenerTracks([], {}), [])
      assert.equal(JSON.stringify([tracks, options]), before)

      const { allocateHomeShelves } = await import('./src/core/moodFeed.js')
      const pool = Array.from({ length: 30 }, (_, i) => ({ id: `pool-${i}`, title: `Song ${i}`, artist: 'Artist' }))
      const duplicate = { ...pool[0], id: 'duplicate', title: 'Song 0 (From "Album")' }
      const sections = allocateHomeShelves([...pool, duplicate], [duplicate, ...pool], pool)
      assert.equal(sections.quickPicks.length, 12)
      assert.equal(sections.familiar.length, 10)
      assert.equal(sections.fresh.length, 8)
      const all = [...sections.quickPicks, ...sections.familiar, ...sections.fresh]
      assert.equal(new Set(all.map(identity.getCanonicalSongStem)).size, 30)
    })

    await check('queue chips preserve original indexes, deterministic order, current track and source queue', async () => {
      const { filterUpcomingQueue } = await import('./src/core/queueFilters.js')
      const queue = [
        { id: 'current', artist: 'A' }, { id: 'liked', artist: 'B' }, { id: 'recent', artist: 'C' },
        { id: 'affinity', artist: 'Loved Artist' }, { id: 'fresh', artist: 'New Artist' },
        { id: 'deep', title: 'Acoustic Sufi', duration: 180 }, { id: 'long', duration: 360 },
      ]
      const before = JSON.stringify(queue)
      const context = { liked: ['liked'], recent: ['recent'], tasteProfile: { artists: { 'loved artist': { weight: 9 } } } }
      const ids = mode => filterUpcomingQueue(queue, 0, mode, context).map(entry => entry.item.id)
      assert.deepEqual(ids('All'), ['liked', 'recent', 'affinity', 'fresh', 'deep', 'long'])
      assert.deepEqual(ids('Familiar'), ['liked', 'recent', 'affinity'])
      assert.deepEqual(ids('Discover'), ['affinity', 'fresh', 'deep', 'long'])
      assert.deepEqual(ids('Deep Cuts'), ['deep', 'long'])
      assert.deepEqual(filterUpcomingQueue(queue, 0, 'Deep Cuts', context).map(entry => entry.index), [5, 6])
      assert.equal(queue[0].id, 'current')
      assert.equal(JSON.stringify(queue), before)
      assert.deepEqual(filterUpcomingQueue([], 0, 'All'), [])
    })

    await check('sleep timer deadlines, modes, cancellation and end-of-track policy are exact', async () => {
      const { createSleepTimer, sleepRemaining, sleepExpired } = await import('./src/core/sleepTimer.js')
      for (const [mode, minutes] of [['15m', 15], ['30m', 30]]) {
        const timer = createSleepTimer(mode, 1000)
        assert.equal(sleepRemaining(timer, 1000), minutes * 60_000)
        assert.equal(sleepRemaining(timer, 2000), minutes * 60_000 - 1000)
        assert.equal(sleepExpired(timer, timer.deadline - 1), false)
        assert.equal(sleepExpired(timer, timer.deadline), true)
        assert.equal(sleepRemaining(timer, timer.deadline + 1), 0)
      }
      assert.equal(createSleepTimer('end-of-track').endOfTrack, true)
      assert.equal(sleepExpired(createSleepTimer('end-of-track'), Infinity), false)
      assert.equal(createSleepTimer('invalid').mode, 'off')
      assert.equal(createSleepTimer('off').deadline, null)
    })

    await check('direct audio resolves through the same-origin route, caches per video id and dedupes inflight work', async () => {
      const requests = []
      const cache = new Map()
      const scope = vm.createContext({
        encodeURIComponent,
        safeText: (value, fallback = '') => (typeof value === 'string' ? value.trim() || fallback : fallback),
        mediaProxyUrl: url => url && !url.startsWith('/api/') ? `/api/media?url=${encodeURIComponent(url)}` : url,
        safeMediaUrl: url => url || null,
        cachedResolvedStream: key => cache.get(key) || null,
        cacheResolvedStream: (key, value) => cache.set(key, value),
        fetchJson: async url => {
          requests.push(url)
          return { url: 'https://r1.googlevideo.com/stream', duration: 180, bitrate: 128000, thumbnail: 'https://i.ytimg.com/vi/x/hqdefault.jpg' }
        },
      })
      vm.runInContext(section(app, 'const youtubeAudioInflight', '// Synchronous read used by the optimistic player'), scope)
      assert.equal(await scope.getYouTubeAudio('bad'), null)
      assert.equal(requests.length, 0)
      const [first, second] = await Promise.all([
        scope.getYouTubeAudio('dQw4w9WgXcQ'),
        scope.getYouTubeAudio('dQw4w9WgXcQ'),
      ])
      assert.equal(requests.length, 1)
      assert.equal(requests[0], '/api/youtube-audio?videoId=dQw4w9WgXcQ')
      assert.equal(first.streamUrl, `/api/media?url=${encodeURIComponent('https://r1.googlevideo.com/stream')}`)
      assert.equal(first.duration, 180)
      assert.equal(first.quality, '128 kbps')
      assert.equal(first.providerLabel, 'YouTube Music')
      assert.deepEqual(first, second)
      const cached = await scope.getYouTubeAudio('dQw4w9WgXcQ')
      assert.deepEqual(cached, first)
      assert.equal(requests.length, 1)
    })

    await check('YouTube candidate ranking prefers the credited original and rejects karaoke, shorts and covers of other songs', () => {
      const scope = vm.createContext({
        normalize: value => String(value || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(),
        HARD_BAD_MATCH: /\b(karaoke|instrumental|tribute|8-bit|ringtone)\b/i,
        SOFT_BAD_MATCH: /\b(remix|slowed|reverb|lofi|lo-fi|nightcore)\b/i,
        Map,
      })
      vm.runInContext(section(app, 'function titleOverlap(', 'async function resolveVideoId(') + '\nthis.rank = rankYtCandidates', scope)
      const seed = { title: 'Pasoori', artist: 'Ali Sethi', duration: 225 }
      const ranked = scope.rank([
        { id: 'cover', title: 'Pasoori', artist: 'Cover Singer', duration: 225 },
        { id: 'official', title: 'Pasoori', artist: 'Ali Sethi', duration: 225 },
        { id: 'karaoke', title: 'Pasoori (Karaoke)', artist: 'Ali Sethi', duration: 225 },
        { id: 'remix', title: 'Pasoori (Remix)', artist: 'Ali Sethi', duration: 225 },
        { id: 'wrong', title: 'Kesariya', artist: 'Arijit Singh', duration: 268 },
        { id: 'short', title: 'Pasoori', artist: 'Ali Sethi', duration: 30 },
      ], seed)
      assert.equal(ranked[0].track.id, 'official')
      assert.deepEqual(ranked.map(entry => entry.track.id), ['official', 'remix', 'cover'])
      assert.ok(ranked.every(entry => entry.score >= 40))
      assert.deepEqual(scope.rank([], seed), [])
    })

    await check('preview cache cleanup retains saved song identity and metadata for full-stream hydration',()=>{
      const library={saved:{savedAt:Date.now(),track:{id:'saved',title:'My saved song',artist:'Artist',duration:30,fullDuration:30,quality:'30s',preview:true,streamUrl:'https://example.test/preview/a.m4a'}}}
      const scope=vm.createContext({streamCache:{searches:{},streams:{}},LIBRARY_CACHE_KEY:'library',readStorage:()=>library,writeStorage(){},persistStreamCache(){}})
      vm.runInContext(section(app,'function isPreviewTrack(', 'function notifyStorageFailure('),scope)
      vm.runInContext(section(app,'function purgePreviewCaches(', 'function cachedSearchEntry('),scope)
      assert.equal(library.saved.track.id,'saved');assert.equal(library.saved.track.title,'My saved song')
      assert.equal(library.saved.track.streamUrl,null);assert.equal(library.saved.track.duration,0)
      assert.equal(scope.isPreviewTrack(library.saved.track),false)
    })

    await check('catalog retains unknown durations, rejects known short tracks and previews', () => {
      const scope = vm.createContext({})
      vm.runInContext(section(app, 'function isPreviewTrack(', 'function notifyStorageFailure(') + section(app, 'function isFullLengthTrack(', 'async function resolveFullTrack('), scope)
      for (const duration of [1, 30, 45, 59.99]) assert.equal(scope.isFullLengthTrack({ duration }), false)
      for (const duration of [0, undefined, 60, 180]) assert.equal(scope.isFullLengthTrack({ duration }), true)
      assert.equal(scope.isFullLengthTrack({ duration: 180, preview: true }), false)
    })

    await check('native playback rejects short media, waits for metadata, and permits verified 60s streams', async () => {
      let plays=0, notices=0
      const scope=vm.createContext({setTimeout,clearTimeout,sleepPausedRef:{current:false},playAttemptIdRef:{current:1},setIsPlaying(){},showToast(){notices++}})
      vm.runInContext(section(app, '  async function safeAudioPlay(', '  function clearAdvanceCheck('), scope)
      const audio=new EventTarget()
      Object.assign(audio,{readyState:1,duration:30,getAttribute:()=> 'fixture',pause(){},play:async()=>plays++})
      assert.equal(await scope.safeAudioPlay(audio,1),false)
      assert.equal(plays,0);assert.equal(notices,1)
      audio.duration=60
      assert.equal(await scope.safeAudioPlay(audio,1),true)
      audio.readyState=0
      const pending=scope.safeAudioPlay(audio,1)
      assert.equal(plays,1)
      audio.readyState=1;audio.dispatchEvent(new Event('loadedmetadata'))
      assert.equal(await pending,true);assert.equal(plays,2)
      assert.equal(await scope.safeAudioPlay(audio,2),false)
    })

    await check('Lounge expiry includes the 24h boundary, drops old voice/text and rejects invalid timestamps',async()=>{
      const {isFreshLoungeMessage}=await import('./src/core/loungeExpiry.js')
      const now=Date.now()
      assert.equal(isFreshLoungeMessage({createdAt:now-86400000},now),true)
      assert.equal(isFreshLoungeMessage({createdAt:now-86400001,type:'voice'},now),false)
      assert.equal(isFreshLoungeMessage({created_at:new Date(now).toISOString()},now),true)
      assert.equal(isFreshLoungeMessage({},now),false)
    })
    await check('RTT 100→160→120 gives jitter 0→60→40; drift remains 0/140/1800/4200', async () => {
      let now = 0, latency = 100, snapshot = {}
      const probes = []
      const scope = vm.createContext({ window: {}, document: { visibilityState: 'visible' }, navigator: {}, performance: { now: () => now }, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => { probes.push({ url, method: options.method }); now += latency; return { ok: true } }, setLiveTelemetry: patch => { snapshot = { ...snapshot, ...patch } }, liveTelemetryStore: { get: () => snapshot } })
      vm.runInContext(read('src/services/networkMonitor.js').replace(/^import .*\n/gm, '').replaceAll('export ', ''), scope)
      for (const [rtt, jitter] of [[100, 0], [160, 60], [120, 40]]) { latency = rtt; await scope.pingProxy(); assert.equal(snapshot.jitterMs, jitter) }
      assert.equal(probes.length, 3)
      for (const probe of probes) { assert.match(probe.url, /^\/api\/media\?_ping=/); assert.equal(probe.method, 'OPTIONS') }
      for (const drift of [0, 140, 1800, 4200]) { scope.recordRoomDrift(drift / 1000); assert.equal(snapshot.roomDriftMs, drift) }
      for (const [ms, tone] of [[0, 'good'], [299, 'good'], [300, 'fair'], [1000, 'fair'], [1001, 'poor'], [4200, 'poor']]) assert.equal(room.getDriftTone(ms), tone)
    })

    await check('quota retry preserves all user data, returns failure, and calls the injected notifier', () => {
      let calls = 0, permanent = false
      const failures = []
      const backend = {
        'echosync.likes.v1': 'keep', echosync_playlists_v1: 'keep', echosync_rooms_v3: 'keep',
        echosync_messages_v3: 'voice-data', echosync_public_lounge_v1: 'voice-data',
        'echosync_translate.v1': 'keep-preference', 'echosync.library.v1': 'keep-library',
        echosync_stream_cache_v4: 'discard', 'echosync.lyrics.v1': 'discard',
        echosync_lyrics_trans_cache: 'discard', echosync_daily_feed_v3_old: 'discard',
      }
      Object.defineProperties(backend, {
        setItem: { value(key, value) { calls++; if (permanent || calls === 1) throw new Error('QuotaExceededError'); this[key] = value } },
        getItem: { value(key) { return this[key] || null } },
        removeItem: { value(key) { delete this[key] } },
      })
      const adapter = storage.createStorageAdapter({ getStorage: () => backend, onWriteFailure: failure => failures.push(failure) })
      assert.equal(adapter.write('echosync.likes.v1', ['new']), true)
      assert.equal(calls, 2)
      for (const key of ['echosync_stream_cache_v4', 'echosync.lyrics.v1', 'echosync_lyrics_trans_cache', 'echosync_daily_feed_v3_old']) assert.equal(backend[key], undefined)
      for (const key of ['echosync_playlists_v1', 'echosync_rooms_v3', 'echosync_messages_v3', 'echosync_public_lounge_v1', 'echosync_translate.v1', 'echosync.library.v1']) assert.ok(backend[key])
      assert.deepEqual(adapter.read('echosync.likes.v1', []), ['new'])
      assert.equal(adapter.read('echosync_messages_v3', 'fallback'), 'fallback')
      permanent = true
      const previous = backend['echosync.likes.v1']
      assert.equal(adapter.write('echosync.likes.v1', ['unsaved']), false)
      assert.equal(calls, 4)
      assert.equal(backend['echosync.likes.v1'], previous)
      assert.equal(failures.length, 1)
      assert.equal(failures[0].attempts, 2)
      assert.equal(failures[0].key, 'echosync.likes.v1')
      assert.match(failures[0].error.message, /Quota/)
    })

    for (const file of ['src/components/social/ChatDrawer.jsx', 'src/components/social/PublicLoungeDrawer.jsx']) {
      await check(`${file}: denied mic, recorder error and empty blob send nothing; retry can record`, async () => {
        let sends = 0, hint = '', allow = false, usable = false, currentRecorder, stopped = 0
        class Recorder {
          static isTypeSupported() { return true }
          constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; currentRecorder = this }
          start() { this.state = 'recording' }
          stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['valid fixture bytes']) }); this.onstop?.() }
        }
        const scope = { setInterval: () => 1, clearInterval() {}, setTimeout: fn => { queueMicrotask(fn); return 1 }, Blob, MediaRecorder: Recorder,
          navigator: { mediaDevices: { getUserMedia: async () => { if (!allow) throw new Error('NotAllowedError'); return { getTracks: () => [{ stop: () => stopped++ }] } } } },
          currentUser: { id: 'test' }, room: { id: 'room' }, recording: false,
          setRecording() {}, setRecordSeconds() {}, setRecordHint: value => { hint = value }, setVoicePlayingId() {}, onSendVoice: () => sends++,
          isUsableVoiceBlob: async () => usable, blobToDataUrl: async () => 'data:audio/webm;base64,fixture', makeVoiceWaveform: () => [],
        }
        for (const name of ['recordAttemptRef', 'recordTimerRef', 'recorderRef', 'recordStreamRef', 'recordChunksRef', 'recordStartedAtRef', 'finishingRef', 'recordCancelledRef', 'recordFailedRef']) scope[name] = { current: name === 'recordChunksRef' ? [] : null }
        vm.createContext(scope)
        vm.runInContext(section(read(file), '  const stopRecordingHardware =', '  const handleDraftChange =') + '\nthis.start = startRecording; this.finish = finishRecording;', scope)
        await scope.start()
        assert.match(hint, /not sent/)
        assert.equal(sends, 0)
        allow = true
        await scope.start()
        currentRecorder.onerror()
        assert.match(hint, /not sent/)
        assert.equal(sends, 0)
        await scope.start()
        await scope.finish()
        assert.match(hint, /not sent/)
        assert.equal(sends, 0)
        usable = true
        await scope.start()
        await scope.finish()
        assert.equal(sends, 1)
        assert.ok(stopped >= 3)
      })
    }

    await check('LRC timestamps, transliteration and binary line matching preserve Web semantics', () => {
      const lines = lrc.parseLrc('[ar:Artist]\n[00:10.2][01:00:050] नमस्ते\n[00:00.001] Intro\n[00:20] [tag] End\n[00:30]')
      assert.deepEqual(lines.map(line => line.time), [0.001, 10.2, 20, 60.05])
      assert.deepEqual(lines.map(line => line.text), ['Intro', 'नमस्ते', 'End', 'नमस्ते'])
      assert.equal(lrc.transliterateDevanagari('नमस्ते दुनिया'), 'namaste duniya')
      assert.equal(lrc.hasDevanagari('namaste'), false)
      assert.equal(lrc.detectLyricsLanguage('سلام'), 'ur')
      const duplicates = [{ time: 10 }, { time: 20 }, { time: 20 }, { time: 30 }]
      assert.equal(lrc.findActiveLyricLine([], 0), -1)
      assert.equal(lrc.findActiveLyricLine(duplicates, 0), 0)
      assert.equal(lrc.findActiveLyricLine(duplicates, 19.88), 2)
      assert.equal(lrc.findActiveLyricLine(duplicates, 19.87), 0)
      assert.equal(lrc.findActiveLyricLine(duplicates, 100), 3)
      let reads = 0
      const many = new Proxy(Array.from({ length: 8192 }, (_, time) => ({ time })), { get(target, key) { if (/^\d+$/.test(String(key))) reads++; return target[key] } })
      assert.equal(lrc.findActiveLyricLine(many, 4000), 4000)
      assert.ok(reads <= 14, 'line matching must remain logarithmic')
    })

    await check('room wall clock, drift units and inclusive 1000ms boundary', () => {
      const clock = { roomId: 'room', time: 10, updatedAt: 1000, isPlaying: true }
      assert.equal(room.getLiveRoomPosition(clock, 2500), 11.5)
      assert.equal(room.getLiveRoomPosition({ ...clock, isPlaying: false }, 2500), 10)
      assert.equal(room.getLiveRoomPosition(clock, 500), 10)
      assert.equal(room.getLiveRoomPosition({ ...clock, updatedAt: 0 }, 2500), 10)
      assert.equal(room.getLiveRoomPosition(null, 2500), 0)
      assert.deepEqual(room.computeMemberDrift(10, 14.2), { seconds: Math.abs(10 - 14.2), milliseconds: 4200 })
      assert.deepEqual(room.computeMemberDrift(10, 10), { seconds: 0, milliseconds: 0 })
      for (const [ms, color] of [[0, 'green'], [299.99, 'green'], [300, 'amber'], [1000, 'amber'], [1000.01, 'red']]) assert.equal(room.classifyDrift(ms), color)
    })

    await check('listener signals keep weighted artist/vibe/language learning, search deduplication and input immutability', () => {
      const empty = profile.emptyTasteProfile()
      const original = JSON.stringify(empty)
      const track = { id: 'song', title: 'Romantic song', artist: 'Arijit Singh', language: 'Hindi' }
      let next = profile.applyTasteSignal(empty, 'play', { track }, () => 1234)
      assert.equal(JSON.stringify(empty), original)
      assert.equal(next.artists['arijit singh'].weight, 3)
      assert.equal(next.vibeWeights.romantic.weight, 2)
      assert.equal(next.languageWeights.hindi.weight, 1)
      assert.equal(next.genres.romance.weight, 2)
      assert.equal(next.updatedAt, 1234)
      assert.equal(next.events, 1)
      next = profile.applyTasteSignal(next, 'like', { track }, () => 1235)
      assert.equal(next.artists['arijit singh'].weight, 9)
      assert.equal(next.vibeWeights.romantic.weight, 6)
      assert.equal(next.languageWeights.hindi.weight, 2)
      next = profile.applyTasteSignal(next, 'search', { query: '  ARIJIT ' }, () => 1236)
      next = profile.applyTasteSignal(next, 'search', { query: 'arijit' }, () => 1237)
      assert.deepEqual(next.searches, [{ query: 'arijit', at: 1237 }])
      assert.equal(next.keywords.arijit.weight, 6)
      assert.deepEqual(profile.extractTopVibeTags(next), ['Romance'])
      const skipped = profile.applyTasteSignal(next, 'skip', { track }, () => 1239)
      assert.equal(skipped.artists['arijit singh'].weight, 7)
      assert.equal(skipped.vibeWeights.romantic.weight, 4)
      assert.equal(profile.normalizeTasteProfile({ events: -2 }).events, 0)
      const capped = profile.normalizeTasteProfile({ artists: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i), i + 1])) })
      assert.equal(capped.artists['39'].weight, 40)
      assert.equal(Object.keys(capped.artists).length, 30)
    })

    await check('taste compatibility is symmetric, bounded, volume-invariant and safe for empty profiles', () => {
      const a = { artists: { alpha: 3, beta: 1 }, genres: { indie: 1 } }
      const b = { artists: { alpha: 30, beta: 10 }, genres: { indie: 100 } }
      const partial = { artists: { alpha: 1 } }
      const snapshot = JSON.stringify([a, b, partial])
      assert.equal(profile.computeTasteMatchPercentage({}, {}), 0)
      assert.equal(profile.computeTasteMatchPercentage({ artists: { ' ': 1 } }, { artists: { ' ': 2 } }), 0)
      assert.equal(profile.computeTasteMatchPercentage(a, a), 99)
      assert.equal(profile.computeTasteMatchPercentage(a, b), 99)
      assert.equal(profile.computeTasteMatchPercentage({ artists: { a: 1 } }, { artists: { b: 1 } }), 0)
      assert.equal(profile.computeTasteMatchPercentage(a, partial), profile.computeTasteMatchPercentage(partial, a))
      assert.ok(profile.computeTasteMatchPercentage(a, partial) > 0 && profile.computeTasteMatchPercentage(a, partial) < 99)
      for (const value of [null, {}, { artists: { invalid: Infinity } }, { artists: { artist: -3 } }, a, b, partial]) {
        const score = profile.computeTasteMatchPercentage(a, value)
        assert.ok(Number.isInteger(score) && score >= 0 && score <= 99)
      }
      assert.equal(JSON.stringify([a, b, partial]), snapshot)
    })

    await check('Home stems remove From suffixes and partial mood success survives failed queries', async () => {
      const { songStem, collectMoodResults, mergeMoodCatalog } = await import('./src/core/moodFeed.js')
      const first = { id: 'a', title: 'Apna Bana Le (From "Bhediya")', artist: 'Arijit Singh, Sachin', duration: 180 }
      const duplicate = { ...first, id: 'b', title: '  Apna Bana Le ', artist: 'Arijit Singh' }
      assert.equal(songStem(first), songStem(duplicate))
      const result = collectMoodResults([{ status: 'rejected', reason: new Error('429') }, { status: 'fulfilled', value: [first, duplicate] }])
      assert.equal(result.length, 1)
      assert.equal(mergeMoodCatalog([duplicate], [first]).length, 1)
      assert.deepEqual(collectMoodResults([{ status: 'rejected' }]), [])
    })

    await check('room votes pin the playing prefix, restore original ties and converge out of order', async () => {
      const { mergeVote, rankRoomQueue, voteCount } = await import('./src/core/roomVotes.js')
      const ids = ['past', 'playing', 'first', 'second', 'third']
      let votes = mergeVote({}, 'third', 'alice', { active: true, ts: 10, op: 'a' })
      assert.deepEqual(rankRoomQueue(ids, 1, votes, ids), ['past', 'playing', 'third', 'first', 'second'])
      votes = mergeVote(votes, 'third', 'bob', { active: true, ts: 11, op: 'b' })
      assert.equal(voteCount(votes.third), 2)
      votes = mergeVote(votes, 'third', 'alice', { active: false, ts: 12, op: 'c' })
      const before = JSON.stringify(votes)
      assert.equal(mergeVote(votes, 'third', 'alice', { active: true, ts: 9, op: 'old' }), votes)
      assert.equal(JSON.stringify(votes), before)
      votes = mergeVote(votes, 'third', 'bob', { active: false, ts: 13, op: 'd' })
      assert.deepEqual(rankRoomQueue(['past', 'playing', 'third', 'first', 'second'], 1, votes, ids), ids)
    })

    await check('phonetic and partial search ranks intended songs without hiding the provider tail', async () => {
      const { rankBySearchSimilarity, phoneticNormalize } = await import('./src/core/searchRanking.js')
      const cases = [['pasuri', 'Pasoori', 'Ali Sethi'], ['kesria', 'Kesariya', 'Arijit Singh'], ['apna bna', 'Apna Bana Le', 'Arijit Singh'], ['tu jhum', 'Tu Jhoom', 'Abida Parveen'], ['arz kia', 'Arz Kiya', 'Anuv Jain'], ['atif', 'Tera Hone Laga Hoon', 'Atif Aslam'], ['anuv', 'Baarishein', 'Anuv Jain']]
      for (const [query, title, artist] of cases) {
        const rows = [{ id: 'tail', title: query === 'tu jhum' ? 'Tu Jhumata Huva Saawan' : 'Unrelated provider song', artist: query === 'kesria' ? 'Kesria' : 'Different Singer' }, { id: 'hit', title, artist }]
        const before = JSON.stringify(rows)
        const result = rankBySearchSimilarity(rows, query)
        assert.equal(result[0].id, 'hit', query)
        assert.equal(result.length, 2)
        assert.equal(JSON.stringify(rows), before)
      }
      assert.equal(rankBySearchSimilarity([{ id: 'variant', title: 'Pasoori (Reprise)' }, { id: 'original', title: 'Pasoori' }], 'pasuri')[0].id, 'original')
      const versions = [{ id: 'cover', title: 'Arz Kiya Hai', artist: 'Cover Artist', playCount: 100 }, { id: 'original', title: 'Arz Kiya Hai | Coke Studio Bharat', artist: 'Anuv Jain', playCount: 28000000 }]
      assert.equal(rankBySearchSimilarity(versions, 'arz kia')[0].id, 'original')
      assert.equal(phoneticNormalize('aa ee oo ph kh gh z sh q w'), 'a i u f k g j s k v')
    })

    await check('listener learning caps momentum and never invents its own artist radio', () => {
      let next = profile.applyTasteSignal(null, 'play', { track: { id: 'collab', title: 'Sufi Soul', artist: 'Atif Aslam & Arijit Singh', language: 'Hindi' } })
      assert.ok(next.artistWeights['atif aslam'].weight > 0)
      assert.ok(Object.keys(next.vibeWeights).length)
      assert.ok(next.languageWeights.hindi.weight > 0)
      assert.ok(next.coArtistGraph['atif aslam']['arijit singh'].weight > 0)
      for (let i = 0; i < 4; i += 1) next = profile.applyTasteSignal(next, 'play', { track: { id: `p${i}`, title: `Acoustic ${i}`, artist: 'Anuv Jain', language: 'Hindi' } })
      assert.deepEqual(next.sessionMomentum.map(track => track.id), ['p3', 'p2', 'p1'])
      const english = profile.applyTasteSignal(null, 'like', { track: { id: 'pop', title: 'Pop', artist: 'Artist', language: 'english' } })
      assert.equal(english.languageWeights.english.name, 'English')
      assert.ok(profile.tasteVibesForTrack({ language: 'english' }).includes('Global Pop'))
      assert.equal(typeof profile.rankListenerTracks, 'function')
      assert.equal(profile.buildArtistRadio, undefined, 'the old client-side recommender must be gone')
    })

    await check('dynamic recommendations query top three artists and session vibe while retaining partial successes', async () => {
      const { refreshDynamicTasteCatalog } = await import('./src/hooks/useDynamicTasteCatalog.js')
      const queries = []
      const testProfile = { artistWeights: { a: { name: 'Atif Aslam', weight: 9 }, b: { name: 'Anuv Jain', weight: 8 }, c: { name: 'Arijit Singh', weight: 7 }, d: { name: 'Ignored Fourth', weight: 6 } }, sessionMomentum: [{ id: 'last', title: 'Sufi Soul', artist: 'Atif Aslam' }] }
      const rows = await refreshDynamicTasteCatalog(testProfile, {
        search: async (query, limit) => {
          queries.push(query)
          assert.equal(limit, 40)
          if (query.startsWith('Anuv')) throw Error('upstream offline')
          return [{ id: query, title: query, artist: query, duration: 180 }]
        },
      })
      assert.ok(queries.includes('Atif Aslam songs'))
      assert.ok(queries.includes('Arijit Singh songs'))
      assert.ok(queries.includes('Sufi & Soul songs'))
      assert.ok(!queries.some(query => query.includes('Fourth')))
      assert.equal(rows.length, 3)
    })

    await check('InnerTube search parses artist cards, songs, artist browse ids and HD artwork', () => {
      const result = parseSearch(searchPayload, 50)
      assert.equal(result.songs.length, 2)
      assert.equal(result.songs[0].videoId, 'CARDVIDEO01')
      assert.equal(result.songs[0].artist, 'Ali Sethi')
      const song = result.songs[1]
      assert.equal(song.id, 'yt-SONGVIDEO02')
      assert.equal(song.videoId, 'SONGVIDEO02')
      assert.equal(song.provider, 'youtube')
      assert.equal(song.title, 'Kesariya')
      assert.deepEqual(song.artists, [{ name: 'Arijit Singh', browseId: 'UCarijit001' }])
      assert.equal(song.album.name, 'Brahmastra')
      assert.equal(song.album.browseId, 'MPREbrahma1')
      assert.equal(song.duration, 225)
      assert.equal(song.year, '2023')
      assert.equal(song.cover, 'https://lh3.googleusercontent.com/art=w544-h544-l90-rj')
      assert.equal(song.streamUrl, null)
      assert.equal(song.needsHydration, true)
      assert.equal(result.artists.length, 1)
      assert.deepEqual(result.artists[0], {
        name: 'Ali Sethi',
        browseId: 'UCaliSethi01',
        subscribers: '2M subscribers',
        avatar: 'https://lh3.googleusercontent.com/card=w544-h544-l90-rj',
      })
      assert.equal(result.albums[0].name, 'Coke Studio Season 14')
      assert.equal(result.albums[0].browseId, 'MPREcoke01')
      assert.equal(result.albums[0].type, 'Album')
    })

    await check('artist search cards fill missing singer metadata and never read a duration as an artist', () => {
      const bare = {
        playlistItemData: { videoId: 'CARDTOP0001' },
        flexColumns: [
          flex(runs([{ text: 'Tere Liye' }])),
          flex(runs([{ text: 'Song' }, { text: ' • ' }, { text: '4:40' }])),
          flex(runs([{ text: '907M plays' }])),
        ],
        thumbnail: thumbnails('https://lh3.googleusercontent.com/cardtop=w120-h120-l90-rj'),
      }
      const artistCard = {
        musicCardShelfRenderer: {
          title: runs([{ text: 'Atif Aslam', navigationEndpoint: artistEndpoint('UCatifAslam1') }]),
          subtitle: runs([{ text: 'Artist' }, { text: ' • ' }, { text: '340M monthly audience' }]),
          thumbnail: thumbnails('https://lh3.googleusercontent.com/atif=w120-h120-l90-rj'),
          onTap: artistEndpoint('UCatifAslam1'),
          contents: [{ musicResponsiveListItemRenderer: bare }],
        },
      }
      const result = parseSearch({ contents: [artistCard] }, 10)
      assert.equal(result.songs.length, 1)
      const song = result.songs[0]
      assert.equal(song.videoId, 'CARDTOP0001')
      assert.equal(song.artist, 'Atif Aslam')
      assert.deepEqual(song.artists, [{ name: 'Atif Aslam', browseId: 'UCatifAslam1' }])
      assert.equal(song.duration, 280)
      assert.equal(song.album.name, 'Single')
      assert.equal(result.artists[0].browseId, 'UCatifAslam1')

      const coverRow = {
        playlistItemData: { videoId: 'COVERVID001' },
        flexColumns: [
          flex(runs([{ text: 'Pasoori (Cover)' }])),
          flex(runs([{ text: 'Real Uniq Music', navigationEndpoint: artistEndpoint('UCuniq000001') }, { text: ' • ' }, { text: '3M views' }, { text: ' • ' }, { text: '5:45' }])),
        ],
        thumbnail: thumbnails('https://lh3.googleusercontent.com/cover=w120-h120-l90-rj'),
      }
      const cover = parseSearch({ contents: [{ itemSectionRenderer: { contents: [{ musicResponsiveListItemRenderer: coverRow }] } }] }, 10)
      assert.equal(cover.songs[0].artist, 'Real Uniq Music')
      assert.equal(cover.songs[0].duration, 345)
      assert.equal(cover.songs[0].album.name, 'Single')
      assert.equal(cover.artists[0].browseId, 'UCuniq000001')
    })

    await check('search merge fills missing duration, album and artist ids from the songs filter pass', () => {
      const bare = {
        playlistItemData: { videoId: 'MISSINGDUR1' },
        flexColumns: [flex(runs([{ text: 'Sun Sajna' }])), flex(runs([{ text: 'Song' }, { text: ' • ' }, { text: 'Atif Aslam' }]))],
        thumbnail: thumbnails('https://lh3.googleusercontent.com/bare=w120-h120-l90-rj'),
      }
      const fixed = {
        playlistItemData: { videoId: 'FIXEDCOL001' },
        flexColumns: [flex(runs([{ text: 'Ishq' }])), flex(runs([{ text: 'Song' }, { text: ' • ' }, { text: 'Atif Aslam', navigationEndpoint: artistEndpoint('UCatifAslam1') }]))],
        fixedColumns: [{ musicResponsiveListItemFixedColumnRenderer: { text: runs([{ text: '5:01' }]) } }],
        thumbnail: thumbnails('https://lh3.googleusercontent.com/fixed=w120-h120-l90-rj'),
      }
      const primary = parseSearch({ contents: [{ itemSectionRenderer: { contents: [{ musicResponsiveListItemRenderer: bare }, { musicResponsiveListItemRenderer: fixed }] } }] }, 10)
      assert.equal(primary.songs[0].duration, 0)
      assert.equal(primary.songs[0].album.name, 'Single')
      assert.equal(primary.songs[1].duration, 301)
      const secondary = parseSearch({
        contents: [{
          itemSectionRenderer: {
            contents: [{
              musicResponsiveListItemRenderer: songRow({
                videoId: 'MISSINGDUR1', title: 'Sun Sajna', artist: 'Atif Aslam', artistId: 'UCatifAslam1',
                album: 'Sun Sajna', albumId: 'MPREsunsajna', length: '4:56',
              }),
            }],
          },
        }],
      }, 10)
      const merged = mergeSearchResults(primary, secondary, 10)
      assert.equal(merged.songs.length, 2)
      assert.equal(merged.songs[0].title, 'Sun Sajna')
      assert.equal(merged.songs[0].duration, 296)
      assert.deepEqual(merged.songs[0].artists, [{ name: 'Atif Aslam', browseId: 'UCatifAslam1' }])
      assert.equal(merged.songs[0].album.name, 'Sun Sajna')
      assert.equal(merged.songs[0].album.browseId, 'MPREsunsajna')
      assert.equal(merged.songs[1].duration, 301)
    })

    await check('InnerTube radio drops the seed and reads the official RDAMVM queue', () => {
      const songs = parseRadio(radioPayload, 'SEEDVIDEO01', 25)
      const track = songs[0]
      assert.equal(track.videoId, 'NEXTVIDEO02')
      assert.equal(track.id, 'yt-NEXTVIDEO02')
      assert.equal(track.title, 'Paniyon Sa')
      assert.equal(track.artist, 'Atif Aslam')
      assert.deepEqual(track.artists, [{ name: 'Atif Aslam', browseId: 'UCatifAslam1' }])
      assert.equal(track.album.name, 'Satyameva Jayate')
      assert.equal(track.album.browseId, 'MPREpaniyon')
      assert.equal(track.duration, 245)
      assert.equal(track.year, '2023')
      assert.equal(track.radio, true)
      assert.equal(track.cover, 'https://lh3.googleusercontent.com/radio=w544-h544-l90-rj')
      assert.equal(parseRadio(radioPayload, 'SEEDVIDEO01', 1).length, 1)
    })

    await check('InnerTube artist profile returns bio, subscribers, top songs, albums and related artists', () => {
      const artist = parseArtist(artistPayload, 'Ali Sethi')
      assert.equal(artist.name, 'Ali Sethi')
      assert.equal(artist.bio, 'Ali Sethi is a Pakistani singer and composer.')
      assert.equal(artist.subscribers, '2.1M subscribers')
      assert.equal(artist.banner, 'https://lh3.googleusercontent.com/banner=w1280-h532-l90-rj')
      assert.equal(artist.songs.length, 1)
      assert.equal(artist.songs[0].videoId, 'TOPSONG0001')
      assert.equal(artist.albums.length, 1)
      assert.equal(artist.albums[0].name, 'Coke Studio Season 14')
      assert.equal(artist.albums[0].browseId, 'MPREcoke01')
      assert.equal(artist.relatedArtists.length, 1)
      assert.equal(artist.relatedArtists[0].name, 'Kaavish')
      assert.equal(artist.relatedArtists[0].browseId, 'UCkaavish01')
      assert.equal(artist.relatedArtists[0].subscribers, '800K subscribers')
    })

    await check('ytmusic route serves search, radio and artist actions from one WEB_REMIX upstream', async () => {
      const calls = []
      const base = await endpoint(createYtmusicHandler({
        fetchImpl: async (url, options) => {
          const parsed = new URL(url)
          calls.push({ url: parsed, options, body: JSON.parse(options.body) })
          if (parsed.pathname.endsWith('/search')) return Response.json(searchPayload)
          if (parsed.pathname.endsWith('/next')) return Response.json(radioPayload)
          if (parsed.pathname.endsWith('/browse')) return Response.json(artistPayload)
          return Response.json({})
        },
      }))
      let response = await fetch(base + '/api/ytmusic?action=search&q=Pasoori&limit=5')
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type'), /application\/json/)
      assert.equal(response.headers.get('access-control-allow-origin'), '*')
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('x-echosync-catalog'), 'ytmusic-web-remix')
      const searchBody = await response.json()
      assert.equal(searchBody.songs.length, 2)
      assert.equal(searchBody.artists[0].browseId, 'UCaliSethi01')
      assert.equal(calls.length, 2)
      assert.equal(calls[0].url.origin, 'https://music.youtube.com')
      assert.equal(calls[0].url.pathname, '/youtubei/v1/search')
      assert.deepEqual(calls[0].body.context.client, {
        clientName: 'WEB_REMIX', clientVersion: '1.20260101.01.00', hl: 'en', gl: 'PK',
      })
      assert.equal(calls[0].body.query, 'Pasoori')
      assert.equal(calls[0].body.params, undefined)
      assert.equal(calls[0].options.headers['x-youtube-client-name'], '67')
      assert.ok(calls.some(call => call.body.params === 'EgWKAQIIAWoKEAkQBRAKEAMQBA=='))
      assert.ok(calls.every(call => call.url.origin === 'https://music.youtube.com'))

      response = await fetch(base + '/api/ytmusic?action=search&q=pasoori&limit=5')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('x-echosync-catalog'), 'ytmusic-cache')
      assert.equal(calls.length, 2)

      calls.length = 0
      response = await fetch(base + '/api/saavn/api/search/songs?query=night&limit=5')
      assert.equal(response.status, 200)
      assert.equal(calls[0].body.query, 'night')

      calls.length = 0
      response = await fetch(base + '/api/ytmusic?action=radio&videoId=SEEDVIDEO01')
      assert.equal(response.status, 200)
      const radio = await response.json()
      assert.equal(radio.songs.length, 1)
      assert.equal(radio.videoId, 'SEEDVIDEO01')
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url.pathname, '/youtubei/v1/next')
      assert.equal(calls[0].body.videoId, 'SEEDVIDEO01')
      assert.equal(calls[0].body.playlistId, 'RDAMVMSEEDVIDEO01')
      assert.equal(calls[0].body.isAudioOnly, true)

      calls.length = 0
      response = await fetch(base + '/api/ytmusic?action=artist&browseId=UCaliSethi01&name=Ali%20Sethi')
      assert.equal(response.status, 200)
      const artist = await response.json()
      assert.equal(artist.name, 'Ali Sethi')
      assert.equal(artist.browseId, 'UCaliSethi01')
      assert.equal(artist.songs.length, 1)
      assert.equal(artist.albums.length, 1)
      assert.equal(artist.relatedArtists.length, 1)
      assert.equal(calls[0].url.pathname, '/youtubei/v1/browse')
      assert.equal(calls[0].body.browseId, 'UCaliSethi01')
    })

    await check('ytmusic route rejects invalid input before touching the network', async () => {
      let calls = 0
      const base = await endpoint(createYtmusicHandler({ fetchImpl: async () => { calls++; return Response.json({}) } }))
      assert.equal((await fetch(base + '/api/ytmusic?action=search')).status, 400)
      assert.equal((await fetch(base + '/api/ytmusic?action=search&q=%20%20')).status, 400)
      assert.equal((await fetch(base + '/api/ytmusic?action=radio&videoId=bad')).status, 400)
      assert.equal((await fetch(base + '/api/ytmusic?action=artist&browseId=..%2Fprivate')).status, 400)
      assert.equal((await fetch(base + '/api/ytmusic?action=artist')).status, 400)
      assert.equal((await fetch(base + '/api/ytmusic?action=unknown')).status, 400)
      assert.equal((await fetch(base + '/api/ytmusic', { method: 'POST' })).status, 405)
      assert.equal((await fetch(base + '/api/ytmusic', { method: 'OPTIONS' })).status, 204)
      assert.equal(calls, 0)
    })

    await check('ytmusic failures are bounded and never leak upstream bodies', async () => {
      const timeout = await endpoint(createYtmusicHandler({
        timeoutMs: 25,
        fetchImpl: (_, { signal }) => new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        }),
      }))
      const timedOut = await fetch(timeout + '/api/ytmusic?action=search&q=test')
      assert.equal(timedOut.status, 504)
      assert.deepEqual(await timedOut.json(), { error: 'YouTube Music request timed out' })

      const invalid = await endpoint(createYtmusicHandler({ fetchImpl: async () => new Response('<html>upstream secret</html>') }))
      const malformed = await fetch(invalid + '/api/ytmusic?action=search&q=test')
      assert.equal(malformed.status, 502)
      assert.deepEqual(await malformed.json(), { error: 'YouTube Music provider unavailable' })

      const limited = await endpoint(createYtmusicHandler({ fetchImpl: async () => new Response('', { status: 429 }) }))
      const throttled = await fetch(limited + '/api/ytmusic?action=search&q=test')
      assert.equal(throttled.status, 429)
      assert.deepEqual(await throttled.json(), { error: 'YouTube Music provider unavailable' })
    })

    await check('legacy provider, taste-engine and stem modules are gone and unreferenced', () => {
      for (const file of ['src/core/omniMusicEngine.js', 'src/core/tasteEngine.js', 'src/core/songStem.js', 'server/saavnHandler.js', 'server/jiosaavn.js']) {
        assert.equal(fs.existsSync(`${__dirname}/${file}`), false, `${file} must be deleted`)
      }
      const sources = [
        ...fs.readdirSync(`${__dirname}/src`, { recursive: true })
          .filter(file => /\.(js|jsx)$/.test(file))
          .map(file => read(`src/${file}`)),
        read('server/ytmusicHandler.js'),
        read('server/saavn.js'),
        read('vite.config.js'),
        read('vercel.json'),
      ]
      for (const source of sources) {
        assert.doesNotMatch(source, /deezer|invidious|piped|jiosaavn|omniMusicEngine|tasteEngine|core\/songStem/i)
      }
      const config = read('vite.config.js')
      assert.match(config, /\/api\/ytmusic/)
      assert.match(config, /\/api\/saavn/)
      assert.doesNotMatch(config, /\/api\/piped|\/api\/invidious/)
    })

    await check('core modules load without platform globals or UI imports', () => {
      for (const file of fs.readdirSync(__dirname + '/src/core').filter(file => file.endsWith('.js'))) {
        const source = read('src/core/' + file)
        assert.doesNotMatch(source, /\b(window|document|navigator|localStorage|sessionStorage|BroadcastChannel|HTMLElement)\b/)
        assert.doesNotMatch(source, /from ['"][^'"]*(react|components|state|services)/)
      }
    })

    await check('clean profile routes parse, slugify and format without a DOM', async () => {
      const {
        ROUTE_KEY, parseRoute, artistSlug, slugToArtistName, artistPath, userPath, normalizeHandle,
      } = await import('./src/lib/router.js')
      assert.equal(ROUTE_KEY, '__echoRoute')
      assert.equal(artistSlug('Atif Aslam'), 'atif-aslam')
      assert.equal(artistSlug('A.R. Rahman'), 'a-r-rahman')
      assert.equal(artistSlug("Guru Randhawa's"), 'guru-randhawas')
      assert.equal(slugToArtistName('atif-aslam'), 'Atif Aslam')
      assert.equal(normalizeHandle('@Hary'), 'hary')
      assert.deepEqual(parseRoute('/'), { view: 'home', path: '/' })
      assert.deepEqual(parseRoute('/rooms'), { view: 'rooms', path: '/rooms' })
      assert.deepEqual(parseRoute('/library'), { view: 'library', path: '/library' })
      const room = parseRoute('/room/ES-TEST')
      assert.equal(room.view, 'room'); assert.equal(room.code, 'ES-TEST')
      const artist = parseRoute('/artist/atif-aslam', '?id=UC123')
      assert.equal(artist.view, 'artist')
      assert.equal(artist.artist.slug, 'atif-aslam')
      assert.equal(artist.artist.name, 'Atif Aslam')
      assert.equal(artist.artist.browseId, 'UC123')
      assert.equal(artistPath({ name: 'Atif Aslam', browseId: 'UC123' }), '/artist/atif-aslam?id=UC123')
      assert.equal(artistPath('Arijit Singh'), '/artist/arijit-singh')
      const channel = parseRoute('/@Hary')
      assert.equal(channel.view, 'user'); assert.equal(channel.user.handle, 'hary')
      assert.equal(userPath('@Hary'), '/@hary')
      assert.equal(parseRoute('/unknown').notFound, true)
      const source = read('src/lib/router.js')
      assert.doesNotMatch(source, /\b(window|document|navigator|localStorage|sessionStorage)\b/)
    })

    await check('full-page profiles replace the channel popup and sync browser history', () => {
      assert.equal(fs.existsSync(`${__dirname}/src/components/social/LoungeUserCard.jsx`), false)
      const app = read('src/App.jsx')
      assert.match(app, /ArtistProfileView/)
      assert.match(app, /UserProfileView/)
      assert.doesNotMatch(app, /LoungeUserCard/)
      const controller = read('src/hooks/useEchoSyncController.js')
      assert.match(controller, /addEventListener\('popstate'/)
      assert.match(controller, /history\[options\.replace \? 'replaceState' : 'pushState'\]/)
      assert.match(controller, /setArtistProfile/)
      assert.match(controller, /setUserProfile/)
      const artistView = read('src/views/ArtistProfileView.jsx')
      assert.match(artistView, /data-testid="artist-profile"/)
      assert.match(artistView, /Songs/)
      assert.match(artistView, /Albums &amp; singles/)
      assert.match(artistView, /Fans might also like/)
      assert.match(artistView, /=w1280-h532-l90-rj/)
      const userView = read('src/views/UserProfileView.jsx')
      assert.match(userView, /data-testid="user-profile"/)
      assert.match(userView, /Songs on repeat/)
      assert.match(userView, /Public playlists/)
      assert.match(userView, /Listening rooms/)
      assert.match(userView, /Listen along/)
      const config = JSON.parse(read('vercel.json'))
      assert.equal(config.rewrites.at(-1).source, '/((?!api/).*)')
    })

    await check('room command ordering is monotonic, actor-stable and drift corrections never seek inside three seconds',async()=>{
      const {compareCommands,driftCorrection}=await import('./src/core/roomCommandPolicy.js')
      assert.ok(compareCommands({stateVersion:20,lastActorId:'a'},{stateVersion:19,lastActorId:'z'})>0)
      assert.ok(compareCommands({stateVersion:20,lastActorId:'b'},{stateVersion:20,lastActorId:'a'})>0)
      assert.equal(compareCommands({stateVersion:20,lastActorId:'a'},{stateVersion:20,lastActorId:'a'}),0)
      for(const drift of [0,.1,.49,.5,1,2.49,2.5,2.99,3]){const result=driftCorrection(10,10+drift);assert.equal(result.seek,false);assert.equal(result.rate,drift<.5?1:1.03)}
      assert.deepEqual(driftCorrection(10,9),{seek:false,rate:.97});assert.deepEqual(driftCorrection(10,13.01),{seek:true,rate:1});assert.equal(driftCorrection(10,10.1,{explicit:true}).seek,true);assert.equal(driftCorrection(10,10.1,{loaded:true}).seek,true)
    })
    await check('profile album labels omit singles and duplicate names while preserving distinct albums',async()=>{
      const {distinctAlbum}=await import('./src/core/songDisplay.js');assert.equal(distinctAlbum({title:'Song',album:'Song'}),'');assert.equal(distinctAlbum({title:'Song',album:{name:'Single'}}),'');assert.equal(distinctAlbum({title:'Song',album:{name:'Different Album'}}),'Different Album')
    })
    console.log(`Application integrity: ${passed} checks passed`)
  } finally {
    for (const server of servers) {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
