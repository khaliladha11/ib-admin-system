// Catatan pemakaian anonim (langkah 5.1). Hanya di HP ini: tidak pernah dikirim ke server atau
// pihak lain. Admin uji coba mengumpulkan filenya dari HP peserta (unduh CSV/JSON).
import { FileJson, FileSpreadsheet, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ListSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { clearUsage, MAX_USAGE_ROWS, useDataLayer, useUsageRows } from '@/data';
import { downloadText } from '@/lib/download';
import { EVENT_TEXT } from '@/lib/describe-change';
import { formatDateTime } from '@/lib/format';
import { summarizeUsage, usageCsv, usageFileName } from '@/lib/usage-summary';
import { formatDuration, USAGE_NAME_TEXT } from '@/lib/usage-text';

export function UsagePage() {
  const layer = useDataLayer();
  const rows = useUsageRows();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!rows) return <ListSkeleton rows={3} label="Memuat catatan pemakaian…" />;
  const summary = summarizeUsage(rows);
  const events = Object.entries(summary.eventsByType).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Hanya di HP ini">
        <p className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            Catatan ini tidak dikirim ke mana pun dan tidak berisi nama, nomor HP, atau data ternak.
            Isinya hanya jenis kegiatan dan lama mengisi form, untuk menilai uji coba.
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          Disimpan paling banyak {MAX_USAGE_ROWS.toLocaleString('id-ID')} catatan terakhir.
        </p>
      </Panel>

      <Panel title="Ringkasan">
        {summary.total === 0 ? (
          <p>Belum ada catatan pemakaian.</p>
        ) : (
          <>
            <p>
              {summary.total} catatan dalam {summary.activeDays} hari
              {summary.firstAt !== null && summary.lastAt !== null
                ? ` (${formatDateTime(summary.firstAt)} – ${formatDateTime(summary.lastAt)})`
                : ''}
              .
            </p>
            {events.length > 0 && (
              <div>
                <h3 className="font-semibold">Event tercatat</h3>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {events.map(([type, n]) => (
                    <li key={type}>
                      {EVENT_TEXT[type] ?? type}: <span className="font-bold">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.forms.length > 0 && (
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Lama mengisi form</caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-1 font-semibold">
                      Form
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      Disimpan
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      Batal
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      Lama (median)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.forms.map((f) => (
                    <tr key={f.name} className="border-t-(length:--bw)">
                      <td className="py-1">{USAGE_NAME_TEXT[f.name] ?? f.name}</td>
                      <td className="py-1 text-right tabular-nums">{f.done}</td>
                      <td className="py-1 text-right tabular-nums">{f.cancelled}</td>
                      <td className="py-1 text-right tabular-nums">{formatDuration(f.medianMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Panel>

      <Panel title="Unduh untuk admin uji coba">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => {
              downloadText(usageFileName(layer.now(), 'csv'), usageCsv(rows), 'text/csv');
            }}
          >
            <FileSpreadsheet aria-hidden="true" />
            Unduh CSV
          </Button>
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => {
              const data = { format: 'ib-ternak-usage', version: 1, summary, rows };
              downloadText(
                usageFileName(layer.now(), 'json'),
                JSON.stringify(data, null, 2),
                'application/json',
              );
            }}
          >
            <FileJson aria-hidden="true" />
            Unduh JSON
          </Button>
        </div>
        {confirmClear ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>Hapus semua catatan pemakaian di HP ini?</span>
            <Button
              variant="destructive"
              onClick={() => {
                void clearUsage(layer.db).then(() => {
                  setConfirmClear(false);
                });
              }}
            >
              Ya, hapus
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmClear(false);
              }}
            >
              Batal
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="self-start"
            disabled={rows.length === 0}
            onClick={() => {
              setConfirmClear(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            Hapus catatan
          </Button>
        )}
      </Panel>
    </div>
  );
}
