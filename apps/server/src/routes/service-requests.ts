// Permintaan layanan (IB/PKB) dan penugasan petugas. Alur dari skripsi:
//   peternak mengajukan → admin memverifikasi & menugaskan (atau menolak)
//   → petugas menerima → petugas mencatat IB/PKB dengan serviceRequestId (selesai).
// Ganti petugas menutup penugasan lama (end_reason = reassigned) dan membuat baris baru,
// sehingga riwayat penugasan tidak ditimpa seperti di versi skripsi.
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { deriveReproStatus, SERVICE_REQUEST_STATUSES, SERVICE_REQUEST_TYPES } from '@ib/shared';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';

import {
  ADMIN_ROLES,
  canAccessFarmer,
  coversLocation,
  farmerScopeCondition,
  isAdmin,
  requireRole,
  type Scope,
} from '../auth/scope';
import { requireUser } from '../auth/session';
import { animals, assignments, events, farmers, serviceRequests, users } from '../db/schema';
import { conflict, errorResponses, forbidden, notFound } from '../http/errors';
import type { AppEnv } from '../http/env';
import {
  assignmentDtoSchema,
  idParamSchema,
  jsonBody,
  jsonContent,
  listOf,
  serviceRequestDtoSchema,
} from '../http/schemas';
import {
  assertNewId,
  loadAnimal,
  newRow,
  scopeOf,
  toDomainEvent,
  type AppContext,
} from './helpers';

const OPEN_STATUSES = ['submitted', 'assigned', 'in_progress'] as const;

const createRequestSchema = z
  .object({
    id: z.uuid().optional(),
    animalId: z.uuid(),
    type: z.enum(SERVICE_REQUEST_TYPES),
    preferredDate: z.iso.date().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .openapi('CreateServiceRequest');

const assignSchema = z.object({ inseminatorId: z.uuid() }).openapi('AssignInseminator');
const rejectSchema = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .openapi('RejectServiceRequest');

const requestListItemSchema = serviceRequestDtoSchema
  .extend({
    animalName: z.string().nullable(),
    farmerName: z.string(),
    activeAssignment: assignmentDtoSchema.nullable(),
  })
  .openapi('ServiceRequestListItem');

const requestDetailSchema = z
  .object({ request: serviceRequestDtoSchema, assignments: z.array(assignmentDtoSchema) })
  .openapi('ServiceRequestDetail');

const tags = ['Permintaan layanan'];
const security = [{ cookieAuth: [] }];

// --- Helper ------------------------------------------------------------------

function assignmentsOf(c: AppContext, requestId: string) {
  return c.var.db
    .select()
    .from(assignments)
    .where(and(eq(assignments.serviceRequestId, requestId), isNull(assignments.deletedAt)))
    .orderBy(asc(assignments.assignedAt))
    .all();
}

const activeOf = (list: (typeof assignments.$inferSelect)[]) =>
  list.find((a) => a.endedAt === null) ?? null;

/** Muat permintaan bila terlihat oleh pengguna (wilayah/milik sendiri, atau ditugaskan kepadanya). */
function loadRequest(c: AppContext, scope: Scope, id: string) {
  const row = c.var.db
    .select({ request: serviceRequests, farmer: farmers })
    .from(serviceRequests)
    .innerJoin(farmers, eq(farmers.id, serviceRequests.farmerId))
    .where(and(eq(serviceRequests.id, id), isNull(serviceRequests.deletedAt)))
    .get();
  if (!row) throw notFound('Permintaan layanan');
  const list = assignmentsOf(c, id);
  const assignedToMe =
    scope.user.role === 'inseminator' && list.some((a) => a.inseminatorId === scope.user.id);
  if (!canAccessFarmer(scope, row.farmer) && !assignedToMe) throw notFound('Permintaan layanan');
  return { ...row, assignments: list, active: activeOf(list) };
}

/** Petugas tujuan harus aktif, ber-peran inseminator, dan wilayahnya mencakup lokasi peternak. */
function loadInseminatorFor(
  c: AppContext,
  scope: Scope,
  inseminatorId: string,
  farmerLocationId: string,
) {
  const ins = c.var.db
    .select()
    .from(users)
    .where(and(eq(users.id, inseminatorId), isNull(users.deletedAt)))
    .get();
  if (ins?.role !== 'inseminator' || !ins.isActive) throw notFound('Petugas');
  if (!coversLocation(scope, ins.locationId, farmerLocationId)) {
    throw conflict('Wilayah petugas ini tidak mencakup lokasi peternak.');
  }
  return ins;
}

function detail(c: AppContext, requestId: string) {
  const request = c.var.db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId))
    .get();
  if (!request) throw notFound('Permintaan layanan');
  return { request, assignments: assignmentsOf(c, requestId) };
}

