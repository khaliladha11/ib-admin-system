import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { verifyPassword } from '../auth/password';
import { loadScope } from '../auth/scope';
import { endSession, requireUser, startSession, toAuthUser, type AuthUser } from '../auth/session';
import { users } from '../db/schema';
import { ApiError, errorResponses, tooManyResponse } from '../http/errors';
import type { AppEnv } from '../http/env';
import { jsonBody, jsonContent, userDtoSchema } from '../http/schemas';
import { dataGeneration } from '../ops/demo';
import type { AppContext } from './helpers';

const loginBodySchema = z
  .object({
    /** Email atau nomor HP. */
    identifier: z.string().trim().min(1).max(150),
    password: z.string().min(1).max(200),
  })
  .openapi('LoginRequest');

const meSchema = z
  .object({
    user: userDtoSchema,
    farmerId: z.string().nullable(),
    /** Penanda isi database (berganti saat data demo direset); null di server biasa. */
    generation: z.string().nullable(),
    /** Server latihan (DEMO_MODE=1). */
    demoMode: z.boolean(),
  })
  .openapi('Me');

/** Alamat pengirim: X-Forwarded-For dari Caddy (pos IB), selain itu alamat koneksi. */
function clientIp(c: AppContext): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming;
  return incoming?.socket?.remoteAddress ?? 'unknown';
}

function meOf(c: AppContext, user: AuthUser) {
  return {
    user,
    farmerId: loadScope(c.var.db, user).farmerId,
    generation: dataGeneration(c.var.db),
    demoMode: c.var.config.demoMode,
  };
}

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
        429: tooManyResponse,
      },
    }),
    async (c) => {
      const { identifier, password } = c.req.valid('json');
      const ip = clientIp(c);
      const limiter = c.var.loginLimiter;
      const wait = limiter.retryAfter(identifier, ip, c.var.now());
      if (wait !== null) {
        c.header('retry-after', String(wait));
        throw new ApiError(
          429,
          'TOO_MANY_REQUESTS',
          `Terlalu banyak percobaan masuk. Coba lagi dalam ${String(Math.ceil(wait / 60))} menit.`,
        );
      }
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
        limiter.failed(identifier, ip, c.var.now());
        // Pesan sama untuk akun tidak ada dan password salah (DOMAIN.md S8).
        throw new ApiError(401, 'UNAUTHENTICATED', 'Email/nomor HP atau password salah.');
      }
      limiter.succeeded(identifier, ip);
      startSession(c, row.id);
      const user = toAuthUser(row);
      return c.json(meOf(c, user), 200);
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
      return c.json(meOf(c, user), 200);
    },
  );
}
