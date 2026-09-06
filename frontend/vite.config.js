import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'pwa-icon.svg', 'apple-touch-icon.svg'],
      manifest: {
        name: 'YEBHE — Gestion Magasins',
        short_name: 'YEBHE',
        description: 'Plateforme SaaS de gestion de magasins, POS et stock',
        theme_color: '#12151a',
        background_color: '#12151a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '192x192 256x256 384x384 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/favicon.svg',
            sizes: '48x48',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/media\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && !url.pathname.startsWith('/api'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-shell',
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkOnly',
            options: {
              plugins: [
                {
                  handlerDidError: async ({ request }) => {
                    return new Response(
                      JSON.stringify({ detail: 'Hors ligne' }),
                      {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'application/json' },
                      }
                    );
                  },
                  fetchDidFail: async ({ request }) => {
                    return new Response(
                      JSON.stringify({ detail: 'Hors ligne' }),
                      {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'application/json' },
                      }
                    );
                  },
                },
              ],
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  }
})
