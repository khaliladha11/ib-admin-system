// Tanda "sudah dilaporkan ke iSIKHNAS" (langkah 6.3). Pesan SMS dibuat di HP (@ib/shared
// isikhnasMessages); server hanya menyimpan tanda per event agar semua perangkat tahu.
// Petugas dan admin yang bisa melihat ternaknya boleh menandai. Satu tanda per event: tanda kedua
// untuk event yang sama dijawab 200 dengan tanda yang sudah ada (aman dari dua HP).
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { isikhnasReportSchema } from '@ib/shared';
import { and, eq, isNull } from 'drizzle-orm';

import { requireRole } from '../auth/scope';
import { events, isikhnasReports } from '../db/schema';
import { errorResponses, notFound } from '../http/errors';
import type { AppEnv } from '../http/env';
import { jsonBody, jsonContent } from '../http/schemas';
import { assertNewId, loadAnimal, newRow, scopeOf } from './helpers';

export const isikhnasReportDtoSchema = z
  .object(isikhnasReportSchema.shape)
  .openapi('IsikhnasReport');

const markSchema = z
  .object({ id: z.uuid().optional(), eventId: z.uuid() })
  .openapi('MarkIsikhnasReported');

export function registerIsikhnasRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/isikhnas-reports',
      tags: ['iSIKHNAS'],
      security: [{ cookieAuth: [] }],
      summary: 'Tandai event sudah dilaporkan ke iSIKHNAS (petugas, admin)',
      request: jsonBody(markSchema),
      responses: {
        200: jsonContent(isikhnasReportDtoSchema, 'Sudah ditandai sebelumnya'),
        201: jsonContent(isikhnasReportDtoSchema, 'Ditandai'),
        ...errorResponses,
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ['inseminator', 'group_admin', 'agency_admin']);
      const body = c.req.valid('json');
      const { db } = c.var;
      const event = db
        .select()
        .from(events)
        .where(and(eq(events.id, body.eventId), isNull(events.deletedAt)))
        .get();
      if (!event) throw notFound('Catatan');
      loadAnimal(c, scope, event.animalId);
      if (body.id)
        assertNewId(
          !!db
            .select({ id: isikhnasReports.id })
            .from(isikhnasReports)
            .where(eq(isikhnasReports.id, body.id))
            .get(),
        );
      const existing = db
        .select()
        .from(isikhnasReports)
        .where(eq(isikhnasReports.eventId, event.id))
        .get();
      if (existing) return c.json(existing, 200);
      const row = {
        ...newRow(c, body.id),
        eventId: event.id,
        animalId: event.animalId,
        reportedBy: scope.user.id,
      };
      db.insert(isikhnasReports).values(row).run();
      return c.json(row, 201);
    },
  );
}
