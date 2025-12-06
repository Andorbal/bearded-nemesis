import * as playthroughRepo from '../repositories/playthroughRepository.js';
import * as playthroughPlayerRepo from '../repositories/playthroughPlayerRepository.js';
import * as playthroughSongRepo from '../repositories/playthroughSongRepository.js';
import * as playthroughSongStatsRepo from '../repositories/playthroughSongStatsRepository.js';
import * as setlistSongRepo from '../repositories/setlistSongRepository.js';
import type {
  Playthrough,
  PlaythroughPlayer,
  PlaythroughSong,
  PlaythroughSongStats,
  BuilderPlayer,
} from '@bearded-nemesis/shared';

interface CreatePlaythroughResult {
  playthrough: Playthrough;
  players: PlaythroughPlayer[];
  songs: PlaythroughSong[];
}

/**
 * Create a new playthrough from a setlist with specified players.
 * This copies songs from the setlist (snapshot) and registers players.
 */
export async function createPlaythrough(
  hostUserId: number,
  setlistId: number,
  players: BuilderPlayer[]
): Promise<CreatePlaythroughResult> {
  // Verify setlist has songs
  const setlistSongs = await setlistSongRepo.getSongs(setlistId);
  if (setlistSongs.length === 0) {
    throw new Error('Cannot create playthrough from empty setlist');
  }

  // Create playthrough
  const playthrough = await playthroughRepo.create({
    setlistId,
    createdBy: hostUserId,
  });

  // Copy songs from setlist to playthrough
  await playthroughSongRepo.copySongsFromSetlist(playthrough.id, setlistId);

  // Add players
  const addedPlayers: PlaythroughPlayer[] = [];
  for (const player of players) {
    const added = await playthroughPlayerRepo.addPlayer({
      playthroughId: playthrough.id,
      userId: player.userId,
      instrument: player.instrument,
      difficulty: player.difficulty,
      isProMode: player.proMode,
    });
    addedPlayers.push(added);
  }

  // Get copied songs
  const songs = await playthroughSongRepo.getSongs(playthrough.id);

  return {
    playthrough,
    players: addedPlayers,
    songs,
  };
}

/**
 * Advance to the next song in the playthrough.
 * Returns null if already at the end.
 */
export async function advanceToNextSong(
  playthroughId: number
): Promise<Playthrough | null> {
  const playthrough = await playthroughRepo.findById(playthroughId);
  if (!playthrough) {
    throw new Error('Playthrough not found');
  }

  const totalSongs = await playthroughSongRepo.countSongs(playthroughId);
  const nextPosition = playthrough.currentPosition + 1;

  // Check if we'd go past the end
  if (nextPosition >= totalSongs) {
    return null;
  }

  return await playthroughRepo.updatePosition(playthroughId, nextPosition);
}

/**
 * Go back to the previous song in the playthrough.
 * Returns null if already at the start.
 */
export async function goBackToPreviousSong(
  playthroughId: number
): Promise<Playthrough | null> {
  const playthrough = await playthroughRepo.findById(playthroughId);
  if (!playthrough) {
    throw new Error('Playthrough not found');
  }

  const prevPosition = playthrough.currentPosition - 1;

  // Check if we'd go before the start
  if (prevPosition < 0) {
    return null;
  }

  return await playthroughRepo.updatePosition(playthroughId, prevPosition);
}

/**
 * Submit a rating for a song in the playthrough.
 */
export async function submitRating(
  playthroughId: number,
  userId: number,
  position: number,
  rating: number
): Promise<PlaythroughSongStats> {
  // Get the playthrough song at this position
  const playthroughSong = await playthroughSongRepo.getSongAtPosition(
    playthroughId,
    position
  );

  if (!playthroughSong) {
    throw new Error(`No song found at position ${position}`);
  }

  // Check if user already has stats for this song
  const existing = await playthroughSongStatsRepo.getForUserAndSong(
    userId,
    playthroughSong.id
  );

  if (existing) {
    // Update existing rating
    const updated = await playthroughSongStatsRepo.update(existing.id, { rating });
    if (!updated) {
      throw new Error('Failed to update rating');
    }
    return updated;
  } else {
    // Create new stats entry with just rating
    return await playthroughSongStatsRepo.create({
      playthroughSongId: playthroughSong.id,
      userId,
      rating,
    });
  }
}

/**
 * Finish the playthrough.
 */
export async function finishPlaythrough(
  playthroughId: number
): Promise<Playthrough | null> {
  return await playthroughRepo.finish(playthroughId);
}

/**
 * Check if a user is the host of a playthrough.
 */
export async function isHost(playthroughId: number, userId: number): Promise<boolean> {
  const playthrough = await playthroughRepo.findById(playthroughId);
  return playthrough?.createdBy === userId;
}

/**
 * Check if a user is a participant in a playthrough.
 */
export async function isParticipant(
  playthroughId: number,
  userId: number
): Promise<boolean> {
  return await playthroughPlayerRepo.isPlayer(playthroughId, userId);
}
