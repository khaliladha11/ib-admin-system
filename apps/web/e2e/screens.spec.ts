// Langkah 2.2: alur layar HP (petugas dan peternak) di 360×740, dengan screenshot per layar.
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');
const PASSWORD = 'contoh123';
const INSEMINATOR = '081200000201'; // Andi: punya tugas IB yang sudah ditugaskan (seed)
const FARMER = '081200000103'; // Siti: pemilik sapi yang dimintakan IB

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250); // biarkan useLiveQuery selesai menggambar
  await page.screenshot({ path: path.join(SHOTS, `2.2-${name}.png`) });
}

async function login(page: Page, identifier: string, { skipPin = true } = {}) {
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('heading', { name: 'Pasang PIN?' })).toBeVisible();
  if (skipPin) {
    await page.getByRole('button', { name: 'Lewati, pakai password saja' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible();
    // Tunggu tarikan data pertama dari server selesai.
    await expect(page.getByText('Semua data terkirim')).toBeVisible();
  }
}

/** Tidak ada scroll ke samping, dan (opsional) tidak ada scroll ke bawah. */
async function expectFits(page: Page, { vertical = false } = {}) {
  const size = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
    vw: window.innerWidth,
    vh: window.innerHeight,
  }));
  expect(size.w).toBeLessThanOrEqual(size.vw);
  if (vertical) expect(size.h).toBeLessThanOrEqual(size.vh);
}

test('petugas: masuk, hari ini, ternak, profil, catat IB, tugas', async ({ page }) => {
  // 1. Login
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
  await expectFits(page);
  await shot(page, '01-masuk');

  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByText('Isi email atau nomor HP.')).toBeVisible();

  await login(page, INSEMINATOR, { skipPin: false });
  await shot(page, '02-tawaran-pin');
  await page.getByRole('button', { name: 'Lewati, pakai password saja' }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible();

  // 2. Beranda "Hari ini", dikelompokkan per desa
  await expect(page.getByRole('region', { name: /^Desa / }).first()).toBeVisible();
  await expectFits(page);
  await shot(page, '03-hari-ini');

  // 3. Daftar ternak: cari dan filter
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .last()
    .getByRole('link', { name: 'Ternak' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ternak' })).toBeVisible();
  await expectFits(page);
  await shot(page, '04-daftar-ternak');
  await page.getByRole('radio', { name: /Bunting/ }).click();
  await expect(page.getByText(/^\d+ ternak$/)).toBeVisible();
  await shot(page, '05-filter-bunting');
  await page.getByRole('radio', { name: /Semua/ }).click();
  const firstQr = await page.locator('article p span.font-semibold').first().textContent();
  await page.getByLabel('Cari ternak').fill((firstQr ?? '').replace('-', '').toLowerCase());
  await expect(page.getByText('1 ternak')).toBeVisible();
  await shot(page, '06-cari-kode');

  // 4. Profil ternak dari tugas: buka Tugas, terima, lalu catat IB
  await page.getByLabel('Cari ternak').fill('');
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .last()
    .getByRole('link', { name: 'Tugas' })
    .click();
  await expect(page.getByRole('button', { name: 'Terima tugas' }).first()).toBeVisible();
  await expectFits(page);
  await shot(page, '07-tugas-petugas');
  await page.getByRole('button', { name: 'Terima tugas' }).first().click();
  await expect(page.getByText('Sedang dikerjakan').first()).toBeVisible();

  // Profil ternak tugas itu
  const animalLink = page
    .locator('article')
    .filter({ hasText: 'Sedang dikerjakan' })
    .first()
    .getByRole('link')
    .first();
  await animalLink.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profil ternak' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Riwayat' })).toBeVisible();
  await expectFits(page);
  await shot(page, '08-profil-ternak');
  await page.screenshot({
    path: path.join(SHOTS, '2.2-08b-profil-ternak-penuh.png'),
    fullPage: true,
  });

  // 5. Form catat IB: muat satu layar tanpa scroll
  await page.getByRole('link', { name: 'Kerjakan tugas IB' }).click();
  await expect(page.getByRole('button', { name: 'Simpan IB' })).toBeVisible();
  await expect(page.getByLabel('Straw dari stok')).toBeVisible();
  await expect(page.getByText('Tandai permintaan IB peternak selesai')).toBeVisible();
  await shot(page, '09-catat-ib');
  await expectFits(page, { vertical: true });
  await page.getByRole('button', { name: 'Simpan IB' }).click();
  await expect(page.getByText('IB tersimpan di HP ini.')).toBeVisible();
  await expect(page.getByText('Inseminasi (IB)').first()).toBeVisible();
  await shot(page, '10-ib-tersimpan');

  // Tombol jenis lain (PKB, Keguguran, Lahir, Berat)
  await page.getByRole('link', { name: 'Catat kejadian' }).click();
  await page.getByText('Lahir', { exact: true }).click();
  await shot(page, '11-catat-lahir');
  await page.getByText('PKB', { exact: true }).click();
  await page.getByText('Bunting', { exact: true }).click();
  await shot(page, '12-catat-pkb');

  // 6. Lainnya + pasang PIN
  await page.goto('/lainnya');
  await expect(page.getByRole('heading', { name: 'Sinkron data' })).toBeVisible();
  await expect(page.getByText('Semua data sudah terkirim.')).toBeVisible({ timeout: 15_000 });
  await shot(page, '13-lainnya');
  await page.getByRole('button', { name: 'Pasang PIN' }).click();
  for (const d of '2468') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  for (const d of '2468') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('PIN terpasang.', { exact: false }).first()).toBeVisible();

  // Buka ulang aplikasi: layar PIN
  await page.reload();
  await expect(page.getByText('Masukkan PIN untuk membuka aplikasi.')).toBeVisible();
  await shot(page, '14-buka-dengan-pin');
  for (const d of '2468') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Buka' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lainnya' })).toBeVisible();
});

