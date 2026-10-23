const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const APP_URL = process.env.ECHOSYNC_URL || 'http://127.0.0.1:5173'
const STATE_PATH = process.env.ECHOSYNC_STATE || 'C:/Users/haryw/AppData/Local/Temp/opencode/p75-state.json'
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'

const { fixtureState, installFixtures } = require('./integrity-fixtures.cjs')
const FIXTURE = process.env.ECHOSYNC_FIXTURE === '1'
const diagnostics = new WeakMap()
const results = []

function intersectionArea(a, b) {
  if (!a || !b) return 0
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return Math.round(width * height)
}

async function openApp(page, reload = false) {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' })
  else await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.locator('.app .stage').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByRole('button', { name: /^Play / }).first().waitFor({ state: 'visible' })
}

async function waitForPlayback(page, timeout = 30000) {
  try {
    await page.waitForFunction(() => {
      const audio = document.querySelector('audio')
      return audio && !audio.paused && audio.currentTime > 1.5
    }, null, { timeout })
  } catch (error) {
    const media = await page.locator('audio').first().evaluate(audio => ({ paused: audio.paused, duration: audio.duration, readyState: audio.readyState, error: audio.error?.code, source: audio.currentSrc.split('?')[0] }))
    const upstream = diagnostics.get(page) || []
    error.message += '\nPlayback diagnostics: ' + JSON.stringify({ media, upstream: upstream.slice(-12) })
    error.category = !FIXTURE && upstream.length ? 'UPSTREAM_OBSERVED_PLAYBACK_UNVERIFIED' : 'APPLICATION'
    throw error
  }
}

async function newPage(browser, viewport, options = {}) {
  const context = await browser.newContext({
    viewport,
    storageState: FIXTURE ? fixtureState() : STATE_PATH,
  })
  if (FIXTURE) await installFixtures(context)
  const page = await context.newPage()
  const upstream = []
  diagnostics.set(page, upstream)
  const provider = url => /\/api\/|saavn|googlevideo|piped|invidious/.test(url)
  page.on('response', response => {
    if (provider(response.url()) && response.status() >= 400) upstream.push({ url: response.url().split('?')[0], status: response.status() })
  })
  page.on('requestfailed', request => {
    if (provider(request.url()) && request.failure()?.errorText !== 'net::ERR_ABORTED') upstream.push({ url: request.url().split('?')[0], error: request.failure()?.errorText })
  })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  if (options.initScript) await page.addInitScript(options.initScript)
  return { context, page, pageErrors }
}

async function runCase(name, fn) {
  if (process.env.ECHOSYNC_CASE && !name.includes(process.env.ECHOSYNC_CASE)) return
  const startedAt = Date.now()
  try {
    const detail = await fn()
    results.push({ name, ok: true, ms: Date.now() - startedAt, detail })
    console.log(`PASS ${name} (${Date.now() - startedAt}ms)`, detail || '')
  } catch (error) {
    results.push({ name, ok: false, category: error.category || 'APPLICATION', ms: Date.now() - startedAt, detail: error.message })
    console.error(`FAIL [${error.category || 'APPLICATION'}] ${name} (${Date.now() - startedAt}ms): ${error.message}`)
  }
}

async function recovery410(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 1280, height: 820 })
  try {
    await openApp(page)
    await page.getByRole('button', { name: 'Play Chaleya' }).first().click()
    await waitForPlayback(page)
    await page.locator('[data-testid=player-dock] .dock-play').click()
    await page.waitForTimeout(200)
    const expiringSource = await page.locator('audio').first().evaluate(audio => audio.currentSrc.split('#')[0])
    let served410 = false
    await page.route('**/aac.saavncdn.com/**', async (route) => {
      if (!served410 && route.request().url() === expiringSource) {
        served410 = true
        return route.fulfill({ status: 410, contentType: 'text/plain', body: 'expired' })
      }
      return route.fallback()
    })
    await page.evaluate(() => {
      const audio = document.querySelector('audio')
      audio.currentTime = 150
      const now = Date.now.bind(Date)
      // Simulate idle time without waiting 46 seconds or altering media APIs.
      Date.now = () => now() + 46000
    })
    await page.waitForTimeout(250)
    const startedAt = Date.now()
    await page.locator('[data-testid=player-dock] .dock-play').click()
    await page.waitForFunction(() => {
      const audio = document.querySelector('audio')
      return audio && !audio.paused && audio.currentTime > 149.5 && audio.readyState >= 3
    }, null, { timeout: 6000, polling: 50 })
    const resumeMs = Date.now() - startedAt
    const audioState = await page.evaluate(() => {
      const audio = document.querySelector('audio')
      return { paused: audio.paused, currentTime: audio.currentTime, error: audio.error?.code || null }
    })
    if (!served410) {
      const error = new Error('Live playback resumed, but no request consumed the injected 410; expired-stream recovery is unverified in this run.')
      error.category = 'TEST_SETUP_FAULT_NOT_EXERCISED'
      throw error
    }
    assert.equal(audioState.paused, false, 'audio did not resume after the 410')
    assert.equal(audioState.error, null, `audio retained media error ${audioState.error}`)
    assert.ok(resumeMs < 3500, `resume took ${resumeMs}ms (limit 3500ms)`)
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return `${resumeMs}ms`
  } finally {
    await context.close()
  }
}

