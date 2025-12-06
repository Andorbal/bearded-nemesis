import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as songRepo from '../repositories/songRepository.js';
import * as userSongRepo from '../repositories/userSongRepository.js';
import * as songRatingRepo from '../repositories/songRatingRepository.js';
import { INSTRUMENTS } from '@bearded-nemesis/shared';

const searchSchema = z.object({
  q: z.string().optional(),
  minDifficulty: z.coerce.number().min(0).max(7).optional(),
  maxDifficulty: z.coerce.number().min(0).max(7).optional(),
  instrument: z.enum(['drums', 'guitar', 'bass', 'vocals', 'keys']).optional(),
  genre: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

const songIdSchema = z.object({
  id: z.coerce.number(),
});

const ownershipSchema = z.object({
  owned: z.boolean(),
});

const songRatingSchema = z.object({
  rating: z.number().min(1).max(5),
});

const playRatingSchema = z.object({
  instrument: z.enum(INSTRUMENTS),
  rating: z.number().min(1).max(5),
});

const songRoutes: FastifyPluginAsync = async (app) => {
  // Public: List/search songs
  app.get('/', async (request) => {
    const query = searchSchema.parse(request.query);
    const songs = await songRepo.search({
      query: query.q,
      minDifficulty: query.minDifficulty,
      maxDifficulty: query.maxDifficulty,
      instrument: query.instrument,
      genre: query.genre,
      limit: query.limit,
      offset: query.offset,
    });
    const total = await songRepo.count();
    return { songs, total, limit: query.limit, offset: query.offset };
  });

  // Public: Get song by ID
  app.get('/:id', async (request, reply) => {
    const { id } = songIdSchema.parse(request.params);
    const song = await songRepo.findById(id);
    if (!song) {
      return reply.status(404).send({ error: 'Song not found' });
    }
    return song;
  });

  // Auth required: Get user's ownership/rating for a song
  app.get('/:id/user', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { id } = songIdSchema.parse(request.params);
    const userSong = await userSongRepo.get(request.user.userId, id);
    return userSong ?? { userId: request.user.userId, songId: id, owned: false, songRating: null };
  });

  // Auth required: Set ownership
  app.put('/:id/owned', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { id } = songIdSchema.parse(request.params);
    const { owned } = ownershipSchema.parse(request.body);
    const result = await userSongRepo.setOwned(request.user.userId, id, owned);
    return result;
  });

  // Auth required: Rate the song itself (how much you like it)
  app.put('/:id/rating', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { id } = songIdSchema.parse(request.params);
    const { rating } = songRatingSchema.parse(request.body);
    const result = await userSongRepo.setSongRating(request.user.userId, id, rating);
    return result;
  });

  // Auth required: Rate a play (how enjoyable it was to play on an instrument)
  app.post('/:id/play-rating', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { id } = songIdSchema.parse(request.params);
    const { instrument, rating } = playRatingSchema.parse(request.body);
    const result = await songRatingRepo.create({
      userId: request.user.userId,
      songId: id,
      instrument,
      rating,
    });
    return result;
  });

  // Auth required: Get play ratings history for a song/instrument
  app.get('/:id/play-ratings/:instrument', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { id } = songIdSchema.parse(request.params);
    const { instrument } = z.object({ instrument: z.enum(INSTRUMENTS) }).parse(request.params);
    const ratings = await songRatingRepo.getForUserSongInstrument(request.user.userId, id, instrument);
    const average = await songRatingRepo.getAverageRating(request.user.userId, id, instrument);
    return { ratings, average };
  });
};

export default songRoutes;
