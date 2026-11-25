import { z } from 'zod';

import {
  ANIMAL_SEXES,
  ASSIGNMENT_END_REASONS,
  AUDIT_ACTIONS,
  LOCATION_LEVELS,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_TYPES,
  TAG_REMOVAL_REASONS,
  TAG_TYPES,
  USER_ROLES,
} from '../enums';
import { baseRowSchema, dateSchema, idSchema, requiredText, timestampSchema } from './common';

/** Format kode QR ternak: IB- + 5 karakter tanpa huruf/angka yang mirip (O/0, I/1). */
export const QR_CODE_PATTERN = /^IB-[2-9A-HJ-NP-Z]{5}$/;

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, 'Nomor HP hanya berisi angka (boleh diawali +)');

export const locationSchema = baseRowSchema.extend({
  parentId: idSchema.nullable(),
  level: z.enum(LOCATION_LEVELS),
  name: requiredText(150),
  code: z.string().trim().max(50).nullable(),
});

export const userSchema = baseRowSchema
  .extend({
    name: requiredText(150),
    email: z.email().nullable(),
    phone: phone.nullable(),
    /** Diisi saat login dibuat (langkah 1.4). */
    passwordHash: z.string().nullable(),
    role: z.enum(USER_ROLES),
    /** Cakupan akses: dinas, kelompok, atau desa. */
    locationId: idSchema.nullable(),
    isActive: z.boolean(),
  })
  .refine((u) => u.email !== null || u.phone !== null, {
    error: 'Pengguna wajib punya email atau nomor HP',
    path: ['email'],
  });

export const farmerSchema = baseRowSchema.extend({
  /** Akun login peternak, bila ada. */
  userId: idSchema.nullable(),
  locationId: idSchema,
  name: requiredText(150),
  phone: phone.nullable(),
  address: z.string().trim().max(300).nullable(),
  isikhnasOwnerId: z.string().trim().max(50).nullable(),
});

export const animalSchema = baseRowSchema.extend({
  farmerId: idSchema,
  /** Induk, bila tercatat. */
  damId: idSchema.nullable(),
  name: z.string().trim().max(100).nullable(),
  sex: z.enum(ANIMAL_SEXES),
  breed: z.string().trim().max(50).nullable(),
  birthDate: dateSchema.nullable(),
  sireCode: z.string().trim().max(50).nullable(),
  isikhnasAnimalId: z.string().trim().max(50).nullable(),
});

export const animalTagSchema = baseRowSchema
  .extend({
    animalId: idSchema,
    type: z.enum(TAG_TYPES),
    code: requiredText(50),
    attachedAt: timestampSchema,
    removedAt: timestampSchema.nullable(),
    removalReason: z.enum(TAG_REMOVAL_REASONS).nullable(),
  })
  .refine((t) => t.type !== 'qr' || QR_CODE_PATTERN.test(t.code), {
    error: 'Kode QR harus berformat IB-XXXXX',
    path: ['code'],
  })
  .refine((t) => (t.removedAt === null) === (t.removalReason === null), {
    error: 'Alasan cabut diisi bersamaan dengan waktu cabut',
    path: ['removalReason'],
  });

export const serviceRequestSchema = baseRowSchema.extend({
  farmerId: idSchema,
  animalId: idSchema,
  type: z.enum(SERVICE_REQUEST_TYPES),
  status: z.enum(SERVICE_REQUEST_STATUSES),
  requestedBy: idSchema,
  preferredDate: dateSchema.nullable(),
  notes: z.string().trim().max(1000).nullable(),
  rejectionReason: z.string().trim().max(500).nullable(),
  /** Event IB/PKB yang memenuhi permintaan ini. */
  resultEventId: idSchema.nullable(),
});

export const assignmentSchema = baseRowSchema
  .extend({
    serviceRequestId: idSchema,
    inseminatorId: idSchema,
    assignedBy: idSchema,
    assignedAt: timestampSchema,
    acceptedAt: timestampSchema.nullable(),
    endedAt: timestampSchema.nullable(),
    endReason: z.enum(ASSIGNMENT_END_REASONS).nullable(),
  })
  .refine((a) => (a.endedAt === null) === (a.endReason === null), {
    error: 'Alasan selesai diisi bersamaan dengan waktu selesai',
    path: ['endReason'],
  });

export const semenStockSchema = baseRowSchema.extend({
  /** Inseminator yang memegang straw. */
  holderId: idSchema,
  strawCode: requiredText(50),
  bullId: requiredText(50),
  bullName: z.string().trim().max(100).nullable(),
  breed: z.string().trim().max(50).nullable(),
  batch: requiredText(50),
  quantityReceived: z.int().positive(),
  receivedAt: dateSchema,
});

export const auditLogSchema = baseRowSchema.extend({
  actorId: idSchema.nullable(),
  tableName: requiredText(50),
  rowId: idSchema,
  action: z.enum(AUDIT_ACTIONS),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
});

export type Location = z.infer<typeof locationSchema>;
export type User = z.infer<typeof userSchema>;
export type Farmer = z.infer<typeof farmerSchema>;
export type Animal = z.infer<typeof animalSchema>;
export type AnimalTag = z.infer<typeof animalTagSchema>;
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type SemenStock = z.infer<typeof semenStockSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
