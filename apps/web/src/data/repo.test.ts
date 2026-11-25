// Penulisan lokal: baris + outbox dalam satu transaksi, validasi Zod dan validateNextEvent offline.
import { describe, expect, it } from 'vitest';

import { createTestLayer, DAY, ibBody, makeEvent, pkbPregnant, TODAY } from '@/test/data-fixtures';

import { LocalValidationError, NotSignedInError, WarningsNeedConfirmation } from './errors';
import { backoffMs, pendingEntries, pendingRowIds } from './outbox';

describe('repo: penulisan + outbox', () => {
  it('createAnimal menulis ternak, tag QR, dan satu entri outbox', async () => {
    const t = await createTestLayer();
    const animal = await t.repo.createAnimal({
      farmerId: t.farmer.id,
      name: 'Melati',
      sex: 'F',
      qrCode: 'IB-ABC23',
    });
    expect(await t.db.animals.get(animal.id)).toMatchObject({
      name: 'Melati',
      deviceId: expect.stringMatching(/^web-/),
    });
    const tags = await t.db.animalTags.where('animalId').equals(animal.id).toArray();
    expect(tags).toMatchObject([{ type: 'qr', code: 'IB-ABC23', removedAt: null }]);

    const outbox = await pendingEntries(t.db);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      kind: 'animal.create',
      method: 'POST',
      path: '/api/animals',
      rowId: animal.id,
      status: 'pending',
      body: { id: animal.id, farmerId: t.farmer.id, name: 'Melati', sex: 'F', qrCode: 'IB-ABC23' },
      provisional: [{ table: 'animalTags', id: tags[0]?.id }],
    });
  });

  it('data tidak valid: tidak ada baris dan tidak ada outbox', async () => {
    const t = await createTestLayer();
    const before = await t.db.animals.count();
    await expect(
      t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', qrCode: 'salah' }),
    ).rejects.toBeInstanceOf(LocalValidationError);
    await expect(
      t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'X' as 'F' }),
    ).rejects.toBeInstanceOf(LocalValidationError);
    expect(await t.db.animals.count()).toBe(before);
    expect(await t.db.outbox.count()).toBe(0);
  });

  it('kode QR yang sudah dipakai ditolak secara lokal', async () => {
    const t = await createTestLayer();
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', qrCode: 'IB-ABC23' });
    await expect(
      t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'M', qrCode: 'IB-ABC23' }),
    ).rejects.toThrow('Kode QR sudah pernah dipakai.');
    expect(await t.db.outbox.count()).toBe(1);
  });

  it('tanpa sesi: penulisan ditolak', async () => {
    const t = await createTestLayer();
    await t.db.meta.delete('session');
    await expect(t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' })).rejects.toBeInstanceOf(
      NotSignedInError,
    );
  });

  it('peternak hanya bisa mendaftarkan ternak miliknya dan tidak bisa menambah peternak', async () => {
    const t = await createTestLayer('farmer');
    await expect(
      t.repo.createAnimal({ farmerId: '0193f000-0000-7000-8000-00000000abcd', sex: 'F' }),
    ).rejects.toThrow('Peternak tidak ditemukan.');
    await expect(t.repo.createFarmer({ name: 'Baru', locationId: t.location.id })).rejects.toThrow(
      /tidak punya akses/,
    );
    await expect(t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' })).resolves.toBeTruthy();
  });

  it('updateFarmer hanya mengirim kolom yang berubah', async () => {
    const t = await createTestLayer();
    t.advance(DAY);
    const row = await t.repo.updateFarmer(t.farmer.id, { phone: '081299990000' });
    expect(row).toMatchObject({
      phone: '081299990000',
      updatedAt: TODAY + DAY,
      createdAt: t.farmer.createdAt,
    });
    const [entry] = await pendingEntries(t.db);
    expect(entry).toMatchObject({
      method: 'PATCH',
      path: `/api/farmers/${t.farmer.id}`,
      body: { phone: '081299990000' },
    });
  });

  it('createServiceRequest: permintaan ganda dan IB untuk sapi bunting ditolak', async () => {
    const t = await createTestLayer();
    const req = await t.repo.createServiceRequest({ animalId: t.animal.id, type: 'IB' });
    expect(req).toMatchObject({ status: 'submitted', farmerId: t.farmer.id });
    await expect(
      t.repo.createServiceRequest({ animalId: t.animal.id, type: 'IB' }),
    ).rejects.toThrow(/sudah punya permintaan IB/);

    await t.db.events.bulkAdd([
      makeEvent(t.animal.id, 70, ibBody),
      makeEvent(t.animal.id, 10, pkbPregnant),
    ]);
    await t.db.serviceRequests.clear();
    await expect(
      t.repo.createServiceRequest({ animalId: t.animal.id, type: 'IB' }),
    ).rejects.toThrow(/sedang bunting/);
  });
});

