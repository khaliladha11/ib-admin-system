// Halaman Scan (langkah 3.2): kamera belakang membaca label QR, hasilnya dicari di HP (offline).
// Satu sapi: langsung ke profil dengan tombol cepat. Scan beruntun: daftar sapi yang terbaca.
import { useNavigate } from '@tanstack/react-router';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  ListChecks,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { classifyScanText, useScanLookup } from '@/data';
import { errorIdOf, fieldA11y } from '@/lib/a11y';
import { batchStore, useBatchItems } from '@/lib/scan/batch-store';
import { CAMERA_PROBLEM_TEXT } from '@/lib/scan/camera';
import { scanFeedback } from '@/lib/scan/feedback';
import { cn } from '@/lib/utils';

import { ScanResultView } from './scan-result';
import { useQrScanner } from './use-qr-scanner';

/** Pilihan "Scan beruntun" diingat per HP (petugas yang mendata banyak sapi). */
const CONTINUOUS_KEY = 'ib-scan-continuous';
function loadContinuous() {
  try {
    return localStorage.getItem(CONTINUOUS_KEY) === '1';
  } catch {
    return false;
  }
}
function saveContinuous(on: boolean) {
  try {
    localStorage.setItem(CONTINUOUS_KEY, on ? '1' : '0');
  } catch {
    // penyimpanan diblokir: pilihan berlaku sampai halaman ditutup
  }
}

export function ScanPage() {
  const navigate = useNavigate();
  const lookup = useScanLookup();
  const batch = useBatchItems();
  const id = useId();
  const [continuous, setContinuousState] = useState(() => batch.length > 0 || loadContinuous());
  const setContinuous = (on: boolean) => {
    setContinuousState(on);
    saveContinuous(on);
  };
  /** Hasil scan tunggal yang sedang ditampilkan (kamera berhenti membaca). */
  const [shown, setShown] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  async function handle(text: string) {
    const parsed = classifyScanText(text);
    if (continuous) {
      scanFeedback(parsed ? 'ok' : 'unknown');
      if (!parsed) {
        setAnnounce('Bukan label ternak.');
        return;
      }
      const added = batchStore.add(parsed.code, text, Date.now());
      setAnnounce(added ? `${parsed.code} ditambahkan.` : `${parsed.code} sudah ada di daftar.`);
      return;
    }
    const result = await lookup(text);
    scanFeedback(result.kind === 'animal' || result.kind === 'unused' ? 'ok' : 'unknown');
    if (result.kind === 'animal') {
      void navigate({
        to: '/ternak/$animalId',
        params: { animalId: result.animal.id },
        search: { scan: '1' },
      });
      return;
    }
    setShown(text);
  }

  const { videoRef, state, start, toggleTorch, forgetLast } = useQrScanner((text) => {
    void handle(text);
  }, shown !== null);

  function submitManual(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!classifyScanText(manual)) {
      setManualError('Ketik kode QR (contoh IB-7K2QM) atau nomor eartag.');
      return;
    }
    setManualError(null);
    void handle(manual);
    setManual('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-2xl bg-ink"
        style={{ aspectRatio: '4 / 3', maxHeight: '45vh' }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Gambar kamera"
          className={cn('size-full object-cover', state.status !== 'scanning' && 'invisible')}
        />
        {state.status === 'scanning' && (
          <>
            {/* Bingkai bidik */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-[12%] left-1/2 aspect-square -translate-x-1/2 rounded-2xl border-4 border-straw shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]"
            />
            <p className="absolute inset-x-0 bottom-3 text-center font-semibold text-white">
              {shown ? 'Berhenti membaca' : 'Arahkan ke label QR'}
            </p>
            {state.torch !== null && (
              <Button
                variant="outline"
                size="icon"
                className="absolute top-3 right-3"
                aria-label={state.torch ? 'Matikan senter' : 'Nyalakan senter'}
                aria-pressed={state.torch}
                onClick={() => void toggleTorch()}
              >
                {state.torch ? (
                  <FlashlightOff aria-hidden="true" />
                ) : (
                  <Flashlight aria-hidden="true" />
                )}
              </Button>
            )}
          </>
        )}
        {state.status !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-white">
            {state.status === 'error' ? (
              <div role="alert" className="flex flex-col gap-2">
                <p className="text-lg font-bold">{CAMERA_PROBLEM_TEXT[state.problem].title}</p>
                <p className="text-white/90">{CAMERA_PROBLEM_TEXT[state.problem].body}</p>
              </div>
            ) : (
              <Camera aria-hidden="true" className="size-12 opacity-80" />
            )}
            <Button
              size="lg"
              variant="accent"
              disabled={state.status === 'starting'}
              onClick={() => void start()}
            >
              <Camera aria-hidden="true" />
              {state.status === 'starting'
                ? 'Membuka kamera…'
                : state.status === 'error'
                  ? 'Coba lagi'
                  : 'Nyalakan kamera'}
            </Button>
          </div>
        )}
      </div>

      {!continuous && shown && (
        <div className="flex flex-col gap-2">
          <ScanResultView text={shown} />
          <Button
            variant="outline"
            onClick={() => {
              setShown(null);
              forgetLast();
            }}
          >
            <RotateCcw aria-hidden="true" />
            Scan lagi
          </Button>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <label className="surface flex min-h-14 cursor-pointer items-center justify-between gap-4 p-4">
        <span className="flex items-center gap-3">
          <ListChecks aria-hidden="true" className="size-6 shrink-0" />
          <span>
            <span className="block font-bold">Scan beruntun</span>
            <span className="block text-muted-foreground">
              Untuk mendata banyak sapi: kamera terus membaca, hasilnya dikumpulkan di bawah.
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={continuous}
          onChange={(e) => {
            setContinuous(e.target.checked);
            setShown(null);
          }}
          className="size-7 shrink-0 accent-(--leaf)"
        />
      </label>

      {continuous && (
        <Panel
          title={`Hasil scan (${String(batch.length)})`}
          titleId={`${id}-batch`}
          action={
            batch.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  batchStore.clear();
                  forgetLast();
                }}
              >
                <Trash2 aria-hidden="true" />
                Kosongkan
              </Button>
            )
          }
        >
          {batch.length === 0 ? (
            <p className="text-muted-foreground">
              Scan label satu per satu. Setiap kode yang terbaca muncul di sini; scan ulang tidak
              menambah baris.
            </p>
          ) : (
            <ol className="flex flex-col">
              {batch.map((item) => (
                <li key={item.key} className="border-t-(length:--bw) py-2 first:border-t-0">
                  <ScanResultView text={item.key} compact />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      <Panel title="Ketik kode">
        <form onSubmit={submitManual} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor={`${id}-manual`}>Kode QR atau nomor eartag</Label>
            <Input
              id={`${id}-manual`}
              value={manual}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="IB-XXXXX atau nomor eartag"
              onChange={(e) => {
                setManual(e.target.value);
              }}
              {...fieldA11y(`${id}-manual`, manualError)}
            />
            {manualError && (
              <p id={errorIdOf(`${id}-manual`)} role="alert" className="font-semibold text-alarm">
                {manualError}
              </p>
            )}
          </div>
          <Button type="submit" size="lg">
            <Search aria-hidden="true" />
            Cari
          </Button>
        </form>
      </Panel>
    </div>
  );
}
