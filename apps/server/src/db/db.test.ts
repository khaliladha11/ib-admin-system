import { EVENT_TYPES, SERVER_DEVICE_ID, uuidv7 } from '@ib/shared';
import { getTableName, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { countRows, createDb } from './client';
import { runMigrations } from './migrate';
import * as t from './schema';
import { buildSeedData, clearAllData, insertSeedData, SCENARIOS } from './seed';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 25, 3, 0, 0);

let ctx: ReturnType<typeof createDb>;

beforeEach(() => {
  ctx = createDb(':memory:');
  runMigrations(ctx.db);
});

afterEach(() => {
  ctx.sqlite.close();
});

describe('migrasi', () => {
  it('membuat semua tabel', () => {
    const tables = ctx.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%'",
      )
      .all()
      .map((r) => (r as { name: string }).name)
      .sort();
    expect(tables).toEqual(
      [
        'animal_tags',
        'animals',
        'assignments',
        'audit_logs',
        'events',
        'farmers',
        'feedback',
        'field_versions',
        'isikhnas_reports',
        'locations',
        'qr_codes',
        'semen_stock',
        'service_requests',
        'sessions',
        'sync_changes',
        'system_meta',
        'users',
      ].sort(),
    );
  });

  it('setiap tabel punya kolom umum (id, created_at, updated_at, deleted_at, device_id)', () => {
    for (const table of t.allTables) {
      const name = getTableName(table);
      // Tabel bantu waktu ubah per kolom (docs/SYNC.md §5): bukan data yang disinkronkan.
      // system_meta: nilai sistem kunci → teks (generasi data demo).
      if (name === 'field_versions' || name === 'system_meta') continue;
      const cols = ctx.sqlite
        .prepare(`PRAGMA table_info(${name})`)
        .all()
        .map((c) => (c as { name: string }).name);
      expect(cols, name).toEqual(
        expect.arrayContaining(['id', 'created_at', 'updated_at', 'deleted_at', 'device_id']),
      );
    }
  });
});

