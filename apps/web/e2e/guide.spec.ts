// Langkah 5.1: gambar untuk panduan cetak (docs/panduan/img/*.jpg) dan PDF A4 satu halaman
// (docs/panduan/*.pdf). Jalankan ulang setelah tampilan berubah: pnpm e2e -- guide.spec.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const GUIDE = path.resolve(import.meta.dirname, '../../../docs/panduan');

test.use({ viewport: { width: 360, height: 500 }, permissions: ['camera'] });

async function img(page: Page, name: string) {
  await page.waitForTimeout(400); // animasi masuk selesai
  await page.screenshot({
    path: path.join(GUIDE, 'img', `${name}.jpg`),
    type: 'jpeg',
    quality: 82,
  });
}

async function login(page: Page, identifier: string) {
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
}

const heading = (page: Page, name: string) =>
  expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

/** Profil sapi pertama di daftar Ternak; kembalikan alamatnya. */
async function firstAnimal(page: Page) {
  await page.goto('/ternak');
  await page.locator('main article button, main ul a').first().click();
  await expect(page.getByRole('heading', { name: 'Riwayat' })).toBeVisible();
  return new URL(page.url()).pathname;
}

test('gambar panduan peternak', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Email atau nomor HP')).toBeVisible();
  await img(page, 'p-01-masuk');
  await login(page, '081200000100');
  await img(page, 'p-02-hari-ini');

  const animal = await firstAnimal(page);
  await img(page, 'p-03-profil');
  await page.goto(`${animal}/catat?jenis=BH`);
  await heading(page, 'Catat kejadian');
  await img(page, 'p-04-catat-birahi');

  await page.goto('/tugas/ajukan');
  await heading(page, 'Minta IB atau PKB');
  await img(page, 'p-05-minta');

  await page.goto('/masukan');
  await heading(page, 'Beri masukan');
  await page.getByText('Mudah', { exact: true }).click();
  await img(page, 'p-06-masukan');
});

test('gambar panduan inseminator', async ({ page }) => {
  await page.goto('/');
  await login(page, '081200000201');
  await page.goto('/tugas');
  await heading(page, 'Tugas');
  await img(page, 'i-01-tugas');

  await page.goto('/scan');
  await heading(page, 'Scan');
  await page.waitForTimeout(1500); // kamera palsu menyala
  await img(page, 'i-02-scan');

  const animal = await firstAnimal(page);
  await page.goto(`${animal}?scan=1`);
  await expect(page.getByRole('region', { name: 'Tindakan cepat dari scan' })).toBeVisible();
  await img(page, 'i-03-profil-scan');

  await page.goto(`${animal}/catat?jenis=IB`);
  await expect(page.getByRole('button', { name: 'Simpan IB' })).toBeVisible();
  await img(page, 'i-04-catat-ib');
  await page.goto(`${animal}/catat?jenis=PKB`);
  await page.getByText('Bunting', { exact: true }).click();
  await img(page, 'i-05-catat-pkb');

  await page.goto('/data-belum-terkirim');
  await heading(page, 'Data belum terkirim');
  await img(page, 'i-06-data-terkirim');
});

for (const name of ['peternak', 'inseminator']) {
  test(`PDF panduan ${name}: A4 satu halaman`, async ({ page }) => {
    await page.goto(pathToFileURL(path.join(GUIDE, `${name}.html`)).href);
    // Semua gambar ada dan termuat.
    const broken = await page.$$eval('img', (list) =>
      list.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src),
    );
    expect(broken).toEqual([]);
    const file = path.join(GUIDE, `${name}.pdf`);
    await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = readFileSync(file, 'latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages).toHaveLength(1);
  });
}
