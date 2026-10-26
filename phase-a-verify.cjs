const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { fixtureState, installFixtures } = require('./integrity-fixtures.cjs')

const URL = process.env.ECHOSYNC_URL || 'http://127.0.0.1:5173'
const OUT = process.env.ECHOSYNC_UI_DIR || 'performance-results.local/phase-a'
const CHROME = process.env.CHROME_PATH || 'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
fs.mkdirSync(OUT, { recursive: true })

const MOODS = ['All', 'Energize', 'Relax', 'Focus', 'Workout', 'Sufi & Soul', 'Late Night']

function guestState() {
  const state = fixtureState({})
  state.origins[0].localStorage = state.origins[0].localStorage.filter(
    (entry) => !/remember_user|active_user/.test(entry.name),
  )
  return state
}

function signedInState() {
  return fixtureState({})
}

async function openGuest(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, storageState: guestState() })
  await installFixtures(context)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="home-v2"]').waitFor()
  await page.locator('.hero-showcase-tile').first().waitFor()
  return { context, page, errors }
}

async function closeAuth(page) {
  await page.getByRole('button', { name: 'Close sign in', exact: true }).click()
  await page.locator('.modal-auth').waitFor({ state: 'detached' })
}

async function assertAuthGate(page, action, label) {
  await action()
  await page.locator('.modal-auth').waitFor()
  assert.equal(await page.locator('[data-testid="root-audio"]').evaluate((audio) => audio.paused), true, `${label}: audio must not start`)
  console.log(`PASS ${label}: guest opens AuthModal instead of acting`)
  await closeAuth(page)
}

const DEFAULT_SIGNUP_SUBTITLE = /Stream full tracks, join live listening rooms, and chat in the Lounge\./

async function verifyAuthModal(page, width, subtitle = DEFAULT_SIGNUP_SUBTITLE) {
  await page.locator('.modal-auth').waitFor()
  await page.waitForTimeout(400)
  assert.match(await page.locator('.modal-auth .eyebrow').innerText(), /CREATE ACCOUNT/)
  assert.equal((await page.locator('.modal-auth h2').innerText()).trim(), 'Join EchoSync')
  assert.match(await page.locator('.modal-auth .auth-modal-copy p').innerText(), subtitle)

  const google = page.locator('.auth-google-btn')
  const box = await google.boundingBox()
  const modal = await page.locator('.modal-auth').boundingBox()
  const copyWidth = (await page.locator('.modal-auth .auth-modal-copy').boundingBox()).width
  assert.ok(box && Math.abs(box.height - 44) <= 1, `Google button is ${box?.height}px tall`)
  assert.ok(box.width >= copyWidth - 1, `Google button ${box.width}px must span the ${copyWidth}px content width`)
  assert.ok(Math.abs(box.x - (modal.x + 24)) <= 1, 'Google button must align to the modal content edge')
  const googleStyle = await google.evaluate((element) => {
    const style = getComputedStyle(element)
    return { border: parseFloat(style.borderTopWidth), radius: parseFloat(style.borderTopLeftRadius), background: style.backgroundColor }
  })
  assert.ok(googleStyle.border >= 1, 'Google button needs a visible border')
  assert.ok(googleStyle.radius >= 12, 'Google button needs a 12px radius')
  assert.notEqual(googleStyle.background, 'rgba(0, 0, 0, 0)', 'Google button needs a visible surface')
  assert.equal(await page.locator('.auth-google-btn .google-g').count(), 1)
  assert.ok(await page.locator('.auth-google-btn .google-g path').count() >= 4, 'Google G must be the multicolor mark')

  const modalMetrics = await page.locator('.modal-auth').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      maxHeight: style.maxHeight,
      padding: style.padding,
      overflowY: style.overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }
  })
  assert.equal(modalMetrics.padding, '24px')
  assert.ok(modalMetrics.maxHeight === '680px' || modalMetrics.maxHeight === 'min(90vh, 680px)', `unexpected max-height ${modalMetrics.maxHeight}`)
  assert.equal(modalMetrics.overflowY, 'auto')
  assert.ok(modalMetrics.scrollHeight >= modalMetrics.clientHeight)

  const legal = page.locator('.modal-auth .auth-legal')
  await legal.scrollIntoViewIfNeeded()
  const legalBox = await legal.boundingBox()
  const modalBox = await page.locator('.modal-auth').boundingBox()
  assert.ok(legalBox && modalBox, 'legal links must render')
  assert.ok(legalBox.y >= modalBox.y - 1 && legalBox.y + legalBox.height <= modalBox.y + modalBox.height + 1, 'legal links must not be clipped')
  assert.match(await legal.innerText(), /Terms of Service/)
  assert.match(await legal.innerText(), /Privacy Policy/)
  console.log(`PASS ${width}px AuthModal: 44px bordered Google button, clean sign-up copy, 24px padding, legal links visible`)

  await page.screenshot({ animations: 'disabled', path: `${OUT}/auth-signup-${width}.png` })
  await closeAuth(page)
}

