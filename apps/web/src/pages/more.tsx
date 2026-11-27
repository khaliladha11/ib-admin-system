// Lainnya: akun, status sinkron + data ditolak, PIN, kontras tinggi, keluar.
import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  Code2,
  KeyRound,
  MessageSquareHeart,
  LogOut,
  RefreshCw,
  SwatchBook,
  ListChecks,
  Printer,
  Server,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { ListSkeleton } from '@/components/skeletons';
import { ROLE_LABEL } from '@/components/request-status';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { clearPin, signOut, useDataLayer, useHasPin, useSession, useSyncStatus } from '@/data';
import { useContrastMode } from '@/design/contrast-mode';
import { isAdminRole } from '@/layout/nav-items';
import { APP_VERSION, LICENSE_NAME, SOURCE_URL } from '@/lib/app-info';
import { formatDateTime } from '@/lib/format';

import { PinSetupForm } from './auth/pin-pages';
import { ContrastToggle } from './placeholders';

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

  if (!session || !status) return <ListSkeleton rows={3} label="Memuat…" />;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Akun">
        <p className="flex items-center gap-3">
          <UserRound aria-hidden="true" className="size-8 shrink-0 text-primary" />
          <span>
            <span className="block font-bold">{session.user.name}</span>
            <span className="block text-muted-foreground">{ROLE_LABEL[session.user.role]}</span>
          </span>
        </p>
      </Panel>

      <Panel title="Pengiriman data">
        <p>
          {status.lastSyncAt
            ? `Terakhir dikirim dan diperbarui ${formatDateTime(status.lastSyncAt)}.`
            : 'Catatan di HP ini belum pernah dikirim.'}{' '}
          {status.pending > 0
            ? `${String(status.pending)} catatan menunggu dikirim.`
            : 'Semua catatan sudah terkirim.'}
        </p>
        {status.lastError && (
          <p className="text-soil">
            Pengiriman terakhir belum berhasil. Akan dicoba lagi otomatis saat ada sinyal.
          </p>
        )}
        <Button
          variant="outline"
          disabled={syncing}
          onClick={() => {
            setSyncing(true);
            void sync
              .syncNow({ force: true })
              .catch(() => undefined)
              .finally(() => {
                setSyncing(false);
              });
          }}
        >
          <RefreshCw aria-hidden="true" className={syncing ? 'animate-spin' : undefined} />
          {syncing ? 'Mengirim…' : 'Kirim dan perbarui sekarang'}
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link to="/data-belum-terkirim">
            <ListChecks aria-hidden="true" />
            Data belum terkirim
            {status.pending + status.reviews + status.rejected.length > 0
              ? ` (${String(status.pending + status.reviews + status.rejected.length)})`
              : ''}
          </Link>
        </Button>
      </Panel>

      <Panel title="PIN HP ini">
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
      </Panel>

      {isAdminRole(session.user.role) && (
        <Panel title="Data wilayah">
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
            <Button asChild variant="outline" className="justify-start">
              <Link to="/pos">
                <Server aria-hidden="true" />
                Pos IB: alamat, cadangan, ekspor
              </Link>
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Label QR">
        <p className="text-muted-foreground">
          Cetak label QR untuk ternak, atau label kosong untuk sapi yang belum didaftarkan.
        </p>
        <Button asChild variant="outline" className="justify-start self-start">
          <Link to="/label">
            <Printer aria-hidden="true" />
            Cetak label QR
          </Link>
        </Button>
      </Panel>

      <Panel title="Uji coba">
        <p className="text-muted-foreground">
          Ceritakan apa yang sulit atau membingungkan. Masukan terkirim ke admin saat ada sinyal.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="justify-start">
            <Link to="/masukan">
              <MessageSquareHeart aria-hidden="true" />
              Beri masukan
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/pemakaian">
              <BarChart3 aria-hidden="true" />
              Catatan pemakaian (hanya di HP ini)
            </Link>
          </Button>
        </div>
      </Panel>

      <ContrastToggle mode={mode} onChange={setMode} />

      <Panel title="Keluar">
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
      </Panel>

      <Panel title="Tentang aplikasi">
        <p>
          IB Ternak versi {APP_VERSION}. Perangkat lunak bebas dengan lisensi {LICENSE_NAME}: boleh
          dipakai, dipelajari, dan diubah; perubahan yang dijalankan untuk orang lain wajib
          dibagikan.
        </p>
        <Button asChild variant="outline" className="justify-start self-start">
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            <Code2 aria-hidden="true" />
            Kode sumber
          </a>
        </Button>
      </Panel>

      <Button variant="ghost" asChild className="justify-start">
        <Link to="/dev/komponen">
          <SwatchBook aria-hidden="true" />
          Lihat semua komponen (untuk pengembang)
        </Link>
      </Button>
    </div>
  );
}
