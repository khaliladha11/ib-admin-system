import { createHealthResponse, HEALTH_PATH } from '@ib/shared';
import { Hono } from 'hono';

export const SERVICE_NAME = 'ib-server';

export function createApp(now: () => Date = () => new Date()) {
  const app = new Hono();

  app.get(HEALTH_PATH, (c) => c.json(createHealthResponse(SERVICE_NAME, now())));

  return app;
}
