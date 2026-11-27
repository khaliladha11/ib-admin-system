// Menyajikan build web (apps/web/dist) dari server yang sama dengan API (langkah 4.3), agar
// pos IB cukup satu alamat. Rute aplikasi (bukan /api) dijawab index.html (SPA).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { OpenAPIHono } from '@hono/zod-openapi';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import type { AppEnv } from './env';

export function registerWebApp(app: OpenAPIHono<AppEnv>, distDir: string) {
  const root = path.resolve(distDir);
  const indexFile = path.join(root, 'index.html');
  if (!existsSync(indexFile)) {
    console.warn(`Build web tidak ditemukan di ${root}; hanya API yang disajikan.`);
    return;
  }
  const indexHtml = readFileSync(indexFile, 'utf8');

  // Sub-app tersendiri (tipe Hono biasa). /api tidak ada di folder build, jadi tetap diteruskan
  // ke route API / jawaban 404 API.
  const web = new Hono();
  web.use('*', async (c, next) => {
    await next();
    // Berkas berhash boleh disimpan lama; service worker & manifest selalu dicek ulang.
    if (c.res.status !== 200) return;
    if (c.req.path.startsWith('/assets/')) {
      c.header('cache-control', 'public, max-age=31536000, immutable');
    } else if (/^\/(sw\.js|workbox-[\w-]+\.js|manifest\.webmanifest)$/.test(c.req.path)) {
      c.header('cache-control', 'no-cache');
    }
  });
  web.use('*', serveStatic({ root }));
  // Rute aplikasi (mis. /ternak/…): index.html, router di HP yang menentukan halamannya.
  web.get('*', (c, next) => {
    if (c.req.path.startsWith('/api/') || path.extname(c.req.path)) return next();
    c.header('cache-control', 'no-cache');
    return c.html(indexHtml);
  });
  app.route('/', web);
}
