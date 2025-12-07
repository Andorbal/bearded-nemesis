import * as gamertagMatcher from './gamertagMatcher.js';
import * as playthroughSongRepo from '../repositories/playthroughSongRepository.js';
import * as playthroughSongStatsRepo from '../repositories/playthroughSongStatsRepository.js';
import { connectionManager } from '../routes/ws-playthroughs.js';
import type { WsServerMessage, OcrStatus } from '@bearded-nemesis/shared';

const SOLVER_URL = process.env.SOLVER_URL || 'http://solver:8081';

/**
 * Convert host screenshot path to container path for Solver.
 * Host: ../../screenshots/file.jpg -> Container: /screenshots/file.jpg
 */
function toContainerPath(hostPath: string): string {
  // Extract just the filename from the path
  const filename = hostPath.split('/').pop() || '';
  return `/screenshots/${filename}`;
}

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

interface OcrJobSubmitResponse {
  job_id: string;
  status: string;
}

interface OcrJobStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  image_path: string;
  result: OcrResponse | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Submit an OCR job to the Python solver.
 *
 * @param imagePath - Path to the screenshot image (host path)
 * @returns Job ID or null if request failed
 */
async function submitOcrJob(imagePath: string): Promise<string | null> {
  try {
    const containerPath = toContainerPath(imagePath);
    const response = await fetch(`${SOLVER_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: containerPath }),
    });

    if (!response.ok) {
      console.error(`OCR job submission failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = (await response.json()) as OcrJobSubmitResponse;
    return result.job_id;
  } catch (error) {
    console.error('OCR job submission error:', error);
    return null;
  }
}

/**
 * Poll for OCR job completion.
 *
 * @param jobId - The OCR job ID
 * @param maxAttempts - Maximum number of polling attempts (default: 60)
 * @param intervalMs - Polling interval in milliseconds (default: 1000)
 * @returns OCR result or null if failed/timeout
 */
async function pollOcrJob(
  jobId: string,
  maxAttempts: number = 60,
  intervalMs: number = 1000
): Promise<OcrResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${SOLVER_URL}/ocr/${jobId}`);

      if (!response.ok) {
        console.error(`OCR job polling failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const status = (await response.json()) as OcrJobStatusResponse;

      if (status.status === 'completed' || status.status === 'failed') {
        return status.result;
      }

      // Job still processing, wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error('OCR job polling error:', error);
      return null;
    }
  }

  console.error(`OCR job ${jobId} timed out after ${maxAttempts} attempts`);
  return null;
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
    // Submit OCR job to solver
    const jobId = await submitOcrJob(screenshotPath);

    if (!jobId) {
      const errorMsg = 'OCR job submission failed';
      await playthroughSongRepo.updateOcrStatus(playthroughId, position, 'failed', errorMsg);
      console.warn(`${errorMsg} for playthrough ${playthroughId} position ${position}`);
      return;
    }

    console.log(`OCR job ${jobId} submitted for playthrough ${playthroughId} position ${position}`);

    // Poll for OCR completion
    const result = await pollOcrJob(jobId);

    if (!result) {
      const errorMsg = 'OCR job failed or timed out';
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
          // stars_earned must be 1-5 or null; 0 indicates OCR detection failure
          starsEarned: player.stars_earned || existingStats.starsEarned,
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
          // stars_earned must be 1-5 or null; 0 indicates OCR detection failure
          starsEarned: player.stars_earned || null,
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
