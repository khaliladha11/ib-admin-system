import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  animalSchema,
  computeSchedule,
  deriveReproStatus,
  effectiveEvents,
  eventBodySchema,
  QR_CODE_PATTERN,
  TAG_REMOVAL_REASONS,
  TAG_TYPES,
  validateNextEvent,
  type DomainEvent,
} from '@ib/shared';
import { and, asc, count, eq, isNull } from 'drizzle-orm';

import { ADMIN_ROLES, farmerScopeCondition, isAdmin, requireRole } from '../auth/scope';
import { requireUser } from '../auth/session';
import {
  animals,
  animalTags,
  assignments,
  events,
  farmers,
  semenStock,
  serviceRequests,
} from '../db/schema';
import {
  ApiError,
  conflict,
  errorResponses,
  eventErrorResponses,
  forbidden,
  notFound,
} from '../http/errors';
import type { AppEnv } from '../http/env';
import {
  animalDtoSchema,
  eventDtoSchema,
  idParamSchema,
  jsonBody,
  jsonContent,
  listOf,
  REPRO_STATUS_KINDS,
  reproStatusDtoSchema,
  tagDtoSchema,
  toStatusDto,
} from '../http/schemas';
import {
  assertNewId,
  audit,
  loadAnimal,
  loadFarmer,
  newRow,
  registerQrCode,
  scopeOf,
  SYNC_HEADER,
  toDomainEvent,
  updateProfile,
  withStatus,
  type AppContext,
} from './helpers';

const FUTURE_TOLERANCE_MS = 5 * 60_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// --- Skema request -----------------------------------------------------------

const animalFields = z.object(
  animalSchema.pick({
    farmerId: true,
    damId: true,
    name: true,
    sex: true,
    breed: true,
    birthDate: true,
    sireCode: true,
    isikhnasAnimalId: true,
  }).shape,
);

const createAnimalSchema = animalFields
  .partial({
    damId: true,
    name: true,
    breed: true,
    birthDate: true,
    sireCode: true,
    isikhnasAnimalId: true,
  })
  .extend({
    id: z.uuid().optional(),
    /** Kode QR yang langsung dipasang saat pendaftaran (mis. hasil scan label). */
    qrCode: z.string().regex(QR_CODE_PATTERN, 'Kode QR harus berformat IB-XXXXX').optional(),
  })
  .openapi('CreateAnimal');

const updateAnimalSchema = animalFields.partial().openapi('UpdateAnimal');

const attachTagSchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(TAG_TYPES),
    code: z.string().trim().min(1).max(50),
    /** Wajib bila ternak sudah punya tag aktif dengan jenis yang sama (tag lama dicabut). */
    replaceReason: z.enum(TAG_REMOVAL_REASONS).optional(),
  })
  .refine((t) => t.type !== 'qr' || QR_CODE_PATTERN.test(t.code), {
    error: 'Kode QR harus berformat IB-XXXXX',
    path: ['code'],
  })
  .openapi('AttachTag');

const removeTagSchema = z.object({ reason: z.enum(TAG_REMOVAL_REASONS) }).openapi('RemoveTag');

const createEventSchema = z
  .intersection(
    eventBodySchema,
    z.object({
      id: z.uuid().optional(),
      occurredAt: z.int().nonnegative(),
      serviceRequestId: z.uuid().nullable().optional(),
      semenStockId: z.uuid().nullable().optional(),
      voidsEventId: z.uuid().nullable().optional(),
      /** Kirim true untuk tetap menyimpan event yang memunculkan peringatan. */
      confirmWarnings: z.boolean().optional(),
    }),
  )
  .openapi('CreateEvent');

const eventCreatedSchema = z
  .object({ event: eventDtoSchema, status: reproStatusDtoSchema, warnings: z.array(z.string()) })
  .openapi('EventCreated');

const scheduleDtoSchema = z
  .object({
    nextEstrusAt: z.int().nullable(),
    pkbDueAt: z.int().nullable(),
    expectedCalving: z.object({ earliest: z.int(), expected: z.int(), latest: z.int() }).nullable(),
    reminders: z.array(
      z.object({
        code: z.enum(['IB_RESULT_OVERDUE', 'BIRTH_REPORT_OVERDUE']),
        eventId: z.string(),
        dueAt: z.int(),
        overdueDays: z.int(),
        message: z.string(),
      }),
    ),
  })
  .openapi('Schedule');

const timelineSchema = z
  .object({
    animal: animalDtoSchema,
    events: z.array(eventDtoSchema.extend({ voided: z.boolean() })),
    anomalies: z.array(z.string()),
    schedule: scheduleDtoSchema,
  })
  .openapi('AnimalTimeline');

