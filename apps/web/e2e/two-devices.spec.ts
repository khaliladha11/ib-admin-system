// Langkah 4.2: dua HP offline mengubah data yang sama lalu sinkron (docs/SYNC.md §5).
// HP A = Admin Dinas, HP B = Admin KTT-01, keduanya mencakup peternak/sapi yang sama.
// Dijalankan di build produksi (project `pwa`) agar aplikasi tetap terbuka saat offline.
import path from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { checkTargets } from './checks';

const SHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots');

async function shot(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `4.2-${name}.png`) });
  await checkTargets(page, name);
}

async function openDevice(context: BrowserContext, identifier: string) {
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Email atau nomor HP').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill('contoh123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('button', { name: /Lewati/ }).click();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Halaman berikutnya dibuka lewat cache service worker (juga saat offline).
  await page.reload();
  await expect(page.getByText('Semua data terkirim')).toBeVisible({ timeout: 20_000 });
  return page;
}

/** Baca satu tabel Dexie langsung dari IndexedDB HP itu. */
function readTable<T>(page: Page, table: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('ib-admin');
        open.onerror = () => {
          reject(new Error('IndexedDB'));
        };
        open.onsuccess = () => {
          const req = open.result.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => {
            resolve(req.result as T[]);
          };
        };
      }),
    table,
  );
}

