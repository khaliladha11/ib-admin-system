// Uji end-to-end di viewport HP 360×740 terhadap server sungguhan berisi data contoh fiktif.
// Jalankan: pnpm e2e (dari root). Screenshot setiap layar disimpan ke docs/screenshots/.
import path from 'node:path';

import { defineConfig } from '@playwright/test';

import { FAKE_CAMERA_CODE, writeQrVideo } from './e2e/fake-camera.ts';

const SERVER_PORT = 3100;
const WEB_PORT = 5174;
/** Build produksi + service worker (project `pwa`). */
const PREVIEW_PORT = 5175;

// Kamera palsu (halaman Scan): QR berisi URL label agar parseQrCode ikut teruji.
const FAKE_VIDEO = path.resolve(import.meta.dirname, 'node_modules/.cache/ib-e2e/fake-camera.y4m');
writeQrVideo(FAKE_VIDEO, `https://ib.contoh.test/t/${FAKE_CAMERA_CODE}`);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${String(WEB_PORT)}`,
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'off',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${FAKE_VIDEO}`,
      ],
    },
  },
  webServer: [
    {
      // Database khusus e2e, diisi ulang setiap kali agar hasilnya sama.
      command:
        'pnpm exec tsx src/db/migrate.ts && pnpm exec tsx src/db/seed.ts --reset && pnpm exec tsx src/index.ts',
      cwd: '../server',
      env: {
        DATABASE_URL: 'data/e2e.sqlite',
        PORT: String(SERVER_PORT),
        COOKIE_SECURE: 'false',
      },
      url: `http://localhost:${String(SERVER_PORT)}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite --port ${String(WEB_PORT)} --strictPort`,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${String(SERVER_PORT)}` },
      url: `http://localhost:${String(WEB_PORT)}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Service worker hanya ada di build produksi, bukan dev server.
      command: `pnpm exec vite build --outDir node_modules/.cache/ib-e2e/dist && pnpm exec vite preview --outDir node_modules/.cache/ib-e2e/dist --port ${String(PREVIEW_PORT)} --strictPort`,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${String(SERVER_PORT)}` },
      url: `http://localhost:${String(PREVIEW_PORT)}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'hp', testIgnore: /pwa\.spec\.ts/ },
    {
      name: 'pwa',
      testMatch: /pwa\.spec\.ts/,
      use: { baseURL: `http://localhost:${String(PREVIEW_PORT)}`, serviceWorkers: 'allow' },
    },
  ],
});
