// Data contoh fiktif untuk /dev/komponen. Status dihitung dengan deriveReproStatus,
// sama seperti data sungguhan, supaya tampilannya jujur.
import { deriveReproStatus, type AnimalEvent, type EventBody } from '@ib/shared';

import type { AnimalView } from '@/data';

const DAY = 86_400_000;
export const SAMPLE_TODAY = Date.UTC(2026, 10, 25, 3);
let n = 0;
const id = () => `0193f000-0000-7000-8000-${String((n += 1)).padStart(12, '0')}`;

function ev(daysAgo: number, body: EventBody): AnimalEvent {
  const t = SAMPLE_TODAY - daysAgo * DAY;
  return {
    id: id(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    deviceId: 'contoh',
    animalId: 'contoh',
    occurredAt: t,
    recordedBy: 'contoh',
    serviceRequestId: null,
    semenStockId: null,
    voidsEventId: null,
    ...body,
  };
}

const ib: EventBody = {
  type: 'IB',
  payload: { strawCode: 'SIM-2025-100', bullId: 'BULL-07', batch: 'B12' },
};
const pkb: EventBody = { type: 'PKB', payload: { result: 'pregnant', fetalAgeMonths: 2 } };

function animal(
  name: string | null,
  qrCode: string | null,
  events: AnimalEvent[],
  extra: Partial<AnimalView> = {},
): AnimalView {
  return {
    id: id(),
    createdAt: SAMPLE_TODAY,
    updatedAt: SAMPLE_TODAY,
    deletedAt: null,
    deviceId: 'contoh',
    farmerId: 'contoh',
    damId: null,
    name,
    sex: 'F',
    breed: 'Simental',
    birthDate: '2022-03-01',
    sireCode: null,
    isikhnasAnimalId: null,
    status: deriveReproStatus(events, SAMPLE_TODAY).status,
    qrCode,
    farmerName: 'Pak Suparman',
    unsynced: false,
    ...extra,
  };
}

export const SAMPLE_ANIMALS: { animal: AnimalView; next?: string }[] = [
  { animal: animal('Melati', 'IB-7K3QX', []), next: 'Belum ada catatan birahi' },
  {
    animal: animal(
      'Mawar',
      'IB-H4N2P',
      [ev(0, { type: 'BH', payload: { signs: ['lendir_bening'] } })],
      { unsynced: true },
    ),
    next: 'Segera IB, hari ini',
  },
  {
    animal: animal('Kenanga', 'IB-R8T5M', [ev(50, ib), ev(29, ib)], { breed: 'Limousin' }),
    next: 'PKB 24 Januari 2027',
  },
  {
    animal: animal('Anggrek', 'IB-W2C9D', [ev(130, ib), ev(70, pkb)], {
      farmerName: 'Bu Siti Aminah',
    }),
    next: 'Perkiraan lahir 13–30 Agustus 2027',
  },
  {
    animal: animal('Dahlia', null, [
      ev(150, ib),
      ev(90, pkb),
      ev(5, { type: 'KGG', payload: { trimester: 2 } }),
    ]),
  },
  {
    animal: animal('Kamboja', 'IB-M6V3J', [
      ev(300, ib),
      ev(240, pkb),
      ev(20, { type: 'LH', payload: { calves: [{ sex: 'M', condition: 'stillborn' }] } }),
    ]),
    next: 'Perkiraan birahi 4 Januari 2027',
  },
  {
    animal: animal('Jalak', 'IB-P9X4L', [ev(10, { type: 'EXIT', payload: { reason: 'sold' } })], {
      sex: 'M',
      breed: 'PO',
    }),
  },
];
