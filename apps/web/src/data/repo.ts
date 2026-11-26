// Semua penulisan dari UI lewat sini. Polanya sama untuk setiap fungsi:
//   1. validasi dengan skema Zod dan aturan domain dari @ib/shared (sama dengan server);
//   2. tulis baris lokal + entri outbox dalam SATU transaksi Dexie;
//   3. beri tahu sync engine (onChange) agar mencoba mengirim di latar belakang.
// Id dibuat di perangkat (uuidv7) sehingga kiriman ulang aman (server: 409 ALREADY_EXISTS).
import {
  animalSchema,
  deriveReproStatus,
  eventBodySchema,
  eventSchema,
  farmerSchema,
  QR_CODE_PATTERN,
  serviceRequestSchema,
  uuidv7,
  validateNextEvent,
  type Animal,
  type AnimalEvent,
  type AnimalTag,
  type DomainEvent,
  type EventBody,
  type Farmer,
  type ReproStatus,
  type ServiceRequest,
  type UserRole,
} from '@ib/shared';
import { z } from 'zod';

import type { IbDb, Session } from './db';
import {
  fromZodIssues,
  LocalValidationError,
  NotSignedInError,
  WarningsNeedConfirmation,
} from './errors';
import { enqueue } from './outbox';

/** Sama dengan server: jam HP boleh sedikit lebih cepat. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const ADMIN_ROLES: readonly UserRole[] = ['agency_admin', 'group_admin'];
/** Peternak hanya mencatat event yang bisa ia amati sendiri; IB dan PKB oleh petugas. */
const FARMER_EVENT_TYPES = new Set<EventBody['type']>(['BH', 'KGG', 'LH', 'BB', 'HEALTH', 'EXIT']);
const OPEN_REQUEST_STATUSES = new Set<ServiceRequest['status']>([
  'submitted',
  'assigned',
  'in_progress',
]);

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// --- Skema input (selaras dengan skema request server) -----------------------

export const farmerInputSchema = z.object(
  farmerSchema
    .pick({ locationId: true, name: true, phone: true, address: true, isikhnasOwnerId: true })
    .partial({ phone: true, address: true, isikhnasOwnerId: true }).shape,
);
export type FarmerInput = z.input<typeof farmerInputSchema>;
export const farmerPatchSchema = farmerInputSchema.partial();
export type FarmerPatch = z.input<typeof farmerPatchSchema>;

const animalFields = animalSchema.pick({
  farmerId: true,
  damId: true,
  name: true,
  sex: true,
  breed: true,
  birthDate: true,
  sireCode: true,
  isikhnasAnimalId: true,
});
export const animalInputSchema = animalFields
  .partial({
    damId: true,
    name: true,
    breed: true,
    birthDate: true,
    sireCode: true,
    isikhnasAnimalId: true,
  })
  .extend({
    qrCode: z.string().regex(QR_CODE_PATTERN, 'Kode QR harus berformat IB-XXXXX').optional(),
  });
export type AnimalInput = z.input<typeof animalInputSchema>;
export const animalPatchSchema = animalFields.partial();
export type AnimalPatch = z.input<typeof animalPatchSchema>;

export const serviceRequestInputSchema = serviceRequestSchema
  .pick({ animalId: true, type: true })
  .extend({
    preferredDate: z.iso.date().optional(),
    notes: z.string().trim().max(1000).optional(),
  });
export type ServiceRequestInput = z.input<typeof serviceRequestInputSchema>;

/** Anak hidup boleh tanpa calfAnimalId: id dibuatkan otomatis. */
export type EventInput = z.input<typeof eventBodySchema> & {
  occurredAt: number;
  serviceRequestId?: string | null;
  semenStockId?: string | null;
  voidsEventId?: string | null;
  /** true: tetap simpan walau ada peringatan (setara confirmWarnings di server). */
  confirmWarnings?: boolean;
};

export interface RecordEventResult {
  event: AnimalEvent;
  status: ReproStatus;
  warnings: string[];
}

// --- Helper ------------------------------------------------------------------

