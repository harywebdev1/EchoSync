const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

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
      const badges = [...document.querySelectorAll('.mobile-tab-badge')]
        .filter(element => element.getClientRects().length)
        .map(element => ({ text: element.textContent, fontSize: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height }))
      return { buttons, headerButtons, smallText, badges, scrollWidth: document.documentElement.scrollWidth }
    })
    assert.ok(layout.headerButtons.length >= 2, 'library header actions are missing')
    assert.ok(layout.headerButtons.every((button) => button.right <= 391), 'library header actions are clipped')
    const undersized = layout.buttons.filter((button) => button.width < 36 || button.height < 36)
    assert.deepEqual(undersized, [], `undersized visible controls: ${JSON.stringify(undersized)}`)
    assert.deepEqual(layout.smallText, [], `visible text below 9px: ${JSON.stringify(layout.smallText)}`)
    assert.ok(layout.badges.length > 0 && layout.badges.every(badge => badge.fontSize >= 11 && badge.height >= 20), `unreadable mobile count badge: ${JSON.stringify(layout.badges)}`)
    assert.ok(layout.scrollWidth <= 390, `library overflowed to ${layout.scrollWidth}px`)
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return `no overflow; ${queueMetrics.rows} queue rows; ${layout.buttons.length} touch controls OK; mobile badges ${layout.badges.map(badge => `${badge.fontSize}px/${badge.height}px`).join(', ')}`
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

