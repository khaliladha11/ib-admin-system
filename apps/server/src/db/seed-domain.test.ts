// Data contoh harus konsisten dengan logika domain (langkah 1.3): setiap skenario
// menghasilkan status sesuai namanya dan seluruh riwayatnya lolos validasi.
import {
  computeSchedule,
  deriveReproStatus,
  validateNextEvent,
  type AnimalEvent,
  type ReproStatusKind,
} from '@ib/shared';
import { describe, expect, it } from 'vitest';

import { buildSeedData, type Scenario } from './seed';

const NOW = Date.UTC(2026, 10, 25, 3, 0, 0);
const data = buildSeedData(NOW);

const eventsOf = (animalId: string) => data.events.filter((e) => e.animalId === animalId);

const EXPECTED: Record<Scenario, ReproStatusKind> = {
  kosong: 'kosong',
  birahi: 'birahi',
  menunggu_pkb: 'sudah_IB_menunggu_PKB',
  ib_terlambat: 'sudah_IB_menunggu_PKB',
  bunting: 'bunting',
  bunting_terlambat: 'bunting',
  keguguran: 'keguguran',
  sudah_lahir: 'sudah_lahir',
  ib_berulang: 'bunting',
  keluar: 'keluar',
  sakit: 'kosong',
  koreksi: 'kosong',
};

const cases = Object.entries(data.scenarios).map(([animalId, scenario]) => ({
  animalId,
  scenario,
  name: data.animals.find((a) => a.id === animalId)?.name ?? animalId,
}));

describe('seed × logika domain', () => {
  it('punya skenario untuk 34 sapi betina dewasa', () => {
    expect(cases).toHaveLength(34);
  });

  it.each(cases)('$name ($scenario) berstatus sesuai skenario', ({ animalId, scenario }) => {
    expect(deriveReproStatus(eventsOf(animalId), NOW).status.kind).toBe(EXPECTED[scenario]);
  });

  it('IB berulang tercatat sebagai IB ke-2 saat bunting', () => {
    for (const { animalId } of cases.filter((c) => c.scenario === 'ib_berulang')) {
      const { status } = deriveReproStatus(eventsOf(animalId), NOW);
      expect(status.kind === 'bunting' && status.serviceNumber).toBe(2);
    }
  });

  it('pengingat 3 bulan hanya untuk skenario ib_terlambat', () => {
    for (const { animalId, scenario } of cases) {
      const codes = computeSchedule(eventsOf(animalId), NOW).reminders.map((r) => r.code);
      expect(codes.includes('IB_RESULT_OVERDUE'), scenario).toBe(scenario === 'ib_terlambat');
    }
  });

  it('pengingat kelahiran hanya untuk skenario bunting_terlambat', () => {
    for (const { animalId, scenario } of cases) {
      const codes = computeSchedule(eventsOf(animalId), NOW).reminders.map((r) => r.code);
      expect(codes.includes('BIRTH_REPORT_OVERDUE'), scenario).toBe(
        scenario === 'bunting_terlambat',
      );
    }
  });

  it('seluruh riwayat (termasuk anak sapi dan pejantan) tanpa anomali', () => {
    for (const animal of data.animals) {
      expect(
        deriveReproStatus(eventsOf(animal.id), NOW).anomalies,
        animal.name ?? animal.id,
      ).toEqual([]);
    }
  });

  it('setiap event lolos validateNextEvent terhadap event sebelumnya', () => {
    for (const animal of data.animals) {
      const history: AnimalEvent[] = [];
      const ordered = [...eventsOf(animal.id)].sort((a, b) => a.occurredAt - b.occurredAt);
      for (const event of ordered) {
        const result = validateNextEvent(history, event);
        expect(result.errors, `${animal.name ?? animal.id}: ${event.type}`).toEqual([]);
        history.push(event);
      }
    }
  });
});
