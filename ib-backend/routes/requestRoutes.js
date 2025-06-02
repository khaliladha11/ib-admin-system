const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const pool = require('../config/db');

router.get('/requests', requestController.getAllRequests);

// Get all requests
router.get('/', requestController.getAllRequests);

// Get detail request by ID
router.get('/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query(`
            SELECT r.*, u.name AS nama_petugas 
            FROM requests r 
            LEFT JOIN users u ON r.petugas_id = u.id 
            WHERE r.id = $1
        `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Request tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Route untuk verifikasi Tolak dan list petugas pada halaman detail
router.get('/petugas/list', requestController.getAllPetugas);
router.put('/:id/verify', requestController.verifyRequest);
router.put('/:id/reject', requestController.rejectRequest);

// Buat permintaan baru
router.post('/', async (req, res) => {
    const {
        user_id,
        nama_peternak,
        jenis_ib,
        jumlah_ternak,
        latitude,
        longitude
    } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO requests (user_id, nama_peternak, jenis_ib, jumlah_ternak, latitude, longitude, tanggal, status)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'Menunggu Verifikasi')
            RETURNING *`,
            [user_id, nama_peternak, jenis_ib, jumlah_ternak, latitude, longitude]
        );

        res.status(201).json({ message: 'Permintaan berhasil dibuat', request: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Gagal menambahkan permintaan' });
    }
});

//log aktivitas
router.get('/requests/:id/logs', requestController.getLogs);
// (Opsional) Tambahkan post/put/delete jika dibutuhkan nanti

module.exports = router;
