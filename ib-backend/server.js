require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');

const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const checkupRoutes = require('./routes/checkupRoutes');
const db = require('./config/db');

// ✅ CORS DI ATAS
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// ✅ Middleware JSON & BodyParser
app.use(express.json());
app.use(bodyParser.json());

// ✅ Routes
app.use('/api/requests', requestRoutes);
app.use('/api/checkups', checkupRoutes);
app.use('/api', authRoutes);

// ✅ DB Connection
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
