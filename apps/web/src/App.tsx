import { HEALTH_PATH, isHealthResponse, type HealthResponse } from '@ib/shared';
import { CircleCheck, CircleX, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type HealthState = { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error' };

async function fetchHealth(signal: AbortSignal): Promise<HealthResponse | null> {
  try {
    const res = await fetch(HEALTH_PATH, { signal });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isHealthResponse(body) ? body : null;
  } catch {
    return null;
  }
}

export function App() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal).then((health) => {
      if (controller.signal.aborted) return;
      setState(health ? { kind: 'ok', health } : { kind: 'error' });
    });
    return () => {
      controller.abort();
    };
  }, [attempt]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-3xl">Halo!</h1>
          </CardTitle>
          <CardDescription className="text-base">
            IB Admin System sedang dibangun ulang. Halaman ini memeriksa koneksi ke server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <HealthStatus state={state} />
          <Button
            variant="outline"
            onClick={retry}
            disabled={state.kind === 'loading'}
            className="w-full"
          >
            <RefreshCw aria-hidden="true" />
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function HealthStatus({ state }: { state: HealthState }) {
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-lg border p-4">
      {state.kind === 'loading' && (
        <>
          <LoaderCircle aria-hidden="true" className="size-6 shrink-0 animate-spin" />
          <p className="font-medium">Memeriksa server…</p>
        </>
      )}
      {state.kind === 'ok' && (
        <>
          <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-green-700" />
          <div>
            <p className="font-medium">Server terhubung</p>
            <p className="text-sm text-muted-foreground">
              Waktu server:{' '}
              {new Date(state.health.time).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <CircleX aria-hidden="true" className="size-6 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Server tidak bisa dihubungi</p>
            <p className="text-sm text-muted-foreground">
              Pastikan server sudah berjalan, lalu coba lagi.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