test('peternak: hari ini, permintaan IB/PKB, catat birahi', async ({ page }) => {
  await login(page, FARMER);
  await shot(page, '15-hari-ini-peternak');

  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .last()
    .getByRole('link', { name: 'Tugas' })
    .click();
  await expect(page.getByRole('heading', { name: 'Permintaan saya' })).toBeVisible();
  await expectFits(page);
  await shot(page, '16-permintaan-peternak');

  await page.getByRole('link', { name: 'Minta petugas IB atau PKB' }).click();
  await expect(page.getByRole('button', { name: 'Ajukan IB' })).toBeVisible();
  await page.getByText('PKB', { exact: true }).click();
  const options = page.getByLabel('Sapi', { exact: true }).locator('option');
  await page
    .getByLabel('Sapi', { exact: true })
    .selectOption({ index: (await options.count()) - 1 });
  await page.getByLabel('Pesan untuk petugas (boleh kosong)').fill('Sudah 2 bulan setelah IB');
  await expectFits(page);
  await shot(page, '17-ajukan-permintaan');
  await page.getByRole('button', { name: 'Ajukan PKB' }).click();
  await expect(page.getByText('Menunggu verifikasi').first()).toBeVisible();
  await expect(page.getByText('“Sudah 2 bulan setelah IB”')).toBeVisible();
  await shot(page, '18-permintaan-terkirim');

  // Peternak tidak melihat IB/PKB di form catat
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .last()
    .getByRole('link', { name: 'Ternak' })
    .click();
  await page.locator('article button').first().click();
  await page.getByRole('link', { name: 'Catat kejadian' }).click();
  await expect(page.getByText('Birahi', { exact: true })).toBeVisible();
  await expect(page.getByText('IB', { exact: true })).toHaveCount(0);
  await expectFits(page);
  await shot(page, '19-catat-peternak');
});
