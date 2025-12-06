-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    xbox_gamertag VARCHAR(50),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;

-- Songs
CREATE TABLE songs (
    id INTEGER PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    year INTEGER,
    duration_ms INTEGER,
    bpm INTEGER,
    genre VARCHAR(100),
    cover_art_url TEXT,
    youtube_url TEXT,
    spotify_id VARCHAR(100),
    difficulty_drums INTEGER CHECK (difficulty_drums BETWEEN 0 AND 7),
    difficulty_guitar INTEGER CHECK (difficulty_guitar BETWEEN 0 AND 7),
    difficulty_bass INTEGER CHECK (difficulty_bass BETWEEN 0 AND 7),
    difficulty_vocals INTEGER CHECK (difficulty_vocals BETWEEN 0 AND 7),
    difficulty_keys INTEGER CHECK (difficulty_keys BETWEEN 0 AND 7),
    ranking_guitar INTEGER,
    ranking_bass INTEGER,
    ranking_drums INTEGER,
    ranking_vocals INTEGER,
    ranking_band INTEGER,
    release_date DATE,
    harmonies_count INTEGER,
    source_array TEXT[]
);

CREATE INDEX idx_songs_artist ON songs(artist);

-- User-Song relationship (ownership + song rating)
CREATE TABLE user_songs (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
    owned BOOLEAN DEFAULT FALSE,
    song_rating INTEGER CHECK (song_rating BETWEEN 1 AND 5),
    PRIMARY KEY (user_id, song_id)
);

-- Play ratings (append-only)
CREATE TABLE song_ratings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
    instrument VARCHAR(20) NOT NULL CHECK (instrument IN ('drums', 'guitar', 'bass', 'vocals')),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    playthrough_song_id INTEGER, -- Will add FK after playthrough_songs table
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_song_ratings_user_song ON song_ratings(user_id, song_id);
CREATE INDEX idx_song_ratings_created ON song_ratings(created_at);

-- Setlists
CREATE TABLE setlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('manual', 'smart', 'builder')),
    smart_filter JSONB,
    builder_preset JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_setlists_user ON setlists(user_id);

-- Setlist songs
CREATE TABLE setlist_songs (
    setlist_id INTEGER REFERENCES setlists(id) ON DELETE CASCADE,
    song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (setlist_id, song_id)
);

-- Playthroughs
CREATE TABLE playthroughs (
    id SERIAL PRIMARY KEY,
    setlist_id INTEGER REFERENCES setlists(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'finished')),
    current_position INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_playthroughs_created_by ON playthroughs(created_by);
CREATE INDEX idx_playthroughs_status ON playthroughs(status);

-- Playthrough players
CREATE TABLE playthrough_players (
    playthrough_id INTEGER REFERENCES playthroughs(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    instrument VARCHAR(20) NOT NULL CHECK (instrument IN ('drums', 'guitar', 'bass', 'vocals')),
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    is_pro_mode BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (playthrough_id, user_id)
);

-- Playthrough songs
CREATE TABLE playthrough_songs (
    id SERIAL PRIMARY KEY,
    playthrough_id INTEGER REFERENCES playthroughs(id) ON DELETE CASCADE,
    song_id INTEGER REFERENCES songs(id) ON DELETE SET NULL,
    position INTEGER NOT NULL,
    screenshot_path TEXT
);

CREATE INDEX idx_playthrough_songs_playthrough ON playthrough_songs(playthrough_id);

-- Add FK to song_ratings now that playthrough_songs exists
ALTER TABLE song_ratings
    ADD CONSTRAINT fk_song_ratings_playthrough_song
    FOREIGN KEY (playthrough_song_id)
    REFERENCES playthrough_songs(id) ON DELETE SET NULL;

-- Playthrough song stats
CREATE TABLE playthrough_song_stats (
    id SERIAL PRIMARY KEY,
    playthrough_song_id INTEGER REFERENCES playthrough_songs(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER,
    notes_hit INTEGER,
    notes_missed INTEGER,
    longest_streak INTEGER,
    stars_earned INTEGER CHECK (stars_earned BETWEEN 1 AND 5),
    accuracy_pct NUMERIC(5,2),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playthrough_song_stats_song ON playthrough_song_stats(playthrough_song_id);

-- Refresh tokens for auth
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
