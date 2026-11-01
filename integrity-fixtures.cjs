// Test-only audio and catalog. Never imported by application code.
const fs = require('node:fs')
const vm = require('node:vm')
const app = fs.readFileSync(`${__dirname}/src/lib/appServices.js`, 'utf8')
const seeds = vm.runInNewContext(app.slice(app.indexOf('const SEED_TRACKS = '), app.indexOf('const SEED_BY_ID')) + '\nSEED_TRACKS')
const APP_URL = process.env.ECHOSYNC_URL || 'http://127.0.0.1:5173'

function wav(seconds = 180) {
  const rate = 8000
  const bytes = seconds * rate * 2
  const data = Buffer.alloc(44 + bytes)
  data.write('RIFF', 0); data.writeUInt32LE(36 + bytes, 4); data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22)
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28)
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34)
  data.write('data', 36); data.writeUInt32LE(bytes, 40)
  for (let i = 0; i < bytes / 2; i++) data.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / rate) * 300), 44 + i * 2)
  return data
}

function fixtureState({ duration = 180, streamSeconds = 180, trackOverrides = {}, multiArtist = false, roomPeer = false, activeUser = 'integrity' } = {}) {
  const ordered = [...seeds.filter(track => ['chaleya', 'excuses'].includes(track.id)), ...seeds.filter(track => !['chaleya', 'excuses'].includes(track.id))]
  const tracks = ordered.map(track => ({ ...track, duration, streamUrl: `https://aac.saavncdn.com/integrity/${track.id}.wav?seconds=${streamSeconds}`, preview: false, status: 'ready', ...(multiArtist ? {artist:(track.id==='kesariya'?'Samar Jafri':'Abdul Hannan')+', Murtaza Qizilbash',artists:[{name:track.id==='kesariya'?'Samar Jafri':'Abdul Hannan'},{name:'Murtaza Qizilbash'}]}:{}), ...trackOverrides[track.id] }))
  const user = { id: 'integrity', name: 'Integrity Tester', handle: 'integrity', email: 'integrity@example.test', password: 'test-only', showActivity: true, allowInvites: true }
  const date = new Date().toISOString().slice(0, 10)
  const values = {
    echosync_stream_cache_v4:{searches:{},streams:Object.fromEntries(tracks.map(track=>{const videoId=(track.id.replace(/[^A-Za-z0-9_-]/g,'')+'XXXXXXXXXXX').slice(0,11);return ['yt:'+videoId,{ts:Date.now(),track:{...track,id:'yt-'+videoId,provider:'youtube',youtubeVideoId:videoId}}]}))},
    echosync_users_db: { integrity: user, ...(roomPeer?{peer:{...user,id:'peer',name:'Peer Listener',handle:'peer',email:'peer@example.test'}}:{}) },
    ...(multiArtist?{'echosync_taste_profile_v1':{integrity:{artists:{'abdul hannan':{name:'Abdul Hannan',weight:10}},events:1}},'echosync.likes.v1':{integrity:tracks.slice(0,4).map(t=>t.id)},echosync_recent_v1:{integrity:tracks.slice(0,4).map(t=>t.id)}}:{}),
    'echosync.library.v1': Object.fromEntries(tracks.map(track => [track.id, { savedAt: Date.now(), track }])),
    [`echosync_daily_feed_v3_${date}`]: { dayKey: date, builtAt: Date.now(), trending: tracks, users: { integrity: { madeForYou: tracks, basedOnRecent: tracks } } },
    echosync_rooms_v3: [{ id: 'integrity-room', name: 'Integrity Room', code: 'ES-TEST', private: true, members: roomPeer?['integrity','peer']:['integrity'], roles: { integrity: 'admin', ...(roomPeer?{peer:'listener'}:{}) }, trackIds: tracks.map(track => track.id) }],
  }
  return { cookies: [], origins: [{ origin: APP_URL, localStorage: [
    ...Object.entries(values).map(([name, value]) => ({ name, value: JSON.stringify(value) })),
    { name: 'echosync_remember_user_id', value: activeUser },
  ] }] }
}

