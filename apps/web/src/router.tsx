import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
} from '@tanstack/react-router';
import { SearchX } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { RootLayout } from '@/layout/root-layout';
import { RootError, RouteError } from '@/layout/route-error';
import type { RequestFilter } from '@/pages/admin/request-filter';
import { AnimalProfilePage } from '@/pages/animal-profile';
import { AnimalsPage } from '@/pages/animals';
import { HomePage } from '@/pages/home';
import { TasksPage } from '@/pages/tasks';

// Halaman admin dan pengembang dimuat saat dibuka (bundel awal HP lebih kecil).
const AdminRequestDetailPage = lazyRouteComponent(
  () => import('@/pages/admin/request-detail'),
  'AdminRequestDetailPage',
);
const AdminRequestsPage = lazyRouteComponent(
  () => import('@/pages/admin/requests'),
  'AdminRequestsPage',
);
const FarmerFormPage = lazyRouteComponent(() => import('@/pages/admin/farmers'), 'FarmerFormPage');
const FarmersPage = lazyRouteComponent(() => import('@/pages/admin/farmers'), 'FarmersPage');
const FollowUpsPage = lazyRouteComponent(() => import('@/pages/admin/follow-ups'), 'FollowUpsPage');
const UserFormPage = lazyRouteComponent(() => import('@/pages/admin/users'), 'UserFormPage');
const UsersPage = lazyRouteComponent(() => import('@/pages/admin/users'), 'UsersPage');
// Halaman yang lebih jarang dibuka (form, Lainnya) juga dimuat saat dibuka; semuanya ada di
// cache service worker sehingga tetap terbuka tanpa sinyal.
const MorePage = lazyRouteComponent(() => import('@/pages/more'), 'MorePage');
const RecordEventPage = lazyRouteComponent(() => import('@/pages/record-event'), 'RecordEventPage');
const RequestFormPage = lazyRouteComponent(() => import('@/pages/request-form'), 'RequestFormPage');
const SyncQueuePage = lazyRouteComponent(() => import('@/pages/sync-queue'), 'SyncQueuePage');
const ScanPage = lazyRouteComponent(() => import('@/pages/scan/scan-page'), 'ScanPage');
const AnimalNewPage = lazyRouteComponent(() => import('@/pages/animal-new'), 'AnimalNewPage');
const PosPage = lazyRouteComponent(() => import('@/pages/admin/pos'), 'PosPage');
const LabelsPage = lazyRouteComponent(() => import('@/pages/labels/labels-page'), 'LabelsPage');
const DevComponentsPage = lazyRouteComponent(
  () => import('@/pages/dev-components'),
  'DevComponentsPage',
);

const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: () => (
    <EmptyState icon={SearchX} title="Halaman tidak ditemukan">
      Alamat ini tidak ada. Pilih menu di bawah untuk melanjutkan.
    </EmptyState>
  ),
});

