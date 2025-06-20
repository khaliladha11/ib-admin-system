const pool = require('../config/db');

exports.getAllRequests = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY tanggal DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
    };

    exports.getRequestById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM requests WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Request not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching request:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Ambil semua petugas
exports.getAllPetugas = async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name FROM users WHERE role = 'petugas'");
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal mengambil data petugas');
    }
};

// ambil semua proses IB dan checkup untuk petugas yg ditugaskan
exports.getAllRequestsForPetugas = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT DISTINCT r.*, u.name AS nama_petugas,
                c.petugas_id AS checkup_petugas_id
            FROM requests r
            LEFT JOIN users u ON r.petugas_id = u.id
            LEFT JOIN checkups c ON c.request_id = r.id
            WHERE r.petugas_id = $1 OR c.petugas_id = $1
            ORDER BY r.tanggal DESC
        `, [id]);

        res.json(result.rows);
    } catch (err) {
        console.error("Gagal mengambil semua permintaan petugas:", err);
        res.status(500).json({ message: "Gagal mengambil data permintaan petugas" });
    }
};

// Tolak permintaan
exports.rejectRequest = async (req, res) => {
    const { id } = req.params;
    const { catatan } = req.body;
    try {
        await pool.query(
        'UPDATE requests SET status = $1 WHERE id = $2',
        ['Ditolak', id]
        );

        // Simpan catatan sebagai log (jika ada tabel log aktivitas)
        await pool.query(
        'INSERT INTO activity_logs (request_id, deskripsi, waktu) VALUES ($1, $2, NOW())',
        [id, `Permintaan ditolak: ${catatan}`]
        );

        res.json({ message: 'Permintaan ditolak' });
    } catch (err) {
        console.error('Error rejecting request:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

//log aktivitas
exports.getLogs = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT * FROM activity_logs 
            WHERE request_id = $1 
            ORDER BY waktu ASC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};


//dashboard petugas
exports.getRequestsByPetugasId = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
                `SELECT r.*, u.name AS nama_petugas
                FROM requests r
                JOIN users u ON r.petugas_id = u.id
                WHERE r.petugas_id = $1
                ORDER BY r.tanggal DESC`, [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching data for petugas:", err);
        res.status(500).json({ message: "Gagal mengambil data permintaan petugas" });
    }
};

// Verifikasi oleh admin -> catat verifikasi_at
exports.verifyRequest = async (req, res) => {
    const id = req.params.id;
    const { petugas_id } = req.body;

    try {
        await pool.query(`
        UPDATE requests 
        SET status = 'Diproses', petugas_id = $1, verifikasi_at = NOW() 
        WHERE id = $2
        `, [petugas_id, id]);

        await pool.query(`
        INSERT INTO activity_logs (request_id, deskripsi, waktu)
        VALUES ($1, $2, NOW())
        `, [id, `Permintaan diverifikasi dan ditugaskan ke petugas ID ${petugas_id}`]);

        res.json({ message: 'Permintaan berhasil diverifikasi dan ditugaskan' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error saat verifikasi');
    }
};

// Petugas menekan tombol "Proses IB"
exports.startProcessIB = async (req, res) => {
    const id = req.params.id;

    try {
        await pool.query(`
        UPDATE requests 
        SET proses_at = NOW()
        WHERE id = $1
        `, [id]);

        await pool.query(`
        INSERT INTO activity_logs (request_id, deskripsi, waktu)
        VALUES ($1, $2, NOW())
        `, [id, 'Petugas memulai proses IB']);

        res.json({ message: 'Proses IB dimulai' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error saat memulai proses IB');
    }
};

exports.petugasProsesIB = async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(`
            UPDATE requests SET status = 'Diproses' WHERE id = $1
        `, [id]);

        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, $2, NOW())
        `, [id, 'Permintaan diproses oleh petugas']);

        res.json({ message: 'Status diperbarui ke Diproses' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};

// Petugas mengisi laporan IB
exports.submitIBReport = async (req, res) => {
    const id = req.params.id;
    const { isi_laporan } = req.body;

    try {
        await pool.query(`
            UPDATE requests 
            SET laporan_terisi = TRUE,
                laporan_ib_text = $1
            WHERE id = $2
        `, [isi_laporan, id]);

        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, $2, NOW())
        `, [id, `Petugas mengisi laporan IB: ${isi_laporan}`]);

        res.json({ message: 'Laporan berhasil disimpan' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menyimpan laporan IB');
    }
};


exports.petugasIsiLaporan = async (req, res) => {
  // Dummy function biar nggak error
    res.json({ message: 'Form laporan belum diimplementasikan' });
};

// Endpoint pengecekan (opsional, bisa untuk notifikasi manual oleh admin atau CRON)
exports.getLateUnprocessedRequests = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, u.name AS nama_peternak 
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.status = 'Diproses'
            AND r.verifikasi_at IS NOT NULL
            AND r.proses_at IS NULL
            AND NOW() - r.verifikasi_at > INTERVAL '30 minutes'
        `);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengambil request yang belum diproses');
    }
};

// Endpoin untuk notif masuk ke petugas baik itu Proses IB awal dan checkup
exports.getUnprocessedRequestsForPetugas = async (req, res) => {
    const { id } = req.params; // petugas_id
    try {
        const result = await pool.query(`
            SELECT r.*, u.name AS nama_peternak
            FROM requests r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.status = 'Diproses'
            AND r.verifikasi_at IS NOT NULL
            AND r.proses_at IS NULL
            AND r.petugas_id = $1
        `, [id]);

        res.json(result.rows);
    } catch (err) {
        console.error("Gagal mengambil tugas proses IB:", err);
        res.status(500).send('Server error');
    }
};

