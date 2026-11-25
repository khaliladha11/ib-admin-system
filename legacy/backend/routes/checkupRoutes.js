const express = require('express');
const router = express.Router();
const checkupController = require('../controllers/checkupController');
const pool = require('../config/db');

// Aksi admin
router.post('/assign', checkupController.assignCheckup);

// Aksi petugas
router.put('/:id/confirm', checkupController.confirmCheckup);
router.put('/:id/submit', checkupController.submitCheckupReport);

//notif checkup petugas
router.get('/petugas/:id/pending', checkupController.getCheckupsByPetugas);

module.exports = router;
