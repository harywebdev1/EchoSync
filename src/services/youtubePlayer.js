let apiPromise

function loadOfficialApi() {
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
  const YT = await loadOfficialApi()
  let disposed = false, verified = false, apiReady = false, ended = false, player
  let watchdog
  const mount = document.createElement('div')
  host.appendChild(mount)
  const fail = (reason) => {
    if (disposed) return
    disposed = true
    clearTimeout(watchdog)
    clearInterval(poll)
    player?.pauseVideo?.()
    onError(reason)
  }
  const arm = () => {
    clearTimeout(watchdog)
    watchdog = setTimeout(() => fail('unavailable'), 12000)
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
    if (status === 1 && desired.playing) { clearTimeout(watchdog); onPlaying() }
    if (!desired.playing && status === 1) player.pauseVideo()
    onProgress(Number(player.getCurrentTime()) || 0, Number(player.getDuration()))
  }, 250)
  arm()
  try { player = new YT.Player(mount, {
    width: 360, height: 240, videoId,
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, origin: window.location.origin },
    events: {
      onReady: () => { if (disposed) return; apiReady = true; player.mute(); sync() },
      onStateChange: event => {
        if (disposed || !validate()) return
        if (event.data === 1 && state().playing) { ended = false; clearTimeout(watchdog); onPlaying() }
        if (event.data === 0 && !ended && state().playing) { ended = true; onEnded() }
      },
      onError: () => fail('unavailable'),
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
    seekTo: time => { if (apiReady && verified) { ended = false; player.seekTo(time, true); if (!state().playing) player.pauseVideo() } },
    setVolume: () => { if (apiReady) player.setVolume(Math.round(state().volume * 100)) },
    destroy: () => { disposed = true; clearTimeout(watchdog); clearInterval(poll); player.destroy(); mount.remove() },
  }
}
