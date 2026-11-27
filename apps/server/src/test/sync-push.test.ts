// POST /api/sync/push (docs/SYNC.md §3, §5): idempoten per id perubahan, daftar putih,
// event "perlu dicek", peringatan diterima, konflik profil per kolom, hapus menang.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditLogs, events, farmers, syncChanges } from '../db/schema';
import { createHarness, type Account, type Harness } from './api-harness';

const DAY = 86_400_000;

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

interface Change {
  id?: string;
  kind: string;
  method: 'POST' | 'PATCH';
  path: string;
  body: unknown;
  rowId?: string | null;
  at?: number;
}

async function push(account: Account, changes: Change[]) {
  const client = await h.as(account);
  return client.post('/api/sync/push', {
    changes: changes.map((c) => ({ id: h.newId(), at: h.now(), ...c })),
  });
}

/** Sapi dengan skenario tertentu di wilayah Admin KTT-01. */
async function cowOf(scenario: string) {
  const { rows } = await h.pullAll('groupAdmin1');
  const visible = new Set((rows.animals ?? []).map((a) => a.id as string));
  const cow = h.seed.animals.find((a) => visible.has(a.id) && h.seed.scenarios[a.id] === scenario);
  if (!cow) throw new Error(scenario);
  return cow;
}

describe('push: idempoten dan daftar putih', () => {
  it('butuh login', async () => {
    const res = await h.request('POST', '/api/sync/push', {
      body: {
        changes: [
          {
            id: h.newId(),
            kind: 'qrCode.reserve',
            method: 'POST',
            path: '/api/qr-codes',
            body: {},
            at: 1,
          },
        ],
      },
    });
    expect(res.status).toBe(401);
  });

  it('id perubahan yang sama tidak dijalankan dua kali; id baris yang sama tidak menggandakan', async () => {
    const { rows } = await h.pullAll('groupAdmin1');
    const locationId = rows.farmers?.[0]?.locationId as string;
    const farmerId = h.newId();
    const change = {
      id: h.newId(),
      kind: 'farmer.create',
      method: 'POST' as const,
      path: '/api/farmers',
      body: { id: farmerId, name: 'Peternak Push', locationId },
      rowId: farmerId,
    };
    const first = await push('groupAdmin1', [change]);
    expect(first.status).toBe(200);
    expect(first.body.results).toMatchObject([{ id: change.id, result: 'applied' }]);
    expect(first.body.results[0].body).toMatchObject({ id: farmerId, name: 'Peternak Push' });

    const resend = await push('groupAdmin1', [change]);
    expect(resend.body.results).toMatchObject([{ id: change.id, result: 'applied', body: null }]);
    // Perubahan baru (id lain) untuk baris yang sama: dianggap sudah ada.
    const copy = await push('groupAdmin1', [{ ...change, id: h.newId() }]);
    expect(copy.body.results).toMatchObject([{ result: 'applied', code: 'ALREADY_EXISTS' }]);
    expect(h.db.select().from(farmers).where(eq(farmers.id, farmerId)).all()).toHaveLength(1);

    // Id perubahan milik pengguna lain tidak bisa dipakai.
    const stolen = await push('groupAdmin2', [change]);
    expect(stolen.body.results).toMatchObject([{ result: 'rejected', code: 'CONFLICT' }]);
  });

  it('path di luar daftar putih ditolak tanpa dijalankan', async () => {
    const res = await push('agencyAdmin', [
      { kind: 'farmer.create', method: 'POST', path: '/api/users', body: { name: 'x' } },
      { kind: 'farmer.update', method: 'POST', path: `/api/farmers/${h.newId()}`, body: {} },
    ]);
    expect(
      res.body.results.map((r: { result: string; code: string }) => [r.result, r.code]),
    ).toEqual([
      ['rejected', 'FORBIDDEN'],
      ['rejected', 'FORBIDDEN'],
    ]);
  });

  it('ditolak (izin, data tidak ada): isi perubahan disimpan, antrean lanjut', async () => {
    const missing = h.newId();
    const res = await push('rina', [
      {
        kind: 'animal.update',
        method: 'PATCH',
        path: `/api/animals/${missing}`,
        body: { name: 'Tidak Ada' },
        rowId: missing,
      },
      { kind: 'qrCode.reserve', method: 'POST', path: '/api/qr-codes', body: { code: 'IB-PUSH2' } },
    ]);
    expect(res.body.results.map((r: { result: string }) => r.result)).toEqual([
      'rejected',
      'applied',
    ]);
    const stored = h.db
      .select()
      .from(syncChanges)
      .where(eq(syncChanges.id, res.body.results[0].id as string))
      .get();
    expect(stored).toMatchObject({ result: 'rejected', code: 'NOT_FOUND' });
    expect(stored?.payload).toMatchObject({ body: { name: 'Tidak Ada' } });
  });
});

