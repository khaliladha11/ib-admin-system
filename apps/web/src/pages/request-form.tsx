// Peternak mengajukan permintaan IB atau PKB untuk salah satu sapinya.
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PawPrint } from 'lucide-react';
import { useId, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { localDate } from '@/components/event-form-model';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAnimals, useDataLayer, useRepo } from '@/data';
import { cn } from '@/lib/utils';

export function RequestFormPage() {
  const { ternak, jenis } = useSearch({ from: '/tugas/ajukan' });
  const animals = useAnimals();
  const repo = useRepo();
  const { now } = useDataLayer();
  const navigate = useNavigate();
  const id = useId();
  const [animalId, setAnimalId] = useState(ternak ?? '');
  const [type, setType] = useState<'IB' | 'PKB'>(jenis ?? 'IB');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!animals) return null;
  const females = animals.filter((a) => a.sex === 'F');
  if (females.length === 0) {
    return (
      <EmptyState icon={PawPrint} title="Belum ada sapi betina">
        Permintaan IB dan PKB hanya untuk sapi betina yang terdaftar.
      </EmptyState>
    );
  }
  const chosen = females.find(
    (a) => a.id === (animalId || (females.length === 1 ? females[0]?.id : '')),
  );

  async function submit() {
    if (!chosen) {
      setMissing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.createServiceRequest({
        animalId: chosen.id,
        type,
        preferredDate: date || undefined,
        notes: notes.trim() || undefined,
      });
      void navigate({ to: '/tugas', replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="mb-2 font-semibold">Minta petugas untuk</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['IB', 'IB', 'Sapi sedang birahi'],
              ['PKB', 'PKB', 'Periksa bunting'],
            ] as const
          ).map(([v, label, hint]) => (
            <label
              key={v}
              className={cn(
                'flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-lg border-(length:--bw) px-2 text-center has-focus-visible:outline-3 has-focus-visible:outline-ring',
                type === v
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card',
              )}
            >
              <input
                type="radio"
                name={`${id}-type`}
                checked={type === v}
                onChange={() => {
                  setType(v);
                }}
                className="sr-only"
              />
              <span className="text-lg font-bold">{label}</span>
              <span className="text-sm">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-animal`}>Sapi</Label>
        <NativeSelect
          id={`${id}-animal`}
          value={chosen?.id ?? ''}
          aria-invalid={missing && !chosen ? true : undefined}
          onChange={(e) => {
            setAnimalId(e.target.value);
            setMissing(false);
          }}
        >
          <option value="">Pilih sapi</option>
          {females.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name ?? 'Tanpa nama'}
              {a.qrCode ? ` (${a.qrCode})` : ''}
            </option>
          ))}
        </NativeSelect>
        {missing && !chosen && <p className="font-semibold text-alarm">Pilih sapinya dulu.</p>}
        {chosen && <StatusBadge status={chosen.status} className="mt-1 self-start" />}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-date`}>Minta datang tanggal (boleh kosong)</Label>
        <Input
          id={`${id}-date`}
          type="date"
          min={localDate(now())}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-notes`}>Pesan untuk petugas (boleh kosong)</Label>
        <Textarea
          id={`${id}-notes`}
          placeholder="Contoh: birahi sejak pagi, kandang di belakang rumah"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
          }}
        />
      </div>

      {error !== null && <ErrorMessage error={error} />}

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? 'Mengirim…' : `Ajukan ${type}`}
      </Button>
      <p className="text-sm text-muted-foreground">
        Permintaan tersimpan di HP dan terkirim saat ada sinyal. Admin kelompok akan menugaskan
        petugas.
      </p>
    </form>
  );
}
