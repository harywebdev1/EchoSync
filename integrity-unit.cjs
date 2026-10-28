const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
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

;(async () => {
  const [lrc, room, taste, storage] = await Promise.all([
    import('./src/core/lrcParser.js'), import('./src/core/roomSyncMath.js'),
    import('./src/core/tasteEngine.js'), import('./src/core/storageAdapter.js'),
  ])
  await check('canonical artwork resolves provider shapes without inventing thumbnail URLs', async () => {
    const { resolveTrackArtwork, trackArtworkSources } = await import('./src/lib/media.js')
    assert.equal(resolveTrackArtwork({ artwork: [{ url: 'https://cdn.test/500.jpg' }], cover: '//cdn.test/cover.jpg' }), 'https://cdn.test/500.jpg')
    assert.equal(resolveTrackArtwork({ artwork: 'javascript:bad', image: { url: 'http://cdn.test/a.jpg' } }), 'https://cdn.test/a.jpg')
    assert.deepEqual(trackArtworkSources({ cover: '/original.jpg', thumbnail: '/original.jpg', albumArt: '/album.jpg' }), ['/original.jpg', '/album.jpg'])
    assert.equal(resolveTrackArtwork({}), null)
  })
  await check('live mood queries rotate and fresh metadata preserves user IDs without duplicate songs', async () => {
    const { moodQueries, mergeMoodCatalog, MOOD_QUERIES } = await import('./src/core/moodFeed.js')
    for (const mood of Object.keys(MOOD_QUERIES)) assert.notDeepEqual(moodQueries(mood, [], 0), moodQueries(mood, [], 1))
    assert.equal(moodQueries('all', ['Atif Aslam'], 0)[0], 'Atif Aslam hits')
    const local = [{ id: 'liked-id', title: 'Song', artist: 'Artist', streamUrl: 'expired' }]
    const fresh = [{ id: 'jio-provider', title: 'Song', artist: 'Artist', streamUrl: 'fresh', cover: '/real.jpg' }]
    const result = mergeMoodCatalog(fresh, local)
    assert.equal(result.length, 1); assert.equal(result[0].id, 'liked-id'); assert.equal(result[0].streamUrl, 'fresh'); assert.equal(local[0].streamUrl, 'expired')
  })
  await check('successful seed resolution releases its promise; force refresh bypasses cached search and resolved results', async () => {
    const source = section(app, 'async function resolveSeed(', 'function prepareLyricsData(')
    let lookups = 0
    const promises = new Map()
    const seed = { id: 'seed', title: 'Song', artist: 'Artist' }
    const scope = { resolutionPromises: promises, cachedResolvedStream: () => null, cacheResolvedStream: () => {}, fetchJioSearch: async (query, limit, options) => { lookups++; assert.equal(options.fresh, true); return [{ id: 'found', streamUrl: 'fresh-' + lookups, duration: 180 }] }, rankCandidates: tracks => tracks.map(track => ({ track })), isFullLengthTrack: () => true }
    const resolve = vm.runInNewContext(source + '\nresolveSeed', scope)
    assert.equal((await resolve(seed, { forceRefresh: true })).streamUrl, 'fresh-1')
    assert.equal(promises.size, 0)
    assert.equal((await resolve(seed, { forceRefresh: true })).streamUrl, 'fresh-2')
    assert.equal(promises.size, 0)
  })
  await check('Home mood ranking and Quick Pick radio are deterministic, unique and preserve full-length policy', () => {
    const tracks = Array.from({ length: 22 }, (_, i) => ({ id: String(i), title: i === 9 ? 'Sufi acoustic' : 'Song ' + i, artist: i === 6 ? 'Atif Aslam' : 'Other', duration: 180 }))
    tracks.push({ ...tracks[0] }, { id: 'short', duration: 30 }, { id: 'preview', duration: 180, preview: true }, { id: 'unknown', title: 'Unknown Duration Song', duration: 0 })
    const options = { profile: { artists: { 'atif aslam': { name: 'Atif Aslam', weight: 9 } } }, mood: 'sufi' }
    const before = JSON.stringify([tracks, options])
    const result = taste.buildQuickPicksAndRadio(tracks, options, tracks[4])
    assert.equal(result.quickPicks.length, 12); assert.equal(result.quickPicks[0].id, '9')
    assert.equal(result.radio.length, 16); assert.equal(result.radio[0].id, '4')
    assert.equal(new Set(result.radio.map(x => x.id)).size, 16)
    assert.deepEqual(result, taste.buildQuickPicksAndRadio(tracks, options, tracks[4]))
    const all = taste.rankHomeTracks(tracks, options)
    assert.ok(all.some(x => x.id === 'unknown')); assert.ok(!all.some(x => ['short', 'preview'].includes(x.id)))
    assert.equal(taste.rankHomeTracks(tracks, { profile: options.profile })[0].id, '6')
    assert.deepEqual(taste.buildQuickPicksAndRadio([], {}), { quickPicks: [], radio: [] })
    assert.equal(JSON.stringify([tracks, options]), before)
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
    assert.equal(queue[0].id, 'current'); assert.equal(JSON.stringify(queue), before)
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
  await check('production resolver client uses same-origin routes and keeps verified duration metadata', async () => {
    const requests = []
    const scope = vm.createContext({ DEV_API: false, encodeURIComponent, safeMediaUrl: value => value,
      fetchJson: async url => { requests.push(url); return { url: 'https://r1.googlevideo.com/stream', duration: 180, bitrate: 128000 } } })
    vm.runInContext(section(app, 'function mediaProxyUrl(', 'const AVATAR_PRESETS') + section(app, 'async function getLocalYouTubeAudio(', 'async function getPipedAudio('), scope)
    const track = await scope.getLocalYouTubeAudio('dQw4w9WgXcQ')
    assert.equal(requests[0], '/api/youtube/audio/dQw4w9WgXcQ')
    assert.equal(track.streamUrl, '/api/media?url=https%3A%2F%2Fr1.googlevideo.com%2Fstream')
    assert.equal(track.duration, 180)
    assert.equal(scope.mediaProxyUrl('/api/media?url=existing'), '/api/media?url=existing')
  })
  await check('catalog retains unknown durations, rejects known short tracks and previews', () => {
    const scope = vm.createContext({})
    vm.runInContext(section(app, 'function isPreviewTrack(', 'function notifyStorageFailure(') + section(app, 'function isFullLengthTrack(', 'async function resolveFullTrack('), scope)
    for (const duration of [1, 30, 45, 59.99]) assert.equal(scope.isFullLengthTrack({ duration }), false)
    for (const duration of [0, undefined, 60, 180]) assert.equal(scope.isFullLengthTrack({ duration }), true)
    assert.equal(scope.isFullLengthTrack({ duration: 180, preview: true }), false)
  })
  await check('playback waits for metadata; short provider previews still play silently', async () => {
    let plays = 0, blocked = 0
    const scope = vm.createContext({ setTimeout, clearTimeout, sleepPausedRef: { current: false }, playAttemptIdRef: { current: 1 }, guestPreviewRef: { current: false }, currentUser: { id: 'member' }, blockShortPlayback: () => blocked++, setIsPlaying() {}, showToast() {} })
    vm.runInContext(section(app, '  async function safeAudioPlay(', '  function clearAdvanceCheck('), scope)
    const audio = new EventTarget()
    Object.assign(audio, { readyState: 1, duration: 30, getAttribute: () => 'fixture', play: async () => plays++ })
    assert.equal(await scope.safeAudioPlay(audio, 1), true)
    assert.equal(blocked, 0)
    audio.duration = NaN
    assert.equal(await scope.safeAudioPlay(audio, 1), true)
    audio.duration = 60
    assert.equal(await scope.safeAudioPlay(audio, 2), false)
    assert.equal(plays, 2)
    audio.readyState = 0
    scope.playAttemptIdRef.current = 1
    const pending = scope.safeAudioPlay(audio, 1)
    assert.equal(plays, 2)
    audio.readyState = 1
    audio.dispatchEvent(new Event('loadedmetadata'))
    assert.equal(await pending, true)
    assert.equal(plays, 3)
    // Guests hear the same stream; the 30 second cap is enforced by the
    // preview timer, not by rejecting the media element.
    scope.guestPreviewRef.current = true
    scope.playAttemptIdRef.current = 2
    audio.duration = 30
    assert.equal(await scope.safeAudioPlay(audio, 2), true)
    assert.equal(plays, 4)
    assert.equal(blocked, 0)
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
    assert.equal(adapter.read('echosync_messages_v3', 'fallback'), 'fallback') // Malformed JSON never crashes hydration.
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
  await check('taste signals keep weighted artist/vibe/language learning, search deduplication and input immutability', () => {
    const profile = taste.emptyTasteProfile()
    const original = JSON.stringify(profile)
    const track = { id: 'song', title: 'Romantic song', artist: 'Arijit Singh', language: 'Hindi' }
    let next = taste.applyTasteSignal(profile, 'play', { track }, () => 1234)
    assert.equal(JSON.stringify(profile), original)
    assert.equal(next.artists['arijit singh'].weight, 3)
    assert.equal(next.vibes.romance.weight, 2)
    assert.equal(next.languages.hindi.weight, 1)
    assert.equal(next.genres.romance.weight, 2)
    assert.equal(next.updatedAt, 1234)
    assert.equal(next.events, 1)
    next = taste.applyTasteSignal(next, 'like', { track }, () => 1235)
    assert.equal(next.artists['arijit singh'].weight, 9)
    assert.equal(next.vibes.romance.weight, 6)
    assert.equal(next.languages.hindi.weight, 2)
    next = taste.applyTasteSignal(next, 'search', { query: '  ARIJIT ' }, () => 1236)
    next = taste.applyTasteSignal(next, 'search', { query: 'arijit' }, () => 1237)
    assert.deepEqual(next.searches, [{ query: 'arijit', at: 1237 }])
    assert.equal(next.keywords.arijit.weight, 6)
    assert.deepEqual(taste.extractTopVibeTags(next), ['Romance'])
    const skipped = taste.applyTasteSignal(next, 'skip', { track }, () => 1239)
    assert.equal(skipped.artists['arijit singh'].weight, 7)
    assert.equal(skipped.vibes.romance.weight, 4)
    assert.equal(taste.normalizeTasteProfile({ events: -2 }).events, 0)
    assert.equal(taste.normalizeTasteProfile({ artists: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i), i + 1])) }).artists['39'].weight, 40)
    assert.equal(Object.keys(taste.normalizeTasteProfile({ artists: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i), i + 1])) }).artists).length, 30)
  })
  await check('taste compatibility is symmetric, bounded, volume-invariant and safe for empty profiles', () => {
    const a = { artists: { alpha: 3, beta: 1 }, genres: { indie: 1 } }
    const b = { artists: { alpha: 30, beta: 10 }, genres: { indie: 100 } }
    const partial = { artists: { alpha: 1 } }
    const snapshot = JSON.stringify([a, b, partial])
    assert.equal(taste.computeTasteMatchPercentage({}, {}), 0)
    assert.equal(taste.computeTasteMatchPercentage({ artists: { ' ': 1 } }, { artists: { ' ': 2 } }), 0)
    assert.equal(taste.computeTasteMatchPercentage(a, a), 99)
    assert.equal(taste.computeTasteMatchPercentage(a, b), 99)
    assert.equal(taste.computeTasteMatchPercentage({ artists: { a: 1 } }, { artists: { b: 1 } }), 0)
    assert.equal(taste.computeTasteMatchPercentage(a, partial), taste.computeTasteMatchPercentage(partial, a))
    assert.ok(taste.computeTasteMatchPercentage(a, partial) > 0 && taste.computeTasteMatchPercentage(a, partial) < 99)
    for (const value of [null, {}, { artists: { invalid: Infinity } }, { artists: { artist: -3 } }, a, b, partial]) {
      const score = taste.computeTasteMatchPercentage(a, value)
      assert.ok(Number.isInteger(score) && score >= 0 && score <= 99)
    }
    assert.equal(JSON.stringify([a, b, partial]), snapshot)
  })
  await check('Home stems remove From suffixes and partial mood success survives failed queries', async () => {
    const { songStem, collectMoodResults, mergeMoodCatalog } = await import('./src/core/moodFeed.js')
    const first={id:'a',title:'Apna Bana Le (From "Bhediya")',artist:'Arijit Singh, Sachin',duration:180}
    const duplicate={...first,id:'b',title:'  Apna Bana Le ',artist:'Arijit Singh'}
    assert.equal(songStem(first),songStem(duplicate))
    const result=collectMoodResults([{status:'rejected',reason:new Error('429')},{status:'fulfilled',value:[first,duplicate]}])
    assert.equal(result.length,1)
    assert.equal(mergeMoodCatalog([duplicate],[first]).length,1)
    assert.deepEqual(collectMoodResults([{status:'rejected'}]),[])
  })
  await check('room votes pin the playing prefix, restore original ties and converge out of order', async () => {
    const { mergeVote, rankRoomQueue, voteCount } = await import('./src/core/roomVotes.js')
    const ids=['past','playing','first','second','third']
    let votes=mergeVote({},'third','alice',{active:true,ts:10,op:'a'})
    assert.deepEqual(rankRoomQueue(ids,1,votes,ids),['past','playing','third','first','second'])
    votes=mergeVote(votes,'third','bob',{active:true,ts:11,op:'b'})
    assert.equal(voteCount(votes.third),2)
    votes=mergeVote(votes,'third','alice',{active:false,ts:12,op:'c'})
    const before=JSON.stringify(votes)
    assert.equal(mergeVote(votes,'third','alice',{active:true,ts:9,op:'old'}),votes)
    assert.equal(JSON.stringify(votes),before)
    votes=mergeVote(votes,'third','bob',{active:false,ts:13,op:'d'})
    assert.deepEqual(rankRoomQueue(['past','playing','third','first','second'],1,votes,ids),ids)
  })
  await check('Home allocates only visible stems across disjoint shelves and preserves candidates',async()=>{
    const {allocateHomeShelves,songStem}=await import('./src/core/moodFeed.js')
    const tracks=Array.from({length:30},(_,i)=>({id:String(i),title:'Song '+i,artist:'Artist'}))
    const before=JSON.stringify(tracks),duplicate={...tracks[0],id:'duplicate',title:'Song 0 (From "Album")'}
    const sections=allocateHomeShelves([...tracks,duplicate],[duplicate,...tracks],tracks)
    assert.equal(sections.quickPicks.length,12);assert.equal(sections.familiar.length,10);assert.equal(sections.fresh.length,8)
    const all=[...sections.quickPicks,...sections.familiar,...sections.fresh];assert.equal(new Set(all.map(songStem)).size,30);assert.equal(JSON.stringify(tracks),before)
  })
  await check('phonetic and partial search ranks intended songs without hiding the provider tail', async () => {
    const {rankBySearchSimilarity,phoneticNormalize}=await import('./src/core/searchRanking.js')
    const cases=[['pasuri','Pasoori','Ali Sethi'],['kesria','Kesariya','Arijit Singh'],['apna bna','Apna Bana Le','Arijit Singh'],['tu jhum','Tu Jhoom','Abida Parveen'],['arz kia','Arz Kiya','Anuv Jain'],['atif','Tera Hone Laga Hoon','Atif Aslam'],['anuv','Baarishein','Anuv Jain']]
    for(const [query,title,artist] of cases){const rows=[{id:'tail',title:query==='tu jhum'?'Tu Jhumata Huva Saawan':'Unrelated provider song',artist:query==='kesria'?'Kesria':'Different Singer'},{id:'hit',title,artist}];const before=JSON.stringify(rows);const result=rankBySearchSimilarity(rows,query);assert.equal(result[0].id,'hit',query);assert.equal(result.length,2);assert.equal(JSON.stringify(rows),before)}
    assert.equal(rankBySearchSimilarity([{id:'variant',title:'Pasoori (Reprise)'},{id:'original',title:'Pasoori'}],'pasuri')[0].id,'original')
    const versions=[{id:'cover',title:'Arz Kiya Hai',artist:'Cover Artist',playCount:100},{id:'original',title:'Arz Kiya Hai | Coke Studio Bharat',artist:'Anuv Jain',playCount:28000000}];assert.equal(rankBySearchSimilarity(versions,'arz kia')[0].id,'original')
    assert.equal(phoneticNormalize('aa ee oo ph kh gh z sh q w'),'a i u f k g j s k v')
  })
  await check('taste learns five affinity dimensions, caps session to three and allocates artist radio 55/30/15', () => {
    let profile=taste.applyTasteSignal(null,'play',{track:{id:'collab',title:'Sufi Soul',artist:'Atif Aslam & Arijit Singh',language:'Hindi'}})
    assert.ok(profile.artistWeights['atif aslam'].weight>0);assert.ok(Object.keys(profile.vibeWeights).length);assert.ok(profile.languageWeights.hindi.weight>0);assert.ok(profile.coArtistGraph['atif aslam']['arijit singh'].weight>0)
    for(let i=0;i<4;i++)profile=taste.applyTasteSignal(profile,'play',{track:{id:'p'+i,title:'Acoustic '+i,artist:'Anuv Jain',language:'Hindi'}})
    assert.deepEqual(profile.sessionMomentum.map(t=>t.id),['p3','p2','p1'])
    const english=taste.applyTasteSignal(null,'like',{track:{id:'pop',title:'Pop',artist:'Artist',language:'english'}});assert.equal(english.languageWeights.english.name,'English');assert.ok(taste.tasteVibesForTrack({language:'english'}).includes('Global Pop'))
    const seed={id:'seed',title:'Seed',artist:'Atif Aslam',language:'Hindi',duration:180}
    const rows=[...Array.from({length:20},(_,i)=>({id:'same'+i,title:'Same '+i,artist:'Atif Aslam',language:'Hindi',duration:180})),...Array.from({length:20},(_,i)=>({id:'related'+i,title:'Related '+i,artist:'Arijit Singh',language:'Hindi',duration:180})),...Array.from({length:20},(_,i)=>({id:'favorite'+i,title:'Favorite '+i,artist:'Global Artist',language:'English',duration:180}))]
    const radio=taste.buildArtistRadio(seed,rows,profile,{limit:20,liked:rows.filter(t=>t.id.startsWith('favorite')).map(t=>t.id)})
    assert.equal(radio.filter(t=>t.id.startsWith('same')).length,11);assert.equal(radio.filter(t=>t.id.startsWith('related')).length,6);assert.equal(radio.filter(t=>t.id.startsWith('favorite')).length,3);assert.equal(new Set(radio.map(t=>t.id)).size,20)
  })
  await check('dynamic recommendations query top three artists and session vibe while retaining partial successes',async()=>{
    const {refreshDynamicTasteCatalog}=await import('./src/hooks/useDynamicTasteCatalog.js');const queries=[];const profile={artistWeights:{a:{name:'Atif Aslam',weight:9},b:{name:'Anuv Jain',weight:8},c:{name:'Arijit Singh',weight:7},d:{name:'Ignored Fourth',weight:6}},sessionMomentum:[{id:'last',title:'Sufi Soul',artist:'Atif Aslam'}]}
    const rows=await refreshDynamicTasteCatalog(profile,{search:async(query,limit)=>{queries.push(query);assert.equal(limit,40);if(query.startsWith('Anuv'))throw Error('upstream offline');return [{id:query,title:query,artist:query,duration:180}]}})
    assert.ok(queries.includes('Atif Aslam songs'));assert.ok(queries.includes('Arijit Singh songs'));assert.ok(queries.includes('Sufi & Soul songs'));assert.ok(!queries.some(q=>q.includes('Fourth')));assert.equal(rows.length,3)
  })
  await check('core modules load without platform globals or UI imports', () => {
    for (const file of fs.readdirSync(__dirname + '/src/core').filter(file => file.endsWith('.js'))) {
      const source = read('src/core/' + file)
      assert.doesNotMatch(source, /\b(window|document|navigator|localStorage|sessionStorage|BroadcastChannel|HTMLElement)\b/)
      assert.doesNotMatch(source, /from ['"][^'"]*(react|components|state|services)/)
    }
  })
  console.log(`Application integrity: ${passed} checks passed`)
})().catch(error => { console.error(error); process.exitCode = 1 })
