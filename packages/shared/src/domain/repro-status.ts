import {
  DAY_MS,
  DAYS_PER_MONTH,
  ESTRUS_ACTIVE_DAYS,
  MIN_IB_INTERVAL_DAYS,
  PKB_MIN_DAYS_AFTER_IB,
  PREMATURE_BIRTH_DAYS,
  SAME_HEAT_IB_DAYS,
} from './constants';
import { effectiveEvents, type DomainEvent, type DomainEventOf } from './timeline';

// ---------------------------------------------------------------------------
// Status yang terlihat oleh pemakai
// ---------------------------------------------------------------------------

export type ReproStatus =
  /** Tidak bunting dan tidak sedang birahi. `event` = event terakhir yang membuatnya kosong. */
  | { kind: 'kosong'; event: DomainEvent | null }
  | { kind: 'birahi'; event: DomainEventOf<'BH'> }
  | {
      kind: 'sudah_IB_menunggu_PKB';
      event: DomainEventOf<'IB'>;
      /** IB ke-berapa sejak melahirkan/keguguran terakhir. */
      serviceNumber: number;
    }
  | {
      kind: 'bunting';
      /** PKB bunting terakhir. */
      event: DomainEventOf<'PKB'>;
      /** IB yang menghasilkan kebuntingan (null bila tidak tercatat, mis. kawin alam). */
      ibEvent: DomainEventOf<'IB'> | null;
      /** Jumlah IB sampai bunting (S/C untuk kebuntingan ini). */
      serviceNumber: number;
      conceptionAt: number;
      gestationDays: number;
      gestationMonths: number;
    }
  | { kind: 'keguguran'; event: DomainEventOf<'KGG'> }
  | { kind: 'sudah_lahir'; event: DomainEventOf<'LH'> }
  | { kind: 'keluar'; event: DomainEventOf<'EXIT'> };

export type ReproStatusKind = ReproStatus['kind'];

// ---------------------------------------------------------------------------
// Mesin status internal (tanpa "hari ini"), dipakai bersama oleh
// deriveReproStatus, validateNextEvent, dan computeSchedule.
// ---------------------------------------------------------------------------

type Phase =
  | { kind: 'kosong'; event: DomainEvent | null }
  | { kind: 'birahi'; event: DomainEventOf<'BH'> }
  | { kind: 'sudah_IB_menunggu_PKB'; event: DomainEventOf<'IB'> }
  | {
      kind: 'bunting';
      event: DomainEventOf<'PKB'>;
      ibEvent: DomainEventOf<'IB'> | null;
      conceptionAt: number;
      serviceNumber: number;
    }
  | { kind: 'keguguran'; event: DomainEventOf<'KGG'> }
  | { kind: 'sudah_lahir'; event: DomainEventOf<'LH'> }
  | { kind: 'keluar'; event: DomainEventOf<'EXIT'> };

export interface MachineState {
  phase: Phase;
  /** Jumlah IB sejak melahirkan/keguguran terakhir. */
  serviceCount: number;
  /** IB terakhir dalam siklus ini. */
  lastIb: DomainEventOf<'IB'> | null;
  /** Waktu BH atau IB terakhir (patokan perkiraan birahi berikutnya). */
  lastHeatAt: number | null;
}

export type IssueSeverity = 'error' | 'warning';

export interface EventIssue {
  event: DomainEvent;
  severity: IssueSeverity;
  message: string;
}

const INITIAL_STATE: MachineState = {
  phase: { kind: 'kosong', event: null },
  serviceCount: 0,
  lastIb: null,
  lastHeatAt: null,
};

interface StepResult {
  state: MachineState;
  issue?: { severity: IssueSeverity; message: string };
}

const days = (ms: number) => Math.floor(ms / DAY_MS);

