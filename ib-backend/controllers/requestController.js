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
    const { isi_laporan } = req.body; // misalnya form laporan

    try {
        await pool.query(`
        UPDATE requests 
        SET laporan_terisi = TRUE
        WHERE id = $1
        `, [id]);

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
            SELECT * FROM requests 
            WHERE status = 'Diproses'
            AND verifikasi_at IS NOT NULL
            AND proses_at IS NULL
            AND NOW() - verifikasi_at > INTERVAL '30 minutes'
        `);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengambil request yang belum diproses');
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
