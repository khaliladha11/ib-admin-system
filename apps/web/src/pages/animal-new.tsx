// Daftarkan sapi baru, biasanya dari Scan dengan kode label yang belum terpakai (langkah 3.2).
// Tersimpan di HP dulu dan dikirim saat online; kode QR/eartag langsung terpasang.
import type { AnimalSex } from '@ib/shared';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { QrCode, Tag } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';

import { ErrorMessage } from '@/components/error-message';
import { FormSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useFarmers, useRepo, useSession } from '@/data';
import { errorIdOf, fieldA11y } from '@/lib/a11y';
import { TAG_TYPE_TEXT } from '@/lib/tag-text';
import { cn } from '@/lib/utils';

const SEXES: readonly [AnimalSex, string][] = [
  ['F', 'Betina'],
  ['M', 'Jantan'],
];

export function AnimalNewPage() {
  const { kode, tag, kembali } = useSearch({ from: '/ternak/baru' });
  const session = useSession();
  const farmers = useFarmers();
  const repo = useRepo();
  const navigate = useNavigate();
  const id = useId();
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<AnimalSex>('F');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [missingFarmer, setMissingFarmer] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!farmers || !session) return <FormSkeleton />;
  const isFarmer = session.user.role === 'farmer';
  const chosen = isFarmer
    ? session.farmerId
    : (farmerId ?? (farmers.length === 1 ? farmers[0]?.id : null));
  const tagType = tag ?? 'qr';

  async function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosen) {
      setMissingFarmer(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const animal = await repo.createAnimal({
        farmerId: chosen,
        sex,
        name: name.trim() || undefined,
        breed: breed.trim() || undefined,
        birthDate: birthDate || undefined,
        ...(kode && tagType === 'qr' ? { qrCode: kode } : {}),
        ...(kode && tagType === 'eartag' ? { eartag: kode } : {}),
      });
      if (kembali === 'scan') {
        void navigate({ to: '/scan' });
      } else {
        void navigate({
          to: '/ternak/$animalId',
          params: { animalId: animal.id },
          search: { tersimpan: 'Sapi baru' },
        });
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const farmerError = missingFarmer && !chosen ? 'Pilih peternak pemilik sapi.' : null;
  const Icon = tagType === 'qr' ? QrCode : Tag;

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
      {kode && (
        <p className="surface flex items-center gap-3 p-4">
          <Icon aria-hidden="true" className="size-6 shrink-0 text-primary" />
          <span>
            <span className="block text-sm text-muted-foreground">{TAG_TYPE_TEXT[tagType]}</span>
            <span className="text-xl font-bold tracking-wide">{kode}</span>
          </span>
        </p>
      )}

      {!isFarmer && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-farmer`}>Peternak pemilik</Label>
          <NativeSelect
            id={`${id}-farmer`}
            value={chosen ?? ''}
            onChange={(e) => {
              setFarmerId(e.target.value || null);
            }}
            {...fieldA11y(`${id}-farmer`, farmerError)}
          >
            <option value="">Pilih peternak</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </NativeSelect>
          {farmerError && (
            <p id={errorIdOf(`${id}-farmer`)} role="alert" className="font-semibold text-alarm">
              {farmerError}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Nama panggilan (boleh kosong)</Label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={100}
          placeholder="Contoh: Melati"
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p id={`${id}-sex`} className="font-semibold">
          Jenis kelamin
        </p>
        <div role="radiogroup" aria-labelledby={`${id}-sex`} className="grid grid-cols-2 gap-2">
          {SEXES.map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={sex === value}
              onClick={() => {
                setSex(value);
              }}
              className={cn(
                'min-h-12 rounded-full border-(length:--bw) px-4 font-semibold',
                sex === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card',
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-breed`}>Rumpun (boleh kosong)</Label>
          <Input
            id={`${id}-breed`}
            value={breed}
            maxLength={50}
            list={`${id}-breeds`}
            placeholder="Contoh: PO, Limousin"
            onChange={(e) => {
              setBreed(e.target.value);
            }}
          />
          <datalist id={`${id}-breeds`}>
            {['PO', 'Bali', 'Madura', 'Limousin', 'Simmental', 'FH', 'Brahman'].map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-birth`}>Tanggal lahir (boleh kosong)</Label>
          <Input
            id={`${id}-birth`}
            type="date"
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value);
            }}
          />
        </div>
      </div>

      {error !== null && <ErrorMessage error={error} />}

      <Button type="submit" size="lg" disabled={busy}>
        {kembali === 'scan' ? 'Simpan dan lanjut scan' : 'Simpan sapi'}
      </Button>
    </form>
  );
}
