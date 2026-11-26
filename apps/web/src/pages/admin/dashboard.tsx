// Ringkasan admin (kelompok/dinas): yang perlu dikerjakan hari ini, dari data di perangkat.
import { SERVICE_REQUEST_STATUSES } from '@ib/shared';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Inbox, MapPin, TriangleAlert } from 'lucide-react';

import { DashboardSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { Meadow } from '@/components/illustrations/meadow';
import { Panel } from '@/components/ui/panel';
import { REQUEST_STATUS_META } from '@/components/request-status';
import { useAdminSummary, useDataLayer, useFollowUps, useServiceRequestViews } from '@/data';
import { formatDate, formatLongToday, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useAdminScope } from './scope';

function Figure({
  label,
  value,
  hint,
  to,
  tone = 'plain',
}: {
  label: string;
  value: number;
  hint: string;
  to?: '/permintaan' | '/tindak-lanjut' | '/ternak';
  tone?: 'plain' | 'action' | 'alarm';
}) {
  const body = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-2xl font-bold tabular-nums',
          tone === 'alarm' && value > 0 && 'text-alarm',
        )}
      >
        {value}
      </span>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </>
  );
  const cls = cn(
    'flex min-h-28 flex-col gap-0.5 surface p-4',
    tone === 'action' && value > 0 && 'border-l-[6px] border-l-straw',
    tone === 'alarm' && value > 0 && 'border-l-[6px] border-l-alarm',
  );
  return to ? (
    <Link
      to={to}
      search={to === '/permintaan' ? { status: 'submitted' } : undefined}
      className={cn(cls, 'hover:bg-secondary')}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function AdminDashboard() {
  const { now } = useDataLayer();
  const today = now();
  const summary = useAdminSummary();
  const requests = useServiceRequestViews();
  const followUps = useFollowUps();
  const scope = useAdminScope();
  if (!summary || !requests || !followUps || !scope) return <DashboardSkeleton />;

  const counts = summary.requestsByStatus;
  const total = SERVICE_REQUEST_STATUSES.reduce((n, s) => n + counts[s], 0);
  const waiting = requests.filter((r) => r.request.status === 'submitted').slice(0, 5);
  const monthName = new Date(today).toLocaleDateString('id-ID', { month: 'long' });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-muted-foreground">{formatLongToday(today)}</p>
          <p className="display flex items-center gap-2 text-[2.25rem]">
            <MapPin aria-hidden="true" className="size-5 text-primary" />
            {scope.root?.name ?? 'Semua wilayah'}
          </p>
        </div>
        <p className="text-muted-foreground">{summary.animals} ternak tercatat</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          label="Perlu diverifikasi"
          value={counts.submitted}
          hint="permintaan baru dari peternak"
          to="/permintaan"
          tone="action"
        />
        <Figure
          label={`IB bulan ${monthName}`}
          value={summary.ibThisMonth}
          hint="inseminasi tercatat"
        />
        <Figure label="Sapi bunting" value={summary.pregnant} hint="hasil PKB terakhir" />
        <Figure
          label="Laporan terlambat"
          value={summary.overdueReports}
          hint="aturan 3 dan 9 bulan"
          to="/tindak-lanjut"
          tone="alarm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title="Menunggu verifikasi"
          action={
            counts.submitted > 0 ? (
              <Link
                to="/permintaan"
                search={{ status: 'submitted' }}
                className="flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
              >
                Lihat semua
              </Link>
            ) : undefined
          }
        >
          {waiting.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Tidak ada permintaan baru"
              className="border-0 shadow-none"
            >
              Permintaan IB dan PKB dari peternak muncul di sini untuk diverifikasi.
            </EmptyState>
          ) : (
            <ul className="flex flex-col">
              {waiting.map((v) => (
                <li key={v.request.id} className="border-t-(length:--bw) first:border-t-0">
                  <Link
                    to="/permintaan/$requestId"
                    params={{ requestId: v.request.id }}
                    className="flex min-h-14 items-center gap-3 py-2 hover:bg-secondary"
                  >
                    <span className="w-12 shrink-0 font-bold">{v.request.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {v.animalName ?? 'Tanpa nama'}{' '}
                        {v.qrCode && <span className="text-muted-foreground">{v.qrCode}</span>}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {[v.farmerName, v.locationName].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {relativeDay(v.request.createdAt, today)}
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {/* Mengisi ruang kosong saat permintaan baru sedikit. */}
          {waiting.length < 4 && (
            <Meadow className="-mx-4 mt-auto -mb-4 h-28 w-[calc(100%+2rem)] rounded-b-2xl sm:-mx-5 sm:-mb-5 sm:w-[calc(100%+2.5rem)]" />
          )}
        </Panel>

        <Panel
          title="Permintaan per status"
          action={<span className="text-muted-foreground">{total} total</span>}
        >
          <ul className="flex flex-col gap-2">
            {SERVICE_REQUEST_STATUSES.map((s) => {
              const meta = REQUEST_STATUS_META[s];
              const Icon = meta.icon;
              const pct = total === 0 ? 0 : Math.round((counts[s] / total) * 100);
              return (
                <li key={s}>
                  <Link
                    to="/permintaan"
                    search={{ status: s }}
                    className="grid min-h-11 grid-cols-[11.5rem_1fr_2.5rem] items-center gap-3 rounded-md px-1 hover:bg-secondary"
                  >
                    <span className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {meta.label}
                    </span>
                    <span
                      className="h-3 overflow-hidden rounded-full bg-secondary"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${String(pct)}%` }}
                      />
                    </span>
                    <span className="text-right font-bold tabular-nums">{counts[s]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Laporan terlambat"
        action={
          followUps.length > 0 ? (
            <Link
              to="/tindak-lanjut"
              className="flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
            >
              Tindak lanjuti
            </Link>
          ) : undefined
        }
      >
        {followUps.length === 0 ? (
          <p className="text-muted-foreground">
            Tidak ada laporan terlambat. Semua hasil IB dan kelahiran sudah dilaporkan.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
            {followUps.slice(0, 6).map((f) => (
              <li
                key={`${f.code}-${f.animal.id}`}
                className="flex min-h-12 min-w-0 items-center gap-3 border-t-(length:--bw) py-2"
              >
                <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-alarm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {f.code === 'IB_RESULT_OVERDUE' ? 'Hasil IB' : 'Kelahiran'}:{' '}
                    {f.animal.name ?? 'Tanpa nama'}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[f.animal.farmerName, f.animal.locationName].filter(Boolean).join(', ')}, batas{' '}
                    {formatDate(f.dueAt)}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-alarm">{f.overdueDays} hari</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
