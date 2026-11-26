// Langkah 2.3: manajemen pengguna, aksi admin aman dikirim ulang, log aktivitas, sinkron pengguna.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness, type Harness } from './api-harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

const group = (code: string) => {
  const g = h.seed.locations.find((l) => l.code === code);
  if (!g) throw new Error(code);
  return g;
};
const villageOf = (code: string) => {
  const v = h.seed.locations.find((l) => l.level === 'village' && l.parentId === group(code).id);
  if (!v) throw new Error(code);
  return v;
};

describe('/api/users', () => {
  it('hanya admin; admin kelompok melihat wilayahnya + petugas yang melayani wilayahnya', async () => {
    expect((await (await h.as('andi')).get('/api/users')).status).toBe(403);
    const res = await (await h.as('groupAdmin1')).get('/api/users');
    expect(res.status).toBe(200);
    const names = res.body.items.map((u: { name: string }) => u.name);
    expect(names).toEqual(expect.arrayContaining(['Hartono', 'Andi Pratama', 'Rina Marlina']));
    expect(names).not.toContain('Yuliana'); // admin KTT-02
    expect(res.body.items.every((u: object) => !('passwordHash' in u))).toBe(true);
  });

  it('membuat petugas baru yang bisa langsung login', async () => {
    const admin = await h.as('groupAdmin1');
    const created = await admin.post('/api/users', {
      name: 'Bayu Petugas',
      phone: '0812-9999-0001',
      role: 'inseminator',
      locationId: group('KTT-01').id,
      password: 'rahasia-baru',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      phone: '081299990001',
      role: 'inseminator',
      isActive: true,
    });
    const login = await h.request('POST', '/api/auth/login', {
      body: { identifier: '081299990001', password: 'rahasia-baru' },
    });
    expect(login.status).toBe(200);

    const dup = await admin.post('/api/users', {
      name: 'Dobel',
      phone: '081299990001',
      role: 'inseminator',
      locationId: group('KTT-01').id,
      password: 'rahasia-baru',
    });
    expect(dup.status).toBe(409);
  });

  it('admin kelompok tidak bisa membuat admin dinas atau akun di luar wilayahnya', async () => {
    const admin = await h.as('groupAdmin1');
    const base = { name: 'X', phone: '081299990002', password: 'rahasia-baru' };
    expect(
      (
        await admin.post('/api/users', {
          ...base,
          role: 'agency_admin',
          locationId: group('KTT-01').id,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await admin.post('/api/users', {
          ...base,
          role: 'inseminator',
          locationId: group('KTT-02').id,
        })
      ).status,
    ).toBe(403);
  });

  it('akun peternak ditautkan ke data peternak tanpa akun', async () => {
    const admin = await h.as('groupAdmin1');
    const farmers = (await admin.get('/api/farmers')).body.items as {
      id: string;
      userId: string | null;
    }[];
    const target = farmers.find((f) => f.userId === null);
    if (!target) throw new Error('semua peternak sudah punya akun');
    const res = await admin.post('/api/users', {
      name: 'Akun Peternak',
      phone: '081299990003',
      role: 'farmer',
      locationId: villageOf('KTT-01').id,
      password: 'rahasia-baru',
      farmerId: target.id,
    });
    expect(res.status).toBe(201);
    const farmer = await admin.get(`/api/farmers/${target.id}`);
    expect(farmer.body.userId).toBe(res.body.id);
    expect(
      (
        await admin.post('/api/users', {
          name: 'Lagi',
          phone: '081299990004',
          role: 'farmer',
          locationId: villageOf('KTT-01').id,
          password: 'rahasia-baru',
          farmerId: target.id,
        })
      ).status,
    ).toBe(409);
  });

  it('menonaktifkan akun mengakhiri sesinya; tidak bisa menonaktifkan diri sendiri', async () => {
    const admin = await h.as('groupAdmin1');
    const siti = await h.as('siti');
    expect((await siti.get('/api/auth/me')).status).toBe(200);
    const res = await admin.patch(`/api/users/${h.userId('siti')}`, { isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect((await siti.get('/api/auth/me')).status).toBe(401);
    expect(
      (await admin.patch(`/api/users/${h.userId('groupAdmin1')}`, { isActive: false })).status,
    ).toBe(403);
    await admin.patch(`/api/users/${h.userId('siti')}`, { isActive: true });
  });

  it('petugas tingkat dinas hanya bisa diubah admin dinas; reset password', async () => {
    const group1 = await h.as('groupAdmin1');
    expect((await group1.patch(`/api/users/${h.userId('rina')}`, { name: 'Rina M.' })).status).toBe(
      403,
    );
    const agency = await h.as('agencyAdmin');
    const reset = await agency.post(`/api/users/${h.userId('rina')}/password`, {
      password: 'password-baru-rina',
    });
    expect(reset.status).toBe(204);
    const login = await h.request('POST', '/api/auth/login', {
      body: { identifier: '081200000202', password: 'password-baru-rina' },
    });
    expect(login.status).toBe(200);
  });
});

describe('aksi admin pada permintaan: aman dikirim ulang + tercatat di log', () => {
  it('tugaskan, tolak, dan ganti petugas dua kali → jawaban sama', async () => {
    const farmer = await h.as('suparman');
    const animals = (await farmer.get('/api/animals')).body.items as {
      id: string;
      sex: string;
      status: { kind: string };
    }[];
    const cows = animals.filter(
      (a) => a.sex === 'F' && a.status.kind !== 'bunting' && a.status.kind !== 'keluar',
    );
    const [cowA, cowB] = cows;
    if (!cowA || !cowB) throw new Error('sapi kurang');
    const reqA = (await farmer.post('/api/service-requests', { animalId: cowA.id, type: 'IB' }))
      .body.request;
    const reqB = (await farmer.post('/api/service-requests', { animalId: cowB.id, type: 'IB' }))
      .body.request;

    const admin = await h.as('groupAdmin1');
    const assign = { inseminatorId: h.userId('andi') };
    expect(
      (await admin.post(`/api/service-requests/${reqA.id as string}/assign`, assign)).status,
    ).toBe(200);
    const again = await admin.post(`/api/service-requests/${reqA.id as string}/assign`, assign);
    expect(again.status).toBe(200);
    expect(again.body.assignments).toHaveLength(1);

    const re = { inseminatorId: h.userId('rina') };
    expect(
      (await admin.post(`/api/service-requests/${reqA.id as string}/reassign`, re)).status,
    ).toBe(200);
    const re2 = await admin.post(`/api/service-requests/${reqA.id as string}/reassign`, re);
    expect(re2.status).toBe(200);
    expect(re2.body.assignments).toHaveLength(2);

    const reject = { reason: 'Sapi baru melahirkan' };
    expect(
      (await admin.post(`/api/service-requests/${reqB.id as string}/reject`, reject)).status,
    ).toBe(200);
    expect(
      (await admin.post(`/api/service-requests/${reqB.id as string}/reject`, reject)).status,
    ).toBe(200);

    // Sinkron admin membawa log aktivitas permintaan dan nama pengguna (tanpa hash password).
    const sync = await admin.get('/api/sync/changes');
    const logs = (sync.body.auditLogs as { rowId: string; after: { action: string } }[])
      .filter((l) => l.rowId === reqA.id)
      .map((l) => l.after.action);
    expect(logs).toEqual(['submit', 'assign', 'reassign']);
    expect(sync.body.users.some((u: { name: string }) => u.name === 'Andi Pratama')).toBe(true);
    expect(JSON.stringify(sync.body.users)).not.toContain('passwordHash');
  });

  it('peternak menerima nama petugas tanpa email, dan tidak menerima log', async () => {
    const res = await (await h.as('suparman')).get('/api/sync/changes');
    const rina = (res.body.users as { id: string; email: string | null }[]).find(
      (u) => u.id === h.userId('rina'),
    );
    expect(rina).toBeDefined();
    expect(rina?.email).toBeNull();
    expect(res.body.auditLogs).toEqual([]);
  });
});
