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
      })
    }
    console.log(`Application browser integrity: ${passed} checks passed`)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
