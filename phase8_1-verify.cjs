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
;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  try {
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
      await page.getByTestId('solo-queue-drawer').waitFor({ state: 'detached' })
      console.log(`PASS ${width}px Home: collage, mood ranking, 12 Quick Picks and 15 automatic upcoming tracks`)
      for (const shelf of await page.locator('.home-shelf .shelf-scroll').all()) {
        const heights = await shelf.locator('.track-card').evaluateAll(els => els.map(x => x.getBoundingClientRect().height))
        if (heights.length) assert.ok(Math.max(...heights) - Math.min(...heights) <= 1)
      }
      await audit(page, `${width}px Home`)
      await page.screenshot({ path: `${OUT}/home-${width}.png` })
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
      await page.screenshot({ path: `${OUT}/search-${width}.png` })
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
      assert.match(await page.getByTestId('search-context').innerText(), /Playing in Room: Integrity Room/)
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
