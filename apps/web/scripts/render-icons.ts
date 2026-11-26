// Render ikon PWA dari SVG di public/icons/ menjadi PNG (sekali, hasilnya di-commit):
//   pnpm --filter @ib/web exec tsx scripts/render-icons.ts
// Memakai Chromium Playwright yang sudah ada, tanpa dependensi pembuat ikon.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

const dir = path.resolve(import.meta.dirname, '../public/icons');
const jobs = [
  { svg: 'icon.svg', out: 'icon-192.png', size: 192 },
  { svg: 'icon.svg', out: 'icon-512.png', size: 512 },
  { svg: 'maskable.svg', out: 'maskable-512.png', size: 512 },
  { svg: 'maskable.svg', out: 'apple-touch-icon-180.png', size: 180 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const job of jobs) {
  const svg = readFileSync(path.join(dir, job.svg), 'utf8');
  await page.setViewportSize({ width: job.size, height: job.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${String(job.size)}" height="${String(job.size)}" `)}</body></html>`,
  );
  await page.screenshot({ path: path.join(dir, job.out), omitBackground: true });
  console.log(job.out);
}
await browser.close();
