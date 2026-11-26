// Riwayat tag di profil ternak (langkah 3.1): pasang, ganti (hilang/rusak), dan cabut.
// Tag lama tidak dihapus: tetap tampil sebagai "Dicabut" dengan tanggal dan alasannya.
import type { TagRemovalReason, TagType } from '@ib/shared';
import { Link } from '@tanstack/react-router';
import { CloudUpload, Printer, QrCode, Tag, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';

import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAnimalTags, useRepo, type TagView } from '@/data';
import { formatDate } from '@/lib/format';
import { CHOOSABLE_REASONS, REMOVAL_REASON_TEXT, TAG_TYPE_TEXT } from '@/lib/tag-text';
import { cn } from '@/lib/utils';

type Action =
  | { kind: 'attach'; type: TagType }
  | { kind: 'replace'; tag: TagView }
  | { kind: 'remove'; tag: TagView };

export function TagHistory({ animalId, readOnly }: { animalId: string; readOnly: boolean }) {
  const tags = useAnimalTags(animalId);
  const [action, setAction] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!tags) return null;

  const activeQr = tags.find((t) => t.type === 'qr' && t.removedAt === null);
  const activeEartag = tags.find((t) => t.type === 'eartag' && t.removedAt === null);

  return (
    <section aria-labelledby="tag-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="tag-title" className="flex items-center gap-2 text-xl font-bold">
          <QrCode aria-hidden="true" className="size-6" />
          Label dan tag
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/label" search={{ ternak: animalId }}>
            <Printer aria-hidden="true" />
            Cetak label
          </Link>
        </Button>
      </div>

      {tags.length === 0 ? (
        <p className="text-muted-foreground">
          Belum ada label QR. Pasang label agar sapi ini bisa dipindai dari menu Scan.
        </p>
      ) : (
        <ul className="surface flex flex-col px-4">
          {tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              readOnly={readOnly}
              onReplace={() => {
                setMessage(null);
                setAction({ kind: 'replace', tag });
              }}
              onRemove={() => {
                setMessage(null);
                setAction({ kind: 'remove', tag });
              }}
            />
          ))}
        </ul>
      )}

      {!readOnly && !action && (
        <div className="flex flex-wrap gap-2">
          {!activeQr && (
            <Button
              variant="outline"
              onClick={() => {
                setMessage(null);
                setAction({ kind: 'attach', type: 'qr' });
              }}
            >
              <QrCode aria-hidden="true" />
              Pasang label QR
            </Button>
          )}
          {!activeEartag && (
            <Button
              variant="ghost"
              onClick={() => {
                setMessage(null);
                setAction({ kind: 'attach', type: 'eartag' });
              }}
            >
              <Tag aria-hidden="true" />
              Tambah eartag
            </Button>
          )}
        </div>
      )}

      {action && (
        <TagForm
          key={`${action.kind}-${action.kind === 'attach' ? action.type : action.tag.id}`}
          animalId={animalId}
          action={action}
          onDone={(text) => {
            setAction(null);
            setMessage(text);
          }}
          onCancel={() => {
            setAction(null);
          }}
        />
      )}
      {message && (
        <p role="status" className="font-semibold text-primary">
          {message}
        </p>
      )}
    </section>
  );
}

