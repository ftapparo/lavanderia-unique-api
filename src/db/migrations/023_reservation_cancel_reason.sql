ALTER TABLE reservations
  ADD COLUMN canceled_reason VARCHAR(20)
    CHECK (canceled_reason IN ('USER', 'ADMIN', 'MAINTENANCE'));
