// Langkah 4.3: cadangan, ekspor/impor, info pos, web dari origin yang sama, admin pertama.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { bootstrapDatabase } from '../db/bootstrap';
import { countRows, createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { farmers, locations, users } from '../db/schema';
import { registerWebApp } from '../http/web-app';
import {
  backupDue,
  backupName,
  createBackup,
  DAY_MS,
  listBackups,
  parseBackupTime,
  pruneBackups,
  restoreBackup,
} from '../ops/backup';
import { exportAll, importAll, toCsv } from '../ops/export';
import { crc32, zipFiles } from '../ops/zip';
import { createHarness, type Harness } from './api-harness';

const T = Date.UTC(2026, 10, 27, 2, 0, 0);
let tmp: string;
let h: Harness;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), 'ib-pos-'));
  h = await createHarness({
    backupDir: path.join(tmp, 'backups'),
    backupKeep: 14,
    publicUrl: 'https://192.168.1.10',
    certUrl: 'http://192.168.1.10/sertifikat',
  });
});
afterAll(() => {
  h.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('cadangan', () => {
  it('nama file berurutan waktu dan bisa dibaca balik', () => {
    expect(backupName(T)).toBe('ib-ternak-2026-11-27-020000.sqlite');
    expect(parseBackupTime(backupName(T))).toBe(T);
    expect(parseBackupTime('lain.sqlite')).toBeNull();
  });

  it('membuat cadangan yang bisa dibuka, menyimpan 14 terakhir', async () => {
    const { sqlite } = createDb(path.join(tmp, 'a.sqlite'));
    sqlite.exec("CREATE TABLE x (v TEXT); INSERT INTO x VALUES ('satu');");
    const dir = path.join(tmp, 'keep');
    for (let i = 0; i < 16; i++) await createBackup(sqlite, dir, T + i * DAY_MS, 14);
    const files = listBackups(dir);
    expect(files).toHaveLength(14);
    expect(files[0]?.name).toBe(backupName(T + 15 * DAY_MS)); // terbaru dulu
    expect(files.at(-1)?.name).toBe(backupName(T + 2 * DAY_MS));
    const copy = new Database(files[0]?.path ?? '', { readonly: true });
    expect(copy.prepare('SELECT v FROM x').get()).toEqual({ v: 'satu' });
    copy.close();
    // File lain di folder tidak ikut dihapus.
    writeFileSync(path.join(dir, 'catatan.txt'), 'x');
    expect(pruneBackups(dir, 1)).toHaveLength(13);
    expect(readFileSync(path.join(dir, 'catatan.txt'), 'utf8')).toBe('x');
    sqlite.close();
  });

  it('perlu cadangan bila belum ada atau yang terbaru ≥ 24 jam', async () => {
    const dir = path.join(tmp, 'due');
    expect(backupDue(dir, T)).toBe(true);
    const { sqlite } = createDb(':memory:');
    await createBackup(sqlite, dir, T, 14);
    expect(backupDue(dir, T + DAY_MS - 1)).toBe(false);
    expect(backupDue(dir, T + DAY_MS)).toBe(true);
    sqlite.close();
  });

  it('pulihkan: isi kembali seperti cadangan, database lama disimpan dulu', async () => {
    const dbFile = path.join(tmp, 'restore', 'ib.sqlite');
    mkdirSync(path.dirname(dbFile), { recursive: true });
    const first = createDb(dbFile);
    first.sqlite.exec("CREATE TABLE x (v TEXT); INSERT INTO x VALUES ('lama');");
    const backup = await createBackup(first.sqlite, path.join(tmp, 'restore-b'), T, 14);
    first.sqlite.exec("UPDATE x SET v = 'baru'");
    first.sqlite.close();

    const safety = restoreBackup(backup.path, dbFile, T + 1000);
    const again = new Database(dbFile, { readonly: true });
    expect(again.prepare('SELECT v FROM x').get()).toEqual({ v: 'lama' });
    again.close();
    const saved = new Database(safety ?? '', { readonly: true });
    expect(saved.prepare('SELECT v FROM x').get()).toEqual({ v: 'baru' });
    saved.close();
    expect(() => restoreBackup(path.join(tmp, 'tidak-ada.sqlite'), dbFile, T)).toThrow();
  });
});

describe('ekspor', () => {
  it('CSV: tanda kutip, koma, baris baru, JSON untuk objek', () => {
    expect(toCsv([{ a: 'x,y', b: 'kata "kutip"', c: null, d: { k: 1 } }])).toBe(
      'a,b,c,d\r\n"x,y","kata ""kutip""",,"{""k"":1}"\r\n',
    );
  });

  it('ZIP: CRC32 baku dan struktur yang bisa dibaca', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const zip = zipFiles([
      { name: 'a.csv', data: new TextEncoder().encode('x\r\n1\r\n') },
      { name: 'b.csv', data: new Uint8Array() },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const end = zip.subarray(zip.length - 22);
    expect(end.readUInt32LE(0)).toBe(0x06054b50);
    expect(end.readUInt16LE(10)).toBe(2);
  });

  it('hanya admin dinas; JSON lengkap, CSV tanpa hash password', async () => {
    expect((await (await h.as('groupAdmin1')).get('/api/system/export.json')).status).toBe(403);
    const agency = await h.as('agencyAdmin');
    const json = await agency.get('/api/system/export.json');
    expect(json.status).toBe(200);
    expect(json.headers.get('content-disposition')).toMatch(/attachment; filename="ib-ternak-/);
    expect(json.body).toMatchObject({ format: 'ib-ternak-export', version: 1 });
    expect(json.body.tables.farmers).toHaveLength(h.seed.farmers.length);
    expect(json.body.tables.users[0].passwordHash).toMatch(/^\$argon2/);
    expect(json.body.tables).not.toHaveProperty('sessions');

    const zip = await h.app.request('/api/system/export.zip', {
      headers: { cookie: await h.login('agencyAdmin') },
    });
    expect(zip.headers.get('content-type')).toBe('application/zip');
    const text = Buffer.from(await zip.arrayBuffer()).toString('utf8');
    expect(text).toContain('farmers.csv');
    expect(text).not.toContain('$argon2');
  });
});

describe('impor (gabung tanpa menimpa)', () => {
  it('ke database kosong: semua baris masuk; impor kedua: semua dilewati', () => {
    const data = exportAll(h.db, T);
    const target = createDb(':memory:');
    runMigrations(target.db);
    const first = importAll(target.db, data, T + 5);
    expect(first.farmers).toEqual({ added: h.seed.farmers.length, skipped: 0 });
    expect(first.events.added).toBe(data.tables.events.length);
    // Baris baru diberi updated_at sekarang agar ikut tertarik HP.
    expect(
      target.db
        .select()
        .from(farmers)
        .all()
        .every((f) => f.updatedAt === T + 5),
    ).toBe(true);
    const second = importAll(target.db, data, T + 9);
    expect(second.farmers).toEqual({ added: 0, skipped: h.seed.farmers.length });
    target.sqlite.close();
  });

  it('baris yang sudah ada tidak ditimpa', () => {
    const data = exportAll(h.db, T);
    const farmer = data.tables.farmers[0];
    if (!farmer) throw new Error('kosong');
    const changed = {
      ...data,
      tables: { ...data.tables, farmers: [{ ...farmer, name: 'Nama dari file' }] },
    };
    const counts = importAll(h.db, changed, T);
    expect(counts.farmers).toEqual({ added: 0, skipped: 1 });
    const row = h.db
      .select()
      .from(farmers)
      .where(eq(farmers.id, farmer.id as string))
      .get();
    expect(row?.name).not.toBe('Nama dari file');
  });

  it('lewat API: admin dinas, cadangan dibuat dulu, file salah ditolak', async () => {
    const agency = await h.as('agencyAdmin');
    expect((await agency.post('/api/system/import', { format: 'lain' })).status).toBe(409);
    expect((await (await h.as('groupAdmin1')).post('/api/system/import', {})).status).toBe(403);
    const exported = await agency.get('/api/system/export.json');
    const res = await agency.post('/api/system/import', exported.body);
    expect(res.status).toBe(200);
    expect(res.body.backup).toMatch(/^ib-ternak-.*\.sqlite$/);
    expect(res.body.counts.farmers.added).toBe(0);
  });
});

describe('info pos dan cadangan manual', () => {
  it('admin melihat alamat untuk HP, sertifikat, dan daftar cadangan', async () => {
    const res = await (await h.as('groupAdmin1')).get('/api/system/info');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      publicUrl: 'https://192.168.1.10',
      certUrl: 'http://192.168.1.10/sertifikat',
      backupKeep: 14,
    });
    expect(Array.isArray(res.body.addresses)).toBe(true);
    expect((await (await h.as('rina')).get('/api/system/info')).status).toBe(403);
  });

  it('cadangkan sekarang: admin dinas saja', async () => {
    expect((await (await h.as('groupAdmin1')).post('/api/system/backup')).status).toBe(403);
    const res = await (await h.as('agencyAdmin')).post('/api/system/backup');
    expect(res.status).toBe(201);
    const info = await (await h.as('agencyAdmin')).get('/api/system/info');
    expect(info.body.backups.map((b: { name: string }) => b.name)).toContain(res.body.name);
  });
});

describe('web dari origin yang sama', () => {
  it('berkas statis, rute aplikasi → index.html, /api tetap API', async () => {
    const dist = path.join(tmp, 'dist');
    mkdirSync(path.join(dist, 'assets'), { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>IB Ternak</title>');
    writeFileSync(path.join(dist, 'assets', 'app-abc.js'), 'console.log(1)');
    writeFileSync(path.join(dist, 'sw.js'), '//sw');
    const { db, sqlite } = createDb(':memory:');
    runMigrations(db);
    const app = createApp({ db });
    registerWebApp(app, dist);

    const asset = await app.request('/assets/app-abc.js');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await app.request('/sw.js')).headers.get('cache-control')).toBe('no-cache');
    const page = await app.request('/ternak/0193f000-0000-7000-8000-000000000001');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<title>IB Ternak</title>');
    expect((await app.request('/api/tidak-ada')).status).toBe(404);
    expect((await app.request('/api/health')).status).toBe(200);
    expect((await app.request('/tidak-ada.png')).status).toBe(404);
    sqlite.close();
  });
});

describe('pemasangan baru', () => {
  it('database kosong + ADMIN_EMAIL/ADMIN_PASSWORD → wilayah + admin dinas; sekali saja', async () => {
    const { db, sqlite } = createDb(':memory:');
    runMigrations(db);
    expect(await bootstrapDatabase(db, { ADMIN_EMAIL: 'a@b.c', ADMIN_PASSWORD: 'pendek' })).toBe(
      'skip',
    );
    const env = {
      ADMIN_EMAIL: 'Admin@Pos.Test',
      ADMIN_PASSWORD: 'rahasia-panjang',
      REGION_NAME: 'Kec. Contoh',
    };
    expect(await bootstrapDatabase(db, env, T)).toBe('admin');
    expect(db.select().from(users).all()).toMatchObject([
      { email: 'admin@pos.test', role: 'agency_admin', isActive: true },
    ]);
    expect(db.select().from(locations).all()).toMatchObject([
      { name: 'Kec. Contoh', level: 'agency' },
    ]);
    expect(await bootstrapDatabase(db, env, T)).toBe('skip');
    expect(countRows(db, users)).toBe(1);

    const app = createApp({ db, config: { cookieSecure: false } });
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@pos.test', password: 'rahasia-panjang' }),
    });
    expect(login.status).toBe(200);
    sqlite.close();
  });

  it('DEMO_DATA=1 mengisi data contoh fiktif', async () => {
    const { db, sqlite } = createDb(':memory:');
    runMigrations(db);
    expect(await bootstrapDatabase(db, { DEMO_DATA: '1' }, T)).toBe('demo');
    expect(countRows(db, farmers)).toBeGreaterThan(0);
    sqlite.close();
  });
});
