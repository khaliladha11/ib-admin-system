// Permintaan layanan: peternak mengajukan IB/PKB; petugas melihat dan menerima tugas;
// admin melihat semua permintaan di wilayahnya (penugasan dibuat di dashboard admin, langkah 2.3).
import { Link } from '@tanstack/react-router';
import { CalendarDays, ClipboardList, Inbox, Plus } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { Button } from '@/components/ui/button';
import { useRepo, useServiceRequestViews, useSession, type ServiceRequestView } from '@/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const TYPE_TEXT = { IB: 'Inseminasi (IB)', PKB: 'Periksa bunting (PKB)' } as const;

export function TasksPage() {
  const session = useSession();
  const views = useServiceRequestViews();
  if (!session || !views) return null;
  if (session.user.role === 'inseminator') return <InseminatorTasks views={views} />;
  if (session.user.role === 'farmer') return <FarmerRequests views={views} />;
  return <AdminRequests views={views} />;
}

function FarmerRequests({ views }: { views: ServiceRequestView[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Button asChild size="lg">
        <Link to="/tugas/ajukan">
          <Plus aria-hidden="true" />
          Minta petugas IB atau PKB
        </Link>
      </Button>
      <h2 className="text-xl font-bold">Permintaan saya</h2>
      {views.length === 0 ? (
        <EmptyState icon={Inbox} title="Belum ada permintaan">
          Saat sapi birahi, minta petugas datang untuk IB. Sekitar 2 bulan setelah IB, minta PKB.
        </EmptyState>
      ) : (
        <RequestList views={views} />
      )}
    </div>
  );
}

function InseminatorTasks({ views }: { views: ServiceRequestView[] }) {
  const [tab, setTab] = useState<'aktif' | 'selesai'>('aktif');
  const active = views.filter(
    (v) =>
      v.assignedToMe && (v.request.status === 'assigned' || v.request.status === 'in_progress'),
  );
  const done = views.filter((v) => v.request.status === 'done');
  const list = tab === 'aktif' ? active : done;
  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Tugas"
        className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1"
      >
        {(
          [
            ['aktif', `Tugas aktif (${String(active.length)})`],
            ['selesai', `Selesai (${String(done.length)})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
            }}
            className={cn(
              'min-h-12 rounded-md px-2 font-bold',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === 'aktif' ? 'Tidak ada tugas' : 'Belum ada tugas selesai'}
        >
          {tab === 'aktif'
            ? 'Tugas IB dan PKB dari admin kelompok muncul di sini. Sentuh status sinkron untuk memeriksa tugas baru.'
            : 'Tugas yang sudah Anda kerjakan tampil di sini.'}
        </EmptyState>
      ) : (
        <RequestList views={list} actions />
      )}
    </div>
  );
}

function AdminRequests({ views }: { views: ServiceRequestView[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Semua permintaan di wilayah Anda. Verifikasi dan penugasan petugas dilakukan dari dashboard
        admin di komputer.
      </p>
      {views.length === 0 ? (
        <EmptyState icon={Inbox} title="Belum ada permintaan" />
      ) : (
        <RequestList views={views} />
      )}
    </div>
  );
}

function RequestList({ views, actions }: { views: ServiceRequestView[]; actions?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {views.map((v) => (
        <li key={v.request.id}>
          <RequestCard view={v} actions={actions} />
        </li>
      ))}
    </ul>
  );
}

function RequestCard({ view, actions }: { view: ServiceRequestView; actions?: boolean }) {
  const repo = useRepo();
  const [error, setError] = useState<unknown>(null);
  const { request } = view;
  return (
    <article className="flex flex-col gap-2 rounded-xl border-(length:--bw) bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-bold">{TYPE_TEXT[request.type]}</p>
          <Link
            to="/ternak/$animalId"
            params={{ animalId: request.animalId }}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            {view.animalName ?? 'Tanpa nama'}
            {view.qrCode ? ` ${view.qrCode}` : ''}
          </Link>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
      <p className="text-muted-foreground">
        {[view.farmerName, view.locationName].filter(Boolean).join(', ')}
      </p>
      <p className="flex items-center gap-2">
        <CalendarDays aria-hidden="true" className="size-5 shrink-0" />
        Diajukan {formatDate(request.createdAt)}
        {request.preferredDate &&
          `, minta datang ${formatDate(new Date(request.preferredDate).getTime())}`}
      </p>
      {request.notes && <p>“{request.notes}”</p>}
      {request.status === 'rejected' && request.rejectionReason && (
        <p className="font-semibold text-alarm">Alasan ditolak: {request.rejectionReason}</p>
      )}
      {view.unsynced && <p className="text-sm font-semibold text-info">Belum terkirim ke server</p>}
      {actions && request.status === 'assigned' && (
        <Button
          size="lg"
          onClick={() => {
            setError(null);
            repo.acceptServiceRequest(request.id).catch(setError);
          }}
        >
          Terima tugas
        </Button>
      )}
      {actions && request.status === 'in_progress' && (
        <Button asChild size="lg">
          <Link
            to="/ternak/$animalId/catat"
            params={{ animalId: request.animalId }}
            search={{ jenis: request.type, tugas: request.id }}
          >
            Catat hasil {request.type}
          </Link>
        </Button>
      )}
      {error !== null && <ErrorMessage error={error} />}
    </article>
  );
}
