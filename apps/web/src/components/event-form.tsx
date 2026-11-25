// Form catat event (BH, IB, PKB, BB). Validasi isian wajib di sini dengan pesan sederhana;
// aturan urutan event (validateNextEvent) dijalankan oleh repo saat `onSubmit`.
import { ESTRUS_SIGNS, type SemenStock } from '@ib/shared';
import { CircleCheck } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WarningsNeedConfirmation, type EventInput } from '@/data';
import { cn } from '@/lib/utils';

import { ErrorMessage } from './error-message';
import { EVENT_FORM_TYPES, SIGN_LABEL, TYPE_LABEL, type EventFormType } from './event-form-model';

export interface EventFormProps {
  /** Jenis yang boleh dicatat (peternak: tanpa IB dan PKB). */
  types?: readonly EventFormType[];
  defaultType?: EventFormType;
  /** Stok straw milik petugas, untuk mengisi kode straw otomatis. */
  stocks?: SemenStock[];
  /** Biasanya `repo.recordEvent` untuk ternak ini. */
  onSubmit: (input: EventInput) => Promise<unknown>;
  now?: () => number;
}

type Fields = Record<string, string>;

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Hari ini: pakai jam sekarang. Hari lain: pukul 12.00 waktu HP. */
function occurredAtFor(date: string, now: number): number {
  if (date === localDate(now)) return now;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).getTime();
}

function buildInput(
  type: EventFormType,
  f: Fields,
  signs: string[],
  now: number,
): { input?: EventInput; errors: Fields } {
  const errors: Fields = {};
  const notes = f.notes?.trim() ? f.notes.trim() : undefined;
  if (!f.date) errors.date = 'Isi tanggal kejadian.';
  else if (f.date > localDate(now)) errors.date = 'Tanggal tidak boleh setelah hari ini.';
  const occurredAt = f.date ? occurredAtFor(f.date, now) : now;

  switch (type) {
    case 'BH':
      return {
        errors,
        input: {
          type,
          occurredAt,
          payload: { signs: signs as (typeof ESTRUS_SIGNS)[number][], notes },
        },
      };
    case 'IB': {
      for (const [key, label] of [
        ['strawCode', 'kode straw'],
        ['bullId', 'ID pejantan'],
        ['batch', 'nomor batch'],
      ] as const) {
        if (!f[key]?.trim()) errors[key] = `Isi ${label}.`;
      }
      return {
        errors,
        input: {
          type,
          occurredAt,
          semenStockId: f.semenStockId === '' ? null : (f.semenStockId ?? null),
          payload: {
            strawCode: f.strawCode?.trim() ?? '',
            bullId: f.bullId?.trim() ?? '',
            batch: f.batch?.trim() ?? '',
            notes,
          },
        },
      };
    }
    case 'PKB': {
      const pregnant = f.result === 'pregnant';
      if (!f.result) errors.result = 'Pilih hasil pemeriksaan.';
      if (pregnant && !f.fetalAgeMonths) errors.fetalAgeMonths = 'Pilih umur janin.';
      return {
        errors,
        input: {
          type,
          occurredAt,
          payload: {
            result: pregnant ? 'pregnant' : 'not_pregnant',
            fetalAgeMonths: pregnant && f.fetalAgeMonths ? Number(f.fetalAgeMonths) : undefined,
            method: f.method === 'usg' ? 'usg' : f.method === 'palpation' ? 'palpation' : undefined,
            notes,
          },
        },
      };
    }
    case 'BB': {
      const kg = Number((f.weightKg ?? '').replace(',', '.'));
      if (!f.weightKg?.trim()) errors.weightKg = 'Isi berat badan.';
      else if (!Number.isFinite(kg) || kg <= 0 || kg >= 2000) {
        errors.weightKg = 'Berat harus angka antara 1 dan 1999 kg.';
      }
      return {
        errors,
        input: {
          type,
          occurredAt,
          payload: { weightKg: kg, method: f.method === 'tape' ? 'tape' : 'scale', notes },
        },
      };
    }
  }
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="font-semibold text-alarm">
          {error}
        </p>
      )}
    </div>
  );
}

