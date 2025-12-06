import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as userRepo from '../../repositories/userRepository.js';
import * as auditLog from '../../repositories/auditLogRepository.js';
import { hashPassword } from '../../utils/password.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  displayName: z.string().min(1).max(100),
  xboxGamertag: z.string().max(50).optional(),
  isAdmin: z.boolean().default(false),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  xboxGamertag: z.string().max(50).optional().nullable(),
  isAdmin: z.boolean().optional(),
});

const userIdSchema = z.object({
  id: z.coerce.number(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

const adminUserRoutes: FastifyPluginAsync = async (app) => {
  // All admin routes require authentication and admin access
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', requireAdmin);

  // List all users (including deleted)
  app.get('/', async () => {
    const users = await userRepo.findAllIncludingDeleted();
    return { users };
  });

  // Create new user
  app.post('/', async (request) => {
    const body = createUserSchema.parse(request.body);
    const passwordHash = await hashPassword(body.password);

    const user = await userRepo.create({
      username: body.username,
      passwordHash,
      displayName: body.displayName,
      xboxGamertag: body.xboxGamertag,
      isAdmin: body.isAdmin,
    });

    await auditLog.log({
      adminUserId: request.user.userId,
      action: 'create_user',
      entityType: 'user',
      entityId: user.id,
      changes: { username: body.username, displayName: body.displayName, isAdmin: body.isAdmin },
    });

    return user;
  });

  // Get user by ID
  app.get('/:id', async (request, reply) => {
    const { id } = userIdSchema.parse(request.params);

    // Use findAllIncludingDeleted to get even deleted users
    const allUsers = await userRepo.findAllIncludingDeleted();
    const user = allUsers.find(u => u.id === id);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return user;
  });

  // Update user
  app.patch('/:id', async (request, reply) => {
    const { id } = userIdSchema.parse(request.params);
    const body = updateUserSchema.parse(request.body);

    // Convert null to undefined for xboxGamertag (zod nullable vs repository type)
    const updateData = {
      ...body,
      xboxGamertag: body.xboxGamertag === null ? undefined : body.xboxGamertag,
    };

    const user = await userRepo.update(id, updateData);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await auditLog.log({
      adminUserId: request.user.userId,
      action: 'update_user',
      entityType: 'user',
      entityId: id,
      changes: body,
    });

    return user;
  });

  // Soft delete user
  app.delete('/:id', async (request, reply) => {
    const { id } = userIdSchema.parse(request.params);

    // Prevent admin from deleting themselves
    if (id === request.user.userId) {
      return reply.status(400).send({ error: 'Cannot delete yourself' });
    }

    // Prevent deleting the last admin
    const adminCount = await userRepo.countAdmins();
    const user = await userRepo.findById(id);

    if (user?.isAdmin && adminCount <= 1) {
      return reply.status(400).send({ error: 'Cannot delete the last admin user' });
    }

    const deleted = await userRepo.softDelete(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'User not found or already deleted' });
    }

    await auditLog.log({
      adminUserId: request.user.userId,
      action: 'delete_user',
      entityType: 'user',
      entityId: id,
    });

    return { success: true };
  });

  // Restore soft-deleted user
  app.post('/:id/restore', async (request, reply) => {
    const { id } = userIdSchema.parse(request.params);

    const restored = await userRepo.restore(id);

    if (!restored) {
      return reply.status(404).send({ error: 'User not found or not deleted' });
    }

    await auditLog.log({
      adminUserId: request.user.userId,
      action: 'restore_user',
      entityType: 'user',
      entityId: id,
    });

    return { success: true };
  });

  // Reset user password
  app.post('/:id/reset-password', async (request, reply) => {
    const { id } = userIdSchema.parse(request.params);
    const { newPassword } = resetPasswordSchema.parse(request.body);

    const passwordHash = await hashPassword(newPassword);
    const user = await userRepo.update(id, { passwordHash });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await auditLog.log({
      adminUserId: request.user.userId,
      action: 'reset_password',
      entityType: 'user',
      entityId: id,
    });

    return { success: true };
  });
};

export default adminUserRoutes;
