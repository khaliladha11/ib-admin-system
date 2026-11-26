// Detail permintaan untuk admin: verifikasi + tugaskan, tolak, ganti petugas (alur skripsi),
// dan log aktivitas. Aksi tersimpan di perangkat lalu dikirim lewat outbox.
import { Link, useParams } from '@tanstack/react-router';
import { CloudUpload, MessageCircle, SearchX } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { DetailSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useInseminatorsFor,
  useRepo,
  useRequestActivity,
  useServiceRequestViews,
  useSession,
  type ServiceRequestView,
} from '@/data';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { waLink } from '@/lib/whatsapp';
import { RequestStatusBadge } from '@/components/request-status-badge';

const TYPE_TEXT = { IB: 'Inseminasi (IB)', PKB: 'Periksa bunting (PKB)' } as const;

export function AdminRequestDetailPage() {
  const { requestId } = useParams({ from: '/permintaan/$requestId' });
  const views = useServiceRequestViews();
  if (!views) return <DetailSkeleton label="Memuat permintaan…" />;
  const view = views.find((v) => v.request.id === requestId);
  if (!view) {
    return (
      <EmptyState icon={SearchX} title="Permintaan tidak ditemukan">
        Permintaan ini tidak ada di perangkat Anda atau di luar wilayah Anda.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <Details view={view} />
        <Actions view={view} />
      </div>
      <Activity requestId={requestId} />
    </div>
  );
}

function Details({ view: v }: { view: ServiceRequestView }) {
  const session = useSession();
  const { request } = v;
  const wa = waLink(
    v.farmerPhone,
    `Halo ${v.farmerName ?? 'Bapak/Ibu'}, terkait permintaan ${request.type} untuk sapi ${v.animalName ?? ''}${v.qrCode ? ` (${v.qrCode})` : ''}. ${session?.user.name ?? ''}`,
  );
  const rows: [string, ReactNode][] = [
    ['Peternak', [v.farmerName, v.locationName].filter(Boolean).join(', ') || '–'],
    ['HP peternak', v.farmerPhone ?? '–'],
    [
      'Diajukan',
      `${formatDateTime(request.createdAt)}${v.requestedByName ? ` oleh ${v.requestedByName}` : ''}`,
    ],
    [
      'Minta datang',
      request.preferredDate ? formatDate(new Date(request.preferredDate).getTime()) : '–',
    ],
    ['Petugas', v.inseminatorName ?? '–'],
  ];
  return (
    <Panel title={TYPE_TEXT[request.type]}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/ternak/$animalId"
          params={{ animalId: request.animalId }}
          className="inline-flex min-h-11 items-center text-xl font-bold underline underline-offset-4"
        >
          {v.animalName ?? 'Tanpa nama'}
          {v.qrCode && <span className="ml-2 font-semibold text-muted-foreground">{v.qrCode}</span>}
        </Link>
        <RequestStatusBadge status={request.status} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([k, val]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold">{val}</dd>
          </div>
        ))}
      </dl>
      {request.notes && <p className="rounded-md bg-secondary p-3">“{request.notes}”</p>}
      {request.status === 'rejected' && (
        <p className="font-semibold text-alarm">Alasan ditolak: {request.rejectionReason}</p>
      )}
      {wa && (
        <Button asChild variant="outline" className="self-start">
          <a href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            WhatsApp peternak
          </a>
        </Button>
      )}
    </Panel>
  );
}

function Actions({ view: v }: { view: ServiceRequestView }) {
  const repo = useRepo();
  const id = useId();
  const candidates = useInseminatorsFor(v.farmerLocationId);
  const { status } = v.request;
  const [inseminatorId, setInseminatorId] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status !== 'submitted' && status !== 'assigned' && status !== 'in_progress') return null;
  const options = (candidates ?? []).filter((u) => u.id !== v.activeAssignment?.inseminatorId);
  const reassign = status !== 'submitted';

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      setInseminatorId('');
      setRejecting(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={reassign ? 'Ganti petugas' : 'Verifikasi permintaan'}>
      {options.length === 0 ? (
        <p className="text-muted-foreground">
          Belum ada petugas aktif lain yang wilayahnya mencakup lokasi peternak ini. Tambahkan di
          menu Pengguna.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor={`${id}-ins`}>
              {reassign ? 'Petugas pengganti' : 'Tugaskan ke petugas'}
            </Label>
            <NativeSelect
              id={`${id}-ins`}
              value={inseminatorId}
              onChange={(e) => {
                setInseminatorId(e.target.value);
              }}
            >
              <option value="">Pilih petugas</option>
              {options.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.phone ? `, ${u.phone}` : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            size="lg"
            disabled={busy || !inseminatorId}
            onClick={() =>
              void run(
                () =>
                  reassign
                    ? repo.reassignServiceRequest(v.request.id, inseminatorId)
                    : repo.assignServiceRequest(v.request.id, inseminatorId),
                reassign ? 'Petugas diganti.' : 'Permintaan diverifikasi dan ditugaskan.',
              )
            }
          >
            {reassign ? 'Ganti petugas' : 'Verifikasi dan tugaskan'}
          </Button>
        </div>
      )}

      {!reassign &&
        (rejecting ? (
          <div className="flex flex-col gap-2 border-t-(length:--bw) pt-3">
            <Label htmlFor={`${id}-reason`}>Alasan penolakan (dikirim ke peternak)</Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              placeholder="Contoh: sapi baru melahirkan 20 hari lalu, tunggu birahi berikutnya"
              onChange={(e) => {
                setReason(e.target.value);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => repo.rejectServiceRequest(v.request.id, reason),
                    'Permintaan ditolak.',
                  )
                }
              >
                Tolak permintaan
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRejecting(false);
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="self-start text-alarm"
            onClick={() => {
              setRejecting(true);
            }}
          >
            Tolak permintaan ini
          </Button>
        ))}

      {message && (
        <p role="status" className="font-semibold text-primary">
          {message} Tersimpan di perangkat dan dikirim ke server saat online.
        </p>
      )}
      {error !== null && <ErrorMessage error={error} />}
    </Panel>
  );
}

function Activity({ requestId }: { requestId: string }) {
  const entries = useRequestActivity(requestId);
  return (
    <Panel title="Log aktivitas">
      {!entries || entries.length === 0 ? (
        <p className="text-muted-foreground">Belum ada aktivitas.</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((e, i) => (
            <li
              key={`${e.kind}-${String(e.at)}-${String(i)}`}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 size-3 shrink-0 rounded-full border-2',
                  e.kind === 'reject' || e.kind === 'cancel'
                    ? 'border-alarm'
                    : 'border-primary bg-primary',
                )}
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{e.text}</span>
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(e.at)}
                  {e.actorName ? `, oleh ${e.actorName}` : ''}
                </span>
                {e.unsynced && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-info">
                    <CloudUpload aria-hidden="true" className="size-4" />
                    Belum terkirim
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
