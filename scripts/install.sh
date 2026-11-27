#!/usr/bin/env bash
# Pasang IB Ternak sebagai pos IB di Linux (Ubuntu/Debian, Raspberry Pi OS 64-bit).
# Satu baris (butuh internet sekali saat memasang):
#   curl -fsSL https://raw.githubusercontent.com/khaliladha11/ib-admin-system/main/scripts/install.sh | bash
#
# Pilihan lewat environment variable:
#   IB_DIR=~/ib-ternak   folder pemasangan
#   IB_HOST=192.168.1.10 alamat IP yang dibuka HP (bawaan: terdeteksi otomatis)
#   IB_DEMO=1            isi data contoh fiktif (untuk mencoba)
set -euo pipefail

REPO_URL="${IB_REPO_URL:-https://github.com/khaliladha11/ib-admin-system.git}"
BRANCH="${IB_BRANCH:-main}"
DIR="${IB_DIR:-$HOME/ib-ternak}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die() {
  printf '\033[1;31mGagal: %s\033[0m\n' "$*" >&2
  exit 1
}

# Pertanyaan tetap bisa dijawab walau skrip dijalankan lewat "curl | bash".
ask() {
  local prompt="$1" default="$2" answer=""
  if [ -r /dev/tty ]; then
    read -r -p "$prompt [$default]: " answer </dev/tty || true
  fi
  printf '%s' "${answer:-$default}"
}

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null || die "Jalankan sebagai root atau pasang sudo."
  SUDO="sudo"
fi

[ "$(uname -s)" = "Linux" ] || die "Skrip ini untuk Linux. Untuk Windows lihat docs/INSTALL.md."
case "$(uname -m)" in
  x86_64 | aarch64 | arm64) ;;
  *) die "Prosesor $(uname -m) belum didukung (perlu 64-bit: x86_64 atau arm64)." ;;
esac

say "1/5 Memeriksa Git dan Docker"
if ! command -v git >/dev/null; then
  $SUDO apt-get update -y && $SUDO apt-get install -y git
fi
if ! command -v docker >/dev/null; then
  warn "Docker belum ada; memasang dari get.docker.com (butuh internet)…"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
$SUDO systemctl enable --now docker >/dev/null 2>&1 || true
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="$SUDO docker"
  if [ -n "$SUDO" ]; then
    $SUDO usermod -aG docker "$USER" || true
    warn "Akun $USER ditambahkan ke grup docker (berlaku setelah keluar-masuk lagi)."
  fi
fi
$DOCKER compose version >/dev/null 2>&1 || die "Docker Compose v2 tidak ditemukan. Perbarui Docker."

say "2/5 Mengambil kode aplikasi ke $DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -q -B "$BRANCH" FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DIR"
fi
cd "$DIR"

say "3/5 Menyiapkan pengaturan (.env)"
detect_ip() {
  ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}
HOST_IP="${IB_HOST:-$(detect_ip)}"
[ -n "$HOST_IP" ] || HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$HOST_IP" ] || die "Alamat IP tidak terdeteksi. Jalankan lagi dengan IB_HOST=<alamat IP>."

if [ -f .env ] && grep -q '^POS_HOST=' .env; then
  warn ".env sudah ada; pengaturan lama dipakai (alamat: $(grep '^POS_HOST=' .env | cut -d= -f2))."
else
  HOST_IP="$(ask 'Alamat IP komputer ini untuk HP' "$HOST_IP")"
  REGION="$(ask 'Nama wilayah/pos' 'Pos IB')"
  EMAIL="$(ask 'Email akun admin' 'admin@pos-ib.lokal')"
  PASSWORD="$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 12 || true)"
  cat >.env <<ENV
# Dibuat oleh scripts/install.sh. Simpan baik-baik: berisi password admin awal.
POS_HOST=$HOST_IP
REGION_NAME=$REGION
ADMIN_NAME=Admin $REGION
ADMIN_EMAIL=$EMAIL
ADMIN_PASSWORD=$PASSWORD
DEMO_DATA=${IB_DEMO:-0}
BACKUP_KEEP=14
TZ=Asia/Jakarta
ENV
  chmod 600 .env
fi

say "4/5 Membangun dan menyalakan (pertama kali bisa 5–20 menit, terutama di Raspberry Pi)"
mkdir -p backups
# Server di dalam container berjalan sebagai pengguna 1000 dan menulis cadangan ke folder ini.
$SUDO chown 1000:1000 backups 2>/dev/null || true
$DOCKER compose up -d --build

say "5/5 Menunggu server siap"
for _ in $(seq 1 60); do
  if curl -fsk "https://127.0.0.1/api/health" >/dev/null 2>&1; then break; fi
  sleep 3
done
curl -fsk "https://127.0.0.1/api/health" >/dev/null 2>&1 || warn "Server belum menjawab; cek: ./scripts/pos.sh log"

POS_HOST="$(grep '^POS_HOST=' .env | cut -d= -f2)"
cat <<DONE

$(printf '\033[1;32m')IB Ternak terpasang.$(printf '\033[0m')

  1. Di setiap HP, pasang sertifikat (sekali saja):  http://$POS_HOST/sertifikat
     Langkahnya: docs/INSTALL.md bagian "Memasang sertifikat di HP Android".
  2. Buka aplikasi:                                   https://$POS_HOST
  3. Masuk sebagai admin:  $(grep '^ADMIN_EMAIL=' .env | cut -d= -f2)
     Password awal ada di file $DIR/.env (ADMIN_PASSWORD). Gantilah setelah masuk.

  Perintah lain:  cd $DIR && ./scripts/pos.sh bantuan
  Cadangan harian tersimpan di: $DIR/backups/
DONE
