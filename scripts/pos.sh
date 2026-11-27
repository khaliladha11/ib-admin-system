#!/usr/bin/env bash
# Perintah harian pos IB (jalankan dari folder pemasangan, mis. ~/ib-ternak):
#   ./scripts/pos.sh bantuan
set -euo pipefail
cd "$(dirname "$0")/.."

DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker"
compose() { $DOCKER compose "$@"; }
cli() { compose exec -T app node_modules/.bin/tsx src/ops/backup-cli.ts "$@"; }

case "${1:-bantuan}" in
  mulai) compose up -d ;;
  berhenti) compose stop ;;
  status) compose ps ;;
  log) compose logs --tail 100 -f app ;;
  alamat)
    # IP komputer berganti (mis. pindah Wi-Fi): perbarui alamat dan sertifikat.
    NEW="${2:-$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')}"
    [ -n "$NEW" ] || { echo "Tulis alamat IP: ./scripts/pos.sh alamat 192.168.1.10"; exit 1; }
    sed -i "s/^POS_HOST=.*/POS_HOST=$NEW/" .env
    compose up -d
    echo "Alamat baru: https://$NEW (sertifikat HP tidak perlu dipasang ulang)"
    ;;
  cadangkan) cli cadangkan ;;
  daftar-cadangan) cli daftar ;;
  pulihkan)
    [ -n "${2:-}" ] || { echo "Tulis nama file: ./scripts/pos.sh pulihkan ib-ternak-2026-11-27-020000.sqlite"; cli daftar; exit 1; }
    echo "Server dihentikan sebentar untuk memulihkan $2…"
    compose stop app
    compose run --rm --no-deps app node_modules/.bin/tsx src/ops/backup-cli.ts pulihkan "$2"
    compose start app
    echo "Selesai. Data kembali seperti saat cadangan $2 dibuat."
    ;;
  sertifikat)
    compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./ib-ternak-ca.crt
    echo "Sertifikat root disalin ke ./ib-ternak-ca.crt (kirim ke HP bila tidak bisa diunduh)."
    ;;
  perbarui)
    git pull --ff-only
    compose up -d --build
    ;;
  *)
    cat <<'HELP'
Perintah pos IB:
  mulai | berhenti | status | log
  alamat [IP]                 perbarui alamat bila IP komputer berganti
  cadangkan                   buat cadangan sekarang (otomatis setiap hari)
  daftar-cadangan             lihat cadangan di folder backups/
  pulihkan <nama-file>        kembalikan data dari cadangan
  sertifikat                  salin sertifikat root ke file ib-ternak-ca.crt
  perbarui                    ambil versi terbaru lalu bangun ulang (butuh internet)
HELP
    ;;
esac
