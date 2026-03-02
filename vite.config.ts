import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    injectRegister: "script",

    manifest: {
      name: 'fappachino',
      short_name: 'fappachino',
      description: 'keep track of your gooning addiction',
      theme_color: '#000000',

      icons: [{
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      }, {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      }, {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      }, {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }],
    },

    workbox: {
      // runtimeCaching: [{
      //   urlPattern: /^https:\/\/api\.example\.com\/.*$/i,
      //   handler: 'NetworkFirst',// <--- THIS IS THE KEY
      //   options: {
      //     cacheName: 'api-cache', expiration: {
      //       maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Days
      //     }, networkTimeoutSeconds: 10// Optional: Fallback to cache if network is slow
      //   }
      // }],
      globPatterns: ['**/*.{js,css,html,png,ico}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
    },

    devOptions: {
      enabled: false,
      navigateFallback: 'index.html',
      suppressWarnings: false,
      type: 'module',
    },
  })],
})