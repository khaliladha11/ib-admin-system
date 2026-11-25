// Skema respons API (untuk validasi tipe dan dokumentasi OpenAPI).
// Skema entitas memakai skema Zod dari @ib/shared agar satu sumber kebenaran.
import { z } from '@hono/zod-openapi';
import {
  animalSchema,
  animalTagSchema,
  assignmentSchema,
  baseRowSchema,
  EVENT_TYPES,
  farmerSchema,
  serviceRequestSchema,
  USER_ROLES,
  type ReproStatus,
} from '@ib/shared';

export const idParamSchema = z.object({
  id: z.uuid().openapi({
    param: { name: 'id', in: 'path' },
    example: '0193f000-0000-7000-8000-000000000001',
  }),
});

// Catatan: skema dari @ib/shared dibuat sebelum @hono/zod-openapi menambahkan .openapi(),
// jadi shape-nya dibungkus ulang dengan z dari @hono/zod-openapi sebelum diberi nama.

export const userDtoSchema = z
  .object({
    ...baseRowSchema.shape,
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    role: z.enum(USER_ROLES),
    locationId: z.string().nullable(),
    isActive: z.boolean(),
  })
  .openapi('User');

export const farmerDtoSchema = z.object(farmerSchema.shape).openapi('Farmer');
export const tagDtoSchema = z.object(animalTagSchema.shape).openapi('AnimalTag');
export const serviceRequestDtoSchema = z
  .object(serviceRequestSchema.shape)
  .openapi('ServiceRequest');
export const assignmentDtoSchema = z.object(assignmentSchema.shape).openapi('Assignment');

export const REPRO_STATUS_KINDS = [
  'kosong',
  'birahi',
  'sudah_IB_menunggu_PKB',
  'bunting',
  'keguguran',
  'sudah_lahir',
  'keluar',
] as const satisfies readonly ReproStatus['kind'][];

export const reproStatusDtoSchema = z
  .object({
    kind: z.enum(REPRO_STATUS_KINDS),
    /** Event terakhir yang menentukan status. */
    eventId: z.string().nullable(),
    serviceNumber: z.int().optional(),
    conceptionAt: z.int().optional(),
    gestationDays: z.int().optional(),
    gestationMonths: z.int().optional(),
  })
  .openapi('ReproStatus');

export type ReproStatusDto = z.infer<typeof reproStatusDtoSchema>;

export function toStatusDto(status: ReproStatus): ReproStatusDto {
  const dto: ReproStatusDto = { kind: status.kind, eventId: status.event?.id ?? null };
  if (status.kind === 'sudah_IB_menunggu_PKB') dto.serviceNumber = status.serviceNumber;
  if (status.kind === 'bunting') {
    Object.assign(dto, {
      serviceNumber: status.serviceNumber,
      conceptionAt: status.conceptionAt,
      gestationDays: status.gestationDays,
      gestationMonths: status.gestationMonths,
    });
  }
  return dto;
}

export const animalDtoSchema = z
  .object({
    ...animalSchema.shape,
    status: reproStatusDtoSchema,
    /** Kode QR yang sedang terpasang. */
    qrCode: z.string().nullable(),
  })
  .openapi('Animal');

export const eventDtoSchema = z
  .object({
    ...baseRowSchema.shape,
    animalId: z.string(),
    type: z.enum(EVENT_TYPES),
    occurredAt: z.int(),
    recordedBy: z.string(),
    payload: z.record(z.string(), z.unknown()),
    serviceRequestId: z.string().nullable(),
    semenStockId: z.string().nullable(),
    voidsEventId: z.string().nullable(),
  })
  .openapi('AnimalEvent');

export const listOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

export const jsonContent = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export const jsonBody = <T extends z.ZodType>(schema: T) => ({
  body: { content: { 'application/json': { schema } }, required: true },
});
