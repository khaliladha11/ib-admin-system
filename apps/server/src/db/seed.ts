// Data contoh FIKTIF untuk pengembangan: `pnpm db:seed` (tambahkan `--reset` untuk
// mengosongkan data lama). Semua nama, nomor HP, email, kode, dan lokasi dikarang.
//
// Isi: 1 dinas, 2 kelompok, 4 desa, 3 inseminator, 10 peternak, 40 sapi dengan
// riwayat event yang mencakup setiap status reproduksi dan pengingat (lihat SCENARIOS).
// Tanggal dihitung mundur dari waktu seed dijalankan, sehingga pengingat 3 dan 9 bulan
// selalu relevan. Dengan waktu yang sama, hasilnya selalu sama (PRNG ber-seed).
import {
  animalSchema,
  animalTagSchema,
  assignmentSchema,
  auditLogSchema,
  eventSchema,
  farmerSchema,
  locationSchema,
  semenStockSchema,
  SERVER_DEVICE_ID,
  serviceRequestSchema,
  userSchema,
  uuidv7,
  type Animal,
  type AnimalEvent,
  type AnimalTag,
  type Assignment,
  type AuditLog,
  type EventBody,
  type ExitReason,
  type Farmer,
  type Location,
  type SemenStock,
  type ServiceRequest,
  type User,
} from '@ib/shared';
import { sql } from 'drizzle-orm';

import { countRows, createDb, type Db } from './client';
import { runMigrations } from './migrate';
import * as t from './schema';

const DAY = 86_400_000;

export interface SeedData {
  locations: Location[];
  users: User[];
  farmers: Farmer[];
  animals: Animal[];
  animalTags: AnimalTag[];
  semenStock: SemenStock[];
  serviceRequests: ServiceRequest[];
  events: AnimalEvent[];
  assignments: Assignment[];
  auditLogs: AuditLog[];
  /** Skenario per id sapi betina dewasa (untuk tes; tidak disimpan ke database). */
  scenarios: Record<string, Scenario>;
}

/** Skenario riwayat sapi betina, dipakai bergiliran. Nama = status yang diharapkan di 1.3. */
export const SCENARIOS = [
  'kosong',
  'birahi',
  'menunggu_pkb',
  'ib_terlambat', // IB > 3 bulan tanpa PKB → pengingat 3 bulan
  'bunting',
  'bunting_terlambat', // bunting > 9 bulan sejak PKB tanpa LH/KGG → pengingat 9 bulan
  'keguguran',
  'sudah_lahir',
  'ib_berulang', // IB gagal lalu IB ulang (S/C = 2)
  'keluar',
  'sakit',
  'koreksi', // event salah dibatalkan oleh event pengganti (voidsEventId)
] as const;
export type Scenario = (typeof SCENARIOS)[number];

const ADULT_FEMALES = 34;

const COW_NAMES = [
  'Melati',
  'Mawar',
  'Putri',
  'Bunga',
  'Cantik',
  'Manis',
  'Dewi',
  'Sari',
  'Ayu',
  'Lestari',
  'Indah',
  'Wangi',
  'Kenanga',
  'Seruni',
  'Kemuning',
  'Anggrek',
  'Cempaka',
  'Dahlia',
  'Asih',
  'Rara',
  'Lilis',
  'Ningsih',
  'Murni',
  'Ratna',
  'Sekar',
  'Laras',
  'Gendis',
  'Wulan',
  'Bening',
  'Cahaya',
  'Senja',
  'Pelangi',
  'Embun',
  'Mentari',
];
const BULL_NAMES = ['Bima', 'Gatot', 'Jaka'];
const BREEDS = ['Simental', 'Limousin', 'PO', 'Bali', 'Brahman'];
const QR_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** PRNG kecil (mulberry32) agar data contoh deterministik. */
function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick() dari daftar kosong');
      return item;
    },
    bytes: (n: number) => Uint8Array.from({ length: n }, () => Math.floor(next() * 256)),
  };
}

