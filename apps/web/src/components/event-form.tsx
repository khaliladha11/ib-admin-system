// Form catat event cepat: pilih jenis dengan tombol besar, isian bawaan dari data terakhir.
// Untuk IB dengan stok straw, semua isian muat dalam satu layar HP tanpa menggulir.
// Aturan urutan event (validateNextEvent) dijalankan oleh repo saat `onSubmit`.
import { ESTRUS_SIGNS } from '@ib/shared';
import { Minus, NotebookPen, Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WarningsNeedConfirmation, type EventInput } from '@/data';
import { cn } from '@/lib/utils';

import { ErrorMessage } from './error-message';
import {
  buildInput,
  EVENT_FORM_TYPES,
  initialFields,
  localDate,
  SIGN_LABEL,
  TYPE_LABEL,
  type CalfField,
  type EventFormType,
  type Fields,
  type FormDefaults,
} from './event-form-model';
import { EVENT_META } from './event-text';

export interface EventFormProps {
  /** Jenis yang boleh dicatat (peternak: tanpa IB dan PKB). */
  types?: readonly EventFormType[];
  defaultType?: EventFormType;
  /** IB terakhir, stok straw, tugas aktif, umur kebuntingan. */
  defaults?: FormDefaults;
  /** Permintaan layanan yang dikerjakan (dari layar Tugas). */
  taskId?: string | null;
  /** Biasanya `repo.recordEvent` untuk ternak ini. */
  onSubmit: (input: EventInput) => Promise<unknown>;
  /** Setelah tersimpan. Tanpa ini, form menampilkan pesan dan kosong lagi. */
  onSaved?: (type: EventFormType) => void;
  now?: () => number;
}

const NEW_CALF: CalfField = { sex: 'F', condition: 'alive', weightKg: '' };

function Field({
  id,
  label,
  error,
  children,
  inline,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={cn('flex gap-1.5', inline ? 'items-center justify-between gap-3' : 'flex-col')}>
      <Label htmlFor={id} className={cn(inline && 'shrink-0')}>
        {label}
      </Label>
      <div className={cn(inline && 'min-w-0 flex-1')}>{children}</div>
      {error && (
        <p id={`${id}-error`} role="alert" className="font-semibold text-alarm">
          {error}
        </p>
      )}
    </div>
  );
}

