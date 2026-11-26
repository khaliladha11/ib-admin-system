import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { ErrorMessage } from '@/components/error-message';
import { PinPad } from '@/components/pin-pad';
import { Button } from '@/components/ui/button';
import { lockApp, setPin, useDataLayer, useSession, verifyPin } from '@/data';

import { AuthFrame } from './auth-frame';

/** Buka aplikasi dengan PIN (perangkat sendiri). */
export function PinUnlockPage() {
  const { db } = useDataLayer();
  const session = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(0);

  async function check(pin: string) {
    setBusy(true);
    const result = await verifyPin(db, pin);
    setBusy(false);
    if (result.ok) return;
    setReset((n) => n + 1);
    setMessage(
      result.reason === 'wrong'
        ? `PIN salah. Sisa ${String(result.attemptsLeft)} kali lagi sebelum harus masuk dengan password.`
        : 'Terlalu banyak salah. Masuk dengan password.',
    );
  }

  async function forgot() {
    // Lupa PIN: hapus PIN dan sesi lokal, lalu masuk dengan password. Data di HP tetap ada.
    await db.meta.bulkDelete(['pin', 'session']);
    lockApp();
  }

  return (
    <AuthFrame
      title={session ? `Halo, ${session.user.name.split(' ')[0] ?? ''}` : 'Masukkan PIN'}
      intro="Masukkan PIN untuk membuka aplikasi."
    >
      <div className="flex flex-col gap-4">
        <PinPad onSubmit={check} submitLabel="Buka" disabled={busy} resetKey={reset} />
        {message && (
          <p role="alert" className="text-center font-semibold text-alarm">
            {message}
          </p>
        )}
        <Button variant="ghost" onClick={() => void forgot()}>
          <KeyRound aria-hidden="true" />
          Lupa PIN? Masuk dengan password
        </Button>
      </div>
    </AuthFrame>
  );
}

/** Pasang PIN: isi dua kali. Dipakai setelah masuk pertama dan dari menu Lainnya. */
export function PinSetupForm({ onDone, onSkip }: { onDone: () => void; onSkip?: () => void }) {
  const { db } = useDataLayer();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reset, setReset] = useState(0);

  async function submit(pin: string) {
    if (first === null) {
      setFirst(pin);
      setMessage(null);
      setReset((n) => n + 1);
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setReset((n) => n + 1);
      setMessage('PIN tidak sama. Ulangi dari awal.');
      return;
    }
    try {
      await setPin(db, pin);
      onDone();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-lg font-bold">
        {first === null ? 'Buat PIN 4–6 angka' : 'Ulangi PIN yang sama'}
      </p>
      <PinPad
        onSubmit={submit}
        submitLabel={first === null ? 'Lanjut' : 'Simpan'}
        resetKey={reset}
      />
      {message && (
        <p role="alert" className="text-center font-semibold text-alarm">
          {message}
        </p>
      )}
      {error !== null && <ErrorMessage error={error} />}
      {onSkip && (
        <Button variant="ghost" onClick={onSkip}>
          Lewati, pakai password saja
        </Button>
      )}
    </div>
  );
}

export function PinOfferPage({ onFinish }: { onFinish: () => void }) {
  return (
    <AuthFrame
      title="Pasang PIN?"
      intro="Di HP sendiri, buka aplikasi cukup dengan PIN, juga saat tidak ada sinyal. PIN hanya tersimpan di HP ini."
    >
      <PinSetupForm onDone={onFinish} onSkip={onFinish} />
    </AuthFrame>
  );
}
