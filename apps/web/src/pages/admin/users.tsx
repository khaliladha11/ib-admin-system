// Manajemen pengguna (admin). Membaca dari data di perangkat; menambah/mengubah langsung ke
// server (online-only) karena menyangkut password dan hak akses.
import type { PublicUser, UserRole } from '@ib/shared';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ChevronRight, CloudOff, Plus, UserCog } from 'lucide-react';
import { useId, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { ROLE_LABEL } from '@/components/request-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import {
  assignableRoles,
  createUser,
  LocalValidationError,
  resetPassword,
  updateUser,
  useDataLayer,
  useFarmerViews,
  type FarmerView,
  useUsers,
} from '@/data';
import { useOnline } from '@/hooks/use-online';
import { cn } from '@/lib/utils';

import { useAdminScope } from './scope';

const ROLE_FILTERS: (UserRole | 'semua')[] = [
  'semua',
  'inseminator',
  'farmer',
  'group_admin',
  'agency_admin',
];
const MIN_PASSWORD = 8;

function OfflineNotice() {
  const online = useOnline();
  if (online) return null;
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-lg border-(length:--bw) border-soil bg-card p-3 font-semibold text-soil"
    >
      <CloudOff aria-hidden="true" className="size-5 shrink-0" />
      Menambah atau mengubah pengguna butuh internet. Daftar di bawah adalah data terakhir di
      perangkat.
    </p>
  );
}

