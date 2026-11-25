-- =====================================================================
-- Data contoh FIKTIF untuk menjalankan versi skripsi lewat docker compose.
-- Semua nama, email, dan lokasi dikarang. Dimuat setelah
-- docs/legacy/schema.sql saat volume database masih kosong.
--
-- Akun (password bcrypt, cost 10):
--   admin@ib.test     / admin123     (admin)
--   petugas1@ib.test  / petugas123   (petugas)
--   petugas2@ib.test  / petugas123   (petugas)
--   peternak1@ib.test / peternak123  (peternak; tidak ada UI di repo ini)
--   peternak2@ib.test / peternak123  (peternak; tidak ada UI di repo ini)
-- =====================================================================

INSERT INTO users (name, email, password, role, latitude, longitude) VALUES
  ('Admin Dinas Contoh', 'admin@ib.test',     '$2b$10$Gi/8AG1eXXvjqjXM1lmvoORSSq.G6P0ZumBx6v4J9O2u41/c7m2RC', 'admin',    -6.5950, 106.8167),
  ('Petugas Andi',       'petugas1@ib.test',  '$2b$10$IGmNaTL8WCOYdsuq5Eu3WOokOh27c8wrAPjDRomJtkfY7hNnZysLC', 'petugas',  -6.6010, 106.8050),
  ('Petugas Rina',       'petugas2@ib.test',  '$2b$10$IGmNaTL8WCOYdsuq5Eu3WOokOh27c8wrAPjDRomJtkfY7hNnZysLC', 'petugas',  -6.5800, 106.8300),
  ('Pak Darmo',          'peternak1@ib.test', '$2b$10$15eS.bahiZi.ulHXEnGqKe51PW/Q2Vb8O1rBcvOtrtPZ2eNeIao9q', 'peternak', -6.6120, 106.7900),
  ('Bu Sari',            'peternak2@ib.test', '$2b$10$15eS.bahiZi.ulHXEnGqKe51PW/Q2Vb8O1rBcvOtrtPZ2eNeIao9q', 'peternak', -6.5700, 106.8450);

-- ---------------------------------------------------------------------
-- 5 permintaan IB dengan status berbeda
-- ---------------------------------------------------------------------

-- 1) Menunggu Verifikasi: baru diajukan, admin bisa verifikasi/tolak
INSERT INTO requests (user_id, nama_peternak, jenis_ib, jumlah_ternak, latitude, longitude, tanggal, status)
SELECT id, name, 'IB Sapi Potong', 1, -6.6120, 106.7900, NOW() - INTERVAL '2 hours', 'Menunggu Verifikasi'
FROM users WHERE email = 'peternak1@ib.test';

-- 2) Diproses: laporan IB petugas sudah 4 bulan lalu, hasil belum dilaporkan peternak.
--    Saat dasbor admin dibuka, flag pengingat 3 bulan (flag_laporan_ib) menyala.
INSERT INTO requests (user_id, nama_peternak, jenis_ib, jumlah_ternak, latitude, longitude, tanggal, status,
                      petugas_id, verifikasi_at, proses_at, laporan_terisi, laporan_ib_text, deadline_laporan_ib)
SELECT p.id, p.name, 'IB Sapi Perah', 1, -6.5700, 106.8450, NOW() - INTERVAL '4 months 2 days', 'Diproses',
       t.id, NOW() - INTERVAL '4 months 1 day', NOW() - INTERVAL '4 months',
       TRUE, 'Straw FH-0231, sapi dalam kondisi birahi baik.', NOW() - INTERVAL '1 month'
FROM users p, users t WHERE p.email = 'peternak2@ib.test' AND t.email = 'petugas1@ib.test';

-- 3) Ditolak
INSERT INTO requests (user_id, nama_peternak, jenis_ib, jumlah_ternak, latitude, longitude, tanggal, status)
SELECT id, name, 'IB Sapi Potong', 3, -6.6120, 106.7900, NOW() - INTERVAL '10 days', 'Ditolak'
FROM users WHERE email = 'peternak1@ib.test';

-- 4) Berhasil: peternak melapor IB berhasil; checkup kebuntingan menunggu penugasan admin
INSERT INTO requests (user_id, nama_peternak, jenis_ib, jumlah_ternak, latitude, longitude, tanggal, status,
                      petugas_id, verifikasi_at, proses_at, laporan_terisi, laporan_ib_text, deadline_laporan_ib,
                      laporan_ib_status)
