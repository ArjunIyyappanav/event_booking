-- Triggers wiring
DO $$ BEGIN
  -- Before insert on tickets
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tickets_before_insert'
  ) THEN
    CREATE TRIGGER trg_tickets_before_insert
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION tickets_before_insert();
  END IF;

  -- After update on screenings.cancelled_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_screenings_cancel'
  ) THEN
    CREATE TRIGGER trg_screenings_cancel
    AFTER UPDATE OF cancelled_at ON screenings
    FOR EACH ROW
    WHEN (NEW.cancelled_at IS NOT NULL AND (OLD.cancelled_at IS NULL OR NEW.cancelled_at <> OLD.cancelled_at))
    EXECUTE FUNCTION on_screening_cancelled();
  END IF;
END $$;