export function EventForm({
  types = EVENT_FORM_TYPES,
  defaultType,
  stocks = [],
  onSubmit,
  now = () => Date.now(),
}: EventFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [type, setType] = useState<EventFormType>(defaultType ?? types[0] ?? 'BH');
  const [fields, setFields] = useState<Fields>(() => ({ date: localDate(now()) }));
  const [signs, setSigns] = useState<string[]>([]);
  const [errors, setErrors] = useState<Fields>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState<EventInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const set = (name: string) => (value: string) => {
    setFields((f) => ({ ...f, [name]: value }));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== name)));
    setSaved(null);
  };

  const invalid = (name: string) =>
    errors[name]
      ? { 'aria-invalid': true, 'aria-describedby': `${id(name)}-error` }
      : { 'aria-invalid': undefined };

  async function save(input: EventInput) {
    setSaving(true);
    setFailure(null);
    try {
      await onSubmit(input);
      setPending(null);
      setSaved(`${TYPE_LABEL[type]} tersimpan di HP ini.`);
      setFields({ date: fields.date ?? localDate(now()) });
      setSigns([]);
    } catch (err) {
      if (err instanceof WarningsNeedConfirmation) setPending(input);
      setFailure(err);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const { input, errors: found } = buildInput(type, fields, signs, now());
    setErrors(found);
    if (Object.keys(found).length > 0 || !input) return;
    void save(input);
  }

  function chooseStock(stockId: string) {
    const stock = stocks.find((s) => s.id === stockId);
    setFields((f) => ({
      ...f,
      semenStockId: stockId,
      strawCode: stock?.strawCode ?? f.strawCode ?? '',
      bullId: stock?.bullId ?? f.bullId ?? '',
      batch: stock?.batch ?? f.batch ?? '',
    }));
    setErrors({});
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-semibold">Jenis catatan</legend>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-secondary p-1">
          {types.map((t) => (
            <label
              key={t}
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-center rounded-md px-1 text-base font-semibold has-focus-visible:outline-3 has-focus-visible:outline-ring',
                t === type
                  ? 'bg-primary text-primary-foreground'
                  : 'text-secondary-foreground hover:bg-card',
              )}
            >
              <input
                type="radio"
                name={id('type')}
                value={t}
                checked={t === type}
                onChange={() => {
                  setType(t);
                  setErrors({});
                  setFailure(null);
                  setPending(null);
                  setSaved(null);
                }}
                className="sr-only"
              />
              {TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field id={id('date')} label="Tanggal kejadian" error={errors.date}>
        <Input
          id={id('date')}
          type="date"
          value={fields.date ?? ''}
          max={localDate(now())}
          onChange={(e) => {
            set('date')(e.target.value);
          }}
          {...invalid('date')}
        />
      </Field>

      {type === 'BH' && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-base font-semibold">Tanda birahi yang terlihat</legend>
          {ESTRUS_SIGNS.map((sign) => (
            <label key={sign} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-6 accent-(--leaf)"
                checked={signs.includes(sign)}
                onChange={(e) => {
                  setSigns((s) => (e.target.checked ? [...s, sign] : s.filter((x) => x !== sign)));
                }}
              />
              {SIGN_LABEL[sign]}
            </label>
          ))}
        </fieldset>
      )}

      {type === 'IB' && (
        <>
          {stocks.length > 0 && (
            <Field id={id('stock')} label="Straw yang dipakai">
              <NativeSelect
                id={id('stock')}
                value={fields.semenStockId ?? ''}
                onChange={(e) => {
                  chooseStock(e.target.value);
                }}
              >
                <option value="">Isi sendiri</option>
                {stocks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.strawCode}, {s.bullName ?? s.bullId}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field id={id('strawCode')} label="Kode straw" error={errors.strawCode}>
            <Input
              id={id('strawCode')}
              value={fields.strawCode ?? ''}
              autoCapitalize="characters"
              onChange={(e) => {
                set('strawCode')(e.target.value);
              }}
              {...invalid('strawCode')}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={id('bullId')} label="ID pejantan" error={errors.bullId}>
              <Input
                id={id('bullId')}
                value={fields.bullId ?? ''}
                autoCapitalize="characters"
                onChange={(e) => {
                  set('bullId')(e.target.value);
                }}
                {...invalid('bullId')}
              />
            </Field>
            <Field id={id('batch')} label="Batch" error={errors.batch}>
              <Input
                id={id('batch')}
                value={fields.batch ?? ''}
                onChange={(e) => {
                  set('batch')(e.target.value);
                }}
                {...invalid('batch')}
              />
            </Field>
          </div>
        </>
      )}

      {type === 'PKB' && (
        <>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-base font-semibold">Hasil pemeriksaan</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['pregnant', 'Bunting'],
                  ['not_pregnant', 'Tidak bunting'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-(length:--bw) border-input bg-card px-3 font-semibold has-checked:border-2 has-checked:border-primary has-checked:bg-secondary',
                  )}
                >
                  <input
                    type="radio"
                    name={id('result')}
                    value={value}
                    checked={fields.result === value}
                    onChange={() => {
                      set('result')(value);
                    }}
                    className="size-5 accent-(--leaf)"
                  />
                  {label}
                </label>
              ))}
            </div>
            {errors.result && <p className="font-semibold text-alarm">{errors.result}</p>}
          </fieldset>
          {fields.result === 'pregnant' && (
            <Field id={id('fetalAgeMonths')} label="Umur janin" error={errors.fetalAgeMonths}>
              <NativeSelect
                id={id('fetalAgeMonths')}
                value={fields.fetalAgeMonths ?? ''}
                onChange={(e) => {
                  set('fetalAgeMonths')(e.target.value);
                }}
                {...invalid('fetalAgeMonths')}
              >
                <option value="">Pilih</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} bulan
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field id={id('method')} label="Cara periksa">
            <NativeSelect
              id={id('method')}
              value={fields.method ?? ''}
              onChange={(e) => {
                set('method')(e.target.value);
              }}
            >
              <option value="">Tidak dicatat</option>
              <option value="palpation">Palpasi (raba)</option>
              <option value="usg">USG</option>
            </NativeSelect>
          </Field>
        </>
      )}

      {type === 'BB' && (
        <div className="grid grid-cols-2 gap-3">
          <Field id={id('weightKg')} label="Berat (kg)" error={errors.weightKg}>
            <Input
              id={id('weightKg')}
              inputMode="decimal"
              value={fields.weightKg ?? ''}
              onChange={(e) => {
                set('weightKg')(e.target.value);
              }}
              {...invalid('weightKg')}
            />
          </Field>
          <Field id={id('method')} label="Cara ukur">
            <NativeSelect
              id={id('method')}
              value={fields.method ?? 'scale'}
              onChange={(e) => {
                set('method')(e.target.value);
              }}
            >
              <option value="scale">Timbangan</option>
              <option value="tape">Pita ukur</option>
            </NativeSelect>
          </Field>
        </div>
      )}

      <Field id={id('notes')} label="Catatan (boleh kosong)">
        <Textarea
          id={id('notes')}
          value={fields.notes ?? ''}
          onChange={(e) => {
            set('notes')(e.target.value);
          }}
        />
      </Field>

      {failure !== null && (
        <ErrorMessage
          error={failure}
          action={
            pending ? (
              <Button
                type="button"
                onClick={() => {
                  void save({ ...pending, confirmWarnings: true });
                }}
              >
                Tetap simpan
              </Button>
            ) : undefined
          }
        />
      )}

      {saved && (
        <p role="status" className="flex items-center gap-2 font-semibold text-primary">
          <CircleCheck aria-hidden="true" className="size-5" />
          {saved}
        </p>
      )}

      <Button type="submit" size="lg" disabled={saving}>
        {saving ? 'Menyimpan…' : `Simpan ${TYPE_LABEL[type]}`}
      </Button>
    </form>
  );
}