const EVENT_TYPES = ['BH', 'IB', 'PKB', 'KGG', 'LH', 'BB'] as const;
type FormType = (typeof EVENT_TYPES)[number];
const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  staticData: {},
});
const animalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ternak',
  component: AnimalsPage,
  staticData: { title: 'Ternak' },
});
const animalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ternak/$animalId',
  component: AnimalProfilePage,
  validateSearch: (s: Record<string, unknown>): { tersimpan?: string; scan?: '1' } => ({
    tersimpan: str(s.tersimpan),
    scan: s.scan === '1' || s.scan === 1 ? '1' : undefined,
  }),
  staticData: { title: 'Profil ternak', focus: true, backTo: '/ternak' },
});
const recordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ternak/$animalId/catat',
  component: RecordEventPage,
  validateSearch: (s: Record<string, unknown>): { jenis?: FormType; tugas?: string } => ({
    jenis: EVENT_TYPES.find((t) => t === s.jenis),
    tugas: str(s.tugas),
  }),
  staticData: { title: 'Catat kejadian', focus: true, backTo: '/ternak' },
});
const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scan',
  component: ScanPage,
  staticData: { title: 'Scan' },
});
const animalNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ternak/baru',
  component: AnimalNewPage,
  validateSearch: (
    s: Record<string, unknown>,
  ): { kode?: string; tag?: 'qr' | 'eartag'; kembali?: 'scan' } => ({
    kode: str(s.kode),
    tag: s.tag === 'qr' || s.tag === 'eartag' ? s.tag : undefined,
    kembali: s.kembali === 'scan' ? 'scan' : undefined,
  }),
  staticData: { title: 'Daftarkan sapi', focus: true, backTo: '/scan' },
});
const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tugas',
  component: TasksPage,
  staticData: { title: 'Tugas' },
});
const requestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tugas/ajukan',
  component: RequestFormPage,
  validateSearch: (s: Record<string, unknown>): { ternak?: string; jenis?: 'IB' | 'PKB' } => ({
    ternak: str(s.ternak),
    jenis: s.jenis === 'IB' || s.jenis === 'PKB' ? s.jenis : undefined,
  }),
  staticData: { title: 'Minta IB atau PKB', focus: true, backTo: '/tugas' },
});
const moreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lainnya',
  component: MorePage,
});
const posRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pos',
  component: PosPage,
  staticData: { title: 'Pos IB' },
});
const syncQueueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data-belum-terkirim',
  component: SyncQueuePage,
  staticData: { title: 'Data belum terkirim', focus: true, backTo: '/lainnya' },
});
const labelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/label',
  component: LabelsPage,
  validateSearch: (s: Record<string, unknown>): { ternak?: string } => ({ ternak: str(s.ternak) }),
  staticData: { title: 'Cetak label' },
});
const devRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/komponen',
  component: DevComponentsPage,
  staticData: { title: 'Komponen' },
});

const REQUEST_STATUSES = [
  'submitted',
  'assigned',
  'in_progress',
  'done',
  'rejected',
  'cancelled',
  'aktif',
] as const;

const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/permintaan',
  component: AdminRequestsPage,
  validateSearch: (s: Record<string, unknown>): RequestFilter => ({
    status: REQUEST_STATUSES.find((v) => v === s.status),
    jenis: s.jenis === 'IB' || s.jenis === 'PKB' ? s.jenis : undefined,
    desa: str(s.desa),
    q: str(s.q),
  }),
  staticData: { title: 'Permintaan' },
});
const requestDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/permintaan/$requestId',
  component: AdminRequestDetailPage,
  staticData: { title: 'Detail permintaan', focus: true, backTo: '/permintaan' },
});
const followUpsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tindak-lanjut',
  component: FollowUpsPage,
  staticData: { title: 'Tindak lanjut' },
});
const farmersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/peternak',
  component: FarmersPage,
  staticData: { title: 'Peternak' },
});
const farmerNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/peternak/baru',
  component: FarmerFormPage,
  staticData: { title: 'Tambah peternak', focus: true, backTo: '/peternak' },
});
const farmerEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/peternak/$farmerId',
  component: FarmerFormPage,
  staticData: { title: 'Ubah peternak', focus: true, backTo: '/peternak' },
});
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pengguna',
  component: UsersPage,
  staticData: { title: 'Pengguna' },
});
const userNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pengguna/baru',
  component: UserFormPage,
  validateSearch: (s: Record<string, unknown>): { peternak?: string } => ({
    peternak: str(s.peternak),
  }),
  staticData: { title: 'Tambah pengguna', focus: true, backTo: '/pengguna' },
});
const userEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pengguna/$userId',
  component: UserFormPage,
  staticData: { title: 'Ubah pengguna', focus: true, backTo: '/pengguna' },
});

const routeTree = rootRoute.addChildren([
  requestsRoute,
  requestDetailRoute,
  followUpsRoute,
  farmersRoute,
  farmerNewRoute,
  farmerEditRoute,
  usersRoute,
  userNewRoute,
  userEditRoute,
  homeRoute,
  animalsRoute,
  animalRoute,
  recordRoute,
  scanRoute,
  animalNewRoute,
  tasksRoute,
  requestRoute,
  moreRoute,
  labelsRoute,
  syncQueueRoute,
  posRoute,
  devRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    defaultPreload: 'intent',
    // Error di halaman tampil di dalam kerangka (navigasi tetap ada).
    defaultErrorComponent: RouteError,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
