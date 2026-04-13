import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward API requests in local development to ASP.NET backend.
      '/api': {
        target: 'http://localhost:5288',
        changeOrigin: true,
      },
    },
  },
})
