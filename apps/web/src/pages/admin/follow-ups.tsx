// Tindak lanjut: laporan terlambat (aturan skripsi 3 bulan dan 9 bulan) dengan tombol
// WhatsApp berisi pesan siap kirim. Pesan tidak terkirim otomatis: admin menekan kirim sendiri.
import { Link } from '@tanstack/react-router';
import { MessageCircle, PartyPopper, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { ListSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
  useFeedback,
  useFollowUps,
  useRepo,
  useServerReviews,
  useSession,
  type FollowUp,
  type ServerReviewView,
} from '@/data';
import { ErrorMessage } from '@/components/error-message';
import { Panel } from '@/components/ui/panel';
import { ROLE_LABEL } from '@/components/request-status';
import { EVENT_TEXT } from '@/lib/describe-change';
import { RATING_TEXT, TOPIC_TEXT } from '@/lib/feedback-text';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { followUpMessage, waLink } from '@/lib/whatsapp';

import { useAdminScope } from './scope';

type Filter = 'semua' | FollowUp['code'];

const PROBLEM: Record<FollowUp['code'], { title: string; rule: string }> = {
  IB_RESULT_OVERDUE: { title: 'Hasil IB belum dilaporkan', rule: 'lebih dari 3 bulan setelah IB' },
  BIRTH_REPORT_OVERDUE: {
    title: 'Kelahiran belum dilaporkan',
    rule: 'lewat perkiraan lahir (9–10 bulan)',
  },
};

function useSender() {
  const session = useSession();
  const scope = useAdminScope();
  return [session?.user.name, scope?.root?.name].filter(Boolean).join(', ');
}

function WaButtons({ item }: { item: FollowUp }) {
  const sender = useSender();
  const base = {
    code: item.code,
    animalName: item.animal.name,
    qrCode: item.animal.qrCode,
    farmerName: item.animal.farmerName,
    locationName: item.animal.locationName,
    eventAt: item.eventAt,
    overdueDays: item.overdueDays,
    senderName: sender,
  };
  const toFarmer = waLink(
    item.farmerPhone,
    followUpMessage({ ...base, recipient: 'farmer', recipientName: item.animal.farmerName }),
  );
  const toInseminator = item.inseminator
    ? waLink(
        item.inseminator.phone,
        followUpMessage({
          ...base,
          recipient: 'inseminator',
          recipientName: item.inseminator.name,
        }),
      )
    : null;
  return (
    <div className="flex flex-wrap gap-2">
      {toFarmer ? (
        <Button asChild variant="outline" size="sm">
          <a href={toFarmer} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            WA peternak
          </a>
        </Button>
      ) : (
        <span className="flex min-h-11 items-center text-sm text-muted-foreground">
          HP peternak belum ada
        </span>
      )}
      {toInseminator && (
        <Button asChild variant="outline" size="sm">
          <a href={toInseminator} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            WA petugas
          </a>
        </Button>
      )}
    </div>
  );
}

/** Catatan petugas yang ditolak server karena urutan riwayat (docs/SYNC.md §6). */
function ServerReviews() {
  const reviews = useServerReviews();
  const repo = useRepo();
  const [error, setError] = useState<unknown>(null);
  if (!reviews || reviews.length === 0) return null;
  const summary = (r: ServerReviewView) => {
    const body = (r.payload.body ?? {}) as { type?: string; occurredAt?: number };
    return [
      body.type ? (EVENT_TEXT[body.type] ?? body.type) : 'Catatan',
      r.animalName ?? 'Sapi',
      body.occurredAt ? formatDate(body.occurredAt) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };
  return (
    <Panel title={`Catatan perlu dicek (${String(reviews.length)})`} titleId="perlu-dicek-admin">
      <p className="text-muted-foreground">
        Catatan dari HP petugas yang bertentangan dengan riwayat sapi di server. Petugas bisa
        mengubah tanggal lalu mengirim ulang; buang bila catatannya keliru.
      </p>
      <ul className="flex flex-col">
        {reviews.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2 border-t-(length:--bw) py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between"
          >
            <span className="flex min-w-0 items-start gap-3">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-soil" />
              <span className="min-w-0">
                <span className="block font-bold">{summary(r)}</span>
                <span className="block text-sm text-muted-foreground">
                  Dari {r.userName ?? 'petugas'}, {formatDate(r.createdAt)}
                </span>
                <span className="block">{r.message}</span>
                {r.animalId && (
                  <Link
                    to="/ternak/$animalId"
                    params={{ animalId: r.animalId }}
                    className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                  >
                    Lihat riwayat sapi
                  </Link>
                )}
              </span>
            </span>
            <Button
              variant="ghost"
              className="self-start text-alarm"
              onClick={() => {
                setError(null);
                repo.discardServerReview(r.id).catch(setError);
              }}
            >
              Buang
            </Button>
          </li>
        ))}
      </ul>
      {error !== null && <ErrorMessage error={error} />}
    </Panel>
  );
}

