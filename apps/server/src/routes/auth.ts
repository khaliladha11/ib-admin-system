import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { verifyPassword } from '../auth/password';
import { loadScope } from '../auth/scope';
import { endSession, requireUser, startSession, toAuthUser } from '../auth/session';
import { users } from '../db/schema';
import { ApiError, errorResponses } from '../http/errors';
import type { AppEnv } from '../http/env';
import { jsonBody, jsonContent, userDtoSchema } from '../http/schemas';

const loginBodySchema = z
  .object({
    /** Email atau nomor HP. */
    identifier: z.string().trim().min(1).max(150),
    password: z.string().min(1).max(200),
  })
  .openapi('LoginRequest');

const meSchema = z.object({ user: userDtoSchema, farmerId: z.string().nullable() }).openapi('Me');

const tags = ['Autentikasi'];

export function registerAuthRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/login',
      tags,
      summary: 'Masuk dengan email/no. HP dan password; memasang cookie sesi httpOnly',
      request: jsonBody(loginBodySchema),
      responses: {
        200: jsonContent(meSchema, 'Berhasil masuk'),
        400: errorResponses[400],
        401: errorResponses[401],
      },
    }),
    async (c) => {
      const { identifier, password } = c.req.valid('json');
      const phone = identifier.replace(/[\s-]/g, '');
      const row = c.var.db
        .select()
        .from(users)
        .where(
          and(
            or(sql`lower(${users.email}) = lower(${identifier})`, eq(users.phone, phone)),
            isNull(users.deletedAt),
          ),
        )
        .get();
      const valid = await verifyPassword(row?.isActive ? row.passwordHash : null, password);
      if (!row || !valid) {
        // Pesan sama untuk akun tidak ada dan password salah (DOMAIN.md S8).
        throw new ApiError(401, 'UNAUTHENTICATED', 'Email/nomor HP atau password salah.');
      }
      startSession(c, row.id);
      const user = toAuthUser(row);
      return c.json({ user, farmerId: loadScope(c.var.db, user).farmerId }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/logout',
      tags,
      summary: 'Keluar: menghapus sesi dan cookie',
      responses: { 204: { description: 'Berhasil keluar' } },
    }),
    (c) => {
      endSession(c);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/auth/me',
      tags,
      summary: 'Pengguna yang sedang masuk',
      security: [{ cookieAuth: [] }],
      responses: { 200: jsonContent(meSchema, 'Pengguna saat ini'), 401: errorResponses[401] },
    }),
    (c) => {
      const user = requireUser(c);
      return c.json({ user, farmerId: loadScope(c.var.db, user).farmerId }, 200);
    },
  );
}
