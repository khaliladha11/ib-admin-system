// Lainnya: akun, status sinkron + data ditolak, PIN, kontras tinggi, keluar.
import { Link } from '@tanstack/react-router';
import {
  KeyRound,
  LogOut,
  RefreshCw,
  SwatchBook,
  Trash2,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { ROLE_LABEL } from '@/components/request-status';
import { Button } from '@/components/ui/button';
import {
  clearPin,
  dismissRejected,
  signOut,
  useDataLayer,
  useHasPin,
  useSession,
  useSyncStatus,
} from '@/data';
import { useContrastMode } from '@/design/contrast-mode';
import { isAdminRole } from '@/layout/nav-items';
import { formatDateTime } from '@/lib/format';

import { PinSetupForm } from './auth/pin-pages';
import { ContrastToggle } from './placeholders';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border-(length:--bw) bg-card p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function MorePage() {
  const { db, api, sync } = useDataLayer();
  const session = useSession();
  const status = useSyncStatus();
  const hasPin = useHasPin();
  const [mode, setMode] = useContrastMode();
  const [settingPin, setSettingPin] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  if (!session || !status) return null;

  return (
    <div className="flex flex-col gap-4">
      <Section title="Akun">
        <p className="flex items-center gap-3">
          <UserRound aria-hidden="true" className="size-8 shrink-0 text-primary" />
          <span>
            <span className="block font-bold">{session.user.name}</span>
            <span className="block text-muted-foreground">{ROLE_LABEL[session.user.role]}</span>
          </span>
        </p>
      </Section>

      <Section title="Sinkron data">
        <p>
          {status.lastSyncAt
            ? `Terakhir tersinkron ${formatDateTime(status.lastSyncAt)}.`
            : 'Belum pernah tersinkron di HP ini.'}{' '}
          {status.pending > 0
            ? `${String(status.pending)} data menunggu dikirim.`
            : 'Semua data sudah terkirim.'}
        </p>
        {status.lastError && <p className="text-soil">Terakhir gagal: {status.lastError}</p>}
        <Button
          variant="outline"
          disabled={syncing}
          onClick={() => {
            setSyncing(true);
            void sync
              .syncNow()
              .catch(() => undefined)
              .finally(() => {
                setSyncing(false);
              });
          }}
        >
          <RefreshCw aria-hidden="true" className={syncing ? 'animate-spin' : undefined} />
          {syncing ? 'Menyinkronkan…' : 'Sinkron sekarang'}
        </Button>
        {status.rejected.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-alarm">Ditolak server ({status.rejected.length})</p>
            <p className="text-muted-foreground">
              Data ini tidak diterima server dan tidak akan dikirim lagi. Periksa pesannya, perbaiki
              datanya bila perlu, lalu hapus dari daftar.
            </p>
            <ul className="flex flex-col gap-2">
              {status.rejected.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-2 border-t-(length:--bw) pt-2"
                >
                  <span>
                    <span className="block font-semibold">{formatDateTime(entry.createdAt)}</span>
                    <span className="block">{entry.lastError}</span>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Hapus dari daftar"
                    onClick={() => void dismissRejected(db, entry.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="PIN HP ini">
        {settingPin ? (
          <PinSetupForm
            onDone={() => {
              setSettingPin(false);
              setPinMessage('PIN terpasang. Lain kali buka aplikasi cukup dengan PIN.');
            }}
            onSkip={() => {
              setSettingPin(false);
            }}
          />
        ) : (
          <>
            <p>
              {hasPin
                ? 'PIN terpasang. Aplikasi dibuka dengan PIN di HP ini.'
                : 'Pasang PIN agar aplikasi bisa dibuka tanpa password, juga saat tidak ada sinyal.'}
            </p>
            {pinMessage && (
              <p role="status" className="font-semibold text-primary">
                {pinMessage}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPinMessage(null);
                  setSettingPin(true);
                }}
              >
                <KeyRound aria-hidden="true" />
                {hasPin ? 'Ganti PIN' : 'Pasang PIN'}
              </Button>
              {hasPin && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    void clearPin(db).then(() => {
                      setPinMessage('PIN dihapus.');
                    });
                  }}
                >
                  Hapus PIN
                </Button>
              )}
            </div>
          </>
        )}
      </Section>

      {isAdminRole(session.user.role) && (
        <Section title="Data wilayah">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/peternak">
                <Users aria-hidden="true" />
                Peternak
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/pengguna">
                <UserCog aria-hidden="true" />
                Pengguna dan petugas
              </Link>
            </Button>
          </div>
        </Section>
      )}

      <ContrastToggle mode={mode} onChange={setMode} />

      <Section title="Keluar">
        {confirmOut ? (
          <>
            <p>
              {status.pending > 0
                ? `Masih ada ${String(status.pending)} data belum terkirim. Data tetap tersimpan di HP ini dan terkirim setelah Anda masuk lagi dengan akun yang sama.`
                : 'Anda perlu masuk lagi dengan password untuk memakai aplikasi.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={() => void signOut(db, api)}>
                <LogOut aria-hidden="true" />
                Ya, keluar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmOut(false);
                }}
              >
                Batal
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setConfirmOut(true);
            }}
          >
            <LogOut aria-hidden="true" />
            Keluar dari akun
          </Button>
        )}
      </Section>

      <Button variant="ghost" asChild className="justify-start">
        <Link to="/dev/komponen">
          <SwatchBook aria-hidden="true" />
          Lihat semua komponen (untuk pengembang)
        </Link>
      </Button>
    </div>
  );
}
