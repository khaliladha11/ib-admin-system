const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',              
    host: 'localhost',
    database: 'postgres',
    searchPath: ['public'],          
    password: 'postgres',    
    port: 5432
});

module.exports = pool;

