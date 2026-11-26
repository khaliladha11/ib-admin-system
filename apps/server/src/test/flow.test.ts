// Alur lengkap dari skripsi lewat API:
// permintaan IB → verifikasi → penugasan (+ ganti petugas) → laporan IB → PKB bunting → lahir.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness, DAY, type Harness } from './api-harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => {
  h.close();
});

describe('alur lengkap IB → PKB → lahir', () => {
  const state: { animalId: string; requestId: string; ibEventId: string; calfId: string } = {
    animalId: '',
    requestId: '',
    ibEventId: '',
    calfId: '',
  };

  it('1. peternak mendaftarkan sapi baru dengan label QR', async () => {
    const farmer = await h.as('suparman');
    const me = await farmer.get('/api/auth/me');
    expect(me.body.user.role).toBe('farmer');

    const res = await farmer.post('/api/animals', {
      farmerId: me.body.farmerId,
      name: 'Sapi Uji',
      sex: 'F',
      breed: 'Simental',
      qrCode: 'IB-UJ2AN',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Sapi Uji',
      qrCode: 'IB-UJ2AN',
      status: { kind: 'kosong' },
    });
    state.animalId = res.body.id;
  });

  it('2. peternak mencatat birahi lalu mengajukan permintaan IB', async () => {
    const farmer = await h.as('suparman');
    const bh = await farmer.post(`/api/animals/${state.animalId}/events`, {
      type: 'BH',
      occurredAt: h.now() - 2 * 3_600_000,
      payload: { signs: ['lendir_bening', 'gelisah'] },
    });
    expect(bh.status).toBe(201);
    expect(bh.body.status.kind).toBe('birahi');

    const req = await farmer.post('/api/service-requests', {
      animalId: state.animalId,
      type: 'IB',
      notes: 'Birahi pagi ini',
    });
    expect(req.status).toBe(201);
    expect(req.body.request.status).toBe('submitted');
    state.requestId = req.body.request.id;

    // Permintaan ganda untuk jenis yang sama ditolak.
    const dup = await farmer.post('/api/service-requests', {
      animalId: state.animalId,
      type: 'IB',
    });
    expect(dup.status).toBe(409);
  });

  it('3. admin kelompok memverifikasi dan menugaskan petugas', async () => {
    const admin = await h.as('groupAdmin1');
    const res = await admin.post(`/api/service-requests/${state.requestId}/assign`, {
      inseminatorId: h.userId('andi'),
    });
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('assigned');
    expect(res.body.assignments).toHaveLength(1);

    // Peternak tidak boleh menugaskan.
    const farmer = await h.as('suparman');
    const denied = await farmer.post(`/api/service-requests/${state.requestId}/reassign`, {
      inseminatorId: h.userId('rina'),
    });
    expect(denied.status).toBe(403);
  });

  it('4. admin mengganti petugas; riwayat penugasan lama tetap ada', async () => {
    const admin = await h.as('groupAdmin1');
    const res = await admin.post(`/api/service-requests/${state.requestId}/reassign`, {
      inseminatorId: h.userId('yusuf'),
    });
    expect(res.status).toBe(200);
    expect(res.body.assignments).toHaveLength(2);
    expect(res.body.assignments[0]).toMatchObject({
      inseminatorId: h.userId('andi'),
      endReason: 'reassigned',
    });
    expect(res.body.assignments[1]).toMatchObject({
      inseminatorId: h.userId('yusuf'),
      endReason: null,
    });
  });

  it('5. hanya petugas yang ditugaskan yang bisa menerima tugas', async () => {
    const andi = await h.as('andi');
    expect((await andi.post(`/api/service-requests/${state.requestId}/accept`)).status).toBe(403);

    const yusuf = await h.as('yusuf');
    const mine = await yusuf.get('/api/service-requests?mine=true');
    expect(mine.body.items.map((r: { id: string }) => r.id)).toContain(state.requestId);

    const res = await yusuf.post(`/api/service-requests/${state.requestId}/accept`);
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('in_progress');

    // Kiriman ulang (outbox HP) aman: jawaban sama, tidak error.
    const again = await yusuf.post(`/api/service-requests/${state.requestId}/accept`);
    expect(again.status).toBe(200);
    expect(again.body.request.status).toBe('in_progress');
  });

  it('6. petugas mencatat laporan IB; permintaan selesai', async () => {
    const yusuf = await h.as('yusuf');
    const stock = h.stockOf('yusuf');
    const res = await yusuf.post(`/api/animals/${state.animalId}/events`, {
      type: 'IB',
      occurredAt: h.now(),
      serviceRequestId: state.requestId,
      semenStockId: stock.id,
      payload: { strawCode: stock.strawCode, bullId: stock.bullId, batch: stock.batch },
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toMatchObject({ kind: 'sudah_IB_menunggu_PKB', serviceNumber: 1 });
    state.ibEventId = res.body.event.id;

    const detail = await yusuf.get(`/api/service-requests/${state.requestId}`);
    expect(detail.body.request).toMatchObject({ status: 'done', resultEventId: state.ibEventId });
    expect(detail.body.assignments[1]).toMatchObject({ endReason: 'completed' });
  });

  it('7. PKB terlalu cepat ditolak; PKB 60 hari kemudian: bunting', async () => {
    const yusuf = await h.as('yusuf');
    h.advanceDays(10);
    const early = await yusuf.post(`/api/animals/${state.animalId}/events`, {
      type: 'PKB',
      occurredAt: h.now(),
      payload: { result: 'pregnant', fetalAgeMonths: 1 },
    });
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe('INVALID_EVENT');
    expect(early.body.error.message).toMatch(/PKB terlalu cepat/);

    h.advanceDays(50); // sesi lama kedaluwarsa (30 hari): masuk ulang
    const res = await (
      await h.as('yusuf')
    ).post(`/api/animals/${state.animalId}/events`, {
      type: 'PKB',
      occurredAt: h.now(),
      payload: { result: 'pregnant', fetalAgeMonths: 2, method: 'palpation' },
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toMatchObject({ kind: 'bunting', gestationDays: 60 });
  });

  it('8. IB pada sapi bunting ditolak; BH pada sapi bunting butuh konfirmasi', async () => {
    h.advanceDays(1);
    const yusuf = await h.as('yusuf');
    const stock = h.stockOf('yusuf');
    const ib = await yusuf.post(`/api/animals/${state.animalId}/events`, {
      type: 'IB',
      occurredAt: h.now(),
      payload: { strawCode: stock.strawCode, bullId: stock.bullId, batch: stock.batch },
    });
    expect(ib.status).toBe(422);
    expect(ib.body.error.message).toMatch(/Sapi sedang bunting; IB tidak bisa dicatat/);

    const farmer = await h.as('suparman');
    const bhBody = { type: 'BH', occurredAt: h.now(), payload: {} };
    const warn = await farmer.post(`/api/animals/${state.animalId}/events`, bhBody);
    expect(warn.status).toBe(409);
    expect(warn.body.error.code).toBe('WARNINGS_NEED_CONFIRMATION');
    expect(warn.body.error.details.warnings[0]).toMatch(/tercatat bunting/);

    const confirmed = await farmer.post(`/api/animals/${state.animalId}/events`, {
      ...bhBody,
      confirmWarnings: true,
    });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.status.kind).toBe('bunting');
  });

  it('9. peternak mencatat kelahiran; anak sapi otomatis terdaftar', async () => {
    h.advanceDays(221); // ±282 hari sejak IB
    const farmer = await h.as('suparman');
    state.calfId = h.newId();
    const res = await farmer.post(`/api/animals/${state.animalId}/events`, {
      type: 'LH',
      occurredAt: h.now(),
      payload: {
        calves: [{ sex: 'M', condition: 'alive', calfAnimalId: state.calfId, weightKg: 29 }],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.status.kind).toBe('sudah_lahir');

    const calf = await farmer.get(`/api/animals/${state.calfId}`);
    expect(calf.status).toBe(200);
    expect(calf.body).toMatchObject({ damId: state.animalId, sex: 'M', breed: 'Simental' });
    expect(calf.body.sireCode).toBe(h.stockOf('yusuf').bullId);
  });

  it('10. linimasa menampilkan semua event, status, dan jadwal birahi berikutnya', async () => {
    const farmer = await h.as('suparman');
    const res = await farmer.get(`/api/animals/${state.animalId}/timeline`);
    expect(res.status).toBe(200);
    expect(res.body.events.map((e: { type: string }) => e.type)).toEqual([
      'BH',
      'IB',
      'PKB',
      'BH',
      'LH',
    ]);
    expect(res.body.animal.status.kind).toBe('sudah_lahir');
    expect(res.body.anomalies).toEqual([]);
    expect(res.body.schedule.nextEstrusAt).toBe(h.now() + 45 * DAY);
    expect(res.body.schedule.reminders).toEqual([]);
  });
});
