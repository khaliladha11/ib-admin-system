const pool = require('../config/db');

exports.getAllRequests = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM requests
            ORDER BY 
                (flag_laporan_ib OR flag_laporan_kelahiran) DESC,
                tanggal DESC
        `);
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
    const { id } = req.params;
    const { isi_laporan } = req.body;
    try {
        // Set deadline 3 bulan ke depan sejak submit
        const result = await pool.query(
            `
            UPDATE requests
            SET laporan_terisi = true,
                laporan_ib_text = $1,
                status = 'Diproses',
                proses_at = NOW(),
                deadline_laporan_ib = NOW() + INTERVAL '3 months'
            WHERE id = $2
            RETURNING *
            `, [isi_laporan, id]
        );

        await pool.query(
            `INSERT INTO activity_logs (request_id, deskripsi, waktu) VALUES ($1, $2, NOW())`,
            [id, 'Petugas submit laporan IB dan permintaan selesai tahap IB.']
        );

        res.status(200).json({ message: "Laporan IB berhasil dikirim", request: result.rows[0] });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Gagal submit laporan IB" });
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
            SET status = 'Gagal',
                laporan_peternak_keguguran = $1
            WHERE id = $2
        `, [laporan, id]);

        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, $2, NOW())
        `, [id, `Peternak mengirim laporan keguguran: ${laporan}`]);

        res.status(200).json({ message: 'Laporan keguguran berhasil disimpan' });
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
// Peternak membuat permintaan checkup kelahiran sekaligus menonaktifkan flag
exports.kirimPermintaanKelahiran = async (req, res) => {
    const { id } = req.params;
    const { catatan } = req.body; // Ini bisa diisi laporan kelahiran peternak

    try {
        // 1. Tambahkan entri ke tabel checkups
        await pool.query(
            `
            INSERT INTO checkups (request_id, tipe, status, laporan, created_at)
            VALUES ($1, 'Checkup Kelahiran', 'Menunggu Penugasan', $2, NOW())
            `,
            [id, catatan]
        );

        // 2. Catat ke log aktivitas
        await pool.query(
            `
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, 'Peternak mengirim permintaan checkup kelahiran', NOW())
            `,
            [id]
        );

        // 3. Matikan flag_laporan_kelahiran dan simpan laporan_peternak_kelahiran
        await pool.query(
            `
            UPDATE requests
            SET flag_laporan_kelahiran = false,
                laporan_peternak_kelahiran = $1
            WHERE id = $2
            `,
            [catatan, id]
        );

        res.status(201).json({ message: 'Permintaan checkup kelahiran dan laporan kelahiran berhasil disimpan' });
    } catch (err) {
        console.error('Gagal membuat permintaan checkup kelahiran:', err.message);
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

// Fungsi untuk memperbarui flag jemput bola jika sudah melewati deadline
exports.updateFlagsIfNeeded = async (req, res) => {
    try {
        const now = new Date();
        console.log("[updateFlagsIfNeeded] Sekarang:", now); 

        // ✅ 1. Nyalakan flag_laporan_ib bila sudah terlewat dan petugas sudah membuat laporan awal IB
        const resultIb = await pool.query(`
            UPDATE requests
            SET flag_laporan_ib = true
            WHERE laporan_terisi = true
            AND deadline_laporan_ib IS NOT NULL
            AND deadline_laporan_ib < $1
            AND (laporan_ib_status IS NULL OR laporan_ib_status = '')
            RETURNING id
        `, [now]);
        console.log("[updateFlagsIfNeeded] ID terupdate (IB):", resultIb.rows.map(r => r.id));
        
        // ✅ 2. Matikan flag_laporan_ib bila peternak sudah mengisi laporan keberhasilan/kegagalan IB
        const resultIbClear = await pool.query(`
            UPDATE requests
            SET flag_laporan_ib = false
            WHERE laporan_ib_status IS NOT NULL
            AND laporan_ib_status <> ''
            AND flag_laporan_ib = true
            RETURNING id
        `);
        if (resultIbClear.rows.length > 0) {
            console.log("[updateFlagsIfNeeded] ID di-clear (IB):", resultIbClear.rows.map(r => r.id));
        }

        // ✅ 3. Nyalakan flag_laporan_kelahiran bila sudah terlewat dan status berhasil
        await pool.query(`
            UPDATE requests
            SET flag_laporan_kelahiran = true
            WHERE status = 'Berhasil'
            AND deadline_kelahiran IS NOT NULL
            AND deadline_kelahiran < $1
            AND (laporan_peternak_kelahiran IS NULL OR laporan_peternak_kelahiran = '')
            AND (laporan_peternak_keguguran IS NULL OR laporan_peternak_keguguran = '')
        `, [now]);

        // ✅ 4. Matikan flag_laporan_kelahiran bila peternak sudah melaporkan kelahiran atau keguguran
        await pool.query(`
            UPDATE requests
            SET flag_laporan_kelahiran = false
            WHERE (laporan_peternak_kelahiran IS NOT NULL AND laporan_peternak_kelahiran <> '')
            OR (laporan_peternak_keguguran IS NOT NULL AND laporan_peternak_keguguran <> '')
            AND flag_laporan_kelahiran = true
        `);

        res.status(200).json({ message: 'Flags updated successfully' });
    } catch (err) {
        console.error("[updateFlagsIfNeeded] Error:", err.message);
        res.status(500).send('Gagal update flags');
    }
};


// kirim reminder
exports.kirimReminder = async (req, res) => {
    const { id } = req.params;
    const { jenis } = req.body;

    try {
        // Simulasi pengiriman notifikasi ke peternak, bisa disesuaikan dengan sistem pesan/email nanti
        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, $2, NOW())
        `, [id, `Admin mengingatkan peternak untuk mengirim laporan ${jenis}`]);

        res.status(200).json({ message: `Reminder untuk laporan ${jenis} berhasil dikirim.` });
    } catch (err) {
        console.error("Gagal mengirim reminder:", err);
        res.status(500).send("Gagal mengirim reminder.");
    }
};

// peternak kirim laporan IB gagal/berhasil
exports.kirimLaporanIB = async (req, res) => {
    const { id } = req.params;
    const { status_ib, isi_laporan } = req.body;

    if (!['Berhasil', 'Gagal'].includes(status_ib)) {
        return res.status(400).json({ error: 'Status IB harus Berhasil atau Gagal' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update laporan dan status
        await client.query(`
            UPDATE requests
            SET 
                laporan_ib_status = $1,
                laporan_ib_text = $2,
                status = $3
            WHERE id = $4
        `, [status_ib, isi_laporan, status_ib === 'Gagal' ? 'Gagal' : 'Berhasil', id]);

        // Tambahkan ke log aktivitas
        await client.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, $2, NOW())
        `, [id, `Peternak mengirimkan laporan IB: ${status_ib}. Catatan: ${isi_laporan}`]);

        // Jika berhasil → buat entri checkup kebuntingan
        if (status_ib === 'Berhasil') {
            await client.query(`
                INSERT INTO checkups (request_id, tipe, status)
                VALUES ($1, 'Checkup Kebuntingan', 'Menunggu Penugasan')
            `, [id]);

            await client.query(`
                INSERT INTO activity_logs (request_id, deskripsi, waktu)
                VALUES ($1, 'Checkup Kebuntingan dijadwalkan', NOW())
            `, [id]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Laporan IB berhasil dikirim' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Gagal kirim laporan IB:", err);
        res.status(500).send('Gagal kirim laporan IB');
    } finally {
        client.release();
    }
};
