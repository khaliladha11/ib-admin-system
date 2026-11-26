// Langkah 2.2: terima tugas, isian bawaan form event, foto lokal, desa di pengingat.
import { uuidv7, type Assignment, type ServiceRequest } from '@ib/shared';
import { describe, expect, it } from 'vitest';

import {
  createTestLayer,
  DAY,
  IDS,
  ibBody,
  makeEvent,
  TODAY,
  type TestLayer,
} from '@/test/data-fixtures';

import { pendingEntries } from './outbox';
import { loadEventDefaults, loadReminders, loadServiceRequestViews } from './queries';

function addTask(t: TestLayer, status: ServiceRequest['status'] = 'assigned') {
  const time = TODAY - DAY;
  const base = { createdAt: time, updatedAt: time, deletedAt: null, deviceId: 'server' };
  const request: ServiceRequest = {
    ...base,
    id: uuidv7(time),
    farmerId: t.farmer.id,
    animalId: t.animal.id,
    type: 'IB',
    status,
    requestedBy: IDS.farmerUser,
    preferredDate: null,
    notes: null,
    rejectionReason: null,
    resultEventId: null,
  };
  const assignment: Assignment = {
    ...base,
    id: uuidv7(time),
    serviceRequestId: request.id,
    inseminatorId: IDS.inseminator,
    assignedBy: IDS.admin,
    assignedAt: time,
    acceptedAt: null,
    endedAt: null,
    endReason: null,
  };
  return Promise.all([t.db.serviceRequests.add(request), t.db.assignments.add(assignment)]).then(
    () => ({ request, assignment }),
  );
}

describe('acceptServiceRequest', () => {
  it('petugas yang ditugaskan: status dikerjakan + outbox', async () => {
    const t = await createTestLayer('inseminator');
    const { request, assignment } = await addTask(t);
    const res = await t.repo.acceptServiceRequest(request.id);
    expect(res.status).toBe('in_progress');
    expect((await t.db.assignments.get(assignment.id))?.acceptedAt).toBe(TODAY);
    const [entry] = await pendingEntries(t.db);
    expect(entry).toMatchObject({
      kind: 'serviceRequest.accept',
      path: `/api/service-requests/${request.id}/accept`,
      relatedRowIds: [assignment.id],
    });
    await expect(t.repo.acceptServiceRequest(request.id)).rejects.toThrow(/sudah diterima/);
  });

  it('bukan petugas yang ditugaskan: ditolak', async () => {
    const t = await createTestLayer('group_admin');
    const { request } = await addTask(t);
    await expect(t.repo.acceptServiceRequest(request.id)).rejects.toThrow(/Hanya petugas/);
  });

  it('respons server menyimpan permintaan dan penugasan versi server', async () => {
    const t = await createTestLayer('inseminator');
    const { request, assignment } = await addTask(t);
    await t.repo.acceptServiceRequest(request.id);
    t.server.setHandler(() => ({
      status: 200,
      body: {
        request: { ...request, status: 'in_progress', updatedAt: TODAY + 5 },
        assignments: [{ ...assignment, acceptedAt: TODAY + 5, updatedAt: TODAY + 5 }],
      },
    }));
    expect((await t.sync.pushOutbox()).sent).toBe(1);
    expect((await t.db.serviceRequests.get(request.id))?.updatedAt).toBe(TODAY + 5);
    expect((await t.db.assignments.get(assignment.id))?.acceptedAt).toBe(TODAY + 5);
  });

  it('daftar permintaan menandai tugas milik petugas', async () => {
    const t = await createTestLayer('inseminator');
    const { request } = await addTask(t);
    const [view] = await loadServiceRequestViews(t.db, IDS.inseminator, TODAY);
    expect(view).toMatchObject({
      request: { id: request.id },
      animalName: 'Sapi Contoh',
      farmerName: 'Pak Contoh',
      locationName: 'KTT Contoh',
      assignedToMe: true,
    });
    const [other] = await loadServiceRequestViews(t.db, IDS.admin, TODAY);
    expect(other?.assignedToMe).toBe(false);
  });
});

describe('loadEventDefaults', () => {
  it('IB terakhir petugas, stok yang masih tersisa, dan tugas aktif ternak ini', async () => {
    const t = await createTestLayer('inseminator');
    const stockId = uuidv7(TODAY - 100 * DAY);
    await t.db.semenStock.bulkAdd([
      {
        id: stockId,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
        deviceId: 'server',
        holderId: IDS.inseminator,
        strawCode: 'SIM-1',
        bullId: 'BULL-7',
        bullName: 'Gagah',
        breed: 'Simental',
        batch: 'B-1',
        quantityReceived: 2,
        receivedAt: '2026-01-01',
      },
      {
        id: uuidv7(TODAY - 99 * DAY),
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
        deviceId: 'server',
        holderId: IDS.inseminator,
        strawCode: 'LIM-9',
        bullId: 'BULL-9',
        bullName: null,
        breed: 'Limousin',
        batch: 'B-9',
        quantityReceived: 1,
        receivedAt: '2026-02-01',
      },
    ]);
    const used = { ...makeEvent(t.animal.id, 40, ibBody), semenStockId: stockId };
    await t.db.events.add(used);
    await addTask(t);
    const d = await loadEventDefaults(t.db, IDS.inseminator, t.animal.id);
    expect(d.lastIb).toEqual({
      strawCode: 'SIM-1',
      bullId: 'BULL-7',
      batch: 'B-1',
      semenStockId: stockId,
    });
    expect(d.stocks.map((s) => [s.strawCode, s.remaining])).toEqual([
      ['LIM-9', 1],
      ['SIM-1', 1],
    ]);
    expect(d.openTask).toMatchObject({ type: 'IB' });
  });

  it('pengguna lain: tanpa IB terakhir dan tanpa tugas', async () => {
    const t = await createTestLayer('farmer');
    await t.db.events.add(makeEvent(t.animal.id, 40, ibBody));
    await addTask(t);
    const d = await loadEventDefaults(t.db, IDS.farmerUser, t.animal.id);
    expect(d).toMatchObject({ lastIb: null, stocks: [], openTask: null });
  });
});

describe('foto lokal', () => {
  it('disimpan dan dihapus; bukan gambar ditolak', async () => {
    const t = await createTestLayer();
    const data = new Uint8Array([1, 2, 3]).buffer;
    await t.repo.setAnimalPhoto(t.animal.id, data, 'image/jpeg');
    const stored = await t.db.animalPhotos.get(t.animal.id);
    expect(stored?.type).toBe('image/jpeg');
    expect(new Uint8Array(stored?.data ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
    expect(await t.db.outbox.count()).toBe(0);
    await expect(t.repo.setAnimalPhoto(t.animal.id, data, 'text/plain')).rejects.toThrow(/foto/);
    await t.repo.removeAnimalPhoto(t.animal.id);
    expect(await t.db.animalPhotos.count()).toBe(0);
  });
});

describe('pengingat per desa', () => {
  it('pengingat membawa nama desa peternak', async () => {
    const t = await createTestLayer();
    await t.db.events.add(makeEvent(t.animal.id, 100, ibBody));
    const [item] = await loadReminders(t.db, 7, TODAY);
    expect(item?.animal).toMatchObject({ locationId: t.location.id, locationName: 'KTT Contoh' });
  });
});
