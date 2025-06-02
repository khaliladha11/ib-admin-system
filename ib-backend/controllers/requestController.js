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

// Verifikasi permintaan
exports.verifyRequest = async (req, res) => {
    const id = req.params.id;
    const { petugas_id } = req.body;

    try {
        const result = await pool.query(`
            UPDATE requests 
            SET status = 'Diproses', petugas_id = $1 
            WHERE id = $2
        `, [petugas_id, id]);

        res.json({ message: 'Permintaan berhasil diverifikasi' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
    await pool.query(`
    INSERT INTO activity_logs (request_id, deskripsi)
    VALUES ($1, $2)`, [id, `Permintaan diverifikasi dan diproses oleh admin`]);
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
