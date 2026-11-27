// Skema database (Drizzle + SQLite). Nama kolom di TypeScript camelCase,
// di database snake_case (opsi `casing: 'snake_case'`).
//
// Aturan umum (lihat docs/PLAN.md "Model data inti"):
// - id: UUIDv7 yang dibuat perangkat (lihat `uuidv7` di @ib/shared).
// - Cap waktu: INTEGER milidetik UTC. Tanggal tanpa jam: TEXT YYYY-MM-DD.
// - Setiap tabel punya created_at, updated_at, deleted_at (soft delete), device_id.
// - Status reproduksi ternak TIDAK disimpan; dihitung dari tabel events.
// - Enum didefinisikan di @ib/shared dan dijaga juga dengan CHECK di database.
import {
  ANIMAL_SEXES,
  ASSIGNMENT_END_REASONS,
  AUDIT_ACTIONS,
  EVENT_TYPES,
  FEEDBACK_TOPICS,
  LOCATION_LEVELS,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_TYPES,
  TAG_REMOVAL_REASONS,
  SYNC_CHANGE_KINDS,
  SYNC_RESULTS,
  SYNC_REVIEW_RESOLUTIONS,
  TAG_TYPES,
  USER_ROLES,
  type EventPayload,
} from '@ib/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

const baseColumns = {
  id: text().primaryKey(),
  createdAt: integer().notNull(),
  updatedAt: integer().notNull(),
  deletedAt: integer(),
  deviceId: text().notNull(),
};

/** CHECK (kolom IN (...)) agar nilai enum juga dijaga di database. */
function oneOf(name: string, column: AnySQLiteColumn, values: readonly string[]) {
  const list = sql.join(
    values.map((v) => sql.raw(`'${v.replaceAll("'", "''")}'`)),
    sql.raw(', '),
  );
  return check(name, sql`${column} IN (${list})`);
}

/** Indeks updated_at untuk pull sinkronisasi (langkah 4.2). */
function updatedAtIndex(table: string, column: AnySQLiteColumn) {
  return index(`${table}_updated_at_idx`).on(column);
}

export const locations = sqliteTable(
  'locations',
  {
    ...baseColumns,
    parentId: text().references((): AnySQLiteColumn => locations.id),
    level: text({ enum: LOCATION_LEVELS }).notNull(),
    name: text().notNull(),
    code: text(),
  },
  (t) => [
    oneOf('locations_level_check', t.level, LOCATION_LEVELS),
    index('locations_parent_idx').on(t.parentId),
    updatedAtIndex('locations', t.updatedAt),
  ],
);

