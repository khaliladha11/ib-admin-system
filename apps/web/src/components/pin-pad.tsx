// Papan angka besar untuk PIN (nyaman disentuh, juga dengan sarung tangan).
import { Delete } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PinPadProps {
  /** Dipanggil saat tombol OK ditekan dengan 4–6 angka. */
  onSubmit: (pin: string) => void | Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
  /** Ubah nilai ini untuk mengosongkan isian (mis. setelah PIN salah). */
  resetKey?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({ onSubmit, submitLabel = 'OK', disabled, resetKey = 0 }: PinPadProps) {
  const [state, setState] = useState({ pin: '', key: resetKey });
  const pin = state.key === resetKey ? state.pin : '';
  const set = (next: string) => {
    setState({ pin: next, key: resetKey });
  };
  const press = (digit: string) => {
    if (pin.length < 6) set(pin + digit);
  };
  return (
    <div className="flex flex-col items-center gap-5">
      <div
        role="status"
        aria-label={`${String(pin.length)} angka diisi`}
        className="flex h-6 items-center gap-3"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'size-4 rounded-full border-2 border-ink',
              i < pin.length ? 'bg-ink' : i >= 4 ? 'border-dashed border-line-strong' : '',
            )}
          />
        ))}
      </div>
      <div className="grid w-full max-w-72 grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <PadKey
            key={k}
            label={k}
            onPress={() => {
              press(k);
            }}
            disabled={disabled}
          />
        ))}
        <button
          type="button"
          aria-label="Hapus satu angka"
          disabled={(disabled ?? false) || pin.length === 0}
          onClick={() => {
            set(pin.slice(0, -1));
          }}
          className="flex h-16 items-center justify-center rounded-xl text-foreground hover:bg-secondary disabled:opacity-40"
        >
          <Delete aria-hidden="true" className="size-7" />
        </button>
        <PadKey
          label="0"
          onPress={() => {
            press('0');
          }}
          disabled={disabled}
        />
        <Button
          type="button"
          className="h-16 rounded-xl text-lg"
          disabled={(disabled ?? false) || pin.length < 4}
          onClick={() => {
            void onSubmit(pin);
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function PadKey({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="flex h-16 items-center justify-center rounded-xl border-(length:--bw) border-input bg-card text-2xl font-bold hover:bg-secondary disabled:opacity-40"
    >
      {label}
    </button>
  );
}
