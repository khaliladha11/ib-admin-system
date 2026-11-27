// Laporan ke iSIKHNAS (langkah 6.3): pesan SMS siap kirim per event yang belum dilaporkan, tombol
// salin, dan tanda "sudah dilaporkan" (ikut sinkron). ID iSIKHNAS yang kosong bisa diisi di sini.
import { MISSING_TEXT, type DomainEventOf } from '@ib/shared';
import { Link } from '@tanstack/react-router';
import { Check, CheckCheck, ClipboardCopy, SendHorizontal, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { ListSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsikhnasQueue, useRepo, useSession, type IsikhnasItem } from '@/data';
import { isAdminRole } from '@/layout/nav-items';
import { copyText } from '@/lib/clipboard';
import { EVENT_TEXT } from '@/lib/describe-change';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE = 30;

/** Isian satu ID iSIKHNAS yang masih kosong. */
function IdField({
  label,
  onSave,
}: {
  label: string;
  onSave: (value: string) => Promise<unknown>;
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setError(null);
        onSave(value.trim()).catch(setError);
      }}
    >
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={value}
          inputMode="text"
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
          }}
        />
      </div>
      <Button type="submit" variant="outline">
        Simpan
      </Button>
      {error !== null && <ErrorMessage error={error} />}
    </form>
  );
}

