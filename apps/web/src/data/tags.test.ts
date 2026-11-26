// Langkah 3.1: kode QR dibuat di perangkat (unik), tag dipasang/diganti/dicabut lewat outbox.
import { QR_CODE_PATTERN, type RandomFill } from '@ib/shared';
import { describe, expect, it } from 'vitest';

import { createDataLayer } from '@/data/context';
import { createTestLayer, errorReply, IDS, TODAY, type Call } from '@/test/data-fixtures';

import { createRepo } from './repo';
import { pendingEntries } from './outbox';
import { loadAnimalTags, loadQrLabels } from './tag-queries';

/** Sumber acak yang mengulang byte yang sama: selalu menghasilkan kode yang sama. */
const constant =
  (value: number): RandomFill =>
  (bytes) =>
    bytes.fill(value);

describe('reserveQrCodes', () => {
  it('membuat N kode unik berformat IB-XXXXX, satu entri outbox per kode', async () => {
    const t = await createTestLayer('inseminator');
    const rows = await t.repo.reserveQrCodes(40);
    expect(rows).toHaveLength(40);
    expect(new Set(rows.map((r) => r.code)).size).toBe(40);
    for (const r of rows) {
      expect(r.code).toMatch(QR_CODE_PATTERN);
      expect(r.issuedBy).toBe(IDS.inseminator);
    }
    const outbox = await pendingEntries(t.db);
    expect(outbox).toHaveLength(40);
    expect(outbox[0]).toMatchObject({
      kind: 'qrCode.reserve',
      method: 'POST',
      path: '/api/qr-codes',
      body: { id: rows[0]?.id, code: rows[0]?.code },
    });
  });

  it('tidak membuat kode yang sudah ada di perangkat (label atau tag)', async () => {
    const t = await createTestLayer('inseminator');
    // Sumber acak tetap: kode pertama selalu IB-33333.
    const repo = createRepo(t.db, { now: () => TODAY, randomFill: constant(1) });
    const [first] = await repo.reserveQrCodes(1);
    expect(first?.code).toBe('IB-33333');
    await expect(repo.reserveQrCodes(1)).rejects.toThrow(/Tidak bisa membuat kode QR baru/);
    expect(await t.db.qrCodes.count()).toBe(1);

    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', qrCode: 'IB-44444' });
    const repo2 = createRepo(t.db, { now: () => TODAY, randomFill: constant(2) });
    await expect(repo2.reserveQrCodes(1)).rejects.toThrow(/Tidak bisa membuat kode QR baru/);
  });

  it('jumlah di luar batas ditolak tanpa menulis apa pun', async () => {
    const t = await createTestLayer();
    for (const n of [0, -1, 1.5, 401]) {
      await expect(t.repo.reserveQrCodes(n)).rejects.toThrow(/Jumlah label/);
    }
    expect(await t.db.qrCodes.count()).toBe(0);
    expect(await t.db.outbox.count()).toBe(0);
  });

  it('server menolak kode (sudah dipakai perangkat lain): label ditandai bentrok', async () => {
    const t = await createTestLayer('inseminator', (call: Call) =>
      call.path === '/api/qr-codes'
        ? errorReply(409, 'CONFLICT', 'Kode QR ini sudah dipakai label lain.')
        : { status: 201, body: call.body },
    );
    const [label] = await t.repo.reserveQrCodes(1);
    await t.sync.pushOutbox();
    const views = await loadQrLabels(t.db, IDS.inseminator);
    expect(views).toMatchObject([{ code: label?.code, state: 'conflict' }]);
    await expect(
      t.repo.attachTag(t.animal.id, { type: 'qr', code: label?.code ?? '' }),
    ).rejects.toThrow(/bentrok/);
  });
});

