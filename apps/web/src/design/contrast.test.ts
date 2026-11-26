// Semua pasangan warna di index.css memenuhi WCAG AA, di mode terang dan kontras tinggi.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { contrastRatio, readCssVariables, resolveColor } from './contrast';

const css = readFileSync(path.resolve(import.meta.dirname, '../index.css'), 'utf8');
const light = readCssVariables(css, ':root');
const high = { ...light, ...readCssVariables(css, ":root[data-contrast='high']") };

const STATUSES = ['kosong', 'birahi', 'ib', 'bunting', 'keguguran', 'lahir', 'keluar'];

/** [teks/garis, latar, minimum]. 4,5 = teks biasa; 3 = garis input, ikon, tepi (WCAG 1.4.11). */
const PAIRS: [string, string, number][] = [
  ['foreground', 'background', 4.5],
  ['foreground', 'sky-wash', 4.5],
  ['muted-foreground', 'sky-wash', 4.5],
  ['leaf-deep', 'background', 4.5],
  ['leaf-deep', 'sky-wash', 4.5],
  ['primary', 'sky-wash', 4.5],
  ['foreground', 'card', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary', 'card', 4.5],
  ['primary', 'background', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['destructive', 'card', 4.5],
  ['info', 'card', 4.5],
  ['soil', 'card', 4.5],
  ['input', 'card', 3],
  ['ring', 'card', 3],
  ['ring', 'background', 3],
  ...STATUSES.flatMap((s): [string, string, number][] => [
    [`st-${s}-fg`, `st-${s}-bg`, 4.5],
    [`st-${s}-line`, `st-${s}-bg`, 3],
    [`st-${s}-line`, 'card', 3],
  ]),
];

describe.each([
  ['terang', light],
  ['kontras tinggi', high],
])('kontras WCAG AA, mode %s', (_mode, vars) => {
  it.each(PAIRS)('%s di atas %s ≥ %s:1', (fg, bg, min) => {
    const ratio = contrastRatio(resolveColor(vars, fg), resolveColor(vars, bg));
    expect(ratio).toBeGreaterThanOrEqual(min);
  });
});

describe('contrastRatio', () => {
  it('hitam/putih = 21, warna sama = 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#2e6b34', '#2e6b34')).toBe(1);
  });

  it('cocok dengan hasil pemeriksa luar (Made Good Designs): ink di field = 14,1', () => {
    expect(contrastRatio('#14261a', '#eef3ea')).toBeCloseTo(14.1, 1);
  });
});
