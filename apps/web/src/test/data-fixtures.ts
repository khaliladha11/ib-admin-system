// Fixture tes lapisan data: DB Dexie baru per tes, sesi, baris contoh, dan server tiruan.
import {
  uuidv7,
  type Animal,
  type AnimalEvent,
  type Farmer,
  type Location,
  type UserRole,
} from '@ib/shared';

import { createDataLayer, type DataLayer } from '@/data/context';
import { INITIAL_SYNC_STATE, type Session } from '@/data/db';

export const DAY = 86_400_000;
export const TODAY = Date.UTC(2026, 10, 25, 3, 0, 0);

let dbCounter = 0;

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** Jawaban server tiruan: status + body, atau 'network' untuk koneksi putus. */
export type Reply = { status: number; body?: unknown } | 'network';
export type Handler = (call: Call) => Reply;

/** Satu perubahan di dalam POST /api/sync/push. */
interface PushedChange {
  id: string;
  kind: string;
  method: string;
  path: string;
  body: unknown;
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * fetch tiruan yang mencatat setiap panggilan dan menjawab lewat `handler`.
 *
 * POST /api/sync/push dibongkar seperti server sungguhan (docs/SYNC.md §3): setiap perubahan
 * menjadi satu panggilan ke `handler` dengan method/path/body aslinya (tercatat di `calls`),
 * lalu jawabannya diklasifikasikan menjadi applied / needs_review / rejected. Jawaban
 * 'network' atau 401 berlaku untuk seluruh request; 5xx menghentikan batch.
 * Gunakan `rawPush: true` untuk menjawab /api/sync/push langsung.
 */
export function fakeServer(
  initial: Handler = () => ({ status: 200, body: {} }),
  { rawPush = false }: { rawPush?: boolean } = {},
) {
  const calls: Call[] = [];
  let handler = initial;

  function push(changes: PushedChange[]): Promise<Response> {
    const results: unknown[] = [];
    for (const change of changes) {
      const call: Call = { method: change.method, path: change.path, body: change.body };
      calls.push(call);
      const reply = handler(call);
      if (reply === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      const err = (reply.body as { error?: { code?: string; message?: string } } | undefined)
        ?.error;
      if (reply.status === 401) return Promise.resolve(jsonResponse(401, reply.body));
      if (reply.status >= 500) break;
      if (reply.status < 300) {
        results.push({
          id: change.id,
          result: 'applied',
          code: null,
          message: null,
          body: reply.body ?? null,
        });
      } else if (reply.status === 409 && err?.code === 'ALREADY_EXISTS') {
        results.push({
          id: change.id,
          result: 'applied',
          code: 'ALREADY_EXISTS',
          message: null,
          body: null,
        });
      } else {
        const review =
          change.kind === 'event.create' && reply.status === 422 && err?.code === 'INVALID_EVENT';
        results.push({
          id: change.id,
          result: review ? 'needs_review' : 'rejected',
          code: err?.code ?? null,
          message: err?.message ?? null,
          body: null,
        });
      }
    }
    // Gangguan pada perubahan pertama: seluruh request dijawab 5xx (seperti server mati).
    if (results.length === 0 && changes.length > 0) {
      const first = changes[0];
      const reply = first
        ? handler({ method: first.method, path: first.path, body: first.body })
        : null;
      if (reply && reply !== 'network' && reply.status >= 500) {
        return Promise.resolve(jsonResponse(reply.status, reply.body));
      }
    }
    return Promise.resolve(jsonResponse(200, { results }));
  }

  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    if (!rawPush && call.method === 'POST' && call.path === '/api/sync/push') {
      return push((call.body as { changes: PushedChange[] }).changes);
    }
    calls.push(call);
    const reply = handler(call);
    if (reply === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(jsonResponse(reply.status, reply.body));
  };
  return {
    fetch,
    calls,
    setHandler: (next: Handler) => {
      handler = next;
    },
  };
}

export const errorReply = (status: number, code: string, message = code): Reply => ({
  status,
  body: { error: { code, message } },
});

const base = (time = TODAY - 30 * DAY) => ({
  id: uuidv7(time),
  createdAt: time,
  updatedAt: time,
  deletedAt: null,
  deviceId: 'server',
});

export const IDS = {
  admin: uuidv7(TODAY - 400 * DAY),
  farmerUser: uuidv7(TODAY - 399 * DAY),
  inseminator: uuidv7(TODAY - 398 * DAY),
};

export function makeLocation(): Location {
  return { ...base(), parentId: null, level: 'group', name: 'KTT Contoh', code: 'KTT-99' };
}

export function makeFarmer(locationId: string, extra: Partial<Farmer> = {}): Farmer {
  return {
    ...base(),
    userId: null,
    locationId,
    name: 'Pak Contoh',
    phone: null,
    address: null,
    isikhnasOwnerId: null,
    ...extra,
  };
}

export function makeAnimal(farmerId: string, extra: Partial<Animal> = {}): Animal {
  return {
    ...base(),
    farmerId,
    damId: null,
    name: 'Sapi Contoh',
    sex: 'F',
    breed: 'Simental',
    birthDate: '2022-01-10',
    sireCode: null,
    isikhnasAnimalId: null,
    ...extra,
  };
}

export function makeEvent(
  animalId: string,
  daysAgo: number,
  body: Pick<AnimalEvent, 'type' | 'payload'>,
): AnimalEvent {
  const occurredAt = TODAY - daysAgo * DAY;
  return {
    ...base(occurredAt),
    animalId,
    occurredAt,
    recordedBy: IDS.inseminator,
    serviceRequestId: null,
    semenStockId: null,
    voidsEventId: null,
    ...body,
  } as AnimalEvent;
}

export const ibBody = {
  type: 'IB',
  payload: { strawCode: 'SIM-1', bullId: 'BULL-7', batch: 'B-1' },
} as const;
export const pkbPregnant = {
  type: 'PKB',
  payload: { result: 'pregnant', fetalAgeMonths: 2 },
} as const;

export interface TestLayer extends DataLayer {
  server: ReturnType<typeof fakeServer>;
  location: Location;
  farmer: Farmer;
  animal: Animal;
  /** Majukan jam tes. */
  advance: (ms: number) => void;
}

export function sessionFor(role: UserRole, farmerId: string | null = null): Session {
  const id =
    role === 'farmer' ? IDS.farmerUser : role === 'inseminator' ? IDS.inseminator : IDS.admin;
  return { user: { id, name: `Pengguna ${role}`, role, locationId: null }, farmerId };
}

/** Lapisan data dengan DB baru, sesi `role`, dan satu lokasi + peternak + sapi tersinkron. */
export async function createTestLayer(
  role: UserRole = 'group_admin',
  handler?: Handler,
): Promise<TestLayer> {
  dbCounter += 1;
  let clock = TODAY;
  const server = fakeServer(handler);
  const layer = createDataLayer({
    dbName: `ib-test-${String(dbCounter)}`,
    fetch: server.fetch,
    now: () => clock,
    syncOnWrite: false,
  });
  const location = makeLocation();
  const farmer = makeFarmer(location.id, role === 'farmer' ? { userId: IDS.farmerUser } : {});
  const animal = makeAnimal(farmer.id);
  await layer.db.locations.add(location);
  await layer.db.farmers.add(farmer);
  await layer.db.animals.add(animal);
  await layer.db.setMeta('session', sessionFor(role, role === 'farmer' ? farmer.id : null));
  await layer.db.setMeta('sync', INITIAL_SYNC_STATE);
  return {
    ...layer,
    server,
    location,
    farmer,
    animal,
    advance: (ms) => {
      clock += ms;
    },
  };
}
