import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = (target, rewrite) => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite,
})

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/saavn': proxy('https://saavn.sumit.co', (path) => path.replace(/^\/api\/saavn/, '')),
      '/api/piped/kavin': proxy('https://pipedapi.kavin.rocks', (path) => path.replace(/^\/api\/piped\/kavin/, '')),
      '/api/piped/coffee': proxy('https://api.piped.private.coffee', (path) => path.replace(/^\/api\/piped\/coffee/, '')),
      '/api/piped/adminforge': proxy('https://pipedapi.adminforge.de', (path) => path.replace(/^\/api\/piped\/adminforge/, '')),
      '/api/invidious/tux': proxy('https://inv.tux.pizza', (path) => path.replace(/^\/api\/invidious\/tux/, '')),
      '/api/invidious/nerd': proxy('https://invidious.nerdvpn.de', (path) => path.replace(/^\/api\/invidious\/nerd/, '')),
    },
  },
})
