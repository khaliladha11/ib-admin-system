// Penyimpanan lokal (IndexedDB lewat Dexie). Tabel cermin berisi baris persis seperti di server;
// `outbox` berisi perubahan yang belum terkirim; `meta` berisi status sinkron dan sesi.
// Komponen tidak membaca tabel ini langsung: pakai hook di `hooks.ts`.
import type {
  Animal,
  AnimalEvent,
  AnimalTag,
  Assignment,
  Farmer,
  Feedback,
  Location,
  AuditLog,
  PublicUser,
  QrCode,
  SemenStock,
  ServiceRequest,
  SyncReview,
  UserRole,
} from '@ib/shared';
import { Dexie, type Table } from 'dexie';

import type { OutboxEntry } from './outbox';

export const DEFAULT_DB_NAME = 'ib-admin';

/** Pengguna yang sedang masuk (disimpan agar aplikasi tetap tahu peran saat offline). */
export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  locationId: string | null;
}

export interface Session {
  user: SessionUser;
  /** Id peternak milik pengguna ber-peran farmer. */
  farmerId: string | null;
  /** Server latihan (DEMO_MODE=1): tampilkan pita "Mode latihan". */
  demoMode?: boolean;
}

export interface SyncState {
  /** Cursor pull berikutnya (posisi baris terakhir dari server; null = dari awal). */
  cursor: string | null;
  /** Sidik jari cakupan dari pull terakhir; berubah → server mengulang pull dari awal. */
  scope: string | null;
  lastSyncAt: number | null;
  /** Pesan kegagalan sinkron terakhir, atau null bila berhasil. */
  lastError: string | null;
  /** Server menjawab 401: pengguna harus masuk lagi sebelum sinkron jalan. */
  needsLogin: boolean;
}

/** PIN pembuka aplikasi: hanya hash PBKDF2, tidak pernah PIN aslinya. */
export interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
  /** Salah berturut-turut; PIN dihapus setelah batas tercapai. */
  failures: number;
}

/** Foto ternak, hanya di perangkat ini (belum dikirim ke server; Fase 4). */
export interface AnimalPhoto {
  animalId: string;
  data: ArrayBuffer;
  type: string;
  updatedAt: number;
}

export interface MetaValues {
  deviceId: string;
  session: Session;
  /** Akun pemilik data lokal; tetap tersimpan setelah keluar agar akun lain tidak melihatnya. */
  owner: {
    id: string;
    name: string;
    /** Penanda isi database server (berganti saat data demo direset); null di server biasa. */
    generation?: string | null;
  };
  pin: PinRecord;
  sync: SyncState;
}
export type MetaKey = keyof MetaValues;
export interface MetaRow<K extends MetaKey = MetaKey> {
  key: K;
  value: MetaValues[K];
}

/** Nama tabel cermin (sama dengan kunci respons GET /api/sync/changes). */
export const MIRROR_TABLES = [
  'locations',
  'farmers',
  'animals',
  'animalTags',
  'qrCodes',
  'events',
  'serviceRequests',
  'assignments',
  'semenStock',
  'users',
  'auditLogs',
  'syncReviews',
  'feedback',
] as const;
export type MirrorTable = (typeof MIRROR_TABLES)[number];

export interface MirrorRows {
  locations: Location;
  farmers: Farmer;
  animals: Animal;
  animalTags: AnimalTag;
  /** Kode QR yang dibuat pengguna ini (label tercetak). */
  qrCodes: QrCode;
  events: AnimalEvent;
  serviceRequests: ServiceRequest;
  assignments: Assignment;
  semenStock: SemenStock;
  /** Tanpa hash password (dari server). */
  users: PublicUser;
  /** Log aksi permintaan layanan (hanya admin). */
  auditLogs: AuditLog;
  /** Event "perlu dicek" yang disimpan server (milik pengguna; admin: wilayahnya). */
  syncReviews: SyncReview;
  /** Masukan peserta (milik sendiri; admin: wilayahnya). */
  feedback: Feedback;
}

/**
 * Catatan pemakaian anonim (langkah 5.1). HANYA di perangkat ini: tidak masuk outbox, tidak
 * pernah dikirim. Tanpa id pengguna, id ternak, atau teks isian.
 */
export interface UsageRow {
  seq?: number;
  kind: 'form_start' | 'form_done' | 'form_cancel' | 'screen';
  /** Nama form/layar, mis. "record", "request", "home". */
  name: string;
  /** Jenis event yang dicatat (BH, IB, …) untuk form_done form catat. */
  eventType?: string | null;
  /** Lama mengisi form (ms) untuk form_done/form_cancel. */
  durationMs?: number | null;
  at: number;
  /** Tanggal lokal YYYY-MM-DD. */
  day: string;
}

