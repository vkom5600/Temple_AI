import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In development the browser calls /api on the Vite server, which forwards to the backend.
// Set VITE_API_PROXY_TARGET in frontend/.env if your backend isn't on port 5000.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
      },
    },
  }
})
