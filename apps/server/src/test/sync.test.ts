// GET /api/sync/changes: cakupan per peran, cursor `since`, baris terhapus ikut terkirim,
// dan id ganda dari outbox dijawab 409 ALREADY_EXISTS.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness, type Harness } from './api-harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('GET /api/sync/changes', () => {
  it('butuh login', async () => {
    expect((await h.request('GET', '/api/sync/changes')).status).toBe(401);
  });

  it('peternak hanya menerima data miliknya; stok straw tidak dikirim', async () => {
    const farmer = await h.as('suparman');
    const me = await farmer.get('/api/auth/me');
    const res = await farmer.get('/api/sync/changes');
    expect(res.status).toBe(200);
    expect(ids(res.body.farmers)).toEqual([me.body.farmerId]);
    expect(res.body.animals.length).toBeGreaterThan(0);
    expect(res.body.animals.every((a: any) => a.farmerId === me.body.farmerId)).toBe(true);
    const animalIds = new Set(ids(res.body.animals));
    expect(res.body.events.every((e: any) => animalIds.has(e.animalId))).toBe(true);
    expect(res.body.semenStock).toEqual([]);
    expect(res.body.locations.length).toBe(h.seed.locations.length);
    expect(res.body.serverTime).toBe(h.now() - 1_000);
  });

  it('admin kelompok hanya menerima peternak kelompoknya', async () => {
    const admin1 = await (await h.as('groupAdmin1')).get('/api/sync/changes');
    const admin2 = await (await h.as('groupAdmin2')).get('/api/sync/changes');
    const agency = await (await h.as('agencyAdmin')).get('/api/sync/changes');
    const a1 = new Set(ids(admin1.body.farmers));
    expect(ids(admin2.body.farmers).some((id) => a1.has(id))).toBe(false);
    const total = Number(admin1.body.farmers.length) + Number(admin2.body.farmers.length);
    expect(total).toBe(agency.body.farmers.length);
    expect(agency.body.farmers.length).toBe(h.seed.farmers.length);
    expect(agency.body.semenStock.length).toBe(h.seed.semenStock.length);
  });

  it('petugas menerima stok strawnya sendiri saja', async () => {
    const res = await (await h.as('andi')).get('/api/sync/changes');
    expect(res.body.semenStock.length).toBeGreaterThan(0);
    expect(res.body.semenStock.every((s: any) => s.holderId === h.userId('andi'))).toBe(true);
  });

  it('since: hanya baris yang berubah sejak cursor, termasuk yang dihapus', async () => {
    const admin = await h.as('groupAdmin1');
    const first = await admin.get('/api/sync/changes');
    const cursor = first.body.serverTime;

    const empty = await admin.get(`/api/sync/changes?since=${String(h.now() + 1)}`);
    expect(empty.body.farmers).toEqual([]);
    expect(empty.body.events).toEqual([]);

    h.advanceDays(1);
    const fresh = await h.as('groupAdmin1');
    const created = await fresh.post('/api/farmers', {
      name: 'Peternak Sinkron',
      locationId: first.body.farmers[0].locationId,
    });
    expect(created.status).toBe(201);
    const del = await fresh.del(`/api/farmers/${created.body.id as string}`);
    expect(del.status).toBe(204);

    const next = await fresh.get(`/api/sync/changes?since=${String(cursor)}`);
    expect(ids(next.body.farmers)).toEqual([created.body.id]);
    expect(next.body.farmers[0].deletedAt).not.toBeNull();
    expect(next.body.animals).toEqual([]);
  });
});

describe('id ganda dari outbox', () => {
  it('membuat data dengan id yang sudah ada → 409 ALREADY_EXISTS', async () => {
    const admin = await h.as('groupAdmin1');
    const sync = await admin.get('/api/sync/changes');
    const id = h.newId();
    const body = { id, name: 'Dua Kali', locationId: sync.body.farmers[0].locationId };
    expect((await admin.post('/api/farmers', body)).status).toBe(201);
    const again = await admin.post('/api/farmers', body);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_EXISTS');
  });
});
