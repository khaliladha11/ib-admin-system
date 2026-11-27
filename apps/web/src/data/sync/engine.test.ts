// Sync engine dengan fetch tiruan: push FIFO, hasil per status HTTP, pull dengan cursor.
import { describe, expect, it, vi } from 'vitest';

import {
  createTestLayer,
  DAY,
  errorReply,
  makeAnimal,
  makeEvent,
  TODAY,
  type Call,
} from '@/test/data-fixtures';

import { pendingEntries, pendingRowIds, rejectedEntries, reviewEntries } from '../outbox';

/** Satu halaman GET /api/sync/pull. */
const page = (
  rows: Record<string, unknown[]> = {},
  { cursor = 'c1', hasMore = false, scope = 's1', reset = false } = {},
) => ({ rows, cursor, hasMore, scope, reset });

const isPull = (c: Call) => c.method === 'GET' && c.path.startsWith('/api/sync/pull');

/** Server yang menerima semua tulisan dan menggemakan baris yang dikirim. */
function echoServer() {
  return (call: Call) => {
    if (isPull(call)) return { status: 200, body: page() };
    return { status: 201, body: call.body };
  };
}

describe('pushOutbox', () => {
  it('mengirim entri berurutan (FIFO) dan mengosongkan outbox', async () => {
    const t = await createTestLayer('inseminator', echoServer());
    const a = await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name: 'A' });
    await t.repo.recordEvent(a.id, { type: 'BH', payload: {}, occurredAt: TODAY });
    await t.repo.updateAnimal(a.id, { name: 'A2' });

    const res = await t.sync.pushOutbox();
    expect(res).toEqual({ sent: 3, rejected: 0, stopped: null });
    expect(t.server.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/animals',
      `POST /api/animals/${a.id}/events`,
      `PATCH /api/animals/${a.id}`,
    ]);
    expect(await t.db.outbox.count()).toBe(0);
  });

  it('2xx: baris lokal diganti versi server; tag QR sementara dibuang', async () => {
    const t = await createTestLayer('group_admin');
    const a = await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', qrCode: 'IB-ABC23' });
    t.server.setHandler(() => ({
      status: 201,
      body: {
        ...a,
        name: 'Dari server',
        updatedAt: TODAY + 1,
        deviceId: 'server',
        status: { kind: 'kosong' },
        qrCode: 'IB-ABC23',
      },
    }));
    await t.sync.pushOutbox();
    const stored = await t.db.animals.get(a.id);
    expect(stored).toMatchObject({ name: 'Dari server', deviceId: 'server' });
    expect(stored).not.toHaveProperty('status');
    expect(stored).not.toHaveProperty('qrCode');
    expect(await t.db.animalTags.where('animalId').equals(a.id).count()).toBe(0);
  });

  it('409 ALREADY_EXISTS: dianggap sudah terkirim', async () => {
    const t = await createTestLayer('group_admin', () => errorReply(409, 'ALREADY_EXISTS'));
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    expect(await t.sync.pushOutbox()).toEqual({ sent: 1, rejected: 0, stopped: null });
    expect(await t.db.outbox.count()).toBe(0);
  });

  it('event dengan urutan tidak masuk akal: perlu dicek (tidak hilang), antrean tetap jalan', async () => {
    const t = await createTestLayer('inseminator');
    const ev = await t.repo.recordEvent(t.animal.id, {
      type: 'BH',
      payload: {},
      occurredAt: TODAY,
    });
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'M' });
    t.server.setHandler((call) =>
      call.path.endsWith('/events')
        ? errorReply(422, 'INVALID_EVENT', 'Urutan event tidak masuk akal.')
        : { status: 201, body: call.body },
    );
    expect(await t.sync.pushOutbox()).toEqual({ sent: 1, rejected: 1, stopped: null });
    expect(await reviewEntries(t.db)).toMatchObject([
      {
        kind: 'event.create',
        status: 'needs_review',
        code: 'INVALID_EVENT',
        lastError: 'Urutan event tidak masuk akal.',
      },
    ]);
    // Event lokal tetap ada dan tidak ditimpa/dihapus pull.
    expect(await t.db.events.get(ev.event.id)).toBeDefined();
    expect(await pendingRowIds(t.db)).toContain(ev.event.id);
    expect(await pendingEntries(t.db)).toEqual([]);
  });

  it('penolakan lain (izin, data tidak ada): tidak diterima beserta pesannya', async () => {
    const t = await createTestLayer('group_admin');
    await t.repo.updateAnimal(t.animal.id, { name: 'X' });
    t.server.setHandler(() => errorReply(404, 'NOT_FOUND', 'Ternak tidak ditemukan.'));
    expect(await t.sync.pushOutbox()).toEqual({ sent: 0, rejected: 1, stopped: null });
    expect(await rejectedEntries(t.db)).toMatchObject([
      { status: 'rejected', code: 'NOT_FOUND', lastError: 'Ternak tidak ditemukan.' },
    ]);
  });

  it('batch: satu request untuk banyak entri; gangguan di tengah → sisanya dicoba lagi', async () => {
    const t = await createTestLayer('group_admin');
    for (const name of ['A', 'B', 'C']) {
      await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name });
    }
    let n = 0;
    t.server.setHandler((call) => {
      n += 1;
      return n === 2 ? errorReply(503, 'INTERNAL_ERROR') : { status: 201, body: call.body };
    });
    expect(await t.sync.pushOutbox()).toMatchObject({ sent: 1, stopped: 'offline' });
    const left = await pendingEntries(t.db);
    expect(left.map((e) => (e.body as { name: string }).name)).toEqual(['B', 'C']);
    expect(left[0]?.attempts).toBe(1);
  });

  it('jaringan putus: berhenti, entri tetap pending dengan backoff', async () => {
    const t = await createTestLayer('group_admin', () => 'network');
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name: 'A' });
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name: 'B' });

    expect(await t.sync.pushOutbox()).toEqual({ sent: 0, rejected: 0, stopped: 'offline' });
    expect(t.server.calls).toHaveLength(1);
    const [head] = await pendingEntries(t.db);
    expect(head).toMatchObject({ attempts: 1, nextAttemptAt: TODAY + 5_000 });
    expect((await t.db.getMeta('sync'))?.lastError).toBe('Tidak bisa terhubung ke server.');

    // Sebelum jeda selesai: tidak mencoba lagi.
    expect((await t.sync.pushOutbox()).stopped).toBe('backoff');
    expect(t.server.calls).toHaveLength(1);

    // Online lagi setelah jeda: keduanya terkirim sesuai urutan.
    t.advance(5_000);
    t.server.setHandler(echoServer());
    expect(await t.sync.pushOutbox()).toMatchObject({ sent: 2, stopped: null });
  });

  it('sinyal kembali / "Kirim sekarang": jeda backoff diabaikan (force)', async () => {
    const t = await createTestLayer('group_admin', () => 'network');
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name: 'A' });
    await t.sync.syncNow();
    t.advance(1_000); // masih dalam jeda 5 detik
    t.server.setHandler(echoServer());
    expect((await t.sync.syncNow()).stopped).toBe('backoff');
    expect(await t.sync.syncNow({ force: true })).toMatchObject({ sent: 1, stopped: null });
    expect(await pendingEntries(t.db)).toEqual([]);
  });

  it('event online memicu kirim tanpa menunggu backoff', async () => {
    const t = await createTestLayer('group_admin', () => 'network');
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name: 'A' });
    const stop = t.sync.start();
    await vi.waitFor(async () => {
      expect((await pendingEntries(t.db))[0]?.attempts).toBe(1);
    });
    t.server.setHandler(echoServer());
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(async () => {
      expect(await pendingEntries(t.db)).toEqual([]);
    });
    stop();
  });

  it('5xx: diperlakukan seperti gangguan sementara', async () => {
    const t = await createTestLayer('group_admin', () => errorReply(500, 'INTERNAL_ERROR'));
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    expect((await t.sync.pushOutbox()).stopped).toBe('offline');
    expect(await pendingEntries(t.db)).toHaveLength(1);
  });

  it('401: berhenti dan menandai perlu masuk lagi', async () => {
    const t = await createTestLayer('group_admin', () =>
      errorReply(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.'),
    );
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    expect((await t.sync.pushOutbox()).stopped).toBe('unauthenticated');
    expect(await pendingEntries(t.db)).toHaveLength(1);
    expect((await t.db.getMeta('sync'))?.needsLogin).toBe(true);
  });
});

