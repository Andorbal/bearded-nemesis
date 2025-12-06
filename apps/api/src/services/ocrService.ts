import * as gamertagMatcher from './gamertagMatcher.js';
import * as playthroughSongRepo from '../repositories/playthroughSongRepository.js';
import * as playthroughSongStatsRepo from '../repositories/playthroughSongStatsRepository.js';
import { connectionManager } from '../routes/ws-playthroughs.js';
import type { WsServerMessage, OcrStatus } from '@bearded-nemesis/shared';

const SOLVER_URL = process.env.SOLVER_URL || 'http://solver:8081';

interface OcrPlayerStats {
  gamertag: string;
  accuracy_pct?: number;
  difficulty?: string;
  score?: number;
  stars_earned?: number;
  longest_streak?: number;
  notes_hit?: number;
  notes_missed?: number;
  avg_multiplier?: number;
}

interface OcrResponse {
  success: boolean;
  song_title?: string;
  band_score?: number;
  players: OcrPlayerStats[];
  errors: string[];
  raw_text?: string;
}

/**
 * Call the Python solver OCR endpoint.
 *
 * @param imagePath - Path to the screenshot image
 * @returns OCR response or null if request failed
 */
async function callOcrEndpoint(imagePath: string): Promise<OcrResponse | null> {
  try {
    const response = await fetch(`${SOLVER_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath }),
    });

    if (!response.ok) {
      console.error(`OCR request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    return (await response.json()) as OcrResponse;
  } catch (error) {
    console.error('OCR request error:', error);
    return null;
  }
}

/**
 * Process a screenshot with OCR and save extracted stats.
 *
 * This function:
 * 1. Marks OCR status as 'processing'
 * 2. Calls the Python solver's OCR endpoint
 * 3. Matches extracted gamertags to known users
 * 4. Saves stats for matched players
 * 5. Marks OCR status as 'completed' or 'failed'
 * 6. Broadcasts OCR completion to connected clients
 *
 * @param playthroughId - The playthrough ID
 * @param position - Song position in the setlist
 * @param screenshotPath - Path to the screenshot file
 */
export async function processScreenshot(
  playthroughId: number,
  position: number,
  screenshotPath: string
): Promise<void> {
  // Mark as processing
  await playthroughSongRepo.updateOcrStatus(playthroughId, position, 'processing');

  try {
    // Call solver OCR endpoint
    const result = await callOcrEndpoint(screenshotPath);

    if (!result) {
      const errorMsg = 'OCR request failed';
      await playthroughSongRepo.updateOcrStatus(playthroughId, position, 'failed', errorMsg);
      console.warn(`${errorMsg} for playthrough ${playthroughId} position ${position}`);
      return;
    }

    if (!result.success || result.players.length === 0) {
      const errorMsg = result.errors?.join(', ') || 'No players detected';
      await playthroughSongRepo.updateOcrStatus(playthroughId, position, 'failed', errorMsg);
      console.warn(`OCR failed for playthrough ${playthroughId} position ${position}: ${errorMsg}`);
      return;
    }

    // Get playthrough_song record
    const song = await playthroughSongRepo.getSongAtPosition(playthroughId, position);
    if (!song) {
      const errorMsg = 'Playthrough song not found';
      await playthroughSongRepo.updateOcrStatus(playthroughId, position, 'failed', errorMsg);
      console.error(`${errorMsg}: ${playthroughId} position ${position}`);
      return;
    }

    // Match gamertags to users
    const gamertags = result.players.map((p) => p.gamertag);
    const users = await gamertagMatcher.matchGamertags(gamertags);

    // Save stats for each matched player
    let matchedCount = 0;
    for (let i = 0; i < result.players.length; i++) {
      const player = result.players[i];
      const user = users[i];

      if (!user) {
        console.warn(`Could not match gamertag: ${player.gamertag}`);
        continue;
      }

      // Check if stats already exist for this user/song
      const existingStats = await playthroughSongStatsRepo.getForUserAndSong(
        user.id,
        song.id
      );

      if (existingStats) {
        // Update existing stats with OCR data
        await playthroughSongStatsRepo.update(existingStats.id, {
          score: player.score ?? existingStats.score,
          notesHit: player.notes_hit ?? existingStats.notesHit,
          notesMissed: player.notes_missed ?? existingStats.notesMissed,
          longestStreak: player.longest_streak ?? existingStats.longestStreak,
          starsEarned: player.stars_earned ?? existingStats.starsEarned,
          accuracyPct: player.accuracy_pct ?? existingStats.accuracyPct,
        });
      } else {
        // Create new stats record
        await playthroughSongStatsRepo.create({
          playthroughSongId: song.id,
          userId: user.id,
          score: player.score ?? null,
          notesHit: player.notes_hit ?? null,
          notesMissed: player.notes_missed ?? null,
          longestStreak: player.longest_streak ?? null,
          starsEarned: player.stars_earned ?? null,
          accuracyPct: player.accuracy_pct ?? null,
        });
      }

      matchedCount++;
    }

    // Mark as completed
    await playthroughSongRepo.updateOcrStatus(playthroughId, position, 'completed');

    console.log(
      `OCR completed for playthrough ${playthroughId} position ${position}: ${matchedCount} players matched`
    );

    // Broadcast OCR completion to connected clients
    const message: WsServerMessage = {
      type: 'ocr_completed',
      position,
      playersMatched: matchedCount,
    };
    connectionManager.broadcast(playthroughId, message);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await playthroughSongRepo.updateOcrStatus(playthroughId, position, 'failed', errorMsg);
    console.error(`OCR error for playthrough ${playthroughId} position ${position}:`, error);
  }
}

/**
 * Get the OCR solver URL (for testing).
 */
export function getSolverUrl(): string {
  return SOLVER_URL;
}

/**
 * Retry OCR for a failed job.
 * Clears existing stats and restarts processing.
 *
 * @param playthroughId - The playthrough ID
 * @param position - Song position in the setlist
 * @throws Error if song not found, no screenshot, or OCR not in failed state
 */
export async function retryOcr(playthroughId: number, position: number): Promise<void> {
  const song = await playthroughSongRepo.getSongAtPosition(playthroughId, position);

  if (!song) {
    throw new Error('Song not found');
  }

  if (!song.screenshotPath) {
    throw new Error('No screenshot to process');
  }

  if (song.ocrStatus !== 'failed') {
    throw new Error('Can only retry failed OCR jobs');
  }

  // Clear existing stats for this song (in case of partial success)
  await playthroughSongRepo.clearPlayerStats(song.id);

  // Restart processing
  await processScreenshot(playthroughId, position, song.screenshotPath);
}
