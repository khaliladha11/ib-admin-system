import { describe, expect, it } from 'vitest';

import {
  BIRTH_REPORT_DUE_DAYS,
  GESTATION_DAYS_EXPECTED,
  GESTATION_DAYS_MAX,
  GESTATION_DAYS_MIN,
  IB_RESULT_REPORT_DUE_DAYS,
} from './constants';
import { computeSchedule } from './schedule';
import { bb, bh, DAY, exit, ib, kgg, lh, pkbNeg, pkbPos, TODAY } from './test-helpers';

const day = (n: number) => TODAY + n * DAY;

describe('computeSchedule', () => {
  it('tanpa riwayat: tidak ada jadwal', () => {
    const s = computeSchedule([], TODAY);
    expect(s).toMatchObject({ nextEstrusAt: null, pkbDueAt: null, expectedCalving: null, reminders: [] });
  });

  it('(40) sapi kosong, BH 30 hari lalu: birahi berikutnya dimajukan ke H+12', () => {
    expect(computeSchedule([bh(30)], TODAY).nextEstrusAt).toBe(day(12));
  });

  it('(41) sudah IB 40 hari lalu: PKB H+20, birahi berikutnya dimajukan per siklus', () => {
    const s = computeSchedule([ib(40)], TODAY);
    expect(s.pkbDueAt).toBe(day(20));
    expect(s.nextEstrusAt).toBe(day(2)); // H-40 + 42
    expect(s.reminders).toEqual([]);
  });

  it('(42) IB 110 hari lalu tanpa PKB: pengingat hasil IB terlambat 20 hari', () => {
    const insem = ib(110);
    const s = computeSchedule([insem], TODAY);
    expect(s.reminders).toEqual([
      {
        code: 'IB_RESULT_OVERDUE',
        eventId: insem.id,
        dueAt: insem.occurredAt + IB_RESULT_REPORT_DUE_DAYS * DAY,
        overdueDays: 20,
        message: 'Hasil IB belum dilaporkan lebih dari 3 bulan (terlambat 20 hari).',
      },
    ]);
  });

  it('(43) tepat 90 hari belum terlambat; hari ke-91 terlambat', () => {
    expect(computeSchedule([ib(90)], TODAY).reminders).toEqual([]);
    expect(computeSchedule([ib(91)], TODAY).reminders).toHaveLength(1);
  });

  it('(44) bunting, konsepsi 150 hari lalu: perkiraan lahir dan tanpa jadwal birahi', () => {
    const insem = ib(150);
    const s = computeSchedule([insem, pkbPos(90)], TODAY);
    expect(s.expectedCalving).toEqual({
      earliest: insem.occurredAt + GESTATION_DAYS_MIN * DAY,
      expected: insem.occurredAt + GESTATION_DAYS_EXPECTED * DAY,
      latest: insem.occurredAt + GESTATION_DAYS_MAX * DAY,
    });
    expect(s.expectedCalving?.earliest).toBe(day(120));
    expect(s.nextEstrusAt).toBeNull();
    expect(s.pkbDueAt).toBeNull();
    expect(s.reminders).toEqual([]);
  });

  it('(45) pengingat kelahiran muncul setelah lewat perkiraan lahir paling lambat', () => {
    const due = BIRTH_REPORT_DUE_DAYS;
    expect(computeSchedule([ib(due), pkbPos(due - 70, 2)], TODAY).reminders).toEqual([]);
    const insem = ib(due + 5);
    const s = computeSchedule([insem, pkbPos(due - 65, 2)], TODAY);
    expect(s.reminders).toEqual([
      {
        code: 'BIRTH_REPORT_OVERDUE',
        eventId: s.status.event?.id,
        dueAt: insem.occurredAt + due * DAY,
        overdueDays: 5,
        message:
          'Kelahiran atau keguguran belum dilaporkan; sudah lewat perkiraan lahir paling lambat (terlambat 5 hari).',
      },
    ]);
  });

  it('(46) sudah lahir 10 hari lalu: birahi pertama sekitar H+35', () => {
    expect(computeSchedule([ib(330), pkbPos(250), lh(10)], TODAY).nextEstrusAt).toBe(day(35));
  });

  it('(47) keguguran: jadwal birahi dihitung dari tanggal KGG', () => {
    expect(computeSchedule([ib(200), pkbPos(140), kgg(10)], TODAY).nextEstrusAt).toBe(day(11));
  });

  it('(48) keluar: tanpa jadwal dan pengingat', () => {
    const s = computeSchedule([ib(200), exit(5)], TODAY);
    expect(s).toMatchObject({ nextEstrusAt: null, pkbDueAt: null, expectedCalving: null, reminders: [] });
  });

  it('(49) pengingat hilang setelah PKB atau LH dicatat', () => {
    expect(computeSchedule([ib(120), pkbNeg(1)], TODAY).reminders).toEqual([]);
    expect(computeSchedule([ib(320), pkbPos(250), lh(1)], TODAY).reminders).toEqual([]);
  });

  it('sapi kosong tanpa BH/IB (hanya BB): tidak ada perkiraan birahi', () => {
    expect(computeSchedule([bb(10)], TODAY).nextEstrusAt).toBeNull();
  });
});
