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

function fixtureState({ duration = 180, streamSeconds = 180 } = {}) {
  const ordered = [...seeds.filter(track => ['chaleya', 'excuses'].includes(track.id)), ...seeds.filter(track => !['chaleya', 'excuses'].includes(track.id))]
  const tracks = ordered.map(track => ({ ...track, duration, streamUrl: `https://aac.saavncdn.com/integrity/${track.id}.wav?seconds=${streamSeconds}`, preview: false, status: 'ready' }))
  const user = { id: 'integrity', name: 'Integrity Tester', handle: 'integrity', email: 'integrity@example.test', password: 'test-only', showActivity: true, allowInvites: true }
  const date = new Date().toISOString().slice(0, 10)
  const values = {
    echosync_users_db: { integrity: user },
    'echosync.library.v1': Object.fromEntries(tracks.map(track => [track.id, { savedAt: Date.now(), track }])),
    [`echosync_daily_feed_v3_${date}`]: { dayKey: date, builtAt: Date.now(), trending: tracks, users: { integrity: { madeForYou: tracks, basedOnRecent: tracks } } },
    echosync_rooms_v3: [{ id: 'integrity-room', name: 'Integrity Room', code: 'ES-TEST', private: true, members: ['integrity'], roles: { integrity: 'admin' }, trackIds: tracks.map(track => track.id) }],
  }
  return { cookies: [], origins: [{ origin: APP_URL, localStorage: [
    ...Object.entries(values).map(([name, value]) => ({ name, value: JSON.stringify(value) })),
    { name: 'echosync_remember_user_id', value: 'integrity' },
  ] }] }
}

async function installFixtures(context) {
  const audio = new Map()
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
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
    if (url.pathname.includes('/api/search/songs') || url.pathname.includes('/api/songs/')) {
      const songs = seeds.map(track => ({ id: track.id, name: track.title, duration: 180, primaryArtists: track.artist, album: { name: track.album }, image: [], downloadUrl: [{ quality: '320kbps', url: `https://aac.saavncdn.com/integrity/${track.id}.wav?seconds=180&resolved=1` }] }))
      const data = url.pathname.includes('/api/search/songs') ? { results: songs } : songs.filter(song => url.pathname.endsWith(`/${song.id}`))
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) })
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { results: [] }, results: [] }) })
  })
}

module.exports = { fixtureState, installFixtures, wav }
