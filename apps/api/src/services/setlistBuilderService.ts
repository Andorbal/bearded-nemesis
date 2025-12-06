import { query } from '../db/pool.js';
import { loadConfig } from '../config.js';
import type {
  BuilderPreset,
  Instrument,
} from '@bearded-nemesis/shared';
import * as userSongRepo from '../repositories/userSongRepository.js';

const config = loadConfig();

// Types matching Python solver models
interface SongCandidate {
  song_id: number;
  duration_ms: number | null;
  bpm: number | null;
  difficulty: number;
  times_played: number;
  last_played_days_ago: number | null;
}

interface PlayerRating {
  user_id: number;
  play_rating: number | null;
  song_rating: number | null;
}

export interface SongWithRatings {
  song: SongCandidate;
  ratings: PlayerRating[];
}

interface SolverRequest {
  candidates: SongWithRatings[];
  objective: string;
  rating_aggregation: string;
  constraints: Record<string, unknown>;
  weight_play_rating?: number;
  weight_song_rating?: number;
  weight_discovery?: number;
}

interface SolverResponse {
  selected_song_ids: number[];
  status: string;
  objective_value?: number;
  message?: string;
}

/**
 * Gather candidate songs for setlist generation.
 * Only includes songs owned by host (they have the Xbox).
 */
export async function gatherCandidates(
  hostUserId: number,
  preset: BuilderPreset
): Promise<SongWithRatings[]> {
  // Get songs owned by host
  const ownedSongIds = await userSongRepo.getOwnedSongIds(hostUserId);

  if (ownedSongIds.length === 0) {
    return [];
  }

  // Fetch song data
  const songsData = await query<{
    id: number;
    duration_ms: number | null;
    bpm: number | null;
    difficulty_drums: number | null;
    difficulty_guitar: number | null;
    difficulty_bass: number | null;
    difficulty_vocals: number | null;
  }>(
    `SELECT id, duration_ms, bpm, difficulty_drums, difficulty_guitar, difficulty_bass, difficulty_vocals
     FROM songs
     WHERE id = ANY($1)`,
    [ownedSongIds]
  );

  // Get play counts for each song (count playthrough_song_stats entries)
  const playCountsData = await query<{ song_id: number; times_played: string }>(
    `SELECT ps.song_id, COUNT(DISTINCT pss.playthrough_song_id)::text as times_played
     FROM playthrough_songs ps
     LEFT JOIN playthrough_song_stats pss ON ps.id = pss.playthrough_song_id
     WHERE ps.song_id = ANY($1)
     GROUP BY ps.song_id`,
    [ownedSongIds]
  );

  const playCounts = new Map(playCountsData.map(pc => [pc.song_id, parseInt(pc.times_played, 10)]));

  // Get last played dates
  const lastPlayedData = await query<{ song_id: number; last_played_days: number }>(
    `SELECT ps.song_id,
            EXTRACT(EPOCH FROM (NOW() - MAX(pss.created_at))) / 86400 as last_played_days
     FROM playthrough_songs ps
     JOIN playthrough_song_stats pss ON ps.id = pss.playthrough_song_id
     WHERE ps.song_id = ANY($1)
     GROUP BY ps.song_id`,
    [ownedSongIds]
  );

  const lastPlayedDays = new Map(lastPlayedData.map(lp => [lp.song_id, Math.floor(lp.last_played_days)]));

  const playerUserIds = preset.players.map(p => p.userId);

  // Get average play ratings from song_ratings for all players
  const ratingsData = await query<{
    user_id: number;
    song_id: number;
    instrument: Instrument;
    avg_rating: number;
  }>(
    `SELECT user_id, song_id, instrument, AVG(rating)::float as avg_rating
     FROM song_ratings
     WHERE song_id = ANY($1) AND user_id = ANY($2)
     GROUP BY user_id, song_id, instrument`,
    [ownedSongIds, playerUserIds]
  );

  // Get song ratings from user_songs table
  const songRatingsData = await query<{
    user_id: number;
    song_id: number;
    song_rating: number | null;
  }>(
    `SELECT user_id, song_id, song_rating
     FROM user_songs
     WHERE song_id = ANY($1) AND user_id = ANY($2)`,
    [ownedSongIds, playerUserIds]
  );

  // Build lookup maps
  const playRatings = new Map<string, number>();
  for (const r of ratingsData) {
    const key = `${r.user_id}-${r.song_id}-${r.instrument}`;
    playRatings.set(key, r.avg_rating);
  }

  const songRatingsMap = new Map<string, number>();
  for (const sr of songRatingsData) {
    if (sr.song_rating !== null) {
      const key = `${sr.user_id}-${sr.song_id}`;
      songRatingsMap.set(key, sr.song_rating);
    }
  }

  // Build candidate list
  const candidates: SongWithRatings[] = [];

  for (const song of songsData) {
    // Determine difficulty (use first player's instrument as primary)
    const primaryInstrument = preset.players[0]?.instrument || 'drums';
    const diffKey = `difficulty_${primaryInstrument}` as keyof typeof song;
    const difficulty = (song[diffKey] as number | null) ?? 3;

    const candidate: SongCandidate = {
      song_id: song.id,
      duration_ms: song.duration_ms,
      bpm: song.bpm,
      difficulty,
      times_played: playCounts.get(song.id) || 0,
      last_played_days_ago: lastPlayedDays.get(song.id) ?? null,
    };

    // Gather ratings from each player
    const ratings: PlayerRating[] = [];
    for (const player of preset.players) {
      const playRatingKey = `${player.userId}-${song.id}-${player.instrument}`;
      const songRatingKey = `${player.userId}-${song.id}`;

      ratings.push({
        user_id: player.userId,
        play_rating: playRatings.get(playRatingKey) ?? null,
        song_rating: songRatingsMap.get(songRatingKey) ?? null,
      });
    }

    candidates.push({ song: candidate, ratings });
  }

  return candidates;
}

