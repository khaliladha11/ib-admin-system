// Langkah 2.3: aksi admin lewat outbox, ringkasan, tindak lanjut, log aktivitas.
import { uuidv7, type PublicUser, type ServiceRequest } from '@ib/shared';
import { describe, expect, it } from 'vitest';

import {
  createTestLayer,
  DAY,
  IDS,
  ibBody,
  makeEvent,
  pkbPregnant,
  TODAY,
  type TestLayer,
} from '@/test/data-fixtures';

import { covers } from './locations';
import { pendingEntries } from './outbox';
import {
  loadAdminSummary,
  loadFollowUps,
  loadInseminatorsFor,
  loadRequestActivity,
  loadServiceRequestViews,
} from './queries';

const user = (
  id: string,
  name: string,
  role: PublicUser['role'],
  locationId: string | null,
  extra: Partial<PublicUser> = {},
): PublicUser => ({
  id,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  deviceId: 'server',
  name,
  email: null,
  phone: '081200000201',
  role,
  locationId,
  isActive: true,
  ...extra,
});

async function setup(): Promise<TestLayer & { request: ServiceRequest; other: string }> {
  const t = await createTestLayer('group_admin');
  const other = uuidv7(TODAY - 500 * DAY);
  await t.db.users.bulkAdd([
    user(IDS.admin, 'Hartono', 'group_admin', t.location.id),
    user(IDS.inseminator, 'Andi Pratama', 'inseminator', t.location.id),
    user(other, 'Rina Marlina', 'inseminator', t.location.id, { phone: '081200000202' }),
    user(uuidv7(TODAY - 501 * DAY), 'Tidak Aktif', 'inseminator', t.location.id, {
      isActive: false,
    }),
    user(uuidv7(TODAY - 502 * DAY), 'Wilayah Lain', 'inseminator', uuidv7(TODAY - 503 * DAY)),
  ]);
  const time = TODAY - DAY;
  const request: ServiceRequest = {
    id: uuidv7(time),
    createdAt: time,
    updatedAt: time,
    deletedAt: null,
    deviceId: 'server',
    farmerId: t.farmer.id,
    animalId: t.animal.id,
    type: 'IB',
    status: 'submitted',
    requestedBy: IDS.farmerUser,
    preferredDate: null,
    notes: null,
    rejectionReason: null,
    resultEventId: null,
  };
  await t.db.serviceRequests.add(request);
  return { ...t, request, other };
}

describe('aksi admin lewat outbox', () => {
  it('petugas yang bisa dipilih: aktif dan wilayahnya mencakup lokasi peternak', async () => {
    const t = await setup();
    const list = await loadInseminatorsFor(t.db, t.farmer.locationId);
    expect(list.map((u) => u.name)).toEqual(['Andi Pratama', 'Rina Marlina']);
  });

  it('tugaskan → penugasan lokal sementara + outbox; ganti petugas menutup yang lama', async () => {
    const t = await setup();
    await t.repo.assignServiceRequest(t.request.id, IDS.inseminator);
    expect((await t.db.serviceRequests.get(t.request.id))?.status).toBe('assigned');
    const [first] = await t.db.assignments.toArray();
    expect(first).toMatchObject({
      inseminatorId: IDS.inseminator,
      assignedBy: IDS.admin,
      endedAt: null,
    });
    const [entry] = await pendingEntries(t.db);
    expect(entry).toMatchObject({
      kind: 'serviceRequest.assign',
      body: { inseminatorId: IDS.inseminator },
      provisional: [{ table: 'assignments', id: first?.id }],
    });
    const [view] = await loadServiceRequestViews(t.db, IDS.admin, TODAY);
    expect(view).toMatchObject({ inseminatorName: 'Andi Pratama', requestedByName: null });

    await expect(t.repo.reassignServiceRequest(t.request.id, IDS.inseminator)).rejects.toThrow(
      'Petugas ini sudah ditugaskan.',
    );
    await t.repo.reassignServiceRequest(t.request.id, t.other);
    const list = await t.db.assignments.orderBy('id').toArray();
    expect(list.map((a) => [a.inseminatorId, a.endReason])).toEqual([
      [IDS.inseminator, 'reassigned'],
      [t.other, null],
    ]);
    const activity = await loadRequestActivity(t.db, t.request.id);
    expect(activity.map((a) => a.kind)).toEqual(['submit', 'assign', 'reassign']);
    expect(activity[2]).toMatchObject({
      text: 'Petugas diganti ke Rina Marlina',
      actorName: 'Hartono',
    });
  });

  it('petugas tidak aktif / di luar wilayah ditolak; non-admin tidak bisa', async () => {
    const t = await setup();
    const inactive = (await t.db.users.toArray()).find((u) => u.name === 'Tidak Aktif');
    const outside = (await t.db.users.toArray()).find((u) => u.name === 'Wilayah Lain');
    await expect(t.repo.assignServiceRequest(t.request.id, inactive?.id ?? '')).rejects.toThrow(
      /tidak aktif/,
    );
    await expect(t.repo.assignServiceRequest(t.request.id, outside?.id ?? '')).rejects.toThrow(
      /tidak mencakup/,
    );
    await t.db.setMeta('session', {
      user: { id: IDS.inseminator, name: 'Andi', role: 'inseminator', locationId: null },
      farmerId: null,
    });
    await expect(t.repo.assignServiceRequest(t.request.id, IDS.inseminator)).rejects.toThrow(
      /tidak punya akses/,
    );
  });

  it('tolak wajib alasan; tercatat di log aktivitas', async () => {
    const t = await setup();
    await expect(t.repo.rejectServiceRequest(t.request.id, '  ')).rejects.toThrow(
      'Tulis alasan penolakan.',
    );
    await t.repo.rejectServiceRequest(t.request.id, 'Sapi baru melahirkan');
    expect(await t.db.serviceRequests.get(t.request.id)).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Sapi baru melahirkan',
    });
    const activity = await loadRequestActivity(t.db, t.request.id);
    expect(activity.at(-1)).toMatchObject({
      kind: 'reject',
      text: 'Ditolak: Sapi baru melahirkan',
      unsynced: true,
    });
    await expect(t.repo.assignServiceRequest(t.request.id, IDS.inseminator)).rejects.toThrow(
      /baru diajukan/,
    );
  });

  it('respons server mengganti penugasan sementara dengan versi server', async () => {
    const t = await setup();
    await t.repo.assignServiceRequest(t.request.id, IDS.inseminator);
    const serverAssignment = {
      id: uuidv7(TODAY + 1),
      createdAt: TODAY,
      updatedAt: TODAY,
      deletedAt: null,
      deviceId: 'server',
      serviceRequestId: t.request.id,
      inseminatorId: IDS.inseminator,
      assignedBy: IDS.admin,
      assignedAt: TODAY,
      acceptedAt: null,
      endedAt: null,
      endReason: null,
    };
    t.server.setHandler(() => ({
      status: 200,
      body: {
        request: { ...t.request, status: 'assigned', updatedAt: TODAY },
        assignments: [serverAssignment],
      },
    }));
    await t.sync.pushOutbox();
    expect((await t.db.assignments.toArray()).map((a) => a.id)).toEqual([serverAssignment.id]);
  });
});

