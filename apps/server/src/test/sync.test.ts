// GET /api/sync/pull (docs/SYNC.md §4): cakupan per peran, halaman tanpa baris terlewat/ganda,
// cursor lanjutan, baris terhapus ikut terkirim, cakupan berubah → diulang dari awal.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness, type Harness } from './api-harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

const ids = (rows: { id: string }[] = []) => rows.map((r) => r.id);

describe('GET /api/sync/pull: cakupan', () => {
  it('butuh login', async () => {
    expect((await h.request('GET', '/api/sync/pull')).status).toBe(401);
  });

  it('peternak hanya menerima data miliknya; stok straw tidak dikirim', async () => {
    const farmer = await h.as('suparman');
    const me = await farmer.get('/api/auth/me');
    const { rows } = await h.pullAll('suparman');
    expect(ids(rows.farmers)).toEqual([me.body.farmerId]);
    expect(rows.animals?.length).toBeGreaterThan(0);
    expect(rows.animals?.every((a) => a.farmerId === me.body.farmerId)).toBe(true);
    const animalIds = new Set(ids(rows.animals));
    expect(rows.events?.every((e) => animalIds.has(e.animalId))).toBe(true);
    expect(rows.semenStock).toEqual([]);
    expect(rows.locations?.length).toBe(h.seed.locations.length);
  });

  it('admin kelompok hanya menerima peternak kelompoknya', async () => {
    const admin1 = (await h.pullAll('groupAdmin1')).rows;
    const admin2 = (await h.pullAll('groupAdmin2')).rows;
    const agency = (await h.pullAll('agencyAdmin')).rows;
    const a1 = new Set(ids(admin1.farmers));
    expect(ids(admin2.farmers).some((id) => a1.has(id))).toBe(false);
    expect((admin1.farmers?.length ?? 0) + (admin2.farmers?.length ?? 0)).toBe(
      agency.farmers?.length,
    );
    expect(agency.farmers?.length).toBe(h.seed.farmers.length);
    expect(agency.semenStock?.length).toBe(h.seed.semenStock.length);
  });

  it('petugas menerima stok strawnya sendiri saja', async () => {
    const { rows } = await h.pullAll('andi');
    expect(rows.semenStock?.length).toBeGreaterThan(0);
    expect(rows.semenStock?.every((s) => s.holderId === h.userId('andi'))).toBe(true);
  });
});

describe('GET /api/sync/pull: paginasi dan cursor', () => {
  it('halaman kecil = hasil sama dengan satu halaman besar, tanpa baris ganda', async () => {
    const big = await h.pullAll('agencyAdmin', {}, 1000);
    const small = await h.pullAll('agencyAdmin', {}, 37);
    expect(small.pages).toBeGreaterThan(5);
    for (const table of Object.keys(big.rows)) {
      const a = ids(big.rows[table]).sort();
      const b = ids(small.rows[table]);
      expect(new Set(b).size, table).toBe(b.length);
      expect([...b].sort(), table).toEqual(a);
    }
  });

  it('penulisan di sela halaman tidak terlewat; lanjutan hanya membawa yang berubah', async () => {
    const admin = await h.as('groupAdmin1');
    const first = await admin.get('/api/sync/pull?limit=10');
    expect(first.body.hasMore).toBe(true);
    const locationId = first.body.rows.locations[0].id as string;

    // Baris baru ditulis setelah halaman pertama.
    h.advanceDays(1);
    const created = await admin.post('/api/farmers', { name: 'Peternak Sela', locationId });
    expect(created.status).toBe(201);

    const rest = await h.pullAll('groupAdmin1', {
      cursor: first.body.cursor,
      scope: first.body.scope,
    });
    // Peternak baru di wilayah admin: sidik jari cakupan berubah → diulang dari awal (aman).
    const all = [...ids(first.body.rows.farmers), ...ids(rest.rows.farmers)];
    expect(all.filter((id) => id === created.body.id)).toHaveLength(1);

    // Lanjutan tanpa perubahan: kosong.
    const again = await h.pullAll('groupAdmin1', { cursor: rest.cursor, scope: rest.scope });
    expect(Object.values(again.rows).flat()).toEqual([]);

    // Ubah lalu hapus: ikut terkirim dengan deletedAt.
    h.advanceDays(1);
    const del = await admin.del(`/api/farmers/${created.body.id as string}`);
    expect(del.status).toBe(204);
    const next = await h.pullAll('groupAdmin1', { cursor: again.cursor, scope: rest.scope });
    expect(ids(next.rows.farmers)).toEqual([created.body.id]);
    expect(next.rows.farmers?.[0].deletedAt).not.toBeNull();
  });

  it('cursor rusak = tarik dari awal', async () => {
    const res = await (await h.as('suparman')).get('/api/sync/pull?cursor=rusak');
    expect(res.status).toBe(200);
    expect(res.body.rows.farmers.length).toBe(1);
  });
});

describe('cakupan berubah', () => {
  it('peternak pindah ke kelompok admin: pull diulang, peternak + ternak lamanya ikut', async () => {
    const before = await h.pullAll('groupAdmin1');
    const own = new Set(ids(before.rows.farmers));
    const other = (await h.pullAll('groupAdmin2')).rows.farmers?.[0];
    if (!other) throw new Error('kelompok 2 kosong');
    const target = before.rows.farmers?.[0];
    if (!target) throw new Error('kelompok 1 kosong');
    expect(own.has(other.id)).toBe(false);

    h.advanceDays(1);
    const agency = await h.as('agencyAdmin');
    const moved = await agency.patch(`/api/farmers/${other.id as string}`, {
      locationId: target.locationId,
    });
    expect(moved.status).toBe(200);

    const after = await h.pullAll('groupAdmin1', { cursor: before.cursor, scope: before.scope });
    expect(after.reset).toBe(true);
    expect(ids(after.rows.farmers)).toContain(other.id);
    const oldAnimals = h.seed.animals.filter((a) => a.farmerId === other.id).map((a) => a.id);
    expect(oldAnimals.length).toBeGreaterThan(0);
    for (const id of oldAnimals) expect(ids(after.rows.animals)).toContain(id);
  });
});
