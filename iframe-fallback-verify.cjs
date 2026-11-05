const assert = require('node:assert/strict')
const { fixtureState, installFixtures } = require('./integrity-fixtures.cjs')

// Controlled API-boundary tests only. These are NOT live YouTube/audio measurements.
async function installOfficialPlayerDouble(context, { fail = false, seconds = 180, timeout = false } = {}) {
  await context.route('**/api/youtube-audio?*', async route => {
    if (timeout) await new Promise(resolve => setTimeout(resolve, 6000))
    await route.fulfill({status:502,contentType:'application/json',body:'{"error":"controlled direct-path failure"}'}).catch(()=>{})
  })
  await context.addInitScript(({fail,seconds}) => {
    const library=JSON.parse(localStorage.getItem('echosync.library.v1'))
    for(const [id,entry] of Object.entries(library)) entry.track={...entry.track,streamUrl:null,previewUrl:null,preview:false,status:'pending',youtubeVideoId:(id.replace(/[^A-Za-z0-9_-]/g,'')+'XXXXXXXXXXX').slice(0,11)}
    localStorage.setItem('echosync.library.v1',JSON.stringify(library))
    localStorage.removeItem('echosync_stream_cache_v4')
    window.__playerDouble=[]
    window.__sessionActions={}
    const set=navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
    navigator.mediaSession.setActionHandler=(action,handler)=>{window.__sessionActions[action]=handler;return set(action,handler)}
    window.YT={Player:class {
      constructor(host,options){
        this.options=options;this.time=0;this.total=seconds;this.status=-1;this.muted=true;this.volume=100
        this.frame=document.createElement('iframe');this.frame.src='about:blank';host.replaceWith(this.frame)
        window.__playerDouble.push(this)
        this.timer=setInterval(()=>{if(this.status===1){this.time+=.05;if(this.time>=this.total){this.status=0;this.options.events.onStateChange({data:0})}}},50)
        setTimeout(()=>fail?options.events.onError({data:150}):options.events.onReady({target:this}),0)
      }
      playVideo(){if(this.status===1)return;if(this.time>=this.total)this.time=0;this.status=1;this.options.events.onStateChange({data:1})}
      pauseVideo(){this.status=2}
      seekTo(time){this.time=time}
      mute(){this.muted=true}
      unMute(){this.muted=false}
      setVolume(volume){this.volume=volume}
      getCurrentTime(){return this.time}
      getDuration(){return this.total}
      getPlayerState(){return this.status}
      getPlaybackRate(){return 1}
      destroy(){clearInterval(this.timer);this.frame.remove()}
    }}
  },{fail,seconds})
}
const playing = page => page.waitForFunction(()=>{const p=window.__playerDouble.at(-1);const id=document.querySelector('[data-testid=audio-root]').dataset.trackId;const videoId=id.startsWith('yt-')?id.slice(3):(id.replace(/[^A-Za-z0-9_-]/g,'')+'XXXXXXXXXXX').slice(0,11);return p?.options.videoId===videoId&&p.status===1&&!p.muted&&p.time>.1})