function summarizeInteractionProfile(windowData, trace, profile, phaseMetrics) {
  const round = value => Math.round(value * 10) / 10
  const overlap = (start, duration, from, to) => Math.max(0, Math.min(start + duration, to) - Math.max(start, from))
  const phases = windowData.phases.map(phase => {
    const tasks = windowData.tasks.filter(task => overlap(task.startTime, task.duration, phase.startTime, phase.endTime))
    return {
      ...phase,
      durationMs: round(phase.endTime - phase.startTime),
      dispatchDelayMs: phase.dispatchTime == null ? null : round(phase.dispatchTime - phase.startTime),
      longTaskCount: tasks.length,
      longTaskOverlapMs: round(tasks.reduce((total, task) => total + overlap(task.startTime, task.duration, phase.startTime, phase.endTime), 0)),
      longestTaskMs: round(Math.max(0, ...tasks.map(task => task.duration))),
      browserMetrics: phaseMetrics[phase.name],
    }
  })
  const events = trace.traceEvents || []
  const traceMark = name => events.find(event => event.name === `echosync:cpu:${name}` && event.cat?.includes('user_timing'))
  const startMark = traceMark('window:start')
  const endMark = traceMark('window:end')
  const mainThread = event => startMark && event.pid === startMark.pid && event.tid === startMark.tid
  const inWindow = event => startMark && endMark && overlap(event.ts, event.dur || 0, startMark.ts, endMark.ts)
  const taskEvents = events.filter(event => mainThread(event) && event.ph === 'X' && /(?:^RunTask$|ThreadControllerImpl::RunTask)/.test(event.name) && inWindow(event))
  const nodeById = new Map(profile.nodes.map(node => [node.id, node]))
  const parentById = new Map(profile.nodes.flatMap(node => (node.children || []).map(id => [id, node.id])))
  const phaseFrames = Object.fromEntries(phases.map(phase => [phase.name, new Map()]))
  const phaseBounds = phases.map(phase => ({ name: phase.name, start: traceMark(`${phase.name}:start`)?.ts, end: traceMark(`${phase.name}:end`)?.ts }))
  const samples = []
  let sampleTime = profile.startTime
  for (let index = 0; index < (profile.samples || []).length; index++) {
    sampleTime += profile.timeDeltas[index]
    samples.push({ time: sampleTime, nodeId: profile.samples[index] })
    const phase = phaseBounds.find(bound => sampleTime >= bound.start && sampleTime <= bound.end)
    if (!phase) continue
    // CPU samples are estimates, not exact function durations. Count both leaf
    // samples and inclusive ancestry so App/React callers remain visible.
    let id = profile.samples[index]
    let leaf = true
    const visited = new Set()
    while (id != null && !visited.has(id)) {
      visited.add(id)
      const frame = nodeById.get(id)?.callFrame
      if (frame) {
        const key = JSON.stringify(frame)
        const entry = phaseFrames[phase.name].get(key) || { ...frame, selfSamples: 0, inclusiveSamples: 0 }
        entry.inclusiveSamples++
        if (leaf) entry.selfSamples++
        phaseFrames[phase.name].set(key, entry)
      }
      leaf = false
      id = parentById.get(id)
    }
  }
  for (const phase of phases) {
    const frames = [...phaseFrames[phase.name].values()]
    phase.topSelfFrames = frames.sort((a, b) => b.selfSamples - a.selfSamples).slice(0, 12)
    phase.topApplicationFrames = frames.filter(frame => /\/src\//.test(frame.url)).sort((a, b) => b.inclusiveSamples - a.inclusiveSamples).slice(0, 12)
  }
  const longestMainThreadTasks = taskEvents.sort((a, b) => b.dur - a.dur).slice(0, 5).map(task => {
    const children = events.filter(event => mainThread(event) && event.ph === 'X' && event !== task && event.ts >= task.ts && event.ts + (event.dur || 0) <= task.ts + task.dur)
    const stacks = new Map()
    for (const sample of samples) {
      if (sample.time < task.ts || sample.time > task.ts + task.dur) continue
      const stack = []
      let id = sample.nodeId
      const visited = new Set()
      while (id != null && !visited.has(id)) {
        visited.add(id)
        const frame = nodeById.get(id)?.callFrame
        stack.push(frame?.functionName || '<anonymous>')
        id = parentById.get(id)
      }
      const key = stack.slice(0, 16).join(' <- ')
      stacks.set(key, (stacks.get(key) || 0) + 1)
    }
    return {
      durationMs: round(task.dur / 1000),
      startTimeMs: round((task.ts - startMark.ts) / 1000),
      phaseOverlaps: phaseBounds.filter(bound => overlap(task.ts, task.dur, bound.start, bound.end)).map(bound => bound.name),
      topSampledStacks: [...stacks].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([stack, sampleCount]) => ({ stack, sampleCount })),
      // Nested spans overlap: these are diagnostic spans, not additive totals.
      longestSpans: children.sort((a, b) => (b.dur || 0) - (a.dur || 0)).slice(0, 12).map(event => ({ name: event.name, durationMs: round((event.dur || 0) / 1000), data: event.args?.data })),
    }
  })
  return {
    environment: { url: APP_URL, fixture: FIXTURE, viewport: '1280x820', cpuThrottling: 4, browser: profile.browserVersion },
    notes: ['Phase elapsed time includes Playwright actionability waits and settling; dispatchDelayMs identifies pre-click delay.', 'Phase overlap is correlation. CPU stacks and nested trace spans are needed for causal attribution.', 'CPU sampling and tracing add overhead. The original 750ms/3500ms budgets are unchanged.'],
    window: { startTime: windowData.startTime, endTime: windowData.endTime },
    phases,
    longTasks: windowData.tasks,
    measures: windowData.measures,
    longestMainThreadTasks,
    scriptTimingSupported: windowData.scriptTimingSupported,
    animationFrames: windowData.animationFrames.filter(frame => overlap(frame.startTime, frame.duration, windowData.startTime, windowData.endTime)),
    metrics: {
      count: windowData.tasks.length,
      total: Math.round(windowData.tasks.reduce((sum, task) => sum + task.duration, 0)),
      max: Math.round(Math.max(0, ...windowData.tasks.map(task => task.duration))),
    },
  }
}

