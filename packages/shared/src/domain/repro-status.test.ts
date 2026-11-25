import { describe, expect, it } from 'vitest';

import { ESTRUS_ACTIVE_DAYS } from './constants';
import { deriveReproStatus } from './repro-status';
import { bb, bh, DAY, ev, exit, health, ib, kgg, lh, pkbNeg, pkbPos, TODAY } from './test-helpers';
import { effectiveEvents } from './timeline';

describe('effectiveEvents', () => {
  it('(1) mengurutkan menurut occurredAt, lalu id bila waktunya sama', () => {
    const a = bh(10);
    const b = ib(5);
    const c = { ...ib(5), id: '0000' + b.id.slice(4) }; // waktu sama, id lebih kecil
    expect(effectiveEvents([b, a, c]).map((e) => e.id)).toEqual([a.id, c.id, b.id]);
  });

  it('(2) mengabaikan event yang dihapus (deletedAt)', () => {
    const del = { ...bh(3), deletedAt: TODAY };
    expect(effectiveEvents([del])).toEqual([]);
  });

  it('(3) mengabaikan event yang dibatalkan, memakai penggantinya', () => {
    const wrong = bb(10, 34);
    const fix = ev(10, { type: 'BB', payload: { weightKg: 340 } }, { voidsEventId: wrong.id });
    expect(effectiveEvents([wrong, fix])).toEqual([fix]);
  });

  it('pembatalan yang dihapus tidak membatalkan apa pun', () => {
    const original = bh(10);
    const voider = { ...ev(9, { type: 'BH', payload: {} }, { voidsEventId: original.id }), deletedAt: TODAY };
    expect(effectiveEvents([original, voider])).toEqual([original]);
  });
});

