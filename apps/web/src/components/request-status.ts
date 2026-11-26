// Label dan tampilan status permintaan layanan (IB/PKB).
import type { ServiceRequestStatus } from '@ib/shared';
import {
  Ban,
  CircleCheck,
  Hourglass,
  UserCheck,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

export const REQUEST_STATUS_META: Record<
  ServiceRequestStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  submitted: {
    label: 'Menunggu verifikasi',
    icon: Hourglass,
    className: 'bg-(--st-keguguran-bg) text-(--st-keguguran-fg) border-(--st-keguguran-line)',
  },
  assigned: {
    label: 'Sudah ditugaskan',
    icon: UserCheck,
    className: 'bg-(--st-ib-bg) text-(--st-ib-fg) border-(--st-ib-line)',
  },
  in_progress: {
    label: 'Sedang dikerjakan',
    icon: Wrench,
    className: 'bg-(--st-ib-bg) text-(--st-ib-fg) border-(--st-ib-line)',
  },
  done: {
    label: 'Selesai',
    icon: CircleCheck,
    className: 'bg-(--st-bunting-bg) text-(--st-bunting-fg) border-(--st-bunting-line)',
  },
  rejected: {
    label: 'Ditolak',
    icon: XCircle,
    className: 'bg-card text-alarm border-alarm',
  },
  cancelled: {
    label: 'Dibatalkan',
    icon: Ban,
    className: 'bg-(--st-keluar-bg) text-(--st-keluar-fg) border-(--st-keluar-line)',
  },
};

export const ROLE_LABEL = {
  farmer: 'Peternak',
  inseminator: 'Petugas IB',
  group_admin: 'Admin kelompok',
  agency_admin: 'Admin dinas',
} as const;
