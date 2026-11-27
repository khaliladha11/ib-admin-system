// Halaman "Data belum terkirim" (langkah 4.2, docs/SYNC.md §6): menunggu dikirim, perlu dicek
// (event ditolak karena urutan riwayat), dan tidak diterima. Tidak ada catatan yang hilang diam-diam.
import { Link } from '@tanstack/react-router';
import { CloudUpload, RefreshCw, TriangleAlert, XCircle } from 'lucide-react';
import { useId, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { localDate, occurredAtFor } from '@/components/event-form-model';
import { ListSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import {
  dismissRejected,
  useDataLayer,
  useRepo,
  useSyncQueue,
  useSyncStatus,
  type SyncQueueItem,
} from '@/data';
import { describeChange } from '@/lib/describe-change';
import { formatDateTime } from '@/lib/format';
import { CloudCheck } from 'lucide-react';

function Summary({ item }: { item: SyncQueueItem }) {
  const { title, detail } = describeChange(item.entry, item.animalName);
  return (
    <span className="min-w-0">
      <span className="block font-bold">{title}</span>
      <span className="block text-sm text-muted-foreground">
        {item.animalId ? (
          <Link
            to="/ternak/$animalId"
            params={{ animalId: item.animalId }}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            {detail}
          </Link>
        ) : (
          detail
        )}
      </span>
    </span>
  );
}

function ReviewItem({ item }: { item: SyncQueueItem }) {
  const repo = useRepo();
  const { now } = useDataLayer();
  const id = useId();
  const body = (item.entry.body ?? {}) as { occurredAt?: number };
  const [date, setDate] = useState(localDate(body.occurredAt ?? item.entry.createdAt));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const changedDate = date !== localDate(body.occurredAt ?? item.entry.createdAt);
  return (
    <li className="flex flex-col gap-3 border-t-(length:--bw) py-3 first:border-t-0">
      <Summary item={item} />
      <p className="flex items-start gap-2 rounded-lg bg-(--st-keguguran-bg) p-3 text-(--st-keguguran-fg)">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span>
          <span className="block font-semibold">Bertentangan dengan catatan lain di server</span>
          {item.entry.lastError}
        </span>
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-date`}>Tanggal kejadian</Label>
        <Input
          id={`${id}-date`}
          type="date"
          value={date}
          max={localDate(now())}
          onChange={(e) => {
            setDate(e.target.value);
          }}
        />
      </div>
      {confirmDiscard ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void run(() => repo.discardReview(item.entry.id))}
          >
            Ya, buang catatan ini
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmDiscard(false);
            }}
          >
            Batal
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() =>
              void run(() =>
                repo.retryReview(
                  item.entry.id,
                  changedDate ? { occurredAt: occurredAtFor(date, now()) } : {},
                ),
              )
            }
          >
            <RefreshCw aria-hidden="true" />
            {changedDate ? 'Ubah tanggal dan kirim' : 'Kirim ulang'}
          </Button>
          <Button
            variant="ghost"
            className="text-alarm"
            onClick={() => {
              setConfirmDiscard(true);
            }}
          >
            Buang
          </Button>
        </div>
      )}
      {error !== null && <ErrorMessage error={error} />}
    </li>
  );
}

export function SyncQueuePage() {
  const queue = useSyncQueue();
  const status = useSyncStatus();
  const { db, sync } = useDataLayer();
  const [syncing, setSyncing] = useState(false);
  if (!queue || !status) return <ListSkeleton label="Memuat data belum terkirim…" />;

  const empty =
    queue.pending.length === 0 && queue.reviews.length === 0 && queue.rejected.length === 0;

  const sendNow = () => {
    setSyncing(true);
    void sync
      .syncNow({ force: true })
      .catch(() => undefined)
      .finally(() => {
        setSyncing(false);
      });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        {status.lastSyncAt
          ? `Terakhir terhubung ke server ${formatDateTime(status.lastSyncAt)}.`
          : 'HP ini belum pernah terhubung ke server.'}
      </p>

      {empty ? (
        <EmptyState icon={CloudCheck} art="meadow" title="Semua catatan sudah terkirim">
          Catatan baru dikirim otomatis begitu ada sinyal.
        </EmptyState>
      ) : null}

      {queue.reviews.length > 0 && (
        <Panel title={`Perlu dicek (${String(queue.reviews.length)})`} titleId="perlu-dicek">
          <p className="text-muted-foreground">
            Catatan ini tidak cocok dengan riwayat sapi di server, biasanya karena HP lain sudah
            mencatat kejadian lain. Catatan tetap tersimpan. Periksa sapinya, ubah tanggal bila
            salah, lalu kirim ulang, atau buang bila memang keliru.
          </p>
          <ul className="flex flex-col">
            {queue.reviews.map((item) => (
              <ReviewItem key={item.entry.id} item={item} />
            ))}
          </ul>
        </Panel>
      )}

      {queue.pending.length > 0 && (
        <Panel
          title={`Menunggu dikirim (${String(queue.pending.length)})`}
          titleId="menunggu"
          action={
            <Button variant="outline" size="sm" disabled={syncing} onClick={sendNow}>
              <RefreshCw aria-hidden="true" className={syncing ? 'animate-spin' : undefined} />
              {syncing ? 'Mengirim…' : 'Coba kirim sekarang'}
            </Button>
          }
        >
          {status.lastError && (
            <p className="text-soil">
              Pengiriman terakhir belum berhasil. Dicoba lagi otomatis saat ada sinyal.
            </p>
          )}
          <ul className="flex flex-col">
            {queue.pending.map((item) => (
              <li
                key={item.entry.id}
                className="flex items-start gap-3 border-t-(length:--bw) py-2 first:border-t-0"
              >
                <CloudUpload aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
                <Summary item={item} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {queue.rejected.length > 0 && (
        <Panel title={`Tidak diterima (${String(queue.rejected.length)})`} titleId="ditolak">
          <p className="text-muted-foreground">
            Server tidak menyimpan catatan ini. Baca alasannya, catat ulang bila perlu, lalu tutup.
          </p>
          <ul className="flex flex-col">
            {queue.rejected.map((item) => (
              <li
                key={item.entry.id}
                className="flex items-start justify-between gap-3 border-t-(length:--bw) py-2 first:border-t-0"
              >
                <span className="flex min-w-0 items-start gap-3">
                  <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-alarm" />
                  <span className="min-w-0">
                    <Summary item={item} />
                    <span className="block font-semibold text-alarm">{item.entry.lastError}</span>
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void dismissRejected(db, item.entry.id)}
                >
                  Tutup
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!empty && queue.pending.length === 0 && (
        <Button variant="outline" disabled={syncing} onClick={sendNow} className="self-start">
          <RefreshCw aria-hidden="true" className={syncing ? 'animate-spin' : undefined} />
          {syncing ? 'Memperbarui…' : 'Perbarui dari server'}
        </Button>
      )}
    </div>
  );
}