describe('push: event', () => {
  it('urutan tidak masuk akal → perlu dicek (tersimpan, terlihat pencatat dan admin)', async () => {
    const cow = await cowOf('kosong');
    const eventId = h.newId();
    const lh = {
      id: h.newId(),
      kind: 'event.create',
      method: 'POST' as const,
      path: `/api/animals/${cow.id}/events`,
      body: {
        id: eventId,
        type: 'LH',
        occurredAt: h.now() - DAY,
        payload: { calves: [{ sex: 'F', condition: 'stillborn' }] },
      },
      rowId: eventId,
    };
    const res = await push('groupAdmin1', [lh]);
    expect(res.body.results).toMatchObject([{ result: 'needs_review', code: 'INVALID_EVENT' }]);
    expect(h.db.select().from(events).where(eq(events.id, eventId)).all()).toEqual([]);

    const own = (await h.pullAll('groupAdmin1')).rows.syncReviews ?? [];
    const review = own.find((r) => r.rowId === eventId);
    expect(review).toMatchObject({ animalId: cow.id, resolution: null, kind: 'event.create' });
    expect(review?.payload.body).toMatchObject({ type: 'LH' });
    // Admin dinas (wilayah mencakup) juga melihat; admin kelompok lain tidak.
    expect(
      (await h.pullAll('agencyAdmin')).rows.syncReviews?.some((r) => r.rowId === eventId),
    ).toBe(true);
    expect(
      (await h.pullAll('groupAdmin2')).rows.syncReviews?.some((r) => r.rowId === eventId),
    ).toBe(false);

    // Diperbaiki: IB dan PKB bunting dicatat dulu, lalu LH dikirim ulang (id perubahan baru).
    const ib = h.newId();
    const pkb = h.newId();
    const fixed = await push('groupAdmin1', [
      {
        kind: 'event.create',
        method: 'POST',
        path: `/api/animals/${cow.id}/events`,
        body: {
          id: ib,
          type: 'IB',
          occurredAt: h.now() - 290 * DAY,
          payload: { strawCode: 'SIM-1', bullId: 'BULL-7', batch: 'B-1' },
        },
        rowId: ib,
      },
      {
        kind: 'event.create',
        method: 'POST',
        path: `/api/animals/${cow.id}/events`,
        body: {
          id: pkb,
          type: 'PKB',
          occurredAt: h.now() - 220 * DAY,
          payload: { result: 'pregnant', fetalAgeMonths: 2 },
        },
        rowId: pkb,
      },
      lh,
      { ...lh, id: h.newId() },
    ]);
    expect(fixed.body.results.map((r: { result: string }) => r.result)).toEqual([
      'applied',
      'applied',
      'needs_review', // id perubahan lama: hasil lama dikembalikan (idempoten)
      'applied',
    ]);
    const resolved = (await h.pullAll('groupAdmin1')).rows.syncReviews?.find(
      (r) => r.rowId === eventId,
    );
    expect(resolved).toMatchObject({ resolution: 'resent' });
    expect(h.db.select().from(events).where(eq(events.id, eventId)).all()).toHaveLength(1);
  });

  it('peringatan akibat data HP lain diterima saat sinkron', async () => {
    const cow = await cowOf('bunting');
    const id = h.newId();
    const body = { id, type: 'BH', occurredAt: h.now() - DAY, payload: {} };
    const direct = await (await h.as('groupAdmin1')).post(`/api/animals/${cow.id}/events`, body);
    expect(direct.status).toBe(409); // REST biasa: minta konfirmasi
    const res = await push('groupAdmin1', [
      {
        kind: 'event.create',
        method: 'POST',
        path: `/api/animals/${cow.id}/events`,
        body,
        rowId: id,
      },
    ]);
    expect(res.body.results).toMatchObject([{ result: 'applied' }]);
  });

  it('buang catatan perlu dicek: tetap tersimpan sebagai discarded, idempoten', async () => {
    const cow = await cowOf('kosong');
    const id = h.newId();
    const res = await push('groupAdmin1', [
      {
        kind: 'event.create',
        method: 'POST',
        path: `/api/animals/${cow.id}/events`,
        body: { id, type: 'KGG', occurredAt: h.now() - DAY, payload: { trimester: 1 } },
        rowId: id,
      },
    ]);
    expect(res.body.results[0].result).toBe('needs_review');
    const reviewId = res.body.results[0].id as string;

    // Admin kelompok lain tidak bisa; admin dinas bisa (wilayahnya mencakup).
    const other = await (
      await h.as('groupAdmin2')
    ).post(`/api/sync/reviews/${reviewId}/discard`, {});
    expect(other.status).toBe(404);
    const agency = await h.as('agencyAdmin');
    const done = await agency.post(`/api/sync/reviews/${reviewId}/discard`, {
      reason: 'Salah sapi',
    });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ resolution: 'discarded' });
    expect((await agency.post(`/api/sync/reviews/${reviewId}/discard`, {})).status).toBe(200);
    const log = h.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'sync_changes'), eq(auditLogs.rowId, reviewId)))
      .all();
    expect(log).toHaveLength(1);
  });
});

