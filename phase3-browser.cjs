process.env.ECHOSYNC_URL ||= 'http://127.0.0.1:4173'
const {chromium}=require('playwright'),assert=require('node:assert/strict')
const {fixtureState,installFixtures,wav}=require('./integrity-fixtures.cjs')
const URL=process.env.ECHOSYNC_URL||'http://127.0.0.1:4173',OUT='performance-results.local/phase3'
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/haryw/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']})
 try {
  const state=fixtureState({}),entries=state.origins[0].localStorage,library=JSON.parse(entries.find(e=>e.name==='echosync.library.v1').value),track=library.chaleya.track
  entries.push({name:'echosync.likes.v1',value:JSON.stringify({integrity:[track]})},{name:'echosync_playlists_v1',value:JSON.stringify({integrity:[{id:'legacy',name:'Migrated favorites',trackIds:['chaleya'],visibility:'private'}]})})
  const context=await browser.newContext({storageState:state,permissions:['microphone'],viewport:{width:1440,height:900}});await installFixtures(context)
  await context.route('https://cloud.test/storage/**',route=>route.fulfill({contentType:'audio/wav',body:wav(2)}))
  await context.addInitScript(()=>{
   const id='11111111-1111-4111-8111-111111111111',user={id,email:'cloud@example.test',user_metadata:{username:'cloud-listener'}}
   const db={profiles:[],playlists:[],rooms:[],messages:[]},callbacks=new Set(),stats={queries:0,events:[],oauth:null,uploads:[],failedUpload:true};let session=null
   const client={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>{callbacks.add(fn);return{data:{subscription:{unsubscribe:()=>callbacks.delete(fn)}}}},signInWithPassword:async input=>{if(input.password!=='cloud-password')return{error:{message:'Invalid credentials'}};session={user};callbacks.forEach(fn=>fn('SIGNED_IN',session));return{data:{session,user}}},signUp:async()=>({data:{user,session:null}}),signOut:async()=>{session=null;callbacks.forEach(fn=>fn('SIGNED_OUT',null));return{}},updateUser:async input=>{stats.updated=input;return{data:{user}}},resetPasswordForEmail:async(email,options)=>{stats.recovery={email,options};return{data:{}}},signInWithOAuth:async input=>{stats.oauth=input;return{data:{}}}},
   from(table){let op='select',value,filters=[],one=false;const b={select:()=>b,eq:(k,v)=>{filters.push([k,v]);return b},in:(k,v)=>{filters.push([k,v,true]);return b},order:()=>b,limit:()=>b,maybeSingle:()=>{one=true;return b},upsert:v=>{op='upsert';value=v;return b},update:v=>{op='update';value=v;return b},delete:()=>{op='delete';return b},then(resolve){stats.queries++;const rows=table==='profile_directory'?db.profiles.map(p=>({id:p.id,username:p.username,display_name:p.display_name,privacy_settings:p.privacy_settings,taste_profile:p.taste_profile,activity_status:p.activity_status})):db[table];const match=p=>filters.every(([k,v,list])=>list?v.includes(p[k]):p[k]===v);let data;if(op==='upsert'){const prior=rows.find(p=>p.id===value.id);if(prior)Object.assign(prior,value);else rows.push({...value});data=value}else if(op==='update'){rows.filter(match).forEach(p=>Object.assign(p,value));data=rows.filter(match)}else if(op==='delete'){db[table]=rows.filter(p=>!match(p));data=[]}else data=rows.filter(match);return Promise.resolve({data:one?(data[0]||null):data,error:null}).then(resolve)}};return b},
   rpc:async(name,args)=>{if(name==='echosync_save_library'){const p=db.profiles.find(p=>p.id===args.p_profile.id);Object.assign(p,{...args.p_profile,privacy_settings:{...p.privacy_settings,...args.p_profile.privacy_settings}});db.playlists=args.p_playlists.map(p=>({...p,owner_id:id}));return{data:null}}stats.events.push(args.p_event);return{data:args.p_event||{}}},
   channel:()=>{const handlers={};const ch={on:(type,options,fn)=>{handlers[type]=fn;return ch},subscribe:fn=>{setTimeout(()=>fn('SUBSCRIBED'),0);return ch},track:async()=>({}),presenceState:()=>({})};return ch},removeChannel:async()=>({}),
   storage:{from:()=>({upload:async(path,blob)=>{if(stats.failedUpload)return{error:{message:'fixture storage offline'}};stats.uploads.push({path,bytes:blob.size});return{data:{path}}},getPublicUrl:path=>({data:{publicUrl:'https://cloud.test/storage/v1/object/public/voice-notes/'+path}})})}}
   window.__ECHOSYNC_SUPABASE__={url:'https://cloud.test',key:'fixture-public-key',client}
   window.__cloud={stats,db,recover:()=>callbacks.forEach(fn=>fn('PASSWORD_RECOVERY',session)),refresh:()=>callbacks.forEach(fn=>fn('TOKEN_REFRESHED',session))}
  })
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack)})
  await page.goto(URL,{waitUntil:'domcontentloaded'});await page.locator('.sidebar .profile').waitFor()
  await page.waitForFunction(()=>document.querySelector('.sidebar .profile strong')?.textContent==='Sign in')
  await page.locator('.sidebar .profile').click();await page.getByRole('button',{name:'Continue with Google'}).click()
  assert.deepEqual(await page.evaluate(()=>window.__cloud.stats.oauth),{provider:'google',options:{redirectTo:URL}})
  await page.locator('.modal-auth').getByRole('button',{name:'Log in',exact:true}).first().click()
  await page.getByTestId('login-identifier').fill('cloud@example.test');await page.getByTestId('login-password').fill('cloud-password');await page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('fixture cache full','QuotaExceededError')}});await page.locator('button[type=submit]').click()
  await page.waitForFunction(()=>document.querySelector('.sidebar .profile strong')?.textContent!=='Sign in'&&!document.querySelector('.modal-auth'))
  await page.locator('.sidebar .playlist-link').filter({hasText:'Migrated favorites'}).waitFor()
  await page.evaluate(()=>Storage.prototype.setItem=window.__setItem)
  const migrated=await page.evaluate(()=>window.__cloud.db)
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('echosync_rooms_v3'))[0].id),'integrity-room','cloud hydration preserves original local rooms')
  assert.equal(migrated.profiles[0].liked_tracks[0].id,'chaleya');assert.equal(migrated.playlists[0].visibility,'private');assert.ok(!JSON.stringify(migrated).includes('cloud-password'))
  await page.locator('.modal-settings').getByRole('button',{name:'Close settings'}).click()
  console.log('PASS configured browser: Google redirect contract, async email login, private migration and RAM hydration despite a full cache')
  await page.getByRole('button',{name:'Play Chaleya',exact:true}).first().click();await page.waitForFunction(()=>!document.querySelector('[data-testid=root-audio]').paused)
  await page.evaluate(()=>window.__originalAudio=document.querySelector('[data-testid=root-audio]'))
  await page.evaluate(()=>window.__cloud.refresh());await page.waitForFunction(()=>document.querySelector('[data-testid=root-audio]')===window.__originalAudio&&!window.__originalAudio.paused)
  console.log('PASS session refresh preserves the playing AudioRoot')
  await page.getByTestId('lounge-header-btn').click();const lounge=page.getByTestId('lounge-drawer')
  await lounge.getByRole('button',{name:'Record a Lounge voice note'}).click();await lounge.locator('.recording-console').waitFor();await page.waitForTimeout(800);await lounge.locator('.record-send').click()
  await lounge.getByRole('alert').filter({hasText:'upload failed'}).waitFor();assert.equal(await lounge.getByTestId('voice-note-bubble').count(),0)
  assert.equal(await page.evaluate(()=>window.__cloud.stats.events.filter(e=>e?.message?.type==='voice').length),0)
  await page.screenshot({path:OUT+'/upload-failure.png',animations:'disabled'})
  await page.evaluate(()=>window.__cloud.stats.failedUpload=false);await lounge.getByRole('button',{name:'Retry',exact:true}).click();await lounge.locator('.recording-console').waitFor();await page.waitForTimeout(800);await lounge.locator('.record-send').click()
  await lounge.getByTestId('voice-note-bubble').waitFor();const src=await lounge.getByTestId('voice-note-bubble').locator('audio').getAttribute('src');assert.match(src,/^https:\/\/cloud.test\/storage/)
  await lounge.getByRole('button',{name:'Play voice note'}).click();await lounge.getByRole('button',{name:'Pause voice note'}).waitFor()
  assert.equal(await page.getByTestId('root-audio').evaluate(a=>a===window.__originalAudio),true)
  await page.screenshot({path:OUT+'/cloud-voice.png',animations:'disabled'})
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>window.__cloud.stats.queries)<200,'cloud refresh must not cause a persistence feedback loop')
  console.log('PASS upload failure sends nothing; Retry uploads real recorder bytes, renders HTTPS voice, and preserves AudioRoot')
  await lounge.locator('.social-close').click()
  await page.evaluate(()=>window.__cloud.recover())
  await page.getByRole('heading',{name:'Choose a new password'}).waitFor()
  await page.getByRole('textbox',{name:'New password'}).fill('new-cloud-password')
  await page.getByRole('button',{name:'Update password',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Password updated'}).waitFor()
  assert.deepEqual(await page.evaluate(()=>window.__cloud.stats.updated),{password:'new-cloud-password'})
  assert.equal(await page.evaluate(()=>localStorage.getItem('echosync_users_db').includes('new-cloud-password')),false)
  console.log('PASS PASSWORD_RECOVERY opens a new-password view, calls Auth updateUser, and stores no password locally')
  await context.close()
  const localState=fixtureState({});localState.origins[0].localStorage=localState.origins[0].localStorage.filter(e=>e.name!=='echosync_remember_user_id')
  const local=await browser.newContext({storageState:localState});await installFixtures(local);const localPage=await local.newPage(),requests=[];localPage.on('request',r=>requests.push(r.url()));await localPage.goto(URL,{waitUntil:'domcontentloaded'});await localPage.locator('.quick-main').first().waitFor();await localPage.locator('.sidebar .profile').click();await localPage.getByRole('button',{name:'Continue with Google'}).click();await localPage.getByText('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Google Sign-In',{exact:true}).waitFor();assert.ok(!requests.some(url=>/\/assets\/dist-/.test(url)));await local.close()
  console.log('PASS unconfigured Google action gives setup toast and does not load the SDK')
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
