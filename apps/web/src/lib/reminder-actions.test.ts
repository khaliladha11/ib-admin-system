import { describe, expect, it } from 'vitest';

import { reminderAction } from './reminder-actions';

describe('reminderAction', () => {
  it('peternak: hasil IB terlambat → ajakan minta PKB ke petugas', () => {
    expect(reminderAction('IB_RESULT_OVERDUE', 'farmer', 'a1')).toEqual({
      title: 'Sudah lebih dari 3 bulan sejak IB, belum diperiksa bunting',
      action: {
        label: 'Minta PKB',
        target: { to: '/tugas/ajukan', search: { ternak: 'a1', jenis: 'PKB' } },
      },
    });
  });

  it('petugas: hasil IB terlambat → catat PKB langsung', () => {
    expect(reminderAction('IB_RESULT_OVERDUE', 'inseminator', 'a1').action).toEqual({
      label: 'Catat PKB',
      target: {
        to: '/ternak/$animalId/catat',
        params: { animalId: 'a1' },
        search: { jenis: 'PKB' },
      },
    });
  });

  it('kelahiran terlambat: semua peran bisa mencatat lahir; peternak ditanya dengan bahasa sederhana', () => {
    expect(reminderAction('BIRTH_REPORT_OVERDUE', 'farmer', 'a1')).toMatchObject({
      title: 'Sudah lewat perkiraan lahir. Sudah lahir?',
      action: { label: 'Catat lahir' },
    });
    expect(reminderAction('BIRTH_REPORT_OVERDUE', 'inseminator', 'a1').title).toBe(
      'Kelahiran belum dilaporkan',
    );
  });

  it('perkiraan lahir tidak punya tombol; perkiraan birahi → catat birahi', () => {
    expect(reminderAction('CALVING_EXPECTED', 'farmer', 'a1').action).toBeNull();
    expect(reminderAction('ESTRUS_EXPECTED', 'farmer', 'a1').action?.label).toBe('Catat birahi');
  });
});
