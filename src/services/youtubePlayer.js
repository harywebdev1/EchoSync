let apiPromise

export function warmYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const script = document.createElement('script')
    const finish = () => { clearTimeout(timer); resolve(window.YT) }
    const fail = () => { clearTimeout(timer); apiPromise = null; script.remove(); reject(new Error('YouTube player API unavailable')) }
    const timer = setTimeout(fail, 8000)
    window.onYouTubeIframeAPIReady = () => { try { previous?.() } finally { finish() } }
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = fail
    document.head.appendChild(script)
  })
  return apiPromise
}

// Official embed only. Mobile web may suspend YouTube during screen lock;
// reliable native background/lock-screen playback belongs to Expo phase 4.
export async function createYouTubeBridge({ host, videoId, state, onDuration, onProgress, onPlaying, onEnded, onError, onBlocked }) {
  const YT = await warmYouTubeApi()
  let disposed = false, verified = false, apiReady = false, ended = false, player
  let lastTime = 0, lastAdvanceAt = Date.now()
  let watchdog
  const mount = document.createElement('div')
  host.appendChild(mount)
  const fail = (reason, code) => {
    if (disposed) return
    disposed = true
    clearTimeout(watchdog)
    clearInterval(poll)
    player?.pauseVideo?.()
    onError(reason, code)
  }
  const arm = (timeout = 4000) => {
    lastAdvanceAt=Date.now();lastTime=Number(player?.getCurrentTime?.()) || 0
    clearTimeout(watchdog)
    watchdog = setTimeout(() => fail('unavailable'), timeout)
  }
  const sync = () => {
    if (!apiReady || disposed) return
    const desired = state()
    player.setVolume(Math.round(Math.max(0, Math.min(1, desired.volume)) * 100))
    if (!verified) { player.mute(); player.playVideo(); return }
    if (desired.playing) { player.unMute(); player.playVideo(); arm() }
    else { player.pauseVideo(); clearTimeout(watchdog) }
  }
  const validate = () => {
    if (!apiReady || disposed) return false
    const total = Number(player.getDuration())
    if (!Number.isFinite(total) || total <= 0) return false
    if (total < 60) { fail('short'); return false }
    if (!verified) {
      verified = true
      const target = state().time || 0
      onDuration(total)
      player.seekTo(Math.max(0, Math.min(total, target)), true)
      sync()
    }
    return true
  }
  const poll = setInterval(() => {
    if (!validate()) return
    const desired = state()
    const status = player.getPlayerState()
    if (desired.playing) {
      const time = Number(player.getCurrentTime()) || 0
      if (time > lastTime + .01) { lastTime=time; lastAdvanceAt=Date.now(); clearTimeout(watchdog); if(status===1) onPlaying() }
      else if (Date.now()-lastAdvanceAt>=4000) { fail('unavailable'); return }
    } else { lastAdvanceAt=Date.now(); lastTime=Number(player.getCurrentTime()) || 0 }
    if (!desired.playing && status === 1) player.pauseVideo()
    onProgress(Number(player.getCurrentTime()) || 0, Number(player.getDuration()))
  }, 250)
  // Bound the embed handshake separately; the 4s advancing-clock deadline
  // begins when the official player is ready to accept its first play call.
  arm(8000)
  try { player = new YT.Player(mount, {
    width: 360, height: 240, videoId,
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, origin: window.location.origin },
    events: {
      onReady: () => { if (disposed) return; apiReady = true; arm(); player.mute(); sync() },
      onStateChange: event => {
        if (disposed || !validate()) return
        if (event.data === 1 && state().playing) { ended = false; onPlaying() }
        if (event.data === 0 && !ended && state().playing) { ended = true; onEnded() }
      },
      onError: event => fail('unavailable', event.data),
      onAutoplayBlocked: () => { if (!disposed) { clearTimeout(watchdog); onBlocked() } },
    },
  }) } catch (error) { clearInterval(poll); clearTimeout(watchdog); mount.remove(); throw error }
  return {
    active: true,
    get ready() { return verified && !disposed },
    getCurrentTime: () => verified ? Number(player.getCurrentTime()) || 0 : 0,
    getDuration: () => verified ? Number(player.getDuration()) || 0 : 0,
    getPlaybackRate: () => Number(player.getPlaybackRate?.()) || 1,
    playVideo: () => { if (apiReady && !disposed) { if (verified) player.unMute(); player.playVideo(); arm() } },
    pauseVideo: () => { if (apiReady) player.pauseVideo(); clearTimeout(watchdog) },
    seekTo: time => { if (apiReady && verified) { ended = false; clearTimeout(watchdog); lastTime=Math.max(0,Number(time)||0); lastAdvanceAt=Date.now(); player.seekTo(time, true); if (!state().playing) player.pauseVideo() } },
    setVolume: () => { if (apiReady) player.setVolume(Math.round(state().volume * 100)) },
    destroy: () => { disposed = true; clearTimeout(watchdog); clearInterval(poll); player.destroy(); mount.remove() },
  }
}
