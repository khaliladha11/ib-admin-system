// Statistik kesuburan untuk halaman Laporan (langkah 6.2). Fungsi murni: dihitung dari event,
// sama di HP dan server. Definisi (juga ditampilkan di halaman):
//
//   Layanan IB  = satu IB; IB ulang dalam SAME_HEAT_IB_DAYS (masa birahi yang sama) dihitung satu.
//   Hasil layanan:
//     bunting      → diikuti PKB bunting, atau lahir/keguguran, sebelum IB berikutnya;
//     tidak bunting → diikuti PKB tidak bunting, birahi lagi, atau IB lagi (birahi berikutnya);
//     belum tahu   → belum ada hasil (tidak ikut dihitung).
//   S/C (service per conception) = layanan yang sudah ada hasilnya ÷ jumlah kebuntingan.
//   CR (conception rate)          = IB pertama yang bunting ÷ IB pertama yang sudah ada hasilnya × 100%.
//   IB pertama = layanan pertama sejak sapi melahirkan/keguguran (atau sejak tercatat).
import { DAY_MS, SAME_HEAT_IB_DAYS } from '../domain/constants';
import { effectiveEvents, type DomainEvent } from '../domain/timeline';

export type ServiceOutcome = 'conceived' | 'not_conceived' | 'pending';

/** Event dengan pencatatnya (petugas yang melakukan IB). */
export type RecordedEvent = DomainEvent & { recordedBy: string };

export interface ServiceRecord {
  animalId: string;
  /** IB pertama dari layanan ini (IB ulang di birahi yang sama tidak membuat layanan baru). */
  ibEventId: string;
  at: number;
  inseminatorId: string;
  /** Layanan ke-berapa sejak melahirkan/keguguran. */
  serviceNumber: number;
  first: boolean;
  outcome: ServiceOutcome;
}

/** Semua layanan IB beserta hasilnya, dari event semua ternak. */
export function serviceRecords(events: readonly RecordedEvent[]): ServiceRecord[] {
  const byAnimal = new Map<string, RecordedEvent[]>();
  for (const e of events) {
    const list = byAnimal.get(e.animalId);
    if (list) list.push(e);
    else byAnimal.set(e.animalId, [e]);
  }
  const out: ServiceRecord[] = [];
  for (const list of byAnimal.values()) {
    let count = 0;
    let open: ServiceRecord | null = null;
    let lastIbAt = 0;
    const close = (outcome: ServiceOutcome) => {
      if (open?.outcome === 'pending') open.outcome = outcome;
    };
    for (const e of effectiveEvents(list)) {
      switch (e.type) {
        case 'IB': {
          const sameHeat =
            open?.outcome === 'pending' && e.occurredAt - lastIbAt <= SAME_HEAT_IB_DAYS * DAY_MS;
          lastIbAt = e.occurredAt;
          if (sameHeat) break;
          close('not_conceived');
          count += 1;
          open = {
            animalId: e.animalId,
            ibEventId: e.id,
            at: e.occurredAt,
            inseminatorId: e.recordedBy,
            serviceNumber: count,
            first: count === 1,
            outcome: 'pending',
          };
          out.push(open);
          break;
        }
        case 'BH':
          if (open?.outcome === 'pending' && e.occurredAt - lastIbAt > SAME_HEAT_IB_DAYS * DAY_MS) {
            close('not_conceived');
          }
          break;
        case 'PKB':
          close(e.payload.result === 'pregnant' ? 'conceived' : 'not_conceived');
          break;
        case 'KGG':
        case 'LH':
          close('conceived');
          count = 0;
          open = null;
          break;
        case 'EXIT':
          open = null;
          break;
        default:
          break;
      }
    }
  }
  return out;
}

export interface FertilityStats {
  /** Semua layanan dalam kelompok, termasuk yang belum ada hasilnya. */
  services: number;
  /** Layanan yang sudah ada hasilnya. */
  known: number;
  conceptions: number;
  pending: number;
  firstServices: number;
  firstKnown: number;
  firstConceived: number;
  /** S/C, atau null bila belum ada kebuntingan. */
  sc: number | null;
  /** CR dalam persen, atau null bila belum ada IB pertama yang ada hasilnya. */
  cr: number | null;
}

export function fertilityStats(records: readonly ServiceRecord[]): FertilityStats {
  const known = records.filter((r) => r.outcome !== 'pending');
  const conceptions = known.filter((r) => r.outcome === 'conceived').length;
  const first = records.filter((r) => r.first);
  const firstKnown = first.filter((r) => r.outcome !== 'pending');
  const firstConceived = firstKnown.filter((r) => r.outcome === 'conceived').length;
  return {
    services: records.length,
    known: known.length,
    conceptions,
    pending: records.length - known.length,
    firstServices: first.length,
    firstKnown: firstKnown.length,
    firstConceived,
    sc: conceptions > 0 ? known.length / conceptions : null,
    cr: firstKnown.length > 0 ? (firstConceived / firstKnown.length) * 100 : null,
  };
}

/** Kelompokkan layanan (mis. per petugas, desa, bulan) lalu hitung statistiknya. */
export function fertilityBy<K extends string>(
  records: readonly ServiceRecord[],
  keyOf: (r: ServiceRecord) => K | null,
): { key: K; stats: FertilityStats }[] {
  const groups = new Map<K, ServiceRecord[]>();
  for (const r of records) {
    const key = keyOf(r);
    if (key === null) continue;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, stats: fertilityStats(list) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Layanan dengan tanggal IB dalam [from, to). */
export const inPeriod = (records: readonly ServiceRecord[], from: number, to: number) =>
  records.filter((r) => r.at >= from && r.at < to);
