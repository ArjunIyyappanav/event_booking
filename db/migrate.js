import path from 'path';
import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
import url from 'url';

dotenv.config();

const { Pool } = pg;

// __dirname replacement (ESM)
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

async function migrate({ seed = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ORDER MATTERS
    await runSqlFile(client, path.join(__dirname, 'schema.sql'));
    await runSqlFile(client, path.join(__dirname, 'functions.sql'));
    await runSqlFile(client, path.join(__dirname, 'triggers.sql'));

    if (seed) {
      await runSqlFile(client, path.join(__dirname, 'seed.sql'));
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// detect direct execution (ESM version of require.main===module)
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const seed = process.argv.includes('--seed');
  migrate({ seed })
    .then(() => {
      console.log('Database migrated' + (seed ? ' with seed' : ''));
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export { pool, migrate };
