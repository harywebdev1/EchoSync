const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { fixtureState, installFixtures } = require('./integrity-fixtures.cjs')
const URL = process.env.ECHOSYNC_URL || 'http://127.0.0.1:5173'
const OUT = process.env.ECHOSYNC_UI_DIR || 'performance-results.local/phase8.1/dev'
const CHROME = process.env.CHROME_PATH || 'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
fs.mkdirSync(OUT, { recursive: true })

function state() {
  const s = fixtureState({})
  const storage = s.origins[0].localStorage
  const library = JSON.parse(storage.find(x => x.name === 'echosync.library.v1').value)
  const seeds = Object.values(library).map(x => x.track)
  // A larger deterministic catalog exercises all 12 picks and 15 upcoming radio entries.
  const more = seeds.concat(seeds.map((x, i) => ({ ...x, id: `radio-${i}`, title: `Evening ${x.title}`, genre: i % 2 ? 'Sufi acoustic' : 'Workout dance', artist: i % 2 ? 'Atif Aslam' : x.artist })))
  storage.find(x => x.name === 'echosync.library.v1').value = JSON.stringify(Object.fromEntries(more.map(track => [track.id, { savedAt: Date.now(), track }])))
  const daily = storage.find(x => x.name.startsWith('echosync_daily_feed_v3_'))
  const data = JSON.parse(daily.value); data.trending = more; data.users.integrity.madeForYou = more; data.users.integrity.basedOnRecent = more; daily.value = JSON.stringify(data)
  return s
}
async function audit(page, name) {
  const result = await page.evaluate(() => {
    const small = [...document.querySelectorAll('.app *')].filter(el => {
      if (!el.getClientRects().length || ![...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) return false
      const style = getComputedStyle(el), rect = el.getBoundingClientRect()
      if (style.visibility === 'hidden' || style.display === 'none' || !rect.width || !rect.height || el.closest('[aria-hidden=true]')) return false
      const badge = /badge|unread|nav-count|queue-index/.test(el.className || '') && /^\d+[+]?$/ .test(el.textContent.trim())
      return parseFloat(style.fontSize) < (badge ? 11 : 12)
    }).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.trim().slice(0, 70), size: getComputedStyle(el).fontSize }))
    return { small, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, appOverflow: document.querySelector('.app').scrollWidth > document.querySelector('.app').clientWidth }
  })
  assert.deepEqual(result.small, [], `${name}: undersized visible text ${JSON.stringify(result.small)}`)
  assert.equal(result.overflow || result.appOverflow, false, `${name}: document overflow`)
  console.log(`PASS ${name}: typography >=12px (numeric badges >=11px), no page overflow`)
}


async function verifyFirstClickRecovery(browser) {
  for (const mode of ['expired', 'abort']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: state() })
    await installFixtures(context)
    const page = await context.newPage(); let navigations = 0, detailRequests = 0
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++ })
    const song = fresh => ({ id: 'recover', name: 'Recovery Song', primaryArtists: 'Test Artist', duration: 180, downloadUrl: [{ quality: '320kbps', url: 'https://aac.saavncdn.com/integrity/recover.wav?seconds=180&' + (fresh ? 'fresh=1' : 'expired=1') }] })
    await page.route('**/api/saavn/api/search/songs?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { results: [song(mode === 'abort')] } }) }))
    await page.route('**/api/saavn/api/songs/recover', route => { detailRequests++; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [song(true)] }) }) })
    await page.route('**/*expired=1', route => route.fulfill({ status: 410, body: 'expired signed stream' }))
    await page.addInitScript(() => {
      window.__audioTrace = []
      for (const method of ['play', 'pause']) {
        const original = HTMLMediaElement.prototype[method]
        HTMLMediaElement.prototype[method] = function(...args) {
          if (this.dataset.testid === 'root-audio') window.__audioTrace.push({ method, src: this.src, stack: new Error().stack })
          return original.apply(this, args)
        }
      }
    })
    if (mode === 'abort') await page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function(...args) {
        if (this.dataset.testid === 'root-audio' && !window.__abortedOnce) { window.__abortedOnce = true; return Promise.reject(new DOMException('interrupted probe', 'AbortError')) }
        return play.apply(this, args)
      }
    })
    await page.goto(URL, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play Recovery Song', exact: true }).first().waitFor()
    await page.getByRole('button', { name: 'Play Recovery Song', exact: true }).first().click()
    await page.waitForFunction(() => { const audio = document.querySelector('[data-testid=root-audio]'); return audio && !audio.paused && audio.currentTime > .1 && audio.duration >= 60 }, null, { timeout: 20000 }).catch(async error => {
      console.error('RECOVERY DIAGNOSTIC', mode, detailRequests, await page.evaluate(() => ({ audio: [...document.querySelectorAll('audio')].map(a => ({ source: a.src, paused: a.paused, error: a.error?.message, ready: a.readyState })), trace: window.__audioTrace, toast: document.querySelector('.toast')?.textContent }))); throw error
    })
    assert.equal(navigations, 1)
    assert.deepEqual(pageErrors, [])
    if (mode === 'expired') { assert.ok(detailRequests > 0); assert.match(await page.getByTestId('root-audio').getAttribute('src'), /fresh=1/) }
    else assert.equal(await page.evaluate(() => window.__abortedOnce), true)
    console.log('PASS first-click ' + mode + ': same-click recovery starts verified full-length audio without reload')
    await context.close()
  }
}

