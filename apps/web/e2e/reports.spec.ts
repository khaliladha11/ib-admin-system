// Langkah 6.2: halaman Laporan (S/C, CR, tren, waktu respons), unduh Excel, tampilan cetak A4.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');
const shot = (page: Page, name: string, fullPage = false) =>
  page.screenshot({ path: path.join(SHOTS, `6.2-${name}.png`), fullPage });

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

test.describe('PC 1280×800: admin dinas', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('laporan, Excel, dan cetak', async ({ page }) => {
    await login(page, 'admin.dinas@contoh.test');
    await page
      .getByRole('navigation', { name: 'Navigasi utama' })
      .filter({ visible: true })
      .getByRole('link', { name: /^Laporan$/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Laporan' })).toBeVisible();
    await expect(page.getByText('S/C', { exact: true }).first()).toBeVisible();
    const perPetugas = page.getByRole('table', { name: 'S/C dan CR per petugas' });
    await expect(perPetugas.getByRole('row')).not.toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Cara menghitung' })).toBeVisible();
    await shot(page, 'pc-01-laporan');
    await shot(page, 'pc-02-laporan-penuh', true);
    await checkTargets(page, 'pc-laporan');

    // Ganti periode: label periode berubah.
    await page.getByRole('radio', { name: 'Tahun ini' }).click();
    await expect(page.getByText(/· Jan \d{4}/)).toBeVisible();
    await page.getByRole('radio', { name: '12 bulan' }).click();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Excel' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
      /^laporan-ib-\d{4}-\d{2}-sd-\d{4}-\d{2}-[\d-]+\.xlsx$/,
    );
    const bytes = readFileSync(await file.path());
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304'); // ZIP
    expect(bytes.toString('latin1')).toContain('xl/worksheets/sheet2.xml');

    await page.getByRole('button', { name: 'Cetak / PDF' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed))
      .toBe(1);
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-root .report-print')).toBeVisible();
    await expect(page.locator('.print-root').getByText(/^Laporan IB · /)).toBeVisible();
    await shot(page, 'cetak-a4', true);
  });
});

test('HP 360: admin kelompok membuka laporan dari Lainnya', async ({ page }) => {
  await login(page, 'admin.ktt01@contoh.test');
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Lainnya$/ })
    .click();
  await page.getByRole('link', { name: /Laporan S\/C, CR, tren/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Laporan' })).toBeVisible();
  await expect(page.getByText(/KTT Sumber Rejeki/).first()).toBeVisible();
  await shot(page, 'hp-01-laporan');
  await checkTargets(page, 'hp-laporan');
});