describe('attachTag / removeTag', () => {
  it('pasang tag QR dari label kosong; label tercatat sudah dipakai', async () => {
    const t = await createTestLayer('inseminator');
    const [label] = await t.repo.reserveQrCodes(1);
    const code = label?.code ?? '';
    const tag = await t.repo.attachTag(t.animal.id, { type: 'qr', code: code.toLowerCase() });
    expect(tag).toMatchObject({ animalId: t.animal.id, type: 'qr', code, removedAt: null });

    const entries = await pendingEntries(t.db);
    expect(entries.map((e) => e.kind)).toEqual(['qrCode.reserve', 'tag.attach']);
    expect(entries[1]).toMatchObject({
      path: `/api/animals/${t.animal.id}/tags`,
      body: { id: tag.id, type: 'qr', code },
      rowId: tag.id,
    });
    const views = await loadQrLabels(t.db, IDS.inseminator);
    expect(views[0]).toMatchObject({ state: 'used', animal: { id: t.animal.id } });
  });

  it('hasil scan berupa URL diterima; format salah ditolak', async () => {
    const t = await createTestLayer('inseminator');
    const tag = await t.repo.attachTag(t.animal.id, {
      type: 'qr',
      code: 'https://ib.contoh.test/t/IB-7K2QM',
    });
    expect(tag.code).toBe('IB-7K2QM');
    const t2 = await createTestLayer('inseminator');
    await expect(t2.repo.attachTag(t2.animal.id, { type: 'qr', code: 'IB-O0000' })).rejects.toThrow(
      /IB-XXXXX/,
    );
  });

  it('kode yang pernah dipasang (termasuk sudah dicabut) tidak bisa dipakai lagi', async () => {
    const t = await createTestLayer('inseminator');
    const tag = await t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' });
    await t.repo.removeTag(tag.id, 'damaged');
    await expect(t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' })).rejects.toThrow(
      /sudah pernah dipasang/,
    );
  });

  it('ganti tag: wajib alasan; tag lama dicabut dalam transaksi yang sama', async () => {
    const t = await createTestLayer('inseminator');
    const old = await t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' });
    await expect(t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-8M3RN' })).rejects.toThrow(
      /Pilih alasan penggantian/,
    );
    const next = await t.repo.attachTag(t.animal.id, {
      type: 'qr',
      code: 'IB-8M3RN',
      replaceReason: 'lost',
    });
    expect(await t.db.animalTags.get(old.id)).toMatchObject({
      removedAt: TODAY,
      removalReason: 'lost',
    });
    const entries = await pendingEntries(t.db);
    expect(entries.at(-1)).toMatchObject({
      kind: 'tag.attach',
      body: { id: next.id, code: 'IB-8M3RN', replaceReason: 'lost' },
      relatedRowIds: [old.id],
    });
    const history = await loadAnimalTags(t.db, t.animal.id);
    expect(history.map((h) => [h.code, h.removalReason])).toEqual([
      ['IB-8M3RN', null],
      ['IB-7K2QM', 'lost'],
    ]);
  });

  it('eartag dan QR boleh aktif bersamaan', async () => {
    const t = await createTestLayer('inseminator');
    await t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' });
    await t.repo.attachTag(t.animal.id, { type: 'eartag', code: ' 3201-0099 ' });
    const history = await loadAnimalTags(t.db, t.animal.id);
    expect(history.map((h) => h.code).sort()).toEqual(['3201-0099', 'IB-7K2QM']);
  });

  it('attachNewQrCode: kode baru dibuat lalu langsung dipasang', async () => {
    const t = await createTestLayer('inseminator');
    const tag = await t.repo.attachNewQrCode(t.animal.id);
    expect(tag.code).toMatch(QR_CODE_PATTERN);
    expect(await t.db.qrCodes.where('code').equals(tag.code).count()).toBe(1);
  });

  it('cabut tag: outbox tag.remove; tidak bisa dicabut dua kali', async () => {
    const t = await createTestLayer('inseminator');
    const tag = await t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' });
    const removed = await t.repo.removeTag(tag.id, 'other');
    expect(removed).toMatchObject({ removedAt: TODAY, removalReason: 'other' });
    expect((await pendingEntries(t.db)).at(-1)).toMatchObject({
      kind: 'tag.remove',
      path: `/api/tags/${tag.id}/remove`,
      body: { reason: 'other' },
    });
    await expect(t.repo.removeTag(tag.id, 'other')).rejects.toThrow(/sudah dicabut/);
  });

  it('server menerima: tag lokal diganti versi server', async () => {
    const t = await createTestLayer('inseminator');
    const tag = await t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' });
    t.server.setHandler(() => ({
      status: 201,
      body: { ...tag, deviceId: 'server', updatedAt: TODAY + 5 },
    }));
    await t.sync.pushOutbox();
    expect(await t.db.animalTags.get(tag.id)).toMatchObject({ deviceId: 'server' });
    expect(await t.db.outbox.count()).toBe(0);
  });
});

it('createDataLayer: repo memakai crypto.getRandomValues bawaan', async () => {
  const layer = createDataLayer({ dbName: 'ib-test-qr-crypto', syncOnWrite: false });
  await layer.db.setMeta('session', {
    user: { id: IDS.admin, name: 'A', role: 'group_admin', locationId: null },
    farmerId: null,
  });
  const rows = await layer.repo.reserveQrCodes(3);
  expect(rows.map((r) => r.code)).toEqual(
    expect.arrayContaining([expect.stringMatching(QR_CODE_PATTERN)]),
  );
});
