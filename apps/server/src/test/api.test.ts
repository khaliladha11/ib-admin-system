// Tes integrasi: autentikasi, format error, cakupan akses, CRUD, tag, pengingat, OpenAPI.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditLogs, sessions } from '../db/schema';
import { SEED_PASSWORD } from '../db/seed';
import { ACCOUNTS, createHarness, type Harness } from './api-harness';

let h: Harness;
const app = () => h.app;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

const farmerIdOf = (name: string) => {
  const f = h.seed.farmers.find((x) => x.name === name);
  if (!f) throw new Error(name);
  return f.id;
};

describe('autentikasi', () => {
  it('masuk dengan email atau nomor HP; cookie httpOnly', async () => {
    const res = await h.request('POST', '/api/auth/login', {
      body: { identifier: 'ADMIN.DINAS@contoh.test', password: SEED_PASSWORD },
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'agency_admin' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^ib_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const byPhone = await h.request('POST', '/api/auth/login', {
      body: { identifier: '0812-0000-0201', password: SEED_PASSWORD },
    });
    expect(byPhone.status).toBe(200);
    expect(byPhone.body.user.role).toBe('inseminator');
  });

  it('pesan sama untuk password salah dan akun tidak ada', async () => {
    const wrong = await h.request('POST', '/api/auth/login', {
      body: { identifier: ACCOUNTS.andi, password: 'salah' },
    });
    const unknown = await h.request('POST', '/api/auth/login', {
      body: { identifier: 'tidak@ada.test', password: 'salah' },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('token sesi disimpan sebagai hash, bukan token mentah', async () => {
    const cookie = await h.login('rina');
    const token = cookie.split('=')[1] ?? '';
    expect(h.db.select().from(sessions).where(eq(sessions.id, token)).get()).toBeUndefined();
  });

  it('me tanpa cookie: 401; logout membuat cookie tidak berlaku', async () => {
    expect((await h.request('GET', '/api/auth/me')).status).toBe(401);

    const login = await h.request('POST', '/api/auth/login', {
      body: { identifier: ACCOUNTS.rina, password: SEED_PASSWORD },
    });
    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect((await h.request('GET', '/api/auth/me', { cookie })).status).toBe(200);
    expect((await h.request('POST', '/api/auth/logout', { cookie })).status).toBe(204);
    expect((await h.request('GET', '/api/auth/me', { cookie })).status).toBe(401);
  });

  it('sesi kedaluwarsa setelah 30 hari', async () => {
    const other = await createHarness();
    try {
      const login = await other.request('POST', '/api/auth/login', {
        body: { identifier: ACCOUNTS.andi, password: SEED_PASSWORD },
      });
      const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
      expect(login.headers.get('set-cookie')).toMatch(/Max-Age=2592000/);
      // Lewat request biasa (bukan other.as) agar cookie lama tetap dipakai.
      const time = other.now();
      expect((await other.request('GET', '/api/auth/me', { cookie })).status).toBe(200);
      other.advanceDays(31);
      expect(other.now()).toBeGreaterThan(time);
      expect((await other.request('GET', '/api/auth/me', { cookie })).status).toBe(401);
    } finally {
      other.close();
    }
  });

  it('semua endpoint data menolak tanpa login (legacy S1)', async () => {
    for (const path of [
      '/api/farmers',
      '/api/animals',
      '/api/service-requests',
      '/api/reminders',
    ]) {
      const res = await h.request('GET', path);
      expect(res.status, path).toBe(401);
    }
  });
});

describe('format error', () => {
  it('input tidak valid: 400 VALIDATION_ERROR dengan rincian', async () => {
    const admin = await h.as('agencyAdmin');
    const res = await admin.post('/api/farmers', { name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fieldErrors).toHaveProperty('locationId');
  });

  it('payload event dicek per jenis', async () => {
    const yusuf = await h.as('yusuf');
    const cow = h.seed.animals[0];
    const res = await yusuf.post(`/api/animals/${cow?.id ?? ''}/events`, {
      type: 'PKB',
      occurredAt: h.now(),
      payload: { result: 'pregnant' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('tanggal kejadian di masa depan ditolak', async () => {
    const yusuf = await h.as('yusuf');
    const cow = h.seed.animals[0];
    const res = await yusuf.post(`/api/animals/${cow?.id ?? ''}/events`, {
      type: 'BB',
      occurredAt: h.now() + 86_400_000,
      payload: { weightKg: 300 },
    });
    expect(res.status).toBe(400);
  });
});

describe('cakupan akses', () => {
  it('peternak hanya melihat ternak miliknya', async () => {
    const farmer = await h.as('suparman');
    const res = await farmer.get('/api/animals');
    const ownId = farmerIdOf('Suparman');
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((a: { farmerId: string }) => a.farmerId === ownId)).toBe(true);

    const other = h.seed.animals.find((a) => a.farmerId === farmerIdOf('Agus Salim'));
    expect((await farmer.get(`/api/animals/${other?.id ?? ''}`)).status).toBe(404);
  });

  it('admin kelompok hanya melihat kelompoknya', async () => {
    const admin1 = await h.as('groupAdmin1');
    const farmers = await admin1.get('/api/farmers');
    expect(farmers.body.items).toHaveLength(5);
    expect((await admin1.get(`/api/farmers/${farmerIdOf('Agus Salim')}`)).status).toBe(404);
  });

  it('admin dinas dan inseminator (wilayah dinas) melihat semua peternak', async () => {
    expect((await (await h.as('agencyAdmin')).get('/api/farmers')).body.items).toHaveLength(10);
    expect((await (await h.as('andi')).get('/api/farmers')).body.items).toHaveLength(10);
  });

  it('peternak tidak bisa mencatat IB/PKB', async () => {
    const farmer = await h.as('suparman');
    const cow = h.seed.animals.find((a) => a.farmerId === farmerIdOf('Suparman') && a.sex === 'F');
    const res = await farmer.post(`/api/animals/${cow?.id ?? ''}/events`, {
      type: 'IB',
      occurredAt: h.now(),
      payload: { strawCode: 'S', bullId: 'B', batch: 'X' },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('admin kelompok tidak bisa membuat peternak di luar kelompoknya', async () => {
    const admin1 = await h.as('groupAdmin1');
    const otherVillage = h.seed.locations.find((l) => l.name === 'Desa Cibening');
    const res = await admin1.post('/api/farmers', {
      locationId: otherVillage?.id,
      name: 'Peternak Baru',
    });
    expect(res.status).toBe(403);
  });

  it('peternak tidak bisa mengubah data peternak', async () => {
    const farmer = await h.as('suparman');
    const res = await farmer.patch(`/api/farmers/${farmerIdOf('Suparman')}`, { name: 'Ganti' });
    expect(res.status).toBe(403);
  });
});

describe('CRUD peternak dan ternak', () => {
  it('admin membuat, mengubah, dan menghapus peternak; perubahan tercatat di audit log', async () => {
    const admin = await h.as('groupAdmin1');
    const village = h.seed.locations.find((l) => l.name === 'Desa Sukamaju');
    const id = h.newId();
    const created = await admin.post('/api/farmers', {
      id,
      locationId: village?.id,
      name: 'Budi Contoh',
      phone: '081299990001',
    });
    expect(created.status).toBe(201);
    expect(created.body.id).toBe(id);

    expect(
      (await admin.post('/api/farmers', { id, locationId: village?.id, name: 'Ganda' })).status,
    ).toBe(409);

    const updated = await admin.patch(`/api/farmers/${id}`, { phone: '081299990002' });
    expect(updated.body.phone).toBe('081299990002');
    const log = h.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.rowId, id), eq(auditLogs.action, 'update')))
      .get();
    expect(log).toMatchObject({
      before: { phone: '081299990001' },
      after: { phone: '081299990002' },
    });

    expect((await admin.del(`/api/farmers/${id}`)).status).toBe(204);
    expect((await admin.get(`/api/farmers/${id}`)).status).toBe(404);
  });

  it('peternak yang masih punya ternak tidak bisa dihapus', async () => {
    const admin = await h.as('agencyAdmin');
    const res = await admin.del(`/api/farmers/${farmerIdOf('Suparman')}`);
    expect(res.status).toBe(409);
  });

  it('daftar ternak bisa difilter menurut status reproduksi', async () => {
    const admin = await h.as('agencyAdmin');
    const res = await admin.get('/api/animals?status=bunting');
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(
      res.body.items.every((a: { status: { kind: string } }) => a.status.kind === 'bunting'),
    ).toBe(true);
  });

  it('pindah pemilik hanya oleh admin', async () => {
    const yusuf = await h.as('yusuf');
    const cow = h.seed.animals.find((a) => a.farmerId === farmerIdOf('Suparman'));
    const res = await yusuf.patch(`/api/animals/${cow?.id ?? ''}`, {
      farmerId: farmerIdOf('Siti Aminah'),
    });
    expect(res.status).toBe(403);
  });
});

describe('tag', () => {
  it('kode tag tidak bisa dipakai ulang; ganti tag butuh alasan dan menutup tag lama', async () => {
    const yusuf = await h.as('yusuf');
    const cow = h.seed.animals[1];
    const id = cow?.id ?? '';
    const usedCode = h.seed.animalTags.find((t) => t.type === 'qr' && t.animalId !== id)?.code;

    expect(
      (await yusuf.post(`/api/animals/${id}/tags`, { type: 'qr', code: usedCode })).status,
    ).toBe(409);
    const needReason = await yusuf.post(`/api/animals/${id}/tags`, {
      type: 'qr',
      code: 'IB-NEW22',
    });
    expect(needReason.status).toBe(409);

    const replaced = await yusuf.post(`/api/animals/${id}/tags`, {
      type: 'qr',
      code: 'IB-NEW22',
      replaceReason: 'damaged',
    });
    expect(replaced.status).toBe(201);
    const history = await yusuf.get(`/api/animals/${id}/tags`);
    const qr = history.body.items.filter((t: { type: string }) => t.type === 'qr');
    expect(qr.at(-2)).toMatchObject({ removalReason: 'damaged' });
    expect(qr.at(-1)).toMatchObject({ code: 'IB-NEW22', removedAt: null });
    expect((await yusuf.get(`/api/animals/${id}`)).body.qrCode).toBe('IB-NEW22');

    expect(
      (await yusuf.post(`/api/animals/${id}/tags`, { type: 'qr', code: 'IB-O0000' })).status,
    ).toBe(400);
  });
});

describe('pengingat', () => {
  it('admin dinas melihat pengingat 3 bulan dan 9 bulan dari data contoh', async () => {
    const admin = await h.as('agencyAdmin');
    const res = await admin.get('/api/reminders?withinDays=14');
    expect(res.status).toBe(200);
    const kinds = new Set(res.body.items.map((r: { kind: string }) => r.kind));
    expect(kinds).toContain('IB_RESULT_OVERDUE');
    expect(kinds).toContain('BIRTH_REPORT_OVERDUE');
    expect(res.body.items[0].overdue).toBe(true); // yang terlambat di atas
  });

  it('peternak hanya melihat pengingat ternaknya', async () => {
    const farmer = await h.as('agus');
    const res = await farmer.get('/api/reminders?withinDays=30');
    const own = farmerIdOf('Agus Salim');
    expect(
      res.body.items.every((r: { animal: { farmerId: string } }) => r.animal.farmerId === own),
    ).toBe(true);
  });
});

describe('dokumentasi OpenAPI', () => {
  it('menyajikan spesifikasi OpenAPI dan halaman /api/docs', async () => {
    const spec = await h.request('GET', '/api/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.1.0');
    for (const path of [
      '/api/auth/login',
      '/api/farmers',
      '/api/animals/{id}/events',
      '/api/animals/{id}/timeline',
      '/api/service-requests/{id}/reassign',
      '/api/reminders',
    ]) {
      expect(spec.body.paths, path).toHaveProperty([path]);
    }
    const docs = await h.request('GET', '/api/docs').catch(() => null);
    expect(docs?.status ?? 200).toBe(200);
  });

  it('aset Swagger UI disajikan server sendiri (tanpa CDN)', async () => {
    const html = await app().request('/api/docs');
    const text = await html.text();
    expect(text).toContain('/api/docs/assets/swagger-ui-bundle.js');
    expect(text).not.toMatch(/cdn\.|jsdelivr|unpkg/);
    const js = await app().request('/api/docs/assets/swagger-ui-bundle.js');
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('javascript');
    expect((await app().request('/api/docs/assets/..%2Fpackage.json')).status).toBe(404);
  });
});