async function verifyGuest(browser, width, height) {
  const { context, page, errors } = await openGuest(browser, width, height)

  assert.equal(await page.locator('[aria-label="Toggle theme"]').count(), 0)
  assert.equal(await page.locator('.app.light').count(), 0)
  assert.equal(await page.locator('.app').getAttribute('class'), 'app')
  const colors = await page.evaluate(() => ({
    body: getComputedStyle(document.body).backgroundColor,
    app: getComputedStyle(document.querySelector('.app')).backgroundColor,
    stage: getComputedStyle(document.querySelector('.stage')).backgroundColor,
    stageBorder: getComputedStyle(document.querySelector('.stage')).borderTopWidth,
    stageRadius: getComputedStyle(document.querySelector('.stage')).borderRadius,
    heroBorder: getComputedStyle(document.querySelector('.home-hero')).borderBottomWidth,
    homeAmbient: getComputedStyle(document.querySelector('.home-v81'), '::before').display,
    ambientHeight: getComputedStyle(document.querySelector('.stage'), '::before').height,
    appTransition: getComputedStyle(document.querySelector('.app')).transition,
    accent: getComputedStyle(document.querySelector('.app')).getPropertyValue('--song-accent').trim(),
    accentRgb: getComputedStyle(document.querySelector('.app')).getPropertyValue('--song-accent-rgb').trim(),
    glow: getComputedStyle(document.querySelector('.app')).getPropertyValue('--song-glow').trim(),
  }))
  assert.equal(colors.body, 'rgb(3, 3, 3)')
  assert.equal(colors.app, 'rgb(3, 3, 3)')
  assert.equal(colors.stage, 'rgba(0, 0, 0, 0)')
  assert.equal(colors.stageBorder, '0px')
  assert.equal(colors.stageRadius, '0px')
  assert.equal(colors.heroBorder, '0px')
  assert.equal(colors.homeAmbient, 'none')
  assert.equal(colors.ambientHeight, '420px')
  assert.match(colors.appTransition, /0\.6s/)
  assert.match(colors.accentRgb, /^\d+,\s*\d+,\s*\d+$/)
  assert.match(colors.appTransition, /--song-accent-rgb/)
  assert.ok(colors.accent && colors.glow)
  console.log(`PASS ${width}px theme: pure #030303 canvas, no toggle, borderless stage/hero, 420px ambient bleed with 600ms palette transition`)

  assert.deepEqual(await page.locator('.home-chip').allTextContents(), MOODS)
  assert.equal(await page.locator('.guest-room-caption').count(), 0)
  assert.equal(await page.locator('.home-playlists').count(), 0)
  if (width > 880) assert.equal(await page.locator('.side-bottom .invite-card').count(), 0)

  const showcase = page.locator('.hero-showcase')
  assert.equal(await showcase.count(), 1)
  assert.equal(await page.locator('.hero-showcase-tile').count(), 4)
  const showcaseBox = await showcase.boundingBox()
  const copyBox = await page.locator('.home-hero-copy').boundingBox()
  assert.ok(showcaseBox && copyBox)
  assert.ok(showcaseBox.width >= (width > 880 ? 240 : 200), `showcase is only ${showcaseBox.width}px wide`)
  if (width > 880) {
    assert.equal(showcaseBox.width, 260)
    assert.ok(copyBox.x + copyBox.width <= showcaseBox.x - 20, 'hero text and showcase must not overlap')
  } else {
    assert.ok(copyBox.y + copyBox.height <= showcaseBox.y + 1, 'hero text must stack above the showcase on mobile')
  }
  const tiles = await page.locator('.hero-showcase-tile').evaluateAll((elements) => elements.map((element) => ({
    label: element.getAttribute('aria-label'),
    artwork: element.querySelector('.cover')?.getAttribute('data-artwork') || '',
    radius: getComputedStyle(element).borderRadius,
  })))
  assert.equal(new Set(tiles.map((tile) => tile.label)).size, 4)
  tiles.forEach((tile) => assert.equal(tile.radius, '12px'))
  assert.equal(await showcase.evaluate((element) => getComputedStyle(element).gap), '10px')
  console.log(`PASS ${width}px Home: ${showcaseBox.width}px 2x2 showcase, 10px gap, 12px tiles, no hero overlap`)

  if (width > 880) {
    await page.locator('.guest-signup').click()
    await verifyAuthModal(page, width)
  }

  await assertAuthGate(page, () => page.locator('.hero-showcase-tile').first().click(), `${width}px Hero showcase tile`)
  await assertAuthGate(page, () => page.getByRole('button', { name: 'Play Supermix', exact: true }).click(), `${width}px Play Supermix`)
  await assertAuthGate(page, () => page.locator('.quick-main').first().click(), `${width}px Quick pick`)
  await assertAuthGate(page, () => page.getByRole('button', { name: 'Create Room', exact: true }).click(), `${width}px Create Room`)
  if (width > 880) {
    await assertAuthGate(page, () => page.locator('.dock-play').click(), `${width}px Player Play`)
  } else {
    // Mobile hides the dock until a track exists; guests can never create one, so exercise the same handler directly.
    await assertAuthGate(page, () => page.locator('.dock-play').dispatchEvent('click'), `${width}px Player Play`)
  }

  if (width > 880) {
    await assertAuthGate(page, () => page.locator('.lounge-header-btn').click(), `${width}px Public Lounge header`)
    await assertAuthGate(page, () => page.locator('.sidebar').getByRole('button', { name: /^Your library/ }).click(), `${width}px Your Library`)
  } else {
    await assertAuthGate(page, () => page.getByTestId('lounge-mobile-btn').click(), `${width}px Public Lounge mobile`)
    await assertAuthGate(page, () => page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: /^Library/ }).click(), `${width}px Your Library`)
    await assertAuthGate(page, () => page.getByRole('button', { name: 'Log in or sign up' }).click(), `${width}px Mobile account`)
  }

  if (width > 880) await page.locator('.sidebar').getByRole('button', { name: /^Rooms/ }).click()
  else await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: /^Rooms/ }).click()
  await page.locator('.rooms-view').waitFor()
  assert.equal(await page.locator('.modal-auth').count(), 0)
  assert.equal(await page.locator('.room-card').count() >= 1, true)
  console.log(`PASS ${width}px Rooms: guests can browse the live room list without signing in`)

  await assertAuthGate(page, () => page.locator('.room-card:not(.create-room-card)').first().click(), `${width}px Join room`)
  await assertAuthGate(page, () => page.locator('.rooms-view').getByRole('button', { name: 'Join with code' }).click(), `${width}px Join with code`)
  await assertAuthGate(page, () => page.locator('.create-room-card').click(), `${width}px Rooms Create Room`)
  await page.locator('.create-room-card').click()
  await page.locator('.modal-auth').waitFor()
  assert.match(await page.locator('.modal-auth .auth-modal-copy p').innerText(), /Sign up to host a room and invite friends\./)
  await closeAuth(page)
  console.log(`PASS ${width}px Create Room modal shows contextual sign-up reason`)
  await page.locator('.create-room-card').click()
  await verifyAuthModal(page, width, /Sign up to host a room and invite friends\./)

  await page.screenshot({ animations: 'disabled', path: `${OUT}/guest-${width}.png` })
  assert.deepEqual(errors, [])
  await context.close()
}