/** Satu langkah mesin status. Bila ada error, state tidak berubah. */
export function applyEvent(state: MachineState, e: DomainEvent): StepResult {
  const { phase } = state;
  const error = (message: string): StepResult => ({ state, issue: { severity: 'error', message } });

  if (phase.kind === 'keluar') {
    return error(
      'Ternak sudah keluar (mati, dijual, atau dipotong); event baru tidak bisa dicatat.',
    );
  }

  switch (e.type) {
    case 'BB':
    case 'HEALTH':
      return { state };

    case 'EXIT':
      return { state: { ...state, phase: { kind: 'keluar', event: e } } };

    case 'BH':
      if (phase.kind === 'bunting') {
        return {
          state,
          issue: {
            severity: 'warning',
            message: 'Sapi tercatat bunting tetapi menunjukkan birahi; periksa kebuntingan (PKB).',
          },
        };
      }
      return { state: { ...state, phase: { kind: 'birahi', event: e }, lastHeatAt: e.occurredAt } };

    case 'IB': {
      if (phase.kind === 'bunting') return error('Sapi sedang bunting; IB tidak bisa dicatat.');
      const gap = state.lastIb ? e.occurredAt - state.lastIb.occurredAt : null;
      const sameHeat =
        phase.kind === 'sudah_IB_menunggu_PKB' && gap !== null && gap <= SAME_HEAT_IB_DAYS * DAY_MS;
      const next: MachineState = {
        ...state,
        phase: { kind: 'sudah_IB_menunggu_PKB', event: e },
        serviceCount: sameHeat ? state.serviceCount : state.serviceCount + 1,
        lastIb: e,
        lastHeatAt: e.occurredAt,
      };
      if (!sameHeat && gap !== null && gap < MIN_IB_INTERVAL_DAYS * DAY_MS) {
        return {
          state: next,
          issue: {
            severity: 'warning',
            message: `IB kurang dari ${String(MIN_IB_INTERVAL_DAYS)} hari setelah IB sebelumnya; pastikan sapi benar-benar birahi lagi.`,
          },
        };
      }
      return { state: next };
    }

    case 'PKB': {
      if (
        phase.kind === 'sudah_IB_menunggu_PKB' &&
        e.occurredAt - phase.event.occurredAt < PKB_MIN_DAYS_AFTER_IB * DAY_MS
      ) {
        return error(
          `PKB terlalu cepat: minimal ${String(PKB_MIN_DAYS_AFTER_IB)} hari setelah IB agar hasilnya bisa dipercaya.`,
        );
      }
      const noIbWarning = 'Belum ada catatan IB untuk sapi ini';

      if (e.payload.result === 'pregnant') {
        if (phase.kind === 'bunting') {
          // PKB ulang yang menegaskan kebuntingan.
          return { state: { ...state, phase: { ...phase, event: e } } };
        }
        if (phase.kind === 'sudah_IB_menunggu_PKB') {
          return {
            state: {
              ...state,
              phase: {
                kind: 'bunting',
                event: e,
                ibEvent: phase.event,
                conceptionAt: phase.event.occurredAt,
                serviceNumber: state.serviceCount,
              },
            },
          };
        }
        const fetalDays = Math.round((e.payload.fetalAgeMonths ?? 0) * DAYS_PER_MONTH * DAY_MS);
        return {
          state: {
            ...state,
            phase: {
              kind: 'bunting',
              event: e,
              ibEvent: null,
              conceptionAt: e.occurredAt - fetalDays,
              serviceNumber: state.serviceCount,
            },
          },
          issue: {
            severity: 'warning',
            message: `${noIbWarning}; tanggal konsepsi diperkirakan dari umur janin.`,
          },
        };
      }

      // Tidak bunting
      if (phase.kind === 'sudah_IB_menunggu_PKB') {
        return { state: { ...state, phase: { kind: 'kosong', event: e } } };
      }
      if (phase.kind === 'bunting') {
        return {
          state: { ...state, phase: { kind: 'kosong', event: e } },
          issue: {
            severity: 'warning',
            message:
              'Sapi sebelumnya tercatat bunting; pastikan tidak ada keguguran yang belum dicatat.',
          },
        };
      }
      return { state, issue: { severity: 'warning', message: `${noIbWarning}.` } };
    }

    case 'KGG':
      if (phase.kind !== 'bunting') {
        return error('Keguguran hanya bisa dicatat untuk sapi yang tercatat bunting.');
      }
      return {
        state: { ...state, phase: { kind: 'keguguran', event: e }, serviceCount: 0, lastIb: null },
      };

    case 'LH': {
      if (phase.kind !== 'bunting') {
        return error('Kelahiran hanya bisa dicatat untuk sapi yang tercatat bunting.');
      }
      const next: MachineState = {
        ...state,
        phase: { kind: 'sudah_lahir', event: e },
        serviceCount: 0,
        lastIb: null,
      };
      const gestation = days(e.occurredAt - phase.conceptionAt);
      if (gestation < PREMATURE_BIRTH_DAYS) {
        return {
          state: next,
          issue: {
            severity: 'warning',
            message: `Umur kebuntingan saat lahir ${String(gestation)} hari (kurang dari ${String(PREMATURE_BIRTH_DAYS)} hari); kemungkinan lahir prematur, periksa tanggal IB/PKB.`,
          },
        };
      }
      return { state: next };
    }
  }
}

/** Jalankan seluruh riwayat (yang berlaku) melalui mesin status. */
export function replay(events: readonly DomainEvent[]): {
  state: MachineState;
  issues: EventIssue[];
} {
  let state = INITIAL_STATE;
  const issues: EventIssue[] = [];
  for (const event of effectiveEvents(events)) {
    const step = applyEvent(state, event);
    state = step.state;
    if (step.issue) issues.push({ event, ...step.issue });
  }
  return { state, issues };
}

/** Ubah fase mesin menjadi status untuk tanggal `today`. */
export function phaseToStatus(state: MachineState, today: number): ReproStatus {
  const { phase } = state;
  switch (phase.kind) {
    case 'birahi':
      return today - phase.event.occurredAt > ESTRUS_ACTIVE_DAYS * DAY_MS
        ? { kind: 'kosong', event: phase.event }
        : phase;
    case 'sudah_IB_menunggu_PKB':
      return { ...phase, serviceNumber: state.serviceCount };
    case 'bunting': {
      const gestationDays = days(today - phase.conceptionAt);
      return {
        ...phase,
        gestationDays,
        gestationMonths: Math.floor(gestationDays / DAYS_PER_MONTH),
      };
    }
    default:
      return phase;
  }
}

/**
 * Status reproduksi seekor sapi pada tanggal `today`, dihitung dari riwayat event-nya.
 * Event yang tidak masuk akal (mis. LH tanpa bunting) tidak mengubah status dan
 * dikembalikan di `anomalies` agar bisa dicek pengguna.
 */
export function deriveReproStatus(
  events: readonly DomainEvent[],
  today: number,
): { status: ReproStatus; anomalies: DomainEvent[] } {
  const { state, issues } = replay(events);
  return {
    status: phaseToStatus(state, today),
    anomalies: issues.filter((i) => i.severity === 'error').map((i) => i.event),
  };
}
