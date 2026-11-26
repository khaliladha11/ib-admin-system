// Label, ikon, dan ringkasan isi setiap jenis event untuk linimasa dan form.
import type { AnimalEvent, EventBody } from '@ib/shared';
import {
  Flame,
  HeartPulse,
  LogOut,
  Scale,
  Sprout,
  Stethoscope,
  Syringe,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { SIGN_LABEL } from './event-form-model';

export const EVENT_META: Record<EventBody['type'], { label: string; icon: LucideIcon }> = {
  BH: { label: 'Birahi', icon: Flame },
  IB: { label: 'Inseminasi (IB)', icon: Syringe },
  PKB: { label: 'Periksa bunting (PKB)', icon: Stethoscope },
  KGG: { label: 'Keguguran', icon: TriangleAlert },
  LH: { label: 'Lahir', icon: Sprout },
  BB: { label: 'Berat badan', icon: Scale },
  HEALTH: { label: 'Kesehatan', icon: HeartPulse },
  EXIT: { label: 'Keluar', icon: LogOut },
};

const EXIT_LABEL = { died: 'mati', sold: 'dijual', slaughtered: 'dipotong', other: 'lainnya' };
const SEX = { F: 'betina', M: 'jantan' };

/** Ringkasan isi event dalam satu-dua kalimat. */
export function describeEventDetail(
  event: Pick<AnimalEvent, 'type' | 'payload'> & EventBody,
): string {
  switch (event.type) {
    case 'BH': {
      const signs = (event.payload.signs ?? []).map((s) => SIGN_LABEL[s].toLowerCase());
      return signs.length > 0 ? `Tanda: ${signs.join(', ')}` : 'Tanpa catatan tanda';
    }
    case 'IB':
      return `Straw ${event.payload.strawCode}, pejantan ${event.payload.bullName ?? event.payload.bullId}, batch ${event.payload.batch}`;
    case 'PKB':
      return event.payload.result === 'pregnant'
        ? `Bunting, umur janin ${String(event.payload.fetalAgeMonths ?? '?')} bulan${event.payload.method === 'usg' ? ' (USG)' : event.payload.method === 'palpation' ? ' (palpasi)' : ''}`
        : 'Tidak bunting';
    case 'KGG':
      return `Trimester ${String(event.payload.trimester)}`;
    case 'LH':
      return event.payload.calves
        .map(
          (c, i) =>
            `${event.payload.calves.length > 1 ? `Anak ${String(i + 1)}: ` : 'Anak '}${SEX[c.sex]}, ${c.condition === 'alive' ? 'hidup' : 'mati saat lahir'}${c.weightKg ? `, ${String(c.weightKg)} kg` : ''}`,
        )
        .join('; ');
    case 'BB':
      return `${String(event.payload.weightKg)} kg${event.payload.method === 'tape' ? ' (pita ukur)' : ''}`;
    case 'HEALTH':
      return [event.payload.condition, event.payload.treatment].filter(Boolean).join(', ');
    case 'EXIT':
      return `Ternak ${EXIT_LABEL[event.payload.reason]}`;
  }
}
