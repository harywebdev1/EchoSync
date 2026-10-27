// Phase B acceptance suite: high-recall search, canonical-stem deduplication,
// invisible taste learning, clean Up Next rows, and the four-tab Settings modal.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { fixtureState, wav } = require('./integrity-fixtures.cjs')

const APP_URL = process.env.ECHOSYNC_URL || 'http://127.0.0.1:5173'
const OUT = process.env.ECHOSYNC_UI_DIR || 'performance-results.local/phase-b'
const CHROME = process.env.CHROME_PATH || 'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const LIVE_QUERIES = new Set(['Atif Aslam', 'Arz Kiya Hai', 'Gehra Hua', 'Pasoori'])
fs.mkdirSync(OUT, { recursive: true })

let stemModule
async function stemOf(track) {
  stemModule ||= await import('./src/core/songStem.js')
  return stemModule.getCanonicalSongStem(track)
}
async function uniqueStems(titles) {
  return Promise.all(titles.map((title) => stemOf({ title })))
}

function guestState() {
  const state = fixtureState({})
  state.origins[0].localStorage = state.origins[0].localStorage.filter(
    (entry) => !/remember_user_id|active_user/.test(entry.name),
  )
  return state
}

function signedInState() {
  const state = fixtureState({})
  state.origins[0].localStorage.push({
    name: 'echosync_recent_v1',
    value: JSON.stringify({ integrity: ['chaleya', 'excuses'] }),
  })
  return state
}

async function installRoutes(context) {
  await context.addInitScript(() => { window.__ECHOSYNC_SUPABASE__ ||= { url: '', key: '' } })
  const audio = new Map()
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'aac.saavncdn.com') {
      const seconds = Number(url.searchParams.get('seconds')) || 180
      if (!audio.has(seconds)) audio.set(seconds, wav(seconds))
      const body = audio.get(seconds)
      const range = request.headers().range?.match(/bytes=(\d+)-(\d*)/)
      const start = range ? Number(range[1]) : 0
      const end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1
      return route.fulfill({
        status: range ? 206 : 200,
        contentType: 'audio/wav',
        headers: {
          'accept-ranges': 'bytes',
          'access-control-allow-origin': '*',
          'cache-control': 'no-store',
          ...(range ? { 'content-range': `bytes ${start}-${end}/${body.length}` } : {}),
        },
        body: body.subarray(start, end + 1),
      })
    }
    if (url.origin === APP_URL) {
      if (url.pathname.startsWith('/api/saavn')) {
        const query = url.searchParams.get('query') || ''
        // Only the four acceptance queries reach the real server. Home mood
        // queries stay deterministic and fast.
        if (LIVE_QUERIES.has(query)) return route.continue()
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { results: [] } }) })
      }
      if (!url.pathname.startsWith('/api/')) return route.continue()
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { results: [] }, results: [] }) })
    }
    if (request.resourceType() === 'image') {
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#426"/></svg>' })
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { results: [] }, results: [] }) })
  })
}

async function openContext(browser, width, height, guest) {
  const context = await browser.newContext({
    viewport: { width, height },
    storageState: guest ? guestState() : signedInState(),
  })
  await installRoutes(context)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="home-v2"]').waitFor()
  await page.locator('.quick-grid').waitFor()
  return { context, page, errors }
}

async function openSearch(page) {
  await page.locator('#canonical-search-input').click()
  await page.locator('#search-command-surface').waitFor()
}

async function closeSearch(page) {
  if (await page.locator('#search-command-surface').count()) {
    await page.keyboard.press('Escape')
    await page.locator('#search-command-surface').waitFor({ state: 'detached' }).catch(() => {})
  }
}

async function assertNoTasteUi(page, label) {
  const text = await page.locator('body').innerText()
  assert.doesNotMatch(text, /Tune taste|Tune your taste|Refine taste|Taste profile/i, `${label}: manual taste controls must be gone`)
}

async function waitForSearch(page, query) {
  const input = page.locator('#canonical-search-input')
  await input.fill('')
  await input.fill(query)
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForFunction(() => {
      const surface = document.querySelector('#search-command-surface')
      if (!surface) return false
      return surface.querySelectorAll('.search-result').length >= 15
        || surface.querySelector('.no-results')
        || surface.querySelector('.search-recovery')
    }, null, { timeout: 45000 }).catch(() => {})
    const count = await page.locator('.search-result').count()
    if (count >= 15) return
    const retry = page.getByRole('button', { name: /Retry search/ })
    if (await retry.count()) {
      await retry.click()
      await page.waitForTimeout(400)
    } else {
      await page.waitForTimeout(700)
    }
  }
}

