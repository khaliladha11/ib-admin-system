import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import { SearchX } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { RootLayout } from '@/layout/root-layout';
import { AnimalProfilePage } from '@/pages/animal-profile';
import { AnimalsPage } from '@/pages/animals';
import { DevComponentsPage } from '@/pages/dev-components';
import { HomePage } from '@/pages/home';
import { MorePage } from '@/pages/more';
import { ScanPage } from '@/pages/placeholders';
import { RecordEventPage } from '@/pages/record-event';
import { RequestFormPage } from '@/pages/request-form';
import { TasksPage } from '@/pages/tasks';

const rootRoute = createRootRoute({
  component: RootLayout,
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
  staticData: { title: 'Hari ini' },
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
  validateSearch: (s: Record<string, unknown>): { tersimpan?: string } => ({
    tersimpan: str(s.tersimpan),
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
const devRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/komponen',
  component: DevComponentsPage,
  staticData: { title: 'Komponen' },
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  animalsRoute,
  animalRoute,
  recordRoute,
  scanRoute,
  tasksRoute,
  requestRoute,
  moreRoute,
  devRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: 'intent' });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
