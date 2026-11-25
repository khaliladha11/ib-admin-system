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
  type DomainEvent,
  type Farmer,
  type ReminderItem,
  type ReproStatus,
  type Schedule,
  type ServiceRequest,
} from '@ib/shared';

import type { IbDb } from './db';
import type { OutboxEntry } from './outbox';

export interface AnimalView extends Animal {
  status: ReproStatus;
  /** Kode QR yang sedang terpasang. */
  qrCode: string | null;
  farmerName: string | null;
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
  animal: Pick<AnimalView, 'id' | 'name' | 'qrCode' | 'farmerId' | 'farmerName'>;
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
  const [events, tags, farmers, unsynced] = await Promise.all([
    db.events.where('animalId').anyOf(ids).toArray(),
    db.animalTags.where('animalId').anyOf(ids).toArray(),
    db.farmers.bulkGet([...new Set(animals.map((a) => a.farmerId))]),
    unsyncedRowIds(db),
  ]);
  const eventsByAnimal = new Map<string, DomainEvent[]>();
  for (const e of alive(events)) {
    eventsByAnimal.set(e.animalId, [...(eventsByAnimal.get(e.animalId) ?? []), e]);
  }
  const qr = new Map(
    alive(tags)
      .filter((t) => t.type === 'qr' && t.removedAt === null)
      .map((t) => [t.animalId, t.code]),
  );
  const farmerNames = new Map(
    farmers.flatMap((f): [string, string][] => (f ? [[f.id, f.name]] : [])),
  );
  return animals.map((animal): AnimalView => ({
    ...animal,
    status: deriveReproStatus(eventsByAnimal.get(animal.id) ?? [], today).status,
    qrCode: qr.get(animal.id) ?? null,
    farmerName: farmerNames.get(animal.farmerId) ?? null,
    unsynced: unsynced.has(animal.id),
  }));
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
  const events = alive(
    await db.events
      .where('animalId')
      .anyOf(females.map((a) => a.id))
      .toArray(),
  );
  const byAnimal = new Map<string, DomainEvent[]>();
  for (const e of events) byAnimal.set(e.animalId, [...(byAnimal.get(e.animalId) ?? []), e]);
  const items: ReminderView[] = [];
  for (const animal of views) {
    const schedule = computeSchedule(byAnimal.get(animal.id) ?? [], today);
    const ref = {
      id: animal.id,
      name: animal.name,
      qrCode: animal.qrCode,
      farmerId: animal.farmerId,
      farmerName: animal.farmerName,
    };
    for (const item of listReminders(schedule, today, withinDays))
      items.push({ ...item, animal: ref });
  }
  return items.sort(compareReminders);
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