/** Pilihan dengan tombol besar (radio tersembunyi agar tetap terbaca pembaca layar). */
function Choice<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: {
  name: string;
  legend: string;
  options: readonly (readonly [T, string])[];
  value: string;
  onChange: (v: T) => void;
  error?: string;
  columns?: 2 | 3;
}) {
  return (
    <fieldset
      className="flex flex-col gap-1.5"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
    >
      <legend className="mb-1.5 text-base font-semibold">{legend}</legend>
      <div className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map(([v, label]) => (
          <label
            key={v}
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-md border-(length:--bw) border-input bg-card px-2 text-center font-semibold has-checked:border-2 has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-3 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => {
                onChange(v);
              }}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} role="alert" className="font-semibold text-alarm">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function EventForm({
  types = EVENT_FORM_TYPES,
  defaultType,
  defaults = {},
  taskId = null,
  onSubmit,
  onSaved,
  now = () => Date.now(),
}: EventFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [type, setType] = useState<EventFormType>(
    defaultType && types.includes(defaultType) ? defaultType : (types[0] ?? 'BH'),
  );
  const [fields, setFields] = useState<Fields>(() => initialFields(defaults, now()));
  const [signs, setSigns] = useState<string[]>([]);
  const [calves, setCalves] = useState<CalfField[]>([NEW_CALF]);
  const [manualStraw, setManualStraw] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [errors, setErrors] = useState<Fields>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState<EventInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const stocks = defaults.stocks ?? [];
  const task = taskId ?? defaults.openTask?.id ?? null;
  const taskType = defaults.openTask?.type ?? null;
  const [attachTask, setAttachTask] = useState(true);
  const serviceRequestId =
    task &&
    attachTask &&
    (taskType === null || taskType === type) &&
    (type === 'IB' || type === 'PKB')
      ? task
      : null;

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
      if (onSaved) {
        onSaved(type);
        return;
      }
      setSaved(`${TYPE_LABEL[type]} tersimpan di HP ini.`);
      setFields(initialFields(defaults, now()));
      setSigns([]);
      setCalves([NEW_CALF]);
    } catch (err) {
      if (err instanceof WarningsNeedConfirmation) setPending(input);
      setFailure(err);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const { input, errors: found } = buildInput(type, fields, {
      signs,
      calves,
      serviceRequestId,
      now: now(),
    });
    setErrors(found);
    if (Object.keys(found).length > 0 || !input) return;
    void save(input);
  }

  function chooseStock(stockId: string) {
    const stock = stocks.find((s) => s.id === stockId);
    setFields((f) => ({
      ...f,
      semenStockId: stockId,
      strawCode: stock?.strawCode ?? '',
      bullId: stock?.bullId ?? '',
      batch: stock?.batch ?? '',
    }));
    setManualStraw(!stock);
    setErrors({});
  }

  const stock = stocks.find((s) => s.id === fields.semenStockId);
  const strawFieldsVisible = type === 'IB' && (manualStraw || !stock);

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <fieldset>
        <legend className="sr-only">Jenis kejadian</legend>
        <div className={cn('grid gap-2', types.length > 4 ? 'grid-cols-3' : 'grid-cols-2')}>
          {types.map((t) => {
            const Icon = EVENT_META[t].icon;
            return (
              <label
                key={t}
                className={cn(
                  'flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-(length:--bw) px-1 text-base font-bold has-focus-visible:outline-3 has-focus-visible:outline-ring',
                  t === type
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-foreground hover:bg-secondary',
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
                <Icon aria-hidden="true" className="size-5" strokeWidth={2.25} />
                {TYPE_LABEL[t]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field id={id('date')} label="Tanggal" error={errors.date} inline>
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
        <fieldset className="flex flex-col">
          <legend className="mb-1 text-base font-semibold">Tanda yang terlihat</legend>
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
            <Field id={id('stock')} label="Straw dari stok">
              <NativeSelect
                id={id('stock')}
                value={fields.semenStockId ?? ''}
                onChange={(e) => {
                  chooseStock(e.target.value);
                }}
              >
                {stocks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.strawCode}, {s.bullName ?? s.bullId} (sisa {s.remaining})
                  </option>
                ))}
                <option value="">Straw lain, isi sendiri</option>
              </NativeSelect>
              {stock && !manualStraw && (
                <p className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-muted-foreground">
                  <span>
                    Pejantan {stock.bullId}, batch {stock.batch}
                  </span>
                  <button
                    type="button"
                    className="min-h-11 font-semibold text-primary underline underline-offset-4"
                    onClick={() => {
                      setManualStraw(true);
                    }}
                  >
                    Ubah isian
                  </button>
                </p>
              )}
            </Field>
          )}
          {strawFieldsVisible && (
            <>
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
        </>
      )}

      {type === 'PKB' && (
        <>
          <Choice
            name={id('result')}
            legend="Hasil pemeriksaan"
            options={[
              ['pregnant', 'Bunting'],
              ['not_pregnant', 'Tidak bunting'],
            ]}
            value={fields.result ?? ''}
            onChange={set('result')}
            error={errors.result}
          />
          <div className="grid grid-cols-2 gap-3">
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
            <Field id={id('pkbMethod')} label="Cara periksa">
              <NativeSelect
                id={id('pkbMethod')}
                value={fields.pkbMethod ?? ''}
                onChange={(e) => {
                  set('pkbMethod')(e.target.value);
                }}
              >
                <option value="">Tidak dicatat</option>
                <option value="palpation">Palpasi</option>
                <option value="usg">USG</option>
              </NativeSelect>
            </Field>
          </div>
        </>
      )}

      {type === 'KGG' && (
        <Choice
          name={id('trimester')}
          legend="Umur kebuntingan saat keguguran"
          columns={3}
          options={[
            ['1', '0–3 bulan'],
            ['2', '4–6 bulan'],
            ['3', '7 bulan +'],
          ]}
          value={fields.trimester ?? ''}
          onChange={set('trimester')}
          error={errors.trimester}
        />
      )}

      {type === 'LH' && (
        <div className="flex flex-col gap-3">
          {calves.map((calf, i) => {
            const update = (patch: Partial<CalfField>) => {
              setCalves((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
            };
            return (
              <fieldset key={i} className="flex flex-col gap-2 rounded-lg border-(length:--bw) p-3">
                <legend className="px-1 font-bold">
                  {calves.length > 1 ? `Anak ke-${String(i + 1)}` : 'Anak'}
                </legend>
                <Choice
                  name={id(`sex${String(i)}`)}
                  legend="Jenis kelamin"
                  options={[
                    ['F', 'Betina'],
                    ['M', 'Jantan'],
                  ]}
                  value={calf.sex}
                  onChange={(sex) => {
                    update({ sex });
                  }}
                />
                <Choice
                  name={id(`cond${String(i)}`)}
                  legend="Kondisi"
                  options={[
                    ['alive', 'Hidup'],
                    ['stillborn', 'Mati saat lahir'],
                  ]}
                  value={calf.condition}
                  onChange={(condition) => {
                    update({ condition });
                  }}
                />
                <Field
                  id={id(`kg${String(i)}`)}
                  label="Berat lahir, kg (boleh kosong)"
                  error={errors[`calf${String(i)}`]}
                >
                  <Input
                    id={id(`kg${String(i)}`)}
                    inputMode="decimal"
                    value={calf.weightKg}
                    onChange={(e) => {
                      update({ weightKg: e.target.value });
                    }}
                  />
                </Field>
                {calves.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCalves((list) => list.filter((_, j) => j !== i));
                    }}
                  >
                    <Minus aria-hidden="true" />
                    Hapus anak ini
                  </Button>
                )}
              </fieldset>
            );
          })}
          {calves.length < 4 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCalves((list) => [...list, NEW_CALF]);
              }}
            >
              <Plus aria-hidden="true" />
              Tambah anak (kembar)
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Anak yang hidup otomatis didaftarkan sebagai ternak baru.
          </p>
        </div>
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
          <Field id={id('weightMethod')} label="Cara ukur">
            <NativeSelect
              id={id('weightMethod')}
              value={fields.weightMethod ?? 'scale'}
              onChange={(e) => {
                set('weightMethod')(e.target.value);
              }}
            >
              <option value="scale">Timbangan</option>
              <option value="tape">Pita ukur</option>
            </NativeSelect>
          </Field>
        </div>
      )}

      {task && (type === 'IB' || type === 'PKB') && (taskType === null || taskType === type) && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-6 accent-(--leaf)"
            checked={attachTask}
            onChange={(e) => {
              setAttachTask(e.target.checked);
            }}
          />
          Tandai permintaan {type} peternak selesai
        </label>
      )}

      {showNotes ? (
        <Field id={id('notes')} label="Catatan">
          <Textarea
            id={id('notes')}
            value={fields.notes ?? ''}
            onChange={(e) => {
              set('notes')(e.target.value);
            }}
          />
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowNotes(true);
          }}
          className="flex min-h-11 items-center gap-2 self-start font-semibold text-primary"
        >
          <NotebookPen aria-hidden="true" className="size-5" />
          Tambah catatan
        </button>
      )}

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
        <p role="status" className="font-semibold text-primary">
          {saved}
        </p>
      )}

      <Button type="submit" size="lg" disabled={saving} className="h-13 text-lg">
        {saving ? 'Menyimpan…' : `Simpan ${TYPE_LABEL[type]}`}
      </Button>
    </form>
  );
}
