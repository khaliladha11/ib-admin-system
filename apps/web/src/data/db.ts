// Penyimpanan lokal (IndexedDB lewat Dexie). Tabel cermin berisi baris persis seperti di server;
// `outbox` berisi perubahan yang belum terkirim; `meta` berisi status sinkron dan sesi.
// Komponen tidak membaca tabel ini langsung: pakai hook di `hooks.ts`.
import type {
  Animal,
  AnimalEvent,
  AnimalTag,
  Assignment,
  Farmer,
  Location,
  SemenStock,
  ServiceRequest,
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
}

export interface SyncState {
  /** Cursor pull berikutnya (`serverTime` dari server). */
  cursor: number;
  lastSyncAt: number | null;
  /** Pesan kegagalan sinkron terakhir, atau null bila berhasil. */
  lastError: string | null;
  /** Server menjawab 401: pengguna harus masuk lagi sebelum sinkron jalan. */
  needsLogin: boolean;
}

export interface MetaValues {
  deviceId: string;
  session: Session;
  /** Akun pemilik data lokal; tetap tersimpan setelah keluar agar akun lain tidak melihatnya. */
  owner: { id: string; name: string };
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
  'events',
  'serviceRequests',
  'assignments',
  'semenStock',
] as const;
export type MirrorTable = (typeof MIRROR_TABLES)[number];

export interface MirrorRows {
  locations: Location;
  farmers: Farmer;
  animals: Animal;
  animalTags: AnimalTag;
  events: AnimalEvent;
  serviceRequests: ServiceRequest;
  assignments: Assignment;
  semenStock: SemenStock;
}

export class IbDb extends Dexie {
  locations!: Table<Location, string>;
  farmers!: Table<Farmer, string>;
  animals!: Table<Animal, string>;
  animalTags!: Table<AnimalTag, string>;
  events!: Table<AnimalEvent, string>;
  serviceRequests!: Table<ServiceRequest, string>;
  assignments!: Table<Assignment, string>;
  semenStock!: Table<SemenStock, string>;
  outbox!: Table<OutboxEntry, number>;
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
  cursor: 0,
  lastSyncAt: null,
  lastError: null,
  needsLogin: false,
};