async function abortReconciliation(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 1280, height: 820 }, {
    initScript: () => {
      const originalPlay = HTMLMediaElement.prototype.play
      let rejectNext = false
      window.__failNextPlay = () => { rejectNext = true }
      HTMLMediaElement.prototype.play = function patchedPlay(...args) {
        if (rejectNext) {
          rejectNext = false
          return Promise.reject(new DOMException('The play() request was interrupted', 'AbortError'))
        }
        return originalPlay.apply(this, args)
      }
    },
  })
  try {
    await openApp(page)
    await page.getByRole('button', { name: 'Play Chaleya' }).first().click()
    await waitForPlayback(page)
    await page.locator('[data-testid=player-dock] .dock-play').click()
    await page.waitForTimeout(250)
    await page.evaluate(() => window.__failNextPlay())
    await page.locator('[data-testid=player-dock] .dock-play').click()
    await page.waitForTimeout(2500)
    const state = await page.evaluate(() => {
      const audio = document.querySelector('audio')
      const button = document.querySelector('[data-testid=player-dock] .dock-play')
      return { paused: audio.paused, label: button.getAttribute('aria-label') }
    })
    assert.equal(state.label, state.paused ? 'Play' : 'Pause', `stale control state: audio paused=${state.paused}, button=${state.label}`)
    if (state.paused) {
      await page.locator('[data-testid=player-dock] .dock-play').click()
      await page.waitForFunction(() => {
        const audio = document.querySelector('audio')
        return audio && !audio.paused && audio.currentTime > 0
      }, null, { timeout: 8000 })
    }
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return `reconciled to ${state.label}`
  } finally {
    await context.close()
  }
}

async function controlsAndQueue(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 1440, height: 900 })
  try {
    await openApp(page)
    await page.evaluate(() => localStorage.removeItem('echosync_settings_v1'))
    await openApp(page, true)
    await page.getByRole('button', { name: 'Play Chaleya' }).first().click()
    await waitForPlayback(page)
    const repeat = page.locator('[data-testid=repeat-btn]')
    const shuffle = page.locator('[data-testid=shuffle-btn]')
    assert.equal(await repeat.getAttribute('aria-label'), 'Repeat: Off')
    assert.equal(await shuffle.getAttribute('aria-label'), 'Shuffle: Off')
    await repeat.click()
    assert.equal(await repeat.getAttribute('aria-label'), 'Repeat: Queue')
    await repeat.click()
    assert.equal(await repeat.getAttribute('aria-label'), 'Repeat: Current Track')
    await repeat.click()
    assert.equal(await repeat.getAttribute('aria-label'), 'Repeat: Off')
    await repeat.click()
    await shuffle.click()
    assert.equal(await shuffle.getAttribute('aria-label'), 'Shuffle: On')
    const currentTitle = await page.locator('.dock-copy strong').innerText()
    await page.locator('[data-testid=queue-btn]').click()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('[data-testid=solo-queue-drawer]').isVisible(), true, 'queue drawer did not open')
    assert.ok(await page.locator('[data-testid=queue-drawer-row]').count() > 0, 'queue drawer has no upcoming tracks')
    assert.ok((await page.locator('[data-testid=queue-now-playing]').innerText()).includes(currentTitle), 'queue drawer now-playing track is wrong')
    await openApp(page, true)
    await page.waitForTimeout(500)
    assert.equal(await page.locator('[data-testid=repeat-btn]').getAttribute('aria-label'), 'Repeat: Queue')
    assert.equal(await page.locator('[data-testid=shuffle-btn]').getAttribute('aria-label'), 'Shuffle: On')
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return 'controls, queue, and persistence OK'
  } finally {
    await context.close()
  }
}

