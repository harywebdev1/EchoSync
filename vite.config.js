import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ytmusicHandler } from './server/ytmusicHandler.js'
import { mediaHandler } from './server/media.js'
import { youtubeAudioHandler } from './server/youtubeAudio.js'

function streamRoutes() {
  const register = server => {
    server.middlewares.use('/api/ytmusic', ytmusicHandler)
    // Legacy alias kept for bookmarks and older clients served from the same origin.
    server.middlewares.use('/api/saavn', ytmusicHandler)
    server.middlewares.use('/api/media', mediaHandler)
    server.middlewares.use('/api/youtube/audio', youtubeAudioHandler)
    server.middlewares.use('/api/youtube-audio', youtubeAudioHandler)
  }
  return { name: 'echosync-stream-routes', configureServer: register, configurePreviewServer: register }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), streamRoutes()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
