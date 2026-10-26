const assert = require('node:assert/strict')
const fs = require('node:fs')
const {chromium} = require('playwright')
process.env.ECHOSYNC_URL ||= 'http://127.0.0.1:4273'
const {fixtureState, installFixtures} = require('./integrity-fixtures.cjs')
const URL = process.env.ECHOSYNC_URL || 'http://127.0.0.1:4274'
const OUT = 'performance-results.local/ui-overhaul/verified'
fs.mkdirSync(OUT,{recursive:true})
;(async()=>{
  const {conversationEntries}=await import('./src/core/chatEvents.js')
  const a={id:'join-1',system:true,text:'A joined'}, b={id:'join-2',system:true,text:'A joined'}
  const grouped=conversationEntries([a,a,b,{id:'chat',text:'Hello'},a])
  assert.equal(grouped.length,2);assert.equal(grouped[0].notices.length,2)
  console.log('PASS replay IDs deduplicated, legitimate repeated notices retained and grouped')
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'})
  const metrics=[]
  try{
    for(const [width,height] of [[360,800],[375,812],[390,844],[430,932],[1440,900],[1920,1080]]) for(const theme of ['light','dark']){
      const state=fixtureState();state.origins[0].origin=URL
      state.origins[0].localStorage=state.origins[0].localStorage.filter(x=>!x.name.includes('remember_user'))
      state.origins[0].localStorage.push({name:'echosync.theme.v1',value:JSON.stringify(theme)})
      const context=await browser.newContext({viewport:{width,height},storageState:state,reducedMotion:'reduce'})
      await installFixtures(context)
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
      const shot=async name=>page.screenshot({animations:'disabled',path:`${OUT}/${width}-${theme}-${name}.png`})
      await page.goto(URL,{waitUntil:'domcontentloaded'});await page.locator('.quick-main').first().waitFor()
      await page.evaluate(()=>document.fonts.ready)
      assert.equal(await page.locator('.app').evaluate(e=>e.classList.contains('light')),theme==='light')
      assert.equal(await page.locator('.player-dock:visible,.mobile-mini:visible').count(),0)
      const audio=await page.getByTestId('root-audio').elementHandle()
      const top=(await page.locator('.quick-picks-section h2').boundingBox()).y
      if([375,390].includes(width))assert.ok(top<=320,`${width} Quick picks y=${top}`)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await shot('guest-home')
      const search=page.getByRole('searchbox');await search.click()
      assert.equal(await page.getByText('Recent searches',{exact:true}).count(),0)
      await shot('search-idle')
      await search.fill('Atif');await page.locator('.search-result').first().waitFor()
      await page.locator('.search-loading').waitFor({state:'hidden'})
      assert.equal(await page.locator('.search-caption b').innerText(),`${await page.locator('.search-result').count()} songs`)
      const row=page.locator('.search-result').first();await row.locator('summary').click()
      const like=row.getByRole('button',{name:/^Like /});await like.focus();await page.keyboard.press('Enter')
      assert.equal(await page.getByTestId('root-audio').evaluate(a=>a.paused),true,'nested Like must not play')
      await row.getByRole('button',{name:'Add to Solo Queue',exact:true}).focus();await page.keyboard.press('Enter')
      assert.equal(await page.getByTestId('root-audio').evaluate(a=>a.paused),true,'nested Queue must not play')
      await shot('search-results')
      await page.getByRole('button',{name:'Close search',exact:true}).click()
      await search.fill('');await search.click()
      assert.equal(await page.getByText('Recent searches',{exact:true}).count(),0,'typing alone must not commit history')
      await search.fill('Atif');await search.press('Enter');await page.getByRole('button',{name:'Close search',exact:true}).click()
      await search.fill('');await search.click();await page.getByText('Recent searches',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Close search',exact:true}).click()
      await page.locator('.quick-main').first().click();await page.waitForFunction(()=>!document.querySelector('[data-testid=root-audio]').paused)
      await shot('mini-player')
      await page.getByRole('button',{name:'Open full player',exact:true}).filter({visible:true}).first().click()
      await page.locator('.full-player').waitFor();await shot('full-player')
      if(width<641){await page.getByRole('button',{name:'Lyrics',exact:true}).click();await shot('lyrics')}
      if(width<641)await page.locator('.fp-mobile-tabs').getByRole('button',{name:'Queue',exact:true}).click()
      else await page.locator('.fp-queue-btn').click()
      await page.getByTestId('solo-queue-drawer').waitFor();await shot('queue')
      await page.goBack();await page.getByTestId('solo-queue-drawer').waitFor({state:'hidden'})
      assert.equal(await page.getByTestId('root-audio').evaluate((a,old)=>a===old&&!a.paused,audio),true)
      assert.deepEqual(errors,[])
      metrics.push({width,height,theme,quickPicksTop:top})
      await context.close();console.log(`PASS ${width}×${height} ${theme}: search keyboard/count/history, empty dock, theme, layout, audio identity`)
    }
  }finally{await browser.close();fs.writeFileSync(`${OUT}/metrics.json`,JSON.stringify(metrics,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1})
