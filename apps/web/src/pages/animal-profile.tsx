import type { UserRole } from '@ib/shared';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { DetailSkeleton } from '@/components/skeletons';
import { Cow } from '@/components/icons/cow';
import {
  Camera,
  ClipboardPlus,
  History,
  PencilLine,
  ScanQrCode,
  SearchX,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { CycleTrack } from '@/components/cycle-track';
import { EmptyState } from '@/components/empty-state';
import { SavedCheck } from '@/components/saved-check';
import { ErrorMessage } from '@/components/error-message';
import { EventTimeline } from '@/components/event-timeline';
import { StatusBadge } from '@/components/status-badge';
import { TagHistory } from '@/components/tag-history';
import { Button } from '@/components/ui/button';
import {
  useAnimalPhotoUrl,
  useAnimalTimeline,
  useDataLayer,
  useEventDefaults,
  useRepo,
  useSession,
  type AnimalTimeline,
} from '@/data';
import { ReminderActionLink } from '@/components/reminder-action-link';
import { ageFrom, formatDate, relativeDay } from '@/lib/format';
import { reminderAction } from '@/lib/reminder-actions';
import { resizeImage } from '@/lib/resize-image';

export function AnimalProfilePage() {
  const { animalId } = useParams({ from: '/ternak/$animalId' });
  const { tersimpan, scan } = useSearch({ from: '/ternak/$animalId' });
  const timeline = useAnimalTimeline(animalId);
  const session = useSession();
  const defaults = useEventDefaults(animalId);
  const { now } = useDataLayer();

  if (timeline === undefined) return <DetailSkeleton label="Memuat profil ternak…" />;
  if (timeline === null) {
    return (
      <EmptyState icon={SearchX} title="Ternak tidak ditemukan">
        Ternak ini tidak ada di HP Anda. Mungkin sudah dihapus atau di luar wilayah Anda.
      </EmptyState>
    );
  }
  const { animal } = timeline;
  const today = now();
  const role = session?.user.role;
  const task = defaults?.openTask ?? null;
  const exited = animal.status.kind === 'keluar';

  return (
    <div className="flex flex-col gap-5">
      {tersimpan && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-(--st-bunting-bg) px-3 py-2 font-semibold text-(--st-bunting-fg)"
        >
          <SavedCheck className="size-6 shrink-0" />
          {tersimpan} tersimpan di HP ini.
        </p>
      )}

      <section aria-label="Identitas" className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <PhotoBlock animalId={animal.id} name={animal.name ?? 'ternak'} />
          <div className="min-w-0 pt-1">
            <h2 className="display text-[2.5rem] break-words">{animal.name ?? 'Tanpa nama'}</h2>
            {animal.tagCodes.length > 0 && (
              <p className="text-lg font-semibold tracking-wide">{animal.tagCodes.join(', ')}</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <Fact label="Jenis">
            {[animal.sex === 'F' ? 'Betina' : 'Jantan', animal.breed].filter(Boolean).join(', ')}
          </Fact>
          {animal.birthDate && <Fact label="Umur">{ageFrom(animal.birthDate, today)}</Fact>}
          <Fact label="Peternak">{animal.farmerName ?? '–'}</Fact>
          {animal.locationName && <Fact label="Lokasi">{animal.locationName}</Fact>}
          {animal.sireCode && <Fact label="Pejantan">{animal.sireCode}</Fact>}
        </dl>
      </section>

      {scan && !exited && (
        <ScanQuickActions animalId={animal.id} female={animal.sex === 'F'} role={role} />
      )}

      <StatusBlock timeline={timeline} today={today} role={role} />

      {!exited && (
        <div className="flex flex-col gap-2">
          {task && role === 'inseminator' ? (
            <Button asChild size="lg">
              <Link
                to="/ternak/$animalId/catat"
                params={{ animalId: animal.id }}
                search={{ jenis: task.type, tugas: task.id }}
              >
                <ClipboardPlus aria-hidden="true" />
                Kerjakan tugas {task.type}
              </Link>
            </Button>
          ) : null}
          <Button
            asChild
            size="lg"
            variant={task && role === 'inseminator' ? 'outline' : 'default'}
          >
            <Link to="/ternak/$animalId/catat" params={{ animalId: animal.id }}>
              <PencilLine aria-hidden="true" />
              Catat kejadian
            </Link>
          </Button>
          {role === 'farmer' && animal.sex === 'F' && (
            <Button asChild size="lg" variant="outline">
              <Link to="/tugas/ajukan" search={{ ternak: animal.id }}>
                Minta petugas IB atau PKB
              </Link>
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby="riwayat" className="flex flex-col gap-3">
        <h2 id="riwayat" className="flex items-center gap-2 text-xl font-bold">
          <History aria-hidden="true" className="size-6" />
          Riwayat
        </h2>
        {timeline.events.length === 0 ? (
          <EmptyState icon={History} title="Belum ada catatan" className="shadow-none">
            Mulai dengan mencatat birahi atau IB lewat tombol Catat kejadian.
          </EmptyState>
        ) : (
          <EventTimeline events={timeline.events} anomalies={timeline.anomalies} />
        )}
      </section>

      <TagHistory animalId={animal.id} readOnly={exited} />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </>
  );
}

function StatusBlock({
  timeline,
  today,
  role,
}: {
  timeline: AnimalTimeline;
  today: number;
  role: UserRole | undefined;
}) {
  const { animal, schedule } = timeline;
  const rows: [string, string][] = [];
  if (schedule.nextEstrusAt)
    rows.push([
      'Perkiraan birahi',
      `${formatDate(schedule.nextEstrusAt)} (${relativeDay(schedule.nextEstrusAt, today)})`,
    ]);
  if (schedule.pkbDueAt)
    rows.push([
      'Jadwal PKB',
      `${formatDate(schedule.pkbDueAt)} (${relativeDay(schedule.pkbDueAt, today)})`,
    ]);
  if (schedule.expectedCalving) {
    rows.push([
      'Perkiraan lahir',
      `${formatDate(schedule.expectedCalving.earliest)} – ${formatDate(schedule.expectedCalving.latest)}`,
    ]);
  }
  return (
    <section aria-label="Status saat ini" className="surface flex flex-col gap-3 p-4">
      <StatusBadge status={animal.status} className="self-start" />
      {animal.sex === 'F' && <CycleTrack kind={animal.status.kind} />}
      {schedule.reminders.map((r) => {
        const { title, action } = reminderAction(r.code, role, animal.id);
        return (
          <div
            key={r.code}
            className="flex flex-col items-start gap-2 rounded-xl bg-(--st-keguguran-bg) p-3"
          >
            <p role="alert" className="font-semibold text-alarm">
              {title} (terlambat {r.overdueDays} hari).
            </p>
            {action && <ReminderActionLink target={action.target} label={action.label} />}
          </div>
        );
      })}
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {rows.map(([k, v]) => (
            <Fact key={k} label={k}>
              {v}
            </Fact>
          ))}
        </dl>
      )}
    </section>
  );
}

function PhotoBlock({ animalId, name }: { animalId: string; name: string }) {
  const url = useAnimalPhotoUrl(animalId);
  const repo = useRepo();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { data, type } = await resizeImage(file);
      await repo.setAnimalPhoto(animalId, data, type);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex w-28 shrink-0 flex-col gap-1">
      <div className="flex size-28 items-center justify-center overflow-hidden rounded-xl border-(length:--bw) bg-secondary">
        {url ? (
          <img src={url} alt={`Foto ${name}`} className="size-full object-cover" />
        ) : (
          <Cow aria-hidden="true" className="size-10 text-muted-foreground" />
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={`foto-${animalId}`}
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <label
        htmlFor={`foto-${animalId}`}
        className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:bg-secondary"
      >
        <Camera aria-hidden="true" className="size-4" />
        {busy ? 'Memproses…' : url ? 'Ganti foto' : 'Ambil foto'}
      </label>
      {url && (
        <button
          type="button"
          onClick={() => void repo.removeAnimalPhoto(animalId)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground hover:bg-secondary"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Hapus foto
        </button>
      )}
      {error !== null && <ErrorMessage error={error} />}
    </div>
  );
}

type QuickType = 'BH' | 'IB' | 'PKB' | 'LH' | 'BB';

/** Tombol cepat setelah scan: tindakan yang paling sering di kandang, sesuai peran. */
function ScanQuickActions({
  animalId,
  female,
  role,
}: {
  animalId: string;
  female: boolean;
  role: UserRole | undefined;
}) {
  const actions: [QuickType, string][] = !female
    ? [['BB', 'Catat berat']]
    : role === 'farmer'
      ? [
          ['BH', 'Catat birahi'],
          ['LH', 'Catat lahir'],
        ]
      : [
          ['IB', 'Catat IB'],
          ['PKB', 'Catat PKB'],
          ['LH', 'Catat lahir'],
        ];
  return (
    <section aria-label="Tindakan cepat dari scan" className="surface flex flex-col gap-2 p-3">
      <p className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
        <ScanQrCode aria-hidden="true" className="size-4" />
        Ditemukan lewat scan
      </p>
      <div className="grid grid-cols-3 gap-2">
        {actions.map(([jenis, text]) => (
          <Button
            key={jenis}
            asChild
            size="lg"
            variant={jenis === actions[0]?.[0] ? 'accent' : 'outline'}
            className="px-2 has-[>svg]:px-2"
          >
            <Link to="/ternak/$animalId/catat" params={{ animalId }} search={{ jenis }}>
              {text}
            </Link>
          </Button>
        ))}
        {role === 'farmer' && female && (
          <Button asChild size="lg" variant="outline" className="px-2">
            <Link to="/tugas/ajukan" search={{ ternak: animalId }}>
              Minta IB/PKB
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
