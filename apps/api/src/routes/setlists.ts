import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as setlistRepo from '../repositories/setlistRepository.js';
import * as setlistSongRepo from '../repositories/setlistSongRepository.js';
import * as smartSetlistService from '../services/smartSetlistService.js';
import * as builderService from '../services/setlistBuilderService.js';
import { query } from '../db/pool.js';
import { SETLIST_TYPES, INSTRUMENTS, DIFFICULTIES, RATING_AGGREGATIONS } from '@bearded-nemesis/shared';

const builderPlayerSchema = z.object({
  userId: z.number(),
  instrument: z.enum(INSTRUMENTS),
  difficulty: z.enum(DIFFICULTIES),
  proMode: z.boolean(),
});

const builderConstraintsSchema = z.object({
  songCountMin: z.number().min(1).optional(),
  songCountMax: z.number().min(1).optional(),
  maxDurationMinutes: z.number().min(1).optional(),
  minAvgPlayRating: z.number().min(1).max(5).optional(),
  minAvgSongRating: z.number().min(1).max(5).optional(),
  difficultyMin: z.number().min(0).max(7).optional(),
  difficultyMax: z.number().min(0).max(7).optional(),
  unplayedMinimum: z.number().min(0).optional(),
  avoidPlayedWithinDays: z.number().min(0).optional(),
  bpmMin: z.number().min(1).optional(),
  bpmMax: z.number().min(1).optional(),
  requiredSongIds: z.array(z.number()).optional(),
  excludedSongIds: z.array(z.number()).optional(),
});

const builderPresetSchema = z.object({
  name: z.string(),
  players: z.array(builderPlayerSchema).min(1),
  objective: z.enum(['play_rating', 'song_rating', 'discovery', 'combined']),
  ratingAggregation: z.enum(RATING_AGGREGATIONS),
  constraints: builderConstraintsSchema,
});

const createSetlistSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(SETLIST_TYPES),
  smartFilter: z.object({
    minRating: z.number().min(1).max(5).optional(),
    maxRating: z.number().min(1).max(5).optional(),
    minDifficulty: z.number().min(0).max(7).optional(),
    maxDifficulty: z.number().min(0).max(7).optional(),
    instruments: z.array(z.enum(INSTRUMENTS)).optional(),
    ownedOnly: z.boolean().optional(),
    sortBy: z.enum(['rating', 'difficulty', 'title', 'artist', 'random']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional(),
  builderPreset: builderPresetSchema.optional(),
});

const updateSetlistSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  smartFilter: z.object({
    minRating: z.number().min(1).max(5).optional(),
    maxRating: z.number().min(1).max(5).optional(),
    minDifficulty: z.number().min(0).max(7).optional(),
    maxDifficulty: z.number().min(0).max(7).optional(),
    instruments: z.array(z.enum(INSTRUMENTS)).optional(),
    ownedOnly: z.boolean().optional(),
    sortBy: z.enum(['rating', 'difficulty', 'title', 'artist', 'random']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional().nullable(),
  builderPreset: builderPresetSchema.optional().nullable(),
});

const setlistIdSchema = z.object({
  id: z.coerce.number(),
});

const addSongsSchema = z.object({
  songIds: z.array(z.number()).min(1),
});

const reorderSchema = z.object({
  songIds: z.array(z.number()),
});

const removeSongSchema = z.object({
  songId: z.coerce.number(),
});

const setlistRoutes: FastifyPluginAsync = async (app) => {
  // All setlist routes require authentication
  app.addHook('onRequest', app.authenticate);

  // List user's setlists
  app.get('/', async (request) => {
    const setlists = await setlistRepo.findByUserId(request.user.userId);
    return { setlists };
  });

  // Create setlist
  app.post('/', async (request) => {
    const body = createSetlistSchema.parse(request.body);
    const setlist = await setlistRepo.create({
      userId: request.user.userId,
      name: body.name,
      type: body.type,
      smartFilter: body.smartFilter,
      builderPreset: body.builderPreset,
    });
    return setlist;
  });

  // Get setlist by ID
  app.get('/:id', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);
    const setlist = await setlistRepo.findById(id);

    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    return setlist;
  });

  // Get setlist songs
  app.get('/:id/songs', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);
    const setlist = await setlistRepo.findById(id);

    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const songs = await setlistSongRepo.getSongsWithDetails(id);
    return { songs };
  });

  // Update setlist
  app.patch('/:id', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);
    const body = updateSetlistSchema.parse(request.body);

    const setlist = await setlistRepo.findById(id);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const updated = await setlistRepo.update(id, body);
    return updated;
  });

  // Delete setlist
  app.delete('/:id', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);

    const setlist = await setlistRepo.findById(id);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await setlistRepo.remove(id);
    return { success: true };
  });

  // Add songs to setlist
  app.post('/:id/songs', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);
    const { songIds } = addSongsSchema.parse(request.body);

    const setlist = await setlistRepo.findById(id);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await setlistSongRepo.addSongs(id, songIds);
    const songs = await setlistSongRepo.getSongsWithDetails(id);
    return { songs };
  });

  // Remove song from setlist
  app.delete('/:id/songs/:songId', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);
    const { songId } = removeSongSchema.parse(request.params);

    const setlist = await setlistRepo.findById(id);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await setlistSongRepo.removeSong(id, songId);
    const songs = await setlistSongRepo.getSongsWithDetails(id);
    return { songs };
  });

  // Reorder songs in setlist
  app.put('/:id/songs/order', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);
    const { songIds } = reorderSchema.parse(request.body);

    const setlist = await setlistRepo.findById(id);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await setlistSongRepo.reorder(id, songIds);
    const songs = await setlistSongRepo.getSongsWithDetails(id);
    return { songs };
  });

  // Generate smart setlist songs (preview)
  app.post('/:id/generate', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);

    const setlist = await setlistRepo.findById(id);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    if (setlist.type !== 'smart' || !setlist.smartFilter) {
      return reply.status(400).send({ error: 'Setlist is not a smart setlist' });
    }

    const songs = await smartSetlistService.generateSongList(request.user.userId, setlist.smartFilter);

    // Optionally apply to setlist
    const apply = (request.query as { apply?: string }).apply === 'true';
    if (apply) {
      await setlistSongRepo.clearSongs(id);
      await setlistSongRepo.addSongs(id, songs.map(s => s.id));
    }

    return { songs, applied: apply };
  });

  // Generate builder setlist (LP optimization)
  app.post('/:id/build', async (request, reply) => {
    const { id } = setlistIdSchema.parse(request.params);

    const setlist = await setlistRepo.findById(id);
    if (!setlist) {
      return reply.status(404).send({ error: 'Setlist not found' });
    }

    if (setlist.userId !== request.user.userId && !request.user.isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    if (setlist.type !== 'builder' || !setlist.builderPreset) {
      return reply.status(400).send({ error: 'Setlist is not a builder setlist' });
    }

    try {
      // Generate optimal setlist using LP solver
      const songIds = await builderService.generateOptimalSetlist(
        setlist.userId,
        setlist.builderPreset
      );

      // Optionally apply to setlist
      const apply = (request.query as { apply?: string }).apply === 'true';
      if (apply) {
        await setlistSongRepo.clearSongs(id);
        await setlistSongRepo.addSongs(id, songIds);
      }

      // Fetch song details for preview
      interface DbSong {
        id: number;
        title: string;
        artist: string;
        difficulty_drums: number | null;
      }
      const songsData = await query<DbSong>(
        'SELECT id, title, artist, difficulty_drums FROM songs WHERE id = ANY($1)',
        [songIds]
      );

      const songsMap = new Map(songsData.map(s => [s.id, s]));
      const songs = songIds.map(id => songsMap.get(id)).filter(s => s !== undefined);

      return { songs, applied: apply, count: songs.length };
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to generate optimal setlist',
        details: (error as Error).message,
      });
    }
  });
};

export default setlistRoutes;
