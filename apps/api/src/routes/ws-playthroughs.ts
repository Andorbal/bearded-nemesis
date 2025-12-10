import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { WebSocket } from 'ws';
import { WsConnectionManager } from '../services/wsConnectionManager.js';
import * as playthroughRepo from '../repositories/playthroughRepository.js';
import * as playthroughPlayerRepo from '../repositories/playthroughPlayerRepository.js';
import * as playthroughSongRepo from '../repositories/playthroughSongRepository.js';
import * as playthroughSongStatsRepo from '../repositories/playthroughSongStatsRepository.js';
import * as songRepo from '../repositories/songRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import type { WsClientMessage, WsServerMessage, PlaythroughState, Song, JwtPayload } from '@bearded-nemesis/shared';

const playthroughIdSchema = z.object({
  id: z.coerce.number(),
});

const submitRatingMessageSchema = z.object({
  type: z.literal('submit_rating'),
  rating: z.number().min(1).max(5),
});

// Singleton connection manager
const connectionManager = new WsConnectionManager();

// Export for use in REST endpoints
export { connectionManager };

const wsPlaythroughRoutes: FastifyPluginAsync = async (app) => {
  app.get('/playthroughs/:id/live', { websocket: true }, async (socket, request) => {
    const { id: playthroughId } = playthroughIdSchema.parse(request.params);

    // JWT Authentication
    // Check query string first (?token=xxx), then Authorization header
    let token: string | undefined;

    const queryToken = (request.query as any).token;
    if (queryToken && typeof queryToken === 'string') {
      token = queryToken;
    } else {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      socket.close(1008, 'Authentication required');
      return;
    }

    // Verify JWT token
    let userId: number;
    let username: string;
    try {
      const decoded = app.jwt.verify(token) as JwtPayload;
      userId = decoded.userId;
      username = decoded.username;
    } catch {
      socket.close(1008, 'Invalid token');
      return;
    }

    // Verify playthrough exists
    const playthrough = await playthroughRepo.findById(playthroughId);
    if (!playthrough) {
      socket.close(1008, 'Playthrough not found');
      return;
    }

    // Verify user is host or participant
    const isHost = playthrough.createdBy === userId;
    const isParticipant = await playthroughPlayerRepo.isPlayer(playthroughId, userId);

    if (!isHost && !isParticipant) {
      socket.close(1008, 'Forbidden: Must be host or participant');
      return;
    }

    // Add connection to manager
    connectionManager.addConnection(playthroughId, userId, socket);

    // Send initial state sync
    try {
      const state = await buildPlaythroughState(playthroughId, playthrough.currentPosition);
      const message: WsServerMessage = {
        type: 'state_sync',
        state,
      };
      socket.send(JSON.stringify(message));
    } catch (err) {
      console.error('[WS] Error sending initial state:', err);
    }

    // Broadcast player joined (to others only)
    const joinMessage: WsServerMessage = {
      type: 'player_joined',
      user: username,
    };
    broadcastToOthers(playthroughId, userId, joinMessage);

    // Handle incoming messages
    socket.on('message', async (data: Buffer) => {
      try {
        const raw = data.toString();
        const parsed = JSON.parse(raw) as WsClientMessage;

        if (parsed.type === 'submit_rating') {
          const validated = submitRatingMessageSchema.parse(parsed);
          // Fetch the latest playthrough state to get current position
          const currentPlaythrough = await playthroughRepo.findById(playthroughId);
          if (currentPlaythrough) {
            await handleSubmitRating(playthroughId, userId, username, currentPlaythrough.currentPosition, validated.rating);
          }
        }
      } catch (err) {
        console.error('[WS] Error handling message:', err);
        socket.send(JSON.stringify({ error: 'Invalid message' }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      connectionManager.removeConnection(playthroughId, userId);

      // Broadcast player left (if this was their last connection)
      const stillConnected = connectionManager.getConnectedUsers(playthroughId).includes(userId);
      if (!stillConnected) {
        const leftMessage: WsServerMessage = {
          type: 'player_left',
          user: username,
        };
        connectionManager.broadcast(playthroughId, leftMessage);
      }
    });

    socket.on('error', (err: Error) => {
      console.error('[WS] Socket error:', err);
      connectionManager.removeConnection(playthroughId, userId);
    });
  });
};

/**
 * Build current playthrough state for state_sync messages.
 */
async function buildPlaythroughState(playthroughId: number, currentPosition: number): Promise<PlaythroughState> {
  const playthroughSongs = await playthroughSongRepo.getSongs(playthroughId);
  const players = await playthroughPlayerRepo.getPlayers(playthroughId);

  // Get song details for all songs
  const songs: Song[] = [];
  for (const ps of playthroughSongs) {
    const song = await songRepo.findById(ps.songId);
    if (song) songs.push(song);
  }

  // Get current song
  const currentSongEntry = playthroughSongs[currentPosition];
  const currentSong = currentSongEntry ? await songRepo.findById(currentSongEntry.songId) : null;

  if (!currentSong) {
    throw new Error('Current song not found');
  }

  // Get ratings for current song
  const currentPlaythroughSong = await playthroughSongRepo.getSongAtPosition(playthroughId, currentPosition);
  const ratingsData = currentPlaythroughSong
    ? await playthroughSongStatsRepo.getForPlaythroughSong(currentPlaythroughSong.id)
    : [];

  // Build ratings map by username
  const ratingsThisSong: Record<string, number> = {};
  for (const stats of ratingsData) {
    if (stats.rating !== null) {
      const user = await userRepo.findById(stats.userId);
      if (user) {
        ratingsThisSong[user.username] = stats.rating;
      }
    }
  }

  // Get player details with usernames
  const playerDetails = [];
  for (const player of players) {
    const user = await userRepo.findById(player.userId);
    if (user) {
      playerDetails.push({
        userId: player.userId,
        username: user.username,
        instrument: player.instrument,
        difficulty: player.difficulty,
      });
    }
  }

  return {
    playthroughId,
    currentPosition,
    currentSong,
    songs,
    players: playerDetails,
    ratingsThisSong,
  };
}

/**
 * Handle rating submission from client.
 */
async function handleSubmitRating(
  playthroughId: number,
  userId: number,
  username: string,
  position: number,
  rating: number
): Promise<void> {
  try {
    // Get the playthrough song at this position
    const playthroughSong = await playthroughSongRepo.getSongAtPosition(playthroughId, position);
    if (!playthroughSong) {
      throw new Error(`No song found at position ${position}`);
    }

    // Check if user already has stats for this song
    const existing = await playthroughSongStatsRepo.getForUserAndSong(userId, playthroughSong.id);

    if (existing) {
      // Update existing rating
      await playthroughSongStatsRepo.update(existing.id, { rating });
    } else {
      // Create new stats entry with just rating
      await playthroughSongStatsRepo.create({
        playthroughSongId: playthroughSong.id,
        userId,
        rating,
      });
    }

    // Broadcast rating submission to all clients
    const message: WsServerMessage = {
      type: 'rating_submitted',
      user: username,
      rating,
    };
    connectionManager.broadcast(playthroughId, message);
  } catch (err) {
    console.error('[WS] Error submitting rating:', err);
    throw err;
  }
}

/**
 * Broadcast message to all users except the sender.
 */
function broadcastToOthers(playthroughId: number, excludeUserId: number, message: WsServerMessage): void {
  const allUsers = connectionManager.getConnectedUsers(playthroughId);
  for (const userId of allUsers) {
    if (userId !== excludeUserId) {
      connectionManager.sendToUser(playthroughId, userId, message);
    }
  }
}

export default wsPlaythroughRoutes;
