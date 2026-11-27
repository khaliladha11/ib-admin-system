// Langkah 6.3: antrean pesan iSIKHNAS dan tanda "sudah dilaporkan" lewat outbox.
import { describe, expect, it } from 'vitest';

import { createTestLayer, ibBody, IDS, makeEvent } from '@/test/data-fixtures';

import { loadIsikhnasQueue } from './queries';

describe('iSIKHNAS', () => {
  it('pesan dibuat setelah ID diisi; tanda sudah dilaporkan masuk outbox satu kali', async () => {
    const t = await createTestLayer('inseminator', (call) =>
      call.path === '/api/isikhnas-reports'
        ? {
            status: 201,
            body: {
              ...(call.body as object),
              animalId: t.animal.id,
              reportedBy: IDS.inseminator,
              createdAt: 1,
              updatedAt: 1,
              deletedAt: null,
              deviceId: 'd',
            },
          }
        : { status: 200, body: {} },
    );
    const ib = makeEvent(t.animal.id, 3, ibBody);
    await t.db.events.add(ib);

    let [item] = await loadIsikhnasQueue(t.db);
    expect(item?.messages).toEqual([{ text: null, missing: ['owner', 'animal'] }]);

    await t.db.farmers.update(t.farmer.id, { isikhnasOwnerId: 'P-01' });
    await t.repo.updateAnimal(t.animal.id, { isikhnasAnimalId: 'H 99' });
    [item] = await loadIsikhnasQueue(t.db);
    expect(item?.messages).toEqual([{ text: 'IB P-01 H99 BULL-7 B-1', missing: [] }]);
    expect(item?.report).toBeNull();

    const mark = await t.repo.markIsikhnasReported(ib.id);
    expect(await t.repo.markIsikhnasReported(ib.id)).toEqual(mark);
    const entries = (await t.db.outbox.toArray()).filter((e) => e.kind === 'isikhnasReport.create');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.body).toEqual({ id: mark.id, eventId: ib.id });
    [item] = await loadIsikhnasQueue(t.db);
    expect(item?.report?.id).toBe(mark.id);

    await t.sync.pushOutbox();
    expect(await t.db.outbox.count()).toBe(0);
    expect(await t.db.isikhnasReports.count()).toBe(1);
  });

  it('peternak tidak bisa menandai', async () => {
    const t = await createTestLayer('farmer');
    const ib = makeEvent(t.animal.id, 3, ibBody);
    await t.db.events.add(ib);
    await expect(t.repo.markIsikhnasReported(ib.id)).rejects.toThrow(/petugas atau admin/);
  });
});