export function UsersPage() {
  const users = useUsers();
  const scope = useAdminScope();
  const [role, setRole] = useState<UserRole | 'semua'>('semua');
  if (!users || !scope) return null;
  const shown = users.filter((u) => role === 'semua' || u.role === role);
  return (
    <div className="flex flex-col gap-4">
      <OfflineNotice />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Peran" className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => {
                setRole(r);
              }}
              className={cn(
                'min-h-11 rounded-full border-(length:--bw) px-4 font-semibold',
                role === r
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card',
              )}
            >
              {r === 'semua' ? 'Semua' : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <Button asChild size="lg">
          <Link to="/pengguna/baru">
            <Plus aria-hidden="true" />
            Tambah pengguna
          </Link>
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={UserCog} title="Belum ada pengguna dengan peran ini" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border-(length:--bw) bg-card lg:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Daftar pengguna</caption>
              <thead className="bg-secondary">
                <tr>
                  {['Nama', 'Peran', 'Lokasi', 'Kontak', 'Status', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold">
                      {h || <span className="sr-only">Ubah</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr
                    key={u.id}
                    className={cn('border-t-(length:--bw)', !u.isActive && 'text-muted-foreground')}
                  >
                    <td className="px-4 py-3 font-semibold">{u.name}</td>
                    <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                    <td className="px-4 py-3">{scope.nameOf(u.locationId) ?? '–'}</td>
                    <td className="px-4 py-3">
                      {u.phone && <span className="block tabular-nums">{u.phone}</span>}
                      {u.email && <span className="block text-sm">{u.email}</span>}
                    </td>
                    <td className="px-4 py-3">{u.isActive ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="px-2 py-3 text-right">
                      <Link
                        to="/pengguna/$userId"
                        params={{ userId: u.id }}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold text-primary"
                        aria-label={`Ubah ${u.name}`}
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
            {shown.map((u) => (
              <li key={u.id}>
                <Link
                  to="/pengguna/$userId"
                  params={{ userId: u.id }}
                  className="flex items-center gap-3 rounded-xl border-(length:--bw) bg-card p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{u.name}</span>
                    <span className="block text-muted-foreground">
                      {[
                        ROLE_LABEL[u.role],
                        scope.nameOf(u.locationId),
                        u.isActive ? null : 'nonaktif',
                      ]
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

export function UserFormPage() {
  const params = useParams({ strict: false });
  const userId = (params as { userId?: string }).userId;
  const users = useUsers();
  const scope = useAdminScope();
  const farmers = useFarmerViews();
  // Isian awal dihitung sekali; tunggu sesi, wilayah, dan peternak terbaca dulu.
  if (!users || !scope || !farmers) return null;
  const user = userId ? users.find((u) => u.id === userId) : undefined;
  if (userId && !user) return <EmptyState icon={UserCog} title="Pengguna tidak ditemukan" />;
  return <UserForm key={user?.id ?? 'baru'} user={user} scope={scope} farmers={farmers} />;
}

function UserForm({
  user,
  scope,
  farmers,
}: {
  user?: PublicUser;
  scope: NonNullable<ReturnType<typeof useAdminScope>>;
  farmers: FarmerView[];
}) {
  const layer = useDataLayer();
  const { session } = scope;
  const online = useOnline();
  const navigate = useNavigate();
  const search: { peternak?: string } = useSearch({ strict: false });
  const id = useId();
  const linkFarmer = farmers.find((f) => f.id === search.peternak);
  const roles = assignableRoles(session.user.role);
  const initialRole: UserRole = user?.role ?? (linkFarmer ? 'farmer' : 'inseminator');
  const [form, setForm] = useState({
    name: user?.name ?? linkFarmer?.name ?? '',
    role: initialRole,
    locationId: user?.locationId ?? linkFarmer?.locationId ?? session.user.locationId ?? '',
    phone: user?.phone ?? linkFarmer?.phone ?? '',
    email: user?.email ?? '',
    password: '',
    farmerId: linkFarmer?.id ?? '',
  });
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const self = user?.id === session.user.id;
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };
  const unlinked = farmers.filter((f) => !f.hasAccount);
  const isFarmer = form.role === 'farmer';

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (user) {
        await updateUser(layer, user.id, {
          name: form.name,
          role: form.role,
          locationId: form.locationId,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          isActive,
        });
        setMessage('Perubahan tersimpan.');
      } else {
        if (!form.name.trim()) throw new LocalValidationError('Isi nama pengguna.');
        if (!form.phone.trim() && !form.email.trim()) {
          throw new LocalValidationError('Isi nomor HP atau email untuk masuk.');
        }
        if (isFarmer && !form.farmerId) {
          throw new LocalValidationError('Pilih data peternak yang dibuatkan akun.');
        }
        if (!isFarmer && !form.locationId) throw new LocalValidationError('Pilih wilayah kerja.');
        if (form.password.length < MIN_PASSWORD) {
          throw new LocalValidationError(`Password minimal ${String(MIN_PASSWORD)} karakter.`);
        }
        await createUser(layer, {
          name: form.name,
          role: form.role,
          locationId: isFarmer
            ? (farmers.find((f) => f.id === form.farmerId)?.locationId ?? form.locationId)
            : form.locationId,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          password: form.password,
          farmerId: isFarmer ? form.farmerId || undefined : undefined,
        });
        void navigate({ to: '/pengguna', replace: true });
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const input = (
    key: 'name' | 'phone' | 'email' | 'password',
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
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <form
        noValidate
        className="flex flex-col gap-4 rounded-xl border-(length:--bw) bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <OfflineNotice />
        {input('name', 'Nama')}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-role`}>Peran</Label>
          <NativeSelect
            id={`${id}-role`}
            value={form.role}
            disabled={self}
            onChange={(e) => {
              set('role')(e.target.value);
            }}
          >
            {(roles.includes(form.role) ? roles : [form.role, ...roles]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {isFarmer && !user ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-farmer`}>Data peternak</Label>
            <NativeSelect
              id={`${id}-farmer`}
              value={form.farmerId}
              onChange={(e) => {
                set('farmerId')(e.target.value);
                const f = farmers.find((x) => x.id === e.target.value);
                if (f)
                  setForm((prev) => ({
                    ...prev,
                    farmerId: f.id,
                    name: prev.name || f.name,
                    phone: prev.phone || (f.phone ?? ''),
                  }));
              }}
            >
              <option value="">Pilih peternak (yang belum punya akun)</option>
              {unlinked.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}, {f.locationName}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-loc`}>Wilayah kerja</Label>
            <NativeSelect
              id={`${id}-loc`}
              value={form.locationId}
              onChange={(e) => {
                set('locationId')(e.target.value);
              }}
            >
              {scope.inScope.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {input('phone', 'Nomor HP (untuk masuk dan WhatsApp)', {
          inputMode: 'tel',
          placeholder: '0812…',
        })}
        {input('email', 'Email (boleh kosong)', { type: 'email', autoCapitalize: 'none' })}
        {!user &&
          input('password', `Password awal (minimal ${String(MIN_PASSWORD)} karakter)`, {
            type: 'text',
            autoComplete: 'new-password',
          })}
        {user && !self && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <input
              type="checkbox"
              className="size-6 accent-(--leaf)"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
              }}
            />
            Akun aktif (bila dimatikan, pengguna langsung keluar dari semua perangkat)
          </label>
        )}
        {error !== null && <ErrorMessage error={error} />}
        {message && (
          <p role="status" className="font-semibold text-primary">
            {message}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || !online}>
          {user ? 'Simpan perubahan' : 'Buat akun'}
        </Button>
      </form>

      {user && !self && (
        <section className="flex flex-col gap-3 self-start rounded-xl border-(length:--bw) bg-card p-4">
          <h2 className="text-lg font-bold">Atur ulang password</h2>
          <p className="text-muted-foreground">
            Pakai bila pengguna lupa password. Sampaikan password baru secara langsung, lalu minta
            pengguna menggantinya. Pengguna akan keluar dari semua perangkat.
          </p>
          <Label htmlFor={`${id}-newpass`}>Password baru</Label>
          <Input
            id={`${id}-newpass`}
            value={newPassword}
            autoComplete="new-password"
            onChange={(e) => {
              setNewPassword(e.target.value);
            }}
          />
          <Button
            variant="outline"
            disabled={busy || !online || newPassword.length < MIN_PASSWORD}
            onClick={() => {
              setBusy(true);
              setError(null);
              resetPassword(layer, user.id, newPassword)
                .then(() => {
                  setNewPassword('');
                  setMessage('Password diganti.');
                })
                .catch(setError)
                .finally(() => {
                  setBusy(false);
                });
            }}
          >
            Ganti password
          </Button>
        </section>
      )}
    </div>
  );
}