const tags = ['Ternak'];
const security = [{ cookieAuth: [] }];

// --- Helper ------------------------------------------------------------------

function animalEvents(c: AppContext, animalId: string) {
  return c.var.db
    .select()
    .from(events)
    .where(and(eq(events.animalId, animalId), isNull(events.deletedAt)))
    .orderBy(asc(events.occurredAt))
    .all();
}

/** Peternak hanya mencatat event yang bisa ia amati sendiri; IB dan PKB oleh petugas. */
const FARMER_EVENT_TYPES = new Set(['BH', 'KGG', 'LH', 'BB', 'HEALTH', 'EXIT']);

// --- Route -------------------------------------------------------------------

export function registerAnimalRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/animals',
      tags,
      security,
      summary: 'Daftar ternak dalam cakupan, dengan status reproduksi terhitung',
      request: {
        query: z.object({
          farmerId: z.uuid().optional(),
          status: z.enum(REPRO_STATUS_KINDS).optional(),
        }),
      },
      responses: {
        200: jsonContent(listOf(animalDtoSchema), 'Daftar ternak'),
        401: errorResponses[401],
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { farmerId, status } = c.req.valid('query');
      const rows = c.var.db
        .select({ animal: animals })
        .from(animals)
        .innerJoin(farmers, eq(farmers.id, animals.farmerId))
        .where(
          and(
            farmerScopeCondition(scope),
            isNull(animals.deletedAt),
            farmerId ? eq(animals.farmerId, farmerId) : undefined,
          ),
        )
        .orderBy(asc(animals.name))
        .all()
        .map((r) => r.animal);
      const items = withStatus(c, rows).filter((a) => !status || a.status.kind === status);
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/animals/{id}',
      tags,
      security,
      summary: 'Detail ternak',
      request: { params: idParamSchema },
      responses: { 200: jsonContent(animalDtoSchema, 'Ternak'), ...errorResponses },
    }),
    (c) => {
      const { animal } = loadAnimal(c, scopeOf(c), c.req.valid('param').id);
      const [item] = withStatus(c, [animal]);
      if (!item) throw notFound('Ternak');
      return c.json(item, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/animals',
      tags,
      security,
      summary: 'Daftarkan ternak (peternak untuk miliknya sendiri, petugas, admin)',
      request: jsonBody(createAnimalSchema),
      responses: { 201: jsonContent(animalDtoSchema, 'Ternak dibuat'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const body = c.req.valid('json');
      const farmer = loadFarmer(c, scope, body.farmerId);
      if (body.damId) loadAnimal(c, scope, body.damId);
      const { db } = c.var;
      if (body.id)
        assertNewId(
          !!db.select({ id: animals.id }).from(animals).where(eq(animals.id, body.id)).get(),
        );
      if (
        body.qrCode &&
        db
          .select({ id: animalTags.id })
          .from(animalTags)
          .where(and(eq(animalTags.type, 'qr'), eq(animalTags.code, body.qrCode)))
          .get()
      ) {
        throw conflict('Kode QR sudah pernah dipakai.');
      }
      const row = {
        ...newRow(c, body.id),
        farmerId: farmer.id,
        damId: body.damId ?? null,
        name: body.name ?? null,
        sex: body.sex,
        breed: body.breed ?? null,
        birthDate: body.birthDate ?? null,
        sireCode: body.sireCode ?? null,
        isikhnasAnimalId: body.isikhnasAnimalId ?? null,
      };
      db.transaction((tx) => {
        tx.insert(animals).values(row).run();
        if (body.qrCode) {
          tx.insert(animalTags)
            .values({
              ...newRow(c),
              animalId: row.id,
              type: 'qr',
              code: body.qrCode,
              attachedAt: row.createdAt,
              removedAt: null,
              removalReason: null,
            })
            .run();
          registerQrCode(c, tx, body.qrCode);
        }
        audit(c, tx, {
          tableName: 'animals',
          rowId: row.id,
          action: 'insert',
          before: null,
          after: { name: row.name, farmerId: row.farmerId },
        });
      });
      const [item] = withStatus(c, [row]);
      if (!item) throw notFound('Ternak');
      return c.json(item, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/animals/{id}',
      tags,
      security,
      summary: 'Ubah data ternak (pindah pemilik hanya oleh admin)',
      request: { params: idParamSchema, ...jsonBody(updateAnimalSchema) },
      responses: { 200: jsonContent(animalDtoSchema, 'Ternak diperbarui'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { animal } = loadAnimal(c, scope, c.req.valid('param').id);
      const patch = c.req.valid('json');
      if (patch.farmerId && patch.farmerId !== animal.farmerId) {
        requireRole(scope.user, ADMIN_ROLES, 'Hanya admin yang bisa memindahkan pemilik ternak.');
        loadFarmer(c, scope, patch.farmerId);
      }
      if (patch.damId) {
        if (patch.damId === animal.id)
          throw conflict('Ternak tidak bisa menjadi induk dirinya sendiri.');
        loadAnimal(c, scope, patch.damId);
      }
      const { row: updated } = updateProfile(c, animals, 'animals', animal, patch);
      const [item] = withStatus(c, [updated]);
      if (!item) throw notFound('Ternak');
      return c.json(item, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/animals/{id}',
      tags,
      security,
      summary: 'Hapus ternak (soft delete, admin). Ternak yang keluar dicatat dengan event EXIT.',
      request: { params: idParamSchema },
      responses: { 204: { description: 'Dihapus' }, ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { animal } = loadAnimal(c, scope, c.req.valid('param').id);
      requireRole(scope.user, ADMIN_ROLES);
      const time = c.var.now();
      c.var.db.transaction((tx) => {
        tx.update(animals)
          .set({ deletedAt: time, updatedAt: time, deviceId: c.var.deviceId })
          .where(eq(animals.id, animal.id))
          .run();
        audit(c, tx, {
          tableName: 'animals',
          rowId: animal.id,
          action: 'delete',
          before: { name: animal.name },
          after: null,
        });
      });
      return c.body(null, 204);
    },
  );

  // --- Tag -------------------------------------------------------------------

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/animals/{id}/tags',
      tags,
      security,
      summary: 'Riwayat tag ternak (pasang, ganti, cabut)',
      request: { params: idParamSchema },
      responses: { 200: jsonContent(listOf(tagDtoSchema), 'Riwayat tag'), ...errorResponses },
    }),
    (c) => {
      const { animal } = loadAnimal(c, scopeOf(c), c.req.valid('param').id);
      const items = c.var.db
        .select()
        .from(animalTags)
        .where(and(eq(animalTags.animalId, animal.id), isNull(animalTags.deletedAt)))
        .orderBy(asc(animalTags.attachedAt))
        .all();
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/animals/{id}/tags',
      tags,
      security,
      summary: 'Pasang tag QR/eartag; tag aktif sejenis dicabut bila replaceReason diisi',
      request: { params: idParamSchema, ...jsonBody(attachTagSchema) },
      responses: { 201: jsonContent(tagDtoSchema, 'Tag dipasang'), ...errorResponses },
    }),
    (c) => {
      const { animal } = loadAnimal(c, scopeOf(c), c.req.valid('param').id);
      const body = c.req.valid('json');
      const { db } = c.var;
      if (body.id)
        assertNewId(
          !!db
            .select({ id: animalTags.id })
            .from(animalTags)
            .where(eq(animalTags.id, body.id))
            .get(),
        );
      if (
        db
          .select({ id: animalTags.id })
          .from(animalTags)
          .where(and(eq(animalTags.type, body.type), eq(animalTags.code, body.code)))
          .get()
      ) {
        throw conflict('Kode tag sudah pernah dipakai.');
      }
      const active = db
        .select()
        .from(animalTags)
        .where(
          and(
            eq(animalTags.animalId, animal.id),
            eq(animalTags.type, body.type),
            isNull(animalTags.removedAt),
            isNull(animalTags.deletedAt),
          ),
        )
        .get();
      if (active && !body.replaceReason) {
        throw conflict(
          'Ternak sudah punya tag aktif dengan jenis ini; isi replaceReason untuk menggantinya.',
          { activeTagId: active.id },
        );
      }
      const time = c.var.now();
      const row = {
        ...newRow(c, body.id),
        animalId: animal.id,
        type: body.type,
        code: body.code,
        attachedAt: time,
        removedAt: null,
        removalReason: null,
      };
      db.transaction((tx) => {
        if (active && body.replaceReason) {
          tx.update(animalTags)
            .set({
              removedAt: time,
              removalReason: body.replaceReason,
              updatedAt: time,
              deviceId: c.var.deviceId,
            })
            .where(eq(animalTags.id, active.id))
            .run();
        }
        tx.insert(animalTags).values(row).run();
        if (row.type === 'qr') registerQrCode(c, tx, row.code);
      });
      return c.json(row, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/tags/{id}/remove',
      tags,
      security,
      summary: 'Cabut tag (hilang, rusak, atau alasan lain)',
      request: { params: idParamSchema, ...jsonBody(removeTagSchema) },
      responses: { 200: jsonContent(tagDtoSchema, 'Tag dicabut'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const tag = c.var.db
        .select()
        .from(animalTags)
        .where(and(eq(animalTags.id, c.req.valid('param').id), isNull(animalTags.deletedAt)))
        .get();
      if (!tag) throw notFound('Tag');
      loadAnimal(c, scope, tag.animalId);
      const reason = c.req.valid('json').reason;
      if (tag.removedAt !== null) {
        // Kiriman ulang dari outbox (alasan sama): dianggap berhasil.
        if (tag.removalReason === reason) return c.json(tag, 200);
        throw conflict('Tag ini sudah dicabut.');
      }
      const time = c.var.now();
      const updated = {
        ...tag,
        removedAt: time,
        removalReason: reason,
        updatedAt: time,
        deviceId: c.var.deviceId,
      };
      c.var.db.update(animalTags).set(updated).where(eq(animalTags.id, tag.id)).run();
      return c.json(updated, 200);
    },
  );

  // --- Event -----------------------------------------------------------------

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/animals/{id}/events',
      tags,
      security,
      summary:
        'Catat event (BH, IB, PKB, KGG, LH, BB, HEALTH, EXIT); wajib lolos validateNextEvent',
      description:
        'Error urutan → 422 INVALID_EVENT. Peringatan → 409 WARNINGS_NEED_CONFIRMATION; kirim ulang dengan confirmWarnings: true. ' +
        'serviceRequestId menyelesaikan permintaan layanan yang ditugaskan. LH dengan anak hidup otomatis mendaftarkan anaknya.',
      request: { params: idParamSchema, ...jsonBody(createEventSchema) },
      responses: {
        201: jsonContent(eventCreatedSchema, 'Event tersimpan'),
        ...eventErrorResponses,
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      const user = requireUser(c);
      const { animal } = loadAnimal(c, scope, c.req.valid('param').id);
      const body = c.req.valid('json');
      const { db } = c.var;
      const time = c.var.now();

      if (user.role === 'farmer' && !FARMER_EVENT_TYPES.has(body.type)) {
        throw forbidden('IB dan PKB dicatat oleh petugas.');
      }
      if (body.occurredAt > time + FUTURE_TOLERANCE_MS) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Tanggal kejadian tidak boleh di masa depan.');
      }
      if (body.id)
        assertNewId(
          !!db.select({ id: events.id }).from(events).where(eq(events.id, body.id)).get(),
        );

      const row = {
        ...newRow(c, body.id),
        animalId: animal.id,
        type: body.type,
        occurredAt: body.occurredAt,
        recordedBy: user.id,
        payload: body.payload,
        serviceRequestId: body.serviceRequestId ?? null,
        semenStockId: body.semenStockId ?? null,
        voidsEventId: body.voidsEventId ?? null,
      };
      const history = animalEvents(c, animal.id).map(toDomainEvent);
      const newEvent = { ...row, type: body.type, payload: body.payload } as DomainEvent;

      const result = validateNextEvent(history, newEvent);
      if (!result.ok) {
        throw new ApiError(422, 'INVALID_EVENT', result.errors.join(' '), result);
      }
      // Dari sinkron: peringatan akibat data HP lain diterima (kejanggalan tampil di profil).
      const fromSync = c.req.header(SYNC_HEADER) === '1';
      if (result.warnings.length > 0 && !body.confirmWarnings && !fromSync) {
        throw new ApiError(
          409,
          'WARNINGS_NEED_CONFIRMATION',
          'Periksa peringatan, lalu kirim ulang dengan confirmWarnings: true bila data sudah benar.',
          { warnings: result.warnings },
        );
      }

      // Stok straw (hanya IB): milik petugas yang mencatat dan masih tersisa.
      if (row.semenStockId) {
        if (row.type !== 'IB')
          throw new ApiError(400, 'VALIDATION_ERROR', 'Stok straw hanya untuk event IB.');
        const stock = db
          .select()
          .from(semenStock)
          .where(and(eq(semenStock.id, row.semenStockId), isNull(semenStock.deletedAt)))
          .get();
        if (!stock) throw notFound('Stok straw');
        if (user.role === 'inseminator' && stock.holderId !== user.id)
          throw forbidden('Stok straw ini milik petugas lain.');
        const used =
          db
            .select({ n: count() })
            .from(events)
            .where(and(eq(events.semenStockId, stock.id), isNull(events.deletedAt)))
            .get()?.n ?? 0;
        if (used >= stock.quantityReceived) throw conflict('Stok straw ini sudah habis.');
      }

      // Permintaan layanan yang diselesaikan oleh event ini.
      let completion: { requestId: string; assignmentId: string | null } | null = null;
      if (row.serviceRequestId) {
        const request = db
          .select()
          .from(serviceRequests)
          .where(
            and(eq(serviceRequests.id, row.serviceRequestId), isNull(serviceRequests.deletedAt)),
          )
          .get();
        if (request?.animalId !== animal.id) throw notFound('Permintaan layanan');
        if (request.type !== row.type) {
          throw conflict(`Permintaan ini untuk ${request.type}, bukan ${row.type}.`);
        }
        if (request.status !== 'assigned' && request.status !== 'in_progress') {
          throw conflict('Permintaan ini belum ditugaskan atau sudah selesai.');
        }
        const active = db
          .select()
          .from(assignments)
          .where(
            and(
              eq(assignments.serviceRequestId, request.id),
              isNull(assignments.endedAt),
              isNull(assignments.deletedAt),
            ),
          )
          .get();
        if (user.role === 'inseminator' && active?.inseminatorId !== user.id) {
          throw forbidden('Permintaan ini ditugaskan ke petugas lain.');
        }
        if (!isAdmin(user) && user.role !== 'inseminator') throw forbidden();
        completion = { requestId: request.id, assignmentId: active?.id ?? null };
      }

      // Anak hidup dari LH didaftarkan sebagai ternak baru.
      const calves: (typeof animals.$inferInsert)[] = [];
      if (newEvent.type === 'LH') {
        const before = deriveReproStatus(history, time).status;
        const sireCode =
          before.kind === 'bunting' ? (before.ibEvent?.payload.bullId ?? null) : null;
        for (const calf of newEvent.payload.calves) {
          if (calf.condition !== 'alive' || !calf.calfAnimalId) continue;
          const exists = db
            .select({ id: animals.id })
            .from(animals)
            .where(eq(animals.id, calf.calfAnimalId))
            .get();
          if (exists) throw conflict('Id anak sapi sudah dipakai ternak lain.');
          calves.push({
            ...newRow(c, calf.calfAnimalId),
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

      db.transaction((tx) => {
        tx.insert(events).values(row).run();
        if (calves.length > 0) tx.insert(animals).values(calves).run();
        if (completion) {
          tx.update(serviceRequests)
            .set({
              status: 'done',
              resultEventId: row.id,
              updatedAt: time,
              deviceId: c.var.deviceId,
            })
            .where(eq(serviceRequests.id, completion.requestId))
            .run();
          audit(c, tx, {
            tableName: 'service_requests',
            rowId: completion.requestId,
            action: 'update',
            before: null,
            after: { action: 'complete', status: 'done', resultEventId: row.id },
          });
          if (completion.assignmentId) {
            const a = tx
              .select()
              .from(assignments)
              .where(eq(assignments.id, completion.assignmentId))
              .get();
            tx.update(assignments)
              .set({
                endedAt: time,
                endReason: 'completed',
                acceptedAt: a?.acceptedAt ?? time,
                updatedAt: time,
                deviceId: c.var.deviceId,
              })
              .where(eq(assignments.id, completion.assignmentId))
              .run();
          }
        }
      });

      const status = deriveReproStatus([...history, newEvent], time).status;
      return c.json({ event: row, status: toStatusDto(status), warnings: result.warnings }, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/animals/{id}/timeline',
      tags,
      security,
      summary: 'Linimasa event, status, anomali, dan jadwal (computeSchedule) seekor ternak',
      request: { params: idParamSchema },
      responses: { 200: jsonContent(timelineSchema, 'Linimasa ternak'), ...errorResponses },
    }),
    (c) => {
      const { animal } = loadAnimal(c, scopeOf(c), c.req.valid('param').id);
      const rows = animalEvents(c, animal.id);
      const domain = rows.map(toDomainEvent);
      const effective = new Set(effectiveEvents(domain).map((e) => e.id));
      const today = c.var.now();
      const { anomalies } = deriveReproStatus(domain, today);
      const { nextEstrusAt, pkbDueAt, expectedCalving, reminders } = computeSchedule(domain, today);
      const [item] = withStatus(c, [animal]);
      if (!item) throw notFound('Ternak');
      return c.json(
        {
          animal: item,
          events: rows.map((e) => ({ ...e, voided: !effective.has(e.id) })),
          anomalies: anomalies.map((e) => e.id),
          schedule: { nextEstrusAt, pkbDueAt, expectedCalving, reminders },
        },
        200,
      );
    },
  );
}
