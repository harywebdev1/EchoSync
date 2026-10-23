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
  await check('catalog retains unknown durations, rejects known short tracks and previews', () => {
    const scope = vm.createContext({})
    vm.runInContext(section(app, 'function isPreviewTrack(', 'function readStorage(') + section(app, 'function isFullLengthTrack(', 'async function resolveFullTrack('), scope)
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
    vm.runInContext(read('src/services/networkMonitor.js').replace(/^import .*\n/, '').replaceAll('export ', ''), scope)
    for (const [rtt, jitter] of [[100, 0], [160, 60], [120, 40]]) { latency = rtt; await scope.pingProxy(); assert.equal(snapshot.jitterMs, jitter) }
    for (const drift of [0, 140, 1800, 4200]) { scope.recordRoomDrift(drift / 1000); assert.equal(snapshot.roomDriftMs, drift) }
    const tones = vm.createContext({})
    vm.runInContext(section(read('src/components/TelemetryPill.jsx'), 'export function telemetryTone', 'export function SyncDot').replaceAll('export ', ''), tones)
    for (const [ms, tone] of [[0, 'good'], [299, 'good'], [300, 'fair'], [1000, 'fair'], [1001, 'poor'], [4200, 'poor']]) assert.equal(tones.telemetryTone(ms), tone)
  })
  await check('quota retry prunes only disposable caches, returns failure, and emits notification', async () => {
    let calls = 0, permanent = false, notified = 0
    const localStorage = { likes: 'keep', playlists: 'keep', rooms: 'keep', messages: 'voice-data', stream: 'discard', lyrics: 'discard', daily_old: 'discard' }
    Object.defineProperties(localStorage, {
      setItem: { value(key, value) { calls++; if (permanent || calls === 1) throw new Error('QuotaExceededError'); this[key] = value } },
      removeItem: { value(key) { delete this[key] } },
    })
    const scope = vm.createContext({ localStorage, STREAM_CACHE_KEY: 'stream', LYRIC_CACHE_KEY: 'lyrics', TRANSLATE_KEY: 'translate', TRANSLATION_CACHE_KEY: 'translation', DAILY_FEED_PREFIX: 'daily_v3_', DAILY_FEED_LEGACY_PREFIX: 'daily_', queueMicrotask, Event, window: { dispatchEvent: () => notified++ } })
    vm.runInContext('let pendingStorageFailure = false; let storageFailureQueued = false;\n' + section(app, 'function writeStorage(', 'function loadLibraryCache'), scope)
    assert.equal(scope.writeStorage('likes', ['new']), true)
    assert.equal(calls, 2)
    assert.equal(localStorage.stream, undefined)
    assert.equal(localStorage.daily_old, undefined)
    for (const key of ['playlists', 'rooms', 'messages']) assert.ok(localStorage[key])
    permanent = true
    const previous = localStorage.likes
    assert.equal(scope.writeStorage('likes', ['unsaved']), false)
    assert.equal(calls, 4)
    assert.equal(localStorage.likes, previous)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(notified, 1)
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
  console.log(`Application integrity: ${passed} checks passed`)
})().catch(error => { console.error(error); process.exitCode = 1 })