/** Masukan peserta uji coba (langkah 5.1), terbaru dulu. */
function ParticipantFeedback() {
  const items = useFeedback();
  if (!items || items.length === 0) return null;
  const count = (rating: number) => items.filter((f) => f.rating === rating).length;
  return (
    <Panel title={`Masukan peserta (${String(items.length)})`} titleId="masukan-peserta">
      <p className="text-muted-foreground">
        {RATING_TEXT[3]}: {count(3)} · {RATING_TEXT[2]}: {count(2)} · {RATING_TEXT[1]}: {count(1)}
      </p>
      <ul className="flex flex-col">
        {items.map((f) => (
          <li key={f.id} className="border-t-(length:--bw) py-2 first:border-t-0">
            <span className="block font-semibold">
              {RATING_TEXT[f.rating]} · {TOPIC_TEXT[f.topic]}
            </span>
            {f.text && <span className="block">{f.text}</span>}
            <span className="block text-sm text-muted-foreground">
              {f.userName ?? 'Pengguna'}
              {f.role ? ` (${ROLE_LABEL[f.role]})` : ''}, {formatDateTime(f.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function FollowUpsPage() {
  const items = useFollowUps();
  const [filter, setFilter] = useState<Filter>('semua');
  if (!items) return <ListSkeleton label="Memuat laporan terlambat…" />;
  const shown = items.filter((i) => filter === 'semua' || i.code === filter);
  const count = (code: FollowUp['code']) => items.filter((i) => i.code === code).length;

  return (
    <div className="flex flex-col gap-4">
      <ServerReviews />
      <p className="max-w-prose text-muted-foreground">
        Sapi yang laporannya terlambat menurut aturan skripsi. Kirim pengingat lewat WhatsApp: pesan
        sudah terisi dan bisa diubah sebelum dikirim.
      </p>
      <div role="radiogroup" aria-label="Jenis laporan" className="flex flex-wrap gap-2">
        {(
          [
            ['semua', `Semua (${String(items.length)})`],
            ['IB_RESULT_OVERDUE', `Hasil IB, 3 bulan (${String(count('IB_RESULT_OVERDUE'))})`],
            [
              'BIRTH_REPORT_OVERDUE',
              `Kelahiran, 9 bulan (${String(count('BIRTH_REPORT_OVERDUE'))})`,
            ],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={filter === key}
            onClick={() => {
              setFilter(key);
            }}
            className={cn(
              'min-h-11 rounded-full border-(length:--bw) px-4 font-semibold',
              filter === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={PartyPopper} art="meadow" title="Tidak ada laporan terlambat">
          Semua hasil IB dan kelahiran di wilayah Anda sudah dilaporkan tepat waktu.
        </EmptyState>
      ) : (
        <>
          <div className="surface hidden overflow-hidden lg:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Laporan terlambat</caption>
              <thead className="bg-secondary">
                <tr>
                  {['Ternak', 'Peternak', 'Masalah', 'Terlambat', 'Kirim pengingat'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr
                    key={`${item.code}-${item.animal.id}`}
                    className="border-t-(length:--bw) align-top"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/ternak/$animalId"
                        params={{ animalId: item.animal.id }}
                        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                      >
                        {item.animal.name ?? 'Tanpa nama'}
                      </Link>
                      {item.animal.qrCode && (
                        <span className="block text-sm text-muted-foreground">
                          {item.animal.qrCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.animal.farmerName ?? '–'}
                      <span className="block text-sm text-muted-foreground">
                        {item.animal.locationName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{PROBLEM[item.code].title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {item.eventAt
                          ? `${item.code === 'IB_RESULT_OVERDUE' ? 'IB' : 'Bunting'} ${formatDate(item.eventAt)}`
                          : PROBLEM[item.code].rule}
                        {item.inseminator ? `, petugas ${item.inseminator.name}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold whitespace-nowrap text-alarm">
                      {item.overdueDays} hari
                    </td>
                    <td className="px-4 py-3">
                      <WaButtons item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 lg:hidden">
            {shown.map((item) => (
              <li
                key={`${item.code}-${item.animal.id}`}
                className="surface flex flex-col gap-2 p-4"
              >
                <p className="flex items-start justify-between gap-2">
                  <span className="font-bold">{PROBLEM[item.code].title}</span>
                  <span className="shrink-0 font-bold text-alarm">{item.overdueDays} hari</span>
                </p>
                <Link
                  to="/ternak/$animalId"
                  params={{ animalId: item.animal.id }}
                  className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                >
                  {item.animal.name ?? 'Tanpa nama'} {item.animal.qrCode}
                </Link>
                <p className="text-muted-foreground">
                  {[item.animal.farmerName, item.animal.locationName].filter(Boolean).join(', ')}
                  {item.inseminator ? `. Petugas ${item.inseminator.name}` : ''}
                </p>
                <WaButtons item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
      <ParticipantFeedback />
    </div>
  );
}
