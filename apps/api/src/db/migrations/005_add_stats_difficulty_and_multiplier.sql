-- Add difficulty and avg_multiplier to playthrough song stats
-- Difficulty allows per-song skill level changes (Rock Band 4 feature)
-- Avg multiplier was missing from original schema

ALTER TABLE playthrough_song_stats
  ADD COLUMN difficulty VARCHAR(10),  -- 'easy', 'medium', 'hard', 'expert'
  ADD COLUMN avg_multiplier DECIMAL(4,1);  -- e.g., 3.8

-- No default values - these are nullable for backwards compatibility
-- Existing stats remain valid with NULL values
