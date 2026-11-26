// Ukuran yang diunduh saat aplikasi pertama dibuka: entry JS + modulepreload + CSS dari
// dist/index.html (huruf tidak dihitung: dimuat saat dipakai). Jalankan setelah `pnpm build`:
//   pnpm --filter @ib/web exec tsx scripts/bundle-size.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = path.resolve(import.meta.dirname, '../dist');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map(
  (m) => m[1] ?? '',
);

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const sizeOf = (file: string) => {
  const buf = readFileSync(path.join(dist, file));
  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
};

let raw = 0;
let gzip = 0;
console.log('Dimuat saat aplikasi dibuka:');
for (const file of initial) {
  const s = sizeOf(file);
  raw += s.raw;
  gzip += s.gzip;
  console.log(`  ${file.padEnd(48)} ${kb(s.raw).padStart(10)} ${kb(s.gzip).padStart(10)} gzip`);
}
console.log(`  ${'TOTAL'.padEnd(48)} ${kb(raw).padStart(10)} ${kb(gzip).padStart(10)} gzip`);

const all = readdirSync(path.join(dist, 'assets'))
  .map((f) => `assets/${f}`)
  .filter((f) => !initial.includes(f) && f.endsWith('.js'))
  .map((f) => ({ f, ...sizeOf(f) }))
  .sort((a, b) => b.raw - a.raw)
  .slice(0, 8);
console.log('Chunk lazy terbesar:');
for (const c of all)
  console.log(`  ${c.f.padEnd(48)} ${kb(c.raw).padStart(10)} ${kb(c.gzip).padStart(10)} gzip`);

const total = readdirSync(dist, { recursive: true })
  .map((f) => path.join(dist, String(f)))
  .filter((f) => statSync(f).isFile())
  .reduce((n, f) => n + statSync(f).size, 0);
console.log(`Seluruh dist: ${kb(total)}`);
