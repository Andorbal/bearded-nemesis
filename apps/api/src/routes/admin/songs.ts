import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as songRepo from '../../repositories/songRepository.js';
import * as auditLog from '../../repositories/auditLogRepository.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

const updateSongSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional().nullable(),
  year: z.number().optional().nullable(),
  durationMs: z.number().optional().nullable(),
  bpm: z.number().optional().nullable(),
  genre: z.string().optional().nullable(),
  coverArtUrl: z.string().optional().nullable(),
  youtubeUrl: z.string().optional().nullable(),
  spotifyId: z.string().optional().nullable(),
  difficultyDrums: z.number().min(0).max(7).optional().nullable(),
  difficultyGuitar: z.number().min(0).max(7).optional().nullable(),
  difficultyBass: z.number().min(0).max(7).optional().nullable(),
  difficultyVocals: z.number().min(0).max(7).optional().nullable(),
  difficultyKeys: z.number().min(0).max(7).optional().nullable(),
  sourceArray: z.array(z.string()).optional().nullable(),
});

const bulkUpdateSchema = z.object({
  songIds: z.array(z.number()).min(1),
  updates: updateSongSchema,
});

const songIdSchema = z.object({
  id: z.coerce.number(),
});

const adminSongRoutes: FastifyPluginAsync = async (app) => {
  // All admin routes require authentication and admin access
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', requireAdmin);

  // Update song metadata
  app.patch('/:id', async (request, reply) => {
    const { id } = songIdSchema.parse(request.params);
    const body = updateSongSchema.parse(request.body);

    const song = await songRepo.update(id, body);

    if (!song) {
      return reply.status(404).send({ error: 'Song not found' });
    }

    await auditLog.log({
      adminUserId: request.user.userId,
      action: 'update_song',
      entityType: 'song',
      entityId: id,
      changes: body,
    });

    return song;
  });

  // Bulk update songs
  app.post('/bulk-update', async (request) => {
    const { songIds, updates } = bulkUpdateSchema.parse(request.body);

    const updated = await songRepo.bulkUpdate(songIds, updates);

    await auditLog.log({
      adminUserId: request.user.userId,
      action: 'bulk_update_songs',
      entityType: 'song',
      entityId: 0, // Bulk operation, no single entity
      changes: { songIds, updates },
    });

    return { updated };
  });
};

export default adminSongRoutes;
