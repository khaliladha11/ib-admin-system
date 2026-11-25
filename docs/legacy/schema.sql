-- =====================================================================
-- Rekonstruksi skema database IB Admin System versi skripsi (V3.1)
-- =====================================================================
-- BUKAN dump asli. Skema ini disusun ulang dari query SQL di
-- legacy/backend (tag git v3.1-legacy), karena repo tidak menyertakan
-- skema maupun migrasi. Dialek: PostgreSQL.
--
-- Legenda komentar:
--   [pasti]  kolom muncul di query (SELECT/INSERT/UPDATE/WHERE)
--   [dugaan] tipe, nullable, default, atau FK disimpulkan dari pemakaian
--   [frontend] hanya dirujuk di legacy/frontend, tidak pernah ditulis backend
--
-- Legacy tidak memakai CHECK constraint untuk status; nilai yang
-- ditemukan di kode dicantumkan sebagai komentar saja.
-- Penjelasan lengkap: docs/legacy/DOMAIN.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- users: akun login (admin dinas, petugas inseminator, peternak)
-- Sumber: controllers/authController.js, requestController.getAllPetugas
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,               -- [pasti]
    name        VARCHAR(255) NOT NULL,            -- [pasti] tipe [dugaan]
    email       VARCHAR(255) NOT NULL UNIQUE,     -- [pasti] UNIQUE [dugaan]: dicek manual di register
    password    VARCHAR(255) NOT NULL,            -- [pasti] hash bcrypt (60 karakter)
    role        VARCHAR(50)  NOT NULL,            -- [pasti] nilai: 'admin' | 'petugas' | (peternak, [dugaan])
    latitude    DOUBLE PRECISION,                 -- [pasti] tipe [dugaan]
    longitude   DOUBLE PRECISION                  -- [pasti] tipe [dugaan]
);

-- ---------------------------------------------------------------------
-- requests: satu permintaan layanan IB beserta seluruh hasil lanjutannya
-- Sumber: controllers/requestController.js, routes/requestRoutes.js
-- ---------------------------------------------------------------------
CREATE TABLE requests (
    id                          SERIAL PRIMARY KEY,                 -- [pasti]
    user_id                     INTEGER REFERENCES users(id),       -- [pasti] FK [dugaan]: peternak pemohon
    nama_peternak               VARCHAR(255),                       -- [pasti] disalin sebagai teks saat dibuat
    jenis_ib                    VARCHAR(100),                       -- [pasti] isi bebas dari klien
    jumlah_ternak               INTEGER,                            -- [pasti] tipe [dugaan]
    latitude                    DOUBLE PRECISION,                   -- [pasti] tipe [dugaan]
    longitude                   DOUBLE PRECISION,                   -- [pasti] tipe [dugaan]
    tanggal                     TIMESTAMP NOT NULL DEFAULT NOW(),   -- [pasti] diisi NOW() saat dibuat

    -- Status alur kerja + hasil biologis bercampur dalam satu kolom:
    -- 'Menunggu Verifikasi' | 'Diproses' | 'Ditolak' | 'Berhasil' | 'Gagal' | 'Selesai'
    status                      VARCHAR(50) NOT NULL,               -- [pasti]

    petugas_id                  INTEGER REFERENCES users(id),       -- [pasti] FK [dugaan]: petugas IB awal
    verifikasi_at               TIMESTAMP,                          -- [pasti] diisi saat verify & ganti petugas
    proses_at                   TIMESTAMP,                          -- [pasti] diisi saat proses DAN ditimpa saat laporan

    -- Laporan IB oleh petugas
    laporan_terisi              BOOLEAN NOT NULL DEFAULT FALSE,     -- [pasti] default [dugaan]
    laporan_ib_text             TEXT,                               -- [pasti] ditulis petugas, lalu DITIMPA peternak
    deadline_laporan_ib         TIMESTAMP,                          -- [pasti] = waktu laporan petugas + 3 bulan

    -- Laporan hasil IB oleh peternak: 'Berhasil' | 'Gagal'
    laporan_ib_status           VARCHAR(20),                        -- [pasti]

    -- Laporan lanjutan dari peternak
    laporan_peternak_text       TEXT,                               -- [pasti] laporan kebuntingan
    laporan_peternak_keguguran  TEXT,                               -- [pasti]
    laporan_peternak_kelahiran  TEXT,                               -- [pasti]
    laporan_peternak_kematian   TEXT,                               -- [pasti] kematian anak sapi
    laporan_kematian_at         TIMESTAMP,                          -- [pasti]

    -- Pengingat ("jemput bola")
    deadline_kelahiran          TIMESTAMP,                          -- [pasti] dibaca, TIDAK PERNAH diisi di kode
    flag_laporan_ib             BOOLEAN NOT NULL DEFAULT FALSE,     -- [pasti] default [dugaan]
    flag_laporan_kelahiran      BOOLEAN NOT NULL DEFAULT FALSE,     -- [pasti] default [dugaan]

    -- Hanya dirujuk frontend (dashboardAdmin.jsx); keberadaannya di DB tidak terbukti
    flag_laporan_kebuntingan    BOOLEAN DEFAULT FALSE,              -- [frontend] [dugaan]
    checkup_status              VARCHAR(50)                         -- [frontend] [dugaan]
);

-- ---------------------------------------------------------------------
-- checkups: pemeriksaan lanjutan (kebuntingan, kelahiran) per permintaan
-- Sumber: controllers/checkupController.js, requestController.js
-- ---------------------------------------------------------------------
CREATE TABLE checkups (
    id              SERIAL PRIMARY KEY,                     -- [pasti]
    request_id      INTEGER NOT NULL REFERENCES requests(id), -- [pasti] FK [dugaan]
    petugas_id      INTEGER REFERENCES users(id),           -- [pasti] NULL saat 'Menunggu Penugasan'

    -- Dua kolom untuk konsep yang sama (lihat DOMAIN.md, masalah B3):
    jenis           VARCHAR(100),                           -- [pasti] hanya ditulis POST /api/checkups/assign
    tipe            VARCHAR(100),                           -- [pasti] 'Checkup Kebuntingan' | 'Checkup Kelahiran'

    -- 'Menunggu Penugasan' | 'Belum Dikonfirmasi' | 'Dikonfirmasi' | 'Selesai'
    status          VARCHAR(50) NOT NULL,                   -- [pasti]

    laporan         TEXT,                                   -- [pasti] catatan peternak, lalu DITIMPA laporan petugas
    tanggal         TIMESTAMP,                              -- [pasti] diisi saat ditugaskan admin
    created_at      TIMESTAMP DEFAULT NOW(),                -- [pasti] default [dugaan]: sebagian INSERT tidak mengisinya
    konfirmasi_at   TIMESTAMP,                              -- [pasti]
    laporan_at      TIMESTAMP                               -- [pasti]
);

-- ---------------------------------------------------------------------
-- activity_logs: riwayat teks bebas per permintaan
-- Sumber: hampir semua handler yang menulis
-- ---------------------------------------------------------------------
CREATE TABLE activity_logs (
    id          SERIAL PRIMARY KEY,                         -- [pasti] (log.id dipakai frontend sebagai key)
    request_id  INTEGER NOT NULL REFERENCES requests(id),   -- [pasti] FK [dugaan]
    deskripsi   TEXT NOT NULL,                              -- [pasti]
    waktu       TIMESTAMP NOT NULL DEFAULT NOW()            -- [pasti] selalu diisi NOW()
);
