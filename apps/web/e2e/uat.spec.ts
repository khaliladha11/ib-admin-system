// Langkah 5.1: masukan peserta (offline → terkirim → terlihat admin), catatan pemakaian lokal
// (bertambah setelah mencatat, unduh CSV), dan tampilan server latihan (pita + reset data demo).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');
const shot = (page: Page, name: string, fullPage = false) =>
  page.screenshot({ path: path.join(SHOTS, `5.1-${name}.png`), fullPage });

async function login(page: Page, identifier: string) {
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
}

const nav = (page: Page, name: RegExp) =>
  page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name });

const FEEDBACK_TEXT = 'Tulisan tombol Simpan kurang besar';

test('peternak: masukan offline lalu terkirim; catatan pemakaian bertambah dan bisa diunduh', async ({
  page,
  context,
  browser,
}) => {
  await login(page, '081200000100');

  // 1. Catat berat badan: catatan pemakaian "Catat kejadian" bertambah.
  await nav(page, /^Ternak$/).click();
  await page.locator('main article button, main ul a').first().click();
  await page.getByRole('link', { name: /Catat kejadian/ }).click();
  await page.getByText('Berat', { exact: true }).click();
  await page.getByLabel('Berat (kg)').fill('402');
  await page.getByRole('button', { name: 'Simpan Berat' }).click();
  await expect(page.getByText('Berat tersimpan di HP ini.')).toBeVisible();

  // 2. Beri masukan tanpa sinyal.
  await page.goto('/lainnya');
  await page.getByRole('link', { name: 'Beri masukan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Beri masukan' })).toBeVisible();
  await context.setOffline(true);
  await page.getByText('Mudah', { exact: true }).click();
  await page.getByLabel('Tentang bagian').selectOption('record');
  await page.getByLabel(/Ceritakan/).fill(FEEDBACK_TEXT);
  await shot(page, 'hp-01-masukan');
  await checkTargets(page, 'hp-01-masukan');
  await page.getByRole('button', { name: 'Kirim masukan' }).click();
  await expect(page.getByText(/Masukan tersimpan/)).toBeVisible();
  await expect(page.getByText(/menunggu dikirim/)).toBeVisible();
  await shot(page, 'hp-02-masukan-tersimpan');

  // 3. Sinyal kembali: terkirim otomatis.
  await context.setOffline(false);
  await expect(page.getByText(/· terkirim/)).toBeVisible({ timeout: 20_000 });

  // 4. Catatan pemakaian: hanya di HP ini, berisi form catat yang tadi disimpan.
  await page.getByRole('link', { name: 'Kembali' }).click();
  await page.getByRole('link', { name: /Catatan pemakaian/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Catatan pemakaian' })).toBeVisible();
  const forms = page.getByRole('table', { name: 'Lama mengisi form' });
  await expect(forms.getByRole('row', { name: /^Catat kejadian 1 0/ })).toBeVisible();
  await expect(page.getByText(/Berat badan: 1/)).toBeVisible();
  await shot(page, 'hp-03-pemakaian', true);
  await checkTargets(page, 'hp-03-pemakaian');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ib-ternak-pemakaian-[\d-]+\.csv$/);
  const csv = readFileSync(await download.path(), 'utf8');
  expect(csv.split('\r\n')[0]).toBe('kind,name,eventType,durationMs,at,day');
  expect(csv).toMatch(/form_done,record,BB,\d+,/);
  // Tidak ada data pribadi: tanpa nomor HP / nama.
  expect(csv).not.toContain('081200000100');

  // 5. Admin kelompok melihat masukan itu di Tindak lanjut (PC).
  const admin = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    deviceScaleFactor: 2,
  });
  const adminPage = await admin.newPage();
  await login(adminPage, 'admin.ktt01@contoh.test');
  await nav(adminPage, /^Tindak lanjut/).click();
  const panel = adminPage.getByRole('region', { name: /Masukan peserta/ });
  await expect(panel.getByText(FEEDBACK_TEXT)).toBeVisible();
  await expect(panel.getByText(/Mudah · Mencatat birahi/).first()).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  await shot(adminPage, 'pc-01-masukan-admin');
  await admin.close();
});

test.describe('PC 1280×800: server latihan (DEMO_MODE tiruan)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('pita "Mode latihan", reset data demo → kembali ke layar Masuk', async ({ page }) => {
    // Server e2e bukan server latihan; jawaban login/info ditandai demoMode di peramban saja.
    // Reset sungguhan di server diuji di apps/server/src/test/uat.test.ts.
    await page.route('**/api/auth/login', async (route) => {
      const res = await route.fetch();
      const body = (await res.json()) as Record<string, unknown>;
      await route.fulfill({ response: res, json: { ...body, demoMode: true, generation: 'g1' } });
    });
    await page.route('**/api/system/info', async (route) => {
      const res = await route.fetch();
      const body = (await res.json()) as Record<string, unknown>;
      await route.fulfill({ response: res, json: { ...body, demoMode: true } });
    });
    let resetCalls = 0;
    await page.route('**/api/system/demo/reset', async (route) => {
      resetCalls += 1;
      await route.fulfill({
        status: 200,
        json: { backup: 'ib-ternak-2026-11-27-020000.sqlite', generation: 'g2' },
      });
    });

    await login(page, 'admin.dinas@contoh.test');
    await expect(page.getByText(/Mode latihan: data contoh/)).toBeVisible();
    await nav(page, /^Pos IB$/).click();
    const panel = page.getByRole('region', { name: 'Data latihan' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Reset data demo' }).click();
    await expect(panel.getByText(/Hapus semua data dan isi ulang/)).toBeVisible();
    await panel.scrollIntoViewIfNeeded();
    await shot(page, 'pc-02-reset-demo');
    await panel.getByRole('button', { name: 'Ya, reset data latihan' }).click();
    await expect(page.getByLabel('Email atau nomor HP')).toBeVisible({ timeout: 15_000 });
    expect(resetCalls).toBe(1);
  });
});
