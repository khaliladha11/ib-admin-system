// Uji end-to-end di viewport HP 360×740 terhadap server sungguhan berisi data contoh fiktif.
// Jalankan: pnpm e2e (dari root). Screenshot setiap layar disimpan ke docs/screenshots/.
import { defineConfig } from '@playwright/test';

const SERVER_PORT = 3100;
const WEB_PORT = 5174;

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
  ],
});