async function installFixtures(context) {
  // Fixture accounts stay local even when the production build has cloud env vars.
  await context.addInitScript(()=>{window.__ECHOSYNC_SUPABASE__ ||= {url:'',key:''}})
  const stored = (await context.storageState()).origins.find(origin => origin.origin === APP_URL)?.localStorage || []
  const configured = JSON.parse(stored.find(entry => entry.name === 'echosync.library.v1')?.value || '{}')
  const audio = new Map()
  await context.route('**/*', async route => {
    let url = new URL(route.request().url())
    if(url.pathname==='/api/youtube-audio') {
      const id=url.searchParams.get('videoId');const seed=seeds.find(track=>(track.id.replace(/[^A-Za-z0-9_-]/g,'')+'XXXXXXXXXXX').slice(0,11)===id);const track=configured[seed?.id]?.track
      return route.fulfill({contentType:'application/json',body:JSON.stringify({url:track?.streamUrl||'https://aac.saavncdn.com/integrity/fixture.wav?seconds=180',duration:Number(new URL(track?.streamUrl||'https://aac.saavncdn.com/?seconds=180').searchParams.get('seconds'))||180,mimeType:'audio/wav'})})
    }
    if(url.pathname==='/api/media' && url.searchParams.has('url'))url=new URL(url.searchParams.get('url'))
    if (url.hostname === 'aac.saavncdn.com') {
      const seconds = Number(url.searchParams.get('seconds')) || 180
      if (!audio.has(seconds)) audio.set(seconds, wav(seconds))
      const body = audio.get(seconds)
      const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/)
      const start = range ? Number(range[1]) : 0
      const end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1
      return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', headers: {
        'accept-ranges': 'bytes', 'access-control-allow-origin': '*', 'cache-control': 'no-store',
        ...(range ? { 'content-range': `bytes ${start}-${end}/${body.length}` } : {}),
      }, body: body.subarray(start, end + 1) })
    }
    if (url.origin === APP_URL && !url.pathname.startsWith('/api/')) return route.continue()
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#426"/></svg>' })
    if (url.pathname === '/api/ytmusic') {
      const action = url.searchParams.get('action') || 'search'
      if (action === 'artist') return route.fulfill({contentType:'application/json',body:JSON.stringify({name:url.searchParams.get('name')||'Abdul Hannan',browseId:'UC-fixture',songs:Object.values(configured).map(({track})=>({videoId:(track.id+'XXXXXXXXXXX').slice(0,11),title:track.title,artists:track.artists||[{name:track.artist}],artist:track.artist,album:{name:track.title},duration:180})),albums:[],relatedArtists:[]})})
      if (action !== 'search') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ songs: [] }) })
      const query = (url.searchParams.get('q') || '').toLowerCase().trim()
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 50))
      const songs = seeds
        .filter(seed => {
          const title = seed.title.toLowerCase()
          const artist=(configured[seed.id]?.track?.artist||seed.artist||'').toLowerCase()
          return query && (title.includes(query) || query.includes(title) || artist.split(/,|&/).some(name=>query.includes(name.trim())||name.trim().includes(query)))
        })
        .slice(0, limit)
        .map(seed => ({
          videoId: (seed.id.replace(/[^A-Za-z0-9_-]/g, '') + 'XXXXXXXXXXX').slice(0, 11),
          title: seed.title,
          artists: configured[seed.id]?.track?.artists || [{ name: seed.artist }],
          artist: configured[seed.id]?.track?.artist || seed.artist,
          album: { name: seed.album },
          duration: seed.duration,
          cover: seed.cover,
        }))
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ songs }) })
    }
    if (url.pathname.includes('/api/search/songs') || url.pathname.includes('/api/songs/')) {
      const songs = seeds.map(seed => { const track = configured[seed.id]?.track || seed; return ({ id: track.id, name: track.title, duration: track.duration, primaryArtists: track.artist, album: { name: track.album }, image: [], downloadUrl: [{ quality: '320kbps', url: (track.streamUrl || `https://aac.saavncdn.com/integrity/${track.id}.wav?seconds=180`) + '&resolved=1' }] }) })
      const data = url.pathname.includes('/api/search/songs') ? { results: songs } : songs.filter(song => url.pathname.endsWith(`/${song.id}`))
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) })
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { results: [] }, results: [] }) })
  })
}

module.exports = { fixtureState, installFixtures, wav }
