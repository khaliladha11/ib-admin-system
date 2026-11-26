import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiRequestError, NetworkError, signIn, useDataLayer } from '@/data';

import { AuthFrame } from './auth-frame';

/** Masuk dengan email atau nomor HP + password. Pertama kali butuh internet. */
export function LoginPage({ onSignedIn, notice }: { onSignedIn?: () => void; notice?: ReactNode }) {
  const { db, api, sync } = useDataLayer();
  const id = useId();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState<string | null>(null);

  async function submit() {
    if (!identifier.trim() || !password) {
      setMissing(!identifier.trim() ? 'Isi email atau nomor HP.' : 'Isi password.');
      return;
    }
    setMissing(null);
    setBusy(true);
    setError(null);
    try {
      await signIn(db, api, identifier.trim(), password);
      void sync.syncNow().catch(() => undefined);
      onSignedIn?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Masuk"
      intro="Catat birahi, IB, PKB, dan kelahiran sapi. Bisa dipakai tanpa sinyal setelah masuk."
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {notice}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-user`}>Email atau nomor HP</Label>
          <Input
            id={`${id}-user`}
            autoComplete="username"
            autoCapitalize="none"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
            }}
            placeholder="0812… atau nama@contoh.test"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-pass`}>Password</Label>
          <div className="relative">
            <Input
              id={`${id}-pass`}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              className="pr-14"
            />
            <button
              type="button"
              onClick={() => {
                setShow((s) => !s);
              }}
              aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute top-0 right-0 flex size-12 items-center justify-center text-muted-foreground"
            >
              {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        </div>
        {missing && <p className="font-semibold text-alarm">{missing}</p>}
        {error !== null && <LoginError error={error} />}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Memeriksa…' : 'Masuk'}
        </Button>
        <p className="text-sm text-muted-foreground">
          Lupa password? Hubungi admin kelompok Anda untuk mengatur ulang.
        </p>
      </form>
    </AuthFrame>
  );
}

function LoginError({ error }: { error: unknown }) {
  if (error instanceof ApiRequestError && error.status === 401) {
    return (
      <p role="alert" className="font-semibold text-alarm">
        Email/nomor HP atau password salah. Periksa lagi, lalu coba masuk.
      </p>
    );
  }
  if (error instanceof NetworkError) {
    return (
      <p role="alert" className="font-semibold text-alarm">
        Tidak bisa terhubung ke server. Masuk pertama kali butuh internet; cari sinyal lalu coba
        lagi.
      </p>
    );
  }
  return <ErrorMessage error={error} />;
}