function TagRow({
  tag,
  readOnly,
  onReplace,
  onRemove,
}: {
  tag: TagView;
  readOnly: boolean;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const removed = tag.removedAt !== null;
  const Icon = tag.type === 'qr' ? QrCode : Tag;
  return (
    <li className="flex flex-col gap-1.5 border-t-(length:--bw) py-3 first:border-t-0">
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={cn('mt-0.5 size-5 shrink-0', removed && 'text-muted-foreground')}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={cn('text-lg font-bold tracking-wide', removed && 'text-muted-foreground')}
            >
              {tag.code}
            </span>
            <span className="text-sm text-muted-foreground">{TAG_TYPE_TEXT[tag.type]}</span>
            {!removed && (
              <span className="rounded-full bg-(--st-bunting-bg) px-2 text-sm font-semibold text-(--st-bunting-fg)">
                Terpasang
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Dipasang {formatDate(tag.attachedAt)}
            {removed &&
              `. Dicabut ${formatDate(tag.removedAt ?? 0)}: ${REMOVAL_REASON_TEXT[tag.removalReason ?? 'other']}`}
          </p>
          {tag.unsynced && (
            <p className="flex items-center gap-1 text-sm font-semibold text-info">
              <CloudUpload aria-hidden="true" className="size-4" />
              Belum terkirim
            </p>
          )}
          {tag.rejectedMessage && (
            <p className="flex items-start gap-1 text-sm font-semibold text-alarm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Tidak diterima: {tag.rejectedMessage}
            </p>
          )}
        </div>
      </div>
      {!removed && !readOnly && (
        <div className="flex flex-wrap gap-2 pl-8">
          <Button variant="outline" size="sm" onClick={onReplace}>
            Ganti
          </Button>
          <Button variant="ghost" size="sm" className="text-alarm" onClick={onRemove}>
            Cabut
          </Button>
        </div>
      )}
    </li>
  );
}

function ReasonChoice({
  value,
  onChange,
  label,
}: {
  value: TagRemovalReason | null;
  onChange: (r: TagRemovalReason) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={id} className="font-semibold">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {CHOOSABLE_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={value === r}
            onClick={() => {
              onChange(r);
            }}
            className={cn(
              'min-h-11 rounded-full border-(length:--bw) px-4 font-semibold',
              value === r
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card',
            )}
          >
            {REMOVAL_REASON_TEXT[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagForm({
  animalId,
  action,
  onDone,
  onCancel,
}: {
  animalId: string;
  action: Action;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const repo = useRepo();
  const id = useId();
  const type: TagType = action.kind === 'attach' ? action.type : action.tag.type;
  const [code, setCode] = useState('');
  const [reason, setReason] = useState<TagRemovalReason | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const needsReason = action.kind !== 'attach';
  const isQr = type === 'qr';

  async function run(work: () => Promise<unknown>, done: string) {
    if (needsReason && !reason) {
      setFieldError('Pilih alasannya dulu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await work();
      onDone(done);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const replaceReason = needsReason ? (reason ?? undefined) : undefined;
  const title =
    action.kind === 'attach'
      ? isQr
        ? 'Pasang label QR'
        : 'Tambah eartag'
      : action.kind === 'replace'
        ? `Ganti ${action.tag.code}`
        : `Cabut ${action.tag.code}`;

  return (
    <div className="surface flex flex-col gap-3 p-4">
      <h3 className="text-lg font-bold">{title}</h3>
      {needsReason && (
        <ReasonChoice
          label={action.kind === 'remove' ? 'Kenapa dicabut?' : 'Kenapa diganti?'}
          value={reason}
          onChange={(r) => {
            setReason(r);
            setFieldError(null);
          }}
        />
      )}
      {fieldError && (
        <p role="alert" className="font-semibold text-alarm">
          {fieldError}
        </p>
      )}

      {action.kind === 'remove' ? (
        <>
          <p className="text-muted-foreground">
            Tag yang dicabut tetap tercatat di riwayat dan kodenya tidak bisa dipakai lagi.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void run(
                  () => repo.removeTag(action.tag.id, reason ?? 'other'),
                  'Tag dicabut. Tersimpan di HP ini.',
                )
              }
            >
              Cabut tag
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-code`}>{isQr ? 'Kode di label baru' : 'Nomor eartag'}</Label>
            <Input
              id={`${id}-code`}
              value={code}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder={isQr ? 'IB-XXXXX' : 'Contoh: 3201-0099'}
              onChange={(e) => {
                setCode(e.target.value);
              }}
            />
            {isQr && (
              <p className="text-sm text-muted-foreground">
                Ketik kode yang tertulis di bawah QR. Belum punya label? Buat kode baru lalu cetak.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || code.trim() === ''}
              onClick={() =>
                void run(
                  () => repo.attachTag(animalId, { type, code, replaceReason }),
                  action.kind === 'replace'
                    ? 'Tag diganti. Tag lama tercatat sudah dicabut.'
                    : 'Tag dipasang. Tersimpan di HP ini.',
                )
              }
            >
              {action.kind === 'replace' ? 'Simpan tag baru' : 'Pasang'}
            </Button>
            {isQr && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => repo.attachNewQrCode(animalId, replaceReason),
                    'Kode QR baru dibuat dan dipasang. Cetak labelnya lewat tombol Cetak label.',
                  )
                }
              >
                <QrCode aria-hidden="true" />
                Buat kode baru
              </Button>
            )}
            <Button variant="ghost" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </>
      )}
      {error !== null && <ErrorMessage error={error} />}
    </div>
  );
}
