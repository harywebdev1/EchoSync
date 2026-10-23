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
    console.log(`Application browser integrity: ${passed} checks passed`)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
