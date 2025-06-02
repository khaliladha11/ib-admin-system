const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    console.log("Login route hit");
    const { email, password } = req.body;
    try {
        const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userQuery.rowCount === 0) return res.status(400).json({ message: 'User not found' });

        const user = userQuery.rows[0];
        const valid = await bcrypt.compare(password, user.password);

        if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ token, role: user.role, name: user.name });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.register = async (req, res) => {
    const { name, email, password, role, latitude, longitude } = req.body;

    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rowCount > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
                `INSERT INTO users (name, email, password, role, latitude, longitude)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, name, email, role, latitude, longitude`,
            [name, email, hashedPassword, role, latitude, longitude]
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: newUser.rows[0]
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};