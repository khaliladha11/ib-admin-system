// Rasio kontras WCAG 2.x antara dua warna #RRGGBB.

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Warna harus berformat #RRGGBB: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => channel(parseInt(h ?? '0', 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Variabel CSS `--nama: nilai;` dari satu blok selector. */
export function readCssVariables(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Blok ${selector} tidak ditemukan`);
  const body = css.slice(start, css.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (m[1] && m[2]) vars[m[1]] = m[2].trim();
  }
  return vars;
}

/** Ikuti var(--x) sampai ketemu warna. */
export function resolveColor(vars: Record<string, string>, name: string): string {
  let value = vars[name];
  for (let i = 0; i < 10 && value; i++) {
    const ref = /^var\(--([\w-]+)\)$/.exec(value);
    if (!ref?.[1]) return value;
    value = vars[ref[1]];
  }
  throw new Error(`Variabel --${name} tidak bisa diurai`);
}
