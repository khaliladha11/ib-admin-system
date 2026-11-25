import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { compareReminders, computeSchedule, listReminders, REMINDER_KINDS } from '@ib/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { farmerScopeCondition } from '../auth/scope';
import { animals, farmers } from '../db/schema';
import { errorResponses } from '../http/errors';
import type { AppEnv } from '../http/env';
import { jsonContent } from '../http/schemas';
import { activeQrCodes, eventsOfAnimals, scopeOf, toDomainEvent } from './helpers';

const reminderItemSchema = z
  .object({
    kind: z.enum(REMINDER_KINDS),
    /** true untuk pengingat terlambat dari aturan skripsi (3 bulan / 9 bulan). */
    overdue: z.boolean(),
    dueAt: z.int(),
    overdueDays: z.int().nullable(),
    message: z.string(),
    animal: z.object({
      id: z.string(),
      name: z.string().nullable(),
      qrCode: z.string().nullable(),
      farmerId: z.string(),
      farmerName: z.string(),
      locationId: z.string(),
    }),
  })
  .openapi('Reminder');

export function registerReminderRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/reminders',
      tags: ['Pengingat'],
      security: [{ cookieAuth: [] }],
      summary: 'Pengingat terlambat dan jadwal dalam N hari ke depan untuk ternak dalam cakupan',
      description:
        'Dihitung dengan computeSchedule dari @ib/shared, tidak disimpan. Terlambat lebih dulu, lalu urut menurut tanggal.',
      request: {
        query: z.object({
          withinDays: z.coerce.number().int().min(0).max(90).default(7),
        }),
      },
      responses: {
        200: jsonContent(z.object({ items: z.array(reminderItemSchema) }), 'Pengingat'),
        401: errorResponses[401],
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { withinDays } = c.req.valid('query');
      const today = c.var.now();
      const rows = c.var.db
        .select({ animal: animals, farmer: farmers })
        .from(animals)
        .innerJoin(farmers, eq(farmers.id, animals.farmerId))
        .where(and(farmerScopeCondition(scope), isNull(animals.deletedAt), eq(animals.sex, 'F')))
        .orderBy(asc(animals.name))
        .all();
      const ids = rows.map((r) => r.animal.id);
      const eventMap = eventsOfAnimals(c.var.db, ids);
      const qr = activeQrCodes(c.var.db, ids);

      const items: z.infer<typeof reminderItemSchema>[] = [];
      for (const { animal, farmer } of rows) {
        const ref = {
          id: animal.id,
          name: animal.name,
          qrCode: qr.get(animal.id) ?? null,
          farmerId: farmer.id,
          farmerName: farmer.name,
          locationId: farmer.locationId,
        };
        const schedule = computeSchedule((eventMap.get(animal.id) ?? []).map(toDomainEvent), today);
        for (const item of listReminders(schedule, today, withinDays)) {
          items.push({ ...item, animal: ref });
        }
      }
      items.sort(compareReminders);
      return c.json({ items }, 200);
    },
  );
}
