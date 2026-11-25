import {
  ClipboardList,
  Ellipsis,
  House,
  PawPrint,
  ScanQrCode,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: '/' | '/ternak' | '/scan' | '/tugas' | '/lainnya';
  label: string;
  icon: LucideIcon;
}

/** Navigasi utama, urutan sama di HP (bawah) dan PC (sidebar). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Beranda', icon: House },
  { to: '/ternak', label: 'Ternak', icon: PawPrint },
  { to: '/scan', label: 'Scan', icon: ScanQrCode },
  { to: '/tugas', label: 'Tugas', icon: ClipboardList },
  { to: '/lainnya', label: 'Lainnya', icon: Ellipsis },
];

/** Judul bilah atas untuk alamat yang dibuka. */
export function titleFor(pathname: string): string {
  if (pathname.startsWith('/dev/komponen')) return 'Komponen';
  const item = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));
  return item?.label ?? 'IB Ternak';
}
