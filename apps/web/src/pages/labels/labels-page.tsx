// Cetak label QR (langkah 3.1): untuk ternak terdaftar, atau label kosong untuk sapi yang belum
// didaftarkan. Semua dibuat di HP (juga tanpa internet) dan dicetak lewat CSS print, tanpa server.
import { useSearch } from '@tanstack/react-router';
import { Printer, QrCode as QrIcon, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';

import { Cow } from '@/components/icons/cow';
import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { ListSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { MAX_NEW_QR_CODES, useAnimals, useQrLabels, useRepo, type AnimalView } from '@/data';
import { fieldA11y } from '@/lib/a11y';
import { cn } from '@/lib/utils';

import { LabelSheet, SheetPreview } from './label-sheet';
import { paginate, SHEET_LAYOUTS, type LabelItem } from './sheet-layout';

type Mode = 'ternak' | 'kosong';

/** Tanda di pratinjau untuk ternak yang kodenya baru dibuat saat dicetak. */
const PLACEHOLDER = 'IB-?????';

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string, string?])[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([key, text, hint]) => (
        <button
          key={String(key)}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => {
            onChange(key);
          }}
          className={cn(
            'flex min-h-11 flex-col items-start justify-center rounded-2xl border-(length:--bw) px-4 py-1.5 text-left font-semibold',
            value === key
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-card',
          )}
        >
          {text}
          {hint && <span className="text-sm font-normal opacity-90">{hint}</span>}
        </button>
      ))}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 items-center gap-3 border-t-(length:--bw) py-1.5 first:border-t-0',
        disabled && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="size-6 shrink-0 accent-(--leaf)"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export function LabelsPage() {
  const { ternak } = useSearch({ from: '/label' });
  const animals = useAnimals();
  const labels = useQrLabels();
  const repo = useRepo();
  const id = useId();

  const [mode, setMode] = useState<Mode>('ternak');
  const [perSheet, setPerSheet] = useState<24 | 40>(24);
  const [withName, setWithName] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(ternak ? [ternak] : []));
  const [pickedBlank, setPickedBlank] = useState<Set<string>>(new Set());
  const [count, setCount] = useState('24');
  const [countError, setCountError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Kode yang baru dibuat saat mencetak, untuk ternak yang belum punya QR. */
  const [newCodes, setNewCodes] = useState<Record<string, string>>({});

  const layout = SHEET_LAYOUTS[perSheet];
  const free = useMemo(() => (labels ?? []).filter((l) => l.state === 'free'), [labels]);
  const conflicts = useMemo(() => (labels ?? []).filter((l) => l.state === 'conflict'), [labels]);

  const items: LabelItem[] = useMemo(() => {
    if (mode === 'kosong') {
      return free.filter((l) => pickedBlank.has(l.id)).map((l) => ({ code: l.code, name: null }));
    }
    return (animals ?? [])
      .filter((a) => picked.has(a.id))
      .map((a) => ({
        // Ternak tanpa QR mendapat kode saat dicetak; pratinjau memakai tanda sementara.
        code: a.qrCode ?? newCodes[a.id] ?? PLACEHOLDER,
        name: withName ? a.name : null,
      }));
  }, [mode, free, pickedBlank, animals, picked, withName, newCodes]);
  const pages = paginate(items, layout);

  if (!animals || !labels) return <ListSkeleton label="Memuat data label…" />;

  const missingQr = animals.filter((a) => picked.has(a.id) && !a.qrCode && !newCodes[a.id]);
  const toggle = (set: Set<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };

  async function createBlank() {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > MAX_NEW_QR_CODES) {
      setCountError(`Isi angka 1 sampai ${String(MAX_NEW_QR_CODES)}.`);
      return;
    }
    setCountError(null);
    setBusy(true);
    setError(null);
    try {
      const rows = await repo.reserveQrCodes(n);
      setPickedBlank(new Set(rows.map((r) => r.id)));
      setMessage(`${String(n)} kode baru dibuat dan dipilih untuk dicetak.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function print() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Ternak terpilih yang belum punya QR: buat kode dan pasang sebelum mencetak.
      const created: Record<string, string> = {};
      for (const animal of missingQr) {
        created[animal.id] = (await repo.attachNewQrCode(animal.id)).code;
      }
      // Lembar cetak harus sudah berisi kode baru sebelum dialog cetak dibuka.
      flushSync(() => {
        setNewCodes((prev) => ({ ...prev, ...created }));
      });
      window.print();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const sheetText = `${String(items.length)} label, ${String(pages.length)} lembar`;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-muted-foreground">
        QR hanya berisi kode ternak, tanpa nama atau data peternak. Tempel label di kalung atau
        kandang, lalu pindai dari menu Scan.
      </p>

      <Panel title="Label untuk">
        <Choice
          label="Label untuk"
          value={mode}
          onChange={setMode}
          options={[
            ['ternak', 'Ternak terdaftar', 'QR sapi yang sudah ada'],
            ['kosong', 'Label kosong', 'Untuk sapi yang belum didaftarkan'],
          ]}
        />
      </Panel>

      <Panel title="Kertas stiker A4">
        <Choice
          label="Kertas stiker A4"
          value={perSheet}
          onChange={(v) => {
            setPerSheet(v);
            setCount(String(v));
          }}
          options={[
            [24, '24 label', '3 × 8, label 70 × 37 mm'],
            [40, '40 label', '4 × 10, label 52,5 × 29,7 mm'],
          ]}
        />
        {mode === 'ternak' && (
          <CheckRow checked={withName} onChange={setWithName}>
            Cetak nama panggilan sapi di label
          </CheckRow>
        )}
      </Panel>

      {mode === 'ternak' ? (
        <Panel
          title="Pilih ternak"
          action={
            animals.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPicked(
                    picked.size === animals.length ? new Set() : new Set(animals.map((a) => a.id)),
                  );
                }}
              >
                {picked.size === animals.length ? 'Kosongkan pilihan' : 'Pilih semua'}
              </Button>
            )
          }
        >
          {animals.length === 0 ? (
            <EmptyState icon={Cow} title="Belum ada ternak" className="shadow-none">
              Daftarkan ternak dulu, atau cetak label kosong untuk sapi yang belum terdaftar.
            </EmptyState>
          ) : (
            <div className="flex flex-col">
              {animals.map((a: AnimalView) => (
                <CheckRow
                  key={a.id}
                  checked={picked.has(a.id)}
                  onChange={(on) => {
                    setPicked(toggle(picked, a.id, on));
                  }}
                >
                  <span className="block font-semibold">{a.name ?? 'Tanpa nama'}</span>
                  <span className="block text-sm text-muted-foreground">
                    {a.qrCode ?? 'Belum punya QR: kode baru dibuat saat dicetak'}
                    {a.farmerName ? `, ${a.farmerName}` : ''}
                  </span>
                </CheckRow>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="Label kosong">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`${id}-count`}>Jumlah kode baru</Label>
              <Input
                id={`${id}-count`}
                inputMode="numeric"
                value={count}
                onChange={(e) => {
                  setCount(e.target.value.replace(/\D/g, ''));
                }}
                {...fieldA11y(`${id}-count`, countError)}
              />
              {countError && (
                <p id={`${id}-count-error`} role="alert" className="font-semibold text-alarm">
                  {countError}
                </p>
              )}
            </div>
            <Button size="lg" disabled={busy} onClick={() => void createBlank()}>
              <QrIcon aria-hidden="true" />
              Buat kode
            </Button>
          </div>
          {conflicts.length > 0 && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-(--st-keguguran-bg) p-3 font-semibold text-(--st-keguguran-fg)"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              Jangan pakai label {conflicts.map((c) => c.code).join(', ')}: kodenya ternyata sudah
              dipakai di tempat lain. Buang label itu.
            </p>
          )}
          {free.length === 0 ? (
            <p className="text-muted-foreground">
              Belum ada label kosong. Buat kode baru, cetak, lalu pasang saat mendaftarkan sapi.
            </p>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Belum dipasang ({free.length})</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPickedBlank(
                      pickedBlank.size === free.length ? new Set() : new Set(free.map((l) => l.id)),
                    );
                  }}
                >
                  {pickedBlank.size === free.length ? 'Kosongkan pilihan' : 'Pilih semua'}
                </Button>
              </div>
              {free.map((l) => (
                <CheckRow
                  key={l.id}
                  checked={pickedBlank.has(l.id)}
                  onChange={(on) => {
                    setPickedBlank(toggle(pickedBlank, l.id, on));
                  }}
                >
                  <span className="font-semibold tracking-wide">{l.code}</span>
                  {l.unsynced && (
                    <span className="ml-2 text-sm text-muted-foreground">belum terkirim</span>
                  )}
                </CheckRow>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Panel title="Pratinjau" action={<span className="text-muted-foreground">{sheetText}</span>}>
        {pages[0] ? (
          <>
            <SheetPreview labels={pages[0]} layout={layout} />
            {pages.length > 1 && (
              <p className="text-sm text-muted-foreground">
                Lembar pertama dari {pages.length} lembar.
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Pilih ternak atau label untuk melihat pratinjau.</p>
        )}
      </Panel>

      {message && (
        <p role="status" className="font-semibold text-primary">
          {message}
        </p>
      )}
      {error !== null && <ErrorMessage error={error} />}

      <div className="sticky bottom-20 z-10 flex flex-col gap-2 lg:bottom-4">
        <Button
          size="lg"
          variant="accent"
          disabled={busy || items.length === 0}
          onClick={() => void print()}
        >
          <Printer aria-hidden="true" />
          {items.length === 0 ? 'Pilih label dulu' : `Cetak ${sheetText}`}
        </Button>
        {missingQr.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {missingQr.length} ternak belum punya QR: kodenya dibuat dan dipasang saat Anda menekan
            Cetak.
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Di dialog cetak, pilih ukuran kertas A4, skala 100% (bukan &quot;sesuaikan&quot;), dan tanpa
        margin.
      </p>

      {createPortal(
        <div className="print-root">
          {pages.map((page, i) => (
            <LabelSheet key={i} labels={page} layout={layout} />
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
