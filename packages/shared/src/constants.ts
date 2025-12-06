export const INSTRUMENTS = ['drums', 'guitar', 'bass', 'vocals'] as const;
export type Instrument = typeof INSTRUMENTS[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

export const SETLIST_TYPES = ['manual', 'smart', 'builder'] as const;
export type SetlistType = typeof SETLIST_TYPES[number];

export const PLAYTHROUGH_STATUSES = ['in_progress', 'finished'] as const;
export type PlaythroughStatus = typeof PLAYTHROUGH_STATUSES[number];

export const RATING_AGGREGATIONS = ['average', 'minimum', 'maximum'] as const;
export type RatingAggregation = typeof RATING_AGGREGATIONS[number];

// Song difficulty is 1-7 (the dots in Rock Band)
export const MIN_SONG_DIFFICULTY = 1;
export const MAX_SONG_DIFFICULTY = 7;

// User ratings are 1-5 stars
export const MIN_RATING = 1;
export const MAX_RATING = 5;
