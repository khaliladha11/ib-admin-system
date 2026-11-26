// Daftar kode QR (langkah 3.1). Kode dibuat di perangkat (juga saat offline) lalu dikirim
// lewat outbox; indeks unik `qr_codes.code` menjamin satu kode hanya untuk satu label.
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { QR_CODE_PATTERN, qrCodeSchema } from '@ib/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { requireUser } from '../auth/session';
import { qrCodes } from '../db/schema';
import { conflict, errorResponses } from '../http/errors';
import type { AppEnv } from '../http/env';
import { jsonBody, jsonContent, listOf } from '../http/schemas';
import { assertNewId, newRow, qrCodeTaken } from './helpers';

const qrCodeDtoSchema = z.object(qrCodeSchema.shape).openapi('QrCode');

const reserveSchema = z
  .object({
    id: z.uuid().optional(),
    code: z.string().regex(QR_CODE_PATTERN, 'Kode QR harus berformat IB-XXXXX'),
  })
  .openapi('ReserveQrCode');

const tags = ['Kode QR'];
const security = [{ cookieAuth: [] }];

export function registerQrCodeRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/qr-codes',
      tags,
      security,
      summary: 'Kode QR yang dibuat pengguna ini (label tercetak, termasuk yang belum dipasang)',
      responses: { 200: jsonContent(listOf(qrCodeDtoSchema), 'Daftar kode'), ...errorResponses },
    }),
    (c) => {
      const user = requireUser(c);
      const items = c.var.db
        .select()
        .from(qrCodes)
        .where(and(eq(qrCodes.issuedBy, user.id), isNull(qrCodes.deletedAt)))
        .orderBy(asc(qrCodes.createdAt))
        .all();
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/qr-codes',
      tags,
      security,
      summary: 'Daftarkan kode QR baru (dibuat di perangkat) sebelum atau sesudah label dicetak',
      description:
        'Kode yang sudah dipakai (oleh label lain atau tag ternak) dijawab 409 CONFLICT: label dengan ' +
        'kode itu jangan dipakai. Id yang sama dikirim ulang dijawab 409 ALREADY_EXISTS.',
      request: jsonBody(reserveSchema),
      responses: { 201: jsonContent(qrCodeDtoSchema, 'Kode terdaftar'), ...errorResponses },
    }),
    (c) => {
      const user = requireUser(c);
      const body = c.req.valid('json');
      const { db } = c.var;
      if (body.id)
        assertNewId(
          !!db.select({ id: qrCodes.id }).from(qrCodes).where(eq(qrCodes.id, body.id)).get(),
        );
      if (qrCodeTaken(db, body.code)) {
        throw conflict('Kode QR ini sudah dipakai label lain. Jangan pakai label ini.', {
          code: body.code,
        });
      }
      const row = { ...newRow(c, body.id), code: body.code, issuedBy: user.id };
      db.insert(qrCodes).values(row).run();
      return c.json(row, 201);
    },
  );
}
