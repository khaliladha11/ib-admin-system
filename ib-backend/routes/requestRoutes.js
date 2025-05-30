const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

router.get('/requests', requestController.getAllRequests);

// Get all requests
router.get('/', requestController.getAllRequests);

// Get detail request by ID
router.get('/:id', requestController.getRequestById);

// Route untuk verifikasi Tolak dan list petugas pada halaman detail
router.get('/petugas/list', requestController.getAllPetugas);
router.put('/:id/verify', requestController.verifyRequest);
router.put('/:id/reject', requestController.rejectRequest);

// (Opsional) Tambahkan post/put/delete jika dibutuhkan nanti

module.exports = router;
