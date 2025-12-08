import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as playthroughService from '../services/playthroughService.js';
import * as playthroughRepo from '../repositories/playthroughRepository.js';
import * as playthroughPlayerRepo from '../repositories/playthroughPlayerRepository.js';
import * as playthroughSongRepo from '../repositories/playthroughSongRepository.js';
import * as playthroughSongStatsRepo from '../repositories/playthroughSongStatsRepository.js';
import * as setlistRepo from '../repositories/setlistRepository.js';
import * as songRepo from '../repositories/songRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as screenshotService from '../services/screenshotService.js';
import * as ocrService from '../services/ocrService.js';
import { connectionManager } from './ws-playthroughs.js';
import { INSTRUMENTS, DIFFICULTIES } from '@bearded-nemesis/shared';
import type { WsServerMessage } from '@bearded-nemesis/shared';

const createPlaythroughSchema = z.object({
  setlistId: z.number(),
  players: z.array(
    z.object({
      userId: z.number(),
      instrument: z.enum(INSTRUMENTS),
      difficulty: z.enum(DIFFICULTIES),
      proMode: z.boolean(),
    })
  ),
});

const playthroughIdSchema = z.object({
  id: z.coerce.number(),
});

const submitRatingSchema = z.object({
  rating: z.number().min(1).max(5),
});

const positionSchema = z.object({
  position: z.coerce.number().min(0),
});

const updateStatsSchema = z.object({
  score: z.number().optional(),
  accuracyPct: z.number().min(0).max(100).optional(),
  notesHit: z.number().min(0).optional(),
  notesMissed: z.number().min(0).optional(),
  longestStreak: z.number().min(0).optional(),
  starsEarned: z.number().min(1).max(6).optional(),
});

const statsUserIdSchema = z.object({
  userId: z.coerce.number(),
});

