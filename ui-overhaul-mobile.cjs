process.env.ECHOSYNC_URL ||= 'http://127.0.0.1:4273'
const {chromium}=require('playwright'),assert=require('node:assert/strict')
const {fixtureState,installFixtures}=require('./integrity-fixtures.cjs')
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'})
 const c=await browser.newContext({viewport:{width:390,height:844},storageState:fixtureState(),reducedMotion:'reduce'});await installFixtures(c)
 try{
  const p=await c.newPage();await p.goto(process.env.ECHOSYNC_URL,{waitUntil:'domcontentloaded'});await p.locator('.quick-main').first().click();await p.waitForFunction(()=>!document.querySelector('[data-testid=root-audio]').paused)
  const audio=await p.getByTestId('root-audio').elementHandle()
  await p.getByRole('button',{name:'Open full player',exact:true}).filter({visible:true}).click();await p.locator('.fp-queue-btn').click()
  const rows=p.getByTestId('queue-drawer-row'), before=await rows.locator('.queue-copy strong').allTextContents()
  const first=rows.first();await first.locator('summary').click();await first.getByRole('button',{name:/^Remove .* from queue$/}).click();assert.equal(await rows.count(),before.length-1)
  await p.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await rows.locator('.queue-copy strong').allTextContents(),before)
  await p.getByRole('button',{name:'Close queue',exact:true}).click()
  await p.getByRole('button',{name:'Account and profile',exact:true}).click();const dialog=p.locator('.modal-settings');await dialog.getByRole('button',{name:'Audio & playback',exact:true}).click()
  const save=dialog.getByRole('button',{name:'Save preferences',exact:true});await save.scrollIntoViewIfNeeded();const box=await save.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=844)
  assert.equal(await dialog.getByRole('slider').isDisabled(),true)
  await dialog.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('dark');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('echosync.theme.v1'))==='dark')
  await p.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='echosync_settings_v1')throw new DOMException('Full','QuotaExceededError');return window.__setItem.call(this,key,value)}})
  await save.click();await p.getByText("Changes weren't saved (storage full)",{exact:true}).waitFor();assert.equal(await p.getByText('Listening preferences saved',{exact:true}).count(),0)
  await p.evaluate(()=>Storage.prototype.setItem=window.__setItem);await p.getByRole('button',{name:'Close settings',exact:true}).click()
  await p.locator('.mobile-nav').getByRole('button',{name:'Rooms',exact:true}).click();await p.locator('.room-card').filter({hasText:'Integrity Room'}).click();await p.locator('.room-chat-action').click();await p.getByRole('textbox',{name:'Room message',exact:true}).waitFor()
  // A reduced visual viewport checks reachability; it does not emulate an OS keyboard.
  await p.setViewportSize({width:390,height:420});const composer=p.getByRole('textbox',{name:'Room message',exact:true});await composer.focus();await composer.scrollIntoViewIfNeeded();const cb=await composer.boundingBox();assert.ok(cb.y>=0&&cb.y+cb.height<=420)
  assert.equal(await p.getByTestId('root-audio').evaluate((a,old)=>a===old,audio),true)
  console.log('PASS mobile Queue Undo, reachable Settings save, quota feedback, persisted theme, Chat entry and reduced-viewport composer; AudioRoot retained')
 }finally{await c.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
