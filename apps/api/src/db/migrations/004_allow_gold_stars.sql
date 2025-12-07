-- Allow gold stars (6 stars) in addition to regular 1-5 stars
-- Gold stars are a special achievement in Rock Band 4

ALTER TABLE playthrough_song_stats
DROP CONSTRAINT IF EXISTS playthrough_song_stats_stars_earned_check;

ALTER TABLE playthrough_song_stats
ADD CONSTRAINT playthrough_song_stats_stars_earned_check
CHECK (stars_earned BETWEEN 1 AND 6);
