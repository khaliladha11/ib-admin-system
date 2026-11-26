// Manajemen peternak (admin): daftar, tambah, ubah. Tersimpan di perangkat lalu dikirim (outbox).
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ChevronRight, KeyRound, Plus, Search, Users } from 'lucide-react';
import { useId, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFarmerViews, useRepo, type FarmerView } from '@/data';
import { normalizeSearch } from '@/lib/format';

import { useAdminScope } from './scope';

export function FarmersPage() {
  const farmers = useFarmerViews();
  const [q, setQ] = useState('');
  if (!farmers) return null;
  const query = normalizeSearch(q);
  const shown = farmers.filter(
    (f) =>
      !query ||
      [f.name, f.phone ?? '', f.locationName ?? ''].some((t) => normalizeSearch(t).includes(query)),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Cari peternak"
            placeholder="Cari nama, nomor HP, desa"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
            className="pl-10"
          />
        </div>
        <Button asChild size="lg">
          <Link to="/peternak/baru">
            <Plus aria-hidden="true" />
            Tambah peternak
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground">{shown.length} peternak</p>
      {shown.length === 0 ? (
        <EmptyState icon={Users} title="Tidak ada peternak yang cocok">
          Coba kata lain, atau tambah peternak baru.
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border-(length:--bw) bg-card lg:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Daftar peternak</caption>
              <thead className="bg-secondary">
                <tr>
                  {['Nama', 'Desa', 'Nomor HP', 'Ternak', 'Akun aplikasi', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold">
                      {h || <span className="sr-only">Ubah</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.id} className="border-t-(length:--bw)">
                    <td className="px-4 py-3 font-semibold">{f.name}</td>
                    <td className="px-4 py-3">{f.locationName ?? '–'}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {f.phone ?? <span className="text-muted-foreground">–</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{f.animalCount}</td>
                    <td className="px-4 py-3">
                      {f.hasAccount ? 'Ada' : <span className="text-muted-foreground">Belum</span>}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Link
                        to="/peternak/$farmerId"
                        params={{ farmerId: f.id }}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold text-primary"
                        aria-label={`Ubah ${f.name}`}
                      >
                        Ubah
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 lg:hidden">
            {shown.map((f) => (
              <li key={f.id}>
                <Link
                  to="/peternak/$farmerId"
                  params={{ farmerId: f.id }}
                  className="flex items-center gap-3 rounded-xl border-(length:--bw) bg-card p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{f.name}</span>
                    <span className="block text-muted-foreground">
                      {[f.locationName, f.phone, `${String(f.animalCount)} ternak`]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function FarmerFormPage() {
  const params = useParams({ strict: false });
  const farmerId = (params as { farmerId?: string }).farmerId;
  const farmers = useFarmerViews();
  const scope = useAdminScope();
  if (!farmers || !scope) return null;
  const farmer = farmerId ? farmers.find((f) => f.id === farmerId) : undefined;
  if (farmerId && !farmer) {
    return <EmptyState icon={Users} title="Peternak tidak ditemukan" />;
  }
  return <FarmerForm key={farmer?.id ?? 'baru'} farmer={farmer} villages={scope.villages} />;
}

function FarmerForm({
  farmer,
  villages,
}: {
  farmer?: FarmerView;
  villages: { id: string; name: string }[];
}) {
  const repo = useRepo();
  const navigate = useNavigate();
  const id = useId();
  const [form, setForm] = useState({
    name: farmer?.name ?? '',
    locationId: farmer?.locationId ?? villages[0]?.id ?? '',
    phone: farmer?.phone ?? '',
    address: farmer?.address ?? '',
    isikhnasOwnerId: farmer?.isikhnasOwnerId ?? '',
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function save() {
    setBusy(true);
    setError(null);
    const input = {
      name: form.name,
      locationId: form.locationId,
      phone: form.phone.replace(/[\s-]/g, '') || undefined,
      address: form.address.trim() || undefined,
      isikhnasOwnerId: form.isikhnasOwnerId.trim() || undefined,
    };
    try {
      if (farmer) await repo.updateFarmer(farmer.id, input);
      else await repo.createFarmer(input);
      void navigate({ to: '/peternak', replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input
        id={`${id}-${key}`}
        value={form[key]}
        onChange={(e) => {
          set(key)(e.target.value);
        }}
        {...props}
      />
    </div>
  );

  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {field('name', 'Nama peternak')}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-loc`}>Desa</Label>
        <NativeSelect
          id={`${id}-loc`}
          value={form.locationId}
          onChange={(e) => {
            set('locationId')(e.target.value);
          }}
        >
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {field('phone', 'Nomor HP (untuk WhatsApp, boleh kosong)', {
        inputMode: 'tel',
        placeholder: '0812…',
      })}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-address`}>Alamat (boleh kosong)</Label>
        <Textarea
          id={`${id}-address`}
          value={form.address}
          onChange={(e) => {
            set('address')(e.target.value);
          }}
        />
      </div>
      {field('isikhnasOwnerId', 'ID pemilik iSIKHNAS (boleh kosong)')}
      {error !== null && <ErrorMessage error={error} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={busy}>
          {farmer ? 'Simpan perubahan' : 'Simpan peternak'}
        </Button>
        {farmer && !farmer.hasAccount && (
          <Button asChild variant="outline" size="lg">
            <Link to="/pengguna/baru" search={{ peternak: farmer.id }}>
              <KeyRound aria-hidden="true" />
              Buat akun aplikasi
            </Link>
          </Button>
        )}
      </div>
    </form>
  );
}
