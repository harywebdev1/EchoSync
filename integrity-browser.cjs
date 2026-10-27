const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { fixtureState, installFixtures } = require('./integrity-fixtures.cjs')
const APP_URL = process.env.ECHOSYNC_URL || 'http://127.0.0.1:5173'
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
let passed = 0

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  async function check(name, options, test) {
    if (process.env.ECHOSYNC_CASE && !name.includes(process.env.ECHOSYNC_CASE)) return
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: fixtureState(options), permissions: ['microphone'] })
    await installFixtures(context)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await test(page)
      assert.deepEqual(errors, [])
      passed++
      console.log(`PASS ${name}`)
    } catch (error) {
      if (errors.length) console.error('Application page errors:', errors)
      console.error(await page.evaluate(() => ({ audio: [...document.querySelectorAll('audio')].map(a => ({ duration: a.duration, paused: a.paused, readyState: a.readyState, error: a.error?.code })), alerts: [...document.querySelectorAll('[role=alert], .toast')].map(e => e.textContent) })))
      throw error
    } finally { await context.close() }
  }
  async function open(page) {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
    await page.locator('.stage').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().waitFor()
  }
  try {
    await check('30-second media is blocked before any play call, despite catalog claiming 180s', { duration: 180, streamSeconds: 30 }, async page => {
      await page.addInitScript(() => {
        window.__plays = 0
        const play = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = function (...args) { window.__plays++; return play.apply(this, args) }
      })
      await open(page)
      await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
      await page.getByText('Track blocked: full-length playback requires at least 60 seconds.', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.__plays), 0)
      assert.equal(await page.locator('audio').first().evaluate(audio => audio.paused), true)
    })
    await check('unknown catalog duration remains selectable and confirmed 60-second media plays', { duration: 0, streamSeconds: 60 }, async page => {
      await open(page)
      await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
      await page.waitForFunction(() => { const audio = document.querySelector('audio'); return audio && !audio.paused && audio.duration === 60 && audio.currentTime > 0.1 })
    })
    await check('quota failure surfaces a visible unsaved warning without pruning user content', {}, async page => {
      await open(page)
      await page.evaluate(() => {
        localStorage.setItem('echosync_messages_v3', JSON.stringify({ sentinel: 'voice-data' }))
        localStorage.setItem('echosync_playlists_v1', JSON.stringify({ sentinel: 'playlist' }))
        localStorage.setItem('echosync_stream_cache_v4', 'disposable')
        localStorage.setItem('echosync_translate.v1', 'true')
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
          if (key === 'echosync.likes.v1') throw new DOMException('full', 'QuotaExceededError')
          return original.call(this, key, value)
        }
      })
      await page.locator('button[aria-label^="Like "]:visible').first().click()
      await page.getByText("Changes weren't saved (storage full)", { exact: true }).waitFor()
      const saved = await page.evaluate(() => ({ messages: localStorage.getItem('echosync_messages_v3'), playlists: localStorage.getItem('echosync_playlists_v1'), translationPreference: localStorage.getItem('echosync_translate.v1') }))
      assert.match(saved.messages, /voice-data/)
      assert.match(saved.playlists, /playlist/)
      assert.equal(saved.translationPreference, 'true')
    })
    await check('storage unavailable at startup reports failure without crashing the app', {}, async page => {
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new DOMException('disabled', 'SecurityError') }
      })
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
      await page.locator('.stage').waitFor({ state: 'visible' })
      await page.getByText("Changes weren't saved (storage full)", { exact: true }).waitFor()
    })
    for (const room of [false, true]) {
      await check(`${room ? 'Room' : 'Lounge'}: denied recording sends nothing; Retry sends real test-device recording`, {}, async page => {
        await page.addInitScript(() => {
          const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
          window.__allowMic = false
          navigator.mediaDevices.getUserMedia = (...args) => window.__allowMic ? getUserMedia(...args) : Promise.reject(new DOMException('denied', 'NotAllowedError'))
        })
        await open(page)
        const rootAudio = await page.locator('[data-testid=root-audio]').elementHandle()
        if (room) {
          await page.getByRole('button', { name: /Integrity Room/ }).first().click()
          await page.locator('.social:not(.lounge-drawer)').waitFor({ state: 'attached' })
          if (!await page.getByRole('button', { name: 'Record voice note', exact: true }).isVisible()) await page.getByRole('button', { name: /Toggle room chat/ }).click()
        } else {
          await page.locator('[data-testid="lounge-nav-btn"]').click()
        }
        const panel = page.locator(room ? '.social:not(.lounge-drawer)' : '[data-testid="lounge-drawer"]').first()
        await panel.getByRole('button', { name: room ? 'Record voice note' : 'Record a Lounge voice note', exact: true }).click()
        await panel.getByRole('alert').waitFor()
        assert.equal(await panel.locator('.bubble.voice').count(), 0)
        await page.evaluate(() => { window.__allowMic = true })
        await panel.getByRole('button', { name: 'Retry', exact: true }).click()
        await panel.locator('.recording-console').waitFor()
        // Allow the test microphone to capture actual samples, not a readiness delay.
        await page.waitForTimeout(1000)
        await panel.getByRole('button', { name: 'Send', exact: true }).click()
        await panel.locator('.bubble.voice').waitFor()
        assert.equal(await panel.getByRole('alert').count(), 0)
        assert.equal(await page.locator('[data-testid=root-audio]').evaluate((audio, original) => audio === original, rootAudio), true)
      })
    }
    await check('extracted Library searches and adds songs through its injected resolver', {}, async page => {
      await open(page)
      await page.getByRole('button', { name: /^Your library/ }).click()
      await page.getByRole('button', { name: /New playlist/ }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Playlist name').fill('Extraction verification')
      await dialog.getByRole('button', { name: 'Create playlist', exact: true }).click()
      await page.getByRole('textbox', { name: 'Search songs to add to playlist' }).fill('Kesariya')
      const result = page.locator('.playlist-search-row').filter({ hasText: 'Kesariya' }).first()
      await result.getByRole('button', { name: 'Add to this playlist', exact: true }).click()
      await page.locator('.playlist-detail .library-row').filter({ hasText: 'Kesariya' }).waitFor()
    })
    for (const mobile of [false, true]) {
      await check(`${mobile ? 'Mobile' : 'Desktop'}: navigation and player drawers preserve the playing root audio node`, {}, async page => {
        if (mobile) await page.setViewportSize({ width: 390, height: 844 })
        await open(page)
        await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
        await page.waitForFunction(() => {
          const audio = document.querySelector('[data-testid=root-audio]')
          return audio && !audio.paused && audio.currentTime > 0.3
        })
        await page.evaluate(() => {
          const audio = document.querySelector('[data-testid=root-audio]')
          window.__audioContinuity = { node: audio, source: audio.currentSrc, time: audio.currentTime, interruptions: [], removals: 0 }
          for (const event of ['emptied', 'loadstart', 'abort', 'pause']) {
            audio.addEventListener(event, () => window.__audioContinuity.interruptions.push(event))
          }
          new MutationObserver(records => {
            for (const record of records) for (const node of record.removedNodes) {
              if (node === audio || node.contains?.(audio)) window.__audioContinuity.removals++
            }
          }).observe(document.querySelector('.app'), { childList: true, subtree: true })
        })
        const nav = page.locator(mobile ? '.mobile-bottom-bar' : '.sidebar')
        await nav.getByRole('button', { name: mobile ? /^Library/ : /^Your library/ }).click()
        await page.locator('.library-view').waitFor()
        await page.getByRole('button', { name: /Liked songs/i }).click()
        await nav.getByRole('button', { name: /^Rooms/ }).click()
        await page.locator('.rooms-view').waitFor()
        await nav.getByRole('button', { name: 'Home', exact: true }).click()
        await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().waitFor()
        await page.getByRole('button', { name: 'Open full player', exact: true }).filter({ visible: true }).click()
        await page.locator('.full-player').waitFor()
        await page.getByRole('button', { name: 'Close full player', exact: true }).click()
        await page.locator('.full-player').waitFor({ state: 'detached' })
        if (!mobile) {
          await page.locator('[data-testid=queue-btn]').click()
          await page.locator('[data-testid=solo-queue-drawer]').waitFor()
          await page.getByRole('button', { name: 'Close queue', exact: true }).click()
        }
        await page.locator(mobile ? '[data-testid=lounge-mobile-btn]' : '[data-testid=lounge-nav-btn]').click()
        await page.locator('[data-testid=lounge-drawer]').waitFor()
        await page.getByRole('button', { name: 'Close lounge', exact: true }).click()
        await page.waitForFunction(() => {
          const saved = window.__audioContinuity
          return saved.node.currentTime > saved.time + 0.2
        })
        assert.deepEqual(await page.evaluate(() => {
          const saved = window.__audioContinuity
          return { sameNode: saved.node === document.querySelector('[data-testid=root-audio]'), connected: saved.node.isConnected,
            sameSource: saved.source === saved.node.currentSrc, paused: saved.node.paused,
            removals: saved.removals, interruptions: saved.interruptions }
        }), { sameNode: true, connected: true, sameSource: true, paused: false, removals: 0, interruptions: [] })
      })
    }
    await check('Media Session actions use current playback commands and retain the root audio node', {}, async page => {
      await page.addInitScript(() => {
        window.__mediaActions = {}
        window.__mediaSession = { metadata: null, playbackState: 'none',
          setActionHandler(action, handler) { window.__mediaActions[action] = handler },
          setPositionState(value) { this.positionState = value } }
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: window.__mediaSession })
      })
      await open(page)
      await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
      await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused && window.__mediaSession.metadata?.title === 'Chaleya')
      const original = await page.locator('[data-testid=root-audio]').elementHandle()
      await page.evaluate(() => window.__mediaActions.pause())
      await page.waitForFunction(() => document.querySelector('[data-testid=root-audio]').paused && window.__mediaSession.playbackState === 'paused')
      await page.evaluate(() => window.__mediaActions.play())
      await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      await page.evaluate(() => window.__mediaActions.seekto({ seekTime: 12 }))
      await page.waitForFunction(() => document.querySelector('[data-testid=root-audio]').currentTime >= 12)
      await page.waitForFunction(() => window.__mediaSession.positionState?.position >= 12)
      await page.evaluate(() => window.__mediaActions.nexttrack())
      await page.waitForFunction(() => window.__mediaSession.metadata?.title && window.__mediaSession.metadata.title !== 'Chaleya' && !document.querySelector('[data-testid=root-audio]').paused)
      await page.evaluate(() => window.__mediaActions.pause())
      await page.waitForFunction(() => document.querySelector('[data-testid=root-audio]').paused)
      assert.equal(await page.locator('[data-testid=root-audio]').evaluate((node, previous) => node === previous, original), true)
      await page.getByRole('button', { name: /Integrity Room/ }).first().click()
      await page.locator('.social:not(.lounge-drawer)').waitFor({ state: 'attached' })
      await page.locator('.room-head').waitFor()
      await page.evaluate(() => {
        window.__rolePeer = new BroadcastChannel('echosync-room-sync')
        window.__rolePeer.postMessage({ type: 'role-resolved', sender: 'peer', roomId: 'integrity-room', roles: { integrity: 'listener' } })
      })
      await page.locator('.room-stage-attribution').filter({ hasText: 'Listener' }).waitFor()
      await page.evaluate(async () => {
        await new Promise(requestAnimationFrame)
        window.__mediaActions.play()
        await new Promise(requestAnimationFrame)
      })
      assert.equal(await page.locator('[data-testid=root-audio]').evaluate(node => node.paused), true, 'OS controls bypassed the listener role')
      await page.evaluate(() => window.__rolePeer.close())
    })
    await check('room sync keeps one channel owner and processes peer chat and playback state after navigation', {}, async page => {
      await page.addInitScript(() => {
        const NativeChannel = BroadcastChannel
        window.__channelRecords = []
        window.__makePeer = () => new NativeChannel('echosync-room-sync')
        window.BroadcastChannel = class extends NativeChannel {
          constructor(name) { super(name); this.record = { name, closed: false }; window.__channelRecords.push(this.record) }
          close() { this.record.closed = true; super.close() }
        }
      })
      await open(page)
      const audio = await page.locator('[data-testid=root-audio]').elementHandle()
      await page.getByRole('button', { name: /Integrity Room/ }).first().click()
      await page.locator('.social:not(.lounge-drawer)').waitFor({ state: 'attached' })
      if (!await page.getByRole('button', { name: 'Record voice note', exact: true }).isVisible()) await page.getByRole('button', { name: /Toggle room chat/ }).click()
      await page.getByRole('button', { name: 'Record voice note', exact: true }).waitFor()
      await page.evaluate(() => {
        window.__peer = window.__makePeer()
        const message = { id: 'hook-peer-chat', author: 'peer', userName: 'Peer', type: 'text', text: 'Sync hook peer message', time: '12:00', reactions: [] }
        window.__peer.postMessage({ type: 'chat', sender: 'peer', roomId: 'integrity-room', message })
      })
      const chat = page.locator('.social:not(.lounge-drawer)')
      await chat.getByText('Sync hook peer message', { exact: true }).waitFor()
      assert.equal(await chat.getByText('Sync hook peer message', { exact: true }).count(), 1)
      // A real interaction has occurred, so remote clock updates should seek rather than request autoplay approval.
      await page.evaluate(() => window.__peer.postMessage({ type: 'state', sender: 'peer', roomId: 'integrity-room', index: 0, time: 15, isPlaying: true, ts: Date.now() }))
      await page.waitForFunction(() => { const audio = document.querySelector('[data-testid=root-audio]'); return !audio.paused && audio.currentTime >= 14 })
      await page.locator('.sidebar').getByRole('button', { name: 'Home', exact: true }).click()
      await page.getByRole('button', { name: /Integrity Room/ }).first().click()
      await page.locator('.room-head').waitFor()
      assert.equal(await page.evaluate(() => window.__channelRecords.filter(record => !record.closed && record.name === 'echosync-room-sync').length), 1)
      assert.equal(await page.locator('[data-testid=root-audio]').evaluate((node, previous) => node === previous, audio), true)
      await page.evaluate(() => window.__peer.close())
    })
    await check('Queue drawer lists upcoming rows, reorders and removes without interrupting audio', { trackOverrides: { kesariya: { duration: 360 } } }, async page => {
      await page.addInitScript(() => {
        localStorage.setItem('echosync.likes.v1', JSON.stringify({ integrity: ['kesariya'] }))
        localStorage.setItem('echosync_recent_v1', JSON.stringify({ integrity: ['excuses'] }))
        const library = JSON.parse(localStorage.getItem('echosync.library.v1'))
        library['tajdar'].track.genre = 'Sufi'
        library['kesariya'].track.duration = 360
        localStorage.setItem('echosync.library.v1', JSON.stringify(library))
      })
      await open(page)
      await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
      await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      const original = await page.locator('[data-testid=root-audio]').elementHandle()
      const source = await original.evaluate(audio => audio.currentSrc)
      await page.locator('[data-testid=queue-btn]').click()
      const drawer = page.locator('[data-testid=solo-queue-drawer]')
      const titles = () => drawer.locator('[data-testid=queue-drawer-row] .queue-copy strong').allTextContents()
      const all = await titles()
      assert.ok(all.length > 2)
      // Phase B removed the numbered/filter chrome from the drawer markup.
      assert.equal(await drawer.locator('.queue-filter-chips').count(), 0)
      assert.equal(await drawer.locator('.queue-index').count(), 0)
      await drawer.getByRole('button', { name: 'Shuffle queue', exact: true }).waitFor()
      const movable = all[1]
      await drawer.getByRole('button', { name: `Move ${movable} down`, exact: true }).click()
      assert.equal((await titles())[2], movable)
      await drawer.getByRole('button', { name: `Move ${movable} up`, exact: true }).click()
      assert.deepEqual(await titles(), all)
      await drawer.getByRole('button', { name: `Remove ${movable} from queue`, exact: true }).click()
      assert.ok(!(await titles()).includes(movable))
      assert.match(await drawer.locator('[data-testid=queue-now-playing]').innerText(), /Chaleya/)
      assert.deepEqual(await page.locator('[data-testid=root-audio]').evaluate((audio, previous) => ({ same: audio === previous, paused: audio.paused, source: audio.currentSrc }), original), { same: true, paused: false, source })
    })
    await check('Sleep Timer countdown, Off cancellation and End of track stop before queue advance', {}, async page => {
      await page.clock.install({ time: new Date() })
      await open(page)
      await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
      await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      await page.getByRole('button', { name: 'Open full player', exact: true }).filter({ visible: true }).click()
      const sheet = page.locator('.full-player')
      const timer = sheet.getByRole('combobox', { name: 'Sleep timer' })
      await timer.selectOption('15m')
      await page.clock.fastForward(1000)
      await sheet.getByRole('timer').filter({ hasText: '14:59' }).waitFor()
      await timer.selectOption('off')
      await page.clock.fastForward(15 * 60_000)
      assert.equal(await page.locator('[data-testid=root-audio]').evaluate(audio => audio.paused), false)
      await timer.selectOption('30m')
      await page.clock.fastForward(30 * 60_000)
      await page.getByText('Sleep timer paused playback', { exact: true }).waitFor()
      assert.equal(await page.locator('[data-testid=root-audio]').evaluate(audio => audio.paused), true)
      assert.equal(await timer.inputValue(), 'off')
      await sheet.getByRole('button', { name: 'Play', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      await timer.selectOption('end-of-track')
      const track = await page.locator('[data-testid=audio-root]').getAttribute('data-track-id')
      await page.locator('[data-testid=root-audio]').evaluate(audio => { audio.currentTime = audio.duration - 0.1 })
      await page.waitForFunction(() => document.querySelector('[data-testid=root-audio]').ended)
      await page.waitForFunction(() => document.querySelector('.full-player select[aria-label="Sleep timer"]').value === 'off')
      assert.equal(await page.locator('[data-testid=audio-root]').getAttribute('data-track-id'), track)
      assert.equal(await page.locator('[data-testid=root-audio]').evaluate(audio => audio.paused), true)
    })
    await check('Mobile Back closes top overlay and UI dismissal returns history to its original state', {}, async page => {
      await page.setViewportSize({ width: 390, height: 844 })
      await open(page)
      await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
      await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      const original = await page.locator('[data-testid=root-audio]').elementHandle()
      const url = page.url()
      await page.evaluate(() => history.replaceState({ sentinel: 'original' }, ''))
      for (const viaBack of [true, false, true]) {
        await page.getByRole('button', { name: 'Open full player', exact: true }).filter({ visible: true }).click()
        await page.locator('.full-player').waitFor()
        await page.waitForFunction(() => history.state?.__echoOverlay?.stack.includes('full-player'))
        if (viaBack) await page.goBack()
        else await page.getByRole('button', { name: 'Close full player', exact: true }).click()
        await page.locator('.full-player').waitFor({ state: 'detached' })
        await page.waitForFunction(() => !history.state?.__echoOverlay)
        assert.equal(page.url(), url)
      }
      await page.getByRole('button', { name: 'Open full player', exact: true }).filter({ visible: true }).click()
      await page.locator('.full-player').getByRole('button', { name: 'Add to playlist', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await page.waitForFunction(() => history.state?.__echoOverlay?.stack.length === 2)
      await page.goBack()
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      assert.equal(await page.locator('.full-player').isVisible(), true)
      await page.goBack()
      await page.locator('.full-player').waitFor({ state: 'detached' })
      await page.waitForFunction(() => !history.state?.__echoOverlay)
      // Queue replaces the expanded sheet in the same history layer.
      await page.getByRole('button', { name: 'Open full player', exact: true }).filter({ visible: true }).click()
      await page.locator('.fp-queue-btn').click()
      await page.locator('[data-testid=solo-queue-drawer]').waitFor()
      await page.waitForFunction(() => history.state?.__echoOverlay?.stack.includes('queue'))
      await page.goBack()
      await page.locator('[data-testid=solo-queue-drawer]').waitFor({ state: 'hidden' })
      await page.waitForFunction(() => !history.state?.__echoOverlay)
      assert.deepEqual(await page.evaluate(() => history.state), { sentinel: 'original' })
      assert.equal(page.url(), url)
      assert.deepEqual(await page.locator('[data-testid=root-audio]').evaluate((audio, previous) => ({ same: audio === previous, paused: audio.paused }), original), { same: true, paused: false })
    })
    await check('memoized Home catalog does not execute on Queue, Shuffle or Repeat interactions', {}, async page => {
      await page.addInitScript(() => {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(),
          inject(renderer) { this.renderers.set(1, renderer); return 1 },
          onCommitFiberRoot: (_id, root) => { window.__testFiberRoot = root }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, checkDCE() {} }
      })
      await open(page)
      await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
      await page.waitForFunction(() => document.querySelector('[data-testid=root-audio]').currentTime > 1.5)
      await page.evaluate(() => {
        function find(fiber) {
          if (!fiber) return null
          if (fiber.elementType?.displayName === 'HomeView' || fiber.type?.displayName === 'HomeView' || fiber.type?.name === 'HomeView') return fiber.type.type || fiber.type
          return find(fiber.child) || find(fiber.sibling)
        }
        window.__homeRenderFunction = find(window.__testFiberRoot.current)
      })
      const cdp = await page.context().newCDPSession(page)
      let renders = 0
      try {
        await cdp.send('Debugger.enable')
        const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__homeRenderFunction' })
        assert.equal(result.type, 'function')
        const { breakpointId } = await cdp.send('Debugger.setBreakpointOnFunctionCall', { objectId: result.objectId })
        cdp.on('Debugger.paused', () => { renders++; cdp.send('Debugger.resume').catch(() => {}) })
        await page.locator('[data-testid=queue-btn]').click()
        await page.locator('[data-testid=solo-queue-drawer]').waitFor()
        await page.getByRole('button', { name: 'Close queue', exact: true }).click()
        await page.locator('[data-testid=shuffle-btn]').click()
        await page.locator('[data-testid=repeat-btn]').click()
        await cdp.send('Debugger.removeBreakpoint', { breakpointId })
        assert.equal(renders, 0, 'Home catalog rerendered for unrelated playback UI settings')
      } finally { await cdp.detach() }
    })
    console.log(`Application browser integrity: ${passed} checks passed`)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