const playthroughRoutes: FastifyPluginAsync = async (app) => {
  // All routes require authentication
  app.addHook('onRequest', app.authenticate);

  // List user's playthroughs (as host or participant)
  app.get('/', async (request) => {
    const playthroughs = await playthroughRepo.findByUser(request.user.userId);
    return { playthroughs };
  });

  // Get active playthroughs (sessions in progress)
  app.get('/active', async () => {
    const playthroughs = await playthroughRepo.findActive();
    return { playthroughs };
  });

  // Create new playthrough
  app.post('/', async (request, reply) => {
    const body = createPlaythroughSchema.parse(request.body);

    // Verify setlist exists and user has access
    const setlist = await setlistRepo.findById(body.setlistId);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      const result = await playthroughService.createPlaythrough(
        request.user.userId,
        body.setlistId,
        body.players
      );

      return result.playthrough;
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to create playthrough',
        details: (error as Error).message,
      });
    }
  });

  // Get playthrough details
  app.get('/:id', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);

    const playthrough = await playthroughRepo.findById(id);
    if (!playthrough) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    // Check access: host or participant
    const isHost = playthrough.createdBy === request.user.userId;
    const isParticipant = await playthroughPlayerRepo.isPlayer(id, request.user.userId);

    if (!isHost && !isParticipant && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const players = await playthroughPlayerRepo.getPlayers(id);
    const songs = await playthroughSongRepo.getSongs(id);

    return {
      ...playthrough,
      players,
      songs,
    };
  });

  // Get playthrough summary (for completion screen)
  app.get('/:id/summary', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);

    const playthrough = await playthroughRepo.findById(id);
    if (!playthrough) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    // Check access: host or participant
    const isHost = playthrough.createdBy === request.user.userId;
    const isParticipant = await playthroughPlayerRepo.isPlayer(id, request.user.userId);

    if (!isHost && !isParticipant && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Fetch all related data
    const setlist = await setlistRepo.findById(playthrough.setlistId);
    const players = await playthroughPlayerRepo.getPlayers(id);
    const playthroughSongs = await playthroughSongRepo.getSongs(id);
    const allStats = await playthroughSongStatsRepo.getStatsForPlaythrough(id);

    // Batch fetch all unique users and songs to avoid N+1 queries
    const uniqueUserIds = Array.from(new Set(allStats.map((s) => s.userId)));
    const uniqueSongIds = Array.from(new Set(playthroughSongs.map((ps) => ps.songId)));

    const userMap = await userRepo.findByIds(uniqueUserIds);
    const songMap = await songRepo.findByIds(uniqueSongIds);

    // Build song data with ratings and stats
    const songs = playthroughSongs.map((ps) => {
      const song = songMap.get(ps.songId);

      // Get stats for this song
      const songStats = allStats.filter((s) => s.playthroughSongId === ps.id);

      // Build stats array with username
      const stats = songStats.map((stat) => {
        const user = userMap.get(stat.userId);
        return {
          userId: stat.userId,
          username: user?.username || 'Unknown',
          score: stat.score,
          accuracyPct: stat.accuracyPct,
          notesHit: stat.notesHit,
          notesMissed: stat.notesMissed,
          longestStreak: stat.longestStreak,
          starsEarned: stat.starsEarned,
        };
      });

      // Build ratings array
      const ratings = songStats
        .filter((s) => s.rating !== null)
        .map((s) => ({
          userId: s.userId,
          username: stats.find((st) => st.userId === s.userId)?.username || 'Unknown',
          rating: s.rating!,
        }));

      return {
        position: ps.position,
        song: song!,
        screenshotPath: ps.screenshotPath
          ? screenshotService.getScreenshotUrl(ps.screenshotPath)
          : null,
        ocrStatus: ps.ocrStatus,
        ratings,
        stats,
      };
    });

    return {
      playthrough,
      setlist: setlist ? { id: setlist.id, name: setlist.name } : null,
      players,
      songs,
    };
  });

  // Advance to next song (host only)
  app.patch('/:id/advance', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);

    const isHost = await playthroughService.isHost(id, request.user.userId);
    if (!isHost && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Only host can advance songs' });
    }

    const updated = await playthroughService.advanceToNextSong(id);
    if (!updated) {
      return reply.status(400).send({ error: 'Already at end of setlist' });
    }

    // Get the new current song and broadcast to WebSocket clients
    const playthroughSong = await playthroughSongRepo.getSongAtPosition(id, updated.currentPosition);
    if (playthroughSong) {
      const song = await songRepo.findById(playthroughSong.songId);
      if (song) {
        const message: WsServerMessage = {
          type: 'song_advanced',
          position: updated.currentPosition,
          song,
        };
        connectionManager.broadcast(id, message);
      }
    }

    return updated;
  });

  // Go back to previous song (host only)
  app.patch('/:id/back', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);

    const isHost = await playthroughService.isHost(id, request.user.userId);
    if (!isHost && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Only host can control songs' });
    }

    const updated = await playthroughService.goBackToPreviousSong(id);
    if (!updated) {
      return reply.status(400).send({ error: 'Already at start of setlist' });
    }

    // Get the new current song and broadcast to WebSocket clients
    const playthroughSong = await playthroughSongRepo.getSongAtPosition(id, updated.currentPosition);
    if (playthroughSong) {
      const song = await songRepo.findById(playthroughSong.songId);
      if (song) {
        const message: WsServerMessage = {
          type: 'song_back',
          position: updated.currentPosition,
          song,
        };
        connectionManager.broadcast(id, message);
      }
    }

    return updated;
  });

  // Finish playthrough (host only)
  app.post('/:id/finish', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);

    const isHost = await playthroughService.isHost(id, request.user.userId);
    if (!isHost && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Only host can finish playthrough' });
    }

    const finished = await playthroughService.finishPlaythrough(id);
    if (!finished) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    // Calculate summary statistics
    const players = await playthroughPlayerRepo.getPlayers(id);
    const songs = await playthroughSongRepo.getSongs(id);
    const playerStats: Record<string, { avgRating: number; songsRated: number }> = {};

    for (const player of players) {
      const user = await userRepo.findById(player.userId);
      if (!user) continue;

      let totalRating = 0;
      let ratedCount = 0;

      for (const song of songs) {
        const stats = await playthroughSongStatsRepo.getForUserAndSong(player.userId, song.id);
        if (stats && stats.rating !== null) {
          totalRating += stats.rating;
          ratedCount++;
        }
      }

      playerStats[user.username] = {
        avgRating: ratedCount > 0 ? totalRating / ratedCount : 0,
        songsRated: ratedCount,
      };
    }

    // Broadcast finish message with summary
    const message: WsServerMessage = {
      type: 'playthrough_finished',
      summary: {
        totalSongs: songs.length,
        completedSongs: finished.currentPosition + 1,
        playerStats,
      },
    };
    connectionManager.broadcast(id, message);

    // Clean up connections
    connectionManager.cleanupPlaythrough(id);

    return finished;
  });

  // Join playthrough as participant (add self as player)
  app.post('/:id/join', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);
    const body = z
      .object({
        instrument: z.enum(INSTRUMENTS),
        difficulty: z.enum(DIFFICULTIES),
        proMode: z.boolean(),
      })
      .parse(request.body);

    const playthrough = await playthroughRepo.findById(id);
    if (!playthrough) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    if (playthrough.status !== 'in_progress') {
      return reply.status(400).send({ error: 'Cannot join finished playthrough' });
    }

    // Check if already a player
    const alreadyPlayer = await playthroughPlayerRepo.isPlayer(id, request.user.userId);
    if (alreadyPlayer) {
      return reply.status(400).send({ error: 'Already a participant' });
    }

    try {
      const player = await playthroughPlayerRepo.addPlayer({
        playthroughId: id,
        userId: request.user.userId,
        instrument: body.instrument,
        difficulty: body.difficulty,
        isProMode: body.proMode,
      });

      // Broadcast player joined
      const message: WsServerMessage = {
        type: 'player_joined',
        user: request.user.username,
      };
      connectionManager.broadcast(id, message);

      return player;
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to join playthrough',
        details: (error as Error).message,
      });
    }
  });

  // Submit rating for song at position (any participant)
  app.post('/:id/songs/:position/rating', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);
    const { position } = positionSchema.parse(request.params);
    const { rating } = submitRatingSchema.parse(request.body);

    const playthrough = await playthroughRepo.findById(id);
    if (!playthrough) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    // Verify user is a participant
    const isParticipant = await playthroughService.isParticipant(id, request.user.userId);
    if (!isParticipant && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Must be a participant to submit ratings' });
    }

    try {
      const stats = await playthroughService.submitRating(
        id,
        request.user.userId,
        position,
        rating
      );

      // Broadcast rating submission
      const message: WsServerMessage = {
        type: 'rating_submitted',
        user: request.user.username,
        rating,
      };
      connectionManager.broadcast(id, message);

      return stats;
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to submit rating',
        details: (error as Error).message,
      });
    }
  });

  // Get ratings for song at position
  app.get('/:id/songs/:position/ratings', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);
    const { position } = positionSchema.parse(request.params);

    const playthrough = await playthroughRepo.findById(id);
    if (!playthrough) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    const playthroughSong = await playthroughSongRepo.getSongAtPosition(id, position);
    if (!playthroughSong) {
      return reply.status(404).send({ error: 'Song not found at position' });
    }

    const stats = await playthroughSongStatsRepo.getForPlaythroughSong(playthroughSong.id);

    return { stats };
  });

  // Upload screenshot for song at position (Task 10.5)
  app.post('/:id/songs/:position/screenshot', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);
    const { position } = positionSchema.parse(request.params);

    const playthrough = await playthroughRepo.findById(id);
    if (!playthrough) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    // Verify user is a participant
    const isParticipant = await playthroughService.isParticipant(id, request.user.userId);
    if (!isParticipant && !request.user.isAdmin) {
      return reply
        .status(403)
        .send({ error: 'Must be a participant to upload screenshots' });
    }

    // Get the playthrough song
    const playthroughSong = await playthroughSongRepo.getSongAtPosition(id, position);
    if (!playthroughSong) {
      return reply.status(404).send({ error: 'Song not found at position' });
    }

    // Get uploaded file
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Validate content type
    if (!data.mimetype.startsWith('image/')) {
      return reply.status(400).send({ error: 'File must be an image' });
    }

    try {
      // Save screenshot
      const screenshotPath = screenshotService.generateScreenshotPath(id, position);
      const buffer = await data.toBuffer();
      await screenshotService.saveScreenshot(buffer, screenshotPath);

      // Update playthrough_songs table with screenshot path and set pending OCR status
      await playthroughSongRepo.updateScreenshot(playthroughSong.id, screenshotPath);
      await playthroughSongRepo.updateOcrStatus(id, position, 'pending');

      // Trigger OCR processing asynchronously (don't wait for result)
      ocrService.processScreenshot(id, position, screenshotPath).catch((error) => {
        console.error('OCR processing failed:', error);
      });

      // Broadcast screenshot upload to connected clients
      const song = await songRepo.findById(playthroughSong.songId);
      const message: WsServerMessage = {
        type: 'screenshot_uploaded',
        position,
        song: song!,
      };
      connectionManager.broadcast(id, message);

      return {
        success: true,
        screenshotPath: screenshotService.getScreenshotUrl(screenshotPath),
        message: 'Screenshot uploaded. OCR processing started.',
      };
    } catch (error) {
      console.error('Screenshot upload failed:', error);
      return reply.status(500).send({
        error: 'Failed to save screenshot',
        details: (error as Error).message,
      });
    }
  });

  // Retry failed OCR job
  app.post('/:id/songs/:position/retry-ocr', async (request, reply) => {
    const { id } = playthroughIdSchema.parse(request.params);
    const { position } = positionSchema.parse(request.params);

    const playthrough = await playthroughRepo.findById(id);
    if (!playthrough) {
      return reply.status(404).send({ error: 'Playthrough not found' });
    }

    // Verify user is a participant
    const isParticipant = await playthroughService.isParticipant(id, request.user.userId);
    if (!isParticipant && !request.user.isAdmin) {
      return reply
        .status(403)
        .send({ error: 'Must be a participant to retry OCR' });
    }

    try {
      // Start retry in background (don't await)
      ocrService.retryOcr(id, position).catch((error) => {
        console.error('OCR retry failed:', error);
      });

      return { success: true, message: 'OCR retry started' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retry failed';
      return reply.status(400).send({ error: message });
    }
  });

  // Update stats for a player on a song (for OCR correction)
  app.patch('/:id/songs/:position/stats/:userId', async (request, reply) => {
    try {
      const { id } = playthroughIdSchema.parse(request.params);
      const { position } = positionSchema.parse(request.params);
      const { userId } = statsUserIdSchema.parse(request.params);
      const updates = updateStatsSchema.parse(request.body);

      const playthrough = await playthroughRepo.findById(id);
      if (!playthrough) {
        return reply.status(404).send({ error: 'Playthrough not found' });
      }

      // Verify user is a participant
      const isParticipant = await playthroughService.isParticipant(id, request.user.userId);
      if (!isParticipant && !request.user.isAdmin) {
        return reply.status(403).send({ error: 'Must be a participant to edit stats' });
      }

      // Get the playthrough song
      const playthroughSong = await playthroughSongRepo.getSongAtPosition(id, position);
      if (!playthroughSong) {
        return reply.status(404).send({ error: 'Song not found at position' });
      }

      // Find existing stats record
      const stats = await playthroughSongStatsRepo.getForUserAndSong(userId, playthroughSong.id);
      if (!stats) {
        return reply.status(404).send({ error: 'Stats not found for this user and song' });
      }

      // Update the stats
      const updated = await playthroughSongStatsRepo.update(stats.id, updates);

      return updated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      throw error;
    }
  });
};

export default playthroughRoutes;
