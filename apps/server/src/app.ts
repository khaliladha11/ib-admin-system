import { OpenAPIHono } from '@hono/zod-openapi';
import { createHealthResponse, HEALTH_PATH, SERVER_DEVICE_ID } from '@ib/shared';

import { loadSessionUser } from './auth/session';
import { loadConfig, type ServerConfig } from './config';
import type { Db } from './db/client';
import { registerDocs } from './http/docs';
import { handleError, validationHook } from './http/errors';
import type { AppEnv } from './http/env';
import { registerAnimalRoutes } from './routes/animals';
import { registerAuthRoutes } from './routes/auth';
import { registerFarmerRoutes } from './routes/farmers';
import { registerReminderRoutes } from './routes/reminders';
import { registerServiceRequestRoutes } from './routes/service-requests';

export const SERVICE_NAME = 'ib-server';
export const API_VERSION = '0.1.0';

export interface AppDeps {
  db: Db;
  /** Waktu sekarang (ms). Diganti di tes. */
  now?: () => number;
  config?: Partial<ServerConfig>;
}

export function createApp({ db, now = () => Date.now(), config }: AppDeps) {
  const fullConfig = { ...loadConfig(), ...config };
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  app.onError(handleError);
  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'Alamat API tidak ditemukan.' } }, 404),
  );

  app.use('/api/*', async (c, next) => {
    c.set('db', db);
    c.set('config', fullConfig);
    c.set('now', now);
    const deviceId = c.req.header('x-device-id')?.trim().slice(0, 100);
    c.set('deviceId', deviceId?.length ? deviceId : SERVER_DEVICE_ID); // string kosong → "server"
    await next();
  });
  app.use('/api/*', loadSessionUser);

  app.get(HEALTH_PATH, (c) => c.json(createHealthResponse(SERVICE_NAME, new Date(now()))));

  registerAuthRoutes(app);
  registerFarmerRoutes(app);
  registerAnimalRoutes(app);
  registerServiceRequestRoutes(app);
  registerReminderRoutes(app);

  app.openAPIRegistry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'ib_session',
  });
  app.doc31('/api/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'IB Admin System API',
      version: API_VERSION,
      description:
        'API pencatatan reproduksi sapi. Semua endpoint (kecuali login dan health) butuh cookie sesi dari /api/auth/login. Error selalu berbentuk { error: { code, message, details? } }.',
    },
  });
  registerDocs(app, '/api/openapi.json');

  return app;
}

export type App = ReturnType<typeof createApp>;