describe('constraint database', () => {
  const base = () => ({
    id: uuidv7(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    deviceId: SERVER_DEVICE_ID,
  });

  function seedMinimal() {
    const agency = {
      ...base(),
      parentId: null,
      level: 'agency' as const,
      name: 'Dinas',
      code: null,
    };
    const user = {
      ...base(),
      name: 'Petugas',
      email: null,
      phone: '081200000999',
      passwordHash: null,
      role: 'inseminator' as const,
      locationId: agency.id,
      isActive: true,
    };
    const farmer = {
      ...base(),
      userId: null,
      locationId: agency.id,
      name: 'Peternak',
      phone: null,
      address: null,
      isikhnasOwnerId: null,
    };
    const cow = {
      ...base(),
      farmerId: farmer.id,
      damId: null,
      name: 'Melati',
      sex: 'F' as const,
      breed: null,
      birthDate: null,
      sireCode: null,
      isikhnasAnimalId: null,
    };
    ctx.db.insert(t.locations).values(agency).run();
    ctx.db.insert(t.users).values(user).run();
    ctx.db.insert(t.farmers).values(farmer).run();
    ctx.db.insert(t.animals).values(cow).run();
    return { agency, user, farmer, cow };
  }

  it('menolak peran di luar daftar (CHECK)', () => {
    const { agency } = seedMinimal();
    expect(() =>
      ctx.sqlite
        .prepare(
          `INSERT INTO users (id, created_at, updated_at, device_id, name, email, role, location_id, is_active)
           VALUES (?, ?, ?, 'x', 'A', 'a@contoh.test', 'admin', ?, 1)`,
        )
        .run(uuidv7(), NOW, NOW, agency.id),
    ).toThrow(/CHECK constraint failed/);
  });

  it('menolak pengguna tanpa email dan nomor HP', () => {
    expect(() =>
      ctx.sqlite
        .prepare(
          `INSERT INTO users (id, created_at, updated_at, device_id, name, role, is_active)
           VALUES (?, ?, ?, 'x', 'A', 'farmer', 1)`,
        )
        .run(uuidv7(), NOW, NOW),
    ).toThrow(/CHECK constraint failed/);
  });

  it('kode tag tidak bisa dipakai dua kali, walau tag lama sudah dicabut', () => {
    const { cow } = seedMinimal();
    const tag = { animalId: cow.id, type: 'qr' as const, code: 'IB-7KQ2M', attachedAt: NOW };
    ctx.db
      .insert(t.animalTags)
      .values({ ...base(), ...tag, removedAt: NOW, removalReason: 'lost' })
      .run();
    expect(() =>
      ctx.db
        .insert(t.animalTags)
        .values({ ...base(), ...tag, removedAt: null, removalReason: null })
        .run(),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('stok straw hanya boleh ditautkan ke event IB', () => {
    const { user, cow } = seedMinimal();
    const stock = {
      ...base(),
      holderId: user.id,
      strawCode: 'S1',
      bullId: 'B1',
      bullName: null,
      breed: null,
      batch: 'X',
      quantityReceived: 10,
      receivedAt: '2026-11-01',
    };
    ctx.db.insert(t.semenStock).values(stock).run();
    expect(() =>
      ctx.db
        .insert(t.events)
        .values({
          ...base(),
          animalId: cow.id,
          type: 'BB',
          occurredAt: NOW,
          recordedBy: user.id,
          payload: { weightKg: 300 },
          serviceRequestId: null,
          semenStockId: stock.id,
          voidsEventId: null,
        })
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it('menolak payload yang bukan JSON', () => {
    const { user, cow } = seedMinimal();
    expect(() =>
      ctx.sqlite
        .prepare(
          `INSERT INTO events (id, created_at, updated_at, device_id, animal_id, type, occurred_at, recorded_by, payload)
           VALUES (?, ?, ?, 'x', ?, 'BH', ?, ?, 'bukan json')`,
        )
        .run(uuidv7(), NOW, NOW, cow.id, NOW, user.id),
    ).toThrow(/CHECK constraint failed/);
  });

  it('foreign key aktif', () => {
    expect(() =>
      ctx.db
        .insert(t.animals)
        .values({
          ...base(),
          farmerId: uuidv7(),
          damId: null,
          name: null,
          sex: 'F',
          breed: null,
          birthDate: null,
          sireCode: null,
          isikhnasAnimalId: null,
        })
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});

describe('data contoh (seed)', () => {
  const data = buildSeedData(NOW);

  it('jumlahnya sesuai permintaan langkah 1.2', () => {
    const level = (l: string) => data.locations.filter((x) => x.level === l).length;
    const role = (r: string) => data.users.filter((x) => x.role === r).length;
    expect(level('agency')).toBe(1);
    expect(level('group')).toBe(2);
    expect(role('inseminator')).toBe(3);
    expect(data.farmers).toHaveLength(10);
    expect(data.animals).toHaveLength(40);
  });

  it('deterministik untuk waktu yang sama', () => {
    expect(buildSeedData(NOW)).toEqual(data);
  });

  it('memuat setiap jenis event dan skenario', () => {
    expect(new Set(data.events.map((e) => e.type))).toEqual(new Set(EVENT_TYPES));
    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(data.events.some((e) => e.voidsEventId !== null)).toBe(true);
    expect(data.assignments.some((a) => a.endReason === 'reassigned')).toBe(true);
    expect(data.animalTags.some((tag) => tag.removedAt !== null)).toBe(true);
  });

  it('punya contoh untuk pengingat 3 bulan dan 9 bulan', () => {
    const eventsOf = (animalId: string) => data.events.filter((e) => e.animalId === animalId);
    const overdueIb = data.animals.some((a) => {
      const evs = eventsOf(a.id);
      const lastIb = evs.filter((e) => e.type === 'IB').at(-1);
      return (
        lastIb !== undefined &&
        NOW - lastIb.occurredAt > 90 * DAY &&
        !evs.some((e) => e.type === 'PKB' && e.occurredAt > lastIb.occurredAt)
      );
    });
    const overdueBirth = data.animals.some((a) => {
      const evs = eventsOf(a.id);
      const pregnant = evs
        .filter((e) => e.type === 'PKB' && e.payload.result === 'pregnant')
        .at(-1);
      return (
        pregnant !== undefined &&
        NOW - pregnant.occurredAt > 270 * DAY &&
        !evs.some(
          (e) => (e.type === 'LH' || e.type === 'KGG') && e.occurredAt > pregnant.occurredAt,
        )
      );
    });
    expect(overdueIb).toBe(true);
    expect(overdueBirth).toBe(true);
  });

  it('tidak ada tanggal di masa depan', () => {
    for (const e of data.events) expect(e.occurredAt).toBeLessThanOrEqual(NOW);
  });

  it('tersimpan utuh dan tidak melanggar foreign key', () => {
    insertSeedData(ctx.db, data);
    expect(countRows(ctx.db, t.animals)).toBe(40);
    expect(countRows(ctx.db, t.events)).toBe(data.events.length);
    expect(ctx.sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('payload JSON terbaca kembali sama persis', () => {
    insertSeedData(ctx.db, data);
    const lh = data.events.find((e) => e.type === 'LH');
    const row = ctx.db
      .select()
      .from(t.events)
      .where(sql`${t.events.id} = ${lh?.id ?? ''}`)
      .get();
    expect(row?.payload).toEqual(lh?.payload);
  });

  it('bisa dikosongkan lalu diisi ulang', () => {
    insertSeedData(ctx.db, data);
    clearAllData(ctx.db);
    expect(countRows(ctx.db, t.users)).toBe(0);
    insertSeedData(ctx.db, data);
    expect(countRows(ctx.db, t.users)).toBe(data.users.length);
  });
});
