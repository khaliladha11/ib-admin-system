import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

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
    plugins: [react(), tailwindcss(), ...(https ? [basicSsl({ name: 'ib-admin-dev' })] : [])],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      host: https ? true : undefined,
      proxy: { '/api': apiTarget },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // e2e/ dijalankan Playwright (pnpm e2e), bukan Vitest.
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
