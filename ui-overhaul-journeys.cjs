const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict')
process.env.ECHOSYNC_URL ||= 'http://127.0.0.1:4273'
const {fixtureState,installFixtures}=require('./integrity-fixtures.cjs')
const URL=process.env.ECHOSYNC_URL||'http://127.0.0.1:4274',OUT='performance-results.local/ui-overhaul/journeys'
fs.mkdirSync(OUT,{recursive:true})
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'})
 try{for(const [width,height] of [[360,800],[375,812],[390,844],[430,932],[1440,900],[1920,1080]])for(const theme of ['light','dark']){
  const state=fixtureState();state.origins[0].localStorage.push({name:'echosync.theme.v1',value:JSON.stringify(theme)})
  const context=await browser.newContext({viewport:{width,height},storageState:state,reducedMotion:'reduce'});await installFixtures(context)
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({animations:'disabled',path:`${OUT}/${width}-${theme}-${name}.png`})}
  await page.goto(URL,{waitUntil:'domcontentloaded'});await page.locator('.quick-main').first().waitFor();await shot('signed-in-home')
  if(width<881)await page.getByRole('button',{name:'Account and profile',exact:true}).click();else await page.locator('.sidebar .profile').click()
  const dialog=page.getByRole('dialog');await dialog.waitFor();await shot('settings-categories')
  for(const [label,name] of [['Profile','profile'],['Audio & playback','audio'],['Taste profile','taste'],['Social & privacy','social'],['Storage & cache','storage']]){
   await dialog.getByRole('button',{name:label,exact:true}).click();await shot('settings-'+name)
   if(width<641)await dialog.getByRole('button',{name:'← Settings',exact:true}).click()
  }
  await page.getByRole('button',{name:'Close settings',exact:true}).click()
  const nav=page.locator(width<881?'.mobile-nav':'.sidebar')
  await nav.getByRole('button',{name:/^(Your library|Library)/i}).click();await page.locator('.library-view').waitFor();await shot('library')
  await page.getByRole('button',{name:'New playlist',exact:true}).click();await page.getByLabel('Playlist name').fill('Evening listening');await dialog.getByRole('button',{name:'Create playlist',exact:true}).click()
  await page.getByRole('textbox',{name:'Search songs to add to playlist'}).fill('Kesariya')
  await page.locator('.playlist-search-row').filter({hasText:'Kesariya'}).first().getByRole('button',{name:'Add to this playlist',exact:true}).click()
  await page.locator('.playlist-detail .library-row').waitFor();await shot('playlist')
  await nav.getByRole('button',{name:/^Rooms/}).click();await page.locator('.rooms-view').waitFor();await shot('rooms')
  await page.locator('.room-card').filter({hasText:'Integrity Room'}).click();await page.locator('.now-card').waitFor();await shot('room-active')
  await page.getByRole('button',{name:/Manage roles/}).click();await dialog.waitFor();await shot('members');await page.keyboard.press('Escape')
  await page.locator('.room-chat-action').click();await page.locator('.chat-body').waitFor();await shot('chat')
  await page.locator('.social:not(.lounge-drawer) .social-close').click()
  await nav.getByRole('button',{name:/Lounge/}).click();await page.locator('.lounge-drawer').waitFor();await shot('lounge');await page.keyboard.press('Escape')
  assert.deepEqual(errors,[]);await context.close()
  const guest=fixtureState();guest.origins[0].localStorage=guest.origins[0].localStorage.filter(x=>!x.name.includes('remember_user'));guest.origins[0].localStorage.push({name:'echosync.theme.v1',value:JSON.stringify(theme)})
  const gc=await browser.newContext({viewport:{width,height},storageState:guest,reducedMotion:'reduce'});await installFixtures(gc);const gp=await gc.newPage();await gp.goto(URL,{waitUntil:'domcontentloaded'});await gp.locator('.quick-main').first().waitFor()
  await gp.getByRole('button',{name:'Log in',exact:true}).filter({visible:true}).first().click();await gp.getByRole('dialog').waitFor()
  const authShot=name=>gp.screenshot({animations:'disabled',path:`${OUT}/${width}-${theme}-${name}.png`})
  await authShot('login');await gp.getByRole('button',{name:'Forgot password?',exact:true}).click();await authShot('recovery');await gp.getByRole('button',{name:'Back to sign in',exact:true}).click();await gp.getByRole('button',{name:'Create an account',exact:true}).click();await authShot('signup');await gc.close()
  console.log(`PASS journeys ${width} ${theme}`)
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
