/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      legacy({
        // Target Chrome 70+ (covers Chrome OS devices from ~2018 onwards)
        targets: ['chrome >= 70', 'firefox >= 68', 'safari >= 12'],
        renderLegacyChunks: true,
      }),
    ],
    build: {
      target: ['es2015', 'chrome70'],
    },
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