describe('ringkasan dan tindak lanjut', () => {
  it('jumlah per status, IB bulan ini, bunting, laporan terlambat', async () => {
    const t = await setup();
    await t.db.events.bulkAdd([makeEvent(t.animal.id, 100, ibBody)]);
    const summary = await loadAdminSummary(t.db, TODAY);
    expect(summary.requestsByStatus).toMatchObject({ submitted: 1, assigned: 0 });
    expect(summary.overdueReports).toBe(1);
    expect(summary.ibThisMonth).toBe(0);

    await t.db.events.clear();
    await t.db.events.bulkAdd([makeEvent(t.animal.id, 3, ibBody)]);
    expect((await loadAdminSummary(t.db, TODAY)).ibThisMonth).toBe(1);
  });

  it('tindak lanjut membawa HP peternak dan petugas yang mencatat IB', async () => {
    const t = await setup();
    await t.db.farmers.update(t.farmer.id, { phone: '081377778888' });
    await t.db.events.bulkAdd([makeEvent(t.animal.id, 100, ibBody)]);
    const [item] = await loadFollowUps(t.db, TODAY);
    expect(item).toMatchObject({
      code: 'IB_RESULT_OVERDUE',
      overdueDays: 10,
      farmerPhone: '081377778888',
      inseminator: { name: 'Andi Pratama', phone: '081200000201' },
      animal: { name: 'Sapi Contoh', farmerName: 'Pak Contoh' },
    });
  });

  it('sapi bunting dihitung', async () => {
    const t = await setup();
    await t.db.events.bulkAdd([
      makeEvent(t.animal.id, 70, ibBody),
      makeEvent(t.animal.id, 10, pkbPregnant),
    ]);
    expect((await loadAdminSummary(t.db, TODAY)).pregnant).toBe(1);
  });
});

describe('covers', () => {
  it('lokasi turunan tercakup, lokasi lain tidak', () => {
    const tree = [
      { id: 'dinas', parentId: null },
      { id: 'ktt', parentId: 'dinas' },
      { id: 'desa', parentId: 'ktt' },
      { id: 'lain', parentId: null },
    ];
    expect(covers(tree, 'dinas', 'desa')).toBe(true);
    expect(covers(tree, 'ktt', 'desa')).toBe(true);
    expect(covers(tree, 'desa', 'ktt')).toBe(false);
    expect(covers(tree, 'lain', 'desa')).toBe(false);
    expect(covers(tree, null, 'desa')).toBe(false);
  });
});
