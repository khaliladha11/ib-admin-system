// Kartu hasil scan: sapi ditemukan, label sudah dicabut, kode belum terpakai, atau bukan kode ternak.
import { Link } from '@tanstack/react-router';
import { CircleHelp, CirclePlus, QrCode, Tag, TriangleAlert } from 'lucide-react';

import { Cow } from '@/components/icons/cow';
import { Button } from '@/components/ui/button';
import { useScanResult, type ScanResult } from '@/data';
import { formatDate } from '@/lib/format';
import { REMOVAL_REASON_TEXT, TAG_TYPE_TEXT } from '@/lib/tag-text';
import { cn } from '@/lib/utils';

export function ScanResultView({
  text,
  compact = false,
}: {
  text: string;
  /** Baris ringkas untuk daftar scan beruntun. */
  compact?: boolean;
}) {
  const result = useScanResult(text);
  if (!result) return <p className="text-muted-foreground">Mencari {text}…</p>;
  return <ScanResultBody result={result} compact={compact} />;
}

function CodeLine({
  result,
  compact = false,
}: {
  result: Exclude<ScanResult, { kind: 'invalid' }>;
  compact?: boolean;
}) {
  const Icon = result.tagType === 'qr' ? QrCode : Tag;
  return (
    <span className="flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className={compact ? 'sr-only' : undefined}>{TAG_TYPE_TEXT[result.tagType]}</span>{' '}
      <span className="font-semibold tracking-wide">{result.code}</span>
    </span>
  );
}

export function ScanResultBody({ result, compact }: { result: ScanResult; compact: boolean }) {
  const shell = cn('flex gap-3', compact ? 'items-center' : 'surface flex-col p-4');

  if (result.kind === 'animal') {
    return (
      <div className={shell}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Cow aria-hidden="true" className="size-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-bold">{result.animal.name ?? 'Tanpa nama'}</p>
            <CodeLine result={result} compact={compact} />
          </div>
        </div>
        <Button asChild size={compact ? 'sm' : 'lg'} variant={compact ? 'outline' : 'default'}>
          <Link
            to="/ternak/$animalId"
            params={{ animalId: result.animal.id }}
            search={{ scan: '1' }}
          >
            Buka profil
          </Link>
        </Button>
      </div>
    );
  }

  if (result.kind === 'unused') {
    if (result.clash) {
      return (
        <div className={shell}>
          <p className="flex flex-1 items-start gap-2 font-semibold text-alarm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            Label {result.code} bentrok dengan label lain. Jangan dipakai.
          </p>
        </div>
      );
    }
    return (
      <div className={shell}>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Belum terdaftar</p>
          <CodeLine result={result} compact={compact} />
          {!compact && (
            <p className="mt-1 text-muted-foreground">
              Kode ini belum dipakai sapi mana pun di HP ini.
            </p>
          )}
        </div>
        <Button asChild size={compact ? 'sm' : 'lg'} variant={compact ? 'outline' : 'accent'}>
          <Link
            to="/ternak/baru"
            search={{ kode: result.code, tag: result.tagType, kembali: 'scan' }}
          >
            <CirclePlus aria-hidden="true" />
            {compact ? 'Daftarkan' : 'Daftarkan sapi baru dengan kode ini'}
          </Link>
        </Button>
      </div>
    );
  }

  if (result.kind === 'removed') {
    return (
      <div className={shell}>
        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-2 font-bold text-soil">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            Label ini sudah dicabut
          </p>
          <CodeLine result={result} compact={compact} />
          {!compact && (
            <p className="mt-1 text-muted-foreground">
              Dicabut {formatDate(result.removedAt)}
              {result.reason ? ` (${REMOVAL_REASON_TEXT[result.reason]})` : ''}
              {result.animal ? ` dari ${result.animal.name ?? 'sapi tanpa nama'}` : ''}. Kode lama
              tidak bisa dipakai lagi; pasang label baru.
            </p>
          )}
        </div>
        {result.animal && (
          <Button asChild size={compact ? 'sm' : 'lg'} variant="outline">
            <Link to="/ternak/$animalId" params={{ animalId: result.animal.id }}>
              Lihat sapi
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={shell}>
      <p className="flex flex-1 items-start gap-2 font-semibold">
        <CircleHelp aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span>
          Bukan label ternak
          {result.text && (
            <span className="block text-sm font-normal break-all text-muted-foreground">
              {result.text.slice(0, 80)}
            </span>
          )}
        </span>
      </p>
    </div>
  );
}
