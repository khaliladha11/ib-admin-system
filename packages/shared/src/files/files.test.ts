import { describe, expect, it } from 'vitest';

import { buildXlsx, columnName, safeSheetName } from './xlsx';
import { utf8 } from './utf8';
import { crc32, zipFiles } from './zip';

// Paket shared tanpa tipe DOM/Node: ambil TextEncoder/TextDecoder dari runtime tes (Node).
const { TextEncoder, TextDecoder } = globalThis as unknown as {
  TextEncoder: new () => { encode(text: string): Uint8Array };
  TextDecoder: new () => { decode(bytes: Uint8Array): string };
};

const u32 = (b: Uint8Array, at: number) =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at, true);

/** Isi teks setiap berkas di ZIP tanpa kompresi. */
function unzip(zip: Uint8Array): Record<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const files: Record<string, string> = {};
  const dec = new TextDecoder();
  let pos = 0;
  while (view.getUint32(pos, true) === 0x04034b50) {
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const name = dec.decode(zip.subarray(pos + 30, pos + 30 + nameLen));
    files[name] = dec.decode(zip.subarray(pos + 30 + nameLen, pos + 30 + nameLen + size));
    pos += 30 + nameLen + size;
  }
  return files;
}

describe('utf8', () => {
  it('sama dengan TextEncoder, termasuk huruf non-ASCII dan emoji', () => {
    for (const text of ['abc', 'Sapi “Melati” – 2 bulan', 'ñ é ü', '🐄 IB']) {
      expect([...utf8(text)]).toEqual([...new TextEncoder().encode(text)]);
    }
  });
});

describe('zip', () => {
  it('struktur ZIP: header lokal, direktori pusat, akhir', () => {
    expect(crc32(utf8('123456789'))).toBe(0xcbf43926);
    const zip = zipFiles([
      { name: 'a.csv', data: utf8('x\r\n1\r\n') },
      { name: 'b.csv', data: new Uint8Array() },
    ]);
    expect(u32(zip, 0)).toBe(0x04034b50);
    expect(u32(zip, zip.length - 22)).toBe(0x06054b50);
    expect(unzip(zip)).toEqual({ 'a.csv': 'x\r\n1\r\n', 'b.csv': '' });
  });
});

describe('xlsx', () => {
  it('nama kolom dan nama sheet', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
    expect(safeSheetName('Per desa/kelompok [2026]: rekap yang sangat panjang')).toBe(
      'Per desa kelompok  2026   rekap',
    );
  });

  it('berisi workbook, sheet, angka, teks yang di-escape, baris judul tebal', () => {
    const files = unzip(
      buildXlsx([
        {
          name: 'Ringkasan',
          rows: [
            ['Petugas', 'S/C', 'CR (%)'],
            ['Andi & <Rina>', 1.5, 50],
            ['Tanpa data', null, ''],
          ],
          widths: [24, 8, 8],
        },
        { name: 'Bulan', rows: [['Bulan'], ['2026-11']] },
      ]),
    );
    expect(Object.keys(files)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    expect(files['xl/workbook.xml']).toContain('<sheet name="Ringkasan" sheetId="1" r:id="rId1"/>');
    const sheet = files['xl/worksheets/sheet1.xml'] ?? '';
    expect(sheet).toContain(
      '<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Petugas</t>',
    );
    expect(sheet).toContain('Andi &amp; &lt;Rina&gt;');
    expect(sheet).toContain('<c r="B2"><v>1.5</v></c>');
    expect(sheet).toContain('<row r="3"><c r="A3" t="inlineStr">');
    expect(sheet).not.toContain('r="B3"');
    expect(sheet).toContain('<col min="1" max="1" width="24" customWidth="1"/>');
  });
});
