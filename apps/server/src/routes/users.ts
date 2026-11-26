// Manajemen pengguna (admin kelompok/dinas). Online-only: menyangkut password dan hak akses.
// - Admin melihat pengguna di wilayahnya + petugas yang wilayah kerjanya mencakup wilayah admin.
// - Admin hanya bisa mengubah pengguna yang lokasinya di dalam wilayahnya.
// - Admin kelompok tidak bisa membuat/mengubah admin dinas; tidak ada yang bisa mengubah peran
//   atau menonaktifkan dirinya sendiri.
// - Akun peternak ditautkan ke data peternak (farmers.user_id).
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { phoneSchema, USER_ROLES, type UserRole } from '@ib/shared';
import { and, eq, isNull, or } from 'drizzle-orm';

import { hashPassword } from '../auth/password';
import { toAuthUser } from '../auth/session';
import { ADMIN_ROLES, coversLocation, requireRole, type Scope } from '../auth/scope';
import type { Db } from '../db/client';
import { farmers, sessions, users } from '../db/schema';
import { conflict, errorResponses, forbidden, notFound } from '../http/errors';
import type { AppEnv } from '../http/env';
import { idParamSchema, jsonBody, jsonContent, listOf, userDtoSchema } from '../http/schemas';
import { assertNewId, audit, changedFields, newRow, scopeOf, type AppContext } from './helpers';

