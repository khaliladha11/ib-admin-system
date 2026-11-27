// Daftar nilai tetap yang dipakai skema Zod (shared) dan tabel Drizzle (server).
// Ubah di sini saja.

export const USER_ROLES = ['farmer', 'inseminator', 'group_admin', 'agency_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LOCATION_LEVELS = ['agency', 'group', 'village'] as const;
export type LocationLevel = (typeof LOCATION_LEVELS)[number];

export const ANIMAL_SEXES = ['F', 'M'] as const;
export type AnimalSex = (typeof ANIMAL_SEXES)[number];

export const TAG_TYPES = ['qr', 'eartag'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const TAG_REMOVAL_REASONS = ['lost', 'damaged', 'replaced', 'other'] as const;
export type TagRemovalReason = (typeof TAG_REMOVAL_REASONS)[number];

/** Kode event, selaras iSIKHNAS (BH, IB, PKB, KGG, LH, BB) + HEALTH, EXIT. */
export const EVENT_TYPES = ['BH', 'IB', 'PKB', 'KGG', 'LH', 'BB', 'HEALTH', 'EXIT'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SERVICE_REQUEST_TYPES = ['IB', 'PKB'] as const;
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number];

export const SERVICE_REQUEST_STATUSES = [
  'submitted',
  'assigned',
  'in_progress',
  'done',
  'rejected',
  'cancelled',
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const ASSIGNMENT_END_REASONS = ['completed', 'reassigned', 'declined', 'cancelled'] as const;
export type AssignmentEndReason = (typeof ASSIGNMENT_END_REASONS)[number];

export const AUDIT_ACTIONS = ['insert', 'update', 'delete', 'conflict'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Isi payload event
export const ESTRUS_SIGNS = [
  'lendir_bening',
  'gelisah',
  'menaiki_sapi_lain',
  'diam_dinaiki',
  'vulva_bengkak',
  'nafsu_makan_turun',
] as const;
export const PKB_RESULTS = ['pregnant', 'not_pregnant'] as const;
export const PKB_METHODS = ['palpation', 'usg'] as const;
export const CALF_CONDITIONS = ['alive', 'stillborn'] as const;
export const WEIGHT_METHODS = ['scale', 'tape'] as const;
export const EXIT_REASONS = ['died', 'sold', 'slaughtered', 'other'] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

/** device_id untuk baris yang dibuat server sendiri (bukan dari HP). */
export const SERVER_DEVICE_ID = 'server';

/** Bagian aplikasi yang dibahas di form masukan (langkah 5.1). */
export const FEEDBACK_TOPICS = ['general', 'record', 'animals', 'tasks', 'scan', 'sync', 'other'] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

/** Nilai wajah di form masukan: 1 = sulit/kecewa, 2 = biasa, 3 = mudah/senang. */
export const FEEDBACK_RATINGS = [1, 2, 3] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];