async function performance4x(browser) {
  const { context, page, pageErrors } = await newPage(browser, { width: 1280, height: 820 })
  const cdp = await context.newCDPSession(page)
  let tracing = false
  let profiling = false
  try {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await openApp(page)
    await page.getByRole('button', { name: 'Play Chaleya' }).first().click()
    await waitForPlayback(page, 45000)
    await page.waitForTimeout(1200)
    // *.local is already ignored, and captures survive subsequent Vite builds.
    const outputDir = path.resolve(process.env.ECHOSYNC_PERF_DIR || path.join('performance-results.local', new Date().toISOString().replace(/[:.]/g, '-')))
    fs.mkdirSync(outputDir, { recursive: true })
    await cdp.send('Performance.enable')
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 })
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8.execute,blink.user_timing,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' })
    tracing = true
    await cdp.send('Profiler.start')
    profiling = true
    await page.evaluate(() => {
      const state = window.__cpuProfile = { tasks: [], phases: [], animationFrames: [], current: null }
      state.collectTasks = entries => entries.forEach(entry => state.tasks.push({ startTime: entry.startTime, duration: entry.duration, attribution: entry.attribution?.map(item => ({ name: item.name, containerType: item.containerType })) }))
      state.observer = new PerformanceObserver(list => state.collectTasks(list.getEntries()))
      state.observer.observe({ type: 'longtask' })
      state.scriptTimingSupported = PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
      if (state.scriptTimingSupported) {
        state.collectFrames = entries => entries.forEach(entry => state.animationFrames.push({ startTime: entry.startTime, duration: entry.duration, blockingDuration: entry.blockingDuration, renderStart: entry.renderStart, styleAndLayoutStart: entry.styleAndLayoutStart, scripts: entry.scripts?.map(script => ({ duration: script.duration, executionStart: script.executionStart, forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration, invoker: script.invoker, sourceURL: script.sourceURL, sourceFunctionName: script.sourceFunctionName, sourceCharPosition: script.sourceCharPosition })) }))
        state.frameObserver = new PerformanceObserver(list => state.collectFrames(list.getEntries()))
        state.frameObserver.observe({ type: 'long-animation-frame' })
      }
      state.onClick = event => {
        if (!state.current || !event.target.closest(state.current.selector)) return
        state.current.dispatchTime = performance.now()
        performance.mark(`echosync:cpu:${state.current.name}:dispatch`)
      }
      document.addEventListener('click', state.onClick, true)
      state.startTime = performance.now()
      performance.mark('echosync:cpu:window:start')
    })
    const phaseMetrics = {}
    const metricsSnapshot = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]))
    async function interaction(name, selector, settleMs, ready) {
      const before = await metricsSnapshot()
      await page.evaluate(({ name, selector }) => {
        const state = window.__cpuProfile
        state.current = { name, selector, startTime: performance.now() }
        state.phases.push(state.current)
        performance.mark(`echosync:cpu:${name}:start`)
      }, { name, selector })
      try {
        await page.locator(selector).click()
        await ready()
        await page.waitForTimeout(settleMs)
      } finally {
        await page.evaluate(() => {
          const state = window.__cpuProfile
          state.current.endTime = performance.now()
          performance.mark(`echosync:cpu:${state.current.name}:end`)
          performance.measure(`echosync:cpu:${state.current.name}`, `echosync:cpu:${state.current.name}:start`, `echosync:cpu:${state.current.name}:end`)
          state.current = null
        })
      }
      const after = await metricsSnapshot()
      phaseMetrics[name] = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(key => [key.replace('Duration', 'Ms'), Math.round((after[key] - before[key]) * 10000) / 10]))
    }
    let interactionError
    try {
      await interaction('queue-open', '[data-testid=queue-btn]', 250, () => page.locator('[data-testid=solo-queue-drawer]').waitFor({ state: 'visible' }))
      await interaction('queue-close', '[data-testid=queue-btn]', 150, () => page.locator('[data-testid=solo-queue-drawer]').waitFor({ state: 'hidden' }))
      const shuffleLabel = await page.locator('[data-testid=shuffle-btn]').getAttribute('aria-label') === 'Shuffle: Off' ? 'Shuffle: On' : 'Shuffle: Off'
      const labelReady = (selector, label) => page.waitForFunction(({ selector, label }) => document.querySelector(selector)?.getAttribute('aria-label') === label, { selector, label })
      await interaction('shuffle', '[data-testid=shuffle-btn]', 150, () => labelReady('[data-testid=shuffle-btn]', shuffleLabel))
      const repeatLabel = { 'Repeat: Off': 'Repeat: Queue', 'Repeat: Queue': 'Repeat: Current Track', 'Repeat: Current Track': 'Repeat: Off' }[await page.locator('[data-testid=repeat-btn]').getAttribute('aria-label')]
      await interaction('repeat', '[data-testid=repeat-btn]', 900, () => labelReady('[data-testid=repeat-btn]', repeatLabel))
    } catch (error) {
      interactionError = error
    }
    const windowData = await page.evaluate(() => {
      const state = window.__cpuProfile
      state.endTime = performance.now()
      performance.mark('echosync:cpu:window:end')
      performance.measure('echosync:cpu:window', 'echosync:cpu:window:start', 'echosync:cpu:window:end')
      state.collectTasks(state.observer.takeRecords())
      state.observer.disconnect()
      if (state.frameObserver) {
        state.collectFrames(state.frameObserver.takeRecords())
        state.frameObserver.disconnect()
      }
      document.removeEventListener('click', state.onClick, true)
      return { startTime: state.startTime, endTime: state.endTime, tasks: state.tasks, phases: state.phases, animationFrames: state.animationFrames, scriptTimingSupported: state.scriptTimingSupported, measures: performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('echosync:cpu:')).map(entry => ({ name: entry.name, startTime: entry.startTime, duration: entry.duration })) }
    })
    const { profile } = await cdp.send('Profiler.stop')
    profiling = false
    profile.browserVersion = browser.version()
    const completed = new Promise((resolve, reject) => {
      const done = event => { clearTimeout(timeout); resolve(event) }
      const timeout = setTimeout(() => {
        cdp.off('Tracing.tracingComplete', done)
        reject(new Error('Chromium trace did not finish within 30 seconds'))
      }, 30000)
      cdp.once('Tracing.tracingComplete', done)
    })
    await cdp.send('Tracing.end')
    const { stream } = await completed
    tracing = false
    const chunks = []
    try {
      for (;;) {
        const chunk = await cdp.send('IO.read', { handle: stream })
        chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'))
        if (chunk.eof) break
      }
    } finally {
      await cdp.send('IO.close', { handle: stream })
    }
    const trace = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const report = summarizeInteractionProfile(windowData, trace, profile, phaseMetrics)
    fs.writeFileSync(path.join(outputDir, 'browser-trace.json'), JSON.stringify(trace))
    fs.writeFileSync(path.join(outputDir, 'interaction.cpuprofile'), JSON.stringify(profile))
    fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(report, null, 2))
    console.log('CPU interaction breakdown:', JSON.stringify(report.phases.map(phase => ({ phase: phase.name, elapsedMs: phase.durationMs, dispatchDelayMs: phase.dispatchDelayMs, longTaskOverlapMs: phase.longTaskOverlapMs, longestTaskMs: phase.longestTaskMs, ...phase.browserMetrics })), null, 2))
    console.log('Longest main-thread tasks:', JSON.stringify(report.longestMainThreadTasks, null, 2))
    console.log(`Performance artifacts: ${outputDir}`)
    assert.ok(report.phases.every(phase => phase.dispatchTime != null), 'missing an interaction click-dispatch marker')
    assert.ok(report.longestMainThreadTasks.length && profile.samples?.length, 'missing main-thread trace or CPU samples')
    if (interactionError) throw interactionError
    const metrics = report.metrics
    assert.ok(metrics.max < 750, `longest task ${metrics.max}ms at 4x CPU (limit 750ms)`)
    assert.ok(metrics.total < 3500, `total long-task time ${metrics.total}ms at 4x CPU (limit 3500ms)`)
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`)
    return `${metrics.count} long tasks, ${metrics.total}ms total, ${metrics.max}ms max`
  } finally {
    if (profiling) await cdp.send('Profiler.stop').catch(() => {})
    if (tracing) await cdp.send('Tracing.end').catch(() => {})
    await cdp.detach()
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