export const users = sqliteTable(
  'users',
  {
    ...baseColumns,
    name: text().notNull(),
    email: text(),
    phone: text(),
    passwordHash: text(),
    role: text({ enum: USER_ROLES }).notNull(),
    locationId: text().references(() => locations.id),
    isActive: integer({ mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    oneOf('users_role_check', t.role, USER_ROLES),
    check('users_contact_check', sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`),
    uniqueIndex('users_email_unique').on(t.email),
    uniqueIndex('users_phone_unique').on(t.phone),
    updatedAtIndex('users', t.updatedAt),
  ],
);

export const farmers = sqliteTable(
  'farmers',
  {
    ...baseColumns,
    userId: text().references(() => users.id),
    locationId: text()
      .notNull()
      .references(() => locations.id),
    name: text().notNull(),
    phone: text(),
    address: text(),
    isikhnasOwnerId: text(),
  },
  (t) => [
    uniqueIndex('farmers_user_unique').on(t.userId),
    index('farmers_location_idx').on(t.locationId),
    updatedAtIndex('farmers', t.updatedAt),
  ],
);

export const animals = sqliteTable(
  'animals',
  {
    ...baseColumns,
    farmerId: text()
      .notNull()
      .references(() => farmers.id),
    damId: text().references((): AnySQLiteColumn => animals.id),
    name: text(),
    sex: text({ enum: ANIMAL_SEXES }).notNull(),
    breed: text(),
    birthDate: text(),
    sireCode: text(),
    isikhnasAnimalId: text(),
  },
  (t) => [
    oneOf('animals_sex_check', t.sex, ANIMAL_SEXES),
    index('animals_farmer_idx').on(t.farmerId),
    index('animals_dam_idx').on(t.damId),
    updatedAtIndex('animals', t.updatedAt),
  ],
);

export const animalTags = sqliteTable(
  'animal_tags',
  {
    ...baseColumns,
    animalId: text()
      .notNull()
      .references(() => animals.id),
    type: text({ enum: TAG_TYPES }).notNull(),
    code: text().notNull(),
    attachedAt: integer().notNull(),
    removedAt: integer(),
    removalReason: text({ enum: TAG_REMOVAL_REASONS }),
  },
  (t) => [
    oneOf('animal_tags_type_check', t.type, TAG_TYPES),
    oneOf('animal_tags_removal_reason_check', t.removalReason, TAG_REMOVAL_REASONS),
    check(
      'animal_tags_removed_check',
      sql`(${t.removedAt} IS NULL) = (${t.removalReason} IS NULL)`,
    ),
    // Kode tidak pernah dipakai ulang, termasuk setelah tag dicabut.
    uniqueIndex('animal_tags_type_code_unique').on(t.type, t.code),
    index('animal_tags_animal_idx').on(t.animalId),
    updatedAtIndex('animal_tags', t.updatedAt),
  ],
);

/**
 * Daftar kode QR yang pernah dibuat (label tercetak, termasuk label kosong). Kode dibuat
 * di perangkat; indeks unik di sini yang menjamin tidak ada dua label dengan kode sama.
 */
export const qrCodes = sqliteTable(
  'qr_codes',
  {
    ...baseColumns,
    code: text().notNull(),
    issuedBy: text()
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    uniqueIndex('qr_codes_code_unique').on(t.code),
    index('qr_codes_issued_by_idx').on(t.issuedBy),
    updatedAtIndex('qr_codes', t.updatedAt),
  ],
);

export const semenStock = sqliteTable(
  'semen_stock',
  {
    ...baseColumns,
    holderId: text()
      .notNull()
      .references(() => users.id),
    strawCode: text().notNull(),
    bullId: text().notNull(),
    bullName: text(),
    breed: text(),
    batch: text().notNull(),
    // Sisa stok = quantity_received - jumlah event IB yang menunjuk baris ini.
    quantityReceived: integer().notNull(),
    receivedAt: text().notNull(),
  },
  (t) => [
    check('semen_stock_quantity_check', sql`${t.quantityReceived} > 0`),
    index('semen_stock_holder_idx').on(t.holderId),
    updatedAtIndex('semen_stock', t.updatedAt),
  ],
);

export const serviceRequests = sqliteTable(
  'service_requests',
  {
    ...baseColumns,
    farmerId: text()
      .notNull()
      .references(() => farmers.id),
    animalId: text()
      .notNull()
      .references(() => animals.id),
    type: text({ enum: SERVICE_REQUEST_TYPES }).notNull(),
    status: text({ enum: SERVICE_REQUEST_STATUSES }).notNull(),
    requestedBy: text()
      .notNull()
      .references(() => users.id),
    preferredDate: text(),
    notes: text(),
    rejectionReason: text(),
    resultEventId: text().references((): AnySQLiteColumn => events.id),
  },
  (t) => [
    oneOf('service_requests_type_check', t.type, SERVICE_REQUEST_TYPES),
    oneOf('service_requests_status_check', t.status, SERVICE_REQUEST_STATUSES),
    index('service_requests_status_idx').on(t.status),
    index('service_requests_animal_idx').on(t.animalId),
    updatedAtIndex('service_requests', t.updatedAt),
  ],
);

export const events = sqliteTable(
  'events',
  {
    ...baseColumns,
    animalId: text()
      .notNull()
      .references(() => animals.id),
    type: text({ enum: EVENT_TYPES }).notNull(),
    /** Waktu kejadian sebenarnya. */
    occurredAt: integer().notNull(),
    recordedBy: text()
      .notNull()
      .references(() => users.id),
    /** Divalidasi dengan eventPayloadSchemas[type] dari @ib/shared sebelum disimpan. */
    payload: text({ mode: 'json' }).$type<EventPayload>().notNull(),
    serviceRequestId: text().references((): AnySQLiteColumn => serviceRequests.id),
    semenStockId: text().references(() => semenStock.id),
    voidsEventId: text().references((): AnySQLiteColumn => events.id),
  },
  (t) => [
    oneOf('events_type_check', t.type, EVENT_TYPES),
    check('events_payload_json_check', sql`json_valid(${t.payload})`),
    check('events_semen_ib_check', sql`${t.semenStockId} IS NULL OR ${t.type} = 'IB'`),
    index('events_animal_occurred_idx').on(t.animalId, t.occurredAt),
    index('events_voids_idx').on(t.voidsEventId),
    updatedAtIndex('events', t.updatedAt),
  ],
);

export const assignments = sqliteTable(
  'assignments',
  {
    ...baseColumns,
    serviceRequestId: text()
      .notNull()
      .references(() => serviceRequests.id),
    inseminatorId: text()
      .notNull()
      .references(() => users.id),
    assignedBy: text()
      .notNull()
      .references(() => users.id),
    assignedAt: integer().notNull(),
    acceptedAt: integer(),
    endedAt: integer(),
    endReason: text({ enum: ASSIGNMENT_END_REASONS }),
  },
  (t) => [
    oneOf('assignments_end_reason_check', t.endReason, ASSIGNMENT_END_REASONS),
    check('assignments_ended_check', sql`(${t.endedAt} IS NULL) = (${t.endReason} IS NULL)`),
    index('assignments_request_idx').on(t.serviceRequestId),
    index('assignments_inseminator_idx').on(t.inseminatorId),
    updatedAtIndex('assignments', t.updatedAt),
  ],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    ...baseColumns,
    actorId: text().references(() => users.id),
    tableName: text().notNull(),
    rowId: text().notNull(),
    action: text({ enum: AUDIT_ACTIONS }).notNull(),
    before: text({ mode: 'json' }).$type<Record<string, unknown>>(),
    after: text({ mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [
    oneOf('audit_logs_action_check', t.action, AUDIT_ACTIONS),
    index('audit_logs_row_idx').on(t.tableName, t.rowId),
    updatedAtIndex('audit_logs', t.updatedAt),
  ],
);

/**
 * Sesi login (cookie httpOnly). `id` adalah hash SHA-256 dari token di cookie,
 * sehingga isi tabel ini tidak bisa dipakai untuk login bila bocor.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    ...baseColumns,
    userId: text()
      .notNull()
      .references(() => users.id),
    expiresAt: integer().notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/**
 * Setiap perubahan yang dikirim lewat POST /api/sync/push (docs/SYNC.md §3). Kunci idempoten:
 * `id` = id entri outbox di HP. Perubahan yang ditolak (`rejected`) dan event yang perlu dicek
 * (`needs_review`) menyimpan isi aslinya di `payload` agar tidak hilang.
 */
export const syncChanges = sqliteTable(
  'sync_changes',
  {
    ...baseColumns,
    userId: text()
      .notNull()
      .references(() => users.id),
    kind: text({ enum: SYNC_CHANGE_KINDS }).notNull(),
    rowId: text(),
    /** Ternak yang terkait (event, tag), untuk cakupan admin. */
    animalId: text(),
    result: text({ enum: SYNC_RESULTS }).notNull(),
    code: text(),
    message: text(),
    payload: text({ mode: 'json' }).$type<Record<string, unknown>>(),
    resolvedAt: integer(),
    resolution: text({ enum: SYNC_REVIEW_RESOLUTIONS }),
  },
  (t) => [
    oneOf('sync_changes_kind_check', t.kind, SYNC_CHANGE_KINDS),
    oneOf('sync_changes_result_check', t.result, SYNC_RESULTS),
    oneOf('sync_changes_resolution_check', t.resolution, SYNC_REVIEW_RESOLUTIONS),
    index('sync_changes_user_idx').on(t.userId),
    index('sync_changes_review_idx').on(t.result, t.resolvedAt),
    index('sync_changes_row_idx').on(t.rowId),
    updatedAtIndex('sync_changes', t.updatedAt),
  ],
);

/**
 * Waktu ubah per kolom profil (peternak, ternak) untuk konflik per kolom (docs/SYNC.md §5).
 * Kolom tanpa baris di sini dianggap belum pernah diubah lewat aturan ini.
 */
export const fieldVersions = sqliteTable(
  'field_versions',
  {
    tableName: text().notNull(),
    rowId: text().notNull(),
    field: text().notNull(),
    /** Waktu ubah di HP (ms UTC, sudah dipotong agar tidak di masa depan). */
    changedAt: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tableName, t.rowId, t.field] })],
);

/** Masukan peserta uji coba (langkah 5.1). Tambah-saja; dibaca admin di wilayahnya. */
export const feedback = sqliteTable(
  'feedback',
  {
    ...baseColumns,
    userId: text()
      .notNull()
      .references(() => users.id),
    topic: text({ enum: FEEDBACK_TOPICS }).notNull(),
    /** 1 = sulit/kecewa, 2 = biasa, 3 = mudah/senang. */
    rating: integer().notNull(),
    text: text().notNull(),
  },
  (t) => [
    oneOf('feedback_topic_check', t.topic, FEEDBACK_TOPICS),
    check('feedback_rating_check', sql`${t.rating} BETWEEN 1 AND 3`),
    index('feedback_user_idx').on(t.userId),
    updatedAtIndex('feedback', t.updatedAt),
  ],
);

/**
 * Nilai sistem kecil (kunci → teks). `data_generation`: berganti setiap data demo direset,
 * agar HP tahu data lokalnya milik isi database yang lama (langkah 5.1).
 */
export const systemMeta = sqliteTable('system_meta', {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: integer().notNull(),
});

/** Urutan tabel untuk menghapus data (anak sebelum induk). */
export const allTables = [
  systemMeta,
  feedback,
  fieldVersions,
  syncChanges,
  sessions,
  auditLogs,
  assignments,
  events,
  serviceRequests,
  semenStock,
  animalTags,
  qrCodes,
  animals,
  farmers,
  users,
  locations,
] as const;
