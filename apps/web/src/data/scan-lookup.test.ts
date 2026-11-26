// Langkah 3.2: hasil scan dicari di Dexie (offline): QR, eartag, tag dicabut, kode belum terpakai.
import { describe, expect, it } from 'vitest';

import { createTestLayer, errorReply, type Call } from '@/test/data-fixtures';

import { pendingEntries } from './outbox';
import { classifyScanText, lookupScan } from './scan-lookup';

describe('classifyScanText', () => {
  it.each([
    ['IB-7K2QM', { tagType: 'qr', code: 'IB-7K2QM' }],
    ['ib-7k2qm', { tagType: 'qr', code: 'IB-7K2QM' }],
    ['https://ib.contoh.test/t/IB-7K2QM', { tagType: 'qr', code: 'IB-7K2QM' }],
    ['3201-0099', { tagType: 'eartag', code: '3201-0099' }],
    ['  ID 3201  0099 ', { tagType: 'eartag', code: 'ID 3201 0099' }],
  ])('%s', (text, expected) => {
    expect(classifyScanText(text)).toEqual(expected);
  });

  it.each(['', 'x', 'IB-O0000', 'https://contoh.test/halaman', 'IB-7K2Q', '!!!'])(
    'bukan kode ternak: %j',
    (text) => {
      expect(classifyScanText(text)).toBeNull();
    },
  );
});

describe('lookupScan', () => {
  it('QR aktif: sapi ditemukan (juga dari URL label)', async () => {
    const t = await createTestLayer('inseminator');
    await t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' });
    for (const text of ['IB-7K2QM', 'https://ib.contoh.test/t/ib-7k2qm']) {
      expect(await lookupScan(t.db, text)).toMatchObject({
        kind: 'animal',
        code: 'IB-7K2QM',
        tagType: 'qr',
        animal: { id: t.animal.id },
      });
    }
  });

  it('eartag cocok tanpa beda huruf besar/kecil dan pemisah', async () => {
    const t = await createTestLayer('inseminator');
    await t.repo.attachTag(t.animal.id, { type: 'eartag', code: 'JB-3201-0099' });
    expect(await lookupScan(t.db, 'jb 3201 0099')).toMatchObject({
      kind: 'animal',
      tagType: 'eartag',
      code: 'JB-3201-0099',
    });
  });

  it('tag yang sudah dicabut: dilaporkan beserta sapi dan alasannya', async () => {
    const t = await createTestLayer('inseminator');
    const tag = await t.repo.attachTag(t.animal.id, { type: 'qr', code: 'IB-7K2QM' });
    await t.repo.removeTag(tag.id, 'lost');
    expect(await lookupScan(t.db, 'IB-7K2QM')).toMatchObject({
      kind: 'removed',
      reason: 'lost',
      animal: { id: t.animal.id },
    });
  });

  it('kode belum terpakai: boleh didaftarkan; label yang ditolak server ditandai bentrok', async () => {
    const t = await createTestLayer('inseminator', (call: Call) =>
      call.path === '/api/qr-codes' ? errorReply(409, 'CONFLICT') : { status: 201, body: {} },
    );
    expect(await lookupScan(t.db, 'IB-7K2QM')).toEqual({
      kind: 'unused',
      code: 'IB-7K2QM',
      tagType: 'qr',
      clash: false,
    });
    const [label] = await t.repo.reserveQrCodes(1);
    await t.sync.pushOutbox();
    expect(await lookupScan(t.db, label?.code ?? '')).toMatchObject({
      kind: 'unused',
      clash: true,
    });
  });

  it('teks lain: invalid', async () => {
    const t = await createTestLayer();
    expect(await lookupScan(t.db, 'https://contoh.test')).toEqual({
      kind: 'invalid',
      text: 'https://contoh.test',
    });
  });
});

describe('createAnimal dengan eartag (dari Scan)', () => {
  it('ternak + eartag dalam satu transaksi; outbox: ternak dulu, lalu tag', async () => {
    const t = await createTestLayer('inseminator');
    const a = await t.repo.createAnimal({
      farmerId: t.farmer.id,
      sex: 'F',
      name: 'Kembang',
      eartag: 'JB-3201-0100',
    });
    expect(await lookupScan(t.db, 'JB-3201-0100')).toMatchObject({
      kind: 'animal',
      animal: { id: a.id },
    });
    const entries = await pendingEntries(t.db);
    expect(entries.map((e) => e.kind)).toEqual(['animal.create', 'tag.attach']);
    expect(entries[0]?.body).not.toHaveProperty('eartag');
    expect(entries[1]).toMatchObject({
      path: `/api/animals/${a.id}/tags`,
      body: { type: 'eartag', code: 'JB-3201-0100' },
    });
    await expect(
      t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F', eartag: 'JB-3201-0100' }),
    ).rejects.toThrow(/eartag ini sudah pernah dipakai/);
  });
});
