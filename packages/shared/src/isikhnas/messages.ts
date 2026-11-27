// Pesan SMS iSIKHNAS dari event (langkah 6.3). Fungsi murni. Format:
//   BH  [ID hewan]
//   IB  [ID pemilik] [ID hewan] [ID bull] [batch]
//   PKB [ID pemilik] [ID hewan] [bulan]          (tidak bunting → 0)
//   KGG [ID pemilik] [ID hewan] [trimester]
//   LH  [ID pemilik] [ID hewan] [kelamin J/B] [ID anak]   (satu pesan per anak)
//   BB  [ID pemilik] [ID hewan] [bobot kg]
// ID pemilik dan ID hewan = ID resmi iSIKHNAS (kolom isikhnasOwnerId / isikhnasAnimalId), bukan id
// aplikasi. Bila ada yang kosong, pesan tidak dibuat dan bagian yang kurang disebutkan.
import type { DomainEvent } from '../domain/timeline';

/** Jenis event yang dilaporkan ke iSIKHNAS. */
export const ISIKHNAS_EVENT_TYPES = ['BH', 'IB', 'PKB', 'KGG', 'LH', 'BB'] as const;
export type IsikhnasEventType = (typeof ISIKHNAS_EVENT_TYPES)[number];

export const isIsikhnasEvent = (e: Pick<DomainEvent, 'type'>): boolean =>
  (ISIKHNAS_EVENT_TYPES as readonly string[]).includes(e.type);

export type IsikhnasMissing = 'owner' | 'animal' | 'calf' | 'value';

export interface IsikhnasIds {
  /** ID pemilik iSIKHNAS peternak pemilik ternak. */
  ownerId: string | null;
  /** ID hewan iSIKHNAS ternak ini. */
  animalId: string | null;
  /** ID hewan iSIKHNAS untuk anak (id ternak aplikasi → ID iSIKHNAS). */
  calfIds?: ReadonlyMap<string, string | null>;
}

export interface IsikhnasMessage {
  /** Teks siap kirim, atau null bila data belum lengkap. */
  text: string | null;
  missing: IsikhnasMissing[];
}

/** ID dibersihkan: tanpa spasi (SMS dipisah spasi). */
const clean = (id: string | null | undefined) => {
  const v = (id ?? '').replace(/\s+/g, '');
  return v.length > 0 ? v : null;
};

const num = (n: number) => String(Math.round(n * 10) / 10);

function build(parts: (string | null)[], missing: IsikhnasMissing[]): IsikhnasMessage {
  return missing.length > 0 || parts.some((p) => p === null)
    ? { text: null, missing: missing.length > 0 ? missing : ['value'] }
    : { text: parts.join(' '), missing: [] };
}

/** Pesan untuk satu event; LH kembar menghasilkan satu pesan per anak. HEALTH/EXIT: kosong. */
export function isikhnasMessages(event: DomainEvent, ids: IsikhnasIds): IsikhnasMessage[] {
  const owner = clean(ids.ownerId);
  const animal = clean(ids.animalId);
  const need = (withOwner: boolean): IsikhnasMissing[] => [
    ...(withOwner && !owner ? (['owner'] as const) : []),
    ...(!animal ? (['animal'] as const) : []),
  ];
  switch (event.type) {
    case 'BH':
      return [build(['BH', animal], need(false))];
    case 'IB':
      return [
        build(
          ['IB', owner, animal, clean(event.payload.bullId), clean(event.payload.batch)],
          need(true),
        ),
      ];
    case 'PKB': {
      const months =
        event.payload.result === 'pregnant'
          ? event.payload.fetalAgeMonths === undefined
            ? null
            : num(event.payload.fetalAgeMonths)
          : '0';
      return [build(['PKB', owner, animal, months], need(true))];
    }
    case 'KGG':
      return [build(['KGG', owner, animal, String(event.payload.trimester)], need(true))];
    case 'LH':
      return event.payload.calves.map((calf) => {
        const sex = calf.sex === 'M' ? 'J' : 'B';
        // Anak lahir mati tidak didaftarkan sebagai ternak, jadi tanpa ID anak.
        if (calf.condition !== 'alive') return build(['LH', owner, animal, sex], need(true));
        const calfId = clean(calf.calfAnimalId ? ids.calfIds?.get(calf.calfAnimalId) : null);
        return build(
          ['LH', owner, animal, sex, calfId ?? ''],
          [...need(true), ...(!calfId ? (['calf'] as const) : [])],
        );
      });
    case 'BB':
      return [build(['BB', owner, animal, num(event.payload.weightKg)], need(true))];
    default:
      return [];
  }
}

export const MISSING_TEXT: Record<IsikhnasMissing, string> = {
  owner: 'ID pemilik iSIKHNAS peternak',
  animal: 'ID hewan iSIKHNAS',
  calf: 'ID hewan iSIKHNAS anak',
  value: 'isian catatan (mis. umur janin)',
};
