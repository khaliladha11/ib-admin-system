// Kalimat status sinkron: satu keadaan terpenting saja.
import {
  CloudCheck,
  CloudOff,
  KeyRound,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

export interface SyncState {
  online: boolean;
  pending: number;
  rejected: number;
  /** Event yang perlu dicek (ditolak karena urutan riwayat). */
  reviews?: number;
  needsLogin: boolean;
}

interface View {
  kind: 'ok' | 'sending' | 'offline' | 'review' | 'rejected' | 'login';
  icon: LucideIcon;
  text: string;
  className: string;
}

/** Satu kalimat yang paling penting untuk keadaan sinkron saat ini. */
export function describeSync({
  online,
  pending,
  rejected,
  reviews = 0,
  needsLogin,
}: SyncState): View {
  const unsent = pending > 0 ? `${String(pending)} belum terkirim` : null;
  if (needsLogin) {
    return {
      kind: 'login',
      icon: KeyRound,
      text: 'Masuk lagi untuk mengirim data',
      className: 'text-alarm',
    };
  }
  if (!online) {
    return {
      kind: 'offline',
      icon: CloudOff,
      text: unsent ? `Tanpa sinyal, ${unsent}` : 'Tanpa sinyal',
      className: 'text-soil',
    };
  }
  if (reviews > 0) {
    return {
      kind: 'review',
      icon: TriangleAlert,
      text: `${String(reviews)} perlu dicek`,
      className: 'text-soil',
    };
  }
  if (rejected > 0) {
    return {
      kind: 'rejected',
      icon: TriangleAlert,
      text: `${String(rejected)} catatan tidak diterima`,
      className: 'text-alarm',
    };
  }
  if (pending > 0) {
    return {
      kind: 'sending',
      icon: RefreshCw,
      text: `Mengirim ${String(pending)} catatan`,
      className: 'text-info',
    };
  }
  return { kind: 'ok', icon: CloudCheck, text: 'Semua data terkirim', className: 'text-primary' };
}
