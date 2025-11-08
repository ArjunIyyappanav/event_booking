-- Sample pricing rules
INSERT INTO pricing_rules (category, base_price, multiplier) VALUES
  ('standard', 10.00, 1.0)
ON CONFLICT (category) DO UPDATE SET base_price = EXCLUDED.base_price, multiplier = EXCLUDED.multiplier;

INSERT INTO pricing_rules (category, base_price, multiplier) VALUES
  ('premium', 15.00, 1.2)
ON CONFLICT (category) DO UPDATE SET base_price = EXCLUDED.base_price, multiplier = EXCLUDED.multiplier;

INSERT INTO pricing_rules (category, base_price, multiplier) VALUES
  ('kids', 8.00, 0.8)
ON CONFLICT (category) DO UPDATE SET base_price = EXCLUDED.base_price, multiplier = EXCLUDED.multiplier;

-- Sample shows
INSERT INTO shows (title, category, min_age) VALUES
  ('Indie Night', 'standard', 16),
  ('Headliner Live', 'premium', 18),
  ('Kids Matinee', 'kids', 0)
ON CONFLICT DO NOTHING;

-- Sample screenings (update times to upcoming)
INSERT INTO screenings (show_id, starts_at, venue, capacity) VALUES
  ((SELECT id FROM shows WHERE title='Indie Night'), now() + interval '1 day', 'Main Hall', 30),
  ((SELECT id FROM shows WHERE title='Headliner Live'), now() + interval '2 days', 'Main Hall', 30),
  ((SELECT id FROM shows WHERE title='Kids Matinee'), now() + interval '3 days 3 hours', 'Side Stage', 20)
ON CONFLICT DO NOTHING;
