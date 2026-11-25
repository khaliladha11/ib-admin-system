import { describe, expect, it } from 'vitest';

import { compareReminders, listReminders } from './reminders';
import { computeSchedule } from './schedule';
import { bh, DAY, ib, pkbPos, TODAY } from './test-helpers';

const remindersOf = (events: Parameters<typeof computeSchedule>[0], withinDays = 7) =>
  listReminders(computeSchedule(events, TODAY), TODAY, withinDays);

describe('listReminders', () => {
  it('birahi diperkirakan dalam N hari: muncul; di luar N hari: tidak', () => {
    // BH 16 hari lalu → birahi berikutnya H+5.
    expect(remindersOf([bh(16)]).map((r) => r.kind)).toEqual(['ESTRUS_EXPECTED']);
    expect(remindersOf([bh(16)], 3)).toEqual([]);
  });

  it('hasil IB belum dilaporkan > 90 hari: terlambat, jadwal PKB tidak ditampilkan', () => {
    const items = remindersOf([ib(100)]);
    const overdue = items.filter((r) => r.overdue);
    expect(overdue).toMatchObject([{ kind: 'IB_RESULT_OVERDUE', overdueDays: 10 }]);
    expect(items.some((r) => r.kind === 'PKB_DUE')).toBe(false);
  });

  it('IB 55 hari lalu: jadwal PKB dalam 7 hari', () => {
    expect(remindersOf([ib(55)])).toContainEqual(
      expect.objectContaining({ kind: 'PKB_DUE', overdue: false, dueAt: TODAY + 5 * DAY }),
    );
  });

  it('bunting dekat waktu lahir: perkiraan lahir muncul', () => {
    const items = remindersOf([ib(268), pkbPos(200, 2)]);
    expect(items.map((r) => r.kind)).toContain('CALVING_EXPECTED');
    expect(items.find((r) => r.kind === 'CALVING_EXPECTED')?.message).toMatch(/^Perkiraan lahir/);
  });

  it('compareReminders: terlambat dulu, lalu menurut tanggal', () => {
    const base = { message: '', overdueDays: null };
    const list = [
      { ...base, kind: 'PKB_DUE' as const, overdue: false, dueAt: 2 },
      { ...base, kind: 'ESTRUS_EXPECTED' as const, overdue: false, dueAt: 1 },
      { ...base, kind: 'IB_RESULT_OVERDUE' as const, overdue: true, dueAt: 5 },
    ].sort(compareReminders);
    expect(list.map((r) => r.kind)).toEqual(['IB_RESULT_OVERDUE', 'ESTRUS_EXPECTED', 'PKB_DUE']);
  });
});
