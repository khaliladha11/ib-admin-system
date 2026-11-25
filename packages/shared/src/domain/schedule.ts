import {
  BIRTH_REPORT_DUE_DAYS,
  DAY_MS,
  ESTRUS_CYCLE_DAYS,
  GESTATION_DAYS_EXPECTED,
  GESTATION_DAYS_MAX,
  GESTATION_DAYS_MIN,
  IB_RESULT_REPORT_DUE_DAYS,
  PKB_AFTER_IB_DAYS,
  POSTPARTUM_FIRST_ESTRUS_DAYS,
} from './constants';
import { phaseToStatus, replay, type ReproStatus } from './repro-status';
import type { DomainEvent } from './timeline';

export type ReminderCode = 'IB_RESULT_OVERDUE' | 'BIRTH_REPORT_OVERDUE';

export interface Reminder {
  code: ReminderCode;
  /** Event yang menjadi patokan (IB, atau PKB bunting). */
  eventId: string;
  /** Batas waktu laporan. */
  dueAt: number;
  overdueDays: number;
  message: string;
}

export interface Schedule {
  status: ReproStatus;
  /** Perkiraan birahi berikutnya (selalu ≥ today), atau null bila tidak relevan. */
  nextEstrusAt: number | null;
  pkbDueAt: number | null;
  expectedCalving: { earliest: number; expected: number; latest: number } | null;
  /** Pengingat terlambat dari aturan skripsi (3 bulan dan 9 bulan). */
  reminders: Reminder[];
}

/** Tanggal pertama `from + n × siklus` yang tidak sebelum `today`. */
function nextCycleOnOrAfter(from: number, today: number): number {
  const cycle = ESTRUS_CYCLE_DAYS * DAY_MS;
  if (from >= today) return from;
  return from + Math.ceil((today - from) / cycle) * cycle;
}

const overdueDays = (today: number, dueAt: number) => Math.floor((today - dueAt) / DAY_MS);

/**
 * Jadwal dan pengingat seekor sapi pada tanggal `today`:
 * perkiraan birahi berikutnya, jadwal PKB, perkiraan lahir, dan pengingat terlambat.
 */
export function computeSchedule(events: readonly DomainEvent[], today: number): Schedule {
  const { state } = replay(events);
  const status = phaseToStatus(state, today);
  const schedule: Schedule = {
    status,
    nextEstrusAt: null,
    pkbDueAt: null,
    expectedCalving: null,
    reminders: [],
  };

  switch (status.kind) {
    case 'kosong':
    case 'birahi':
    case 'sudah_IB_menunggu_PKB':
      if (state.lastHeatAt !== null) {
        schedule.nextEstrusAt = nextCycleOnOrAfter(
          state.lastHeatAt + ESTRUS_CYCLE_DAYS * DAY_MS,
          today,
        );
      }
      break;
    case 'sudah_lahir':
      schedule.nextEstrusAt = nextCycleOnOrAfter(
        status.event.occurredAt + POSTPARTUM_FIRST_ESTRUS_DAYS * DAY_MS,
        today,
      );
      break;
    case 'keguguran':
      schedule.nextEstrusAt = nextCycleOnOrAfter(
        status.event.occurredAt + ESTRUS_CYCLE_DAYS * DAY_MS,
        today,
      );
      break;
    case 'bunting':
    case 'keluar':
      break;
  }

  if (status.kind === 'sudah_IB_menunggu_PKB') {
    const ibAt = status.event.occurredAt;
    schedule.pkbDueAt = ibAt + PKB_AFTER_IB_DAYS * DAY_MS;
    const dueAt = ibAt + IB_RESULT_REPORT_DUE_DAYS * DAY_MS;
    if (today > dueAt) {
      const late = overdueDays(today, dueAt);
      schedule.reminders.push({
        code: 'IB_RESULT_OVERDUE',
        eventId: status.event.id,
        dueAt,
        overdueDays: late,
        message: `Hasil IB belum dilaporkan lebih dari 3 bulan (terlambat ${String(late)} hari).`,
      });
    }
  }

  if (status.kind === 'bunting') {
    const c = status.conceptionAt;
    schedule.expectedCalving = {
      earliest: c + GESTATION_DAYS_MIN * DAY_MS,
      expected: c + GESTATION_DAYS_EXPECTED * DAY_MS,
      latest: c + GESTATION_DAYS_MAX * DAY_MS,
    };
    const dueAt = c + BIRTH_REPORT_DUE_DAYS * DAY_MS;
    if (today > dueAt) {
      const late = overdueDays(today, dueAt);
      schedule.reminders.push({
        code: 'BIRTH_REPORT_OVERDUE',
        eventId: status.event.id,
        dueAt,
        overdueDays: late,
        message: `Kelahiran atau keguguran belum dilaporkan; sudah lewat perkiraan lahir paling lambat (terlambat ${String(late)} hari).`,
      });
    }
  }

  return schedule;
}