describe('repo: recordEvent memakai validateNextEvent secara offline', () => {
  it('IB pada sapi bunting ditolak; tidak ada event dan outbox', async () => {
    const t = await createTestLayer('inseminator');
    await t.db.events.bulkAdd([
      makeEvent(t.animal.id, 70, ibBody),
      makeEvent(t.animal.id, 10, pkbPregnant),
    ]);
    await expect(t.repo.recordEvent(t.animal.id, { ...ibBody, occurredAt: TODAY })).rejects.toThrow(
      /Sapi sedang bunting; IB tidak bisa dicatat/,
    );
    expect(await t.db.events.count()).toBe(2);
    expect(await t.db.outbox.count()).toBe(0);
  });

  it('BH pada sapi bunting butuh konfirmasi; setelah dikonfirmasi tersimpan', async () => {
    const t = await createTestLayer('farmer');
    await t.db.events.bulkAdd([
      makeEvent(t.animal.id, 70, ibBody),
      makeEvent(t.animal.id, 10, pkbPregnant),
    ]);
    const input = { type: 'BH', payload: {}, occurredAt: TODAY } as const;
    const err = await t.repo.recordEvent(t.animal.id, input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WarningsNeedConfirmation);
    expect((err as WarningsNeedConfirmation).warnings[0]).toMatch(/tercatat bunting/);
    expect(await t.db.outbox.count()).toBe(0);

    const res = await t.repo.recordEvent(t.animal.id, { ...input, confirmWarnings: true });
    expect(res.status.kind).toBe('bunting');
    const [entry] = await pendingEntries(t.db);
    expect(entry?.body).toMatchObject({ type: 'BH', confirmWarnings: true });
  });

  it('peternak tidak bisa mencatat IB; tanggal masa depan ditolak', async () => {
    const t = await createTestLayer('farmer');
    await expect(t.repo.recordEvent(t.animal.id, { ...ibBody, occurredAt: TODAY })).rejects.toThrow(
      'IB dan PKB dicatat oleh petugas.',
    );
    await expect(
      t.repo.recordEvent(t.animal.id, { type: 'BH', payload: {}, occurredAt: TODAY + DAY }),
    ).rejects.toThrow(/masa depan/);
  });

  it('IB oleh petugas: status sudah IB, outbox berisi event dengan id yang sama', async () => {
    const t = await createTestLayer('inseminator');
    const res = await t.repo.recordEvent(t.animal.id, { ...ibBody, occurredAt: TODAY });
    expect(res.status).toMatchObject({ kind: 'sudah_IB_menunggu_PKB', serviceNumber: 1 });
    expect(res.event.recordedBy).toBe((await t.db.getMeta('session'))?.user.id);
    const [entry] = await pendingEntries(t.db);
    expect(entry).toMatchObject({
      kind: 'event.create',
      path: `/api/animals/${t.animal.id}/events`,
      rowId: res.event.id,
      body: { id: res.event.id, type: 'IB', occurredAt: TODAY },
    });
    expect(entry?.body).not.toHaveProperty('confirmWarnings');
  });

  it('LH: anak hidup didaftarkan sebagai ternak dengan id dari payload', async () => {
    const t = await createTestLayer('farmer');
    await t.db.events.bulkAdd([
      makeEvent(t.animal.id, 282, ibBody),
      makeEvent(t.animal.id, 200, pkbPregnant),
    ]);
    const res = await t.repo.recordEvent(t.animal.id, {
      type: 'LH',
      occurredAt: TODAY,
      payload: {
        calves: [
          { sex: 'M', condition: 'alive', weightKg: 28 },
          { sex: 'F', condition: 'stillborn' },
        ],
      },
    });
    expect(res.status.kind).toBe('sudah_lahir');
    const calfId = res.event.type === 'LH' ? res.event.payload.calves[0]?.calfAnimalId : undefined;
    expect(calfId).toBeDefined();
    const calf = await t.db.animals.get(calfId ?? '');
    expect(calf).toMatchObject({
      damId: t.animal.id,
      farmerId: t.farmer.id,
      sex: 'M',
      breed: 'Simental',
      sireCode: 'BULL-7',
      birthDate: new Date(TODAY).toISOString().slice(0, 10),
    });
    // Anak sapi ikut terlindung dari pull selama event belum terkirim.
    expect((await pendingRowIds(t.db)).has(calfId ?? '')).toBe(true);
    expect(await t.db.outbox.count()).toBe(1);
  });
});

describe('outbox', () => {
  it('backoff naik dua kali lipat sampai 5 menit', () => {
    expect([1, 2, 3, 10].map(backoffMs)).toEqual([5_000, 10_000, 20_000, 300_000]);
  });

  it('entri FIFO sesuai urutan tulis', async () => {
    const t = await createTestLayer('inseminator');
    const a = await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', name: 'A' });
    await t.repo.recordEvent(a.id, { type: 'BH', payload: {}, occurredAt: TODAY - 3_600_000 });
    await t.repo.recordEvent(a.id, { ...ibBody, occurredAt: TODAY });
    expect((await pendingEntries(t.db)).map((e) => e.kind)).toEqual([
      'animal.create',
      'event.create',
      'event.create',
    ]);
  });
});
