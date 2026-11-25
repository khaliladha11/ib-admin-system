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

/** fetch tiruan yang mencatat setiap panggilan dan menjawab lewat `handler`. */
export function fakeServer(initial: Handler = () => ({ status: 200, body: {} })) {
  const calls: Call[] = [];
  let handler = initial;
  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(call);
    const reply = handler(call);
    if (reply === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(
      new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
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
