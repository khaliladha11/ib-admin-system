import type { UserRole } from '@ib/shared';
import {
  BellRing,
  ClipboardList,
  Ellipsis,
  House,
  Inbox,
  LayoutDashboard,
  PawPrint,
  ScanQrCode,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to:
    | '/'
    | '/ternak'
    | '/scan'
    | '/tugas'
    | '/lainnya'
    | '/permintaan'
    | '/tindak-lanjut'
    | '/peternak'
    | '/pengguna';
  label: string;
  /** Label pendek untuk navigasi bawah HP (lebar ±72px per item). */
  shortLabel?: string;
  icon: LucideIcon;
}

/** Navigasi lapangan (peternak, petugas): urutan sama di HP (bawah) dan PC (sidebar). */
export const FIELD_NAV: readonly NavItem[] = [
  { to: '/', label: 'Beranda', icon: House },
  { to: '/ternak', label: 'Ternak', icon: PawPrint },
  { to: '/scan', label: 'Scan', icon: ScanQrCode },
  { to: '/tugas', label: 'Tugas', icon: ClipboardList },
  { to: '/lainnya', label: 'Lainnya', icon: Ellipsis },
];

/** Navigasi admin di HP: lima menu terpenting; peternak dan pengguna lewat Lainnya. */
export const ADMIN_NAV_BOTTOM: readonly NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/permintaan', label: 'Permintaan', shortLabel: 'Layanan', icon: Inbox },
  { to: '/tindak-lanjut', label: 'Tindak lanjut', shortLabel: 'Terlambat', icon: BellRing },
  { to: '/ternak', label: 'Ternak', icon: PawPrint },
  { to: '/lainnya', label: 'Lainnya', icon: Ellipsis },
];

/** Navigasi admin di PC (sidebar). */
export const ADMIN_NAV_SIDE: readonly NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/permintaan', label: 'Permintaan', icon: Inbox },
  { to: '/tindak-lanjut', label: 'Tindak lanjut', icon: BellRing },
  { to: '/ternak', label: 'Ternak', icon: PawPrint },
  { to: '/peternak', label: 'Peternak', icon: Users },
  { to: '/pengguna', label: 'Pengguna', icon: UserCog },
  { to: '/lainnya', label: 'Lainnya', icon: Ellipsis },
];

export const isAdminRole = (role: UserRole | undefined) =>
  role === 'group_admin' || role === 'agency_admin';

export function navItemsFor(role: UserRole | undefined, place: 'bottom' | 'side') {
  if (!isAdminRole(role)) return FIELD_NAV;
  return place === 'bottom' ? ADMIN_NAV_BOTTOM : ADMIN_NAV_SIDE;
}

/** Judul bilah atas untuk alamat yang dibuka (bila rute tidak memberi judul sendiri). */
export function titleFor(pathname: string): string {
  if (pathname.startsWith('/dev/komponen')) return 'Komponen';
  const item = [...FIELD_NAV, ...ADMIN_NAV_SIDE]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));
  return item?.label ?? 'IB Ternak';
}
