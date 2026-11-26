// Langkah 2.4: screenshot layar yang sama sebelum dan sesudah review UI.
// SHOT_PREFIX=2.4-sebelum pnpm e2e -- review   (atau 2.4-sesudah; bawaan: 2.4-sesudah)
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');
const PREFIX = process.env.SHOT_PREFIX ?? '2.4-sesudah';
const PASSWORD = 'contoh123';

async function shot(page: Page, name: string) {
  await page.waitForTimeout(600); // biarkan data lokal dan animasi masuk selesai
  await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-${name}.png`) });
  if (PREFIX !== '2.4-sebelum') await checkTargets(page, name);
}

async function login(page: Page, identifier: string, home: RegExp) {
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: home })).toBeVisible();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
}

/** Navigasi lewat tautan (bukan memuat ulang halaman) agar status aplikasi tetap. */
async function go(page: Page, name: RegExp) {
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name })
    .click();
}

test('HP 360×740: petugas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Masuk' }).first()).toBeVisible();
  await shot(page, 'hp-01-masuk');

  await login(page, '081200000202', /Hari ini/);
  await shot(page, 'hp-02-hari-ini');

  await go(page, /^Ternak$/);
  await expect(page.getByLabel('Cari ternak')).toBeVisible();
  await shot(page, 'hp-03-ternak');

  await page.getByLabel('Cari ternak').fill('zzzz');
  await shot(page, 'hp-04-cari-kosong');
  await page.getByLabel('Cari ternak').fill('');

  await page.locator('main article button, main ul a').first().click();
  await expect(page.getByRole('heading', { name: 'Riwayat' })).toBeVisible();
  await shot(page, 'hp-05-profil');

  await page.getByRole('link', { name: /Catat kejadian/ }).click();
  await page.getByText('IB', { exact: true }).click();
  await shot(page, 'hp-06-catat-ib');

  await page.goBack();
  await page.goBack();
  await go(page, /^Tugas$/);
  await shot(page, 'hp-07-tugas');

  await go(page, /^Lainnya$/);
  await shot(page, 'hp-08-lainnya');

  await page.goto('/ternak/0193f000-0000-7000-8000-00000000dead');
  await shot(page, 'hp-09-tidak-ditemukan');
});

test('HP 360×740: peternak', async ({ page }) => {
  await login(page, '081200000103', /Hari ini/);
  await shot(page, 'hp-10-hari-ini-peternak');
  await go(page, /^Tugas$/);
  await shot(page, 'hp-11-tugas-peternak');
});

test.describe('PC 1280×800: admin', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('ringkasan dan permintaan', async ({ page }) => {
    await login(page, 'admin.ktt01@contoh.test', /Ringkasan/);
    await shot(page, 'pc-01-ringkasan');
    await go(page, /^Permintaan$/);
    await expect(page.getByRole('table')).toBeVisible();
    await shot(page, 'pc-02-permintaan');
    await go(page, /^Tindak lanjut$/);
    await shot(page, 'pc-03-tindak-lanjut');
  });
});
