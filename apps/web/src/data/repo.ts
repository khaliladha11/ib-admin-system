// Semua penulisan dari UI lewat sini. Polanya sama untuk setiap fungsi:
//   1. validasi dengan skema Zod dan aturan domain dari @ib/shared (sama dengan server);
//   2. tulis baris lokal + entri outbox dalam SATU transaksi Dexie;
//   3. beri tahu sync engine (onChange) agar mencoba mengirim di latar belakang.
// Id dibuat di perangkat (uuidv7) sehingga kiriman ulang aman (server: 409 ALREADY_EXISTS).
import {
  animalSchema,
  animalTagSchema,
  deriveReproStatus,
  eventBodySchema,
  eventSchema,
  farmerSchema,
  generateUniqueQrCodes,
  parseQrCode,
  QR_CODE_PATTERN,
  qrCodeSchema,
  serviceRequestSchema,
  uuidv7,
  validateNextEvent,
  type Animal,
  type AnimalEvent,
  type AnimalTag,
  type QrCode,
  type RandomFill,
  type TagRemovalReason,
  type TagType,
  type Assignment,
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
import { covers } from './locations';
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

/** Paling banyak label per sekali buat: 10 lembar × 40 label. */
export const MAX_NEW_QR_CODES = 400;

const cryptoFill: RandomFill = (bytes) => crypto.getRandomValues(bytes);

export interface AttachTagInput {
  type: TagType;
  /** Kode QR (IB-XXXXX, boleh hasil scan URL) atau nomor eartag. */
  code: string;
  /** Wajib bila ternak sudah punya tag aktif sejenis: tag lama dicabut dengan alasan ini. */
  replaceReason?: TagRemovalReason;
}

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
    /** Nomor eartag resmi yang langsung dipasang (mis. hasil scan/ketik di halaman Scan). */
    eartag: z.string().trim().min(1, 'Isi nomor eartag.').max(50).optional(),
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

/**
 * Hanya kolom yang nilainya benar-benar berubah. Penting untuk konflik per kolom
 * (docs/SYNC.md §5): kolom yang tidak diubah tidak boleh ikut "menang" di server.
 */
const changedOnly = <T extends Record<string, unknown>>(before: object, data: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) =>
        JSON.stringify(value) !== JSON.stringify((before as Record<string, unknown>)[key] ?? null),
    ),
  ) as Partial<T>;

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
  /** Sumber acak untuk kode QR (bawaan: crypto.getRandomValues). */
  randomFill?: RandomFill;
  /** Dipanggil setelah setiap penulisan berhasil (mis. memicu sinkron). */
  onChange?: () => void;
}

export type Repo = ReturnType<typeof createRepo>;

