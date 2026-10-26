const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict')
process.env.ECHOSYNC_URL ||= 'http://127.0.0.1:4273'
const {fixtureState,installFixtures}=require('./integrity-fixtures.cjs')
const URL=process.env.ECHOSYNC_URL||'http://127.0.0.1:4274',OUT='performance-results.local/ui-overhaul/states'
fs.mkdirSync(OUT,{recursive:true})
;(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'})
try{for(const [width,height] of [[360,800],[375,812],[390,844],[430,932],[1440,900],[1920,1080]])for(const theme of ['light','dark']){
const state=fixtureState();state.origins[0].localStorage=state.origins[0].localStorage.filter(x=>!x.name.includes('remember_user'));state.origins[0].localStorage.find(x=>x.name==='echosync_rooms_v3').value='[]';state.origins[0].localStorage.push({name:'echosync.theme.v1',value:JSON.stringify(theme)},{name:'echosync_recent_v1',value:JSON.stringify({guest:['chaleya']})})
const c=await browser.newContext({viewport:{width,height},storageState:state,reducedMotion:'reduce'});await installFixtures(c)
const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const shot=name=>p.screenshot({animations:'disabled',path:`${OUT}/${width}-${theme}-${name}.png`})
await p.goto(URL,{waitUntil:'domcontentloaded'});await p.locator('.continue-listening').waitFor();assert.match(await p.locator('.continue-listening').innerText(),/Chaleya/);assert.match(await p.locator('.home-hero h1').innerText(),/Welcome back/);await shot('returning-home')
const nav=p.locator(width<881?'.mobile-nav':'.sidebar');await nav.getByRole('button',{name:/^Rooms/}).click();await p.getByText('No rooms yet',{exact:true}).waitFor();await shot('rooms-empty')
let release;const held=new Promise(resolve=>release=resolve)
const stalled=async r=>{await held;await r.fulfill({status:503,json:{error:'Controlled unavailable provider'}}).catch(()=>{})}
await c.route('**/api/saavn/**',stalled)
const input=p.getByRole('searchbox');await input.fill('no-local-match-unique');await p.locator('.search-loading').waitFor();await shot('search-loading');await p.getByRole('button',{name:'↻ Retry search',exact:true}).waitFor({timeout:8000});assert.equal(await p.locator('.search-result').count(),0);await shot('search-error');release();await c.unroute('**/api/saavn/**',stalled)
await c.route('**/api/saavn/**',r=>r.fulfill({json:{data:{results:[]}}}))
await input.fill('no-result-another');await p.locator('.search-loading').waitFor({state:'hidden'});await p.getByRole('button',{name:'Edit search',exact:true}).waitFor();await shot('search-empty');await p.getByRole('button',{name:'Edit search',exact:true}).click();assert.equal(await input.evaluate(e=>e===document.activeElement),true)
await p.evaluate(()=>localStorage.setItem('echosync.theme.v1',JSON.stringify('system')));await p.reload({waitUntil:'domcontentloaded'});await p.locator('.app').waitFor();await p.emulateMedia({colorScheme:'dark'});await p.waitForFunction(()=>document.querySelector('.app').classList.contains('dark'));await p.emulateMedia({colorScheme:'light'});await p.waitForFunction(()=>document.querySelector('.app').classList.contains('light'))
assert.deepEqual(errors,[]);await c.close();console.log(`PASS ${width} ${theme}: real local history, empty Rooms, bounded search states and System theme`)
}}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
