// Pemberitahuan service worker (langkah 4.1): "Perbarui sekarang" saat ada versi baru, dan
// pesan singkat saat aplikasi pertama kali siap dipakai tanpa sinyal.
import { CloudCheck, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/ui/button';

import { READY_MESSAGE_MS, swMessage, UPDATE_CHECK_INTERVAL_MS } from './update-prompt-model';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      window.setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = window.setTimeout(() => {
      setOfflineReady(false);
    }, READY_MESSAGE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [offlineReady, needRefresh, setOfflineReady]);

  const message = swMessage({ needRefresh, offlineReady });
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-3 bottom-[5.25rem] z-50 flex justify-center lg:inset-x-auto lg:right-4 lg:bottom-4"
    >
      {message && (
        <div className="surface pointer-events-auto flex w-full max-w-md flex-col gap-3 p-4">
          <p className="flex items-start gap-3">
            {message.kind === 'update' ? (
              <RefreshCw aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <CloudCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            )}
            <span>
              <span className="block font-bold">{message.title}</span>
              <span className="block text-muted-foreground">{message.body}</span>
            </span>
          </p>
          {message.kind === 'update' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setNeedRefresh(false);
                }}
              >
                Nanti
              </Button>
              <Button variant="accent" onClick={() => void updateServiceWorker(true)}>
                Perbarui sekarang
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="self-end"
              onClick={() => {
                setOfflineReady(false);
              }}
            >
              Tutup
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
