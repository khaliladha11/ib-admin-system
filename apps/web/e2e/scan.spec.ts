// Langkah 3.2: halaman Scan dengan kamera palsu (QR berisi URL label IB-SCAN2).
// Alur: kode belum terdaftar → daftarkan sapi → scan lagi → profil dengan tombol cepat.
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { checkTargets } from './checks';
import { FAKE_CAMERA_CODE } from './fake-camera';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');

async function shot(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `3.2-${name}.png`) });
  await checkTargets(page, name);
}

async function login(page: Page, identifier = '081200000202') {
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
}

async function openScan(page: Page) {
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Scan$/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scan' })).toBeVisible();
}

test.use({ permissions: ['camera'] });

test('scan: kode baru → daftarkan sapi → scan lagi membuka profil dengan tombol cepat', async ({
  page,
}) => {
  await login(page);
  await openScan(page);
  await expect(page.getByText('Belum terdaftar')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(FAKE_CAMERA_CODE)).toBeVisible();
  await shot(page, 'hp-01-belum-terdaftar');

  await page.getByRole('link', { name: 'Daftarkan sapi baru dengan kode ini' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Daftarkan sapi' })).toBeVisible();
  await page.getByLabel('Peternak pemilik').selectOption({ index: 1 });
  await page.getByLabel('Nama panggilan (boleh kosong)').fill('Kirana');
  await page.getByLabel('Rumpun (boleh kosong)').fill('PO');
  await shot(page, 'hp-02-daftarkan');
  await page.getByRole('button', { name: 'Simpan dan lanjut scan' }).click();

  // Kembali ke Scan; kamera menyala otomatis dan kode yang sama kini dikenali.
  await expect(page.getByRole('heading', { level: 1, name: 'Scan' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kirana' })).toBeVisible({ timeout: 15_000 });
  const quick = page.getByRole('region', { name: 'Tindakan cepat dari scan' });
  await expect(quick.getByRole('link', { name: 'Catat IB' })).toBeVisible();
  await expect(quick.getByRole('link', { name: 'Catat PKB' })).toBeVisible();
  await expect(quick.getByRole('link', { name: 'Catat lahir' })).toBeVisible();
  await shot(page, 'hp-03-profil-dari-scan');
  await quick.getByRole('link', { name: 'Catat IB' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Catat kejadian' })).toBeVisible();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 15_000 });
});

test('scan beruntun: kode dikumpulkan tanpa pindah halaman; ketik manual eartag', async ({
  page,
}) => {
  // Pilihan scan beruntun diingat per HP: aktif sebelum kamera menyala otomatis.
  await page.addInitScript(() => {
    localStorage.setItem('ib-scan-continuous', '1');
  });
  await login(page);
  await openScan(page);
  await expect(page.getByRole('switch', { name: /Scan beruntun/ })).toBeChecked();
  const list = page.getByRole('region', { name: /Hasil scan/ });
  await expect(list.getByText(FAKE_CAMERA_CODE)).toBeVisible({ timeout: 15_000 });

  // Ketik kode QR sapi yang sudah ada + eartag baru.
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .filter({ visible: true })
    .getByRole('link', { name: /^Ternak$/ })
    .click();
  const firstCard = page.locator('main article button, main ul a').first();
  await firstCard.click();
  const qr = (
    (await page
      .getByRole('region', { name: 'Label dan tag' })
      .locator('li')
      .first()
      .locator('span')
      .first()
      .textContent()) ?? ''
  ).trim();
  await page.goBack(); // profil tanpa navigasi bawah: kembali ke daftar ternak
  await openScan(page);
  await expect(list.getByText(FAKE_CAMERA_CODE)).toBeVisible(); // daftar tetap ada
  await page.getByLabel('Kode QR atau nomor eartag').fill(qr.toLowerCase());
  await page.getByRole('button', { name: 'Cari' }).click();
  await page.getByLabel('Kode QR atau nomor eartag').fill('JB 3201 7777');
  await page.getByRole('button', { name: 'Cari' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  const row = (text: string) => list.getByRole('listitem').filter({ hasText: text });
  await expect(row(qr).getByRole('link', { name: 'Buka profil' })).toBeVisible();
  await expect(row('JB 3201 7777').getByRole('link', { name: 'Daftarkan' })).toBeVisible();
  await shot(page, 'hp-04-scan-beruntun');

  // Scan ulang kode yang sama tidak menambah baris.
  await page.getByLabel('Kode QR atau nomor eartag').fill(qr);
  await page.getByRole('button', { name: 'Cari' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);

  await page.getByLabel('Kode QR atau nomor eartag').fill('?');
  await page.getByRole('button', { name: 'Cari' }).click();
  await expect(page.getByText('Ketik kode QR (contoh IB-7K2QM) atau nomor eartag.')).toBeVisible();
});

test('izin kamera ditolak: pesan jelas, ketik manual tetap bisa', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  await login(page);
  await openScan(page);
  await expect(page.getByRole('alert').getByText('Izin kamera ditolak')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  await shot(page, 'hp-05-izin-ditolak');
  await page.getByLabel('Kode QR atau nomor eartag').fill('IB-ZZZZ9');
  await page.getByRole('button', { name: 'Cari' }).click();
  await expect(page.getByText('Belum terdaftar')).toBeVisible();
});
