const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const pool = require('../config/db');

// Get all requests
router.get('/requests', requestController.getAllRequests);
router.get('/', requestController.getAllRequests);

// dashboard petugas
router.get('/petugas/:id/requests', requestController.getRequestsByPetugasId);

// daftar petugas
router.get('/petugas/list', requestController.getAllPetugas);

// aksi verifikasi dan tolak dari admin
router.put('/:id/verify', requestController.verifyRequest);
router.put('/:id/reject', requestController.rejectRequest);

router.put('/:id/ganti-petugas', requestController.gantiPetugas);

router.get('/:id/checkups', requestController.getCheckupsByRequestId);
router.post('/:id/checkup/assign', requestController.assignCheckup);
router.get('/checkups/menunggu', requestController.getCheckupsMenungguPenugasan);

//kirim reminder ke peternak
router.post('/:id/reminder', requestController.kirimReminder);

//update flag otamatis
router.post('/update-flags', requestController.updateFlagsIfNeeded);

// aksi petugas
router.put('/petugas/:id/proses', requestController.startProcessIB);
router.put('/petugas/:id/laporan', requestController.submitIBReport);
router.get('/petugas/:id/laporan/lewat', requestController.getOverdueReports);
router.get('/pending/timeout', requestController.getLateUnprocessedRequests);

//notif tugas petugas
router.get('/petugas/:id/tugas-belum-diproses', requestController.getUnprocessedRequestsForPetugas);

// ambil semua request untuk petuags yg ditugaskan
router.get('/petugas/:id/all-requests', requestController.getAllRequestsForPetugas);

// Peternak kirim status
router.put('/:id/keguguran', requestController.kirimKeguguran);
router.put('/:id/kebuntingan', requestController.kirimKebuntingan);

//peternak kirim laporan IB gagal/berhasil
router.post('/:id/laporan-ib', requestController.kirimLaporanIB);

// Peternak minta checkup kelahiran
router.post('/:id/checkup/kelahiran', requestController.kirimPermintaanKelahiran);

// log aktivitas
router.get('/:id/logs', requestController.getLogs);

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

// GET detail request by ID — taruh PALING BAWAH
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

module.exports = router;
