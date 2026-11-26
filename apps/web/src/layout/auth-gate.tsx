// Pintu masuk aplikasi: belum masuk → layar Masuk; PIN terpasang dan terkunci → layar PIN;
// baru masuk dan belum ada PIN → tawaran pasang PIN; selain itu → aplikasi.
import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useHasPin, useSession, useUnlocked } from '@/data';
import { LoginPage } from '@/pages/auth/login';
import { PinOfferPage, PinUnlockPage } from '@/pages/auth/pin-pages';

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const hasPin = useHasPin();
  const unlocked = useUnlocked();
  const [offerPin, setOfferPin] = useState(false);

  if (session === undefined || hasPin === undefined) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center gap-3 text-lg">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
        Membuka data di HP…
      </div>
    );
  }
  if (session === null) {
    return (
      <LoginPage
        onSignedIn={() => {
          setOfferPin(true);
        }}
      />
    );
  }
  if (hasPin && !unlocked) return <PinUnlockPage />;
  if (offerPin && !hasPin) {
    return (
      <PinOfferPage
        onFinish={() => {
          setOfferPin(false);
        }}
      />
    );
  }
  return children;
}
