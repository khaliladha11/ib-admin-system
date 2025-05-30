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
    const { id } = req.params;
    const { petugas_id } = req.body;

    try {
        await pool.query(
            "UPDATE permintaan SET status = 'Diproses', petugas_id = $1 WHERE id = $2",
            [petugas_id, id]
        );
        res.json({ message: 'Permintaan diverifikasi dan ditugaskan' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal verifikasi permintaan');
    }
};

// Tolak permintaan
exports.rejectRequest = async (req, res) => {
    const { id } = req.params;
    const { catatan } = req.body;

    try {
        await pool.query(
            "UPDATE permintaan SET status = 'Ditolak', catatan = $1 WHERE id = $2",
            [catatan, id]
        );
        res.json({ message: 'Permintaan ditolak dengan catatan' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menolak permintaan');
    }
};