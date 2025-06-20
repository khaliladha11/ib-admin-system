// controllers/checkupController.js
const pool = require('../config/db');

// Tambahkan checkup baru
exports.assignCheckup = async (req, res) => {
    const { request_id, petugas_id, jenis } = req.body;
    try {
        const result = await pool.query(`
        INSERT INTO checkups (request_id, petugas_id, jenis, status, created_at)
        VALUES ($1, $2, $3, 'Belum Dikonfirmasi', NOW())
        RETURNING *`,
        [request_id, petugas_id, jenis]);

        await pool.query(`
        INSERT INTO activity_logs (request_id, deskripsi, waktu)
        VALUES ($1, $2, NOW())`,
        [request_id, `Checkup ${jenis} ditugaskan ke petugas ID ${petugas_id}`]);

        res.json({ message: 'Checkup berhasil ditugaskan', checkup: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menugaskan checkup');
    }
};

// Konfirmasi oleh petugas
exports.confirmCheckup = async (req, res) => {
    const { id } = req.params;
    try {
        // Update checkup
        await pool.query(`
            UPDATE checkups 
            SET status = 'Dikonfirmasi', konfirmasi_at = NOW() 
            WHERE id = $1
        `, [id]);

        // Ambil request_id dari checkup
        const result = await pool.query(`SELECT request_id FROM checkups WHERE id = $1`, [id]);
        const requestId = result.rows[0].request_id;

        // Tambah log
        await pool.query(`
            INSERT INTO activity_logs (request_id, deskripsi, waktu)
            VALUES ($1, $2, NOW())
        `, [requestId, `Checkup dikonfirmasi oleh petugas`]);

        res.json({ message: 'Checkup dikonfirmasi' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal konfirmasi');
    }
};


// Submit laporan checkup
exports.submitCheckupReport = async (req, res) => {
    const { id } = req.params;
    const { laporan } = req.body;

    try {
        await pool.query(`
        UPDATE checkups
        SET laporan = $1, laporan_at = NOW(), status = 'Selesai'
        WHERE id = $2
        `, [laporan, id]);

        // Ambil tipe checkup dan request_id
        const result = await pool.query(`SELECT request_id, tipe FROM checkups WHERE id = $1`, [id]);
        const { request_id, tipe } = result.rows[0];

        // Ubah status permintaan jadi 'Selesai' jika tipe adalah Checkup Kelahiran
        if (tipe === 'Checkup Kelahiran') {
        await pool.query(`
            UPDATE requests SET status = 'Selesai' WHERE id = $1
        `, [request_id]);
        }

        // Simpan ke activity log
        await pool.query(`
        INSERT INTO activity_logs (request_id, deskripsi, waktu)
        VALUES ($1, $2, NOW())
        `, [request_id, `Laporan ${tipe} dikirim oleh petugas: ${laporan}`]);

        res.json({ message: 'Laporan checkup berhasil dikirim' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal kirim laporan');
    }
};

//notif checkup
exports.getCheckupsByPetugas = async (req, res) => {
    const petugasId = req.params.id;
    try {
        const result = await pool.query(`
            SELECT c.*, r.nama_peternak
            FROM checkups c
            JOIN requests r ON c.request_id = r.id
            WHERE c.petugas_id = $1 AND c.status = 'Belum Dikonfirmasi'
            ORDER BY c.created_at DESC
        `, [petugasId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Gagal mengambil checkup untuk petugas:", err);
        res.status(500).json({ error: 'Server error' });
    }
};