function at<T>(items: readonly T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error(`Indeks ${String(i)} di luar jangkauan`);
  return item;
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildSeedData(now: number = Date.now(), seed = 20_251_125): SeedData {
  const rng = createRng(seed);
  const newId = (time: number) => uuidv7(Math.max(0, Math.round(time)), rng.bytes);
  const base = (time: number, deviceId: string = SERVER_DEVICE_ID) => ({
    id: newId(time),
    createdAt: time,
    updatedAt: time,
    deletedAt: null,
    deviceId,
  });
  const ago = (days: number) => now - days * DAY + rng.int(6, 16) * 3_600_000;
  const setupTime = now - 420 * DAY;

  const data: SeedData = {
    locations: [],
    users: [],
    farmers: [],
    animals: [],
    animalTags: [],
    semenStock: [],
    serviceRequests: [],
    events: [],
    assignments: [],
    auditLogs: [],
    scenarios: {},
  };

  // --- Wilayah -----------------------------------------------------------
  const location = (
    level: Location['level'],
    name: string,
    code: string,
    parentId: string | null,
  ) => {
    const row: Location = { ...base(setupTime), parentId, level, name, code };
    data.locations.push(row);
    return row;
  };
  const agency = location('agency', 'Dinas Peternakan Kabupaten Contoh', 'DPK-01', null);
  const groups = [
    location('group', 'KTT Sumber Rejeki', 'KTT-01', agency.id),
    location('group', 'KTT Maju Bersama', 'KTT-02', agency.id),
  ];
  const villages = [
    location('village', 'Desa Sukamaju', 'DS-01', at(groups, 0).id),
    location('village', 'Desa Mekarsari', 'DS-02', at(groups, 0).id),
    location('village', 'Desa Cibening', 'DS-03', at(groups, 1).id),
    location('village', 'Desa Tanjungsari', 'DS-04', at(groups, 1).id),
  ];

  // --- Pengguna ----------------------------------------------------------
  const user = (
    name: string,
    role: User['role'],
    locationId: string,
    contact: { email?: string; phone?: string },
  ) => {
    const row: User = {
      ...base(setupTime),
      name,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      passwordHash: null, // diisi di langkah 1.4
      role,
      locationId,
      isActive: true,
    };
    data.users.push(row);
    return row;
  };
  user('Admin Dinas Contoh', 'agency_admin', agency.id, { email: 'admin.dinas@contoh.test' });
  const groupAdmins = [
    user('Hartono', 'group_admin', at(groups, 0).id, { email: 'admin.ktt01@contoh.test' }),
    user('Yuliana', 'group_admin', at(groups, 1).id, { email: 'admin.ktt02@contoh.test' }),
  ];
  const inseminators = [
    user('Andi Pratama', 'inseminator', agency.id, { phone: '081200000201' }),
    user('Rina Marlina', 'inseminator', agency.id, { phone: '081200000202' }),
    user('Yusuf Hakim', 'inseminator', agency.id, { phone: '081200000203' }),
  ];
  const deviceOf = (u: User) => `hp-${u.name.split(' ')[0]?.toLowerCase() ?? 'x'}`;

  // --- Stok straw (2 lot per inseminator) --------------------------------
  const lots = inseminators.flatMap((ins, i) =>
    [0, 1].map((j) => {
      const breed = at(
        ['Simental', 'Limousin', 'PO', 'Brahman', 'Simental', 'Limousin'],
        i * 2 + j,
      );
      const code = breed.slice(0, 3).toUpperCase();
      const row: SemenStock = {
        ...base(now - 400 * DAY, deviceOf(ins)),
        holderId: ins.id,
        strawCode: `${code}-2025-${String(100 + i * 10 + j)}`,
        bullId: `BULL-${code}-${String(i * 2 + j + 1).padStart(2, '0')}`,
        bullName: at(['Jago', 'Perkasa', 'Gagah', 'Satria', 'Wira', 'Kresna'], i * 2 + j),
        breed,
        batch: `B2025-${String(i * 2 + j + 1).padStart(2, '0')}`,
        quantityReceived: 50,
        receivedAt: isoDate(now - 400 * DAY),
      };
      data.semenStock.push(row);
      return row;
    }),
  );

  // --- Peternak (5 per kelompok) -----------------------------------------
  const farmerNames = [
    'Suparman',
    'Sri Wahyuni',
    'Bambang Setiawan',
    'Siti Aminah',
    'Joko Susilo',
    'Ratna Dewi',
    'Agus Salim',
    'Nur Hidayah',
    'Hendra Gunawan',
    'Wati Kurniasih',
  ];
  const farmers = farmerNames.map((name, i) => {
    const village = at(villages, Math.floor(i / 5) * 2 + (i % 2));
    const phone = `0812000001${String(i).padStart(2, '0')}`;
    // Tiga peternak punya akun login sendiri.
    const account = [0, 3, 6].includes(i) ? user(name, 'farmer', village.id, { phone }) : null;
    const row: Farmer = {
      ...base(setupTime),
      userId: account?.id ?? null,
      locationId: village.id,
      name,
      phone,
      address: `RT 0${String((i % 5) + 1)} RW 02, ${village.name}`,
      isikhnasOwnerId: i % 3 === 0 ? `OWN-${String(5000 + i)}` : null,
    };
    data.farmers.push(row);
    return { row, account, groupIndex: Math.floor(i / 5) };
  });

  // --- Ternak, tag, event ------------------------------------------------
  let tagSerial = 0;
  const usedQr = new Set<string>();
  const qrCode = () => {
    for (;;) {
      const code = `IB-${Array.from({ length: 5 }, () => QR_ALPHABET.charAt(rng.int(0, QR_ALPHABET.length - 1))).join('')}`;
      if (!usedQr.has(code)) {
        usedQr.add(code);
        return code;
      }
    }
  };
  const tag = (animal: Animal, type: AnimalTag['type'], code: string, attachedAt: number) => {
    const row: AnimalTag = {
      ...base(attachedAt),
      animalId: animal.id,
      type,
      code,
      attachedAt,
      removedAt: null,
      removalReason: null,
    };
    data.animalTags.push(row);
    return row;
  };

  const animal = (fields: Omit<Animal, keyof ReturnType<typeof base>>, createdAt: number) => {
    const row: Animal = { ...base(createdAt), ...fields };
    data.animals.push(row);
    return row;
  };

  const event = (
    cow: Animal,
    body: EventBody,
    occurredAt: number,
    recorder: User,
    extra: Partial<Pick<AnimalEvent, 'semenStockId' | 'voidsEventId'>> = {},
  ) => {
    const recordedAt = Math.min(now, occurredAt + rng.int(1, 6) * 3_600_000);
    const row = {
      ...base(recordedAt, deviceOf(recorder)),
      animalId: cow.id,
      occurredAt,
      recordedBy: recorder.id,
      serviceRequestId: null,
      semenStockId: extra.semenStockId ?? null,
      voidsEventId: extra.voidsEventId ?? null,
      ...body,
    } as AnimalEvent;
    data.events.push(row);
    return row;
  };

  interface CowRefs {
    cow: Animal;
    scenario: Scenario;
    farmer: (typeof farmers)[number];
    lastIb?: AnimalEvent;
    lastPkb?: AnimalEvent;
  }
  const cows: CowRefs[] = [];

  for (let i = 0; i < ADULT_FEMALES; i++) {
    const scenario = at(SCENARIOS, i % SCENARIOS.length);
    const farmer = at(farmers, i % farmers.length);
    const ins = at(inseminators, farmer.groupIndex); // inseminator utama kelompok
    const lot = at(lots, farmer.groupIndex * 2 + (i % 2));
    const reporter = farmer.account ?? ins; // peternak tanpa akun dicatat petugas
    const createdAt = now - rng.int(380, 410) * DAY;
    const cow = animal(
      {
        farmerId: farmer.row.id,
        damId: null,
        name: at(COW_NAMES, i),
        sex: 'F',
        breed: rng.pick(BREEDS),
        birthDate: isoDate(now - rng.int(3, 8) * 365 * DAY),
        sireCode: null,
        isikhnasAnimalId: i % 4 === 0 ? `ANM-${String(70_000 + i)}` : null,
      },
      createdAt,
    );
    tag(cow, 'qr', qrCode(), createdAt);
    if (i % 2 === 0)
      tag(cow, 'eartag', `ID-3201-${String(++tagSerial).padStart(6, '0')}`, createdAt);

    const refs: CowRefs = { cow, scenario, farmer };
    const ib = (days: number) => {
      refs.lastIb = event(
        cow,
        {
          type: 'IB',
          payload: {
            strawCode: lot.strawCode,
            bullId: lot.bullId,
            bullName: lot.bullName ?? undefined,
            breed: lot.breed ?? undefined,
            batch: lot.batch,
          },
        },
        ago(days),
        ins,
        { semenStockId: lot.id },
      );
    };
    const bh = (days: number) =>
      event(
        cow,
        { type: 'BH', payload: { signs: ['lendir_bening', 'gelisah'] } },
        ago(days),
        reporter,
      );
    const pkb = (days: number, pregnant: boolean, months = 3) => {
      refs.lastPkb = event(
        cow,
        {
          type: 'PKB',
          payload: pregnant
            ? { result: 'pregnant', fetalAgeMonths: months, method: 'palpation' }
            : { result: 'not_pregnant', method: 'palpation' },
        },
        ago(days),
        ins,
      );
    };
    const bb = (days: number, weightKg: number) =>
      event(cow, { type: 'BB', payload: { weightKg, method: 'tape' } }, ago(days), ins);

    const j = rng.int(0, 4); // variasi beberapa hari antar sapi
    switch (scenario) {
      case 'kosong':
        bb(30 + j, rng.int(280, 360));
        break;
      case 'birahi':
        bh(1 + (j % 2)); // masih dalam ESTRUS_ACTIVE_DAYS
        break;
      case 'menunggu_pkb':
        bh(41 + j);
        ib(40 + j);
        break;
      case 'ib_terlambat':
        bh(111 + j);
        ib(110 + j);
        break;
      case 'bunting':
        bh(151 + j);
        ib(150 + j);
        pkb(90 + j, true, 2);
        break;
      case 'bunting_terlambat':
        ib(370 + j);
        pkb(285 + j, true, 3);
        break;
      case 'keguguran':
        ib(200 + j);
        pkb(140 + j, true, 2);
        event(
          cow,
          { type: 'KGG', payload: { trimester: 2, notes: 'Janin keluar, induk sehat' } },
          ago(60 + j),
          reporter,
        );
        break;
      case 'sudah_lahir': {
        ib(330 + j);
        pkb(250 + j, true, 3);
        const bornAt = ago(45 + j);
        const calfSex = rng.next() < 0.5 ? 'F' : 'M';
        const calf = animal(
          {
            farmerId: farmer.row.id,
            damId: cow.id,
            name: null,
            sex: calfSex,
            breed: lot.breed,
            birthDate: isoDate(bornAt),
            sireCode: lot.bullId,
            isikhnasAnimalId: null,
          },
          bornAt + 3_600_000,
        );
        tag(calf, 'qr', qrCode(), bornAt + 3_600_000);
        event(
          cow,
          {
            type: 'LH',
            payload: {
              calves: [
                {
                  sex: calfSex,
                  condition: 'alive',
                  calfAnimalId: calf.id,
                  weightKg: rng.int(24, 32),
                },
              ],
            },
          },
          bornAt,
          reporter,
        );
        event(
          calf,
          { type: 'BB', payload: { weightKg: rng.int(55, 70), method: 'tape' } },
          ago(5),
          ins,
        );
        break;
      }
      case 'ib_berulang':
        ib(160 + j);
        pkb(100 + j, false);
        bh(80 + j);
        ib(79 + j);
        pkb(10 + j, true, 2);
        break;
      case 'keluar': {
        bb(60 + j, rng.int(300, 380));
        const reason: ExitReason = i % 2 === 0 ? 'sold' : 'died';
        event(
          cow,
          {
            type: 'EXIT',
            payload:
              reason === 'sold'
                ? { reason, notes: 'Dijual ke pedagang desa sebelah' }
                : { reason, notes: 'Mati mendadak' },
          },
          ago(20 + j),
          reporter,
        );
        break;
      }
      case 'sakit':
        event(
          cow,
          {
            type: 'HEALTH',
            payload: {
              condition: 'Mastitis ringan',
              treatment: 'Antibiotik intramammary',
              medicine: 'Contoh-Mast',
            },
          },
          ago(10 + j),
          ins,
        );
        bb(9 + j, rng.int(270, 330));
        break;
      case 'koreksi': {
        // Salah ketik 34 kg, diperbaiki menjadi 340 kg tanpa menimpa event lama.
        const wrong = bb(15 + j, 34);
        event(
          cow,
          { type: 'BB', payload: { weightKg: 340, method: 'tape', notes: 'Koreksi salah ketik' } },
          wrong.occurredAt,
          ins,
          { voidsEventId: wrong.id },
        );
        break;
      }
    }
    data.scenarios[cow.id] = scenario;
    cows.push(refs);
  }

  // Sapi jantan: 1 pejantan dewasa + 2 muda.
  BULL_NAMES.forEach((name, k) => {
    const farmer = at(farmers, k * 3 + 1);
    const createdAt = now - 300 * DAY;
    const bull = animal(
      {
        farmerId: farmer.row.id,
        damId: null,
        name,
        sex: 'M',
        breed: k === 0 ? 'PO' : 'Simental',
        birthDate: isoDate(now - (k === 0 ? 5 : 1) * 365 * DAY),
        sireCode: null,
        isikhnasAnimalId: null,
      },
      createdAt,
    );
    tag(bull, 'qr', qrCode(), createdAt);
    event(
      bull,
      { type: 'BB', payload: { weightKg: k === 0 ? 520 : rng.int(180, 240), method: 'scale' } },
      ago(14),
      at(inseminators, 0),
    );
  });

  // Dua tag QR pernah hilang dan diganti.
  for (const refs of [at(cows, 4), at(cows, 17)]) {
    const old = data.animalTags.find((x) => x.animalId === refs.cow.id && x.type === 'qr');
    if (!old) continue;
    const removedAt = now - 60 * DAY;
    Object.assign(old, { removedAt, removalReason: 'lost', updatedAt: removedAt });
    tag(refs.cow, 'qr', qrCode(), removedAt);
  }

  // --- Permintaan layanan & penugasan ------------------------------------
  const byScenario = (s: Scenario) => cows.filter((c) => c.scenario === s);
  const groupAdmin = (c: CowRefs) => at(groupAdmins, c.farmer.groupIndex);
  const request = (
    c: CowRefs,
    type: ServiceRequest['type'],
    status: ServiceRequest['status'],
    createdAt: number,
    extra: Partial<ServiceRequest> = {},
  ) => {
    const requester = c.farmer.account ?? groupAdmin(c);
    const row: ServiceRequest = {
      ...base(createdAt, deviceOf(requester)),
      farmerId: c.farmer.row.id,
      animalId: c.cow.id,
      type,
      status,
      requestedBy: requester.id,
      preferredDate: isoDate(createdAt + DAY),
      notes: null,
      rejectionReason: null,
      resultEventId: null,
      ...extra,
    };
    data.serviceRequests.push(row);
    return row;
  };
  const assign = (
    req: ServiceRequest,
    ins: User,
    by: User,
    assignedAt: number,
    extra: Partial<Assignment> = {},
  ) => {
    const row: Assignment = {
      ...base(assignedAt, deviceOf(by)),
      serviceRequestId: req.id,
      inseminatorId: ins.id,
      assignedBy: by.id,
      assignedAt,
      acceptedAt: null,
      endedAt: null,
      endReason: null,
      ...extra,
    };
    data.assignments.push(row);
    return row;
  };
  const linkResult = (req: ServiceRequest, ev: AnimalEvent | undefined) => {
    if (!ev) throw new Error('Event hasil tidak ditemukan untuk permintaan contoh');
    req.resultEventId = ev.id;
    ev.serviceRequestId = req.id;
  };

  const [birahi1, birahi2, birahi3] = byScenario('birahi');
  if (!birahi1 || !birahi2 || !birahi3) throw new Error('Skenario birahi kurang');
  request(birahi1, 'IB', 'submitted', now - 3 * 3_600_000, { notes: 'Birahi sejak tadi pagi' });

  const r2 = request(birahi2, 'IB', 'assigned', now - 20 * 3_600_000);
  assign(
    r2,
    at(inseminators, birahi2.farmer.groupIndex),
    groupAdmin(birahi2),
    now - 18 * 3_600_000,
  );

  const r3 = request(birahi3, 'IB', 'in_progress', now - 26 * 3_600_000);
  assign(
    r3,
    at(inseminators, birahi3.farmer.groupIndex),
    groupAdmin(birahi3),
    now - 25 * 3_600_000,
    {
      acceptedAt: now - 24 * 3_600_000,
    },
  );

  const waiting = at(byScenario('menunggu_pkb'), 0);
  if (!waiting.lastIb) throw new Error('IB contoh tidak ada');
  const r4 = request(waiting, 'IB', 'done', waiting.lastIb.occurredAt - DAY);
  assign(
    r4,
    at(inseminators, waiting.farmer.groupIndex),
    groupAdmin(waiting),
    waiting.lastIb.occurredAt - 20 * 3_600_000,
    {
      acceptedAt: waiting.lastIb.occurredAt - 18 * 3_600_000,
      endedAt: waiting.lastIb.occurredAt,
      endReason: 'completed',
    },
  );
  linkResult(r4, waiting.lastIb);

  const empty = at(byScenario('kosong'), 1);
  request(empty, 'IB', 'rejected', now - 12 * DAY, {
    rejectionReason: 'Sapi belum menunjukkan tanda birahi. Ajukan lagi saat birahi terlihat.',
    updatedAt: now - 11 * DAY,
  });

  // PKB yang sempat ganti petugas: penugasan lama ditutup, bukan ditimpa.
  const pregnant = at(byScenario('bunting'), 0);
  if (!pregnant.lastPkb) throw new Error('PKB contoh tidak ada');
  const pkbAt = pregnant.lastPkb.occurredAt;
  const r6 = request(pregnant, 'PKB', 'done', pkbAt - 3 * DAY);
  assign(
    r6,
    at(inseminators, pregnant.farmer.groupIndex),
    groupAdmin(pregnant),
    pkbAt - 3 * DAY + 3_600_000,
    {
      endedAt: pkbAt - 2 * DAY,
      endReason: 'reassigned',
    },
  );
  assign(r6, at(inseminators, 2), groupAdmin(pregnant), pkbAt - 2 * DAY, {
    acceptedAt: pkbAt - 2 * DAY + 3_600_000,
    endedAt: pkbAt,
    endReason: 'completed',
  });
  linkResult(r6, pregnant.lastPkb);

  // --- Audit log ---------------------------------------------------------
  const someFarmer = at(farmers, 2).row;
  const audit = (
    fields: Omit<AuditLog, keyof ReturnType<typeof base>>,
    time: number,
    deviceId?: string,
  ) => data.auditLogs.push({ ...base(time, deviceId), ...fields });
  audit(
    {
      actorId: at(groupAdmins, 0).id,
      tableName: 'farmers',
      rowId: someFarmer.id,
      action: 'insert',
      before: null,
      after: { name: someFarmer.name },
    },
    setupTime,
  );
  audit(
    {
      actorId: at(groupAdmins, 0).id,
      tableName: 'farmers',
      rowId: someFarmer.id,
      action: 'update',
      before: { phone: '081299999999' },
      after: { phone: someFarmer.phone },
    },
    now - 30 * DAY,
  );
  const renamed = at(cows, 6).cow;
  audit(
    {
      actorId: at(inseminators, 0).id,
      tableName: 'animals',
      rowId: renamed.id,
      action: 'conflict',
      before: { name: `${renamed.name ?? ''} Kecil` },
      after: { name: renamed.name },
    },
    now - 7 * DAY,
    deviceOf(at(inseminators, 0)),
  );

  return data;
}

/** Validasi semua baris dengan skema Zod dari @ib/shared, lalu simpan dalam satu transaksi. */
export function insertSeedData(db: Db, data: SeedData) {
  const parsed = {
    locations: data.locations.map((r) => locationSchema.parse(r)),
    users: data.users.map((r) => userSchema.parse(r)),
    farmers: data.farmers.map((r) => farmerSchema.parse(r)),
    animals: data.animals.map((r) => animalSchema.parse(r)),
    animalTags: data.animalTags.map((r) => animalTagSchema.parse(r)),
    semenStock: data.semenStock.map((r) => semenStockSchema.parse(r)),
    serviceRequests: data.serviceRequests.map((r) => serviceRequestSchema.parse(r)),
    events: data.events.map((r) => eventSchema.parse(r)),
    assignments: data.assignments.map((r) => assignmentSchema.parse(r)),
    auditLogs: data.auditLogs.map((r) => auditLogSchema.parse(r)),
  };

  db.transaction((tx) => {
    // events ↔ service_requests saling merujuk; FK diperiksa saat commit.
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    tx.insert(t.locations).values(parsed.locations).run();
    tx.insert(t.users).values(parsed.users).run();
    tx.insert(t.farmers).values(parsed.farmers).run();
    tx.insert(t.animals).values(parsed.animals).run();
    tx.insert(t.animalTags).values(parsed.animalTags).run();
    tx.insert(t.semenStock).values(parsed.semenStock).run();
    tx.insert(t.serviceRequests).values(parsed.serviceRequests).run();
    tx.insert(t.events).values(parsed.events).run();
    tx.insert(t.assignments).values(parsed.assignments).run();
    tx.insert(t.auditLogs).values(parsed.auditLogs).run();
  });
}

export function clearAllData(db: Db) {
  db.transaction((tx) => {
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    for (const table of t.allTables) tx.delete(table).run();
  });
}

// Dijalankan langsung: `pnpm db:seed` atau `pnpm db:seed --reset`
if (import.meta.filename === process.argv[1]) {
  const reset = process.argv.includes('--reset');
  const { db, sqlite } = createDb();
  runMigrations(db);

  const existing = countRows(db, t.users);
  if (existing > 0 && !reset) {
    console.error(
      `Database sudah berisi data (${String(existing)} pengguna). ` +
        'Jalankan `pnpm db:seed --reset` untuk menghapus data lama dan mengisi ulang.',
    );
    sqlite.close();
    process.exit(1);
  }
  if (reset) clearAllData(db);

  const data = buildSeedData();
  insertSeedData(db, data);

  const eventsByType = data.events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Data contoh tersimpan di ${sqlite.name}`);
  console.table(
    Object.fromEntries(
      Object.entries(data)
        .filter(([k]) => k !== 'scenarios')
        .map(([k, v]) => [k, (v as unknown[]).length]),
    ),
  );
  console.log('Event per jenis:', eventsByType);
  sqlite.close();
}
