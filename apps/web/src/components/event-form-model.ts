// Model form catat event: jenis, label, isian bawaan, dan pembentukan EventInput.
// Murni (tanpa React) agar mudah dites.
import type { ESTRUS_SIGNS } from '@ib/shared';

import type { EventDefaults, EventInput } from '@/data';

export const EVENT_FORM_TYPES = ['BH', 'IB', 'PKB', 'KGG', 'LH', 'BB'] as const;
export type EventFormType = (typeof EVENT_FORM_TYPES)[number];

/** Peternak hanya mencatat yang bisa ia amati sendiri; IB dan PKB oleh petugas. */
export const FARMER_FORM_TYPES: readonly EventFormType[] = ['BH', 'KGG', 'LH', 'BB'];

export const TYPE_LABEL: Record<EventFormType, string> = {
  BH: 'Birahi',
  IB: 'IB',
  PKB: 'PKB',
  KGG: 'Keguguran',
  LH: 'Lahir',
  BB: 'Berat',
};

export const SIGN_LABEL: Record<(typeof ESTRUS_SIGNS)[number], string> = {
  lendir_bening: 'Keluar lendir bening',
  gelisah: 'Gelisah, sering melenguh',
  menaiki_sapi_lain: 'Menaiki sapi lain',
  diam_dinaiki: 'Diam saat dinaiki',
  vulva_bengkak: 'Vulva bengkak dan merah',
  nafsu_makan_turun: 'Nafsu makan turun',
};

export type Fields = Record<string, string>;

export interface CalfField {
  sex: 'F' | 'M';
  condition: 'alive' | 'stillborn';
  weightKg: string;
}

export interface FormDefaults extends Partial<EventDefaults> {
  /** Umur kebuntingan saat ini (untuk perkiraan trimester keguguran). */
  gestationMonths?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Hari ini: pakai jam sekarang. Hari lain: pukul 12.00 waktu HP. */
export function occurredAtFor(date: string, now: number): number {
  if (date === localDate(now)) return now;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).getTime();
}

export const trimesterFor = (months?: number) =>
  months === undefined ? '' : months <= 3 ? '1' : months <= 6 ? '2' : '3';

/** Isian awal per jenis, dari data terakhir pengguna. */
export function initialFields(defaults: FormDefaults, now: number): Fields {
  const stock =
    defaults.stocks?.find((s) => s.id === defaults.lastIb?.semenStockId) ?? defaults.stocks?.[0];
  const fromStock = stock
    ? {
        semenStockId: stock.id,
        strawCode: stock.strawCode,
        bullId: stock.bullId,
        batch: stock.batch,
      }
    : {
        semenStockId: '',
        strawCode: defaults.lastIb?.strawCode ?? '',
        bullId: defaults.lastIb?.bullId ?? '',
        batch: defaults.lastIb?.batch ?? '',
      };
  return {
    date: localDate(now),
    ...fromStock,
    method: '',
    pkbMethod: defaults.lastPkbMethod ?? '',
    weightMethod: defaults.lastWeightMethod ?? 'scale',
    trimester: trimesterFor(defaults.gestationMonths),
  };
}

export function buildInput(
  type: EventFormType,
  f: Fields,
  extra: { signs: string[]; calves: CalfField[]; serviceRequestId: string | null; now: number },
): { input?: EventInput; errors: Fields } {
  const { signs, calves, serviceRequestId, now } = extra;
  const errors: Fields = {};
  const notes = f.notes?.trim() ? f.notes.trim() : undefined;
  if (!f.date) errors.date = 'Isi tanggal kejadian.';
  else if (f.date > localDate(now)) errors.date = 'Tanggal tidak boleh setelah hari ini.';
  const occurredAt = f.date ? occurredAtFor(f.date, now) : now;
  const task = serviceRequestId ? { serviceRequestId } : {};

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
          ...task,
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
      const method = f.pkbMethod === 'usg' || f.pkbMethod === 'palpation' ? f.pkbMethod : undefined;
      return {
        errors,
        input: {
          type,
          occurredAt,
          ...task,
          payload: {
            result: pregnant ? 'pregnant' : 'not_pregnant',
            fetalAgeMonths: pregnant && f.fetalAgeMonths ? Number(f.fetalAgeMonths) : undefined,
            method,
            notes,
          },
        },
      };
    }
    case 'KGG': {
      if (!['1', '2', '3'].includes(f.trimester ?? ''))
        errors.trimester = 'Pilih umur kebuntingan saat keguguran.';
      return {
        errors,
        input: {
          type,
          occurredAt,
          payload: { trimester: Number(f.trimester ?? 1) as 1 | 2 | 3, notes },
        },
      };
    }
    case 'LH': {
      if (calves.length === 0) errors.calves = 'Tambahkan minimal satu anak.';
      const parsed = calves.map((c, i) => {
        const kg = c.weightKg.trim() ? Number(c.weightKg.replace(',', '.')) : undefined;
        if (kg !== undefined && (!Number.isFinite(kg) || kg <= 0 || kg >= 200)) {
          errors[`calf${String(i)}`] = 'Berat anak harus angka antara 1 dan 199 kg.';
        }
        return {
          sex: c.sex,
          condition: c.condition,
          ...(kg !== undefined ? { weightKg: kg } : {}),
        };
      });
      return { errors, input: { type, occurredAt, payload: { calves: parsed, notes } } };
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
          payload: { weightKg: kg, method: f.weightMethod === 'tape' ? 'tape' : 'scale', notes },
        },
      };
    }
  }
}
