// Tata letak kertas stiker A4 (210 × 297 mm). Ukuran mengikuti kertas label yang umum dijual:
// 24 label (3 × 8, 70 × 37 mm) dan 40 label (4 × 10, 52,5 × 29,7 mm), tanpa jarak antarlabel.

export interface SheetLayout {
  perSheet: 24 | 40;
  columns: number;
  rows: number;
  /** Ukuran satu label dalam mm. */
  labelWidth: number;
  labelHeight: number;
  /** Margin atas/bawah dan kiri/kanan lembar dalam mm. */
  marginY: number;
  marginX: number;
}

export const A4 = { width: 210, height: 297 } as const;

export const SHEET_LAYOUTS: Record<24 | 40, SheetLayout> = {
  24: {
    perSheet: 24,
    columns: 3,
    rows: 8,
    labelWidth: 70,
    labelHeight: 37,
    marginY: 0.5,
    marginX: 0,
  },
  40: {
    perSheet: 40,
    columns: 4,
    rows: 10,
    labelWidth: 52.5,
    labelHeight: 29.7,
    marginY: 0,
    marginX: 0,
  },
};

export interface LabelItem {
  code: string;
  /** Nama panggilan sapi (opsional, hanya teks di label; tidak masuk QR). */
  name: string | null;
}

/** Bagi label menjadi lembar-lembar; sel kosong di lembar terakhir diisi null. */
export function paginate(items: LabelItem[], layout: SheetLayout): (LabelItem | null)[][] {
  const pages: (LabelItem | null)[][] = [];
  for (let i = 0; i < items.length; i += layout.perSheet) {
    const page: (LabelItem | null)[] = items.slice(i, i + layout.perSheet);
    while (page.length < layout.perSheet) page.push(null);
    pages.push(page);
  }
  return pages;
}

/** Ukuran QR (mm) agar muat di label beserta kode teks: sisi terpendek dikurangi tepi. */
export function qrSizeMm(layout: SheetLayout): number {
  return Math.floor((layout.labelHeight - 4) * 10) / 10;
}

/** Cek tata letak muat di A4 (dipakai tes). */
export function fitsA4(layout: SheetLayout): boolean {
  const w = layout.columns * layout.labelWidth + 2 * layout.marginX;
  const h = layout.rows * layout.labelHeight + 2 * layout.marginY;
  return w <= A4.width + 0.01 && h <= A4.height + 0.01;
}