function requireStatus(current: string, allowed: readonly string[], message: string) {
  if (!allowed.includes(current)) throw conflict(message, { status: current });
}

const actionResponses = {
  200: jsonContent(requestDetailSchema, 'Permintaan diperbarui'),
  ...errorResponses,
};

const actionRoute = (path: string, summary: string) =>
  createRoute({
    method: 'post',
    path,
    tags,
    security,
    summary,
    request: { params: idParamSchema },
    responses: actionResponses,
  });

const actionRouteWithBody = <B extends z.ZodType>(path: string, summary: string, body: B) =>
  createRoute({
    method: 'post',
    path,
    tags,
    security,
    summary,
    request: { params: idParamSchema, ...jsonBody(body) },
    responses: actionResponses,
  });

// --- Route -------------------------------------------------------------------

export function registerServiceRequestRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/service-requests',
      tags,
      security,
      summary: 'Daftar permintaan layanan (inseminator: juga tugas yang ditugaskan kepadanya)',
      request: {
        query: z.object({
          status: z.enum(SERVICE_REQUEST_STATUSES).optional(),
          /** Inseminator: hanya tugas aktif miliknya. */
          mine: z.enum(['true', 'false']).optional(),
        }),
      },
      responses: {
        200: jsonContent(listOf(requestListItemSchema), 'Daftar permintaan'),
        401: errorResponses[401],
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { status, mine } = c.req.valid('query');
      const { db } = c.var;
      const myRequestIds =
        scope.user.role === 'inseminator'
          ? db
              .select({ id: assignments.serviceRequestId })
              .from(assignments)
              .where(
                and(
                  eq(assignments.inseminatorId, scope.user.id),
                  isNull(assignments.deletedAt),
                  mine === 'true' ? isNull(assignments.endedAt) : undefined,
                ),
              )
              .all()
              .map((r) => r.id)
          : [];
      const visibility =
        mine === 'true'
          ? inArray(serviceRequests.id, myRequestIds)
          : or(farmerScopeCondition(scope), inArray(serviceRequests.id, myRequestIds));
      const rows = db
        .select({ request: serviceRequests, farmer: farmers })
        .from(serviceRequests)
        .innerJoin(farmers, eq(farmers.id, serviceRequests.farmerId))
        .where(
          and(
            visibility,
            isNull(serviceRequests.deletedAt),
            status ? eq(serviceRequests.status, status) : undefined,
          ),
        )
        .orderBy(desc(serviceRequests.createdAt))
        .all();
      const animalIds = [...new Set(rows.map((r) => r.request.animalId))];
      const names = new Map(
        (animalIds.length > 0
          ? db
              .select({ id: animals.id, name: animals.name })
              .from(animals)
              .where(inArray(animals.id, animalIds))
              .all()
          : []
        ).map((a) => [a.id, a.name]),
      );
      const items = rows.map(({ request, farmer }) => ({
        ...request,
        animalName: names.get(request.animalId) ?? null,
        farmerName: farmer.name,
        activeAssignment: activeOf(assignmentsOf(c, request.id)),
      }));
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/service-requests/{id}',
      tags,
      security,
      summary: 'Detail permintaan beserta riwayat penugasan',
      request: { params: idParamSchema },
      responses: { 200: jsonContent(requestDetailSchema, 'Permintaan'), ...errorResponses },
    }),
    (c) => {
      const { request, assignments: list } = loadRequest(c, scopeOf(c), c.req.valid('param').id);
      return c.json({ request, assignments: list }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/service-requests',
      tags,
      security,
      summary: 'Ajukan permintaan IB/PKB untuk seekor ternak',
      request: jsonBody(createRequestSchema),
      responses: { 201: jsonContent(requestDetailSchema, 'Permintaan dibuat'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const user = requireUser(c);
      const body = c.req.valid('json');
      const { animal } = loadAnimal(c, scope, body.animalId);
      const { db } = c.var;
      if (body.id)
        assertNewId(
          !!db
            .select({ id: serviceRequests.id })
            .from(serviceRequests)
            .where(eq(serviceRequests.id, body.id))
            .get(),
        );

      const open = db
        .select({ id: serviceRequests.id })
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.animalId, animal.id),
            eq(serviceRequests.type, body.type),
            inArray(serviceRequests.status, [...OPEN_STATUSES]),
            isNull(serviceRequests.deletedAt),
          ),
        )
        .get();
      if (open)
        throw conflict(`Ternak ini sudah punya permintaan ${body.type} yang belum selesai.`, {
          serviceRequestId: open.id,
        });

      const history = db
        .select()
        .from(events)
        .where(and(eq(events.animalId, animal.id), isNull(events.deletedAt)))
        .all()
        .map(toDomainEvent);
      const status = deriveReproStatus(history, c.var.now()).status.kind;
      if (status === 'keluar') throw conflict('Ternak sudah keluar.');
      if (body.type === 'IB' && status === 'bunting')
        throw conflict('Sapi sedang bunting; permintaan IB tidak bisa diajukan.');

      const row = {
        ...newRow(c, body.id),
        farmerId: animal.farmerId,
        animalId: animal.id,
        type: body.type,
        status: 'submitted' as const,
        requestedBy: user.id,
        preferredDate: body.preferredDate ?? null,
        notes: body.notes ?? null,
        rejectionReason: null,
        resultEventId: null,
      };
      db.insert(serviceRequests).values(row).run();
      return c.json({ request: row, assignments: [] }, 201);
    },
  );

  app.openapi(
    actionRouteWithBody(
      '/api/service-requests/{id}/assign',
      'Verifikasi dan tugaskan petugas (admin)',
      assignSchema,
    ),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const { request, farmer } = loadRequest(c, scope, c.req.valid('param').id);
      requireStatus(
        request.status,
        ['submitted'],
        'Hanya permintaan yang baru diajukan yang bisa diverifikasi.',
      );
      const ins = loadInseminatorFor(
        c,
        scope,
        c.req.valid('json').inseminatorId,
        farmer.locationId,
      );
      const time = c.var.now();
      c.var.db.transaction((tx) => {
        tx.update(serviceRequests)
          .set({ status: 'assigned', updatedAt: time, deviceId: c.var.deviceId })
          .where(eq(serviceRequests.id, request.id))
          .run();
        tx.insert(assignments)
          .values({
            ...newRow(c),
            serviceRequestId: request.id,
            inseminatorId: ins.id,
            assignedBy: scope.user.id,
            assignedAt: time,
            acceptedAt: null,
            endedAt: null,
            endReason: null,
          })
          .run();
      });
      return c.json(detail(c, request.id), 200);
    },
  );

  app.openapi(
    actionRouteWithBody(
      '/api/service-requests/{id}/reassign',
      'Ganti petugas (admin); penugasan lama ditutup',
      assignSchema,
    ),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const { request, farmer, active } = loadRequest(c, scope, c.req.valid('param').id);
      requireStatus(
        request.status,
        ['assigned', 'in_progress'],
        'Hanya permintaan yang sedang ditugaskan yang bisa ganti petugas.',
      );
      const ins = loadInseminatorFor(
        c,
        scope,
        c.req.valid('json').inseminatorId,
        farmer.locationId,
      );
      if (active?.inseminatorId === ins.id) throw conflict('Petugas ini sudah ditugaskan.');
      const time = c.var.now();
      c.var.db.transaction((tx) => {
        if (active) {
          tx.update(assignments)
            .set({
              endedAt: time,
              endReason: 'reassigned',
              updatedAt: time,
              deviceId: c.var.deviceId,
            })
            .where(eq(assignments.id, active.id))
            .run();
        }
        tx.insert(assignments)
          .values({
            ...newRow(c),
            serviceRequestId: request.id,
            inseminatorId: ins.id,
            assignedBy: scope.user.id,
            assignedAt: time,
            acceptedAt: null,
            endedAt: null,
            endReason: null,
          })
          .run();
        tx.update(serviceRequests)
          .set({ status: 'assigned', updatedAt: time, deviceId: c.var.deviceId })
          .where(eq(serviceRequests.id, request.id))
          .run();
      });
      return c.json(detail(c, request.id), 200);
    },
  );

  app.openapi(actionRoute('/api/service-requests/{id}/accept', 'Petugas menerima tugas'), (c) => {
    const scope = scopeOf(c);
    const { request, active } = loadRequest(c, scope, c.req.valid('param').id);
    if (scope.user.role !== 'inseminator' || active?.inseminatorId !== scope.user.id) {
      throw forbidden('Hanya petugas yang ditugaskan yang bisa menerima tugas ini.');
    }
    requireStatus(request.status, ['assigned'], 'Tugas ini sudah diterima atau sudah selesai.');
    const time = c.var.now();
    c.var.db.transaction((tx) => {
      tx.update(assignments)
        .set({ acceptedAt: time, updatedAt: time, deviceId: c.var.deviceId })
        .where(eq(assignments.id, active.id))
        .run();
      tx.update(serviceRequests)
        .set({ status: 'in_progress', updatedAt: time, deviceId: c.var.deviceId })
        .where(eq(serviceRequests.id, request.id))
        .run();
    });
    return c.json(detail(c, request.id), 200);
  });

  app.openapi(
    actionRouteWithBody(
      '/api/service-requests/{id}/reject',
      'Tolak permintaan dengan alasan (admin)',
      rejectSchema,
    ),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const { request } = loadRequest(c, scope, c.req.valid('param').id);
      requireStatus(
        request.status,
        ['submitted'],
        'Hanya permintaan yang baru diajukan yang bisa ditolak.',
      );
      const time = c.var.now();
      c.var.db
        .update(serviceRequests)
        .set({
          status: 'rejected',
          rejectionReason: c.req.valid('json').reason,
          updatedAt: time,
          deviceId: c.var.deviceId,
        })
        .where(eq(serviceRequests.id, request.id))
        .run();
      return c.json(detail(c, request.id), 200);
    },
  );

  app.openapi(
    actionRoute('/api/service-requests/{id}/cancel', 'Batalkan permintaan (pengaju atau admin)'),
    (c) => {
      const scope = scopeOf(c);
      const { request, active } = loadRequest(c, scope, c.req.valid('param').id);
      if (!isAdmin(scope.user) && request.requestedBy !== scope.user.id) {
        throw forbidden('Hanya pengaju atau admin yang bisa membatalkan permintaan.');
      }
      requireStatus(request.status, OPEN_STATUSES, 'Permintaan ini sudah selesai atau dibatalkan.');
      const time = c.var.now();
      c.var.db.transaction((tx) => {
        if (active) {
          tx.update(assignments)
            .set({
              endedAt: time,
              endReason: 'cancelled',
              updatedAt: time,
              deviceId: c.var.deviceId,
            })
            .where(eq(assignments.id, active.id))
            .run();
        }
        tx.update(serviceRequests)
          .set({ status: 'cancelled', updatedAt: time, deviceId: c.var.deviceId })
          .where(eq(serviceRequests.id, request.id))
          .run();
      });
      return c.json(detail(c, request.id), 200);
    },
  );
}
