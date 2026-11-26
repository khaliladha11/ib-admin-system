// Judul dan tombol tindakan pengingat, sesuai peran. Peternak tidak mencatat PKB sendiri,
// jadi untuk peternak "hasil IB belum dilaporkan" menjadi ajakan meminta PKB ke petugas.
import type { ReminderKind, UserRole } from '@ib/shared';

export type ReminderTarget =
  | { to: '/tugas/ajukan'; search: { ternak: string; jenis: 'IB' | 'PKB' } }
  | {
      to: '/ternak/$animalId/catat';
      params: { animalId: string };
      search: { jenis: 'PKB' | 'LH' | 'BH' };
    };

export interface ReminderAction {
  title: string;
  action: { label: string; target: ReminderTarget } | null;
}

export function reminderAction(
  kind: ReminderKind,
  role: UserRole | undefined,
  animalId: string,
): ReminderAction {
  const farmer = role === 'farmer';
  const askPkb = {
    label: 'Minta PKB',
    target: { to: '/tugas/ajukan', search: { ternak: animalId, jenis: 'PKB' } } as const,
  };
  const record = (jenis: 'PKB' | 'LH' | 'BH', label: string) => ({
    label,
    target: { to: '/ternak/$animalId/catat', params: { animalId }, search: { jenis } } as const,
  });

  switch (kind) {
    case 'IB_RESULT_OVERDUE':
      return farmer
        ? { title: 'Sudah lebih dari 3 bulan sejak IB, belum diperiksa bunting', action: askPkb }
        : { title: 'Hasil IB belum dilaporkan', action: record('PKB', 'Catat PKB') };
    case 'BIRTH_REPORT_OVERDUE':
      return {
        title: farmer ? 'Sudah lewat perkiraan lahir. Sudah lahir?' : 'Kelahiran belum dilaporkan',
        action: record('LH', 'Catat lahir'),
      };
    case 'PKB_DUE':
      return farmer
        ? { title: 'Waktunya periksa bunting (PKB)', action: askPkb }
        : { title: 'Jadwal periksa bunting (PKB)', action: record('PKB', 'Catat PKB') };
    case 'ESTRUS_EXPECTED':
      return { title: 'Perkiraan birahi', action: record('BH', 'Catat birahi') };
    case 'CALVING_EXPECTED':
      return { title: 'Perkiraan lahir', action: null };
  }
}