async function verifyDrawer(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: signedInState() })
  await installFixtures(context)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.locator('.hero-showcase-tile').first().waitFor()
  await page.locator('.lounge-header-btn').click()
  await page.locator('.lounge-drawer').waitFor()
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.home-v81')).getPropertyValue('--hero-showcase').trim() === '220px')
  const showcase = await page.locator('.hero-showcase').boundingBox()
  const copy = await page.locator('.home-hero-copy').boundingBox()
  assert.equal(showcase.width, 220)
  assert.ok(showcase.x >= copy.x + copy.width + 20, 'drawer-open showcase overlaps hero copy')
  const inside = await page.evaluate(() => {
    const stage = document.querySelector('.stage').getBoundingClientRect()
    const tile = document.querySelector('.hero-showcase').getBoundingClientRect()
    return tile.left >= stage.left && tile.right <= stage.right
  })
  assert.equal(inside, true)
  console.log('PASS 1440px drawer open: showcase resizes to 220px and never overlaps hero text')
  await page.screenshot({ animations: 'disabled', path: `${OUT}/home-drawer-1440.png` })
  assert.deepEqual(errors, [])
  await context.close()
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await verifyGuest(browser, width, height)
    }
    await verifyDrawer(browser)
  } finally {
    await browser.close()
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
