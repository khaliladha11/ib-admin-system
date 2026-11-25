// Tahap siklus untuk lintasan siklus di kartu ternak.
import type { ReproStatusKind } from '@ib/shared';

export const CYCLE_STAGES = ['Birahi', 'IB', 'PKB', 'Bunting', 'Lahir'] as const;

/** Indeks tahap sekarang (-1 = belum mulai siklus). */
export function stageOf(kind: ReproStatusKind): number {
  switch (kind) {
    case 'birahi':
      return 0;
    case 'sudah_IB_menunggu_PKB':
      return 1;
    case 'bunting':
      return 3;
    case 'keguguran':
      return 3;
    case 'sudah_lahir':
      return 4;
    case 'kosong':
    case 'keluar':
      return -1;
  }
}

export function cycleTrackLabel(kind: ReproStatusKind): string {
  if (kind === 'keluar') return 'Siklus: ternak sudah keluar';
  if (kind === 'keguguran') return 'Siklus: berhenti di tahap Bunting karena keguguran';
  const stage = stageOf(kind);
  if (stage < 0) return 'Siklus: belum ada birahi tercatat';
  return `Siklus: tahap ${CYCLE_STAGES[stage] ?? ''} (${String(stage + 1)} dari ${String(CYCLE_STAGES.length)})`;
}
