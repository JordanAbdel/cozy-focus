import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Cozy Focus',
        short_name: 'Cozy Focus',
        description: 'An ambient focus timer — rain, fire and a countdown you can leave running.',
        // Both the app's --ink, so the splash and status bar match the screen.
        theme_color: '#0E0906',
        background_color: '#0E0906',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The ambience is the one thing that must survive going offline. The
        // largest file is rain.mp3 at 704K, inside workbox's 2MB default cap.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3}'],
      },
    }),
  ],
})
