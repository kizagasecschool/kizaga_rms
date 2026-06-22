/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/auth': {
          target: env.VITE_SUPABASE_URL + '/auth/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/auth/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('apikey', env.SUPABASE_SERVICE_ROLE_KEY)
              proxyReq.setHeader('Authorization', 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY)
            })
          },
        },
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