SELECT p.id, p.name, 'IB Sapi Potong', 1, -6.5700, 106.8450, NOW() - INTERVAL '2 months 3 days', 'Berhasil',
       t.id, NOW() - INTERVAL '2 months 2 days', NOW() - INTERVAL '2 months',
       TRUE, 'Sapi tidak birahi kembali setelah 21 hari.', NOW() + INTERVAL '1 month', 'Berhasil'
FROM users p, users t WHERE p.email = 'peternak2@ib.test' AND t.email = 'petugas2@ib.test';

-- 5) Selesai: siklus lengkap sampai checkup kelahiran
INSERT INTO requests (user_id, nama_peternak, jenis_ib, jumlah_ternak, latitude, longitude, tanggal, status,
                      petugas_id, verifikasi_at, proses_at, laporan_terisi, laporan_ib_text, deadline_laporan_ib,
                      laporan_ib_status, laporan_peternak_kelahiran)
SELECT p.id, p.name, 'IB Sapi Potong', 1, -6.6120, 106.7900, NOW() - INTERVAL '11 months', 'Selesai',
       t.id, NOW() - INTERVAL '11 months' + INTERVAL '1 hour', NOW() - INTERVAL '11 months' + INTERVAL '1 day',
       TRUE, 'Anak sapi lahir sehat.', NOW() - INTERVAL '8 months', 'Berhasil',
       'Anak sapi jantan lahir sehat, berat sekitar 30 kg.'
FROM users p, users t WHERE p.email = 'peternak1@ib.test' AND t.email = 'petugas1@ib.test';

-- ---------------------------------------------------------------------
-- Checkup
-- ---------------------------------------------------------------------
INSERT INTO checkups (request_id, tipe, status, created_at)
SELECT id, 'Checkup Kebuntingan', 'Menunggu Penugasan', NOW() - INTERVAL '1 month'
FROM requests WHERE status = 'Berhasil';

INSERT INTO checkups (request_id, petugas_id, tipe, status, laporan, tanggal, created_at, konfirmasi_at, laporan_at)
SELECT r.id, r.petugas_id, 'Checkup Kebuntingan', 'Selesai', 'Positif bunting, umur janin sekitar 3 bulan.',
       NOW() - INTERVAL '8 months', NOW() - INTERVAL '8 months', NOW() - INTERVAL '8 months', NOW() - INTERVAL '8 months'
FROM requests r WHERE r.status = 'Selesai';

INSERT INTO checkups (request_id, petugas_id, tipe, status, laporan, tanggal, created_at, konfirmasi_at, laporan_at)
SELECT r.id, r.petugas_id, 'Checkup Kelahiran', 'Selesai', 'Induk dan anak sehat.',
       NOW() - INTERVAL '1 month', NOW() - INTERVAL '1 month', NOW() - INTERVAL '1 month', NOW() - INTERVAL '29 days'
FROM requests r WHERE r.status = 'Selesai';

-- ---------------------------------------------------------------------
-- Log aktivitas (ringkas)
-- ---------------------------------------------------------------------
INSERT INTO activity_logs (request_id, deskripsi, waktu)
SELECT id, 'Permintaan ditolak: lokasi di luar wilayah layanan', tanggal + INTERVAL '1 day'
FROM requests WHERE status = 'Ditolak';

INSERT INTO activity_logs (request_id, deskripsi, waktu)
SELECT r.id, 'Permintaan diverifikasi dan ditugaskan ke petugas ID ' || r.petugas_id, r.verifikasi_at
FROM requests r WHERE r.petugas_id IS NOT NULL;

INSERT INTO activity_logs (request_id, deskripsi, waktu)
SELECT id, 'Petugas submit laporan IB dan permintaan selesai tahap IB.', proses_at
FROM requests WHERE laporan_terisi;

INSERT INTO activity_logs (request_id, deskripsi, waktu)
SELECT id, 'Peternak mengirimkan laporan IB: Berhasil', proses_at + INTERVAL '21 days'
FROM requests WHERE laporan_ib_status = 'Berhasil';

INSERT INTO activity_logs (request_id, deskripsi, waktu)
SELECT id, 'Laporan Checkup Kelahiran dikirim oleh petugas: Induk dan anak sehat.', NOW() - INTERVAL '29 days'
FROM requests WHERE status = 'Selesai';
