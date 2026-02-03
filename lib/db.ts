import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    rejectUnauthorized: false, // 🔥 CLAVE para Railway
  },

  waitForConnections: true,
  connectionLimit: 3, // recomendado en Vercel
  queueLimit: 0,
});

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
