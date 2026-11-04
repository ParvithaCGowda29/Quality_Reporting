import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Always serve on 5176 (5173 Masters, 5174 Pipeline, 5175 taken), so both run side by side; fail loudly instead of drifting.
  server: {
    port: 5176,
    strictPort: true,
    // Quality Reporting backend (server/) runs on 8787; the UI talks to it at /api.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
  preview: { port: 5176, strictPort: true },
})
