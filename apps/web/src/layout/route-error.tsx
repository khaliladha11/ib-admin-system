// Penangkap error per halaman: menggantikan layar putih dengan pesan yang jelas dan jalan keluar.
import { Link, type ErrorComponentProps } from '@tanstack/react-router';
import { RotateCcw } from 'lucide-react';

import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';

export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage
        error={error}
        action={
          <>
            <Button
              onClick={() => {
                reset();
                window.location.reload();
              }}
            >
              <RotateCcw aria-hidden="true" />
              Muat ulang
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Ke beranda</Link>
            </Button>
          </>
        }
      />
      <p className="max-w-prose text-muted-foreground">
        Bila masalah terus muncul, hubungi admin kelompok.
      </p>
    </div>
  );
}

/** Error di luar kerangka aplikasi (mis. kerangka itu sendiri gagal). */
export function RootError(props: ErrorComponentProps) {
  return (
    <main className="mx-auto max-w-lg p-4 pt-10">
      <RouteError {...props} />
    </main>
  );
}
