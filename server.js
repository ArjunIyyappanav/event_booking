import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { query } from './db/pool.js';
import { migrate } from './db/migrate.js';
import url from 'url';

dotenv.config();

// recreate __dirname for ESM
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS (allow all for simplicity; lock down in production)
app.use(cors());
app.use(express.json());

// Run DB migrations on boot (idempotent)
(async () => {
  try {
    await migrate({ seed: false });
    console.log('DB ready');
  } catch (e) {
    console.error('DB migrate error:', e.message);
  }
})();

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.get('/api/screenings', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT sc.id, sc.starts_at, sc.venue, sc.capacity,
              sh.title, sh.category, sh.min_age
       FROM screenings sc
       JOIN shows sh ON sh.id = sc.show_id
       WHERE sc.cancelled_at IS NULL AND sc.starts_at > now()
       ORDER BY sc.starts_at
       LIMIT 100`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/screenings/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sc = await query(
      `SELECT sc.id, sc.starts_at, sc.venue, sc.capacity, sc.cancelled_at,
              sh.title, sh.category, sh.min_age
       FROM screenings sc
       JOIN shows sh ON sh.id = sc.show_id
       WHERE sc.id = $1`,
      [id]
    );
    if (sc.rowCount === 0) return res.status(404).json({ error: 'Not found' });

    const tickets = await query(
      `SELECT seat_number, status FROM tickets
       WHERE screening_id = $1 AND status IN ('reserved','paid')
       ORDER BY seat_number`,
      [id]
    );

    res.json({ screening: sc.rows[0], seats: tickets.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  const { screening_id, seat_numbers, buyer_name, buyer_email, buyer_dob, pay_now } = req.body || {};
  const status = pay_now ? 'paid' : 'reserved';
  const paid_at = pay_now ? new Date() : null;

  if (!Array.isArray(seat_numbers) || seat_numbers.length === 0) {
    return res.status(400).json({ error: 'seat_numbers array required' });
  }

  try {
    await query('BEGIN');

    let prices = [];

    seat_numbers.forEach(async (seat_number) =>{
      console.log('Reserving seat number:', seat_number);
      const ins = await query(
        `INSERT INTO tickets(screening_id, seat_number, buyer_name, buyer_email, buyer_dob, status, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING price`,
        [screening_id, seat_number, buyer_name, buyer_email || null, buyer_dob, status, paid_at]
      );
      prices.push(ins.rows[0].price);
    }
  )
    await query('COMMIT');

    res.status(201).json({
      ok: true,
      seats: seat_numbers,
      prices,
      total_price: prices.reduce((a, b) => a + b, 0)
    });

  } catch (e) {
    await query('ROLLBACK');

    if (e.code === '23505') {
      return res.status(400).json({ error: 'Some seat(s) already reserved / paid' });
    }
    return res.status(400).json({ error: e.message });
  }
});

app.post('/api/admin/cancel-screening', async (req, res) => {
  const { id } = req.body || {};
  try {
    const upd = await query(`UPDATE screenings SET cancelled_at = now() WHERE id = $1 RETURNING id`, [id]);
    if (upd.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/expire-unpaid', async (req, res) => {
  const minutes = Number(req.body?.minutes ?? 15);
  try {
    const r = await query(`SELECT expire_unpaid_reservations($1) AS expired`, [minutes]);
    res.json({ expired: r.rows[0].expired });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
