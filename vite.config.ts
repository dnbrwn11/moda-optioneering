import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone, offline. No proxy, no external services.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
})