describe('pullChanges', () => {
  it('menyimpan perubahan server dan mengirim cursor + cakupan berikutnya', async () => {
    const t = await createTestLayer('group_admin');
    const remote = makeAnimal(t.farmer.id, { name: 'Dari HP lain' });
    const ev = makeEvent(remote.id, 2, { type: 'BH', payload: {} });
    t.server.setHandler(() => ({ status: 200, body: page({ animals: [remote], events: [ev] }) }));

    expect(await t.sync.pullChanges()).toBe(2);
    expect(t.server.calls[0]?.path).toBe('/api/sync/pull?limit=500');
    expect(await t.db.animals.get(remote.id)).toMatchObject({ name: 'Dari HP lain' });
    expect(await t.db.getMeta('sync')).toMatchObject({
      cursor: 'c1',
      scope: 's1',
      lastSyncAt: TODAY,
      lastError: null,
    });

    await t.sync.pullChanges();
    expect(t.server.calls[1]?.path).toBe('/api/sync/pull?limit=500&cursor=c1&scope=s1');
  });

  it('beberapa halaman: diambil sampai habis, cursor disimpan per halaman', async () => {
    const t = await createTestLayer('group_admin');
    const a = makeAnimal(t.farmer.id, { name: 'A' });
    const b = makeAnimal(t.farmer.id, { name: 'B' });
    t.server.setHandler((call) =>
      call.path.includes('cursor=p1')
        ? { status: 200, body: page({ animals: [b] }, { cursor: 'p2' }) }
        : { status: 200, body: page({ animals: [a] }, { cursor: 'p1', hasMore: true }) },
    );
    expect(await t.sync.pullChanges()).toBe(2);
    expect(t.server.calls).toHaveLength(2);
    expect((await t.db.getMeta('sync'))?.cursor).toBe('p2');
    expect(await t.db.animals.get(b.id)).toBeDefined();
  });

  it('baris yang dihapus di server ikut tersimpan dengan deletedAt', async () => {
    const t = await createTestLayer('group_admin');
    t.server.setHandler(() => ({
      status: 200,
      body: page({ animals: [{ ...t.animal, deletedAt: TODAY - DAY }] }),
    }));
    await t.sync.pullChanges();
    expect((await t.db.animals.get(t.animal.id))?.deletedAt).toBe(TODAY - DAY);
  });

  it('tidak menimpa baris yang masih punya perubahan lokal belum terkirim', async () => {
    const t = await createTestLayer('group_admin');
    await t.repo.updateAnimal(t.animal.id, { name: 'Nama lokal' });
    t.server.setHandler(() => ({
      status: 200,
      body: page({ animals: [{ ...t.animal, name: 'Nama server lama' }] }),
    }));
    expect(await t.sync.pullChanges()).toBe(0);
    expect((await t.db.animals.get(t.animal.id))?.name).toBe('Nama lokal');
  });

  it('cakupan berubah (reset): baris yang tidak lagi terlihat dihapus, kecuali perubahan lokal', async () => {
    const t = await createTestLayer('group_admin');
    const keep = makeAnimal(t.farmer.id, { name: 'Tetap' });
    const local = await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name: 'Lokal' });
    await t.db.animals.add(makeAnimal(t.farmer.id, { name: 'Pindah wilayah' }));
    t.server.setHandler((call) =>
      call.path.includes('cursor=r1')
        ? { status: 200, body: page({ animals: [keep] }, { cursor: 'r2', scope: 's2' }) }
        : {
            status: 200,
            body: page(
              { farmers: [t.farmer], locations: [t.location] },
              { cursor: 'r1', hasMore: true, scope: 's2', reset: true },
            ),
          },
    );
    await t.sync.pullChanges();
    const names = (await t.db.animals.toArray()).map((a) => a.name).sort();
    expect(names).toEqual(['Lokal', 'Tetap']);
    expect(await t.db.animals.get(local.id)).toBeDefined();
    expect(await t.db.getMeta('sync')).toMatchObject({ cursor: 'r2', scope: 's2' });
  });
});

describe('syncNow', () => {
  it('push lalu pull; offline: pull dilewati', async () => {
    const t = await createTestLayer('group_admin', echoServer());
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    expect(await t.sync.syncNow()).toEqual({ sent: 1, rejected: 0, stopped: null, pulled: 0 });
    expect(t.server.calls.map((c) => c.method)).toEqual(['POST', 'GET']);

    t.server.setHandler(() => 'network');
    const offline = await t.sync.syncNow();
    expect(offline).toMatchObject({ stopped: 'offline', pulled: null });
  });

  it('panggilan bersamaan digabung, tidak mengirim entri dua kali', async () => {
    const t = await createTestLayer('group_admin', echoServer());
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    await Promise.all([t.sync.syncNow(), t.sync.syncNow(), t.sync.syncNow()]);
    expect(t.server.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });
});
