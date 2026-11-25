// Tampilan per status reproduksi: teks, ikon, dan kelas warna (token --st-* di index.css).
// Status selalu ditampilkan dengan ikon + teks, tidak hanya warna.
import type { ReproStatus, ReproStatusKind } from '@ib/shared';
import {
  Circle,
  Flame,
  HeartPulse,
  LogOut,
  Sprout,
  Syringe,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

export interface StatusMeta {
  label: string;
  icon: LucideIcon;
  /** Latar tipis + teks gelap + garis. */
  badgeClass: string;
  /** Warna isi untuk lintasan siklus. */
  fillClass: string;
  textClass: string;
}

export const STATUS_META: Record<ReproStatusKind, StatusMeta> = {
  kosong: {
    label: 'Kosong',
    icon: Circle,
    badgeClass: 'bg-(--st-kosong-bg) text-(--st-kosong-fg) border-(--st-kosong-line)',
    fillClass: 'bg-(--st-kosong-line)',
    textClass: 'text-(--st-kosong-fg)',
  },
  birahi: {
    label: 'Birahi',
    icon: Flame,
    badgeClass: 'bg-(--st-birahi-bg) text-(--st-birahi-fg) border-(--st-birahi-line)',
    fillClass: 'bg-(--st-birahi-line)',
    textClass: 'text-(--st-birahi-fg)',
  },
  sudah_IB_menunggu_PKB: {
    label: 'Sudah IB',
    icon: Syringe,
    badgeClass: 'bg-(--st-ib-bg) text-(--st-ib-fg) border-(--st-ib-line)',
    fillClass: 'bg-(--st-ib-line)',
    textClass: 'text-(--st-ib-fg)',
  },
  bunting: {
    label: 'Bunting',
    icon: HeartPulse,
    badgeClass: 'bg-(--st-bunting-bg) text-(--st-bunting-fg) border-(--st-bunting-line)',
    fillClass: 'bg-(--st-bunting-line)',
    textClass: 'text-(--st-bunting-fg)',
  },
  keguguran: {
    label: 'Keguguran',
    icon: TriangleAlert,
    badgeClass: 'bg-(--st-keguguran-bg) text-(--st-keguguran-fg) border-(--st-keguguran-line)',
    fillClass: 'bg-(--st-keguguran-line)',
    textClass: 'text-(--st-keguguran-fg)',
  },
  sudah_lahir: {
    label: 'Sudah lahir',
    icon: Sprout,
    badgeClass: 'bg-(--st-lahir-bg) text-(--st-lahir-fg) border-(--st-lahir-line)',
    fillClass: 'bg-(--st-lahir-line)',
    textClass: 'text-(--st-lahir-fg)',
  },
  keluar: {
    label: 'Keluar',
    icon: LogOut,
    badgeClass: 'bg-(--st-keluar-bg) text-(--st-keluar-fg) border-(--st-keluar-line)',
    fillClass: 'bg-(--st-keluar-line)',
    textClass: 'text-(--st-keluar-fg)',
  },
};

/** Keterangan tambahan: "menunggu PKB, IB ke-2", "umur 4 bulan". */
export function statusDetail(status: ReproStatus): string | null {
  switch (status.kind) {
    case 'sudah_IB_menunggu_PKB':
      return status.serviceNumber > 1
        ? `menunggu PKB, IB ke-${String(status.serviceNumber)}`
        : 'menunggu PKB';
    case 'bunting':
      return `${String(status.gestationMonths)} bulan`;
    default:
      return null;
  }
}
