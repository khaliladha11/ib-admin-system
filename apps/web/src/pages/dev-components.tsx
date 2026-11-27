// /dev/komponen: semua komponen dasar dalam semua keadaan, untuk direview.
// Data di halaman ini fiktif dan tidak disimpan.
import { Cow } from '@/components/icons/cow';
import type { SemenStock } from '@ib/shared';
import { Inbox, Plus, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { AnimalCard } from '@/components/animal-card';
import { CycleTrack } from '@/components/cycle-track';
import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { EventForm } from '@/components/event-form';
import { STATUS_META } from '@/components/status-meta';
import { StatusBadge } from '@/components/status-badge';
import type { SyncState } from '@/components/describe-sync';
import { SyncIndicatorView } from '@/components/sync-indicator';
import { Button } from '@/components/ui/button';
import {
  ApiRequestError,
  LocalValidationError,
  NetworkError,
  NotSignedInError,
  WarningsNeedConfirmation,
  type EventInput,
} from '@/data';
import { useContrastMode } from '@/design/contrast-mode';

import { SAMPLE_ANIMALS, SAMPLE_TODAY } from './dev-samples';
import { ContrastToggle } from './placeholders';

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {note && <p className="max-w-prose text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const SWATCHES = [
  ['Tinta', 'bg-ink', 'Teks utama'],
  ['Daun', 'bg-leaf', 'Tombol utama, tab aktif'],
  ['Jerami', 'bg-straw', 'Tombol Scan, sorotan'],
  ['Tanah', 'bg-soil', 'Peringatan ringan, offline'],
  ['Langit', 'bg-sky', 'Info, sedang mengirim'],
  ['Bahaya', 'bg-alarm', 'Error, terlambat'],
  ['Ladang', 'bg-field', 'Latar halaman'],
  ['Kertas', 'bg-paper', 'Latar kartu'],
] as const;

const SYNC_STATES: [string, SyncState][] = [
  ['Semua terkirim', { online: true, pending: 0, rejected: 0, needsLogin: false }],
  ['Sedang mengirim', { online: true, pending: 3, rejected: 0, needsLogin: false }],
  ['Offline', { online: false, pending: 0, rejected: 0, needsLogin: false }],
  ['Offline, ada data', { online: false, pending: 5, rejected: 0, needsLogin: false }],
  ['Perlu dicek', { online: true, pending: 0, rejected: 0, reviews: 1, needsLogin: false }],
  ['Ada yang ditolak', { online: true, pending: 0, rejected: 2, needsLogin: false }],
  ['Sesi habis', { online: true, pending: 4, rejected: 0, needsLogin: true }],
];

const SAMPLE_ERRORS: [string, unknown][] = [
  [
    'Isian tidak valid',
    new LocalValidationError('x', ['Kode straw wajib diisi.', 'Batch wajib diisi.']),
  ],
  [
    'Butuh konfirmasi',
    new WarningsNeedConfirmation([
      'Sapi tercatat bunting 4 bulan. Birahi saat bunting jarang terjadi.',
    ]),
  ],
  ['Tidak ada koneksi', new NetworkError()],
  ['Perlu masuk lagi', new NotSignedInError()],
  [
    'Ditolak server',
    new ApiRequestError(422, 'INVALID_EVENT', 'PKB terlalu cepat: baru 10 hari setelah IB.'),
  ],
  ['Tanpa akses', new ApiRequestError(403, 'FORBIDDEN', 'Lokasi di luar wilayah Anda.')],
  ['Error tak terduga', new Error('boom')],
];

const SAMPLE_STOCKS: SemenStock[] = [
  {
    id: '0193f000-0000-7000-8000-0000000000aa',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    deviceId: 'contoh',
    holderId: 'contoh',
    strawCode: 'SIM-2025-100',
    bullId: 'BULL-07',
    bullName: 'Gagah',
    breed: 'Simental',
    batch: 'B12',
    quantityReceived: 20,
    receivedAt: '2025-10-01',
  },
];

/** Form contoh: BH meminta konfirmasi (seolah sapi bunting), jenis lain langsung tersimpan. */
async function demoSubmit(input: EventInput): Promise<void> {
  await new Promise((r) => setTimeout(r, 300));
  if (input.type === 'BH' && !input.confirmWarnings) {
    throw new WarningsNeedConfirmation([
      'Sapi tercatat bunting 4 bulan. Birahi saat bunting jarang terjadi; periksa lagi sapinya.',
    ]);
  }
}

export function DevComponentsPage() {
  const [mode, setMode] = useContrastMode();
  const [lastInput, setLastInput] = useState<EventInput | null>(null);
  return (
    <div className="flex flex-col gap-10">
      <ContrastToggle mode={mode} onChange={setMode} />

      <Section
        title="Warna"
        note="Semua pasangan teks dan latar sudah dicek: minimal 4,5:1 (WCAG AA)."
      >
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SWATCHES.map(([name, cls, use]) => (
            <li key={name} className="surface flex items-center gap-3 p-2">
              <span
                className={`size-10 shrink-0 rounded-md border-(length:--bw) border-line-strong ${cls}`}
              />
              <span className="min-w-0">
                <span className="block font-bold">{name}</span>
                <span className="block text-sm text-muted-foreground">{use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Huruf"
        note="Atkinson Hyperlegible Next: huruf mirip (I, l, 1, O, 0) mudah dibedakan."
      >
        <div className="surface flex flex-col gap-2 p-4">
          <p className="text-2xl font-bold">Judul halaman 31px</p>
          <p className="text-xl font-bold">Judul bagian 25px</p>
          <p className="text-lg font-bold">Nama ternak 20px</p>
          <p>Teks dasar 16px untuk isi dan isian form.</p>
          <p className="text-sm text-muted-foreground">Keterangan 14px, paling kecil.</p>
          <p className="text-lg font-semibold tracking-wide">IB-7K3QX, SIM-2025-100, BULL-07</p>
        </div>
      </Section>

      <Section title="Tombol" note="Semua tombol minimal 44px tingginya.">
        <div className="flex flex-wrap gap-2">
          <Button>
            <Plus aria-hidden="true" />
            Catat IB
          </Button>
          <Button variant="accent">Scan ternak</Button>
          <Button variant="outline">Batal</Button>
          <Button variant="secondary">Lihat riwayat</Button>
          <Button variant="destructive">Hapus catatan</Button>
          <Button variant="ghost">Lewati</Button>
          <Button size="icon" variant="outline" aria-label="Sinkron sekarang">
            <RefreshCw aria-hidden="true" />
          </Button>
          <Button disabled>Menyimpan…</Button>
        </div>
      </Section>

      <Section
        title="Status reproduksi"
        note="Setiap status punya ikon dan teks, jadi tetap terbaca tanpa membedakan warna."
      >
        <div className="flex flex-wrap gap-2">
          {SAMPLE_ANIMALS.map(({ animal }) => (
            <StatusBadge key={animal.id} status={animal.status} />
          ))}
        </div>
        <div className="surface grid gap-4 p-4 sm:grid-cols-2">
          {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((kind) => (
            <div key={kind} className="flex flex-col gap-2">
              <StatusBadge status={{ kind }} className="self-start" />
              <CycleTrack kind={kind} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Kartu ternak"
        note="Sentuh kartu untuk membuka detail ternak (layar dibuat di 2.2)."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {SAMPLE_ANIMALS.map(({ animal, next }) => (
            <AnimalCard key={animal.id} animal={animal} nextLabel={next} onOpen={() => undefined} />
          ))}
        </div>
      </Section>

      <Section
        title="Form catat event"
        note="Contoh: Birahi memunculkan peringatan seolah sapinya bunting; jenis lain langsung tersimpan."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
          <div className="surface p-4">
            <EventForm
              defaults={{ stocks: SAMPLE_STOCKS.map((s) => ({ ...s, remaining: 12 })) }}
              now={() => SAMPLE_TODAY}
              onSubmit={async (input) => {
                await demoSubmit(input);
                setLastInput(input);
              }}
            />
          </div>
          {lastInput && (
            <pre className="surface overflow-x-auto p-4 text-sm">
              {JSON.stringify(lastInput, null, 2)}
            </pre>
          )}
        </div>
      </Section>

      <Section title="Status sinkron" note="Tampil di bilah atas. Sentuh untuk mengirim sekarang.">
        <ul className="surface flex flex-col gap-2 p-4">
          {SYNC_STATES.map(([label, state]) => (
            <li key={label} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">{label}</span>
              <SyncIndicatorView {...state} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tampilan kosong">
        <div className="grid gap-3 md:grid-cols-2">
          <EmptyState
            icon={Cow}
            title="Belum ada ternak"
            action={<Button>Daftarkan ternak</Button>}
          >
            Scan label QR di telinga sapi atau daftarkan ternak baru.
          </EmptyState>
          <EmptyState icon={Inbox} title="Semua tugas selesai">
            Tidak ada permintaan IB atau PKB yang menunggu Anda.
          </EmptyState>
        </div>
      </Section>

      <Section title="Pesan error" note="Menjelaskan apa yang terjadi dan apa yang bisa dilakukan.">
        <div className="grid gap-3 md:grid-cols-2">
          {SAMPLE_ERRORS.map(([label, error]) => (
            <ErrorMessage
              key={label}
              error={error}
              onRetry={error instanceof NetworkError ? () => undefined : undefined}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
