import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// API_TARGET env var can override the proxy target (default: localhost:7071)
// For WSL setup, start-dev.ps1 will auto-update the target IP in this file
const apiTarget = process.env.API_TARGET || 'http://localhost:7071';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
