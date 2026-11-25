// Helper khusus tes: membuat event relatif terhadap TODAY. Tidak diekspor dari paket.
import type { EventBody } from '../schemas/events';
import type { DomainEvent } from './timeline';

export const DAY = 86_400_000;
export const TODAY = Date.UTC(2026, 10, 25, 12, 0, 0);
export const ANIMAL_ID = '0193f000-0000-7000-8000-000000000001';

let counter = 0;

/** Event `daysAgo` hari sebelum TODAY. ID terurut menurut urutan pembuatan. */
export function ev(
  daysAgo: number,
  body: EventBody,
  extra: Partial<Pick<DomainEvent, 'id' | 'animalId' | 'voidsEventId' | 'deletedAt'>> = {},
): DomainEvent {
  counter += 1;
  return {
    id: `0193f000-0000-7000-8000-${String(counter).padStart(12, '0')}`,
    animalId: ANIMAL_ID,
    occurredAt: TODAY - daysAgo * DAY,
    voidsEventId: null,
    deletedAt: null,
    ...body,
    ...extra,
  };
}

export const bh = (d: number) => ev(d, { type: 'BH', payload: {} });
export const ib = (d: number) =>
  ev(d, { type: 'IB', payload: { strawCode: 'S-1', bullId: 'BULL-1', batch: 'B-1' } });
export const pkbPos = (d: number, fetalAgeMonths = 2) =>
  ev(d, { type: 'PKB', payload: { result: 'pregnant', fetalAgeMonths } });
export const pkbNeg = (d: number) => ev(d, { type: 'PKB', payload: { result: 'not_pregnant' } });
export const kgg = (d: number) => ev(d, { type: 'KGG', payload: { trimester: 2 } });
export const lh = (d: number) =>
  ev(d, {
    type: 'LH',
    payload: {
      calves: [
        { sex: 'F', condition: 'alive', calfAnimalId: '0193f000-0000-7000-8000-0000000000ff' },
      ],
    },
  });
export const bb = (d: number, weightKg = 300) => ev(d, { type: 'BB', payload: { weightKg } });
export const health = (d: number) => ev(d, { type: 'HEALTH', payload: { condition: 'Diare' } });
export const exit = (d: number) => ev(d, { type: 'EXIT', payload: { reason: 'sold' } });
