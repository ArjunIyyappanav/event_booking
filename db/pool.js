import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
export const pool = new Pool({ connectionString, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false });

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } finally {
    const duration = Date.now() - start;
    if (process.env.SQL_LOG) {
      console.log('executed query', { text, duration, rows: params?.length ?? 0 });
    }
  }
}

