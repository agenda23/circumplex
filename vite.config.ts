import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // ref/ は参考用のクローン。依存解決・監視の対象から外す
  server: { watch: { ignored: ['**/ref/**'] } },
  plugins: [
    VitePWA({
      // PRD 4.1/5.1: never force-reload mid-set. A new version waits until
      // the operator explicitly updates (see docs/PROGRESS.md Milestone 9).
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Circumplex',
        short_name: 'Circumplex',
        description: 'Audio-reactive raymarched VJ visualizer',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
