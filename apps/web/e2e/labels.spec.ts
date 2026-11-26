// Langkah 3.1: cetak label QR (A4 24/40, label kosong) dan riwayat tag di profil ternak.
// Screenshot ke docs/screenshots/3.1-*.png. Dialog cetak diganti tiruan (window.print).
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');
const PATTERN = /^IB-[2-9A-HJ-NP-Z]{5}$/;

async function shot(page: Page, name: string, check = true) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `3.1-${name}.png`) });
  if (check) await checkTargets(page, name);
}

async function login(page: Page, identifier: string) {
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
}

const printed = (page: Page) =>
  page.evaluate(() => (window as unknown as { printed: number }).printed);

/** Kode di lembar cetak (bukan pratinjau). */
const printCodes = (page: Page) =>
  page
    .locator('.print-root [data-label]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-label') ?? ''));

test('label kosong: buat 40 kode unik, cetak satu lembar A4 40 label', async ({ page }) => {
  await login(page, '081200000202');
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Lainnya$/ })
    .click();
  await page.getByRole('link', { name: 'Cetak label QR' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cetak label' })).toBeVisible();
  await shot(page, 'hp-01-cetak-ternak');

  await page.getByRole('radio', { name: /Label kosong/ }).click();
  await page.getByRole('radio', { name: /40 label/ }).click();
  await expect(page.getByLabel('Jumlah kode baru')).toHaveValue('40');
  await page.getByRole('button', { name: 'Buat kode' }).click();
  await expect(page.getByText('40 kode baru dibuat')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cetak 40 label, 1 lembar' })).toBeVisible();
  await shot(page, 'hp-02-label-kosong');

  const codes = await printCodes(page);
  expect(codes).toHaveLength(40);
  expect(new Set(codes).size).toBe(40);
  for (const c of codes) expect(c).toMatch(PATTERN);

  await page.getByRole('button', { name: /^Cetak 40 label/ }).click();
  await expect.poll(() => printed(page)).toBe(1);

  // Tampilan cetak: hanya lembar A4, tanpa navigasi aplikasi.
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).first()).toBeHidden();
  const sheets = page.locator('.print-root .label-sheet');
  await expect(sheets).toHaveCount(1);
  const box = await sheets.first().boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(794); // 210 mm
  expect(Math.round(box?.height ?? 0)).toBe(1123); // 297 mm
  await shot(page, 'a4-40-label', false);
  await page.emulateMedia({ media: 'screen' });

  // Semua kode terkirim ke server lewat outbox.
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
});

test('ternak terdaftar: 24 label dengan nama; ternak tanpa QR mendapat kode saat dicetak', async ({
  page,
}) => {
  await login(page, '081200000202');
  await page.goto('/label');
  await expect(page.getByRole('heading', { level: 1, name: 'Cetak label' })).toBeVisible();
  await page.getByRole('button', { name: 'Pilih semua' }).click();
  const total = await page.locator('.print-root [data-label]').count();
  expect(total).toBeGreaterThan(0);
  await shot(page, 'hp-03-pilih-ternak');

  await page.getByRole('button', { name: /^Cetak \d+ label/ }).click();
  await expect.poll(() => printed(page)).toBe(1);
  const codes = await printCodes(page);
  for (const c of codes) expect(c).toMatch(PATTERN);
  expect(new Set(codes).size).toBe(codes.length);

  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print' });
  await shot(page, 'a4-24-label', false);
});

test('profil: riwayat tag, ganti label rusak dengan kode baru, cabut eartag', async ({ page }) => {
  await login(page, '081200000202');
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Ternak$/ })
    .click();
  await page.locator('main article button, main ul a').first().click();
  await expect(page.getByRole('heading', { name: 'Riwayat' })).toBeVisible();
  const section = page.getByRole('region', { name: 'Label dan tag' });
  await section.scrollIntoViewIfNeeded();
  const oldCode = (await section.locator('li').first().locator('span').first().textContent()) ?? '';
  expect(oldCode).toMatch(PATTERN);

  await section.getByRole('button', { name: 'Ganti' }).first().click();
  await section.getByRole('radio', { name: 'Rusak' }).click();
  await section.getByRole('button', { name: 'Buat kode baru' }).click();
  await expect(section.getByText('Kode QR baru dibuat dan dipasang')).toBeVisible();
  await expect(section.getByText(/Dicabut .*: Rusak/)).toBeVisible();
  await expect(section.getByText('Terpasang')).toBeVisible();
  await section.scrollIntoViewIfNeeded();
  await shot(page, 'hp-04-riwayat-tag');

  await section.getByRole('button', { name: 'Tambah eartag' }).click();
  await section.getByLabel('Nomor eartag').fill('3201-0099');
  await section.getByRole('button', { name: 'Pasang' }).click();
  await expect(section.getByText('3201-0099')).toBeVisible();
  const eartag = section.locator('li').filter({ hasText: '3201-0099' });
  await eartag.getByRole('button', { name: 'Cabut' }).click();
  await section.getByRole('radio', { name: 'Hilang' }).click();
  await section.getByRole('button', { name: 'Cabut tag' }).click();
  await expect(section.getByText(/Dicabut .*: Hilang/)).toBeVisible();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });

  // Kode lama tidak bisa dipasang lagi.
  await section.getByRole('button', { name: 'Ganti' }).first().click();
  await section.getByRole('radio', { name: 'Hilang' }).click();
  await section.getByLabel('Kode di label baru').fill(oldCode.toLowerCase());
  await section.getByRole('button', { name: 'Simpan tag baru' }).click();
  await expect(section.getByText(/sudah pernah dipasang/)).toBeVisible();
});
