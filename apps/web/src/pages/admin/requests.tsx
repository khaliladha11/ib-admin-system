// Tabel permintaan layanan untuk admin: filter status/jenis/desa + cari. PC: tabel; HP: kartu.
import { SERVICE_REQUEST_STATUSES } from '@ib/shared';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronRight, CloudUpload, Inbox, Search } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { REQUEST_STATUS_META } from '@/components/request-status';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { useServiceRequestViews, type ServiceRequestView } from '@/data';
import { formatShortDate } from '@/lib/format';
import { RequestStatusBadge } from '@/components/request-status-badge';

import { filterRequests, type RequestFilter } from './request-filter';
import { useAdminScope } from './scope';

export function AdminRequestsPage() {
  const search = useSearch({ from: '/permintaan' });
  const navigate = useNavigate({ from: '/permintaan' });
  const views = useServiceRequestViews();
  const scope = useAdminScope();
  if (!views || !scope) return null;

  const set = (patch: Partial<RequestFilter>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  };
  const shown = filterRequests(views, search);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:gap-3">
        <div className="relative col-span-2 lg:col-span-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Cari permintaan"
            placeholder="Cari ternak, kode QR, peternak, petugas"
            value={search.q ?? ''}
            onChange={(e) => {
              set({ q: e.target.value || undefined });
            }}
            className="pl-10"
          />
        </div>
        <NativeSelect
          aria-label="Status"
          value={search.status ?? ''}
          onChange={(e) => {
            set({ status: (e.target.value || undefined) as RequestFilter['status'] });
          }}
        >
          <option value="">Semua status</option>
          <option value="aktif">Belum selesai</option>
          {SERVICE_REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS_META[s].label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Jenis"
          value={search.jenis ?? ''}
          onChange={(e) => {
            set({ jenis: (e.target.value || undefined) as RequestFilter['jenis'] });
          }}
        >
          <option value="">IB dan PKB</option>
          <option value="IB">IB</option>
          <option value="PKB">PKB</option>
        </NativeSelect>
        <NativeSelect
          containerClassName="col-span-2 lg:col-span-1"
          aria-label="Desa"
          value={search.desa ?? ''}
          onChange={(e) => {
            set({ desa: e.target.value || undefined });
          }}
        >
          <option value="">Semua desa</option>
          {scope.villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <p className="text-muted-foreground" aria-live="polite">
        {shown.length} dari {views.length} permintaan
      </p>

      {shown.length === 0 ? (
        <EmptyState icon={Inbox} title="Tidak ada permintaan yang cocok">
          Ubah filter di atas, atau pilih "Semua status".
        </EmptyState>
      ) : (
        <>
          <RequestTable views={shown} />
          <ul className="flex flex-col gap-2 lg:hidden">
            {shown.map((v) => (
              <li key={v.request.id}>
                <RequestCard view={v} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RequestTable({ views }: { views: ServiceRequestView[] }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border-(length:--bw) bg-card lg:block">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Daftar permintaan layanan</caption>
        <thead className="bg-secondary">
          <tr>
            {['Diajukan', 'Jenis', 'Ternak', 'Peternak', 'Status', 'Petugas', ''].map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {h || <span className="sr-only">Buka</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr key={v.request.id} className="border-t-(length:--bw) hover:bg-secondary/60">
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {formatShortDate(v.request.createdAt)}
              </td>
              <td className="px-4 py-3 font-bold">{v.request.type}</td>
              <td className="px-4 py-3">
                <span className="font-semibold">{v.animalName ?? 'Tanpa nama'}</span>
                {v.qrCode && (
                  <span className="block text-sm text-muted-foreground">{v.qrCode}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {v.farmerName ?? '–'}
                {v.locationName && (
                  <span className="block text-sm text-muted-foreground">{v.locationName}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <RequestStatusBadge status={v.request.status} />
                {v.unsynced && (
                  <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-info">
                    <CloudUpload aria-hidden="true" className="size-4" />
                    Belum terkirim
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {v.inseminatorName ?? <span className="text-muted-foreground">–</span>}
              </td>
              <td className="px-2 py-3 text-right">
                <Link
                  to="/permintaan/$requestId"
                  params={{ requestId: v.request.id }}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold text-primary hover:bg-card"
                  aria-label={`Buka permintaan ${v.request.type} ${v.animalName ?? ''}`}
                >
                  {v.request.status === 'submitted' ? 'Verifikasi' : 'Buka'}
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestCard({ view: v }: { view: ServiceRequestView }) {
  return (
    <Link
      to="/permintaan/$requestId"
      params={{ requestId: v.request.id }}
      className="flex items-start gap-3 rounded-xl border-(length:--bw) bg-card p-4 hover:bg-secondary"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-bold">
          {v.request.type}: {v.animalName ?? 'Tanpa nama'}{' '}
          {v.qrCode && <span className="font-semibold text-muted-foreground">{v.qrCode}</span>}
        </span>
        <span className="text-muted-foreground">
          {[v.farmerName, v.locationName].filter(Boolean).join(', ')}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={v.request.status} />
          <span className="text-sm text-muted-foreground">
            {formatShortDate(v.request.createdAt)}
          </span>
        </span>
        {v.inseminatorName && <span className="text-sm">Petugas: {v.inseminatorName}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="mt-1 size-5 shrink-0" />
    </Link>
  );
}
