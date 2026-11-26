// Langkah 4.1: PWA pada build produksi. Buka aplikasi, matikan jaringan, buka ulang dari cache
// service worker, catat event, nyalakan jaringan, pastikan event terkirim ke server.
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');

async function shot(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `4.1-${name}.png`) });
  await checkTargets(page, name);
}

const nav = (page: Page, name: RegExp) =>
  page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name });

test('manifest: bisa dipasang ke layar utama', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('IB Ternak');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = (await (await request.get(href ?? '')).json()) as {
    name: string;
    short_name: string;
    display: string;
    start_url: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({
    short_name: 'IB Ternak',
    display: 'standalone',
    start_url: '/',
  });
  const sizes = manifest.icons.map((i) => `${i.sizes} ${i.purpose ?? 'any'}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));
  for (const icon of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png']) {
    expect((await request.get(icon)).status()).toBe(200);
  }
});

test('offline: buka ulang tanpa jaringan, catat berat, lalu terkirim saat online', async ({
  page,
  context,
}) => {
  // 1. Buka dan masuk saat online; service worker menyimpan semua aset.
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill('081200000202');
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(page.getByText('Siap dipakai tanpa sinyal')).toBeVisible({ timeout: 15_000 });

  // 2. Mode pesawat, lalu buka ulang aplikasi: dari cache service worker.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/^Tanpa sinyal/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: /Hari ini/ })).toBeVisible();

  // 3. Halaman yang dimuat saat dibuka (lazy) juga tersedia offline.
  await nav(page, /^Scan$/).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scan' })).toBeVisible();
  await nav(page, /^Lainnya$/).click();
  await expect(page.getByRole('heading', { name: 'Pengiriman data' })).toBeVisible();
  await page.getByRole('link', { name: 'Cetak label QR' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cetak label' })).toBeVisible();

  // 4. Catat berat badan tanpa sinyal.
  await nav(page, /^Ternak$/).click();
  await page.locator('main article button, main ul a').first().click();
  await expect(page.getByRole('heading', { name: 'Riwayat' })).toBeVisible();
  const animalId = new URL(page.url()).pathname.split('/').pop() ?? '';
  await page.getByRole('link', { name: /Catat kejadian/ }).click();
  await page.getByText('Berat', { exact: true }).click();
  await page.getByLabel('Berat (kg)').fill('387');
  await page.getByRole('button', { name: 'Simpan Berat' }).click();
  await expect(page.getByText('Berat tersimpan di HP ini.')).toBeVisible();
  await expect(page.getByText('Tanpa sinyal, 1 belum terkirim')).toBeVisible();
  await shot(page, 'hp-01-offline-tersimpan');

  // 5. Jaringan kembali: outbox terkirim otomatis (event `online`).
  await context.setOffline(false);
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 20_000 });

  // 6. Event ada di server.
  const res = await page.request.get(`/api/animals/${animalId}/timeline`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { events: { type: string; payload: { weightKg?: number } }[] };
  expect(body.events.some((e) => e.type === 'BB' && e.payload.weightKg === 387)).toBe(true);
});
