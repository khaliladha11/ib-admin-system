// Halaman dokumentasi API (Swagger UI) dengan aset dari paket swagger-ui-dist,
// bukan CDN, agar tetap bisa dibuka di server pos IB tanpa internet.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { Hono } from 'hono';

const ASSETS = {
  'swagger-ui.css': 'text/css; charset=utf-8',
  'swagger-ui-bundle.js': 'text/javascript; charset=utf-8',
} as const;

const distDir = path.dirname(
  createRequire(import.meta.url).resolve('swagger-ui-dist/package.json'),
);
const cache = new Map<string, string>();

const page = (specUrl: string) => `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dokumentasi API · IB Admin System</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: '#swagger-ui', withCredentials: true });
    </script>
  </body>
</html>`;

export function registerDocs<E extends object>(
  app: Hono<E & { Variables: object }>,
  specUrl: string,
) {
  app.get('/api/docs', (c) => c.html(page(specUrl)));
  app.get('/api/docs/assets/:file', (c) => {
    const file = c.req.param('file');
    if (!(file in ASSETS)) return c.notFound();
    let body = cache.get(file);
    if (body === undefined) {
      body = readFileSync(path.join(distDir, file), 'utf8');
      cache.set(file, body);
    }
    c.header('content-type', ASSETS[file as keyof typeof ASSETS]);
    c.header('cache-control', 'public, max-age=86400');
    return c.body(body);
  });
}