/**
 * Call the Python solver service to generate optimal setlist.
 */
export async function generateOptimalSetlist(
  hostUserId: number,
  preset: BuilderPreset
): Promise<number[]> {
  // Gather candidates
  const candidates = await gatherCandidates(hostUserId, preset);

  if (candidates.length === 0) {
    throw new Error('No candidate songs found. Host must own songs.');
  }

  // Convert constraints to solver format (snake_case)
  const constraints: Record<string, unknown> = {};
  if (preset.constraints.songCountMin !== undefined) {
    constraints.song_count_min = preset.constraints.songCountMin;
  }
  if (preset.constraints.songCountMax !== undefined) {
    constraints.song_count_max = preset.constraints.songCountMax;
  }
  if (preset.constraints.maxDurationMinutes !== undefined) {
    constraints.max_duration_minutes = preset.constraints.maxDurationMinutes;
  }
  if (preset.constraints.minAvgPlayRating !== undefined) {
    constraints.min_avg_play_rating = preset.constraints.minAvgPlayRating;
  }
  if (preset.constraints.minAvgSongRating !== undefined) {
    constraints.min_avg_song_rating = preset.constraints.minAvgSongRating;
  }
  if (preset.constraints.difficultyMin !== undefined) {
    constraints.difficulty_min = preset.constraints.difficultyMin;
  }
  if (preset.constraints.difficultyMax !== undefined) {
    constraints.difficulty_max = preset.constraints.difficultyMax;
  }
  if (preset.constraints.unplayedMinimum !== undefined) {
    constraints.unplayed_minimum = preset.constraints.unplayedMinimum;
  }
  if (preset.constraints.avoidPlayedWithinDays !== undefined) {
    constraints.avoid_played_within_days = preset.constraints.avoidPlayedWithinDays;
  }
  if (preset.constraints.bpmMin !== undefined) {
    constraints.bpm_min = preset.constraints.bpmMin;
  }
  if (preset.constraints.bpmMax !== undefined) {
    constraints.bpm_max = preset.constraints.bpmMax;
  }
  if (preset.constraints.requiredSongIds !== undefined) {
    constraints.required_song_ids = preset.constraints.requiredSongIds;
  }
  if (preset.constraints.excludedSongIds !== undefined) {
    constraints.excluded_song_ids = preset.constraints.excludedSongIds;
  }

  // Build solver request
  const solverRequest: SolverRequest = {
    candidates,
    objective: preset.objective,
    rating_aggregation: preset.ratingAggregation,
    constraints,
  };

  // If combined objective, use equal weights by default
  if (preset.objective === 'combined') {
    solverRequest.weight_play_rating = 0.333;
    solverRequest.weight_song_rating = 0.333;
    solverRequest.weight_discovery = 0.334;
  }

  // Call solver
  const response = await fetch(`${config.solverUrl}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(solverRequest),
  });

  if (!response.ok) {
    throw new Error(`Solver returned ${response.status}: ${await response.text()}`);
  }

  const result = (await response.json()) as SolverResponse;

  if (result.status === 'infeasible') {
    throw new Error(result.message || 'No feasible solution found for given constraints');
  }

  return result.selected_song_ids;
}
