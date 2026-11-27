// Langkah 6.3: tanda "sudah dilaporkan ke iSIKHNAS".
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { countRows } from '../db/client';
import { isikhnasReports } from '../db/schema';
import { exportAll } from '../ops/export';
import { createHarness, type Harness } from './api-harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

/** Event IB pertama di wilayah admin KTT-01 (terlihat oleh petugas Andi lewat cakupan). */
async function someEvent() {
  const { rows } = await h.pullAll('groupAdmin1');
  const ev = rows.events?.find((e) => e.type === 'IB');
  if (!ev) throw new Error('tidak ada IB');
  return ev as { id: string; animalId: string };
}

describe('POST /api/isikhnas-reports', () => {
  it('admin menandai; tanda kedua untuk event yang sama mengembalikan tanda yang ada', async () => {
    const ev = await someEvent();
    const admin = await h.as('groupAdmin1');
    const first = await admin.post('/api/isikhnas-reports', { id: h.newId(), eventId: ev.id });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ eventId: ev.id, animalId: ev.animalId });
    const again = await admin.post('/api/isikhnas-reports', { id: h.newId(), eventId: ev.id });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    // Id yang sama dikirim ulang dari outbox.
    const resent = await admin.post('/api/isikhnas-reports', { id: first.body.id, eventId: ev.id });
    expect(resent.status).toBe(409);
    expect(resent.body.error.code).toBe('ALREADY_EXISTS');
    expect(countRows(h.db, isikhnasReports)).toBe(1);
  });

  it('peternak tidak boleh; admin wilayah lain tidak melihat event itu', async () => {
    const ev = await someEvent();
    const farmer = await h.as('suparman');
    expect((await farmer.post('/api/isikhnas-reports', { eventId: ev.id })).status).toBe(403);
    const other = await h.as('groupAdmin2');
    expect((await other.post('/api/isikhnas-reports', { eventId: ev.id })).status).toBe(404);
  });

  it('ikut pull (cakupan ternak) dan ekspor', async () => {
    const { rows } = await h.pullAll('groupAdmin1');
    expect(rows.isikhnasReports).toHaveLength(1);
    const { rows: other } = await h.pullAll('groupAdmin2');
    expect(other.isikhnasReports ?? []).toHaveLength(0);
    expect(exportAll(h.db, h.now()).tables.isikhnasReports).toHaveLength(1);
  });

  it('lewat sinkron (push)', async () => {
    const { rows } = await h.pullAll('groupAdmin1');
    const ev = rows.events?.find((e) => e.type === 'PKB') as { id: string } | undefined;
    if (!ev) throw new Error('tidak ada PKB');
    const id = h.newId();
    const admin = await h.as('groupAdmin1');
    const res = await admin.post('/api/sync/push', {
      changes: [
        {
          id: h.newId(),
          at: h.now(),
          kind: 'isikhnasReport.create',
          method: 'POST',
          path: '/api/isikhnas-reports',
          rowId: id,
          body: { id, eventId: ev.id },
        },
      ],
    });
    expect(res.body.results[0].result).toBe('applied');
    expect(countRows(h.db, isikhnasReports)).toBe(2);
  });
});
