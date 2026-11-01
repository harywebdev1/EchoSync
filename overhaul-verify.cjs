const assert = require('node:assert/strict')
const { fixtureState, installFixtures } = require('./integrity-fixtures.cjs')
// Permanent regression coverage for the overhaul, invoked by integrity-browser.cjs.
module.exports = async function verifyOverhaul({ browser, check, open, APP_URL }) {
  async function geometry(page, selector) {
    await page.locator(selector).first().waitFor()
    const result = await page.locator(selector).evaluateAll((rows) => {
      const problems = [],
        columns = new Map()
      rows.forEach((row) => {
        const r = row.getBoundingClientRect()
        if (!r.width || !r.height) return
        if (Math.abs(r.height - 56) > 1) problems.push('Row height ' + r.height + ' ' + row.className)
        for (const line of row.querySelectorAll('.artist-links'))
          if (line.scrollHeight > 24) problems.push('Artist wraps ' + line.scrollHeight + ' ' + row.textContent)
        const key = Math.round(r.x)
        if (!columns.has(key)) columns.set(key, [])
        columns.get(key).push(r)
      })
      for (const boxes of columns.values()) {
        boxes.sort((a, b) => a.top - b.top)
        for (let i = 1; i < boxes.length; i++)
          if (boxes[i - 1].bottom > boxes[i].top + 1) problems.push('Adjacent rows overlap')
      }
      return { problems, count: rows.length }
    })
    assert.ok(result.count > 1, selector + ' missing adjacent fixture rows')
    assert.deepEqual(result.problems, [], selector)
  }
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 780],
  ])
    await check(
      'Overhaul ' + width + ' multi-artist geometry, profiles and mobile player',
      { multiArtist: true },
      async (page) => {
        await page.setViewportSize({ width, height })
        await open(page)
        await geometry(page, '.quick-card')
        const theme = await page.evaluate(() => ({
          canvas: getComputedStyle(document.body).backgroundColor,
          font: getComputedStyle(document.body).fontFamily,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }))
        assert.equal(theme.canvas, 'rgb(3, 3, 3)')
        assert.match(theme.font, /Figtree/)
        assert.equal(theme.overflow, false)
        if (width === 390) {
          const cdp = await page.context().newCDPSession(page)
          await page.evaluate(async () => {
            await document.fonts.ready
            await Promise.all([...document.images].filter(img=>img.complete).map((img) => img.decode().catch(() => {})))
            await new Promise((resolve) => requestIdleCallback(resolve, { timeout: 2000 }))
          })
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
          try {
            const scroll = await page.evaluate(async () => {
              const stage = document.querySelector('.stage-scroll'),
                frames = [],
                tasks = []
              const observer = new PerformanceObserver((list) =>
                tasks.push(...list.getEntries().map((entry) => entry.duration))
              )
              observer.observe({ type: 'longtask' })
              let previous = performance.now()
              for (let i = 0; i < 90; i++)
                await new Promise((resolve) =>
                  requestAnimationFrame((now) => {
                    frames.push(now - previous)
                    previous = now
                    stage.scrollTop = (i < 45 ? i : 90 - i) * 24
                    resolve()
                  })
                )
              stage.scrollTop = 0
              observer.disconnect()
              frames.sort((a, b) => a - b)
              return {
                p95: frames[Math.floor(frames.length * 0.95)],
                maxTask: Math.max(0, ...tasks),
                ambientContain: getComputedStyle(document.querySelector('.ambient')).contain,
                blurs: [...document.querySelectorAll('.quick-card,.track-card,.home-mix-card')].filter(
                  (el) => getComputedStyle(el).backdropFilter !== 'none'
                ).length,
              }
            })
            console.log('4x CPU mobile scroll', JSON.stringify(scroll))
            assert.equal(scroll.blurs, 0)
            assert.equal(scroll.ambientContain, 'strict')
          } finally {
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
            await cdp.detach()
          }
          const normalFrames=await page.evaluate(async()=>{const frames=[],stage=document.querySelector('.stage-scroll');let previous;for(let i=0;i<90;i++)await new Promise(resolve=>requestAnimationFrame(now=>{if(previous)frames.push(now-previous);previous=now;stage.scrollTop=(i<45?i:90-i)*24;resolve()}));stage.scrollTop=0;frames.sort((a,b)=>a-b);return {p95:frames[Math.floor(frames.length*.95)],frames:frames.length}})
          console.log('Normal CPU mobile scroll',JSON.stringify(normalFrames))
        }
        await page.getByRole('button', { name: 'Play Chaleya', exact: true }).first().click()
        await page.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
        const root = await page.getByTestId('root-audio').elementHandle()
        assert.ok(await page.locator('.dock-copy .artist-links').evaluate((el) => el.scrollHeight <= 24))
        if (width <= 768) {
          await page.locator('.mobile-mini [aria-label="Open full player"]').click()
          await page.locator('.full-player').waitFor()
          assert.ok(
            await page.locator('.full-player').evaluate((el) => el.getBoundingClientRect().height <= innerHeight)
          )
          await page.getByRole('tab', { name: 'Lyrics', exact: true }).click()
          await page.locator('.fp-right:visible').waitFor()
          await page.getByRole('tab', { name: 'Up Next', exact: true }).click()
          await page.locator('.fp-queue:visible').waitFor()
          await page.getByRole('tab', { name: 'Player', exact: true }).click()
          await page.locator('.fp-left:visible').waitFor()
          if (process.env.ECHOSYNC_SCREENSHOTS)
            await page.screenshot({ path: 'performance-results.local/overhaul-player-' + width + '.png' })
          await page.getByRole('button', { name: 'Close full player', exact: true }).click()
        }
        await page.locator('.quick-card .artist-link').first().click()
        await page.getByTestId('artist-profile').waitFor()
        await geometry(page, '.artist-song-row')
        assert.match(page.url(), /\/artist\/abdul-hannan/)
        assert.ok((await page.locator('.artist-song-album').allTextContents()).every((t) => !t.trim()))
        await page.goBack()
        await page.getByTestId('home-v2').waitFor()
        if (width <= 768)
          await page.locator('.mobile-bottom-bar').getByRole('button', { name: 'Account', exact: true }).click()
        else await page.locator('.sidebar .profile').click()
        await page.getByTestId('user-profile').waitFor()
        assert.match(page.url(), /\/@integrity/)
        await geometry(page, '.channel-song-row')
        if (width <= 768)
          await page
            .locator('.mobile-bottom-bar')
            .getByRole('button', { name: /Library/i })
            .click()
        else
          await page
            .locator('.sidebar')
            .getByRole('button', { name: /Your library|Library/i })
            .click()
        await page.getByRole('button', { name: 'Liked songs', exact: true }).click()
        await geometry(page, '.library-row')
        await page.getByRole('searchbox', { name: 'Search songs, artists, moods' }).fill('Chaleya')
        await page.locator('.search-result').first().waitFor()
        assert.ok(
          await page
            .locator('.search-result .artist-links')
            .first()
            .evaluate((el) => el.scrollHeight <= 24)
        )
        await page.keyboard.press('Escape')
        if (width <= 768) {
          await page.locator('.mobile-bottom-bar').getByRole('button', { name: 'Rooms', exact: true }).click()
          await page.locator('.room-card').filter({ hasText: 'Integrity Room' }).click()
        } else
          await page
            .getByRole('button', { name: /Integrity Room/ })
            .first()
            .click()
        await page.locator('.room-head').waitFor()
        await geometry(page, '.room-queue .queue-row')
        assert.equal(await page.getByTestId('root-audio').evaluate((el, old) => el === old, root), true)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        if (process.env.ECHOSYNC_SCREENSHOTS)
          await page.screenshot({ path: 'performance-results.local/overhaul-room-' + width + '.png' })
        console.log('Overhaul geometry verified at ' + width + 'x' + height)
      }
    )
  await check('Overhaul two-context DJ promotion and pause/track ordering', { roomPeer: true }, async (admin) => {
    const memberContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: fixtureState({ roomPeer: true, activeUser: 'peer' }),
    })
    memberContext.setDefaultTimeout(20000)
    await installFixtures(memberContext)
    const member = await memberContext.newPage(),
      pages = [admin, member]
    const relay = async ({ page: source }, name, data) => {
      await Promise.all(
        pages
          .filter((p) => p !== source && !p.isClosed())
          .map((p) =>
            p
              .evaluate(
                ({ name, data }) => {
                  for (const channel of window.__roomChannels || [])
                    if (channel.name === name) channel.onmessage?.({ data })
                },
                { name, data }
              )
              .catch(() => {})
          )
      )
    }
    try {
      for (const p of pages) {
        await p.exposeBinding('__sendRoomPacket', relay)
        await p.addInitScript(() => {
          const Native = BroadcastChannel
          window.__roomChannels = []
          window.__roomPackets = []
          window.BroadcastChannel = class {
            constructor(name) {
              this.name = name
              if (name !== 'echosync-room-sync') {
                this.native = new Native(name)
                this.native.onmessage = (e) => this.onmessage?.(e)
              }
              window.__roomChannels.push(this)
            }
            postMessage(data) {
              if (this.native) return this.native.postMessage(data)
              window.__roomPackets.push(data)
              window.__sendRoomPacket(this.name, data)
            }
            close() {
              this.native?.close()
              window.__roomChannels = window.__roomChannels.filter((c) => c !== this)
            }
          }
          const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')
          window.__hardSeeks = []
          Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
            get: descriptor.get,
            set(value) {
              if (this.dataset.testid === 'root-audio') window.__hardSeeks.push({ time: performance.now(), value })
              descriptor.set.call(this, value)
            },
          })
        })
        await open(p)
        await p
          .getByRole('button', { name: /Integrity Room/ })
          .first()
          .click()
        await p.locator('.room-head').waitFor()
      }
      await admin.locator('.player-dock .dock-play').click()
      await admin.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      await member.locator('.stage').click({ position: { x: 500, y: 20 } })
      await member.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      await admin.getByRole('button', { name: /Manage roles/ }).click()
      await admin.evaluate(() =>
        document.addEventListener('change', () => (window.__roleSent = Date.now()), { once: true, capture: true })
      )
      await member.evaluate(() => {
        new MutationObserver(() => {
          if (!window.__roleSeen && !document.querySelector('.room-head')?.textContent.includes('Request DJ Role'))
            window.__roleSeen = Date.now()
        }).observe(document.querySelector('.room-head'), { subtree: true, childList: true, characterData: true })
      })
      const before = Date.now()
      await admin.getByRole('combobox', { name: 'Role for Peer Listener' }).selectOption('dj')
      await member.waitForFunction(() => !document.querySelector('.room-head')?.textContent.includes('Request DJ Role'))
      const promotionMs =
        (await member.evaluate(() => window.__roleSeen)) - (await admin.evaluate(() => window.__roleSent))
      console.log('Role promotion', promotionMs, 'ms; harness round trip', Date.now() - before)
      assert.ok(promotionMs < 500, 'Role promotion exceeded 500ms')
      await admin.getByRole('button', { name: 'Close members', exact: true }).click()
      await member
        .locator('.player-dock .dock-play')
        .evaluate((el) =>
          el.addEventListener('click', () => (window.__pauseSent = Date.now()), { once: true, capture: true })
        )
      await admin
        .getByTestId('root-audio')
        .evaluate((el) => el.addEventListener('pause', () => (window.__pauseSeen = Date.now()), { once: true }))
      await member.locator('.player-dock .dock-play').click()
      await admin.waitForFunction(() => document.querySelector('[data-testid=root-audio]').paused)
      const pauseMs =
        (await admin.evaluate(() => window.__pauseSeen)) - (await member.evaluate(() => window.__pauseSent))
      console.log('DJ pause', pauseMs, 'ms')
      assert.ok(pauseMs < 500, 'Promoted DJ pause exceeded 500ms')
      const stale = await admin.evaluate(() =>
        window.__roomPackets.filter((p) => p.type === 'state' && p.isPlaying).at(-1)
      )
      await member.evaluate((packet) => window.__sendRoomPacket('echosync-room-sync', packet), stale)
      assert.equal(await admin.getByTestId('root-audio').evaluate((el) => el.paused), true)
      await member.locator('.player-dock .dock-play').click()
      await admin.waitForFunction(() => !document.querySelector('[data-testid=root-audio]').paused)
      await member.locator('.player-dock [aria-label="Next track"]').click()
      const title = await member.locator('.dock-copy strong').textContent()
      await admin.waitForFunction(
        (expected) => document.querySelector('.dock-copy strong')?.textContent === expected,
        title,
        { timeout: 500 }
      )
      await admin.evaluate(() => (window.__hardSeeks = []))
      await admin.waitForTimeout(11000)
      assert.equal(
        await admin.evaluate(() => window.__hardSeeks.length),
        0,
        'Playback hard-seeked during normal ticking'
      )
      assert.equal(await admin.locator('.dock-copy strong').textContent(), title)
      const position = await member.evaluate(() => window.__roomPackets.filter((p) => p.type === 'state').at(-1))
      const target = await admin.getByTestId('root-audio').evaluate((el) => el.currentTime + 1)
      await member.evaluate(
        ({ packet, target }) =>
          window.__sendRoomPacket('echosync-room-sync', {
            ...packet,
            command: 'STATE',
            heartbeat: false,
            stateVersion: Date.now(),
            ts: Date.now(),
            time: target,
            _eventId: crypto.randomUUID(),
          }),
        { packet: position, target }
      )
      await admin.waitForFunction(() => document.querySelector('[data-testid=root-audio]').playbackRate === 1.03)
      assert.equal(await admin.evaluate(() => window.__hardSeeks.length), 0, 'Small drift caused a hard seek')
      await admin.waitForFunction(() => document.querySelector('[data-testid=root-audio]').playbackRate === 1)
      console.log(
        'Two isolated contexts: promotion/pause/play/track converged, stale replay rejected, no periodic hard seeks'
      )
    } finally {
      await memberContext.close()
    }
  })
}