function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw fromZodIssues(result.error.issues);
  return result.data;
}

/** Kolom bawaan yang tidak ikut ditulis bila undefined. */
const definedOnly = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export async function ensureDeviceId(db: IbDb): Promise<string> {
  const existing = await db.getMeta('deviceId');
  if (existing) return existing;
  const id = `web-${uuidv7()}`;
  await db.setMeta('deviceId', id);
  return id;
}

export interface RepoOptions {
  now?: () => number;
  /** Dipanggil setelah setiap penulisan berhasil (mis. memicu sinkron). */
  onChange?: () => void;
}

export type Repo = ReturnType<typeof createRepo>;

export function createRepo(db: IbDb, { now = () => Date.now(), onChange }: RepoOptions = {}) {
  async function context() {
    const session = await db.getMeta('session');
    if (!session) throw new NotSignedInError();
    const deviceId = await ensureDeviceId(db);
    const time = now();
    const base = (id: string = uuidv7(time)) => ({
      id,
      createdAt: time,
      updatedAt: time,
      deletedAt: null,
      deviceId,
    });
    return { session, deviceId, time, base };
  }

  function requireAdmin(session: Session) {
    if (!ADMIN_ROLES.includes(session.user.role)) {
      throw new LocalValidationError('Anda tidak punya akses untuk tindakan ini.');
    }
  }

  async function liveFarmer(id: string) {
    const farmer = await db.farmers.get(id);
    if (farmer?.deletedAt !== null) throw new LocalValidationError('Peternak tidak ditemukan.');
    return farmer;
  }

  async function liveAnimal(id: string) {
    const animal = await db.animals.get(id);
    if (animal?.deletedAt !== null) throw new LocalValidationError('Ternak tidak ditemukan.');
    return animal;
  }

  async function eventsOf(animalId: string): Promise<DomainEvent[]> {
    const rows = await db.events.where('animalId').equals(animalId).toArray();
    return rows.filter((e) => e.deletedAt === null);
  }

  function done<T>(value: T): T {
    onChange?.();
    return value;
  }

  // --- Peternak --------------------------------------------------------------

  async function createFarmer(input: FarmerInput): Promise<Farmer> {
    const { session, time, base } = await context();
    requireAdmin(session);
    const data = parse(farmerInputSchema, input);
    const row = parse(farmerSchema, {
      ...base(),
      userId: null,
      locationId: data.locationId,
      name: data.name,
      phone: data.phone ?? null,
      address: data.address ?? null,
      isikhnasOwnerId: data.isikhnasOwnerId ?? null,
    });
    await db.transaction('rw', db.farmers, db.outbox, async () => {
      await db.farmers.add(row);
      await enqueue(
        db,
        {
          kind: 'farmer.create',
          method: 'POST',
          path: '/api/farmers',
          body: { id: row.id, ...data },
          table: 'farmers',
          rowId: row.id,
        },
        time,
      );
    });
    return done(row);
  }

  async function updateFarmer(id: string, patch: FarmerPatch): Promise<Farmer> {
    const { session, deviceId, time } = await context();
    requireAdmin(session);
    const data = definedOnly(parse(farmerPatchSchema, patch));
    const before = await liveFarmer(id);
    const row = parse(farmerSchema, { ...before, ...data, updatedAt: time, deviceId });
    await db.transaction('rw', db.farmers, db.outbox, async () => {
      await db.farmers.put(row);
      await enqueue(
        db,
        {
          kind: 'farmer.update',
          method: 'PATCH',
          path: `/api/farmers/${id}`,
          body: data,
          table: 'farmers',
          rowId: id,
        },
        time,
      );
    });
    return done(row);
  }

  // --- Ternak ----------------------------------------------------------------

  async function createAnimal(input: AnimalInput): Promise<Animal> {
    const { session, time, base } = await context();
    const data = parse(animalInputSchema, input);
    if (session.user.role === 'farmer' && data.farmerId !== session.farmerId) {
      throw new LocalValidationError('Peternak tidak ditemukan.');
    }
    await liveFarmer(data.farmerId);
    if (data.damId) await liveAnimal(data.damId);
    if (data.qrCode && (await db.animalTags.where({ type: 'qr', code: data.qrCode }).count()) > 0) {
      throw new LocalValidationError('Kode QR sudah pernah dipakai.');
    }
    const row = parse(animalSchema, {
      ...base(),
      farmerId: data.farmerId,
      damId: data.damId ?? null,
      name: data.name ?? null,
      sex: data.sex,
      breed: data.breed ?? null,
      birthDate: data.birthDate ?? null,
      sireCode: data.sireCode ?? null,
      isikhnasAnimalId: data.isikhnasAnimalId ?? null,
    });
    const tag: AnimalTag | null = data.qrCode
      ? {
          ...base(),
          animalId: row.id,
          type: 'qr',
          code: data.qrCode,
          attachedAt: time,
          removedAt: null,
          removalReason: null,
        }
      : null;
    await db.transaction('rw', db.animals, db.animalTags, db.outbox, async () => {
      await db.animals.add(row);
      if (tag) await db.animalTags.add(tag);
      await enqueue(
        db,
        {
          kind: 'animal.create',
          method: 'POST',
          path: '/api/animals',
          body: { id: row.id, ...data },
          table: 'animals',
          rowId: row.id,
          // Server membuat tag QR dengan id-nya sendiri; tag lokal diganti versi server saat pull.
          provisional: tag ? [{ table: 'animalTags', id: tag.id }] : [],
        },
        time,
      );
    });
    return done(row);
  }

  async function updateAnimal(id: string, patch: AnimalPatch): Promise<Animal> {
    const { deviceId, time } = await context();
    const data = definedOnly(parse(animalPatchSchema, patch));
    const before = await liveAnimal(id);
    if (data.farmerId) await liveFarmer(data.farmerId);
    const row = parse(animalSchema, { ...before, ...data, updatedAt: time, deviceId });
    await db.transaction('rw', db.animals, db.outbox, async () => {
      await db.animals.put(row);
      await enqueue(
        db,
        {
          kind: 'animal.update',
          method: 'PATCH',
          path: `/api/animals/${id}`,
          body: data,
          table: 'animals',
          rowId: id,
        },
        time,
      );
    });
    return done(row);
  }

  // --- Event -----------------------------------------------------------------

  async function recordEvent(animalId: string, input: EventInput): Promise<RecordEventResult> {
    const { session, time, base } = await context();
    const { user } = session;
    const animal = await liveAnimal(animalId);
    const { occurredAt, serviceRequestId, semenStockId, voidsEventId, confirmWarnings } = input;

    if (user.role === 'farmer' && !FARMER_EVENT_TYPES.has(input.type)) {
      throw new LocalValidationError('IB dan PKB dicatat oleh petugas.');
    }
    if (occurredAt > time + FUTURE_TOLERANCE_MS) {
      throw new LocalValidationError('Tanggal kejadian tidak boleh di masa depan.');
    }

    // Anak hidup tanpa id: buatkan id ternak baru di perangkat ini.
    const raw: { type: string; payload: unknown } = { type: input.type, payload: input.payload };
    if (input.type === 'LH') {
      const payload = input.payload as { calves: Record<string, unknown>[] };
      raw.payload = {
        ...payload,
        calves: payload.calves.map((c) =>
          c.condition === 'alive' && !c.calfAnimalId ? { ...c, calfAnimalId: uuidv7(time) } : c,
        ),
      };
    }
    const body = parse(eventBodySchema, raw);

    const row = parse(eventSchema, {
      ...base(),
      animalId: animal.id,
      occurredAt,
      recordedBy: user.id,
      serviceRequestId: serviceRequestId ?? null,
      semenStockId: semenStockId ?? null,
      voidsEventId: voidsEventId ?? null,
      ...body,
    });

    const history = await eventsOf(animal.id);
    const newEvent = row as DomainEvent;
    const result = validateNextEvent(history, newEvent);
    if (!result.ok) throw new LocalValidationError(result.errors.join(' '), result.errors);
    if (result.warnings.length > 0 && !confirmWarnings) {
      throw new WarningsNeedConfirmation(result.warnings);
    }

    // Stok straw (hanya IB): milik petugas yang mencatat dan masih tersisa.
    if (row.semenStockId) {
      const stock = await db.semenStock.get(row.semenStockId);
      if (stock?.deletedAt !== null) throw new LocalValidationError('Stok straw tidak ditemukan.');
      if (user.role === 'inseminator' && stock.holderId !== user.id) {
        throw new LocalValidationError('Stok straw ini milik petugas lain.');
      }
      const used = (await db.events.toArray()).filter(
        (e) => e.semenStockId === stock.id && e.deletedAt === null,
      ).length;
      if (used >= stock.quantityReceived)
        throw new LocalValidationError('Stok straw ini sudah habis.');
    }

    // Permintaan layanan yang diselesaikan event ini (ditandai selesai secara lokal).
    let request: ServiceRequest | null = null;
    if (row.serviceRequestId) {
      const found = await db.serviceRequests.get(row.serviceRequestId);
      if (found?.animalId !== animal.id || found.deletedAt !== null) {
        throw new LocalValidationError('Permintaan layanan tidak ditemukan.');
      }
      if (found.type !== row.type) {
        throw new LocalValidationError(`Permintaan ini untuk ${found.type}, bukan ${row.type}.`);
      }
      if (found.status !== 'assigned' && found.status !== 'in_progress') {
        throw new LocalValidationError('Permintaan ini belum ditugaskan atau sudah selesai.');
      }
      request = { ...found, status: 'done', resultEventId: row.id, updatedAt: time };
    }

    // Anak hidup dari LH didaftarkan sebagai ternak baru (id sama dengan yang dikirim ke server).
    const calves: Animal[] = [];
    if (newEvent.type === 'LH') {
      const before = deriveReproStatus(history, time).status;
      const sireCode = before.kind === 'bunting' ? (before.ibEvent?.payload.bullId ?? null) : null;
      for (const calf of newEvent.payload.calves) {
        if (calf.condition !== 'alive' || !calf.calfAnimalId) continue;
        if (await db.animals.get(calf.calfAnimalId)) {
          throw new LocalValidationError('Id anak sapi sudah dipakai ternak lain.');
        }
        calves.push({
          ...base(calf.calfAnimalId),
          farmerId: animal.farmerId,
          damId: animal.id,
          name: null,
          sex: calf.sex,
          breed: animal.breed,
          birthDate: isoDate(row.occurredAt),
          sireCode,
          isikhnasAnimalId: null,
        });
      }
    }

    await db.transaction('rw', [db.events, db.animals, db.serviceRequests, db.outbox], async () => {
      await db.events.add(row);
      if (calves.length > 0) await db.animals.bulkAdd(calves);
      if (request) await db.serviceRequests.put(request);
      await enqueue(
        db,
        {
          kind: 'event.create',
          method: 'POST',
          path: `/api/animals/${animal.id}/events`,
          body: {
            id: row.id,
            ...body,
            occurredAt: row.occurredAt,
            serviceRequestId: row.serviceRequestId,
            semenStockId: row.semenStockId,
            voidsEventId: row.voidsEventId,
            ...(result.warnings.length > 0 ? { confirmWarnings: true } : {}),
          },
          table: 'events',
          rowId: row.id,
          relatedRowIds: [...calves.map((c) => c.id), ...(request ? [request.id] : [])],
        },
        time,
      );
    });

    const status = deriveReproStatus([...history, newEvent], time).status;
    return done({ event: row, status, warnings: result.warnings });
  }

  // --- Permintaan layanan ----------------------------------------------------

  async function createServiceRequest(input: ServiceRequestInput): Promise<ServiceRequest> {
    const { session, time, base } = await context();
    const data = parse(serviceRequestInputSchema, input);
    const animal = await liveAnimal(data.animalId);
    const open = (await db.serviceRequests.where('animalId').equals(animal.id).toArray()).find(
      (r) => r.type === data.type && r.deletedAt === null && OPEN_REQUEST_STATUSES.has(r.status),
    );
    if (open) {
      throw new LocalValidationError(
        `Ternak ini sudah punya permintaan ${data.type} yang belum selesai.`,
      );
    }
    const status = deriveReproStatus(await eventsOf(animal.id), time).status.kind;
    if (status === 'keluar') throw new LocalValidationError('Ternak sudah keluar.');
    if (data.type === 'IB' && status === 'bunting') {
      throw new LocalValidationError('Sapi sedang bunting; permintaan IB tidak bisa diajukan.');
    }
    const row = parse(serviceRequestSchema, {
      ...base(),
      farmerId: animal.farmerId,
      animalId: animal.id,
      type: data.type,
      status: 'submitted',
      requestedBy: session.user.id,
      preferredDate: data.preferredDate ?? null,
      notes: data.notes ?? null,
      rejectionReason: null,
      resultEventId: null,
    });
    await db.transaction('rw', db.serviceRequests, db.outbox, async () => {
      await db.serviceRequests.add(row);
      await enqueue(
        db,
        {
          kind: 'serviceRequest.create',
          method: 'POST',
          path: '/api/service-requests',
          body: { id: row.id, ...data },
          table: 'serviceRequests',
          rowId: row.id,
        },
        time,
      );
    });
    return done(row);
  }

  /** Petugas menerima tugas yang ditugaskan kepadanya (assigned → in_progress). */
  async function acceptServiceRequest(id: string): Promise<ServiceRequest> {
    const { session, deviceId, time } = await context();
    const request = await db.serviceRequests.get(id);
    if (request?.deletedAt !== null) {
      throw new LocalValidationError('Permintaan layanan tidak ditemukan.');
    }
    const active = (await db.assignments.where('serviceRequestId').equals(id).toArray()).find(
      (a) => a.endedAt === null && a.deletedAt === null,
    );
    if (session.user.role !== 'inseminator' || active?.inseminatorId !== session.user.id) {
      throw new LocalValidationError('Hanya petugas yang ditugaskan yang bisa menerima tugas ini.');
    }
    if (request.status !== 'assigned') {
      throw new LocalValidationError('Tugas ini sudah diterima atau sudah selesai.');
    }
    const next: ServiceRequest = { ...request, status: 'in_progress', updatedAt: time, deviceId };
    await db.transaction('rw', [db.serviceRequests, db.assignments, db.outbox], async () => {
      await db.serviceRequests.put(next);
      await db.assignments.put({ ...active, acceptedAt: time, updatedAt: time, deviceId });
      await enqueue(
        db,
        {
          kind: 'serviceRequest.accept',
          method: 'POST',
          path: `/api/service-requests/${id}/accept`,
          body: {},
          table: 'serviceRequests',
          rowId: id,
          relatedRowIds: [active.id],
        },
        time,
      );
    });
    return done(next);
  }

  // --- Foto (hanya di perangkat ini, belum disinkronkan) ----------------------

  /** Simpan foto ternak (sudah dikecilkan oleh pemanggil). Maksimal 1 MB. */
  async function setAnimalPhoto(animalId: string, data: ArrayBuffer, type: string) {
    const { time } = await context();
    await liveAnimal(animalId);
    if (!type.startsWith('image/')) throw new LocalValidationError('File harus berupa foto.');
    if (data.byteLength > 1_000_000) {
      throw new LocalValidationError('Foto terlalu besar. Pilih foto lain atau ambil ulang.');
    }
    await db.animalPhotos.put({ animalId, data, type, updatedAt: time });
  }

  async function removeAnimalPhoto(animalId: string) {
    await db.animalPhotos.delete(animalId);
  }

  return {
    createFarmer,
    updateFarmer,
    createAnimal,
    updateAnimal,
    recordEvent,
    createServiceRequest,
    acceptServiceRequest,
    setAnimalPhoto,
    removeAnimalPhoto,
  };
}