export function createRepo(
  db: IbDb,
  { now = () => Date.now(), onChange, randomFill = cryptoFill }: RepoOptions = {},
) {
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
    const before = await liveFarmer(id);
    const data = changedOnly(before, definedOnly(parse(farmerPatchSchema, patch)));
    if (Object.keys(data).length === 0) return before;
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
    if (
      data.eartag &&
      (await db.animalTags.where({ type: 'eartag', code: data.eartag }).count()) > 0
    ) {
      throw new LocalValidationError('Nomor eartag ini sudah pernah dipakai.');
    }
    const { eartag, ...animalBody } = data;
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
    const eartagRow: AnimalTag | null = eartag
      ? {
          ...base(),
          animalId: row.id,
          type: 'eartag',
          code: eartag,
          attachedAt: time,
          removedAt: null,
          removalReason: null,
        }
      : null;
    await db.transaction('rw', db.animals, db.animalTags, db.outbox, async () => {
      await db.animals.add(row);
      if (tag) await db.animalTags.add(tag);
      if (eartagRow) await db.animalTags.add(eartagRow);
      await enqueue(
        db,
        {
          kind: 'animal.create',
          method: 'POST',
          path: '/api/animals',
          body: { id: row.id, ...animalBody },
          table: 'animals',
          rowId: row.id,
          // Server membuat tag QR dengan id-nya sendiri; tag lokal diganti versi server saat pull.
          provisional: tag ? [{ table: 'animalTags', id: tag.id }] : [],
        },
        time,
      );
      // Eartag dikirim sebagai entri berikutnya (FIFO: ternaknya sudah ada di server).
      if (eartagRow) {
        await enqueue(
          db,
          {
            kind: 'tag.attach',
            method: 'POST',
            path: `/api/animals/${row.id}/tags`,
            body: { id: eartagRow.id, type: 'eartag', code: eartagRow.code },
            table: 'animalTags',
            rowId: eartagRow.id,
          },
          time,
        );
      }
    });
    return done(row);
  }

  async function updateAnimal(id: string, patch: AnimalPatch): Promise<Animal> {
    const { deviceId, time } = await context();
    const before = await liveAnimal(id);
    const data = changedOnly(before, definedOnly(parse(animalPatchSchema, patch)));
    if (Object.keys(data).length === 0) return before;
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

  // --- Aksi admin pada permintaan (alur skripsi: verifikasi → tugaskan → ganti petugas) ---

  async function loadForAdmin(id: string) {
    const ctx = await context();
    requireAdmin(ctx.session);
    const request = await db.serviceRequests.get(id);
    if (request?.deletedAt !== null) {
      throw new LocalValidationError('Permintaan layanan tidak ditemukan.');
    }
    const list = await db.assignments.where('serviceRequestId').equals(id).toArray();
    const active = list.find((a) => a.endedAt === null && a.deletedAt === null) ?? null;
    return { ...ctx, request, active };
  }

  /** Petugas tujuan harus aktif, ber-peran inseminator, dan wilayahnya mencakup lokasi peternak. */
  async function checkInseminator(inseminatorId: string, farmerId: string) {
    const [ins, farmer, locations] = await Promise.all([
      db.users.get(inseminatorId),
      db.farmers.get(farmerId),
      db.locations.toArray(),
    ]);
    if (ins?.role !== 'inseminator' || !ins.isActive || ins.deletedAt !== null) {
      throw new LocalValidationError('Petugas tidak ditemukan atau tidak aktif.');
    }
    if (!farmer || !covers(locations, ins.locationId, farmer.locationId)) {
      throw new LocalValidationError('Wilayah petugas ini tidak mencakup lokasi peternak.');
    }
    return ins;
  }

  function newAssignment(
    base: (id?: string) => ReturnType<Awaited<ReturnType<typeof context>>['base']>,
    requestId: string,
    inseminatorId: string,
    adminId: string,
    time: number,
  ): Assignment {
    return {
      ...base(),
      serviceRequestId: requestId,
      inseminatorId,
      assignedBy: adminId,
      assignedAt: time,
      acceptedAt: null,
      endedAt: null,
      endReason: null,
    };
  }

  /** Verifikasi permintaan baru dan tugaskan petugas (submitted → assigned). */
  async function assignServiceRequest(id: string, inseminatorId: string) {
    const { session, deviceId, time, base, request } = await loadForAdmin(id);
    if (request.status !== 'submitted') {
      throw new LocalValidationError('Hanya permintaan yang baru diajukan yang bisa diverifikasi.');
    }
    await checkInseminator(inseminatorId, request.farmerId);
    const assignment = newAssignment(base, id, inseminatorId, session.user.id, time);
    const next: ServiceRequest = { ...request, status: 'assigned', updatedAt: time, deviceId };
    await db.transaction('rw', [db.serviceRequests, db.assignments, db.outbox], async () => {
      await db.serviceRequests.put(next);
      await db.assignments.add(assignment);
      await enqueue(
        db,
        {
          kind: 'serviceRequest.assign',
          method: 'POST',
          path: `/api/service-requests/${id}/assign`,
          body: { inseminatorId },
          table: 'serviceRequests',
          rowId: id,
          // Server membuat penugasan dengan id sendiri; versi server menggantikan yang lokal.
          provisional: [{ table: 'assignments', id: assignment.id }],
        },
        time,
      );
    });
    return done(next);
  }

  /** Ganti petugas: penugasan lama ditutup (reassigned), penugasan baru dibuat. */
  async function reassignServiceRequest(id: string, inseminatorId: string) {
    const { session, deviceId, time, base, request, active } = await loadForAdmin(id);
    if (request.status !== 'assigned' && request.status !== 'in_progress') {
      throw new LocalValidationError(
        'Hanya permintaan yang sedang ditugaskan yang bisa ganti petugas.',
      );
    }
    if (active?.inseminatorId === inseminatorId) {
      throw new LocalValidationError('Petugas ini sudah ditugaskan.');
    }
    await checkInseminator(inseminatorId, request.farmerId);
    const assignment = newAssignment(base, id, inseminatorId, session.user.id, time);
    const next: ServiceRequest = { ...request, status: 'assigned', updatedAt: time, deviceId };
    await db.transaction('rw', [db.serviceRequests, db.assignments, db.outbox], async () => {
      await db.serviceRequests.put(next);
      if (active) {
        await db.assignments.put({
          ...active,
          endedAt: time,
          endReason: 'reassigned',
          updatedAt: time,
          deviceId,
        });
      }
      await db.assignments.add(assignment);
      await enqueue(
        db,
        {
          kind: 'serviceRequest.reassign',
          method: 'POST',
          path: `/api/service-requests/${id}/reassign`,
          body: { inseminatorId },
          table: 'serviceRequests',
          rowId: id,
          relatedRowIds: active ? [active.id] : [],
          provisional: [{ table: 'assignments', id: assignment.id }],
        },
        time,
      );
    });
    return done(next);
  }

  /** Tolak permintaan baru dengan alasan. */
  async function rejectServiceRequest(id: string, reason: string) {
    const { deviceId, time, request } = await loadForAdmin(id);
    const text = reason.trim();
    if (!text) throw new LocalValidationError('Tulis alasan penolakan.');
    if (text.length > 500) throw new LocalValidationError('Alasan maksimal 500 huruf.');
    if (request.status !== 'submitted') {
      throw new LocalValidationError('Hanya permintaan yang baru diajukan yang bisa ditolak.');
    }
    const next: ServiceRequest = {
      ...request,
      status: 'rejected',
      rejectionReason: text,
      updatedAt: time,
      deviceId,
    };
    await db.transaction('rw', [db.serviceRequests, db.outbox], async () => {
      await db.serviceRequests.put(next);
      await enqueue(
        db,
        {
          kind: 'serviceRequest.reject',
          method: 'POST',
          path: `/api/service-requests/${id}/reject`,
          body: { reason: text },
          table: 'serviceRequests',
          rowId: id,
        },
        time,
      );
    });
    return done(next);
  }

  // --- Foto (hanya di perangkat ini, belum disinkronkan) ----------------------

  /** Simpan foto ternak (sudah dikecilkan oleh pemanggil). Maksimal 1 MB. */
  // --- Kode QR dan tag ---------------------------------------------------------

  /** Semua kode QR yang diketahui perangkat ini: label tercetak dan tag yang pernah dipasang. */
  async function knownQrCodes(): Promise<Set<string>> {
    const [codes, tags] = await Promise.all([
      db.qrCodes.toArray(),
      db.animalTags.where('[type+code]').between(['qr', ''], ['qr', '\uffff']).toArray(),
    ]);
    return new Set([...codes.map((c) => c.code), ...tags.map((t) => t.code)]);
  }

  /**
   * Buat `count` kode QR baru untuk dicetak (label ternak atau label kosong). Kode acak dicek
   * dengan semua kode yang diketahui perangkat, lalu didaftarkan ke server lewat outbox.
   * Server menolak kode yang ternyata sudah dipakai perangkat lain (sangat jarang).
   */
  async function reserveQrCodes(count: number): Promise<QrCode[]> {
    const { session, base } = await context();
    if (!Number.isInteger(count) || count < 1 || count > MAX_NEW_QR_CODES) {
      throw new LocalValidationError(`Jumlah label harus 1 sampai ${String(MAX_NEW_QR_CODES)}.`);
    }
    const rows: QrCode[] = [];
    await db.transaction('rw', db.qrCodes, db.animalTags, db.outbox, async () => {
      const known = await knownQrCodes();
      const codes = generateUniqueQrCodes(count, (c) => known.has(c), randomFill);
      for (const code of codes) {
        const row = parse(qrCodeSchema, { ...base(), code, issuedBy: session.user.id });
        rows.push(row);
      }
      await db.qrCodes.bulkAdd(rows);
      const time = rows[0]?.createdAt ?? now();
      for (const row of rows) {
        await enqueue(
          db,
          {
            kind: 'qrCode.reserve',
            method: 'POST',
            path: '/api/qr-codes',
            body: { id: row.id, code: row.code },
            table: 'qrCodes',
            rowId: row.id,
          },
          time,
        );
      }
    });
    return done(rows);
  }

  /** Kode QR baru langsung dipasang ke ternak (ternak yang belum punya QR, atau ganti tag). */
  async function attachNewQrCode(
    animalId: string,
    replaceReason?: TagRemovalReason,
  ): Promise<AnimalTag> {
    const [code] = await reserveQrCodes(1);
    if (!code) throw new LocalValidationError('Kode QR gagal dibuat.');
    return attachTag(animalId, { type: 'qr', code: code.code, replaceReason });
  }

  async function attachTag(animalId: string, input: AttachTagInput): Promise<AnimalTag> {
    const { deviceId, time, base } = await context();
    const animal = await liveAnimal(animalId);
    const code =
      input.type === 'qr' ? parseQrCode(input.code) : input.code.trim().slice(0, 50) || null;
    if (!code) {
      throw new LocalValidationError(
        input.type === 'qr'
          ? 'Kode QR harus berformat IB-XXXXX (tanpa huruf O dan I).'
          : 'Isi nomor eartag.',
      );
    }
    const tag = parse(animalTagSchema, {
      ...base(),
      animalId: animal.id,
      type: input.type,
      code,
      attachedAt: time,
      removedAt: null,
      removalReason: null,
    });
    await db.transaction('rw', db.animalTags, db.qrCodes, db.outbox, async () => {
      if ((await db.animalTags.where({ type: input.type, code }).count()) > 0) {
        throw new LocalValidationError('Kode ini sudah pernah dipasang. Pakai label lain.');
      }
      if (input.type === 'qr') {
        const label = await db.qrCodes.where('code').equals(code).first();
        const clash = label
          ? await db.outbox
              .where('rowId')
              .equals(label.id)
              .and((e) => e.status === 'rejected')
              .count()
          : 0;
        if (clash > 0) {
          throw new LocalValidationError(
            'Kode ini bentrok dengan label lain. Jangan pakai label ini.',
          );
        }
      }
      const active = (await db.animalTags.where('animalId').equals(animal.id).toArray()).find(
        (t) => t.type === input.type && t.removedAt === null && t.deletedAt === null,
      );
      if (active && !input.replaceReason) {
        throw new LocalValidationError(
          `Ternak ini sudah punya ${input.type === 'qr' ? 'tag QR' : 'eartag'} ${active.code}. Pilih alasan penggantian.`,
        );
      }
      if (active && input.replaceReason) {
        await db.animalTags.put({
          ...active,
          removedAt: time,
          removalReason: input.replaceReason,
          updatedAt: time,
          deviceId,
        });
      }
      await db.animalTags.add(tag);
      await enqueue(
        db,
        {
          kind: 'tag.attach',
          method: 'POST',
          path: `/api/animals/${animal.id}/tags`,
          body: {
            id: tag.id,
            type: input.type,
            code,
            ...(active && input.replaceReason ? { replaceReason: input.replaceReason } : {}),
          },
          table: 'animalTags',
          rowId: tag.id,
          relatedRowIds: active ? [active.id] : [],
        },
        time,
      );
    });
    return done(tag);
  }

  /** Cabut tag (hilang, rusak, atau alasan lain) tanpa memasang yang baru. */
  async function removeTag(tagId: string, reason: TagRemovalReason): Promise<AnimalTag> {
    const { deviceId, time } = await context();
    const tag = await db.animalTags.get(tagId);
    if (tag?.deletedAt !== null) throw new LocalValidationError('Tag tidak ditemukan.');
    if (tag.removedAt !== null) throw new LocalValidationError('Tag ini sudah dicabut.');
    await liveAnimal(tag.animalId);
    const row = parse(animalTagSchema, {
      ...tag,
      removedAt: time,
      removalReason: reason,
      updatedAt: time,
      deviceId,
    });
    await db.transaction('rw', db.animalTags, db.outbox, async () => {
      await db.animalTags.put(row);
      await enqueue(
        db,
        {
          kind: 'tag.remove',
          method: 'POST',
          path: `/api/tags/${tag.id}/remove`,
          body: { reason },
          table: 'animalTags',
          rowId: tag.id,
        },
        time,
      );
    });
    return done(row);
  }

  // --- Antrean kirim: perlu dicek (langkah 4.2) ---------------------------------

  async function reviewEntry(entryId: string) {
    const entry = await db.outbox.where('id').equals(entryId).first();
    if (entry?.status !== 'needs_review' || entry.seq === undefined) {
      throw new LocalValidationError('Catatan ini tidak ada di daftar perlu dicek.');
    }
    return { ...entry, seq: entry.seq };
  }

  /**
   * Kirim ulang event yang perlu dicek, boleh dengan tanggal baru. Diperiksa dulu dengan riwayat
   * di HP; bila masih bertentangan, pesan alasannya ditampilkan. Kiriman ulang memakai id
   * perubahan baru (id lama sudah tercatat "perlu dicek" di server), id event tetap sama.
   */
  async function retryReview(entryId: string, change: { occurredAt?: number } = {}) {
    const { time } = await context();
    const entry = await reviewEntry(entryId);
    const body = { ...(entry.body as Record<string, unknown>) };
    if (change.occurredAt !== undefined) {
      if (change.occurredAt > time + FUTURE_TOLERANCE_MS) {
        throw new LocalValidationError('Tanggal kejadian tidak boleh di masa depan.');
      }
      body.occurredAt = change.occurredAt;
    }
    const event = entry.table === 'events' ? await db.events.get(entry.rowId) : undefined;
    if (event) {
      const candidate = {
        ...event,
        occurredAt: (body.occurredAt as number | undefined) ?? event.occurredAt,
        deletedAt: null,
      } as DomainEvent;
      const history = (await eventsOf(event.animalId)).filter((e) => e.id !== event.id);
      const check = validateNextEvent(history, candidate);
      if (!check.ok) throw new LocalValidationError(check.errors.join(' '), check.errors);
    }
    await db.transaction('rw', db.outbox, db.events, async () => {
      if (event) {
        await db.events.update(event.id, {
          deletedAt: null,
          occurredAt: (body.occurredAt as number | undefined) ?? event.occurredAt,
          updatedAt: time,
        });
      }
      await db.outbox.update(entry.seq, {
        id: uuidv7(time),
        body,
        status: 'pending',
        attempts: 0,
        lastError: null,
        code: null,
        nextAttemptAt: time,
      });
    });
    onChange?.();
  }

  /** Buang event yang perlu dicek: dihapus dari HP; di server tetap tercatat sebagai dibuang. */
  async function discardReview(entryId: string, reason?: string) {
    const { time } = await context();
    const entry = await reviewEntry(entryId);
    await db.transaction('rw', db.outbox, async () => {
      await db.outbox.delete(entry.seq);
      await enqueue(
        db,
        {
          kind: 'syncReview.discard',
          method: 'POST',
          path: `/api/sync/reviews/${entry.id}/discard`,
          body: reason ? { reason } : {},
          table: 'syncReviews',
          rowId: entry.id,
        },
        time,
      );
    });
    onChange?.();
  }

  /** Admin membuang catatan perlu dicek milik petugas di wilayahnya (lewat outbox). */
  async function discardServerReview(reviewId: string, reason?: string) {
    const { session, time, deviceId } = await context();
    requireAdmin(session);
    const review = await db.syncReviews.get(reviewId);
    if (review?.resolvedAt !== null) {
      throw new LocalValidationError('Catatan ini sudah diselesaikan.');
    }
    await db.transaction('rw', db.syncReviews, db.outbox, async () => {
      await db.syncReviews.put({
        ...review,
        resolvedAt: time,
        resolution: 'discarded',
        updatedAt: time,
        deviceId,
      });
      await enqueue(
        db,
        {
          kind: 'syncReview.discard',
          method: 'POST',
          path: `/api/sync/reviews/${review.id}/discard`,
          body: reason ? { reason } : {},
          table: 'syncReviews',
          rowId: review.id,
        },
        time,
      );
    });
    onChange?.();
  }

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
    assignServiceRequest,
    reassignServiceRequest,
    rejectServiceRequest,
    reserveQrCodes,
    attachTag,
    attachNewQrCode,
    removeTag,
    retryReview,
    discardReview,
    discardServerReview,
    setAnimalPhoto,
    removeAnimalPhoto,
  };
}
