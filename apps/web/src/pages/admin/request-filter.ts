// Penyaring tabel permintaan (dashboard admin).
import type { ServiceRequestStatus } from '@ib/shared';

import type { ServiceRequestView } from '@/data';
import { normalizeSearch } from '@/lib/format';

export interface RequestFilter {
  status?: ServiceRequestStatus | 'aktif';
  jenis?: 'IB' | 'PKB';
  desa?: string;
  q?: string;
}

const OPEN = new Set<ServiceRequestStatus>(['submitted', 'assigned', 'in_progress']);

export function filterRequests(views: ServiceRequestView[], f: RequestFilter) {
  const q = normalizeSearch(f.q ?? '');
  return views.filter((v) => {
    const s = v.request.status;
    if (f.status === 'aktif' ? !OPEN.has(s) : f.status && s !== f.status) return false;
    if (f.jenis && v.request.type !== f.jenis) return false;
    if (f.desa && v.farmerLocationId !== f.desa) return false;
    if (!q) return true;
    return [v.animalName, v.qrCode, v.farmerName, v.inseminatorName]
      .filter((t): t is string => !!t)
      .some((t) => normalizeSearch(t).includes(q));
  });
}