describe('deriveReproStatus: alur normal', () => {
  it('(4) BB dan HEALTH tidak mengubah status', () => {
    expect(deriveReproStatus([bb(20), health(10)], TODAY).status.kind).toBe('kosong');
  });

  it('(5) tanpa event: kosong', () => {
    const { status, anomalies } = deriveReproStatus([], TODAY);
    expect(status).toEqual({ kind: 'kosong', event: null });
    expect(anomalies).toEqual([]);
  });

  it('(6) BH kemarin: birahi, dengan event BH', () => {
    const heat = bh(1);
    expect(deriveReproStatus([heat], TODAY).status).toEqual({ kind: 'birahi', event: heat });
  });

  it('(7) BH lebih lama dari masa birahi tanpa IB: kembali kosong', () => {
    const heat = bh(ESTRUS_ACTIVE_DAYS + 1);
    expect(deriveReproStatus([heat], TODAY).status).toEqual({ kind: 'kosong', event: heat });
  });

  it('(8) BH lalu IB: menunggu PKB, IB ke-1', () => {
    const insem = ib(40);
    const { status } = deriveReproStatus([bh(41), insem], TODAY);
    expect(status).toEqual({ kind: 'sudah_IB_menunggu_PKB', event: insem, serviceNumber: 1 });
  });

  it('(9) IB, PKB tidak bunting, IB lagi: IB ke-2', () => {
    const { status } = deriveReproStatus([ib(100), pkbNeg(40), ib(20)], TODAY);
    expect(status.kind).toBe('sudah_IB_menunggu_PKB');
    expect(status.kind === 'sudah_IB_menunggu_PKB' && status.serviceNumber).toBe(2);
  });

  it('(10) IB lalu PKB bunting: bunting, konsepsi = tanggal IB', () => {
    const insem = ib(150);
    const pkb = pkbPos(90, 2);
    const { status } = deriveReproStatus([insem, pkb], TODAY);
    expect(status).toEqual({
      kind: 'bunting',
      event: pkb,
      ibEvent: insem,
      serviceNumber: 1,
      conceptionAt: insem.occurredAt,
      gestationDays: 150,
      gestationMonths: 4,
    });
  });

  it('(11) PKB bunting tanpa IB (kawin alam): konsepsi dari umur janin', () => {
    const pkb = pkbPos(30, 3);
    const { status } = deriveReproStatus([pkb], TODAY);
    expect(status.kind).toBe('bunting');
    if (status.kind !== 'bunting') return;
    expect(status.ibEvent).toBeNull();
    expect(status.conceptionAt).toBe(pkb.occurredAt - Math.round(3 * 30.4 * DAY));
    expect(status.gestationDays).toBe(121); // 30 + 91,2 hari
  });

  it('(12) bunting lalu KGG: keguguran', () => {
    const abortion = kgg(60);
    expect(deriveReproStatus([ib(200), pkbPos(140), abortion], TODAY).status).toEqual({
      kind: 'keguguran',
      event: abortion,
    });
  });

  it('(13) bunting lalu LH: sudah lahir', () => {
    const birth = lh(45);
    expect(deriveReproStatus([ib(330), pkbPos(250, 3), birth], TODAY).status).toEqual({
      kind: 'sudah_lahir',
      event: birth,
    });
  });

  it('(14) setelah melahirkan, hitungan IB mulai dari 1 lagi', () => {
    const events = [ib(500), pkbNeg(440), ib(420), pkbPos(360), lh(130), bh(41), ib(40)];
    const { status } = deriveReproStatus(events, TODAY);
    expect(status.kind === 'sudah_IB_menunggu_PKB' && status.serviceNumber).toBe(1);
  });

  it('(15) EXIT: keluar', () => {
    const out = exit(5);
    expect(deriveReproStatus([bb(30), out], TODAY).status).toEqual({ kind: 'keluar', event: out });
  });

  it('(16) IB lalu PKB tidak bunting: kosong', () => {
    const pkb = pkbNeg(40);
    expect(deriveReproStatus([ib(100), pkb], TODAY).status).toEqual({ kind: 'kosong', event: pkb });
  });

  it('(17) dua IB dalam satu masa birahi dihitung satu layanan', () => {
    const first = ib(40);
    const second = ev(40, first, {}); // salinan dengan id baru
    const { status } = deriveReproStatus([first, { ...second, occurredAt: first.occurredAt + DAY / 2 }], TODAY);
    expect(status.kind === 'sudah_IB_menunggu_PKB' && status.serviceNumber).toBe(1);
  });

  it('S/C tercatat saat bunting (IB ke-2 yang berhasil)', () => {
    const { status } = deriveReproStatus([ib(160), pkbNeg(100), bh(80), ib(79), pkbPos(10)], TODAY);
    expect(status.kind === 'bunting' && status.serviceNumber).toBe(2);
  });
});

describe('deriveReproStatus: data tidak berurutan (anomali)', () => {
  it('(18) LH tanpa bunting: status tetap, LH menjadi anomali', () => {
    const heat = bh(1);
    const birth = lh(0);
    const { status, anomalies } = deriveReproStatus([heat, birth], TODAY);
    expect(status.kind).toBe('birahi');
    expect(anomalies).toEqual([birth]);
  });

  it('(19) IB saat bunting: anomali, status tetap bunting', () => {
    const wrongIb = ib(10);
    const { status, anomalies } = deriveReproStatus([ib(150), pkbPos(90), wrongIb], TODAY);
    expect(status.kind).toBe('bunting');
    expect(anomalies).toEqual([wrongIb]);
  });

  it('(20) event setelah EXIT: anomali, status tetap keluar', () => {
    const late = bh(1);
    const { status, anomalies } = deriveReproStatus([exit(10), late], TODAY);
    expect(status.kind).toBe('keluar');
    expect(anomalies).toEqual([late]);
  });

  it('BH saat bunting hanya peringatan: status tetap bunting, bukan anomali', () => {
    const { status, anomalies } = deriveReproStatus([ib(150), pkbPos(90), bh(5)], TODAY);
    expect(status.kind).toBe('bunting');
    expect(anomalies).toEqual([]);
  });
});
