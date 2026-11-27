import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { farmerSchema } from '@ib/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { ADMIN_ROLES, farmerScopeCondition, requireRole } from '../auth/scope';
import { animals, farmers } from '../db/schema';
import { conflict, errorResponses, forbidden } from '../http/errors';
import type { AppEnv } from '../http/env';
import { farmerDtoSchema, idParamSchema, jsonBody, jsonContent, listOf } from '../http/schemas';
import { assertNewId, audit, loadFarmer, newRow, scopeOf, updateProfile } from './helpers';

const editable = z.object(
  farmerSchema.pick({
    locationId: true,
    name: true,
    phone: true,
    address: true,
    isikhnasOwnerId: true,
  }).shape,
);

const createFarmerSchema = editable
  .partial({ phone: true, address: true, isikhnasOwnerId: true })
  .extend({ id: z.uuid().optional() })
  .openapi('CreateFarmer');
const updateFarmerSchema = editable.partial().openapi('UpdateFarmer');

const tags = ['Peternak'];
const security = [{ cookieAuth: [] }];

export function registerFarmerRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/farmers',
      tags,
      security,
      summary: 'Daftar peternak dalam cakupan pengguna',
      request: { query: z.object({ locationId: z.uuid().optional() }) },
      responses: {
        200: jsonContent(listOf(farmerDtoSchema), 'Daftar peternak'),
        401: errorResponses[401],
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { locationId } = c.req.valid('query');
      const items = c.var.db
        .select()
        .from(farmers)
        .where(
          and(
            farmerScopeCondition(scope),
            isNull(farmers.deletedAt),
            locationId ? eq(farmers.locationId, locationId) : undefined,
          ),
        )
        .orderBy(asc(farmers.name))
        .all();
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/farmers/{id}',
      tags,
      security,
      summary: 'Detail peternak',
      request: { params: idParamSchema },
      responses: { 200: jsonContent(farmerDtoSchema, 'Peternak'), ...errorResponses },
    }),
    (c) => c.json(loadFarmer(c, scopeOf(c), c.req.valid('param').id), 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/farmers',
      tags,
      security,
      summary: 'Tambah peternak (admin kelompok/dinas)',
      request: jsonBody(createFarmerSchema),
      responses: { 201: jsonContent(farmerDtoSchema, 'Peternak dibuat'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const body = c.req.valid('json');
      if (!scope.locationIds.has(body.locationId)) {
        throw forbidden('Lokasi di luar wilayah Anda.');
      }
      if (body.id) {
        assertNewId(
          !!c.var.db.select({ id: farmers.id }).from(farmers).where(eq(farmers.id, body.id)).get(),
        );
      }
      const row = {
        ...newRow(c, body.id),
        userId: null,
        locationId: body.locationId,
        name: body.name,
        phone: body.phone ?? null,
        address: body.address ?? null,
        isikhnasOwnerId: body.isikhnasOwnerId ?? null,
      };
      c.var.db.transaction((tx) => {
        tx.insert(farmers).values(row).run();
        audit(c, tx, {
          tableName: 'farmers',
          rowId: row.id,
          action: 'insert',
          before: null,
          after: { name: row.name },
        });
      });
      return c.json(row, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/farmers/{id}',
      tags,
      security,
      summary: 'Ubah data peternak (admin kelompok/dinas)',
      request: { params: idParamSchema, ...jsonBody(updateFarmerSchema) },
      responses: { 200: jsonContent(farmerDtoSchema, 'Peternak diperbarui'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const farmer = loadFarmer(c, scope, c.req.valid('param').id);
      requireRole(scope.user, ADMIN_ROLES);
      const patch = c.req.valid('json');
      if (patch.locationId && !scope.locationIds.has(patch.locationId)) {
        throw forbidden('Lokasi di luar wilayah Anda.');
      }
      const { row: updated } = updateProfile(c, farmers, 'farmers', farmer, patch);
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/farmers/{id}',
      tags,
      security,
      summary: 'Hapus peternak (soft delete; hanya bila tidak punya ternak)',
      request: { params: idParamSchema },
      responses: { 204: { description: 'Dihapus' }, ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const farmer = loadFarmer(c, scope, c.req.valid('param').id);
      requireRole(scope.user, ADMIN_ROLES);
      const hasAnimals = c.var.db
        .select({ id: animals.id })
        .from(animals)
        .where(and(eq(animals.farmerId, farmer.id), isNull(animals.deletedAt)))
        .get();
      if (hasAnimals)
        throw conflict('Peternak masih punya ternak; pindahkan atau hapus ternaknya dulu.');
      const time = c.var.now();
      c.var.db.transaction((tx) => {
        tx.update(farmers)
          .set({ deletedAt: time, updatedAt: time, deviceId: c.var.deviceId })
          .where(eq(farmers.id, farmer.id))
          .run();
        audit(c, tx, {
          tableName: 'farmers',
          rowId: farmer.id,
          action: 'delete',
          before: { name: farmer.name },
          after: null,
        });
      });
      return c.body(null, 204);
    },
  );
}
