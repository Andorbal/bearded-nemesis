-- Migration 006: Allow same user to play multiple instruments in a playthrough
--
-- Problem: Current PRIMARY KEY (playthrough_id, user_id) prevents a single user
-- from playing multiple instruments in one playthrough (e.g., solo play).
--
-- Solution: Change primary key to include instrument, allowing same user to play
-- different instruments, but not the same instrument twice.
--
-- Example enabled scenario:
--   User 1: drums + guitar in the same playthrough
--
-- Example prevented scenario (still invalid):
--   User 1: drums + drums in the same playthrough

ALTER TABLE playthrough_players
  DROP CONSTRAINT playthrough_players_pkey,
  ADD PRIMARY KEY (playthrough_id, user_id, instrument);