//admin ganti petugas
exports.gantiPetugas = async (req, res) => {
    const { id } = req.params;
    const { petugas_id } = req.body;

    try {
        await pool.query(`
        UPDATE requests 
        SET petugas_id = $1, verifikasi_at = NOW()
        WHERE id = $2
        `, [petugas_id, id]);

        await pool.query(`
        INSERT INTO activity_logs (request_id, deskripsi, waktu)
        VALUES ($1, $2, NOW())
        `, [id, `Petugas diganti oleh admin menjadi ID ${petugas_id}`]);

        res.json({ message: 'Petugas berhasil diganti' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengganti petugas');
    }
};

// rendpoint untuk keterlambatan pengisian laporan petugas
exports.getOverdueReports = async (req, res) => {
    try {
        const result = await pool.query(`
                SELECT * FROM requests
                WHERE status = 'Diproses'
                AND laporan_terisi = FALSE
                AND proses_at IS NOT NULL
                AND NOW() - proses_at > INTERVAL '24 hours'
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal mengambil data laporan yang lewat waktu");
    }
};

//checkup
exports.getCheckupsByRequestId = async (req, res) => {
    const requestId = req.params.id;
    try {
        const result = await pool.query(`
            SELECT c.*, u.name AS nama_petugas
            FROM checkups c
            LEFT JOIN users u ON c.petugas_id = u.id
            WHERE c.request_id = $1
        `, [requestId]);
        res.json(result.rows);
    } catch (error) {
        console.error("Gagal mengambil checkup:", error);
        res.status(500).json({ error: "Gagal mengambil checkup" });
    }
};

// keguguran
exports.kirimKeguguran = async (req, res) => {
    const { id } = req.params;
    const { laporan } = req.body;

    try {
        await pool.query(`
            UPDATE requests
            SET status = 'Gagal', laporan_peternak_text = $1
            WHERE id = $2
        `, [laporan, id]);

        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, 'Peternak mengirim laporan keguguran', NOW())
        `, [id]);

        res.json({ message: 'Laporan keguguran berhasil disimpan' });
    } catch (err) {
        console.error("Gagal kirim laporan keguguran:", err);
        res.status(500).json({ error: 'Server error' });
    }
};

//kebuntingan
exports.kirimKebuntingan = async (req, res) => {
    const { id } = req.params;
    const { laporan } = req.body;

    try {
        // Ubah status IB jadi "Berhasil"
        await pool.query(`
            UPDATE requests
            SET status = 'Berhasil', laporan_peternak_text = $1
            WHERE id = $2
        `, [laporan, id]);

        // Tambahkan entri checkup kebuntingan (untuk petugas admin tugaskan nanti)
        await pool.query(`
            INSERT INTO checkups (request_id, tipe, status)
            VALUES ($1, 'Checkup Kebuntingan', 'Menunggu Penugasan')
        `, [id]);

        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, 'Peternak melaporkan sapi berhasil bunting', NOW())
        `, [id]);

        res.json({ message: 'Laporan kebuntingan berhasil disimpan dan checkup kebuntingan dijadwalkan' });
    } catch (err) {
        console.error("Gagal kirim laporan kebuntingan:", err);
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /:id/checkup/kelahiran
exports.kirimPermintaanKelahiran = async (req, res) => {
    const { id } = req.params;
    const { catatan } = req.body;

    try {
        // Tambahkan entri ke tabel checkups
        await pool.query(`
            INSERT INTO checkups (request_id, tipe, status, laporan, created_at)
            VALUES ($1, 'Checkup Kelahiran', 'Menunggu Penugasan', $2, NOW())
        `, [id, catatan]);

        // Catat ke log aktivitas
        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, 'Peternak mengirim permintaan checkup kelahiran', NOW())
        `, [id]);

        res.status(201).json({ message: 'Permintaan checkup kelahiran berhasil ditambahkan' });
    } catch (err) {
        console.error("Gagal membuat permintaan checkup kelahiran:", err);
        res.status(500).json({ error: 'Server error' });
    }
};

// menunggu penugasan
exports.getCheckupsMenungguPenugasan = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, r.nama_peternak 
            FROM checkups c
            JOIN requests r ON c.request_id = r.id
            WHERE c.status = 'Menunggu Penugasan'
            ORDER BY c.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Gagal mengambil checkup menunggu penugasan:", err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Tugaskan checkup
exports.assignCheckup = async (req, res) => {
    const { id } = req.params; // ID dari request
    const { tipe, petugas_id } = req.body;

    try {
        const result = await pool.query(`
            UPDATE checkups
            SET petugas_id = $1, status = 'Belum Dikonfirmasi', tanggal = NOW()
            WHERE request_id = $2 AND tipe = $3 AND status = 'Menunggu Penugasan'
            RETURNING *
        `, [petugas_id, id, tipe]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Checkup tidak ditemukan atau sudah ditugaskan' });
        }

        // Log aktivitas
        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, $2, NOW())
        `, [id, `Admin menugaskan checkup ${tipe} ke petugas ID ${petugas_id}`]);

        res.json({ message: 'Checkup berhasil ditugaskan' });
    } catch (err) {
        console.error("Gagal menugaskan checkup:", err);
        res.status(500).json({ error: 'Server error saat menugaskan checkup' });
    }
};


