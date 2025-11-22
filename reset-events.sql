-- Reset events table to test timezone fix
TRUNCATE TABLE events RESTART IDENTITY CASCADE;

-- Verify table is empty
SELECT COUNT(*) as event_count FROM events;
