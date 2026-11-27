// Ekspor/impor seluruh data (langkah 4.3).
//   JSON: lengkap (termasuk hash password), bisa diimpor ke server lain.
//   CSV (ZIP): satu file per tabel untuk Excel, tanpa hash password; tidak untuk impor.
// Impor = GABUNG tanpa menimpa: baris dengan id yang sudah ada dilewati (prinsip tambah-saja).
import { getTableName, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { Db } from '../db/client';
import * as t from '../db/schema';
import { zipFiles } from './zip';

export const EXPORT_FORMAT = 'ib-ternak-export';
export const EXPORT_VERSION = 1;

/** Urutan tabel: induk sebelum anak (untuk impor). Sesi login tidak diekspor. */
const TABLES = {
  locations: t.locations,
  users: t.users,
  farmers: t.farmers,
  animals: t.animals,
  animalTags: t.animalTags,
  qrCodes: t.qrCodes,
  semenStock: t.semenStock,
  serviceRequests: t.serviceRequests,
  events: t.events,
  assignments: t.assignments,
  auditLogs: t.auditLogs,
  syncChanges: t.syncChanges,
  fieldVersions: t.fieldVersions,
} as const satisfies Record<string, SQLiteTable>;
export type ExportTable = keyof typeof TABLES;
export const EXPORT_TABLES = Object.keys(TABLES) as ExportTable[];

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  tables: Record<ExportTable, Record<string, unknown>[]>;
}

export function exportAll(db: Db, now: number): ExportFile {
  const tables = Object.fromEntries(
    EXPORT_TABLES.map((name) => [name, db.select().from(TABLES[name]).all()]),
  ) as unknown as ExportFile['tables'];
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now, tables };
}

/** Nilai sel CSV: teks diberi tanda kutip bila perlu, objek ditulis sebagai JSON. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))];
  return `${lines.join('\r\n')}\r\n`;
}

/** ZIP berisi satu CSV per tabel (tanpa hash password). BOM agar Excel membaca UTF-8. */
export function exportCsvZip(data: ExportFile): Buffer {
  const bom = '﻿';
  const files = EXPORT_TABLES.map((name) => {
    const rows = data.tables[name].map((row) => {
      if (name !== 'users') return row;
      const rest = { ...row };
      delete rest.passwordHash;
      return rest;
    });
    return { name: `${name}.csv`, data: new TextEncoder().encode(bom + toCsv(rows)) };
  });
  return zipFiles(files, new Date(data.exportedAt));
}

export type ImportCounts = Record<ExportTable, { added: number; skipped: number }>;

export class ImportFormatError extends Error {}

export function assertExportFile(value: unknown): asserts value is ExportFile {
  const v = value as Partial<ExportFile> | null;
  if (v?.format !== EXPORT_FORMAT) throw new ImportFormatError('Bukan file ekspor IB Ternak.');
  if (v.version !== EXPORT_VERSION) {
    throw new ImportFormatError(`Versi file ${String(v.version)} belum didukung.`);
  }
  if (typeof v.tables !== 'object') throw new ImportFormatError('Isi file tidak lengkap.');
}

/**
 * Gabungkan isi file ke database dalam satu transaksi: baris baru ditambahkan, baris dengan id
 * (atau kunci) yang sama dilewati. Baris baru diberi updated_at sekarang agar ikut tertarik HP.
 */
export function importAll(db: Db, data: ExportFile, now: number): ImportCounts {
  const counts = Object.fromEntries(
    EXPORT_TABLES.map((n) => [n, { added: 0, skipped: 0 }]),
  ) as ImportCounts;
  db.transaction((tx) => {
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    for (const name of EXPORT_TABLES) {
      const table = TABLES[name];
      // File lama bisa tidak punya tabel tertentu.
      const rows = (data.tables as Partial<ExportFile['tables']>)[name] ?? [];
      for (const row of rows) {
        const values = 'updatedAt' in row ? { ...row, updatedAt: now } : row;
        const res = tx
          .insert(table)
          .values(values as never)
          .onConflictDoNothing()
          .run();
        if (res.changes > 0) counts[name].added += 1;
        else counts[name].skipped += 1;
      }
    }
  });
  return counts;
}

export const exportTableName = (name: ExportTable) => getTableName(TABLES[name]);