async function verifySearch(page, query) {
  await waitForSearch(page, query)
  const rows = await page.locator('.search-result').evaluateAll((nodes) => nodes.map((node) => ({
    id: node.getAttribute('data-track-id'),
    title: node.querySelector('.search-copy strong')?.textContent?.trim() || '',
  })))
  assert.ok(rows.length >= 15, `${query}: expected at least 15 results, saw ${rows.length}`)
  assert.equal(rows.some((row) => !row.id), false, `${query}: every result needs a track id`)
  const stems = await uniqueStems(rows.map((row) => row.title))
  assert.equal(new Set(stems).size, stems.length, `${query}: duplicate canonical stems in results`)

  const geometry = await page.evaluate(() => {
    const surface = document.querySelector('#search-command-surface')
    const results = surface.querySelector('.search-results')
    const dock = document.querySelector('[data-testid="player-dock"]')
    const bar = document.querySelector('.mobile-bottom-bar')
    const dockVisible = dock && getComputedStyle(dock).display !== 'none'
    const barVisible = bar && getComputedStyle(bar).display !== 'none'
    return {
      surfaceBottom: surface.getBoundingClientRect().bottom,
      dockTop: dockVisible ? dock.getBoundingClientRect().top : null,
      barTop: barVisible ? bar.getBoundingClientRect().top : null,
      overflowY: getComputedStyle(results).overflowY,
      scrollHeight: results.scrollHeight,
      clientHeight: results.clientHeight,
      authoredMaxHeight: [...document.styleSheets].flatMap((sheet) => {
        try { return [...sheet.cssRules] } catch { return [] }
      }).filter((rule) => rule.selectorText === '.search-command-surface.search-modal')
        .map((rule) => rule.style.maxHeight).filter(Boolean),
    }
  })
  assert.ok(geometry.authoredMaxHeight.some((value) => /100vh\s*-\s*168px/.test(value)), `${query}: desktop max-height calc(100vh - 168px) must be authored`)
  assert.ok(['auto', 'scroll'].includes(geometry.overflowY), `${query}: results must scroll internally, saw ${geometry.overflowY}`)
  assert.ok(geometry.scrollHeight > geometry.clientHeight, `${query}: long result list must actually scroll internally`)
  if (geometry.dockTop !== null) assert.ok(geometry.surfaceBottom <= geometry.dockTop + 1, `${query}: search overlaps Player Dock (${geometry.surfaceBottom} > ${geometry.dockTop})`)
  if (geometry.barTop !== null) assert.ok(geometry.surfaceBottom <= geometry.barTop + 1, `${query}: search overlaps mobile bottom bar (${geometry.surfaceBottom} > ${geometry.barTop})`)
  await assertNoTasteUi(page, `${query} search`)

  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await page.screenshot({ animations: 'disabled', path: `${OUT}/search-${slug}-${page.viewportSize().width}.png` })
  console.log(`PASS ${page.viewportSize().width}px search "${query}": ${rows.length} results, ${new Set(stems).size} unique stems, scrolls internally, clears the dock`)
  return rows
}

async function verifyGuestSearch(browser, width, height) {
  const { context, page, errors } = await openContext(browser, width, height, true)
  await openSearch(page)
  await verifySearch(page, 'Atif Aslam')
  await page.locator('.search-result .search-play').first().click()
  await page.locator('.modal-auth').waitFor()
  await page.getByRole('button', { name: 'Close sign in', exact: true }).click()
  await page.locator('.modal-auth').waitFor({ state: 'detached' })
  await page.keyboard.press('Escape')
  console.log(`PASS ${width}px search guest gate: result click opens AuthModal instead of playing`)

  await page.locator('.quick-main').first().click()
  await page.locator('.modal-auth').waitFor()
  const paused = await page.locator('[data-testid="root-audio"]').evaluate((audio) => audio.paused)
  assert.equal(paused, true)
  await page.getByRole('button', { name: 'Close sign in', exact: true }).click()
  console.log(`PASS ${width}px quick-pick guest gate: opens AuthModal and never starts audio`)

  await page.screenshot({ animations: 'disabled', path: `${OUT}/guest-${width}.png` })
  assert.deepEqual(errors, [])
  await context.close()
}

