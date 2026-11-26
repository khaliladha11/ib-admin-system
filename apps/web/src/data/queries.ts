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
  type ReminderItem,
  type ReproStatus,
  type Schedule,
  type SemenStock,
  type ServiceRequest,
} from '@ib/shared';

import type { IbDb } from './db';
import type { OutboxEntry } from './outbox';

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

const byName = (a: { name: string | null }, b: { name: string | null }) =>
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
  /** Penugasan yang masih berjalan (belum ditutup). */
  activeAssignment: Assignment | null;
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
  const [animals, assignments, unsynced] = await Promise.all([
    db.animals.bulkGet([...new Set(requests.map((r) => r.animalId))]),
    db.assignments
      .where('serviceRequestId')
      .anyOf(requests.map((r) => r.id))
      .toArray(),
    unsyncedRowIds(db),
  ]);
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
  return requests
    .map((request): ServiceRequestView => {
      const animal = animalById.get(request.animalId);
      const active = activeByRequest.get(request.id) ?? null;
      return {
        request,
        animalName: animal?.name ?? null,
        qrCode: animal?.qrCode ?? null,
        farmerName: animal?.farmerName ?? null,
        locationName: animal?.locationName ?? null,
        activeAssignment: active,
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
  rejected: OutboxEntry[];
  lastSyncAt: number | null;
  lastError: string | null;
  needsLogin: boolean;
}

export async function loadSyncStatus(db: IbDb): Promise<SyncStatusView> {
  const [pending, rejected, sync] = await Promise.all([
    db.outbox.where('status').equals('pending').count(),
    db.outbox.where('status').equals('rejected').sortBy('seq'),
    db.getMeta('sync'),
  ]);
  return {
    pending,
    rejected,
    lastSyncAt: sync?.lastSyncAt ?? null,
    lastError: sync?.lastError ?? null,
    needsLogin: sync?.needsLogin ?? false,
  };
}
