// Pos IB (langkah 4.3): alamat aplikasi untuk HP, cadangan, ekspor/impor seluruh data.
import { networkInterfaces } from 'node:os';

import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';

import { ADMIN_ROLES, requireRole } from '../auth/scope';
import { requireUser } from '../auth/session';
import { conflict, errorResponses } from '../http/errors';
import type { AppEnv } from '../http/env';
import { jsonContent } from '../http/schemas';
import { createBackup, listBackups } from '../ops/backup';
import {
  assertExportFile,
  EXPORT_TABLES,
  exportAll,
  exportCsvZip,
  ImportFormatError,
  importAll,
} from '../ops/export';
import { audit, scopeOf } from './helpers';

const tags = ['Pos IB'];
const security = [{ cookieAuth: [] }];

/** Alamat IPv4 jaringan lokal komputer ini (bukan loopback/docker). */
export function lanAddresses(): string[] {
  return Object.entries(networkInterfaces())
    .filter(([name]) => !/^(docker|br-|veth|lo)/.test(name))
    .flatMap(([, list]) => list ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

const backupSchema = z.object({ name: z.string(), size: z.int(), createdAt: z.int() });

const infoSchema = z
  .object({
    /** Alamat yang dibuka HP (PUBLIC_URL), atau null bila belum diatur. */
    publicUrl: z.string().nullable(),
    /** Alamat unduh sertifikat root untuk HP (CERT_URL). */
    certUrl: z.string().nullable(),
    /** Alamat IP yang terdeteksi di komputer ini (cadangan bila PUBLIC_URL kosong). */
    addresses: z.array(z.string()),
    backups: z.array(backupSchema),
    backupKeep: z.int(),
  })
  .openapi('SystemInfo');

const countsSchema = z.record(z.string(), z.object({ added: z.int(), skipped: z.int() }));

const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function registerSystemRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/system/info',
      tags,
      security,
      summary: 'Alamat aplikasi untuk HP dan daftar cadangan (admin)',
      responses: { 200: jsonContent(infoSchema, 'Info pos'), ...errorResponses },
    }),
    (c) => {
      requireRole(requireUser(c), ADMIN_ROLES);
      const { config } = c.var;
      return c.json(
        {
          publicUrl: config.publicUrl,
          certUrl: config.certUrl,
          addresses: lanAddresses(),
          backups: listBackups(config.backupDir).map(({ name, size, createdAt }) => ({
            name,
            size,
            createdAt,
          })),
          backupKeep: config.backupKeep,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/system/backup',
      tags,
      security,
      summary: 'Buat cadangan database sekarang (admin dinas)',
      responses: { 201: jsonContent(backupSchema, 'Cadangan dibuat'), ...errorResponses },
    }),
    async (c) => {
      requireRole(requireUser(c), ['agency_admin']);
      const { config } = c.var;
      const file = await createBackup(
        c.var.db.$client,
        config.backupDir,
        c.var.now(),
        config.backupKeep,
      );
      return c.json({ name: file.name, size: file.size, createdAt: file.createdAt }, 201);
    },
  );

  app.get('/api/system/export.json', (c) => {
    requireRole(requireUser(c), ['agency_admin']);
    const data = exportAll(c.var.db, c.var.now());
    c.header(
      'content-disposition',
      `attachment; filename="ib-ternak-${stamp(data.exportedAt)}.json"`,
    );
    c.header('cache-control', 'no-store');
    return c.json(data);
  });

  app.get('/api/system/export.zip', (c) => {
    requireRole(requireUser(c), ['agency_admin']);
    const zip = exportCsvZip(exportAll(c.var.db, c.var.now()));
    return c.body(new Uint8Array(zip), 200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="ib-ternak-${stamp(c.var.now())}-csv.zip"`,
      'cache-control': 'no-store',
    });
  });

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/system/import',
      tags,
      security,
      summary: 'Impor file ekspor JSON: gabung tanpa menimpa (admin dinas)',
      description:
        'Cadangan dibuat dulu. Baris dengan id yang sudah ada dilewati; baris baru ditambahkan ' +
        'dalam satu transaksi. File CSV tidak bisa diimpor.',
      request: {
        body: { content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } },
      },
      responses: {
        200: jsonContent(
          z.object({ backup: z.string(), counts: countsSchema }).openapi('ImportResult'),
          'Hasil impor',
        ),
        ...errorResponses,
      },
    }),
    async (c) => {
      requireRole(scopeOf(c).user, ['agency_admin']);
      const body: unknown = await c.req.json();
      try {
        assertExportFile(body);
      } catch (err) {
        if (err instanceof ImportFormatError) throw conflict(err.message);
        throw err;
      }
      const { config, db } = c.var;
      const backup = await createBackup(
        db.$client,
        config.backupDir,
        c.var.now(),
        config.backupKeep,
      );
      const counts = importAll(db, body, c.var.now());
      audit(c, db, {
        tableName: 'import',
        rowId: requireUser(c).id,
        action: 'insert',
        before: null,
        after: Object.fromEntries(EXPORT_TABLES.map((n) => [n, counts[n].added])),
      });
      return c.json({ backup: backup.name, counts }, 200);
    },
  );
}
