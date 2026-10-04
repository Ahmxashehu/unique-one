import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{css,html,ico,png,svg,webmanifest,js}'],
        runtimeCaching: [{
          urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
          handler: 'NetworkFirst',
          options: { cacheName: 'unique-platform-app-assets-v5', expiration: { maxEntries: 100, maxAgeSeconds: 604800 } },
        }],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/(?!api(?:\/|$)).*/],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: true, type: 'module', navigateFallbackAllowlist: [/^\/(?!api(?:\/|$)).*/] },
      manifest: {
        id: '/', start_url: '/', scope: '/', name: 'UniquePlatform', short_name: 'UniquePlatform',
        description: 'The public ecosystem powered by UniquePlatform and UniqueOS.', theme_color: '#ffffff', background_color: '#ffffff', display: 'standalone',
        icons: [
          { src: 'unique-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-maskable-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  server: { hmr: process.env.DISABLE_HMR !== 'true', watch: process.env.DISABLE_HMR === 'true' ? null : {} },
}));
