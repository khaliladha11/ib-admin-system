require('dotenv').config();
const express = require('express');
const app = express();
const authRoutes = require('./routes/authRoutes');
const db = require('./config/db');
const cors = require('cors');
const requestRoutes = require('./routes/requestRoutes');

app.use(cors());
app.use(express.json());
app.use('/api/requests', requestRoutes);

// REGISTER ROUTES
app.use('/api', authRoutes); // ← ini penting!

app.use('/api', requestRoutes); //request dari peternak

// Cek koneksi DB
db.connect(err => {
    if (err) {
        console.error('Database connection error:', err.stack);
        return;
    }
    console.log('Connected to PostgreSQL');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});