import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';

import { EmptyState } from '@/components/empty-state';
import { AppShell } from '@/layout/app-shell';
import { DevComponentsPage } from '@/pages/dev-components';
import { AnimalsPage, HomePage, MorePage, ScanPage, TasksPage } from '@/pages/placeholders';
import { SearchX } from 'lucide-react';

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: () => (
    <EmptyState icon={SearchX} title="Halaman tidak ditemukan">
      Alamat ini tidak ada. Pilih menu di bawah untuk melanjutkan.
    </EmptyState>
  ),
});

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const animalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ternak',
  component: AnimalsPage,
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
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  animalsRoute,
  scanRoute,
  tasksRoute,
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
