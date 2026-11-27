// Masukan peserta uji coba (langkah 5.1). Dibuat di HP (juga offline) lalu dikirim lewat outbox.
// Semua pengguna yang masuk boleh mengirim; admin membaca masukan pengguna di wilayahnya.
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { FEEDBACK_RATINGS, FEEDBACK_TOPICS, feedbackSchema } from '@ib/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { ADMIN_ROLES, requireRole } from '../auth/scope';
import { requireUser } from '../auth/session';
import { feedback } from '../db/schema';
import { errorResponses } from '../http/errors';
import type { AppEnv } from '../http/env';
import { jsonBody, jsonContent, listOf } from '../http/schemas';
import { inIds } from '../sync/visibility';
import { assertNewId, newRow, scopeOf } from './helpers';
import { visibleUsers } from './users';

export const feedbackDtoSchema = z.object(feedbackSchema.shape).openapi('Feedback');

const createFeedbackSchema = z
  .object({
    id: z.uuid().optional(),
    topic: z.enum(FEEDBACK_TOPICS),
    rating: z.int().min(1).max(FEEDBACK_RATINGS.length),
    text: z.string().trim().max(1000).default(''),
  })
  .openapi('CreateFeedback');

const tags = ['Masukan'];
const security = [{ cookieAuth: [] }];

export function registerFeedbackRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/feedback',
      tags,
      security,
      summary: 'Kirim masukan tentang aplikasi (semua peran)',
      description: 'Id yang sama dikirim ulang dijawab 409 ALREADY_EXISTS (aman dari outbox).',
      request: jsonBody(createFeedbackSchema),
      responses: { 201: jsonContent(feedbackDtoSchema, 'Masukan tersimpan'), ...errorResponses },
    }),
    (c) => {
      const user = requireUser(c);
      const body = c.req.valid('json');
      const { db } = c.var;
      if (body.id)
        assertNewId(
          !!db.select({ id: feedback.id }).from(feedback).where(eq(feedback.id, body.id)).get(),
        );
      const row = {
        ...newRow(c, body.id),
        userId: user.id,
        topic: body.topic,
        rating: body.rating,
        text: body.text,
      };
      db.insert(feedback).values(row).run();
      return c.json(row, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/feedback',
      tags,
      security,
      summary: 'Masukan dari pengguna di wilayah admin, terbaru dulu',
      responses: {
        200: jsonContent(listOf(feedbackDtoSchema), 'Daftar masukan'),
        ...errorResponses,
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      requireRole(scope.user, ADMIN_ROLES);
      const { db } = c.var;
      const ids = visibleUsers(db, scope).map((u) => u.id);
      const items = db
        .select()
        .from(feedback)
        .where(and(inIds(feedback.userId, ids), isNull(feedback.deletedAt)))
        .orderBy(desc(feedback.createdAt))
        .all();
      return c.json({ items }, 200);
    },
  );
}
