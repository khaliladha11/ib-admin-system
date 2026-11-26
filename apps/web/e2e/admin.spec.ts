// Langkah 2.3: dashboard admin kelompok di PC 1280×800 (dan tetap bisa dipakai di HP 360×740).
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');
const PASSWORD = 'contoh123';
const ADMIN = 'admin.ktt01@contoh.test';
const FARMER = '081200000100';

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `2.3-${name}.png`), fullPage });
}

async function noHorizontalScroll(page: Page) {
  const { w, vw, wide } = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    wide: [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 3)
      .map((el) => `${el.tagName}.${el.getAttribute('class')?.slice(0, 60) ?? ''}`),
  }));
  expect(w, `${page.url()} melebar: ${wide.join(' | ')}`).toBeLessThanOrEqual(vw);
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(ADMIN);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.getByRole('button', { name: 'Lewati, pakai password saja' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ringkasan' })).toBeVisible();
  await expect(page.getByText('Semua data terkirim')).toBeVisible();
}

test('admin kelompok: ringkasan, verifikasi, ganti petugas, tolak, tindak lanjut, peternak, pengguna', async ({
  page,
  playwright,
  baseURL,
}) => {
  // Peternak mengajukan IB lewat API (untuk diuji alur tolak).
  const farmerApi = await playwright.request.newContext({ baseURL });
  await farmerApi.post('/api/auth/login', { data: { identifier: FARMER, password: PASSWORD } });
  const animals = (await (await farmerApi.get('/api/animals')).json()) as {
    items: { id: string; sex: string; status: { kind: string } }[];
  };
  const cow = animals.items.find(
    (a) => a.sex === 'F' && !['bunting', 'keluar', 'sudah_IB_menunggu_PKB'].includes(a.status.kind),
  );
  expect(cow).toBeDefined();
  const created = await farmerApi.post('/api/service-requests', {
    data: { animalId: cow?.id, type: 'IB', notes: 'Birahi sejak subuh, mohon segera' },
  });
  expect(created.status()).toBe(201);

  // 1. Ringkasan
  await login(page);
  await expect(page.getByText('Perlu diverifikasi')).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '01-ringkasan');

  // 2. Tabel permintaan + filter
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .first()
    .getByRole('link', { name: 'Permintaan' })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  await shot(page, '02-permintaan');
  await page.getByLabel('Status').selectOption('submitted');
  await expect(page.getByText(/^\d+ dari \d+ permintaan$/)).toBeVisible();
  await shot(page, '03-permintaan-filter-baru');

  // 3. Verifikasi + tugaskan
  await page
    .getByRole('row')
    .filter({ hasText: 'Menunggu verifikasi' })
    .first()
    .getByRole('link', { name: /Buka permintaan/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Verifikasi permintaan' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Log aktivitas' })).toBeVisible();
  await shot(page, '04-detail-verifikasi');
  const select = page.getByLabel('Tugaskan ke petugas');
  await select.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Verifikasi dan tugaskan' }).click();
  await expect(
    page.getByText('Permintaan diverifikasi dan ditugaskan.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/Diverifikasi dan ditugaskan ke /)).toBeVisible();

  // 4. Ganti petugas
  await page.getByLabel('Petugas pengganti').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Ganti petugas' }).click();
  await expect(page.getByText(/Petugas diganti ke /)).toBeVisible();
  // Tunggu terkirim ke server, lalu log menampilkan nama admin sebagai pelaku.
  await expect(page.getByText('Belum terkirim')).toHaveCount(0, { timeout: 15_000 });
  await shot(page, '05-ganti-petugas-log');

  // 5. Tolak permintaan dari peternak
  await page.goto('/permintaan?status=submitted');
  await page
    .getByRole('row')
    .filter({ hasText: 'Menunggu verifikasi' })
    .first()
    .getByRole('link', { name: /Buka permintaan/ })
    .click();
  await page.getByRole('button', { name: 'Tolak permintaan ini' }).click();
  await page
    .getByLabel(/Alasan penolakan/)
    .fill('Sapi baru melahirkan 20 hari lalu, tunggu birahi berikutnya');
  await shot(page, '06-tolak');
  await page.getByRole('button', { name: 'Tolak permintaan', exact: true }).click();
  await expect(page.getByText(/^Ditolak: Sapi baru melahirkan/)).toBeVisible();

  // 6. Tindak lanjut + WhatsApp
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .first()
    .getByRole('link', { name: 'Tindak lanjut' })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  const wa = page.getByRole('link', { name: /WA (peternak|petugas)/ }).first();
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/62\d+\?text=/);
  await noHorizontalScroll(page);
  await shot(page, '07-tindak-lanjut');

  // 7. Peternak
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .first()
    .getByRole('link', { name: 'Peternak' })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  await shot(page, '08-peternak');
  await page.getByRole('link', { name: 'Tambah peternak' }).click();
  await page.getByLabel('Nama peternak').fill('Pak Darmo');
  await page.getByLabel(/Nomor HP/).fill('0813 5555 1212');
  await shot(page, '09-tambah-peternak');
  await page.getByRole('button', { name: 'Simpan peternak' }).click();
  await expect(page.getByRole('cell', { name: 'Pak Darmo', exact: true })).toBeVisible();

  // 8. Pengguna (online-only)
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .first()
    .getByRole('link', { name: 'Pengguna' })
    .click();
  await expect(page.getByRole('table')).toBeVisible();
  await shot(page, '10-pengguna');
  await page.getByRole('link', { name: 'Tambah pengguna' }).click();
  await page.getByLabel('Nama').fill('Bayu Saputra');
  await page.getByLabel(/^Nomor HP/).fill('081377770001');
  await page.getByLabel(/Password awal/).fill('petugas-baru-1');
  await shot(page, '11-tambah-pengguna');
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(page.getByRole('cell', { name: 'Bayu Saputra', exact: true })).toBeVisible();

  // 9. Tetap bisa dipakai di HP (lebih sederhana: kartu, bukan tabel)
  await page.setViewportSize({ width: 360, height: 740 });
  for (const url of ['/', '/permintaan', '/tindak-lanjut', '/peternak', '/pengguna']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(300);
    await noHorizontalScroll(page);
  }
  await page.goto('/');
  await shot(page, '12-ringkasan-hp');
  await page.goto('/permintaan');
  await shot(page, '13-permintaan-hp');
  await farmerApi.dispose();
});
