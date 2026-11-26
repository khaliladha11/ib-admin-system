import { Outlet, useRouterState } from '@tanstack/react-router';

import { AppShell } from './app-shell';
import { AuthGate } from './auth-gate';

export function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const shell = (
    <AppShell>
      <Outlet />
    </AppShell>
  );
  // Halaman pengembang bisa dibuka tanpa masuk.
  return pathname.startsWith('/dev/') ? shell : <AuthGate>{shell}</AuthGate>;
}