async function verifyPart1A(browser) {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, storageState: state() })
    await installFixtures(context)
    const page = await context.newPage(), queries = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    const poster = color => '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="' + color + '"/><circle cx="210" cy="90" r="55" fill="#f5d8aa"/><path d="M0 260L140 110L300 300Z" fill="#202b48"/></svg>'
    await page.route('**/fixture-*.jpg', route => route.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: poster(route.request().url().includes('blue') ? '#2679d7' : '#df6332') }))
    await page.route('**/api/media?*', route => route.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: poster(route.request().url().includes('blue') ? '#2679d7' : '#df6332') }))
    await page.route('**/api/saavn/api/search/songs?*', async route => {
      const url = new global.URL(route.request().url()), query = url.searchParams.get('query'); queries.push(query)
      const mood = /workout|gym|tempo/.test(query) ? 'Workout' : /acoustic|ballad|unplugged/.test(query) ? 'Relax' : /qawwali|Sufi|Coke Studio|soulful/.test(query) ? 'Sufi' : 'Live'
      if (mood === 'Workout') await new Promise(resolve => setTimeout(resolve, 120))
      const songs = Array.from({ length: 18 }, (_, i) => ({ id: mood.toLowerCase() + '-' + i, name: mood + ' fresh ' + i, album: { name: mood === 'Relax' ? 'Acoustic unplugged ballads' : mood + ' hits' }, duration: i === 17 ? 30 : 180, primaryArtists: 'Atif Aslam', image: [{ quality: '500x500', url: 'https://c.saavncdn.com/fixture-' + (i % 2 ? 'orange' : 'blue') + '.jpg' }], downloadUrl: [{ quality: '320kbps', url: 'https://aac.saavncdn.com/integrity/chaleya.wav?seconds=180' }] }))
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { results: songs } }) })
    })
    await page.goto(URL, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => [...document.querySelectorAll('.quick-copy strong')].some(el => /fresh/.test(el.textContent)))
    for (const [label, word] of [['Workout', 'Workout'], ['Relax', 'Relax'], ['Sufi & Soul', 'Sufi']]) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await page.waitForFunction(word => [...document.querySelectorAll('.quick-copy strong')].some(el => el.textContent.startsWith(word + ' fresh')), word)
    }
    assert.ok(queries.some(q => /workout|gym|tempo/.test(q)) && queries.some(q => /acoustic|ballad|unplugged/.test(q)) && queries.some(q => /qawwali|Sufi|Coke Studio|soulful/.test(q)))
    assert.equal(await page.locator('.quick-card').filter({ hasText: 'fresh 17' }).count(), 0)
    const strip = await page.locator('.home-chips').evaluate(el => ({ position: getComputedStyle(el).position, color: getComputedStyle(el).backgroundColor }))
    assert.equal(strip.position, 'relative'); assert.equal(strip.color, 'rgba(0, 0, 0, 0)')
    assert.equal(await page.locator('.stage-crumb').count(), 0)
    assert.equal(await page.locator('.sidebar .nav-count').filter({ hasText: /^0+$/ }).count(), 0)
    assert.equal(await page.locator('.player-dock [aria-label="Sleep timer"]').count(), 0)
    await page.locator('.quick-main').first().click()
    await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
    await page.waitForFunction(() => { const i = document.querySelector('.player-dock .dock-cover img'); return i?.complete && i.naturalWidth > 0 })
    const artwork = await page.locator('.quick-card .cover').first().getAttribute('data-artwork')
    assert.equal(await page.locator('.player-dock .dock-cover img').getAttribute('src'), artwork)
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--song-accent-rgb').trim() !== '145, 100, 210')
    const firstAccent = await page.locator('.app').evaluate(el => getComputedStyle(el).getPropertyValue('--song-accent'))
    await page.locator('.quick-main').nth(1).click()
    await page.waitForFunction(previous => getComputedStyle(document.querySelector('.app')).getPropertyValue('--song-accent') !== previous, firstAccent)
    await page.locator('.stage-scroll').evaluate(el => el.scrollTop = 160)
    if (width === 1440) {
      const dock = await page.getByTestId('player-dock').boundingBox(), scroll = await page.locator('.stage-scroll').boundingBox()
      assert.ok(scroll.y + scroll.height <= dock.y, 'scrollable view must end above dock')
    }
    await page.locator('.stage-scroll').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelector('.stage-scroll').scrollTop === 0)
    await page.screenshot({ animations: 'disabled', path: OUT + '/part1a-home-' + width + '.png' })
    if (width === 1440) await page.getByTestId('player-dock').screenshot({ path: OUT + '/part1a-dock-' + width + '.png' })
    await page.getByRole('searchbox').click(); await page.locator('#search-command-surface').waitFor()
    const text = await page.locator('#search-command-surface').innerText()
    for (const filler of ['Find your next favorite', 'Listening privately', 'What should play next?', 'Music, artwork, and lyrics']) assert.ok(!text.includes(filler))
    assert.equal(await page.locator('.search-mini-card, .search-foot').count(), 0)
    await page.locator('.search-quick-row').last().scrollIntoViewIfNeeded()
    assert.equal(await page.locator('.search-quick-row').last().isVisible(), true)
    assert.equal(await page.locator('.search-results').evaluate(el => getComputedStyle(el).scrollbarWidth), 'thin')
    await page.screenshot({ animations: 'disabled', path: OUT + '/part1a-search-' + width + '.png' })
    await page.getByRole('button', { name: 'Close search', exact: true }).click()
    if (width === 390) await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: /^Library/ }).click()
    else await page.locator('.sidebar').getByRole('button', { name: /^Your library/ }).click()
    await page.locator('.library-view').waitFor()
    await page.screenshot({ animations: 'disabled', path: OUT + '/part1a-library-' + width + '.png' })
    assert.deepEqual(errors, [])
    console.log('PASS ' + width + 'px Part1A: live mood requests, canonical artwork/pixel palette, separate dock, compact search, editorial shell')
    await context.close()
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  try {
    await verifyFirstClickRecovery(browser)
    await verifyPart1A(browser)
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, storageState: state() })
      await installFixtures(context)
      const page = await context.newPage(), errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(URL, { waitUntil: 'domcontentloaded' })
      await page.locator('.quick-main').first().waitFor()
      assert.equal(await page.locator('.quick-card').count(), 12)
      assert.equal(await page.locator('.hero-collage .cover').count(), 4)
      const grid = await page.locator('.quick-grid').evaluate(el => ({ columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, rows: getComputedStyle(el).gridTemplateRows.split(' ').length, client: el.clientWidth, scroll: el.scrollWidth }))
      assert.equal(grid.rows, 4)
      if (width === 1440) assert.equal(grid.columns, 3)
      else assert.ok(grid.scroll > grid.client, 'mobile column pager must scroll')
      const before = await page.locator('.quick-card').allTextContents()
      await page.getByRole('button', { name: 'Sufi & Soul', exact: true }).click()
      assert.notDeepEqual(await page.locator('.quick-card').allTextContents(), before)
      assert.equal(await page.getByRole('button', { name: 'Sufi & Soul', exact: true }).getAttribute('aria-pressed'), 'true')
      await page.getByRole('button', { name: 'All', exact: true }).click()
      await page.locator('.quick-main').first().click()
      await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused && a.currentTime > .1 })
      await page.evaluate(() => window.__radioAudio = document.querySelector('audio'))
      if (width === 390) { await page.getByRole('button', { name: 'Open full player', exact: true }).filter({ visible: true }).click(); await page.locator('.fp-queue-btn').click() }
      else await page.getByTestId('queue-btn').click()
      await page.waitForFunction(() => document.querySelectorAll('[data-testid=queue-drawer-row]').length === 15)
      assert.equal(await page.getByTestId('root-audio').evaluate(a => a === window.__radioAudio && !a.paused), true)
      await page.getByRole('button', { name: 'Close queue', exact: true }).click()
      await page.getByTestId('solo-queue-drawer').waitFor({ state: 'hidden' })
      console.log(`PASS ${width}px Home: collage, mood ranking, 12 Quick Picks and 15 automatic upcoming tracks`)
      for (const shelf of await page.locator('.home-shelf .shelf-scroll').all()) {
        const heights = await shelf.locator('.track-card').evaluateAll(els => els.map(x => x.getBoundingClientRect().height))
        if (heights.length) assert.ok(Math.max(...heights) - Math.min(...heights) <= 1)
      }
      await audit(page, `${width}px Home`)
      await page.screenshot({ animations: 'disabled', path: `${OUT}/home-${width}.png` })
      const input = page.getByRole('searchbox', { name: 'Search songs, artists, moods' })
      assert.equal(await page.locator('.sidebar .search-trigger, .sidebar .nav-item').filter({ hasText: /^Search$/ }).count(), 0)
      await input.click()
      await page.locator('#search-command-surface').waitFor()
      await page.getByTestId('search-recent').waitFor()
      await page.getByTestId('search-suggestions').waitFor()
      const anchor = await page.locator('.canonical-search').boundingBox(), panel = await page.locator('#search-command-surface').boundingBox()
      assert.ok(panel.y >= anchor.y + anchor.height && panel.y <= anchor.y + anchor.height + 16)
      await input.fill('Atif')
      await page.locator('.search-result').first().waitFor()
      await page.locator('.search-result').first().getByRole('button', { name: /Like/ }).click()
      await page.locator('.search-result').first().getByRole('button', { name: 'Add to Solo Queue' }).click()
      await page.locator('.search-result').first().getByRole('button', { name: 'Play in Solo Mode' }).click()
      await page.waitForFunction(() => document.querySelector('audio') === window.__radioAudio && !document.querySelector('audio').paused)
      await audit(page, `${width}px Search`)
      await page.screenshot({ animations: 'disabled', path: `${OUT}/search-${width}.png` })
      await page.getByRole('button', { name: 'Clear search', exact: true }).click()
      await page.getByTestId('search-recent').waitFor()
      await page.getByRole('button', { name: 'Remove Atif from recent searches' }).click()
      await page.getByRole('button', { name: 'Close search', exact: true }).click()
      await page.locator('#search-command-surface').waitFor({ state: 'detached' })
      await page.keyboard.press('Control+k'); await page.locator('#search-command-surface').waitFor()
      await page.keyboard.press('Escape'); await page.locator('#search-command-surface').waitFor({ state: 'detached' })
      const repeatBefore = await page.getByTestId('repeat-btn').getAttribute('aria-label')
      await page.getByRole('button', { name: 'Start Radio', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      if (width === 390) { await page.getByRole('button', { name: 'Open full player', exact: true }).filter({ visible: true }).click(); await page.locator('.fp-queue-btn').click() }
      else await page.getByTestId('queue-btn').click()
      await page.getByTestId('solo-queue-drawer').waitFor()
      await page.waitForFunction(() => document.querySelectorAll('[data-testid=queue-drawer-row]').length === 15)
      assert.equal(await page.getByTestId('root-audio').evaluate(el => el === window.__radioAudio && !el.paused), true)
      console.log(`PASS ${width}px Quick Pick: chosen song + 15 radio tracks, stable playing AudioRoot`)
      await audit(page, `${width}px Queue`)
      const stationFirst = await page.getByTestId('queue-now-playing').innerText()
      await page.getByTestId('queue-drawer-row').last().getByRole('button', { name: /^Play / }).click()
      await page.waitForFunction(() => { const a = document.querySelector('[data-testid=root-audio]'); return !a.paused && a.currentTime > .1 })
      await page.getByTestId('root-audio').evaluate(a => a.currentTime = a.duration - .1)
      await page.waitForFunction(first => document.querySelector('[data-testid=queue-now-playing]').innerText === first && !document.querySelector('[data-testid=root-audio]').paused, stationFirst)
      assert.equal(await page.getByTestId('repeat-btn').getAttribute('aria-label'), repeatBefore)
      console.log(`PASS ${width}px Start Radio continues past the station end without changing Repeat preference`)
      await page.getByRole('button', { name: 'Close queue', exact: true }).click()
      if (width === 390) await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: /^Library/ }).click()
      else await page.locator('.sidebar').getByRole('button', { name: /^Your library/ }).click()
      await page.locator('.library-view').waitFor()
      await audit(page, `${width}px Library`)
      if (width === 390) await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: /^Rooms/ }).click()
      else await page.locator('.sidebar').getByRole('button', { name: /^Rooms/ }).click()
      if (width === 390) {
        const room = page.locator('.room-card').filter({ hasText: 'Integrity Room' }); await room.waitFor(); await room.click()
      } else await page.locator('.sidebar .room-link').filter({ hasText: 'Integrity Room' }).click()
      await page.locator('.room-head').waitFor()
      await audit(page, `${width}px Room`)
      await input.click(); await input.fill('Coke Studio')
      await page.locator('.search-result').first().waitFor()
      assert.match(await page.getByTestId('search-context').innerText(), /Integrity Room/)
      await page.locator('.search-result').first().getByRole('button', { name: 'Add to Room Queue' }).click()
      await page.locator('.search-result').first().getByRole('button', { name: 'Play in Room' }).click()
      await page.waitForFunction(() => document.querySelector('[data-testid=root-audio]') === window.__radioAudio && !document.querySelector('[data-testid=root-audio]').paused)
      await page.goBack(); await page.locator('#search-command-surface').waitFor({ state: 'detached' })
      console.log(`PASS ${width}px Room search actions retain Room context; Back dismisses search`)
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
