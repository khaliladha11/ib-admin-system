// Sync engine dengan fetch tiruan: push FIFO, hasil per status HTTP, pull dengan cursor.
import { describe, expect, it } from 'vitest';

import {
  createTestLayer,
  DAY,
  errorReply,
  makeAnimal,
  makeEvent,
  TODAY,
  type Call,
} from '@/test/data-fixtures';

import { pendingEntries, rejectedEntries } from '../outbox';

const emptyChanges = (serverTime: number) => ({
  serverTime,
  locations: [],
  farmers: [],
  animals: [],
  animalTags: [],
  events: [],
  serviceRequests: [],
  assignments: [],
  semenStock: [],
});

const isPull = (c: Call) => c.method === 'GET' && c.path.startsWith('/api/sync/changes');

/** Server yang menerima semua tulisan dan menggemakan baris yang dikirim. */
function echoServer(serverTime = TODAY) {
  return (call: Call) => {
    if (isPull(call)) return { status: 200, body: emptyChanges(serverTime) };
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

  it('422/409 lain: entri ditolak beserta pesannya, antrean tetap jalan', async () => {
    const t = await createTestLayer('inseminator');
    await t.repo.recordEvent(t.animal.id, { type: 'BH', payload: {}, occurredAt: TODAY });
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'M' });
    t.server.setHandler((call) =>
      call.path.endsWith('/events')
        ? errorReply(422, 'INVALID_EVENT', 'Urutan event tidak masuk akal.')
        : { status: 201, body: call.body },
    );
    expect(await t.sync.pushOutbox()).toEqual({ sent: 1, rejected: 1, stopped: null });
    const rejected = await rejectedEntries(t.db);
    expect(rejected).toMatchObject([
      { kind: 'event.create', status: 'rejected', lastError: 'Urutan event tidak masuk akal.' },
    ]);
    expect(await pendingEntries(t.db)).toEqual([]);
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
  it('menyimpan perubahan server, memperbarui cursor, dan mengirim cursor berikutnya', async () => {
    const t = await createTestLayer('group_admin');
    const remote = makeAnimal(t.farmer.id, { name: 'Dari HP lain' });
    const ev = makeEvent(remote.id, 2, { type: 'BH', payload: {} });
    t.server.setHandler(() => ({
      status: 200,
      body: { ...emptyChanges(TODAY - 1_000), animals: [remote], events: [ev] },
    }));

    expect(await t.sync.pullChanges()).toBe(2);
    expect(t.server.calls[0]?.path).toBe('/api/sync/changes?since=0');
    expect(await t.db.animals.get(remote.id)).toMatchObject({ name: 'Dari HP lain' });
    expect(await t.db.getMeta('sync')).toMatchObject({
      cursor: TODAY - 1_000,
      lastSyncAt: TODAY,
      lastError: null,
    });

    await t.sync.pullChanges();
    expect(t.server.calls[1]?.path).toBe(`/api/sync/changes?since=${String(TODAY - 1_000)}`);
  });

  it('baris yang dihapus di server ikut tersimpan dengan deletedAt', async () => {
    const t = await createTestLayer('group_admin');
    t.server.setHandler(() => ({
      status: 200,
      body: { ...emptyChanges(TODAY), animals: [{ ...t.animal, deletedAt: TODAY - DAY }] },
    }));
    await t.sync.pullChanges();
    expect((await t.db.animals.get(t.animal.id))?.deletedAt).toBe(TODAY - DAY);
  });

  it('tidak menimpa baris yang masih punya perubahan lokal belum terkirim', async () => {
    const t = await createTestLayer('group_admin');
    await t.repo.updateAnimal(t.animal.id, { name: 'Nama lokal' });
    t.server.setHandler(() => ({
      status: 200,
      body: { ...emptyChanges(TODAY), animals: [{ ...t.animal, name: 'Nama server lama' }] },
    }));
    expect(await t.sync.pullChanges()).toBe(0);
    expect((await t.db.animals.get(t.animal.id))?.name).toBe('Nama lokal');
  });
});

describe('syncNow', () => {
  it('push lalu pull; offline: pull dilewati', async () => {
    const t = await createTestLayer('group_admin', echoServer(TODAY - 1_000));
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