async function verifyQuickPicks(page, width) {
  const cards = page.locator('.quick-card')
  assert.equal(await cards.count(), 12, 'Quick picks must render twelve cards')
  const titles = await page.locator('.quick-card .quick-copy strong').allTextContents()
  const stems = await uniqueStems(titles)
  assert.equal(new Set(stems).size, 12, 'Quick picks must contain twelve distinct canonical stems')

  await page.locator('.quick-main').first().click()
  await page.waitForFunction(() => {
    const audio = document.querySelector('[data-testid="root-audio"]')
    return audio && !audio.paused
  }, null, { timeout: 25000 })
  assert.equal(await page.locator('.quick-card').first().evaluate((node) => node.querySelector('.quick-copy strong')?.textContent || ''), titles[0])
  console.log(`PASS ${width}px Quick picks: 12 distinct stems and the first pick starts playback`)

  await page.locator('.quick-like').first().click()
  await page.waitForFunction(() => {
    const stored = JSON.parse(localStorage.getItem('echosync_taste_profile_v1') || '{}')
    const profile = stored.integrity
    return profile && profile.events > 0 && Object.keys(profile.artists || {}).length > 0
  }, null, { timeout: 10000 })

  const taste = await page.evaluate(() => JSON.parse(localStorage.getItem('echosync_taste_profile_v1') || '{}').integrity || {})
  const artists = Object.values(taste.artists || {})
  assert.ok(taste.events >= 2, 'play and like must both be learned silently')
  assert.ok(artists.some((entry) => Number(entry?.weight) >= 6), 'like must add artist weight')
  assert.ok(Object.keys(taste.keywords || {}).length >= 1, 'searches must feed the keyword taste dimension')
  await assertNoTasteUi(page, 'taste learning')
  console.log(`PASS ${width}px taste learning: ${taste.events} silent events, ${Object.keys(taste.artists).length} artists, ${Object.keys(taste.keywords).length} keywords`)
  return titles[0]
}

async function openQueue(page, width) {
  if (width > 880) {
    await page.locator('.dock-queue').click()
  } else {
    await page.locator('.mobile-mini .mini-art').click()
    await page.locator('.fp-queue-btn').waitFor()
    await page.locator('.fp-queue-btn').click()
  }
  await page.locator('[data-testid="solo-queue-drawer"]').waitFor({ state: 'visible' })
}

async function verifyQueue(page, width) {
  await openQueue(page, width)
  const drawer = page.locator('[data-testid="solo-queue-drawer"]')
  assert.equal(await drawer.locator('.queue-filter-chips').count(), 0, 'Up Next filter chips must be removed')
  assert.equal(await drawer.locator('.queue-index').count(), 0, 'Up Next row numbers must be removed')
  assert.equal(await drawer.locator('.queue-drawer-row').count() > 0, true, 'Up Next needs queue rows')

  const rows = await drawer.locator('.queue-drawer-row').evaluateAll((nodes) => nodes.map((node) => ({
    title: node.querySelector('.queue-copy strong')?.textContent?.trim() || '',
    border: getComputedStyle(node).borderTopWidth,
    width: node.querySelector('.cover')?.getBoundingClientRect().width || 0,
    height: node.querySelector('.cover')?.getBoundingClientRect().height || 0,
    copy: node.innerText,
  })))
  rows.forEach((row) => {
    assert.equal(row.border, '0px', 'Up Next rows must be borderless')
    assert.ok(Math.abs(row.width - 44) <= 1 && Math.abs(row.height - 44) <= 1, `Up Next art must be 44x44, saw ${row.width}x${row.height}`)
    assert.doesNotMatch(row.copy, /^\s*\d{2}\s/m, 'Up Next rows must not show 02/03 numbering')
  })
  const stems = await uniqueStems(rows.map((row) => row.title))
  assert.equal(new Set(stems).size, stems.length, 'Up Next must not contain duplicate canonical stems')
  console.log(`PASS ${width}px Up Next: ${rows.length} borderless rows, 44x44 art, no chips/numbers, ${new Set(stems).size} unique stems`)
  await drawer.getByRole('button', { name: 'Close queue' }).click()
}