export const MIN_PASSWORD_LENGTH = 8;

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password minimal ${String(MIN_PASSWORD_LENGTH)} karakter.`)
  .max(200);
const normalizePhone = (v: string) => v.replace(/[\s-]/g, '');
const phoneInput = z.string().transform(normalizePhone).pipe(phoneSchema);

const createUserSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(150),
    email: z.email().optional(),
    phone: phoneInput.optional(),
    role: z.enum(USER_ROLES),
    locationId: z.uuid(),
    password,
    /** Wajib untuk peran farmer: data peternak yang ditautkan ke akun ini. */
    farmerId: z.uuid().optional(),
  })
  .refine((u) => u.email !== undefined || u.phone !== undefined, {
    error: 'Isi email atau nomor HP.',
    path: ['phone'],
  })
  .openapi('CreateUser');

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.email().nullable(),
    phone: phoneInput.nullable(),
    role: z.enum(USER_ROLES),
    locationId: z.uuid(),
    isActive: z.boolean(),
  })
  .partial()
  .openapi('UpdateUser');

const resetPasswordSchema = z.object({ password }).openapi('ResetPassword');

const tags = ['Pengguna'];
const security = [{ cookieAuth: [] }];

/** Peran yang boleh dibuat/diberikan oleh admin ini. */
export function assignableRoles(role: UserRole): readonly UserRole[] {
  return role === 'agency_admin'
    ? ['farmer', 'inseminator', 'group_admin', 'agency_admin']
    : ['farmer', 'inseminator'];
}

/** Pengguna yang terlihat oleh admin (termasuk yang terhapus, untuk sinkron). */
export function visibleUsers(db: Db, scope: Scope) {
  return db
    .select()
    .from(users)
    .all()
    .filter(
      (u) =>
        u.id === scope.user.id ||
        (u.locationId !== null && scope.locationIds.has(u.locationId)) ||
        (u.role === 'inseminator' &&
          scope.user.locationId !== null &&
          coversLocation(scope, u.locationId, scope.user.locationId)),
    );
}

/** Tanpa hash password. */
const toDto = toAuthUser;

function loadEditable(c: AppContext, scope: Scope, id: string) {
  const row = c.var.db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .get();
  if (!row || !visibleUsers(c.var.db, scope).some((u) => u.id === id)) throw notFound('Pengguna');
  if (row.locationId === null || !scope.locationIds.has(row.locationId)) {
    throw forbidden('Pengguna ini di luar wilayah Anda; hanya bisa diubah oleh admin dinas.');
  }
  if (!assignableRoles(scope.user.role).includes(row.role) && row.id !== scope.user.id) {
    throw forbidden('Anda tidak bisa mengubah pengguna dengan peran ini.');
  }
  return row;
}

function assertContactFree(
  db: Db,
  email: string | null | undefined,
  phone: string | null | undefined,
  exceptId?: string,
) {
  const clash = db
    .select({ id: users.id })
    .from(users)
    .where(
      or(email ? eq(users.email, email) : undefined, phone ? eq(users.phone, phone) : undefined),
    )
    .all()
    .find((u) => u.id !== exceptId);
  if ((email || phone) && clash) throw conflict('Email atau nomor HP ini sudah dipakai akun lain.');
}

export function registerUserRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/users',
      tags,
      security,
      summary: 'Daftar pengguna di wilayah admin (dan petugas yang melayani wilayah itu)',
      request: { query: z.object({ role: z.enum(USER_ROLES).optional() }) },
      responses: { 200: jsonContent(listOf(userDtoSchema), 'Pengguna'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const { role } = c.req.valid('query');
      const items = visibleUsers(c.var.db, scope)
        .filter((u) => u.deletedAt === null && (!role || u.role === role))
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
        .map(toDto);
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/users',
      tags,
      security,
      summary: 'Buat akun (admin). Akun peternak wajib ditautkan ke data peternak.',
      request: jsonBody(createUserSchema),
      responses: { 201: jsonContent(userDtoSchema, 'Pengguna dibuat'), ...errorResponses },
    }),
    async (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const body = c.req.valid('json');
      const { db } = c.var;
      if (!assignableRoles(scope.user.role).includes(body.role)) {
        throw forbidden('Anda tidak bisa membuat akun dengan peran ini.');
      }
      if (!scope.locationIds.has(body.locationId)) throw forbidden('Lokasi di luar wilayah Anda.');
      if (body.id)
        assertNewId(!!db.select({ id: users.id }).from(users).where(eq(users.id, body.id)).get());
      assertContactFree(db, body.email, body.phone);

      let farmer: typeof farmers.$inferSelect | undefined;
      if (body.role === 'farmer') {
        if (!body.farmerId) throw conflict('Pilih data peternak yang dibuatkan akun.');
        farmer = db
          .select()
          .from(farmers)
          .where(and(eq(farmers.id, body.farmerId), isNull(farmers.deletedAt)))
          .get();
        if (!farmer || !scope.locationIds.has(farmer.locationId)) throw notFound('Peternak');
        if (farmer.userId) throw conflict('Peternak ini sudah punya akun.');
      }

      const row = {
        ...newRow(c, body.id),
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        locationId: farmer?.locationId ?? body.locationId,
        isActive: true,
      };
      db.transaction((tx) => {
        tx.insert(users).values(row).run();
        if (farmer) {
          tx.update(farmers)
            .set({ userId: row.id, updatedAt: row.createdAt, deviceId: c.var.deviceId })
            .where(eq(farmers.id, farmer.id))
            .run();
        }
        audit(c, tx, {
          tableName: 'users',
          rowId: row.id,
          action: 'insert',
          before: null,
          after: { name: row.name, role: row.role, locationId: row.locationId },
        });
      });
      return c.json(toDto(row), 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/users/{id}',
      tags,
      security,
      summary: 'Ubah pengguna (nama, kontak, peran, lokasi, aktif/nonaktif)',
      request: { params: idParamSchema, ...jsonBody(updateUserSchema) },
      responses: { 200: jsonContent(userDtoSchema, 'Pengguna diperbarui'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const before = loadEditable(c, scope, c.req.valid('param').id);
      const patch = c.req.valid('json');
      const self = before.id === scope.user.id;
      if (self && ((patch.role && patch.role !== before.role) || patch.isActive === false)) {
        throw forbidden('Anda tidak bisa mengubah peran atau menonaktifkan akun sendiri.');
      }
      if (patch.role && !assignableRoles(scope.user.role).includes(patch.role)) {
        throw forbidden('Anda tidak bisa memberi peran ini.');
      }
      if (patch.locationId && !scope.locationIds.has(patch.locationId)) {
        throw forbidden('Lokasi di luar wilayah Anda.');
      }
      const email = patch.email === undefined ? before.email : patch.email;
      const phone = patch.phone === undefined ? before.phone : patch.phone;
      if (!email && !phone) throw conflict('Pengguna wajib punya email atau nomor HP.');
      assertContactFree(c.var.db, patch.email, patch.phone, before.id);

      const diff = changedFields(before, patch);
      if (!diff.changed) return c.json(toDto(before), 200);
      const time = c.var.now();
      c.var.db.transaction((tx) => {
        tx.update(users)
          .set({ ...patch, updatedAt: time, deviceId: c.var.deviceId })
          .where(eq(users.id, before.id))
          .run();
        // Dinonaktifkan: semua sesi login akun itu berakhir.
        if (patch.isActive === false)
          tx.delete(sessions).where(eq(sessions.userId, before.id)).run();
        audit(c, tx, {
          tableName: 'users',
          rowId: before.id,
          action: 'update',
          before: diff.before,
          after: diff.after,
        });
      });
      const row = c.var.db.select().from(users).where(eq(users.id, before.id)).get();
      if (!row) throw notFound('Pengguna');
      return c.json(toDto(row), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/users/{id}/password',
      tags,
      security,
      summary: 'Atur ulang password (admin). Semua sesi akun itu berakhir.',
      request: { params: idParamSchema, ...jsonBody(resetPasswordSchema) },
      responses: { 204: { description: 'Password diganti' }, ...errorResponses },
    }),
    async (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const target = loadEditable(c, scope, c.req.valid('param').id);
      const passwordHash = await hashPassword(c.req.valid('json').password);
      const time = c.var.now();
      c.var.db.transaction((tx) => {
        tx.update(users)
          .set({ passwordHash, updatedAt: time, deviceId: c.var.deviceId })
          .where(eq(users.id, target.id))
          .run();
        tx.delete(sessions).where(eq(sessions.userId, target.id)).run();
        audit(c, tx, {
          tableName: 'users',
          rowId: target.id,
          action: 'update',
          before: null,
          after: { passwordReset: true },
        });
      });
      return c.body(null, 204);
    },
  );
}
