import type { ServiceRequest } from '@ib/shared';
import { describe, expect, it } from 'vitest';

import type { ServiceRequestView } from '@/data';

import { filterRequests } from './request-filter';

const view = (
  status: ServiceRequest['status'],
  type: ServiceRequest['type'],
  extra: Partial<ServiceRequestView> = {},
): ServiceRequestView => ({
  request: { id: `${status}-${type}`, status, type } as ServiceRequest,
  animalName: 'Melati',
  qrCode: 'IB-7K3QX',
  farmerName: 'Suparman',
  locationName: 'Desa Sukamaju',
  farmerLocationId: 'desa-1',
  farmerPhone: null,
  activeAssignment: null,
  inseminatorName: null,
  inseminatorPhone: null,
  requestedByName: null,
  assignedToMe: false,
  unsynced: false,
  ...extra,
});

const list = [
  view('submitted', 'IB'),
  view('assigned', 'IB', { inseminatorName: 'Andi Pratama' }),
  view('done', 'PKB', { farmerLocationId: 'desa-2', animalName: 'Mawar', qrCode: 'IB-H4N2P' }),
  view('rejected', 'IB'),
];
const ids = (v: ServiceRequestView[]) => v.map((x) => x.request.id);

describe('filterRequests', () => {
  it('status tunggal dan "belum selesai"', () => {
    expect(ids(filterRequests(list, { status: 'submitted' }))).toEqual(['submitted-IB']);
    expect(ids(filterRequests(list, { status: 'aktif' }))).toEqual(['submitted-IB', 'assigned-IB']);
  });

  it('jenis dan desa', () => {
    expect(ids(filterRequests(list, { jenis: 'PKB' }))).toEqual(['done-PKB']);
    expect(ids(filterRequests(list, { desa: 'desa-2' }))).toEqual(['done-PKB']);
  });

  it('cari kode QR tanpa tanda hubung, atau nama petugas', () => {
    expect(ids(filterRequests(list, { q: 'ibh4n2p' }))).toEqual(['done-PKB']);
    expect(ids(filterRequests(list, { q: 'andi' }))).toEqual(['assigned-IB']);
  });
});