describe('push: konflik profil per kolom', () => {
  it('dua HP mengubah peternak yang sama: kolom berbeda digabung, kolom sama → yang lebih baru', async () => {
    const { rows } = await h.pullAll('groupAdmin1');
    const farmer = rows.farmers?.find((f) => f.deletedAt === null);
    if (!farmer) throw new Error('tidak ada peternak');
    const path = `/api/farmers/${farmer.id as string}`;
    const t0 = h.now();

    // HP A (admin dinas) mengubah HP peternak pada t0-1 jam, sinkron lebih dulu.
    const a = await push('agencyAdmin', [
      {
        kind: 'farmer.update',
        method: 'PATCH',
        path,
        body: { phone: '081299990001' },
        at: t0 - 3_600_000,
        rowId: farmer.id,
      },
    ]);
    expect(a.body.results).toMatchObject([{ result: 'applied' }]);

    // HP B (admin kelompok) offline lebih lama: ubah nama + HP pada t0-2 jam, sinkron kemudian.
    const b = await push('groupAdmin1', [
      {
        kind: 'farmer.update',
        method: 'PATCH',
        path,
        body: { name: 'Nama dari HP B', phone: '081299990002' },
        at: t0 - 7_200_000,
        rowId: farmer.id,
      },
    ]);
    expect(b.body.results).toMatchObject([{ result: 'merged' }]);

    const now = h.db
      .select()
      .from(farmers)
      .where(eq(farmers.id, farmer.id as string))
      .get();
    expect(now).toMatchObject({ name: 'Nama dari HP B', phone: '081299990001' });

    const conflicts = h.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.rowId, farmer.id as string), eq(auditLogs.action, 'conflict')))
      .all();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.before).toMatchObject({ phone: '081299990002' });
    expect(conflicts[0]?.after).toEqual({ phone: '081299990001' });
    expect(conflicts[0]?.actorId).toBe(h.userId('groupAdmin1'));
  });

  it('waktu HP di masa depan dipotong: tidak bisa mengunci kolom selamanya', async () => {
    const { rows } = await h.pullAll('groupAdmin1');
    const farmer = rows.farmers?.find(
      (f) => f.deletedAt === null && f.id !== rows.farmers?.[0]?.id,
    );
    if (!farmer) throw new Error('tidak ada peternak');
    const path = `/api/farmers/${farmer.id as string}`;
    await push('groupAdmin1', [
      {
        kind: 'farmer.update',
        method: 'PATCH',
        path,
        body: { address: 'Jam salah' },
        at: h.now() + 365 * DAY,
      },
    ]);
    h.advanceDays(1);
    const later = await push('agencyAdmin', [
      {
        kind: 'farmer.update',
        method: 'PATCH',
        path,
        body: { address: 'Alamat benar' },
        at: h.now(),
      },
    ]);
    expect(later.body.results).toMatchObject([{ result: 'applied' }]);
    expect(
      h.db
        .select()
        .from(farmers)
        .where(eq(farmers.id, farmer.id as string))
        .get()?.address,
    ).toBe('Alamat benar');
  });

  it('hapus menang: ubah ternak yang sudah dihapus ditolak, isinya tetap tersimpan', async () => {
    const cow = await cowOf('sakit');
    const admin = await h.as('groupAdmin1');
    expect((await admin.del(`/api/animals/${cow.id}`)).status).toBe(204);
    const res = await push('groupAdmin1', [
      {
        kind: 'animal.update',
        method: 'PATCH',
        path: `/api/animals/${cow.id}`,
        body: { name: 'Setelah dihapus' },
        rowId: cow.id,
      },
    ]);
    expect(res.body.results).toMatchObject([{ result: 'rejected', code: 'NOT_FOUND' }]);
    const stored = h.db
      .select()
      .from(syncChanges)
      .where(eq(syncChanges.id, res.body.results[0].id as string))
      .get();
    expect(stored?.payload).toMatchObject({ body: { name: 'Setelah dihapus' } });
  });
});