function ItemCard({ item, admin }: { item: IsikhnasItem; admin: boolean }) {
  const repo = useRepo();
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { event, animal, farmer, messages, report } = item;
  const ready = messages.every((m) => m.text !== null);
  const missing = new Set(messages.flatMap((m) => m.missing));
  const calves =
    event.type === 'LH' ? (event as DomainEventOf<'LH'>).payload.calves : ([] as const);

  return (
    <li className="surface flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <span className="font-bold">
          {EVENT_TEXT[event.type] ?? event.type} ·{' '}
          {animal ? (
            <Link
              to="/ternak/$animalId"
              params={{ animalId: animal.id }}
              className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4"
            >
              {animal.name ?? 'Tanpa nama'}
            </Link>
          ) : (
            'Ternak'
          )}
        </span>
        <span className="text-sm text-muted-foreground">
          {formatDate(event.occurredAt)}
          {item.recordedByName ? ` · ${item.recordedByName}` : ''}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {messages.map((m, i) =>
          m.text ? (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-md bg-secondary px-3 py-2 font-mono text-base break-all">
                {m.text}
              </code>
              <Button
                variant="outline"
                aria-label={`Salin pesan ${m.text}`}
                onClick={() => {
                  void copyText(m.text ?? '').then((ok) => {
                    setCopied(ok ? i : null);
                  });
                }}
              >
                {copied === i ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
                {copied === i ? 'Tersalin' : 'Salin'}
              </Button>
            </li>
          ) : null,
        )}
      </ul>

      {!ready && (
        <div className="flex flex-col gap-2 rounded-lg border-(length:--bw) border-soil/40 p-3">
          <p className="flex items-start gap-2 font-semibold text-soil">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            Belum bisa dibuat: {[...missing].map((k) => MISSING_TEXT[k]).join(', ')} belum diisi.
          </p>
          {missing.has('animal') && animal && (
            <IdField
              label={`ID hewan iSIKHNAS ${animal.name ?? ''}`.trim()}
              onSave={(v) => repo.updateAnimal(animal.id, { isikhnasAnimalId: v })}
            />
          )}
          {missing.has('owner') &&
            farmer &&
            (admin ? (
              <IdField
                label={`ID pemilik iSIKHNAS ${farmer.name}`}
                onSave={(v) => repo.updateFarmer(farmer.id, { isikhnasOwnerId: v })}
              />
            ) : (
              <p>Minta admin kelompok mengisi ID pemilik iSIKHNAS untuk {farmer.name}.</p>
            ))}
          {missing.has('calf') &&
            calves.map((calf) =>
              calf.calfAnimalId && calf.condition === 'alive' ? (
                <IdField
                  key={calf.calfAnimalId}
                  label={`ID hewan iSIKHNAS anak (${calf.sex === 'M' ? 'jantan' : 'betina'})`}
                  onSave={(v) =>
                    repo.updateAnimal(calf.calfAnimalId ?? '', { isikhnasAnimalId: v })
                  }
                />
              ) : null,
            )}
        </div>
      )}

      {report ? (
        <p className="flex items-center gap-2 font-semibold text-primary">
          <CheckCheck aria-hidden="true" className="size-5" />
          Sudah dilaporkan {formatDateTime(report.createdAt)}
        </p>
      ) : (
        <Button
          variant={ready ? 'default' : 'outline'}
          className="self-start"
          disabled={!ready}
          onClick={() => {
            setError(null);
            repo.markIsikhnasReported(event.id).catch(setError);
          }}
        >
          <SendHorizontal aria-hidden="true" />
          Tandai sudah dilaporkan
        </Button>
      )}
      {error !== null && <ErrorMessage error={error} />}
    </li>
  );
}

export function IsikhnasPage() {
  const items = useIsikhnasQueue();
  const session = useSession();
  const [tab, setTab] = useState<'belum' | 'sudah'>('belum');
  const [mineOnly, setMineOnly] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [copiedAll, setCopiedAll] = useState(false);
  const mineId = useId();

  if (!items || !session) return <ListSkeleton label="Menyiapkan pesan iSIKHNAS…" />;
  const admin = isAdminRole(session.user.role);
  const scoped = items.filter((i) => admin || !mineOnly || i.event.recordedBy === session.user.id);
  const pending = scoped.filter((i) => !i.report);
  const done = scoped.filter((i) => i.report);
  const list = tab === 'belum' ? pending : done;
  const readyTexts = pending.flatMap((i) =>
    i.messages.every((m) => m.text) ? i.messages.map((m) => m.text ?? '') : [],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-muted-foreground">
        Pesan SMS siap kirim ke iSIKHNAS. Salin, kirim lewat SMS ke nomor iSIKHNAS wilayah Anda,
        lalu tekan <b>Tandai sudah dilaporkan</b>. Tanda ikut terkirim ke admin.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Status laporan" className="flex flex-wrap gap-2">
          {(
            [
              ['belum', `Belum dilaporkan (${String(pending.length)})`],
              ['sudah', `Sudah (${String(done.length)})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={tab === key}
              onClick={() => {
                setTab(key);
                setLimit(PAGE);
              }}
              className={cn(
                'min-h-11 rounded-full border-(length:--bw) px-4 font-semibold',
                tab === key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {!admin && (
          <label
            htmlFor={mineId}
            className="flex min-h-11 cursor-pointer items-center gap-2 px-2 font-semibold"
          >
            <input
              id={mineId}
              type="checkbox"
              className="size-5"
              checked={mineOnly}
              onChange={(e) => {
                setMineOnly(e.target.checked);
              }}
            />
            Hanya catatan saya
          </label>
        )}
        {tab === 'belum' && readyTexts.length > 0 && (
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => {
              void copyText(readyTexts.join('\n')).then(setCopiedAll);
            }}
          >
            {copiedAll ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
            {copiedAll ? 'Semua tersalin' : `Salin semua yang siap (${String(readyTexts.length)})`}
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          art="meadow"
          title={tab === 'belum' ? 'Semua sudah dilaporkan' : 'Belum ada yang ditandai'}
        >
          {tab === 'belum'
            ? 'Tidak ada catatan birahi, IB, PKB, keguguran, lahir, atau berat yang menunggu dilaporkan.'
            : 'Catatan yang sudah dikirim ke iSIKHNAS akan tampil di sini.'}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.slice(0, limit).map((item) => (
            <ItemCard key={item.event.id} item={item} admin={admin} />
          ))}
        </ul>
      )}
      {list.length > limit && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => {
            setLimit((n) => n + PAGE);
          }}
        >
          Tampilkan lebih banyak ({list.length - limit} lagi)
        </Button>
      )}
    </div>
  );
}
