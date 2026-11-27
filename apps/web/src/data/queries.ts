// Bacaan dari Dexie untuk hook. Status reproduksi, jadwal, dan pengingat DIHITUNG di sini
// dengan fungsi yang sama dengan server (@ib/shared), tidak disimpan.
import {
  compareReminders,
  computeSchedule,
  deriveReproStatus,
  effectiveEvents,
  listReminders,
  type Animal,
  type AnimalEvent,
  type Assignment,
  type DomainEvent,
  type Farmer,
  type PublicUser,
  type Reminder,
  type ReminderItem,
  type ReproStatus,
  type Schedule,
  type SemenStock,
  type ServiceRequest,
  type SyncReview,
} from '@ib/shared';

import type { IbDb } from './db';
import { childrenMap, descendantsOf } from './locations';
import { animalIdOf, type OutboxEntry } from './outbox';

export interface AnimalView extends Animal {
  status: ReproStatus;
  /** Kode QR yang sedang terpasang. */
  qrCode: string | null;
  /** Semua kode tag yang masih terpasang (QR dan eartag), untuk pencarian. */
  tagCodes: string[];
  farmerName: string | null;
  /** Desa/lokasi peternak. */
  locationId: string | null;
  locationName: string | null;
  /** Jadwal dari computeSchedule (perkiraan birahi, PKB, lahir, pengingat terlambat). */
  schedule: Omit<Schedule, 'status'>;
  /** Masih ada perubahan yang belum terkirim ke server. */
  unsynced: boolean;
}

export type TimelineEvent = AnimalEvent & {
  /** Dibatalkan oleh event koreksi. */
  voided: boolean;
  unsynced: boolean;
};

export interface AnimalTimeline {
  animal: AnimalView;
  events: TimelineEvent[];
  /** Id event yang tidak masuk akal menurut mesin status. */
  anomalies: string[];
  schedule: Omit<Schedule, 'status'>;
}

export interface ReminderView extends ReminderItem {
  animal: Pick<
    AnimalView,
    'id' | 'name' | 'qrCode' | 'farmerId' | 'farmerName' | 'locationId' | 'locationName'
  >;
}

export interface AnimalFilter {
  farmerId?: string;
  /** Sertakan ternak yang sudah keluar (mati/dijual/dipotong). Default: tidak. */
  includeExited?: boolean;
}

