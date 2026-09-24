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

// Where the face-search backend (app/web/face_search_server.py) listens --
// must match scripts/run_face_search.sh's PORT (8002 by default; 8001 on this
// server is the separate attendance backend). The backend serves https
// whenever data/certs exists, plain http otherwise.
const backendScheme = https ? 'https' : 'http'
const backend = process.env.VITE_BACKEND || `${backendScheme}://127.0.0.1:8002`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on the LAN so phones can open it
    https,
    proxy: {
      // Dev-time only: forwards /api/* to the FastAPI backend so the
      // browser never needs to know its port, and there's no CORS to deal
      // with. In production uvicorn serves the built frontend itself.
      '/api': {
        target: backend,
        changeOrigin: true,
        secure: false, // backend may use the self-signed cert
      },
    },
  },
})