async function openSettings(page, width) {
  if (width > 880) await page.locator('.sidebar .profile').click()
  else await page.locator('.account-mobile').click()
  await page.locator('.settings-layout').waitFor()
}

async function verifySettings(page, width) {
  await openSettings(page, width)
  const nav = page.locator('.settings-nav')
  const tabs = await nav.locator('button:not(.signout-btn)').allTextContents()
  assert.deepEqual(tabs.map((tab) => tab.trim()), ['Profile', 'Audio & playback', 'Social & privacy', 'Storage & cache'])
  assert.equal(await nav.locator('.signout-btn').count(), 1, 'Exactly one Sign out button')
  assert.equal(await page.locator('.settings-body .signout-btn').count(), 0, 'Sign out must live outside the tab body')
  assert.equal(await page.locator('.settings-body').getByText('Sign out', { exact: true }).count(), 0, 'Storage tab must not contain Sign out')
  console.log(`PASS ${width}px Settings: exactly four tabs and a single nav-level Sign out`)

  // Profile
  const profile = page.locator('.settings-profile-form')
  await profile.waitFor()
  assert.equal(await page.locator('.avatar-swatch').count(), 6, 'Profile must expose six avatar swatches')
  assert.equal(await profile.locator('input[type="email"]').count(), 1, 'Profile needs an email field')
  assert.equal(await profile.locator('input[autocomplete="current-password"]').count(), 1, 'Profile needs a current password field')
  assert.equal(await profile.locator('input[autocomplete="new-password"]').count(), 1, 'Profile needs a new password field')
  const margins = await page.locator('.profile-save-row').evaluate((node) => {
    const style = getComputedStyle(node)
    return { top: style.marginTop, bottom: style.marginBottom }
  })
  assert.equal(margins.top, '20px')
  assert.equal(margins.bottom, '8px')

  await profile.locator('.field', { hasText: 'Display name' }).locator('input').fill('Integrity Tuned')
  await profile.locator('.field', { hasText: 'Bio / status' }).locator('textarea').fill('Phase B listener')
  await page.locator('.avatar-swatch').nth(3).click()
  await page.getByRole('button', { name: 'Save profile' }).click()
  await page.getByText('✓ Profile saved').waitFor()
  const savedUser = await page.evaluate(() => JSON.parse(localStorage.getItem('echosync_users_db') || '{}').integrity || {})
  assert.equal(savedUser.name, 'Integrity Tuned')
  assert.equal(savedUser.bio, 'Phase B listener')
  assert.ok(savedUser.avatarId, 'Avatar selection must persist')
  assert.equal(await page.locator('.profile-save-row .settings-saved').innerText(), '✓ Profile saved')
  await page.screenshot({ animations: 'disabled', path: `${OUT}/settings-profile-${width}.png` })
  console.log(`PASS ${width}px Settings profile: fields, six swatches, 20px/8px save row, local save confirmation`)

  // Audio
  await nav.getByRole('button', { name: 'Audio & playback' }).click()
  const audioBody = page.locator('.settings-body')
  const audioText = await audioBody.innerText()
  assert.doesNotMatch(audioText, /Crossfade|Gapless|Volume normali[sz]ation|mic ducking/i)
  const options = await audioBody.locator('select').evaluate((select) => [...select.options].map((option) => ({ value: option.value, text: option.textContent.trim() })))
  assert.deepEqual(options, [
    { value: 'high', text: '320 kbps — High' },
    { value: 'normal', text: '160 kbps — Normal' },
  ])
  const autoplay = page.getByRole('button', { name: 'Toggle autoplay' })
  assert.equal(await autoplay.getAttribute('aria-pressed'), 'true')
  assert.match(await audioBody.innerText(), /Default volume · 82%/i)
  await page.getByRole('button', { name: 'Toggle autoplay' }).click()
  assert.equal(await autoplay.getAttribute('aria-pressed'), 'false')
  await audioBody.locator('select').selectOption('normal')
  const slider = page.getByLabel('Default volume')
  await slider.evaluate((input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '55')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('default volume · 55%'))
  await page.waitForFunction(() => {
    const audio = document.querySelector('[data-testid="root-audio"]')
    return audio && Math.abs(audio.volume - 0.55) <= 0.02
  }, null, { timeout: 5000 })
  const liveVolume = await page.locator('[data-testid="root-audio"]').evaluate((audio) => audio.volume)
  assert.ok(Math.abs(liveVolume - 0.55) <= 0.02, `slider must drive live volume, saw ${liveVolume}`)
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await page.getByText('✓ Audio saved').waitFor()
  const audioSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('echosync_settings_v1') || '{}').integrity || {})
  assert.equal(audioSettings.quality, 'normal')
  assert.equal(audioSettings.autoplay, false)
  assert.ok(Math.abs(Number(audioSettings.defaultVolume) - 0.55) <= 0.01)
  console.log(`PASS ${width}px Settings audio: no removed controls, 320/160 options, autoplay, 55% live default volume`)

  // Social
  await nav.getByRole('button', { name: 'Social & privacy' }).click()
  const toggles = page.locator('.settings-body .setting-toggle-row .toggle-pill')
  assert.equal(await toggles.count(), 4, 'Social tab must expose four privacy toggles')
  assert.equal(await page.getByRole('button', { name: 'Toggle public playlists by default' }).getAttribute('aria-pressed'), 'true')
  const autoTranslate = page.getByRole('button', { name: 'Toggle auto-translate lyrics' })
  assert.equal(await autoTranslate.getAttribute('aria-pressed'), 'false')
  await autoTranslate.click()
  assert.equal(await autoTranslate.getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: 'Toggle public playlists by default' }).click()
  await page.getByRole('button', { name: 'Save privacy' }).click()
  await page.getByText('✓ Privacy saved').waitFor()
  await page.waitForFunction(() => localStorage.getItem('echosync_translate.v1') === 'true')
  const socialSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('echosync_settings_v1') || '{}').integrity || {})
  assert.equal(socialSettings.autoTranslate, true)
  assert.equal(socialSettings.defaultPlaylistPublic, false)
  console.log(`PASS ${width}px Settings social: activity, invites, public playlists, auto-translate drives lyrics state`)

  // Storage
  await nav.getByRole('button', { name: 'Storage & cache' }).click()
  const cells = page.locator('.settings-body .cache-grid > div')
  assert.equal(await cells.count(), 3)
  assert.match(await cells.nth(0).innerText(), /Total cache size/)
  assert.match(await cells.nth(0).locator('strong').innerText(), /B|KB|MB/)
  const historyBefore = Number(await cells.nth(2).locator('strong').innerText())
  assert.ok(historyBefore >= 1, `listening history should be populated, saw ${historyBefore}`)

  await page.getByRole('button', { name: 'Clear stream & lyrics cache' }).click()
  await page.locator('.toast').getByText('Stream, lyric, and translation caches cleared').waitFor()
  await page.getByRole('button', { name: 'Clear listening history' }).click()
  await page.locator('.toast').getByText('Listening history cleared').waitFor()
  await page.waitForFunction(() => {
    const cells = document.querySelectorAll('.settings-body .cache-grid > div')
    return cells[2] && cells[2].querySelector('strong')?.textContent.trim() === '0'
  })
  console.log(`PASS ${width}px Settings storage: live cache size, stream count, history ${historyBefore}→0, both clear actions`)

  await page.screenshot({ animations: 'disabled', path: `${OUT}/settings-${width}.png` })
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.locator('.settings-layout').waitFor({ state: 'detached' }).catch(() => {})
}

async function verifySignedIn(browser, width, height) {
  const { context, page, errors } = await openContext(browser, width, height, false)
  await assertNoTasteUi(page, 'home')

  await openSearch(page)
  for (const query of LIVE_QUERIES) await verifySearch(page, query)
  await closeSearch(page)

  await verifyQuickPicks(page, width)
  await verifyQueue(page, width)
  await verifySettings(page, width)
  await assertNoTasteUi(page, 'after settings')

  await page.screenshot({ animations: 'disabled', path: `${OUT}/home-${width}.png` })
  assert.deepEqual(errors, [])
  await context.close()
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  try {
    const sizes = process.env.PHASE_B_SIZE
      ? [process.env.PHASE_B_SIZE.split('x').map(Number)]
      : [[1440, 900], [390, 844]]
    for (const [width, height] of sizes) {
      if (!process.env.PHASE_B_SKIP_GUEST) await verifyGuestSearch(browser, width, height)
      await verifySignedIn(browser, width, height)
    }
  } finally {
    await browser.close()
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
