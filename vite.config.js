import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['zyvra.svg'],
      manifest: {
        name: 'ZYVRA - Exam Prep',
        short_name: 'ZYVRA',
        description: 'A focused preparation space for competitive exams.',
        theme_color: '#07120f',
        background_color: '#07120f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/zyvra.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/zyvra.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
