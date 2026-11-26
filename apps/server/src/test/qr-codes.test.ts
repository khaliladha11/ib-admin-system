// Langkah 3.1: daftar kode QR (label tercetak) dan riwayat tag.
import { uuidv7 } from '@ib/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { qrCodes } from '../db/schema';
import { createHarness, type Harness } from './api-harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

const rowOf = (code: string) => h.db.select().from(qrCodes).where(eq(qrCodes.code, code)).get();

describe('daftar kode QR', () => {
  it('seed: setiap tag QR terpasang tercatat di daftar kode', () => {
    const qrTags = h.seed.animalTags.filter((t) => t.type === 'qr');
    expect(qrTags.length).toBeGreaterThan(0);
    for (const tag of qrTags) expect(rowOf(tag.code)).toBeDefined();
  });

  it('kode baru didaftarkan; kiriman ulang = ALREADY_EXISTS; kode sama dari id lain = CONFLICT', async () => {
    const rina = await h.as('rina');
    const id = uuidv7();
    const created = await rina.post('/api/qr-codes', { id, code: 'IB-RK2QM' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id, code: 'IB-RK2QM', issuedBy: h.userId('rina') });

    const again = await rina.post('/api/qr-codes', { id, code: 'IB-RK2QM' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_EXISTS');

    const andi = await h.as('andi');
    const clash = await andi.post('/api/qr-codes', { id: uuidv7(), code: 'IB-RK2QM' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('CONFLICT');
  });

  it('kode yang sudah terpasang sebagai tag tidak bisa didaftarkan lagi', async () => {
    const used = h.seed.animalTags.find((t) => t.type === 'qr')?.code;
    const res = await (await h.as('andi')).post('/api/qr-codes', { code: used });
    expect(res.status).toBe(409);
  });

  it('format kode dijaga: IB-XXXXX tanpa O/0/I/1', async () => {
    const andi = await h.as('andi');
    for (const code of ['IB-O0000', 'IB-ABCD', 'XX-ABCDE', 'ib-abcde']) {
      expect((await andi.post('/api/qr-codes', { code })).status).toBe(400);
    }
  });

  it('daftar dan sinkron hanya berisi kode milik pengguna itu', async () => {
    const andi = await h.as('andi');
    await andi.post('/api/qr-codes', { code: 'IB-ANDY2' });
    const list = await andi.get('/api/qr-codes');
    expect(list.body.items.map((r: { code: string }) => r.code)).toEqual(['IB-ANDY2']);

    const changes = await andi.get('/api/sync/changes?since=0');
    expect(changes.status).toBe(200);
    expect(changes.body.qrCodes.map((r: { code: string }) => r.code)).toEqual(['IB-ANDY2']);
  });

  it('wajib masuk', async () => {
    expect((await h.request('POST', '/api/qr-codes', { body: { code: 'IB-ZZZZ2' } })).status).toBe(
      401,
    );
  });
});

describe('tag QR dan daftar kode', () => {
  const cowOf = (farmer: string) => {
    const f = h.seed.farmers.find((x) => x.name === farmer);
    const cow = h.seed.animals.find((a) => a.farmerId === f?.id);
    if (!cow) throw new Error(farmer);
    return cow;
  };

  it('label kosong milik petugas lain boleh dipasang; tidak bisa dipasang dua kali', async () => {
    await (await h.as('rina')).post('/api/qr-codes', { code: 'IB-BLNK2' });
    const yusuf = await h.as('yusuf');
    const cow = cowOf('Suparman');
    const attached = await yusuf.post(`/api/animals/${cow.id}/tags`, {
      type: 'qr',
      code: 'IB-BLNK2',
      replaceReason: 'lost',
    });
    expect(attached.status).toBe(201);
    expect(rowOf('IB-BLNK2')?.issuedBy).toBe(h.userId('rina'));

    const other = cowOf('Siti Aminah');
    const twice = await yusuf.post(`/api/animals/${other.id}/tags`, {
      type: 'qr',
      code: 'IB-BLNK2',
      replaceReason: 'lost',
    });
    expect(twice.status).toBe(409);
  });

  it('kode ketikan yang belum terdaftar ikut didaftarkan saat dipasang', async () => {
    const yusuf = await h.as('yusuf');
    const cow = cowOf('Siti Aminah');
    const res = await yusuf.post(`/api/animals/${cow.id}/tags`, {
      type: 'qr',
      code: 'IB-TYPD3',
      replaceReason: 'damaged',
    });
    expect(res.status).toBe(201);
    expect(rowOf('IB-TYPD3')?.issuedBy).toBe(h.userId('yusuf'));
  });

  it('ternak baru dengan kode QR mendaftarkan kodenya', async () => {
    const yusuf = await h.as('yusuf');
    const farmer = h.seed.farmers.find((f) => f.name === 'Suparman');
    const res = await yusuf.post('/api/animals', {
      farmerId: farmer?.id,
      sex: 'F',
      name: 'Kembang',
      qrCode: 'IB-NEWC4',
    });
    expect(res.status).toBe(201);
    expect(rowOf('IB-NEWC4')).toBeDefined();
  });

  it('cabut tag: kiriman ulang dengan alasan sama = 200, alasan lain = 409', async () => {
    const yusuf = await h.as('yusuf');
    const cow = cowOf('Suparman');
    const tags = await yusuf.get(`/api/animals/${cow.id}/tags`);
    const active = (tags.body.items as { id: string; removedAt: number | null }[]).find(
      (t) => t.removedAt === null,
    );
    if (!active) throw new Error('tidak ada tag aktif');
    const first = await yusuf.post(`/api/tags/${active.id}/remove`, { reason: 'lost' });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ removalReason: 'lost' });
    const resend = await yusuf.post(`/api/tags/${active.id}/remove`, { reason: 'lost' });
    expect(resend.status).toBe(200);
    expect(resend.body.removedAt).toBe(first.body.removedAt);
    expect((await yusuf.post(`/api/tags/${active.id}/remove`, { reason: 'other' })).status).toBe(
      409,
    );
  });
});
