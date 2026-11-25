import { createHash, randomBytes } from 'node:crypto';

import type { User } from '@ib/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';
import { unauthenticated } from '../http/errors';
import type { AppEnv } from '../http/env';

export const SESSION_COOKIE = 'ib_session';
const DAY_MS = 86_400_000;

/** Pengguna tanpa hash password (yang boleh dikirim ke klien). */
export type AuthUser = Omit<User, 'passwordHash'>;

export function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deviceId: row.deviceId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    locationId: row.locationId,
    isActive: row.isActive,
  };
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Buat sesi baru dan pasang cookie httpOnly. */
export function startSession(c: Context<AppEnv>, userId: string) {
  const { db, config, now, deviceId } = c.var;
  const token = randomBytes(32).toString('base64url');
  const time = now();
  const expiresAt = time + config.sessionTtlDays * DAY_MS;
  db.insert(sessions)
    .values({
      id: hashToken(token),
      createdAt: time,
      updatedAt: time,
      deletedAt: null,
      deviceId,
      userId,
      expiresAt,
    })
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: config.sessionTtlDays * 86_400,
  });
}

/** Hapus sesi saat ini (logout). */
export function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token)
    c.var.db
      .delete(sessions)
      .where(eq(sessions.id, hashToken(token)))
      .run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

function findSessionUser(db: Db, token: string, now: number): AuthUser | null {
  const row = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, hashToken(token)),
        gt(sessions.expiresAt, now),
        isNull(sessions.deletedAt),
        isNull(users.deletedAt),
        eq(users.isActive, true),
      ),
    )
    .get();
  return row ? toAuthUser(row.user) : null;
}

/** Middleware: isi c.var.user bila cookie sesi valid (tidak menolak permintaan). */
export const loadSessionUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  c.set('user', token ? findSessionUser(c.var.db, token, c.var.now()) : null);
  await next();
};

/** Ambil pengguna yang sedang masuk, atau lempar 401. */
export function requireUser(c: Context<AppEnv>): AuthUser {
  const user = c.var.user;
  if (!user) throw unauthenticated();
  return user;
}
