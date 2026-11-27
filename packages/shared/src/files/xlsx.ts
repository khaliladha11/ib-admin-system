// Penulis file Excel (.xlsx) minimal tanpa dependensi (langkah 6.2): beberapa sheet berisi teks
// dan angka, baris pertama tebal. Format Office Open XML di dalam ZIP (lihat zip.ts).
import { utf8 } from './utf8';
import { zipFiles } from './zip';

export type XlsxCell = string | number | null;

export interface XlsxSheet {
  /** Nama sheet (≤ 31 karakter, tanpa : \ / ? * [ ]). */
  name: string;
  rows: readonly (readonly XlsxCell[])[];
  /** Lebar kolom (karakter), opsional. */
  widths?: readonly number[];
}

const xml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    // Karakter kontrol tidak sah di XML.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** "A", "B", …, "Z", "AA", … */
export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet';
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map(
          (w, i) =>
            `<col min="${String(i + 1)}" max="${String(i + 1)}" width="${String(w)}" customWidth="1"/>`,
        )
        .join('')}</cols>`
    : '';
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === null || value === '') return '';
          const ref = `${columnName(c)}${String(r + 1)}`;
          const style = r === 0 ? ' s="1"' : '';
          if (typeof value === 'number') {
            return Number.isFinite(value)
              ? `<c r="${ref}"${style}><v>${String(value)}</v></c>`
              : '';
          }
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${String(r + 1)}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

/** Buat isi file .xlsx. */
export function buildXlsx(sheets: readonly XlsxSheet[], date = new Date()): Uint8Array {
  const names = sheets.map((s) => safeSheetName(s.name));
  const files: { name: string; text: string }[] = [
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${String(i + 1)}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map(
          (n, i) =>
            `<sheet name="${xml(n)}" sheetId="${String(i + 1)}" r:id="rId${String(i + 1)}"/>`,
        )
        .join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${String(i + 1)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${String(i + 1)}.xml"/>`,
        )
        .join(
          '',
        )}<Relationship Id="rId${String(sheets.length + 1)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${String(i + 1)}.xml`,
      text: sheetXml(s),
    })),
  ];
  return zipFiles(
    files.map((f) => ({ name: f.name, data: utf8(f.text) })),
    date,
  );
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