const alive = <T extends { deletedAt: number | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

/** Urut nama; yang tanpa nama di belakang. */
const byName = (a: { name: string | null }, b: { name: string | null }) =>
  Number(a.name === null) - Number(b.name === null) ||
  (a.name ?? '').localeCompare(b.name ?? '', 'id');

async function unsyncedRowIds(db: IbDb): Promise<Set<string>> {
  const entries: OutboxEntry[] = await db.outbox.toArray();
  return new Set(entries.flatMap((e) => [e.rowId, ...e.relatedRowIds]));
}

async function buildAnimalViews(db: IbDb, animals: Animal[], today: number) {
  const ids = animals.map((a) => a.id);
  const [events, tags, farmers, locations, unsynced] = await Promise.all([
    db.events.where('animalId').anyOf(ids).toArray(),
    db.animalTags.where('animalId').anyOf(ids).toArray(),
    db.farmers.bulkGet([...new Set(animals.map((a) => a.farmerId))]),
    db.locations.toArray(),
    unsyncedRowIds(db),
  ]);
  const eventsByAnimal = new Map<string, DomainEvent[]>();
  for (const e of alive(events)) {
    eventsByAnimal.set(e.animalId, [...(eventsByAnimal.get(e.animalId) ?? []), e]);
  }
  const activeTags = alive(tags).filter((t) => t.removedAt === null);
  const qr = new Map(activeTags.filter((t) => t.type === 'qr').map((t) => [t.animalId, t.code]));
  const tagCodes = new Map<string, string[]>();
  for (const t of activeTags)
    tagCodes.set(t.animalId, [...(tagCodes.get(t.animalId) ?? []), t.code]);
  const farmerById = new Map(farmers.flatMap((f): [string, Farmer][] => (f ? [[f.id, f]] : [])));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  return animals.map((animal): AnimalView => {
    const animalEvents = eventsByAnimal.get(animal.id) ?? [];
    const { status, ...schedule } = computeSchedule(animalEvents, today);
    const farmer = farmerById.get(animal.farmerId);
    return {
      ...animal,
      status,
      schedule,
      qrCode: qr.get(animal.id) ?? null,
      tagCodes: tagCodes.get(animal.id) ?? [],
      farmerName: farmer?.name ?? null,
      locationId: farmer?.locationId ?? null,
      locationName: farmer ? (locationName.get(farmer.locationId) ?? null) : null,
      unsynced: unsynced.has(animal.id),
    };
  });
}

export async function loadAnimals(
  db: IbDb,
  filter: AnimalFilter,
  today: number,
): Promise<AnimalView[]> {
  const rows = filter.farmerId
    ? await db.animals.where('farmerId').equals(filter.farmerId).toArray()
    : await db.animals.toArray();
  const views = await buildAnimalViews(db, alive(rows), today);
  return views
    .filter((a) => (filter.includeExited ?? false) || a.status.kind !== 'keluar')
    .sort(byName);
}

export async function loadAnimal(db: IbDb, id: string, today: number): Promise<AnimalView | null> {
  const row = await db.animals.get(id);
  if (row?.deletedAt !== null) return null;
  const [view] = await buildAnimalViews(db, [row], today);
  return view ?? null;
}

export async function loadTimeline(
  db: IbDb,
  id: string,
  today: number,
): Promise<AnimalTimeline | null> {
  const animal = await loadAnimal(db, id, today);
  if (!animal) return null;
  const [rows, unsynced] = await Promise.all([
    db.events.where('[animalId+occurredAt]').between([id, -Infinity], [id, Infinity]).toArray(),
    unsyncedRowIds(db),
  ]);
  const events = alive(rows);
  const domain = events as DomainEvent[];
  const effective = new Set(effectiveEvents(domain).map((e) => e.id));
  const { anomalies } = deriveReproStatus(domain, today);
  const { nextEstrusAt, pkbDueAt, expectedCalving, reminders } = computeSchedule(domain, today);
  return {
    animal,
    events: events.map((e) => ({
      ...e,
      voided: !effective.has(e.id),
      unsynced: unsynced.has(e.id),
    })),
    anomalies: anomalies.map((e) => e.id),
    schedule: { nextEstrusAt, pkbDueAt, expectedCalving, reminders },
  };
}

export async function loadFarmers(db: IbDb): Promise<Farmer[]> {
  return alive(await db.farmers.toArray()).sort(byName);
}

export interface ServiceRequestFilter {
  status?: ServiceRequest['status'];
  animalId?: string;
}

export async function loadServiceRequests(
  db: IbDb,
  filter: ServiceRequestFilter,
): Promise<ServiceRequest[]> {
  const rows = filter.animalId
    ? await db.serviceRequests.where('animalId').equals(filter.animalId).toArray()
    : await db.serviceRequests.toArray();
  return alive(rows)
    .filter((r) => !filter.status || r.status === filter.status)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Sama dengan GET /api/reminders: sapi betina dalam data lokal, terlambat dulu. */
export async function loadReminders(
  db: IbDb,
  withinDays: number,
  today: number,
): Promise<ReminderView[]> {
  const females = alive(await db.animals.toArray()).filter((a) => a.sex === 'F');
  const views = await buildAnimalViews(db, females, today);
  const items: ReminderView[] = [];
  for (const animal of views) {
    const ref = {
      id: animal.id,
      name: animal.name,
      qrCode: animal.qrCode,
      farmerId: animal.farmerId,
      farmerName: animal.farmerName,
      locationId: animal.locationId,
      locationName: animal.locationName,
    };
    const schedule = { ...animal.schedule, status: animal.status };
    for (const item of listReminders(schedule, today, withinDays)) {
      items.push({ ...item, animal: ref });
    }
  }
  return items.sort(compareReminders);
}

// --- Permintaan layanan --------------------------------------------------------

export interface ServiceRequestView {
  request: ServiceRequest;
  animalName: string | null;
  qrCode: string | null;
  farmerName: string | null;
  locationName: string | null;
  farmerLocationId: string | null;
  farmerPhone: string | null;
  /** Penugasan yang masih berjalan (belum ditutup). */
  activeAssignment: Assignment | null;
  /** Petugas yang sedang ditugaskan, atau yang menyelesaikan (bila data pengguna tersinkron). */
  inseminatorName: string | null;
  inseminatorPhone: string | null;
  requestedByName: string | null;
  /** Ditugaskan ke pengguna yang sedang masuk. */
  assignedToMe: boolean;
  unsynced: boolean;
}

export async function loadServiceRequestViews(
  db: IbDb,
  userId: string | null,
  today: number,
): Promise<ServiceRequestView[]> {
  const requests = alive(await db.serviceRequests.toArray());
  const [animals, assignments, unsynced, users, farmers] = await Promise.all([
    db.animals.bulkGet([...new Set(requests.map((r) => r.animalId))]),
    db.assignments
      .where('serviceRequestId')
      .anyOf(requests.map((r) => r.id))
      .toArray(),
    unsyncedRowIds(db),
    db.users.toArray(),
    db.farmers.toArray(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const farmerById = new Map(farmers.map((f) => [f.id, f]));
  const views = await buildAnimalViews(
    db,
    animals.flatMap((a) => (a ? [a] : [])),
    today,
  );
  const animalById = new Map(views.map((v) => [v.id, v]));
  const activeByRequest = new Map(
    alive(assignments)
      .filter((a) => a.endedAt === null)
      .map((a) => [a.serviceRequestId, a]),
  );
  // Petugas terakhir (juga untuk permintaan yang sudah selesai/penugasannya ditutup).
  const lastByRequest = new Map<string, Assignment>();
  for (const a of alive(assignments).sort((x, y) => x.assignedAt - y.assignedAt)) {
    lastByRequest.set(a.serviceRequestId, a);
  }
  return requests
    .map((request): ServiceRequestView => {
      const animal = animalById.get(request.animalId);
      const active = activeByRequest.get(request.id) ?? null;
      // Ditolak/dibatalkan sebelum ditugaskan: tidak ada petugas.
      const shownIns =
        active ?? (request.status === 'done' ? lastByRequest.get(request.id) : undefined);
      return {
        request,
        animalName: animal?.name ?? null,
        qrCode: animal?.qrCode ?? null,
        farmerName: animal?.farmerName ?? null,
        locationName: animal?.locationName ?? null,
        farmerLocationId: farmerById.get(request.farmerId)?.locationId ?? null,
        farmerPhone: farmerById.get(request.farmerId)?.phone ?? null,
        activeAssignment: active,
        inseminatorName: shownIns ? (userById.get(shownIns.inseminatorId)?.name ?? null) : null,
        inseminatorPhone: shownIns ? (userById.get(shownIns.inseminatorId)?.phone ?? null) : null,
        requestedByName: userById.get(request.requestedBy)?.name ?? null,
        assignedToMe: userId !== null && active?.inseminatorId === userId,
        unsynced: unsynced.has(request.id),
      };
    })
    .sort((a, b) => b.request.createdAt - a.request.createdAt);
}

// --- Isian bawaan form event ----------------------------------------------------

export interface StockView extends SemenStock {
  /** Sisa straw = diterima − IB yang memakai stok ini. */
  remaining: number;
}

export interface EventDefaults {
  /** IB terakhir yang dicatat pengguna ini (ternak mana pun). */
  lastIb: { strawCode: string; bullId: string; batch: string; semenStockId: string | null } | null;
  lastPkbMethod: 'palpation' | 'usg' | null;
  lastWeightMethod: 'scale' | 'tape' | null;
  /** Stok straw milik pengguna yang masih tersisa, terbaru dulu. */
  stocks: StockView[];
  /** Permintaan IB/PKB aktif untuk ternak ini yang ditugaskan ke pengguna. */
  openTask: { id: string; type: ServiceRequest['type'] } | null;
}

export async function loadEventDefaults(
  db: IbDb,
  userId: string | null,
  animalId: string,
): Promise<EventDefaults> {
  const [events, stocks, requests] = await Promise.all([
    db.events.toArray(),
    userId ? db.semenStock.where('holderId').equals(userId).toArray() : Promise.resolve([]),
    db.serviceRequests.where('animalId').equals(animalId).toArray(),
  ]);
  const live = alive(events).sort((a, b) => b.occurredAt - a.occurredAt);
  const mine = live.filter((e) => e.recordedBy === userId);
  const lastIb = mine.find((e) => e.type === 'IB');
  const lastPkb = mine.find((e) => e.type === 'PKB' && e.payload.method !== undefined);
  const lastBb = mine.find((e) => e.type === 'BB' && e.payload.method !== undefined);
  const used = new Map<string, number>();
  for (const e of live) {
    if (e.semenStockId) used.set(e.semenStockId, (used.get(e.semenStockId) ?? 0) + 1);
  }
  const open = alive(requests).filter((r) => r.status === 'assigned' || r.status === 'in_progress');
  let openTask: EventDefaults['openTask'] = null;
  if (userId && open.length > 0) {
    const active = alive(
      await db.assignments
        .where('serviceRequestId')
        .anyOf(open.map((r) => r.id))
        .toArray(),
    ).find((a) => a.endedAt === null && a.inseminatorId === userId);
    const request = open.find((r) => r.id === active?.serviceRequestId);
    if (request) openTask = { id: request.id, type: request.type };
  }
  return {
    lastIb:
      lastIb?.type === 'IB'
        ? {
            strawCode: lastIb.payload.strawCode,
            bullId: lastIb.payload.bullId,
            batch: lastIb.payload.batch,
            semenStockId: lastIb.semenStockId,
          }
        : null,
    lastPkbMethod: lastPkb?.type === 'PKB' ? (lastPkb.payload.method ?? null) : null,
    lastWeightMethod: lastBb?.type === 'BB' ? (lastBb.payload.method ?? null) : null,
    stocks: alive(stocks)
      .map((s) => ({ ...s, remaining: s.quantityReceived - (used.get(s.id) ?? 0) }))
      .filter((s) => s.remaining > 0)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    openTask,
  };
}

// --- Foto (lokal) ---------------------------------------------------------------

export async function loadAnimalPhoto(db: IbDb, animalId: string) {
  return (await db.animalPhotos.get(animalId)) ?? null;
}

export interface SyncStatusView {
  pending: number;
  /** Event yang perlu dicek (ditolak karena urutan riwayat). */
  reviews: number;
  rejected: OutboxEntry[];
  lastSyncAt: number | null;
  lastError: string | null;
  needsLogin: boolean;
}

export interface SyncQueueItem {
  entry: OutboxEntry;
  animalId: string | null;
  animalName: string | null;
}

export interface SyncQueueView {
  /** Menunggu dikirim (FIFO). */
  pending: SyncQueueItem[];
  /** Event yang ditolak karena urutan riwayat: perlu dicek. */
  reviews: SyncQueueItem[];
  /** Tidak diterima server karena alasan lain. */
  rejected: SyncQueueItem[];
}

/** Isi halaman "Data belum terkirim". */
export async function loadSyncQueue(db: IbDb): Promise<SyncQueueView> {
  const [entries, animals] = await Promise.all([
    db.outbox.orderBy('seq').toArray(),
    db.animals.toArray(),
  ]);
  const names = new Map(animals.map((a) => [a.id, a.name]));
  const item = (entry: OutboxEntry): SyncQueueItem => {
    const animalId = animalIdOf(entry);
    return { entry, animalId, animalName: animalId ? (names.get(animalId) ?? null) : null };
  };
  return {
    pending: entries.filter((e) => e.status === 'pending').map(item),
    reviews: entries.filter((e) => e.status === 'needs_review').map(item),
    rejected: entries.filter((e) => e.status === 'rejected').map(item),
  };
}

export interface ServerReviewView extends SyncReview {
  animalName: string | null;
  userName: string | null;
}

/** Event "perlu dicek" yang tersimpan di server dan belum diselesaikan (untuk admin). */
export async function loadServerReviews(db: IbDb): Promise<ServerReviewView[]> {
  const [reviews, animals, users] = await Promise.all([
    db.syncReviews.toArray(),
    db.animals.toArray(),
    db.users.toArray(),
  ]);
  const animalName = new Map(animals.map((a) => [a.id, a.name]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  return reviews
    .filter((r) => r.resolvedAt === null && r.deletedAt === null)
    .map((r) => ({
      ...r,
      animalName: r.animalId ? (animalName.get(r.animalId) ?? null) : null,
      userName: userName.get(r.userId) ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadSyncStatus(db: IbDb): Promise<SyncStatusView> {
  const [pending, reviews, rejected, sync] = await Promise.all([
    db.outbox.where('status').equals('pending').count(),
    db.outbox.where('status').equals('needs_review').count(),
    db.outbox.where('status').equals('rejected').sortBy('seq'),
    db.getMeta('sync'),
  ]);
  return {
    pending,
    reviews,
    rejected,
    lastSyncAt: sync?.lastSyncAt ?? null,
    lastError: sync?.lastError ?? null,
    needsLogin: sync?.needsLogin ?? false,
  };
}

// --- Admin (langkah 2.3) ---------------------------------------------------------

export async function loadUsers(db: IbDb): Promise<PublicUser[]> {
  return alive(await db.users.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** Petugas aktif yang wilayah kerjanya mencakup lokasi peternak (sama dengan aturan server). */
export async function loadInseminatorsFor(db: IbDb, farmerLocationId: string | null) {
  if (!farmerLocationId) return [];
  const [users, locations] = await Promise.all([db.users.toArray(), db.locations.toArray()]);
  const children = childrenMap(locations);
  return alive(users)
    .filter(
      (u) =>
        u.role === 'inseminator' &&
        u.isActive &&
        u.locationId !== null &&
        descendantsOf(children, u.locationId).has(farmerLocationId),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

export interface ActivityEntry {
  at: number;
  kind: 'submit' | 'assign' | 'reassign' | 'accept' | 'result' | 'reject' | 'cancel';
  text: string;
  actorName: string | null;
  /** Masih menunggu dikirim ke server. */
  unsynced: boolean;
}

/**
 * Log aktivitas satu permintaan, disusun dari data yang ada di perangkat: permintaan,
 * riwayat penugasan, event hasil, dan audit_logs (untuk siapa yang menolak/membatalkan).
 */
export async function loadRequestActivity(db: IbDb, requestId: string): Promise<ActivityEntry[]> {
  const request = await db.serviceRequests.get(requestId);
  if (!request) return [];
  const [assignments, logs, users, unsynced] = await Promise.all([
    db.assignments.where('serviceRequestId').equals(requestId).toArray(),
    db.auditLogs.where('rowId').equals(requestId).toArray(),
    db.users.toArray(),
    unsyncedRowIds(db),
  ]);
  const name = (id: string | null | undefined) =>
    id ? (new Map(users.map((u) => [u.id, u.name])).get(id) ?? null) : null;
  const entries: ActivityEntry[] = [
    {
      at: request.createdAt,
      kind: 'submit',
      text: `Permintaan ${request.type} diajukan`,
      actorName: name(request.requestedBy),
      unsynced: false,
    },
  ];
  // Urut waktu; bila sama (mis. dicatat cepat saat offline), penugasan yang sudah ditutup dulu.
  const ordered = alive(assignments).sort(
    (a, b) =>
      a.assignedAt - b.assignedAt || Number(a.endedAt === null) - Number(b.endedAt === null),
  );
  ordered.forEach((a, i) => {
    const insName = name(a.inseminatorId) ?? 'petugas';
    entries.push({
      at: a.assignedAt,
      kind: i === 0 ? 'assign' : 'reassign',
      text: i === 0 ? `Diverifikasi dan ditugaskan ke ${insName}` : `Petugas diganti ke ${insName}`,
      actorName: name(a.assignedBy),
      unsynced: unsynced.has(a.id) || (a.deviceId.startsWith('web-') && unsynced.has(requestId)),
    });
    if (a.acceptedAt !== null) {
      entries.push({
        at: a.acceptedAt,
        kind: 'accept',
        text: `${insName} menerima tugas`,
        actorName: name(a.inseminatorId),
        unsynced: false,
      });
    }
  });
  if (request.resultEventId) {
    const event = await db.events.get(request.resultEventId);
    if (event) {
      entries.push({
        at: event.createdAt,
        kind: 'result',
        text: `Hasil ${event.type} dicatat (kejadian ${formatDay(event.occurredAt)})`,
        actorName: name(event.recordedBy),
        unsynced: unsynced.has(event.id),
      });
    }
  }
  const logActor = (action: string) => {
    const log = logs
      .filter((l) => (l.after as { action?: string } | null)?.action === action)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return log ? name(log.actorId) : null;
  };
  if (request.status === 'rejected') {
    entries.push({
      at: request.updatedAt,
      kind: 'reject',
      text: `Ditolak: ${request.rejectionReason ?? '-'}`,
      actorName: logActor('reject'),
      unsynced: unsynced.has(requestId),
    });
  }
  if (request.status === 'cancelled') {
    entries.push({
      at: request.updatedAt,
      kind: 'cancel',
      text: 'Permintaan dibatalkan',
      actorName: logActor('cancel'),
      unsynced: unsynced.has(requestId),
    });
  }
  return entries.sort((a, b) => a.at - b.at);
}

const formatDay = (ms: number) =>
  new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export interface AdminSummary {
  requestsByStatus: Record<ServiceRequest['status'], number>;
  /** IB yang terjadi di bulan kalender ini (tidak termasuk yang dibatalkan koreksi). */
  ibThisMonth: number;
  pregnant: number;
  /** Laporan terlambat (aturan 3 bulan dan 9 bulan). */
  overdueReports: number;
  animals: number;
}

export async function loadAdminSummary(db: IbDb, today: number): Promise<AdminSummary> {
  const [requests, animals, events] = await Promise.all([
    db.serviceRequests.toArray(),
    loadAnimals(db, {}, today),
    db.events.toArray(),
  ]);
  const requestsByStatus = {
    submitted: 0,
    assigned: 0,
    in_progress: 0,
    done: 0,
    rejected: 0,
    cancelled: 0,
  } satisfies AdminSummary['requestsByStatus'];
  for (const r of alive(requests)) requestsByStatus[r.status] += 1;
  const now = new Date(today);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const effective = effectiveEvents(alive(events) as DomainEvent[]);
  return {
    requestsByStatus,
    ibThisMonth: effective.filter(
      (e) => e.type === 'IB' && e.occurredAt >= monthStart && e.occurredAt < nextMonth,
    ).length,
    pregnant: animals.filter((a) => a.status.kind === 'bunting').length,
    overdueReports: animals.reduce((n, a) => n + a.schedule.reminders.length, 0),
    animals: animals.length,
  };
}

export interface FollowUp {
  code: Reminder['code'];
  message: string;
  dueAt: number;
  overdueDays: number;
  /** Tanggal event patokan (IB atau PKB bunting). */
  eventAt: number | null;
  animal: Pick<AnimalView, 'id' | 'name' | 'qrCode' | 'farmerName' | 'locationName'>;
  farmerPhone: string | null;
  /** Petugas yang mencatat event patokan (IB/PKB), bila diketahui. */
  inseminator: { name: string; phone: string | null } | null;
}

/** Laporan terlambat yang perlu ditindaklanjuti (aturan 3 dan 9 bulan dari skripsi). */
export async function loadFollowUps(db: IbDb, today: number): Promise<FollowUp[]> {
  const animals = (await loadAnimals(db, {}, today)).filter((a) => a.schedule.reminders.length > 0);
  const [farmers, users] = await Promise.all([db.farmers.toArray(), db.users.toArray()]);
  const farmerById = new Map(farmers.map((f) => [f.id, f]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const items: FollowUp[] = [];
  for (const animal of animals) {
    for (const r of animal.schedule.reminders) {
      const event = await db.events.get(r.eventId);
      const recorder = event ? userById.get(event.recordedBy) : undefined;
      items.push({
        code: r.code,
        message: r.message,
        dueAt: r.dueAt,
        overdueDays: r.overdueDays,
        eventAt: event?.occurredAt ?? null,
        animal: {
          id: animal.id,
          name: animal.name,
          qrCode: animal.qrCode,
          farmerName: animal.farmerName,
          locationName: animal.locationName,
        },
        farmerPhone: farmerById.get(animal.farmerId)?.phone ?? null,
        inseminator:
          recorder?.role === 'inseminator' ? { name: recorder.name, phone: recorder.phone } : null,
      });
    }
  }
  return items.sort((a, b) => b.overdueDays - a.overdueDays);
}

export async function loadFarmerViews(db: IbDb) {
  const [farmers, animals, locations, users] = await Promise.all([
    loadFarmers(db),
    db.animals.toArray(),
    db.locations.toArray(),
    db.users.toArray(),
  ]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const userIds = new Set(users.map((u) => u.id));
  const count = new Map<string, number>();
  for (const a of alive(animals)) count.set(a.farmerId, (count.get(a.farmerId) ?? 0) + 1);
  return farmers.map((f) => ({
    ...f,
    locationName: locationName.get(f.locationId) ?? null,
    animalCount: count.get(f.id) ?? 0,
    hasAccount: f.userId !== null && userIds.has(f.userId),
  }));
}
export type FarmerView = Awaited<ReturnType<typeof loadFarmerViews>>[number];
