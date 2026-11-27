// Langkah 4.3: halaman Pos IB (alamat + QR untuk HP, cadangan, ekspor/impor).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');

async function login(page: Page, identifier: string) {
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
}

async function openPos(page: Page) {
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Pos IB$/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pos IB' })).toBeVisible();
}

test.describe('PC 1280×800: admin dinas', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('alamat + QR, cadangan, ekspor lalu impor file yang sama', async ({ page }) => {
    await login(page, 'admin.dinas@contoh.test');
    await openPos(page);
    await expect(page.getByText('https://192.168.1.10', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /Kode QR alamat aplikasi/ })).toBeVisible();
    await expect(page.getByText('http://192.168.1.10/sertifikat')).toBeVisible();

    const backups = page.getByRole('region', { name: 'Cadangan harian' }).getByRole('listitem');
    const before = await backups.count();
    await page.getByRole('button', { name: 'Cadangkan sekarang' }).click();
    await expect(page.getByText(/Cadangan dibuat: ib-ternak-/)).toBeVisible();
    await expect(backups).toHaveCount(before + 1);
    await page.screenshot({ path: path.join(SHOTS, '4.3-pc-01-pos.png') });
    await checkTargets(page, 'pc-01-pos');

    // Unduh JSON lengkap, lalu impor file yang sama: semua baris "sudah ada".
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Unduh JSON lengkap' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^ib-ternak-\d{4}-\d{2}-\d{2}\.json$/);
    const file = await download.path();
    const data = JSON.parse(readFileSync(file, 'utf8')) as { format: string };
    expect(data.format).toBe('ib-ternak-export');

    await page.getByLabel('Impor file JSON').setInputFiles(file);
    await expect(page.getByText(/Impor selesai/)).toBeVisible({ timeout: 15_000 });
    const table = page.getByRole('table', { name: 'Hasil impor per tabel' });
    await expect(table.getByRole('row', { name: /^Peternak 0 \d+$/ })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '4.3-pc-02-impor.png'), fullPage: true });

    const csv = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Unduh CSV (ZIP)' }).click();
    expect((await csv).suggestedFilename()).toMatch(/-csv\.zip$/);
  });
});

test('HP 360: admin kelompok melihat alamat, tanpa ekspor/impor', async ({ page }) => {
  await login(page, 'admin.ktt01@contoh.test');
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Lainnya$/ })
    .click();
  await page.getByRole('link', { name: /Pos IB: alamat, cadangan, ekspor/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pos IB' })).toBeVisible();
  await expect(page.getByText('https://192.168.1.10', { exact: true })).toBeVisible();
  await expect(page.getByText(/hanya untuk admin dinas/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Unduh JSON lengkap' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cadangkan sekarang' })).toHaveCount(0);
  await page.screenshot({ path: path.join(SHOTS, '4.3-hp-01-pos.png') });
  await checkTargets(page, 'hp-01-pos');
});
