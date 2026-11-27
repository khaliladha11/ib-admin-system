// Langkah 6.3: pesan iSIKHNAS siap kirim, salin, tandai sudah dilaporkan, isi ID yang kosong.
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, `6.3-${name}.png`) });

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('petugas: salin pesan, tandai dilaporkan, isi ID hewan', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill('081200000201');
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Lainnya$/ })
    .click();
  await page.getByRole('link', { name: 'Pesan iSIKHNAS' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lapor iSIKHNAS' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Belum dilaporkan \(\d+\)/ })).toBeChecked();
  await shot(page, 'hp-01-pesan');
  await checkTargets(page, 'hp-01-isikhnas');

  // Salin pesan yang sudah lengkap.
  const copy = page.getByRole('button', { name: /^Salin pesan / }).first();
  const text = (await copy.getAttribute('aria-label'))?.replace('Salin pesan ', '') ?? '';
  expect(text).toMatch(/^(BH|IB|PKB|KGG|LH|BB) /);
  await copy.click();
  await expect(page.getByRole('button', { name: /^Salin pesan / }).first()).toContainText(
    'Tersalin',
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);

  // Tandai sudah dilaporkan: pindah ke tab Sudah.
  const before = await page.getByRole('radio', { name: /Sudah \(\d+\)/ }).textContent();
  await page
    .getByRole('button', { name: 'Tandai sudah dilaporkan', disabled: false })
    .first()
    .click();
  await expect(page.getByRole('radio', { name: /Sudah \(\d+\)/ })).not.toHaveText(before ?? '');
  await page.getByRole('radio', { name: /Sudah \(\d+\)/ }).click();
  await expect(page.getByText(/Sudah dilaporkan \d/).first()).toBeVisible();
  await page.getByRole('radio', { name: /Belum dilaporkan/ }).click();

  // ID hewan kosong diisi langsung di sini.
  const field = page.getByLabel(/^ID hewan iSIKHNAS/).first();
  const label = await page
    .locator('label', { hasText: /^ID hewan iSIKHNAS/ })
    .first()
    .textContent();
  await field.fill('ANM-E2E-01');
  await field.press('Enter');
  await expect(page.locator('label', { hasText: label ?? '' })).toHaveCount(0);
  await shot(page, 'hp-02-setelah-tandai');
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 20_000 });
});
