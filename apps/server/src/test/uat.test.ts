// Langkah 5.1: masukan peserta (lewat push + pull) dan server latihan (reset data demo).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { countRows } from '../db/client';
import { animals, feedback, sessions, users } from '../db/schema';
import { exportAll } from '../ops/export';
import { DemoModeOffError, dataGeneration, resetDemoData } from '../ops/demo';
import { createHarness, type Harness } from './api-harness';

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(path.join(tmpdir(), 'ib-uat-'));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('masukan', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => {
    h.close();
  });

  it('semua peran boleh mengirim; kiriman ulang lewat push aman', async () => {
    const id = h.newId();
    const change = {
      id: h.newId(),
      at: h.now(),
      kind: 'feedback.create',
      method: 'POST',
      path: '/api/feedback',
      rowId: id,
      body: { id, topic: 'record', rating: 3, text: 'Form IB mudah' },
    };
    const farmer = await h.as('suparman');
    const first = await farmer.post('/api/sync/push', { changes: [change] });
    expect(first.status).toBe(200);
    expect(first.body.results[0].result).toBe('applied');
    // Id perubahan sama → hasil yang tersimpan; id baris sama dengan id perubahan baru → tetap satu.
    await farmer.post('/api/sync/push', { changes: [change] });
    await farmer.post('/api/sync/push', { changes: [{ ...change, id: h.newId() }] });
    expect(countRows(h.db, feedback)).toBe(1);

    const andi = await h.as('andi');
    const res = await andi.post('/api/feedback', {
      topic: 'scan',
      rating: 1,
      text: 'Kamera lambat',
    });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(h.userId('andi'));
  });

  it('isi divalidasi', async () => {
    const farmer = await h.as('suparman');
    expect((await farmer.post('/api/feedback', { topic: 'record', rating: 4 })).status).toBe(400);
    expect((await farmer.post('/api/feedback', { topic: 'lain', rating: 2 })).status).toBe(400);
    expect((await farmer.post('/api/feedback', { topic: 'other', rating: 2 })).status).toBe(201);
  });

  it('pengirim hanya melihat miliknya; admin melihat wilayahnya', async () => {
    const own = await h.pullAll('suparman');
    expect(own.rows.feedback?.every((f) => f.userId === h.userId('suparman'))).toBe(true);
    expect(own.rows.feedback).toHaveLength(2);

    const agency = await h.pullAll('agencyAdmin');
    expect(agency.rows.feedback).toHaveLength(3);

    // Peternak Agus (KTT-02) di luar wilayah admin KTT-01.
    const agus = await h.as('agus');
    await agus.post('/api/feedback', { topic: 'general', rating: 2, text: '' });
    const group = await h.as('groupAdmin1');
    const list = await group.get('/api/feedback');
    expect(list.status).toBe(200);
    const senders = new Set(list.body.items.map((f: { userId: string }) => f.userId));
    expect(senders.has(h.userId('suparman'))).toBe(true);
    expect(senders.has(h.userId('agus'))).toBe(false);

    expect((await (await h.as('suparman')).get('/api/feedback')).status).toBe(403);
  });

  it('ikut ekspor', () => {
    expect(exportAll(h.db, h.now()).tables.feedback).toHaveLength(4);
  });
});

describe('server latihan: reset data demo', () => {
  it('server biasa: rute 404, fungsi menolak, generasi null', async () => {
    const h = await createHarness({ backupDir: path.join(tmp, 'b1'), demoMode: false });
    const admin = await h.as('agencyAdmin');
    expect((await admin.post('/api/system/demo/reset')).status).toBe(404);
    expect((await admin.get('/api/system/info')).body.demoMode).toBe(false);
    const me = await admin.get('/api/auth/me');
    expect(me.body.generation).toBeNull();
    expect(me.body.demoMode).toBe(false);
    await expect(resetDemoData(h.db, h.now(), false)).rejects.toBeInstanceOf(DemoModeOffError);
    h.close();
  });

  it('hanya admin dinas; data diisi ulang, sesi terhapus, generasi berganti', async () => {
    const h = await createHarness({ backupDir: path.join(tmp, 'b2'), demoMode: true });
    const group = await h.as('groupAdmin1');
    expect((await group.post('/api/system/demo/reset')).status).toBe(403);

    // Data latihan peserta yang akan hilang.
    const farmer = await h.as('suparman');
    await farmer.post('/api/feedback', { topic: 'general', rating: 3, text: 'tes' });
    const animalsBefore = countRows(h.db, animals);
    const usersBefore = countRows(h.db, users);

    const admin = await h.as('agencyAdmin');
    expect((await admin.get('/api/system/info')).body.demoMode).toBe(true);
    const res = await admin.post('/api/system/demo/reset');
    expect(res.status).toBe(200);
    expect(res.body.backup).toMatch(/^ib-ternak-.*\.sqlite$/);
    expect(res.body.generation).toBe(dataGeneration(h.db));

    expect(countRows(h.db, feedback)).toBe(0);
    expect(countRows(h.db, sessions)).toBe(0);
    expect(countRows(h.db, animals)).toBe(animalsBefore);
    expect(countRows(h.db, users)).toBe(usersBefore);
    // Cookie lama tidak berlaku lagi; akun contoh bisa masuk lagi dengan password yang sama.
    expect((await admin.get('/api/auth/me')).status).toBe(401);
    const login = await h.request('POST', '/api/auth/login', {
      body: { identifier: 'admin.dinas@contoh.test', password: 'contoh123' },
    });
    expect(login.status).toBe(200);
    expect(login.body.generation).toBe(res.body.generation);
    expect(login.body.demoMode).toBe(true);

    const again = await resetDemoData(h.db, h.now() + 1000, true);
    expect(again).not.toBe(res.body.generation);
    h.close();
  });
});
