import { Link, useParams, useSearch } from '@tanstack/react-router';
import {
  Camera,
  CircleCheck,
  ClipboardPlus,
  History,
  PawPrint,
  PencilLine,
  SearchX,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { CycleTrack } from '@/components/cycle-track';
import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { EventTimeline } from '@/components/event-timeline';
import { StatusBadge } from '@/components/status-badge';
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
import { ageFrom, formatDate, relativeDay } from '@/lib/format';
import { resizeImage } from '@/lib/resize-image';

export function AnimalProfilePage() {
  const { animalId } = useParams({ from: '/ternak/$animalId' });
  const { tersimpan } = useSearch({ from: '/ternak/$animalId' });
  const timeline = useAnimalTimeline(animalId);
  const session = useSession();
  const defaults = useEventDefaults(animalId);
  const { now } = useDataLayer();

  if (timeline === undefined) return null;
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
          <CircleCheck aria-hidden="true" className="size-5" />
          {tersimpan} tersimpan di HP ini.
        </p>
      )}

      <section aria-label="Identitas" className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <PhotoBlock animalId={animal.id} name={animal.name ?? 'ternak'} />
          <div className="min-w-0 pt-1">
            <h2 className="text-2xl font-bold break-words">{animal.name ?? 'Tanpa nama'}</h2>
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

      <StatusBlock timeline={timeline} today={today} />

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
          <p className="text-muted-foreground">
            Belum ada catatan. Mulai dengan mencatat birahi atau IB.
          </p>
        ) : (
          <EventTimeline events={timeline.events} anomalies={timeline.anomalies} />
        )}
      </section>
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

function StatusBlock({ timeline, today }: { timeline: AnimalTimeline; today: number }) {
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
    <section
      aria-label="Status saat ini"
      className="flex flex-col gap-3 rounded-xl border-(length:--bw) bg-card p-4"
    >
      <StatusBadge status={animal.status} className="self-start" />
      {animal.sex === 'F' && <CycleTrack kind={animal.status.kind} />}
      {schedule.reminders.map((r) => (
        <p key={r.code} role="alert" className="font-semibold text-alarm">
          {r.message}
        </p>
      ))}
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
          <PawPrint aria-hidden="true" className="size-10 text-muted-foreground" />
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
