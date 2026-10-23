const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const read = path => fs.readFileSync(`${__dirname}/${path}`, 'utf8').replaceAll('\r\n', '\n')
const app = read('src/App.jsx')
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
  await check('catalog retains unknown durations, rejects known short tracks and previews', () => {
    const scope = vm.createContext({})
    vm.runInContext(section(app, 'function isPreviewTrack(', 'function notifyStorageFailure(') + section(app, 'function isFullLengthTrack(', 'async function resolveFullTrack('), scope)
    for (const duration of [1, 30, 45, 59.99]) assert.equal(scope.isFullLengthTrack({ duration }), false)
    for (const duration of [0, undefined, 60, 180]) assert.equal(scope.isFullLengthTrack({ duration }), true)
    assert.equal(scope.isFullLengthTrack({ duration: 180, preview: true }), false)
  })
  await check('playback waits for metadata; short, unknown and stale attempts never call play', async () => {
    let plays = 0, blocked = 0
    const scope = vm.createContext({ setTimeout, clearTimeout, playAttemptIdRef: { current: 1 }, blockShortPlayback: () => blocked++, setIsPlaying() {}, showToast() {} })
    vm.runInContext(section(app, '  async function safeAudioPlay(', '  function clearAdvanceCheck('), scope)
    const audio = new EventTarget()
    Object.assign(audio, { readyState: 1, duration: 30, getAttribute: () => 'fixture', play: async () => plays++ })
    assert.equal(await scope.safeAudioPlay(audio, 1), false)
    assert.equal(blocked, 1)
    audio.duration = NaN
    assert.equal(await scope.safeAudioPlay(audio, 1), false)
    audio.duration = 60
    assert.equal(await scope.safeAudioPlay(audio, 2), false)
    audio.readyState = 0
    const pending = scope.safeAudioPlay(audio, 1)
    assert.equal(plays, 0)
    audio.readyState = 1
    audio.dispatchEvent(new Event('loadedmetadata'))
    assert.equal(await pending, true)
    assert.equal(plays, 1)
  })
  await check('RTT 100→160→120 gives jitter 0→60→40; drift remains 0/140/1800/4200', async () => {
    let now = 0, latency = 100, snapshot = {}
    const scope = vm.createContext({ window: {}, document: { visibilityState: 'visible' }, navigator: {}, performance: { now: () => now }, AbortController, setTimeout, clearTimeout,
      fetch: async () => { now += latency; return { ok: true } }, setLiveTelemetry: patch => { snapshot = { ...snapshot, ...patch } }, liveTelemetryStore: { get: () => snapshot } })
    vm.runInContext(read('src/services/networkMonitor.js').replace(/^import .*\n/gm, '').replaceAll('export ', ''), scope)
    for (const [rtt, jitter] of [[100, 0], [160, 60], [120, 40]]) { latency = rtt; await scope.pingProxy(); assert.equal(snapshot.jitterMs, jitter) }
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
  for (const file of ['src/App.jsx', 'src/components/PublicLoungeDrawer.jsx']) {
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
  await check('taste signals keep weights, search deduplication, tuning and input immutability', () => {
    const profile = taste.emptyTasteProfile()
    const original = JSON.stringify(profile)
    const track = { id: 'song', title: 'Romantic song', artist: 'Arijit Singh', language: 'Hindi' }
    let next = taste.applyTasteSignal(profile, 'play', { track }, () => 1234)
    assert.equal(JSON.stringify(profile), original)
    assert.equal(next.artists['arijit singh'].weight, 3)
    assert.equal(next.languages.hindi.weight, 3)
    assert.equal(next.genres.romance.weight, 3)
    assert.equal(next.updatedAt, 1234)
    next = taste.applyTasteSignal(next, 'like', { track }, () => 1235)
    assert.equal(next.artists['arijit singh'].weight, 8)
    next = taste.applyTasteSignal(next, 'search', { query: '  ARIJIT ' }, () => 1236)
    next = taste.applyTasteSignal(next, 'search', { query: 'arijit' }, () => 1237)
    assert.deepEqual(next.searches, [{ query: 'arijit', at: 1237 }])
    next = taste.applyTasteSignal(next, 'tune', { vibes: ['sufi-qawwali', 'invalid'] }, () => 1238)
    assert.deepEqual(taste.extractTopVibeTags(next), ['Sufi & Qawwali'])
    const again = taste.applyTasteSignal(next, 'tune', { vibes: ['sufi-qawwali'] }, () => 1239)
    assert.deepEqual(again.vibes, next.vibes)
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
  await check('core modules load without platform globals or UI imports', () => {
    for (const file of fs.readdirSync(__dirname + '/src/core').filter(file => file.endsWith('.js'))) {
      const source = read('src/core/' + file)
      assert.doesNotMatch(source, /\b(window|document|navigator|localStorage|sessionStorage|BroadcastChannel|HTMLElement)\b/)
      assert.doesNotMatch(source, /from ['"][^'"]*(react|components|state|services)/)
    }
  })
  console.log(`Application integrity: ${passed} checks passed`)
})().catch(error => { console.error(error); process.exitCode = 1 })