export class IbDb extends Dexie {
  locations!: Table<Location, string>;
  farmers!: Table<Farmer, string>;
  animals!: Table<Animal, string>;
  animalTags!: Table<AnimalTag, string>;
  qrCodes!: Table<QrCode, string>;
  events!: Table<AnimalEvent, string>;
  serviceRequests!: Table<ServiceRequest, string>;
  assignments!: Table<Assignment, string>;
  semenStock!: Table<SemenStock, string>;
  users!: Table<PublicUser, string>;
  auditLogs!: Table<AuditLog, string>;
  syncReviews!: Table<SyncReview, string>;
  feedback!: Table<Feedback, string>;
  usage!: Table<UsageRow, number>;
  outbox!: Table<OutboxEntry, number>;
  animalPhotos!: Table<AnimalPhoto, string>;
  meta!: Table<MetaRow, MetaKey>;

  constructor(name = DEFAULT_DB_NAME) {
    super(name);
    this.version(1).stores({
      locations: 'id, parentId, updatedAt',
      farmers: 'id, locationId, userId, name, updatedAt',
      animals: 'id, farmerId, damId, updatedAt',
      animalTags: 'id, animalId, [type+code], updatedAt',
      events: 'id, animalId, [animalId+occurredAt], serviceRequestId, updatedAt',
      serviceRequests: 'id, animalId, farmerId, status, updatedAt',
      assignments: 'id, serviceRequestId, inseminatorId, updatedAt',
      semenStock: 'id, holderId, updatedAt',
      // seq menjaga urutan FIFO; rowId untuk mencari baris yang masih menunggu kiriman.
      outbox: '++seq, &id, status, rowId',
      meta: 'key',
    });
    // v2 (langkah 2.2): foto ternak lokal.
    this.version(2).stores({ animalPhotos: 'animalId' });
    // v3 (langkah 2.3): pengguna dan log permintaan. Cursor diulang dari 0 agar
    // baris lama yang belum pernah ditarik ikut masuk.
    this.version(3)
      .stores({ users: 'id, role, locationId, updatedAt', auditLogs: 'id, rowId, updatedAt' })
      .upgrade(async (tx) => {
        await tx
          .table('meta')
          .where('key')
          .equals('sync')
          .modify((row: { value: { cursor: number } }) => {
            row.value.cursor = 0;
          });
      });
    // v4 (langkah 3.1): daftar kode QR milik pengguna. Cursor diulang agar kode lama ikut masuk.
    this.version(4)
      .stores({ qrCodes: 'id, code, issuedBy, updatedAt' })
      .upgrade(async (tx) => {
        await tx
          .table('meta')
          .where('key')
          .equals('sync')
          .modify((row: { value: { cursor: number } }) => {
            row.value.cursor = 0;
          });
      });
    // v5 (langkah 4.2): pull berhalaman (cursor teks + sidik jari cakupan) dan event
    // "perlu dicek" dari server. Pull diulang dari awal sekali.
    this.version(5)
      .stores({ syncReviews: 'id, userId, animalId, rowId, updatedAt' })
      .upgrade(async (tx) => {
        await tx
          .table('meta')
          .where('key')
          .equals('sync')
          .modify((row: { value: Record<string, unknown> }) => {
            row.value.cursor = null;
            row.value.scope = null;
          });
      });
    // v6 (langkah 5.1): masukan peserta (ikut sinkron) dan catatan pemakaian (lokal saja).
    // Pull diulang dari awal agar masukan lama ikut masuk ke HP admin.
    this.version(6)
      .stores({ feedback: 'id, userId, updatedAt', usage: '++seq, kind, at' })
      .upgrade(async (tx) => {
        await tx
          .table('meta')
          .where('key')
          .equals('sync')
          .modify((row: { value: Record<string, unknown> }) => {
            row.value.cursor = null;
            row.value.scope = null;
          });
      });
  }

  /** Tabel cermin berdasarkan nama (untuk kode yang memproses semua tabel, mis. pull). */
  mirror<T extends MirrorTable>(name: T): Table<MirrorRows[T], string> {
    return this[name] as unknown as Table<MirrorRows[T], string>;
  }

  async getMeta<K extends MetaKey>(key: K): Promise<MetaValues[K] | undefined> {
    const row = await this.meta.get(key);
    return row?.value as MetaValues[K] | undefined;
  }

  async setMeta<K extends MetaKey>(key: K, value: MetaValues[K]): Promise<void> {
    await this.meta.put({ key, value });
  }
}

export const INITIAL_SYNC_STATE: SyncState = {
  cursor: null,
  scope: null,
  lastSyncAt: null,
  lastError: null,
  needsLogin: false,
};
