// Pos IB (langkah 4.3): alamat untuk HP (+QR), sertifikat, cadangan harian, ekspor/impor data.
// Halaman ini ONLINE-ONLY: membaca langsung dari server pos.
import {
  Download,
  FileJson,
  FileSpreadsheet,
  HardDriveDownload,
  RotateCcw,
  Upload,
  WifiOff,
} from 'lucide-react';
import { useEffect, useId, useState, type ChangeEvent } from 'react';

import { ErrorMessage } from '@/components/error-message';
import { QrCode } from '@/components/qr-code';
import { ListSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import {
  appUrlOf,
  backupNow,
  certUrlOf,
  EXPORT_CSV_URL,
  EXPORT_JSON_URL,
  importData,
  loadSystemInfo,
  resetDemo,
  useDataLayer,
  useSession,
  type ImportCounts,
  type SystemInfo,
} from '@/data';
import { formatDateTime } from '@/lib/format';

const TABLE_TEXT: Record<string, string> = {
  locations: 'Wilayah',
  users: 'Pengguna',
  farmers: 'Peternak',
  animals: 'Ternak',
  animalTags: 'Label/tag',
  qrCodes: 'Kode QR',
  semenStock: 'Stok straw',
  serviceRequests: 'Permintaan',
  events: 'Catatan kejadian',
  assignments: 'Penugasan',
  auditLogs: 'Log',
  syncChanges: 'Riwayat kiriman',
  fieldVersions: 'Waktu ubah kolom',
  feedback: 'Masukan',
};

const size = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${String(Math.round(bytes / 1024))} KB`;

export function PosPage() {
  const layer = useDataLayer();
  const session = useSession();
  const id = useId();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [counts, setCounts] = useState<ImportCounts | null>(null);
  const [reload, setReload] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSystemInfo(layer)
      .then((value) => {
        if (!cancelled) setInfo(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [layer, reload]);

  if (loadError !== null && !info) {
    return (
      <Panel title="Pos IB">
        <p className="flex items-start gap-2 text-soil">
          <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          Halaman ini butuh koneksi ke server pos. Sambungkan HP/laptop ke Wi-Fi pos lalu coba lagi.
        </p>
        <ErrorMessage error={loadError} />
      </Panel>
    );
  }
  if (!info || !session) return <ListSkeleton label="Memuat info pos…" />;

  const agency = session.user.role === 'agency_admin';
  const appUrl = appUrlOf(info);
  const certUrl = certUrlOf(info);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await work();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await run(async () => {
      const data: unknown = JSON.parse(await file.text());
      const result = await importData(layer, data);
      setCounts(result.counts);
      setMessage(`Impor selesai. Cadangan sebelum impor: ${result.backup}.`);
      setReload((n) => n + 1);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Buka dari HP" titleId="buka-dari-hp">
        {appUrl ? (
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <QrCode
              value={appUrl}
              label={`Kode QR alamat aplikasi ${appUrl}`}
              className="size-44 shrink-0 rounded-lg border-(length:--bw) border-border p-2"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-muted-foreground">Pindai QR ini dengan kamera HP, atau ketik:</p>
              <p className="text-xl font-bold break-all sm:text-2xl">{appUrl}</p>
              {!info.publicUrl && (
                <p className="text-sm text-soil">
                  Alamat ditebak dari jaringan. Bila tidak terbuka di HP, jalankan
                  <code className="mx-1">./scripts/pos.sh alamat</code> di komputer pos.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-soil">Alamat jaringan komputer ini tidak terdeteksi.</p>
        )}
        {certUrl && (
          <div className="flex flex-col gap-1 rounded-lg bg-secondary p-3">
            <p className="font-semibold">HP baru: pasang sertifikat dulu (sekali saja)</p>
            <p>
              Buka <span className="font-bold break-all">{certUrl}</span> di HP, lalu ikuti panduan
              "Memasang sertifikat di HP Android" (docs/INSTALL.md).
            </p>
          </div>
        )}
      </Panel>

      <Panel
        title="Cadangan harian"
        titleId="cadangan"
        action={
          agency ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const b = await backupNow(layer);
                  setMessage(`Cadangan dibuat: ${b.name}`);
                  setReload((n) => n + 1);
                })
              }
            >
              <HardDriveDownload aria-hidden="true" />
              Cadangkan sekarang
            </Button>
          ) : undefined
        }
      >
        <p className="text-muted-foreground">
          Database dicadangkan otomatis setiap hari ke folder <code>backups/</code> di komputer pos;
          {` ${String(info.backupKeep)}`} cadangan terakhir disimpan.
        </p>
        {info.backups.length === 0 ? (
          <p>Belum ada cadangan.</p>
        ) : (
          <ul className="flex flex-col">
            {info.backups.map((b) => (
              <li
                key={b.name}
                className="flex flex-wrap items-baseline justify-between gap-x-3 border-t-(length:--bw) py-2 first:border-t-0"
              >
                <span className="font-semibold">{formatDateTime(b.createdAt)}</span>
                <span className="text-sm text-muted-foreground">
                  {b.name} · {size(b.size)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Memulihkan (di komputer pos): <code>./scripts/pos.sh pulihkan &lt;nama-file&gt;</code>
        </p>
      </Panel>

      <Panel title="Ekspor dan impor data" titleId="ekspor">
        {agency ? (
          <>
            <p className="text-muted-foreground">
              Ekspor JSON berisi seluruh data (termasuk akun) dan bisa diimpor ke server lain.
              Simpan di tempat aman. CSV untuk dibuka di Excel/LibreOffice.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={EXPORT_JSON_URL} download>
                  <FileJson aria-hidden="true" />
                  Unduh JSON lengkap
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={EXPORT_CSV_URL} download>
                  <FileSpreadsheet aria-hidden="true" />
                  Unduh CSV (ZIP)
                </a>
              </Button>
            </div>
            <div className="flex flex-col gap-1.5 border-t-(length:--bw) pt-3">
              <Label htmlFor={`${id}-import`}>Impor file JSON</Label>
              <p className="text-sm text-muted-foreground">
                Data digabung: yang belum ada ditambahkan, yang sudah ada tidak diubah. Cadangan
                dibuat otomatis sebelum impor.
              </p>
              <label
                htmlFor={`${id}-import`}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full border-(length:--bw) border-input bg-card px-5 font-semibold has-focus-visible:outline-3 has-focus-visible:outline-ring"
              >
                <Upload aria-hidden="true" className="size-5" />
                Pilih file…
                <input
                  id={`${id}-import`}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => void onImport(e)}
                />
              </label>
            </div>
          </>
        ) : (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Download aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            Ekspor dan impor seluruh data hanya untuk admin dinas.
          </p>
        )}
        {counts && (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Hasil impor per tabel</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 font-semibold">
                  Data
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Ditambahkan
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Sudah ada
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(counts).map(([table, c]) => (
                <tr key={table} className="border-t-(length:--bw)">
                  <td className="py-1">{TABLE_TEXT[table] ?? table}</td>
                  <td className="py-1 text-right tabular-nums">{c.added}</td>
                  <td className="py-1 text-right tabular-nums">{c.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {info.demoMode && (
        <Panel title="Data latihan" titleId="data-latihan">
          <p className="text-muted-foreground">
            Server ini server latihan (DEMO_MODE=1). Setelah sesi pelatihan, kembalikan data contoh
            seperti semula. Semua catatan peserta hilang dan semua HP perlu masuk lagi.
          </p>
          {!agency ? (
            <p className="text-muted-foreground">Reset data latihan hanya untuk admin dinas.</p>
          ) : confirmReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Hapus semua data dan isi ulang data contoh?</span>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    // Sesi ikut terhapus: setelah ini aplikasi kembali ke layar Masuk.
                    await resetDemo(layer);
                  })
                }
              >
                Ya, reset data latihan
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmReset(false);
                }}
              >
                Batal
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => {
                setConfirmReset(true);
              }}
            >
              <RotateCcw aria-hidden="true" />
              Reset data demo
            </Button>
          )}
        </Panel>
      )}

      {message && (
        <p role="status" className="font-semibold text-primary">
          {message}
        </p>
      )}
      {error !== null && <ErrorMessage error={error} />}
    </div>
  );
}