async function mobileLayout(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 390, height: 844 })
  try {
    await openApp(page)
    await page.getByRole('button', { name: 'Play Excuses' }).first().click()
    await waitForPlayback(page)
    await page.getByRole('button', { name: 'Open full player', exact: true }).click()
    await page.locator('.fp-queue-btn').click()
    await page.waitForTimeout(350)
    const queueMetrics = await page.evaluate(() => {
      const drawer = document.querySelector('[data-testid=solo-queue-drawer]')
      const box = drawer.getBoundingClientRect()
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        box: { x: box.x, right: box.right, width: box.width, height: box.height },
        rows: document.querySelectorAll('[data-testid=queue-drawer-row]').length,
      }
    })
    assert.ok(queueMetrics.scrollWidth <= 390, `page width overflowed to ${queueMetrics.scrollWidth}px`)
    assert.ok(queueMetrics.box.x >= -1 && queueMetrics.box.right <= 391, 'queue drawer escaped the viewport')
    assert.ok(queueMetrics.rows > 0, 'queue drawer has no rows')
    await page.getByRole('button', { name: 'Close queue' }).click()
    await page.locator('.mini-like:visible').click()
    await page.getByRole('button', { name: /^Library/ }).click()
    await page.waitForTimeout(250)
    await page.getByRole('button', { name: /Liked songs/i }).click()
    await page.waitForTimeout(300)
    const layout = await page.evaluate(() => {
      const inViewport = (box) => box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0 && box.right <= innerWidth + 1
      const buttons = [...document.querySelectorAll('button')]
        .map((element) => {
          const box = element.getBoundingClientRect()
          return { label: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 35), x: box.x, y: box.y, right: box.right, width: box.width, height: box.height, inViewport: inViewport(box) }
        })
        .filter((item) => item.inViewport)
      const headerButtons = [...document.querySelectorAll('.library-head-actions button')].map((element) => {
        const box = element.getBoundingClientRect()
        return { label: (element.textContent || '').trim(), right: box.right, width: box.width, height: box.height }
      })
      const smallText = [...document.querySelectorAll('body *')]
        .filter((element) => {
          if (!element.getClientRects().length || !(element.textContent || '').trim()) return false
          const box = element.getBoundingClientRect()
          return box.width > 0 && box.x >= 0 && box.right <= innerWidth && parseFloat(getComputedStyle(element).fontSize) < 9
        })
        .slice(0, 10)
        .map((element) => ({ text: (element.textContent || '').trim().slice(0, 25), size: getComputedStyle(element).fontSize }))
      return { buttons, headerButtons, smallText, scrollWidth: document.documentElement.scrollWidth }
    })
    assert.ok(layout.headerButtons.length >= 2, 'library header actions are missing')
    assert.ok(layout.headerButtons.every((button) => button.right <= 391), 'library header actions are clipped')
    const undersized = layout.buttons.filter((button) => button.width < 36 || button.height < 36)
    assert.deepEqual(undersized, [], `undersized visible controls: ${JSON.stringify(undersized)}`)
    assert.deepEqual(layout.smallText, [], `visible text below 9px: ${JSON.stringify(layout.smallText)}`)
    assert.ok(layout.scrollWidth <= 390, `library overflowed to ${layout.scrollWidth}px`)
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return `no overflow; ${queueMetrics.rows} queue rows; ${layout.buttons.length} touch controls OK`
  } finally {
    await context.close()
  }
}

async function tabletLayout(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 1024, height: 768 })
  try {
    await openApp(page)
    await page.getByRole('button', { name: 'Play Chaleya' }).first().click()
    await waitForPlayback(page)
    await page.locator('[data-testid=queue-btn]').click()
    await page.waitForTimeout(400)
    const dockBox = await page.locator('[data-testid=player-dock]').boundingBox()
    const socialBox = await page.locator('.social').boundingBox()
    const drawerBox = await page.locator('[data-testid=solo-queue-drawer]').boundingBox()
    assert.equal(await page.locator('[data-testid=solo-queue-drawer]').isVisible(), true, 'queue drawer did not open at 1024px')
    assert.equal(intersectionArea(dockBox, socialBox), 0, 'dock overlaps the social drawer at 1024px')
    assert.equal(intersectionArea(dockBox, drawerBox), 0, 'dock overlaps the queue drawer at 1024px')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1024, 'page overflows at 1024px')
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return 'dock and drawer are separated'
  } finally {
    await context.close()
  }
}

