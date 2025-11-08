CREATE TABLE IF NOT EXISTS shows (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  min_age INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS screenings (
  id SERIAL PRIMARY KEY,
  show_id INT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  venue TEXT,
  capacity INT NOT NULL CHECK (capacity > 0),
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_screenings_show_id ON screenings(show_id);
CREATE INDEX IF NOT EXISTS idx_screenings_starts_at ON screenings(starts_at);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id SERIAL PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  screening_id INT NOT NULL REFERENCES screenings(id) ON DELETE CASCADE,
  seat_number INT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT,
  buyer_dob DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','paid','expired','refunded','cancelled')),
  price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tickets_screening_id ON tickets(screening_id);

-- Partial unique index to prevent double booking of same seat for the same screening
CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_screening_seat_active
ON tickets (screening_id, seat_number)
WHERE status IN ('reserved','paid');

CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  ticket_id INT UNIQUE NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