module.exports=async function verifyIframeFallback({browser,check,open}){
  await check('IFrame boundary: extraction failure preserves root audio, solo controls and Media Session',{},async page=>{
    await installOfficialPlayerDouble(page.context())
    await open(page)
    const root=await page.getByTestId('root-audio').elementHandle()
    await page.getByRole('button',{name:'Play Chaleya',exact:true}).first().click()
    await playing(page)
    assert.equal(await page.getByTestId('root-audio').evaluate((node,old)=>node===old,root),true)
    assert.equal(await page.getByTestId('root-audio').evaluate(node=>node.paused),true)
    assert.equal(await page.locator('.es-toast-message').filter({hasText:/unavailable|Playing "/}).count(),0)
    await page.evaluate(()=>window.__sessionActions.pause())
    await page.waitForFunction(()=>window.__playerDouble.at(-1).status===2)
    await page.evaluate(()=>window.__sessionActions.seekto({seekTime:42}))
    assert.equal(await page.evaluate(()=>window.__playerDouble.at(-1).time),42)
    assert.equal(await page.evaluate(()=>window.__playerDouble.at(-1).status),2)
    await page.evaluate(()=>window.__sessionActions.play())
    await playing(page)
    const first=await page.getByTestId('audio-root').getAttribute('data-track-id')
    await page.evaluate(()=>window.__sessionActions.nexttrack())
    await page.waitForFunction(id=>document.querySelector('[data-testid=audio-root]').dataset.trackId!==id,first)
    await playing(page)
    await page.evaluate(()=>window.__sessionActions.previoustrack())
    await page.waitForFunction(id=>document.querySelector('[data-testid=audio-root]').dataset.trackId===id,first)
    await playing(page)
    await page.locator('.player-dock input[aria-label=Volume]').fill('0.3')
    await page.waitForFunction(()=>window.__playerDouble.at(-1).volume<=30)
    assert.ok(await page.evaluate(()=>navigator.mediaSession.metadata?.title))
    await page.evaluate(()=>{const p=window.__playerDouble.at(-1);p.time=p.total-.01})
    await page.waitForFunction(id=>document.querySelector('[data-testid=audio-root]').dataset.trackId!==id,first)
    await playing(page)
  })
  await check('IFrame boundary: stalled extraction hands off within the 3.5s client deadline',{},async page=>{
    await installOfficialPlayerDouble(page.context(),{timeout:true})
    await open(page)
    const start=Date.now()
    await page.getByRole('button',{name:'Play Chaleya',exact:true}).first().click()
    await playing(page)
    assert.ok(Date.now()-start<5500,'Fallback exceeded deadline plus player setup allowance')
    assert.equal(await page.locator('.es-toast-message').filter({hasText:/unavailable/}).count(),0)
  })
  await check('IFrame boundary: both failed paths show one terminal error; short embeds never unmute',{},async page=>{
    await installOfficialPlayerDouble(page.context(),{fail:true})
    await open(page)
    await page.getByRole('button',{name:'Play Chaleya',exact:true}).first().click()
    await page.locator('.es-toast-message').filter({hasText:'Audio stream unavailable'}).waitFor()
    assert.equal(await page.locator('.es-toast-card').count(),1)
    assert.equal(await page.getByTestId('root-audio').evaluate(node=>node.paused),true)
  })
  await check('IFrame boundary: actual 30s duration is blocked before unmuting',{},async page=>{
    await installOfficialPlayerDouble(page.context(),{seconds:30})
    await open(page)
    await page.getByRole('button',{name:'Play Chaleya',exact:true}).first().click()
    await page.locator('.es-toast-message').filter({hasText:'Track blocked'}).waitFor()
    assert.equal(await page.evaluate(()=>window.__playerDouble.every(player=>player.muted)),true)
  })
  await check('IFrame boundary: Room pause, play, seek, next and previous converge in two contexts',{roomPeer:true},async admin=>{
    const context=await browser.newContext({viewport:{width:1440,height:900},storageState:fixtureState({roomPeer:true,activeUser:'peer'})})
    await installFixtures(context)
    const member=await context.newPage(), pages=[admin,member]
    try{
      for(const page of pages){
        await installOfficialPlayerDouble(page.context())
        await page.exposeBinding('__relayIframeRoom',async({page:source},data)=>{for(const peer of pages)if(peer!==source&&!peer.isClosed())await peer.evaluate(data=>{for(const channel of window.__iframeChannels||[])channel.onmessage?.({data})},data)})
        await page.addInitScript(()=>{
          const Native=BroadcastChannel;window.__iframeChannels=[]
          window.BroadcastChannel=class{
            constructor(name){this.name=name;if(name!=='echosync-room-sync'){this.native=new Native(name);this.native.onmessage=e=>this.onmessage?.(e)}else window.__iframeChannels.push(this)}
            postMessage(data){if(this.native)this.native.postMessage(data);else window.__relayIframeRoom(data)}
            close(){this.native?.close();window.__iframeChannels=window.__iframeChannels.filter(c=>c!==this)}
          }
        })
        await open(page)
        await page.getByRole('button',{name:/Integrity Room/}).first().click()
        await page.locator('.room-head').waitFor()
      }
      await admin.locator('.player-dock .dock-play').click()
      await playing(admin);await playing(member)
      await admin.locator('.player-dock .dock-play').click()
      for(const page of pages)await page.waitForFunction(()=>window.__playerDouble.at(-1).status===2)
      await admin.evaluate(()=>window.__sessionActions.seekto({seekTime:40}))
      for(const page of pages)await page.waitForFunction(()=>Math.abs(window.__playerDouble.at(-1).time-40)<.3)
      assert.equal(await member.evaluate(()=>window.__playerDouble.at(-1).status),2)
      await admin.locator('.player-dock .dock-play').click()
      for(const page of pages)await playing(page)
      const first=await admin.getByTestId('audio-root').getAttribute('data-track-id')
      await admin.locator('.player-dock [aria-label="Next track"]').click()
      for(const page of pages){await page.waitForFunction(id=>document.querySelector('[data-testid=audio-root]').dataset.trackId!==id,first);await playing(page)}
      await admin.locator('.player-dock [aria-label="Previous track"]').click()
      for(const page of pages){await page.waitForFunction(id=>document.querySelector('[data-testid=audio-root]').dataset.trackId===id,first);await playing(page)}
      await admin.evaluate(()=>{const p=window.__playerDouble.at(-1);p.time=p.total-.01})
      for(const page of pages){await page.waitForFunction(id=>document.querySelector('[data-testid=audio-root]').dataset.trackId!==id,first);await playing(page)}
    }finally{await context.close()}
  })
}
