# Shared Package

The shared package contains TypeScript types and constants used by both the API and frontend. By centralizing these definitions, we ensure type consistency across the entire stack and avoid duplicating code.

## Building

The package must be built before the API or frontend can use it:

```bash
pnpm build
```

For development with automatic rebuilding:

```bash
pnpm dev
```

This runs TypeScript in watch mode, recompiling whenever source files change.

## Contents

### Constants

The `constants.ts` file defines domain-specific constants and their TypeScript types:

**INSTRUMENTS** lists the four Rock Band instruments: drums, guitar, bass, and vocals.

**DIFFICULTIES** defines the in-game difficulty levels: easy, medium, hard, and expert.

**SETLIST_TYPES** enumerates the three setlist creation methods: manual, smart, and builder.

**PLAYTHROUGH_STATUSES** tracks whether a playthrough is in_progress or finished.

**RATING_AGGREGATIONS** defines how multiple player ratings are combined: average, minimum, or maximum.

The file also exports difficulty and rating bounds. Song difficulties use a 1-7 scale (the dots shown in Rock Band), while user ratings use a 1-5 star scale.

### Types

The `types.ts` file contains TypeScript interfaces for all domain entities:

**User types** define user accounts with fields for username, display name, Xbox gamertag, and admin status.

**Song types** represent the song catalog with metadata like title, artist, duration, BPM, and per-instrument difficulty ratings.

**UserSong** tracks which songs a user owns and their overall song rating.

**SongRating** stores per-instrument play ratings with optional linkage to specific playthrough songs.

**Setlist types** define setlists and their associated songs, with separate interfaces for smart filter criteria and builder presets.

**BuilderPreset** specifies the configuration for optimized setlist generation, including players, objective type, rating aggregation method, and constraints.

**Playthrough types** model active play sessions with players, songs, and per-song statistics including OCR-extracted performance data.

**WebSocket message types** define the protocol for real-time communication between the API and frontend during playthroughs. Server messages include state syncs, song advancement, player events, and OCR completion. Client messages handle rating submissions.

## Usage

Both the API and frontend import from this package:

```typescript
import { Song, Setlist, INSTRUMENTS } from '@bearded-nemesis/shared';
```

The package is linked via pnpm workspaces, so changes to the shared code require rebuilding before they're visible to consuming packages.
