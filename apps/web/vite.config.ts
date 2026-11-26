import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import { moduleSizes } from './scripts/module-sizes.ts';

// .env dibaca dari root repo (lihat .env.example).
const envDir = path.resolve(import.meta.dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const apiTarget = env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';
  // `pnpm dev:hp`: HTTPS dengan sertifikat buatan sendiri + terbuka di jaringan Wi-Fi, agar
  // kamera (Scan) bisa dicoba di HP. Hanya untuk pengembangan, bukan produksi.
  const https = env.DEV_HTTPS === '1';

  return {
    envDir,
    plugins: [
      react(),
      tailwindcss(),
      ...(https ? [basicSsl({ name: 'ib-admin-dev' })] : []),
      // PWA (langkah 4.1): bisa dipasang ke layar utama dan terbuka tanpa sinyal.
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
        manifest: {
          name: 'IB Ternak – Catatan Reproduksi Sapi',
          short_name: 'IB Ternak',
          description:
            'Catat birahi, IB, periksa bunting, dan kelahiran sapi. Tetap bisa dipakai tanpa sinyal.',
          lang: 'id',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          // Sama dengan token --leaf dan --lime-wash di src/index.css.
          theme_color: '#2e6b34',
          background_color: '#eef5d2',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Scan',
              url: '/scan',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Cetak label',
              url: '/label',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          // Semua aset, termasuk halaman yang dimuat saat dibuka (admin, Scan, ZXing, label) dan
          // huruf: setiap layar tetap bisa dibuka dalam mode pesawat.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          navigateFallback: '/index.html',
          // Data tidak pernah di-cache service worker: data offline ada di Dexie + outbox.
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
      ...(env.ANALYZE === '1' ? [moduleSizes()] : []),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      host: https ? true : undefined,
      proxy: { '/api': apiTarget },
    },
    // `pnpm preview` (build produksi + service worker) memakai proxy dan HTTPS yang sama.
    preview: {
      proxy: { '/api': apiTarget },
      host: https ? true : undefined,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // e2e/ dijalankan Playwright (pnpm e2e), bukan Vitest.
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
