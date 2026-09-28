import fs from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Browsers only allow live camera access (getUserMedia) on https:// or
// localhost -- a phone opening http://<lan-ip>:5173 gets no camera. If
// scripts/make_https_cert.sh has generated a cert, serve the dev server
// over https so phones on the LAN can use the live camera too.
const certDir = new URL('../data/certs/', import.meta.url)
const certFile = new URL('cert.pem', certDir)
const keyFile = new URL('key.pem', certDir)
const https = fs.existsSync(certFile) && fs.existsSync(keyFile)
  ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  : undefined

// Two backends in development:
//  - the C# API (genisis_Hub, `dotnet run` -> http://localhost:5044) owns all
//    data: auth, events, photos, search, analytics, avatars (/uploads);
//  - the Python face engine (scripts/run_face_search.sh -> port 8002) is only
//    called directly by the /lab tool; the C# API talks to it server-side.
// The Python server serves https whenever data/certs exists.
const api = process.env.VITE_API || 'http://localhost:5044'
const face = process.env.VITE_FACE_ENGINE || `${https ? 'https' : 'http'}://127.0.0.1:8002`

const to = (target) => ({ target, changeOrigin: true, secure: false })

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on the LAN so phones can open it
    https,
    // Dev-time only: the browser talks to one origin, so there's no CORS.
    // More specific paths first -- the first matching key wins.
    proxy: {
      '/api/analyze': to(face),
      '/api/query': to(face),
      '/api': to(api),
      '/uploads': to(api),
    },
  },
})
