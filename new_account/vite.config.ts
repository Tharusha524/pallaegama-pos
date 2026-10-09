import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget =
    env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000'
  const rawBasePath = (env.VITE_APP_BASE_PATH?.trim() || '/sky_erp').replace(/^\/+|\/+$/g, '')
  // A packaged desktop app (Tauri) serves the built files from its own local
  // root, not a web-server subpath — "." means "relative asset paths" so the
  // build works no matter where Tauri actually serves it from.
  const basePath = rawBasePath === '.' ? './' : `/${rawBasePath}/`

  const isDesktop = mode === 'desktop'

  return {
  base: isDesktop ? './' : basePath,
  plugins: [
    react(),
    !isDesktop && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Pallegama POS',
        short_name: 'POS',
        description: 'Pallegama Stores Enterprise POS System',
        theme_color: '#1a3a6b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: null,
      },
    }),
  ].filter(Boolean),
  server: {
    // Optional: set VITE_API_BASE_URL=/api in .env.local to proxy to local Laravel
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          mui: ["@mui/material", "@mui/icons-material"],
          lodash: ["lodash"],
        },
      },
    },
  },
  };
});