async function recordEvent(page: Page, animalId: string, fill: () => Promise<void>, save: string) {
  await page.goto(`/ternak/${animalId}/catat`);
  await expect(page.getByRole('heading', { level: 1, name: 'Catat kejadian' })).toBeVisible();
  await fill();
  await page.getByRole('button', { name: save }).click();
  const confirm = page.getByRole('button', { name: 'Tetap simpan' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page.getByText(/tersimpan di HP ini/)).toBeVisible();
}

interface FarmerRow {
  id: string;
  name: string;
  phone: string | null;
  deletedAt: number | null;
}
interface AnimalRow {
  id: string;
  name: string | null;
  sex: string;
  farmerId: string;
  status: { kind: string };
}
interface EventRow {
  id: string;
  animalId: string;
  type: string;
  payload: { weightKg?: number };
  deletedAt: number | null;
}

test('dua HP offline mengubah data yang sama: tidak ada yang hilang atau ganda', async ({
  browser,
}) => {
  const ctxA = await browser.newContext({ serviceWorkers: 'allow' });
  const ctxB = await browser.newContext({ serviceWorkers: 'allow' });
  const a = await openDevice(ctxA, 'admin.dinas@contoh.test');
  const b = await openDevice(ctxB, 'admin.ktt01@contoh.test');

  // Data bersama: peternak X, sapi Y (berat), sapi Z (sudah IB, menunggu PKB).
  const farmers = ((await (await b.request.get('/api/farmers')).json()) as { items: FarmerRow[] })
    .items;
  const animals = ((await (await b.request.get('/api/animals')).json()) as { items: AnimalRow[] })
    .items;
  const z = animals.find((x) => x.sex === 'F' && x.status.kind === 'sudah_IB_menunggu_PKB');
  const y = animals.find((x) => x.sex === 'F' && x.status.kind === 'kosong');
  const farmer = farmers.find((f) => f.deletedAt === null);
  if (!z || !y || !farmer) throw new Error('data contoh tidak lengkap');

  // --- Keduanya offline --------------------------------------------------------
  await ctxA.setOffline(true);
  await ctxB.setOffline(true);

  // HP B (lebih dulu): ubah nama dan nomor HP peternak X.
  await b.goto(`/peternak/${farmer.id}`);
  await b.getByLabel('Nama peternak').fill('Nama dari HP B');
  await b.getByLabel(/^Nomor HP/).fill('081299990002');
  await b.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(b.getByRole('heading', { level: 1, name: 'Peternak', exact: true })).toBeVisible();

  // HP A (kemudian): ubah nomor HP peternak X saja.
  await a.goto(`/peternak/${farmer.id}`);
  await a.getByLabel(/^Nomor HP/).fill('081299990001');
  await a.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(a.getByRole('heading', { level: 1, name: 'Peternak', exact: true })).toBeVisible();

  // Keduanya mencatat berat sapi Y.
  for (const [page, kg] of [
    [a, '401'],
    [b, '399'],
  ] as const) {
    await recordEvent(
      page,
      y.id,
      async () => {
        await page.getByText('Berat', { exact: true }).click();
        await page.getByLabel('Berat (kg)').fill(kg);
      },
      'Simpan Berat',
    );
  }

  // A: PKB bunting sapi Z. B: IB ulang sapi Z (sah di HP B, bertentangan setelah PKB A).
  await recordEvent(
    a,
    z.id,
    async () => {
      await a.getByText('PKB', { exact: true }).click();
      await a.getByText('Bunting', { exact: true }).click();
      await a.getByLabel('Umur janin').selectOption({ index: 2 });
    },
    'Simpan PKB',
  );
  await recordEvent(
    b,
    z.id,
    async () => {
      await b.getByText('IB', { exact: true }).click();
      const manual = b.getByLabel('Kode straw');
      if (!(await manual.isVisible().catch(() => false))) {
        await b.getByRole('button', { name: /Isi manual|Tanpa stok/ }).click();
      }
      await b.getByLabel('Kode straw').fill('SIM-99');
      await b.getByLabel('ID pejantan').fill('BULL-99');
      await b.getByLabel('Batch').fill('B-99');
    },
    'Simpan IB',
  );
  await expect(b.getByText(/Tanpa sinyal, \d+ belum terkirim/)).toBeVisible();

  // --- A online lebih dulu, lalu B --------------------------------------------
  await ctxA.setOffline(false);
  await expect(a.getByText('Semua data terkirim')).toBeVisible({ timeout: 20_000 });
  await ctxB.setOffline(false);
  await expect(b.getByText('1 perlu dicek')).toBeVisible({ timeout: 20_000 });

  // --- Server: per kolom, kedua berat tepat sekali, IB B perlu dicek ------------
  const serverFarmer = (await (
    await a.request.get(`/api/farmers/${farmer.id}`)
  ).json()) as FarmerRow;
  expect(serverFarmer).toMatchObject({ name: 'Nama dari HP B', phone: '081299990001' });

  const timelineOf = async (id: string) =>
    ((await (await a.request.get(`/api/animals/${id}/timeline`)).json()) as { events: EventRow[] })
      .events;
  const weights = (await timelineOf(y.id))
    .filter((e) => e.type === 'BB')
    .map((e) => e.payload.weightKg)
    .sort();
  expect(weights.filter((w) => w === 399 || w === 401)).toEqual([399, 401]);
  const zEvents = await timelineOf(z.id);
  expect(zEvents.filter((e) => e.type === 'PKB')).not.toHaveLength(0);
  expect(zEvents.some((e) => e.type === 'IB' && JSON.stringify(e).includes('SIM-99'))).toBe(false);

  // HP B: halaman Data belum terkirim menampilkan IB yang perlu dicek.
  await b.getByRole('link', { name: /1 perlu dicek/ }).click();
  await expect(b.getByRole('heading', { name: 'Perlu dicek (1)' })).toBeVisible();
  await expect(b.getByText(/Bertentangan dengan catatan lain/)).toBeVisible();
  await shot(b, 'hp-01-perlu-dicek');

  // HP A (admin dinas) melihatnya di Tindak lanjut setelah sinkron.
  await a.goto('/tindak-lanjut');
  await expect(a.getByRole('heading', { name: 'Catatan perlu dicek (1)' })).toBeVisible({
    timeout: 20_000,
  });
  await shot(a, 'hp-02-admin-perlu-dicek');

  // --- Isi Dexie kedua HP sama untuk data bersama --------------------------------
  await b.goto('/'); // B menarik versi A
  await expect(b.getByText('1 perlu dicek')).toBeVisible({ timeout: 20_000 });
  const farmerIn = async (page: Page) =>
    (await readTable<FarmerRow>(page, 'farmers')).find((f) => f.id === farmer.id);
  expect(await farmerIn(a)).toMatchObject({ name: 'Nama dari HP B', phone: '081299990001' });
  expect(await farmerIn(b)).toMatchObject({ name: 'Nama dari HP B', phone: '081299990001' });
  const yWeights = async (page: Page) =>
    (await readTable<EventRow>(page, 'events'))
      .filter((e) => e.animalId === y.id && e.type === 'BB' && e.deletedAt === null)
      .map((e) => e.id)
      .sort();
  expect(await yWeights(a)).toEqual(await yWeights(b));
  expect(await yWeights(a)).toHaveLength(weights.length);

  await ctxA.close();
  await ctxB.close();
});
