-- Compute price, validate age, validate seat/cancelled before inserting a ticket
CREATE OR REPLACE FUNCTION tickets_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  s RECORD;
  r RECORD;
  age_years INT;
BEGIN
  SELECT sc.starts_at, sc.capacity, sc.cancelled_at, sh.min_age, sh.category
  INTO s
  FROM screenings sc
  JOIN shows sh ON sh.id = sc.show_id
  WHERE sc.id = NEW.screening_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid screening_id %', NEW.screening_id;
  END IF;

  IF s.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Screening is cancelled';
  END IF;

  IF NEW.seat_number < 1 OR NEW.seat_number > s.capacity THEN
    RAISE EXCEPTION 'Seat % out of range 1..%', NEW.seat_number, s.capacity;
  END IF;

  IF NEW.buyer_dob IS NULL THEN
    RAISE EXCEPTION 'buyer_dob is required';
  END IF;

  age_years := EXTRACT(YEAR FROM age(s.starts_at::date, NEW.buyer_dob));
  IF age_years < s.min_age THEN
    RAISE EXCEPTION 'Buyer does not meet min age % (age at screening: %)', s.min_age, age_years;
  END IF;

  SELECT pr.base_price, pr.multiplier
  INTO r
  FROM pricing_rules pr
  WHERE pr.category = s.category;

  IF NOT FOUND THEN
    NEW.price := 10.00; -- default fallback
  ELSE
    NEW.price := ROUND((r.base_price * r.multiplier)::numeric, 2);
  END IF;

  IF NEW.status IS NULL THEN NEW.status := 'reserved'; END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Expire unpaid reservations older than N minutes
CREATE OR REPLACE FUNCTION expire_unpaid_reservations(minutes INTEGER)
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE tickets
  SET status = 'expired'
  WHERE status = 'reserved'
    AND created_at <= now() - make_interval(mins => minutes);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- On screening cancel: cancel reserved, refund paid
CREATE OR REPLACE FUNCTION on_screening_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  -- Cancel reservations
  UPDATE tickets SET status = 'cancelled'
  WHERE screening_id = NEW.id AND status = 'reserved';

  -- Refund paid tickets
  WITH paid AS (
    SELECT id, price FROM tickets WHERE screening_id = NEW.id AND status = 'paid'
  ), ins_refunds AS (
    INSERT INTO refunds(ticket_id, amount, reason)
    SELECT id, COALESCE(price, 0), 'screening_cancelled' FROM paid
    ON CONFLICT (ticket_id) DO NOTHING
    RETURNING ticket_id
  )
  UPDATE tickets t
  SET status = 'refunded'
  FROM paid p
  WHERE t.id = p.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
