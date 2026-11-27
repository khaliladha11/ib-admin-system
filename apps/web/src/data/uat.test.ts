// Langkah 5.1: masukan peserta (outbox + sinkron), catatan pemakaian (lokal saja),
// dan data lokal setelah reset data demo.
import { describe, expect, it } from 'vitest';

import { createTestLayer, IDS } from '@/test/data-fixtures';

import { signIn } from './sync/auth';
import { clearUsage, loadUsage, MAX_FORM_MS, MAX_USAGE_ROWS, recordUsage } from './usage';

describe('masukan', () => {
  it('tersimpan lokal + outbox dalam satu langkah, lalu terkirim lewat push', async () => {
    const t = await createTestLayer('farmer', (call) =>
      call.path === '/api/feedback'
        ? { status: 201, body: { ...(call.body as object), userId: IDS.farmerUser } }
        : { status: 200, body: {} },
    );
    const row = await t.repo.sendFeedback({ topic: 'record', rating: 3, text: '  Mudah  ' });
    expect(row).toMatchObject({
      userId: IDS.farmerUser,
      topic: 'record',
      rating: 3,
      text: 'Mudah',
    });
    expect(await t.db.feedback.get(row.id)).toBeTruthy();
    const [entry] = await t.db.outbox.toArray();
    expect(entry).toMatchObject({
      kind: 'feedback.create',
      method: 'POST',
      path: '/api/feedback',
      table: 'feedback',
      rowId: row.id,
      body: { id: row.id, topic: 'record', rating: 3, text: 'Mudah' },
    });

    await t.sync.pushOutbox();
    expect(t.server.calls.some((c) => c.path === '/api/feedback')).toBe(true);
    expect(await t.db.outbox.count()).toBe(0);
  });

  it('nilai di luar 1–3 atau topik asing ditolak sebelum disimpan', async () => {
    const t = await createTestLayer('inseminator');
    await expect(t.repo.sendFeedback({ topic: 'scan', rating: 5 })).rejects.toThrow();
    await expect(t.repo.sendFeedback({ topic: 'lain' as 'scan', rating: 2 })).rejects.toThrow();
    expect(await t.db.feedback.count()).toBe(0);
    expect(await t.db.outbox.count()).toBe(0);
  });
});

describe('catatan pemakaian (hanya di HP)', () => {
  it('tidak menulis outbox dan tidak memanggil server', async () => {
    const t = await createTestLayer('farmer');
    await recordUsage(
      t.db,
      { kind: 'form_done', name: 'record', eventType: 'BH', durationMs: 42_000 },
      t.now(),
    );
    await recordUsage(t.db, { kind: 'screen', name: 'home' }, t.now());
    const rows = await loadUsage(t.db);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'form_done', eventType: 'BH', durationMs: 42_000 });
    expect(Object.keys(rows[0] ?? {})).not.toContain('userId');
    expect(await t.db.outbox.count()).toBe(0);
    expect(t.server.calls).toHaveLength(0);
  });

  it('form yang ditinggal terlalu lama: lamanya tidak dicatat', async () => {
    const t = await createTestLayer('farmer');
    await recordUsage(
      t.db,
      { kind: 'form_done', name: 'record', durationMs: MAX_FORM_MS + 1 },
      t.now(),
    );
    expect((await loadUsage(t.db))[0]?.durationMs).toBeNull();
  });

  it(`paling banyak ${String(MAX_USAGE_ROWS)} catatan; yang tertua dibuang`, async () => {
    const t = await createTestLayer('farmer');
    await t.db.usage.bulkAdd(
      Array.from({ length: MAX_USAGE_ROWS }, (_, i) => ({
        kind: 'screen' as const,
        name: `lama-${String(i)}`,
        at: i,
        day: '2026-11-01',
      })),
    );
    await recordUsage(t.db, { kind: 'screen', name: 'baru' }, t.now());
    const rows = await loadUsage(t.db);
    expect(rows).toHaveLength(MAX_USAGE_ROWS);
    expect(rows[0]?.name).toBe('lama-1');
    expect(rows.at(-1)?.name).toBe('baru');
    await clearUsage(t.db);
    expect(await t.db.usage.count()).toBe(0);
  });
});

describe('reset data demo', () => {
  const me = (generation: string | null) => ({
    status: 200,
    body: {
      user: { id: IDS.admin, name: 'Admin', role: 'group_admin', locationId: null },
      farmerId: null,
      generation,
      demoMode: generation !== null,
    },
  });

  it('generasi server berganti: data lokal + yang belum terkirim dibuang, pemakaian tetap', async () => {
    const t = await createTestLayer('group_admin', () => me('gen-1'));
    await signIn(t.db, t.api, 'a', 'b');
    expect((await t.db.getMeta('session'))?.demoMode).toBe(true);
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    await recordUsage(t.db, { kind: 'screen', name: 'home' }, t.now());
    expect(await t.db.outbox.count()).toBe(1);

    // Masuk lagi ke server yang sama: tidak ada yang dibuang.
    await signIn(t.db, t.api, 'a', 'b');
    expect(await t.db.outbox.count()).toBe(1);

    t.server.setHandler(() => me('gen-2'));
    await signIn(t.db, t.api, 'a', 'b');
    expect(await t.db.outbox.count()).toBe(0);
    expect(await t.db.animals.count()).toBe(0);
    expect(await t.db.usage.count()).toBe(1);
    expect((await t.db.getMeta('owner'))?.generation).toBe('gen-2');
  });

  it('HP lama tanpa generasi + server biasa: tidak dianggap reset', async () => {
    const t = await createTestLayer('group_admin', () => me(null));
    await t.db.setMeta('owner', { id: IDS.admin, name: 'Admin' });
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    await signIn(t.db, t.api, 'a', 'b');
    expect(await t.db.outbox.count()).toBe(1);
  });
});
