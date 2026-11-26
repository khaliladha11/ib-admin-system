// Fungsi murni layar 2.2: penyaring daftar ternak dan pengelompokan pengingat per desa.
import { describe, expect, it } from 'vitest';

import type { AnimalView, ReminderView } from '@/data';

import { countByStatus, filterAnimals } from './animal-filter';
import { SAMPLE_ANIMALS } from './dev-samples';
import { groupByVillage } from './reminder-groups';

const animals: AnimalView[] = SAMPLE_ANIMALS.map(({ animal }) => animal);

describe('filterAnimals', () => {
  it('cari nama tanpa peduli huruf besar', () => {
    expect(filterAnimals(animals, 'mela', 'semua').map((a) => a.name)).toEqual(['Melati']);
  });

  it('cari kode QR tanpa tanda hubung, juga sebagian', () => {
    expect(filterAnimals(animals, 'ib7k3', 'semua').map((a) => a.name)).toEqual(['Melati']);
    expect(filterAnimals(animals, 'H4N2P', 'semua').map((a) => a.name)).toEqual(['Mawar']);
  });

  it('cari nama peternak', () => {
    expect(filterAnimals(animals, 'siti', 'semua').map((a) => a.name)).toEqual(['Anggrek']);
  });

  it('filter status', () => {
    expect(filterAnimals(animals, '', 'bunting').map((a) => a.name)).toEqual(['Anggrek']);
    expect(filterAnimals(animals, 'mawar', 'bunting')).toEqual([]);
  });

  it('jumlah per status mengikuti pencarian', () => {
    const counts = countByStatus(animals, '');
    expect(counts.get('semua')).toBe(animals.length);
    expect(counts.get('birahi')).toBe(1);
    expect(countByStatus(animals, 'melati').get('semua')).toBe(1);
  });
});

describe('groupByVillage', () => {
  const item = (village: string | null, overdue: boolean, name: string): ReminderView => ({
    kind: overdue ? 'IB_RESULT_OVERDUE' : 'ESTRUS_EXPECTED',
    overdue,
    dueAt: 0,
    overdueDays: overdue ? 3 : null,
    message: '',
    animal: {
      id: name,
      name,
      qrCode: null,
      farmerId: 'f',
      farmerName: null,
      locationId: village,
      locationName: village,
    },
  });

  it('desa dengan pengingat terlambat didahulukan, lalu urut nama; tanpa desa digabung', () => {
    const groups = groupByVillage([
      item('Desa Mekarsari', false, 'A'),
      item('Desa Sukamaju', true, 'B'),
      item('Desa Cibening', false, 'C'),
      item(null, false, 'D'),
      item('Desa Mekarsari', false, 'E'),
    ]);
    expect(groups.map((g) => [g.name, g.items.length])).toEqual([
      ['Desa Sukamaju', 1],
      ['Desa Cibening', 1],
      ['Desa Mekarsari', 2],
      ['Tanpa desa', 1],
    ]);
  });
});
