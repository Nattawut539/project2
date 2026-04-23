// const { Pool } = require("pg");

// const pool = new Pool({
//     user: process.env.DB_USER || "postgres",
//     host: process.env.DB_HOST || "localhost",
//     database: process.env.DB_NAME || "projectfinal",  // เปลี่ยนเป็น finalProject
//     password: process.env.DB_PASSWORD || "120246",
//     port: Number(process.env.DB_PORT) || 5432,
// });

// module.exports = pool;

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

const cfg = connectionString
    ? {
        connectionString,
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
    }
    : {
        user: process.env.DB_USER || "postgres",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "projectfinal", // เปลี่ยนเป็น finalProject
        password: process.env.DB_PASSWORD || "120246",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
    };
const pool = new Pool({
    ...cfg,
    max:parseInt(process.env.PG_MAX || '10',10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE || '3000',10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT || '5000',10),
    application_name: process.env.PG_APP || 'clinic-api',
});

pool.on('connect',(client) =>{
    client.query("SET search_path TO clinic, public").catch(() =>{});
});

pool.on('error',(err) =>{
    console.error('PG pool error:',err);
});

module.exports = pool;

