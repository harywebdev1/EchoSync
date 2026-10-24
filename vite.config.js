import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { saavnHandler } from './server/saavn.js'
import { mediaHandler } from './server/media.js'
import { youtubeAudioHandler } from './server/youtubeAudio.js'

function streamRoutes() {
  const register = server => {
    server.middlewares.use('/api/saavn', saavnHandler)
    server.middlewares.use('/api/media', mediaHandler)
    server.middlewares.use('/api/youtube/audio', youtubeAudioHandler)
    server.middlewares.use('/api/youtube-audio', youtubeAudioHandler)
  }
  return { name: 'echosync-stream-routes', configureServer: register, configurePreviewServer: register }
}

const proxy = (target, rewrite) => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite,
  configure: (proxy) => {
    proxy.on('proxyRes', (proxyRes) => {
      delete proxyRes.headers['www-authenticate']
      delete proxyRes.headers['WWW-Authenticate']
      delete proxyRes.headers['proxy-authenticate']
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), streamRoutes()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/piped/kavin': proxy('https://pipedapi.kavin.rocks', (path) => path.replace(/^\/api\/piped\/kavin/, '')),
      '/api/piped/coffee': proxy('https://api.piped.private.coffee', (path) => path.replace(/^\/api\/piped\/coffee/, '')),
      '/api/piped/adminforge': proxy('https://pipedapi.adminforge.de', (path) => path.replace(/^\/api\/piped\/adminforge/, '')),
      '/api/piped/ducks': proxy('https://pipedapi.ducks.party', (path) => path.replace(/^\/api\/piped\/ducks/, '')),
      '/api/invidious/tux': proxy('https://inv.tux.pizza', (path) => path.replace(/^\/api\/invidious\/tux/, '')),
      '/api/invidious/nerd': proxy('https://invidious.nerdvpn.de', (path) => path.replace(/^\/api\/invidious\/nerd/, '')),
      '/api/invidious/f5': proxy('https://invidious.f5.si', (path) => path.replace(/^\/api\/invidious\/f5/, '')),
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api/piped/kavin': proxy('https://pipedapi.kavin.rocks', (path) => path.replace(/^\/api\/piped\/kavin/, '')),
      '/api/piped/coffee': proxy('https://api.piped.private.coffee', (path) => path.replace(/^\/api\/piped\/coffee/, '')),
      '/api/piped/adminforge': proxy('https://pipedapi.adminforge.de', (path) => path.replace(/^\/api\/piped\/adminforge/, '')),
      '/api/piped/ducks': proxy('https://pipedapi.ducks.party', (path) => path.replace(/^\/api\/piped\/ducks/, '')),
      '/api/invidious/tux': proxy('https://inv.tux.pizza', (path) => path.replace(/^\/api\/invidious\/tux/, '')),
      '/api/invidious/nerd': proxy('https://invidious.nerdvpn.de', (path) => path.replace(/^\/api\/invidious\/nerd/, '')),
      '/api/invidious/f5': proxy('https://invidious.f5.si', (path) => path.replace(/^\/api\/invidious\/f5/, '')),
    },
  },
})
