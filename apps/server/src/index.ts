import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';

const port = Number(process.env.PORT ?? 3000);
const { db } = createDb();
runMigrations(db);

serve({ fetch: createApp({ db }).fetch, port }, (info) => {
  console.log(`Server berjalan di http://localhost:${String(info.port)}`);
  console.log(`Dokumentasi API: http://localhost:${String(info.port)}/api/docs`);
});
