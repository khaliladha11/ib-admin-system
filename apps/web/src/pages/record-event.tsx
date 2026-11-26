// Layar catat kejadian untuk satu ternak (tanpa navigasi bawah agar form IB muat satu layar).
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { EventForm } from '@/components/event-form';
import { EVENT_FORM_TYPES, FARMER_FORM_TYPES, TYPE_LABEL } from '@/components/event-form-model';
import { StatusBadge } from '@/components/status-badge';
import { useAnimal, useDataLayer, useEventDefaults, useRepo, useSession } from '@/data';

export function RecordEventPage() {
  const { animalId } = useParams({ from: '/ternak/$animalId/catat' });
  const { jenis, tugas } = useSearch({ from: '/ternak/$animalId/catat' });
  const animal = useAnimal(animalId);
  const defaults = useEventDefaults(animalId);
  const session = useSession();
  const repo = useRepo();
  const { now } = useDataLayer();
  const navigate = useNavigate();

  if (animal === undefined || defaults === undefined || session === undefined) return null;
  if (animal === null) {
    return (
      <EmptyState icon={SearchX} title="Ternak tidak ditemukan">
        Kembali ke daftar ternak dan pilih ternak lain.
      </EmptyState>
    );
  }
  const types = session?.user.role === 'farmer' ? FARMER_FORM_TYPES : EVENT_FORM_TYPES;
  const gestationMonths =
    animal.status.kind === 'bunting' ? animal.status.gestationMonths : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-lg font-bold">
          {animal.name ?? 'Tanpa nama'}
          {animal.qrCode && (
            <span className="ml-2 font-semibold text-muted-foreground">{animal.qrCode}</span>
          )}
        </p>
        <StatusBadge status={animal.status} showDetail={false} />
      </div>
      <EventForm
        types={types}
        defaultType={jenis}
        defaults={{ ...defaults, gestationMonths }}
        taskId={tugas ?? null}
        now={now}
        onSubmit={(input) => repo.recordEvent(animalId, input)}
        onSaved={(type) => {
          void navigate({
            to: '/ternak/$animalId',
            params: { animalId },
            search: { tersimpan: TYPE_LABEL[type] },
            replace: true,
          });
        }}
      />
    </div>
  );
}