async function performance4x(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 1280, height: 820 })
  try {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await openApp(page)
    await page.getByRole('button', { name: 'Play Chaleya' }).first().click()
    await waitForPlayback(page, 45000)
    await page.waitForTimeout(1200)
    await page.evaluate(() => {
      window.__longTasks = []
      window.__longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => window.__longTasks.push({ duration: entry.duration }))
      })
      window.__longTaskObserver.observe({ entryTypes: ['longtask'] })
    })
    await page.locator('[data-testid=queue-btn]').click()
    await page.waitForTimeout(250)
    await page.locator('[data-testid=queue-btn]').click()
    await page.waitForTimeout(150)
    await page.locator('[data-testid=shuffle-btn]').click()
    await page.waitForTimeout(150)
    await page.locator('[data-testid=repeat-btn]').click()
    await page.waitForTimeout(900)
    const metrics = await page.evaluate(() => {
      const entries = window.__longTasks || []
      return {
        count: entries.length,
        total: Math.round(entries.reduce((sum, entry) => sum + entry.duration, 0)),
        max: Math.round(Math.max(0, ...entries.map((entry) => entry.duration))),
      }
    })
    assert.ok(metrics.max < 750, `longest task ${metrics.max}ms at 4x CPU (limit 750ms)`)
    assert.ok(metrics.total < 3500, `total long-task time ${metrics.total}ms at 4x CPU (limit 3500ms)`)
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return `${metrics.count} long tasks, ${metrics.total}ms total, ${metrics.max}ms max`
  } finally {
    await context.close()
  }
}

async function modalAccessibility(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 1280, height: 820 })
  try {
    await openApp(page)
    await page.getByRole('button', { name: /^Your library/ }).click()
    await page.waitForTimeout(250)
    const trigger = page.getByRole('button', { name: /New playlist/i }).first()
    await trigger.focus()
    await trigger.click()
    await page.waitForTimeout(250)
    const dialog = page.locator('[role=dialog]')
    assert.equal(await dialog.count(), 1, 'modal dialog did not open')
    const labelledBy = await dialog.getAttribute('aria-labelledby')
    assert.ok(labelledBy, 'dialog has no aria-labelledby')
    const labelText = (await page.locator(`#${labelledBy}`).innerText()).trim()
    assert.ok(labelText.length > 0, 'dialog label is empty')
    assert.equal(await page.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement)), true, 'focus did not enter the dialog')
    for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement)), true, 'focus escaped the dialog')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    assert.equal(await page.locator('[role=dialog]').count(), 0, 'Escape did not close the dialog')
    const restored = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: (document.activeElement?.textContent || '').trim() }))
    assert.equal(restored.tag, 'BUTTON', 'focus was not restored to a button')
    assert.match(restored.text, /New playlist/i, 'focus was not restored to the opener')
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return `dialog labelled "${labelText}"; focus trapped and restored`
  } finally {
    await context.close()
  }
}

;(async () => {
  if (!fs.existsSync(CHROME_PATH)) throw new Error(`Chromium not found at ${CHROME_PATH}`)
  if (!FIXTURE && !fs.existsSync(STATE_PATH)) throw new Error(`Storage state not found at ${STATE_PATH}`)
  console.log(FIXTURE ? 'APPLICATION VERIFICATION: controlled provider fixtures' : 'LIVE PROVIDER VERIFICATION: network-dependent')
  const response = await fetch(APP_URL)
  assert.equal(response.ok, true, `app returned HTTP ${response.status}`)
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH })
  try {
    await runCase('410 idle resume under 3.5s', () => recovery410(browser))
    await runCase('AbortError playback reconciliation', () => abortReconciliation(browser))
    await runCase('repeat/shuffle controls, queue drawer, persistence', () => controlsAndQueue(browser))
    await runCase('390px layout, clipping, queue, touch targets, typography', () => mobileLayout(browser))
    await runCase('1024px dock and drawer overlap', () => tabletLayout(browser))
    await runCase('4x CPU long-task budget', () => performance4x(browser))
    await runCase('modal Escape, focus trap, focus restore, label', () => modalAccessibility(browser))
  } finally {
    await browser.close()
  }
  const failed = results.filter((result) => !result.ok)
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2))
  if (failed.length) process.exitCode = 1
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
