import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as authService from '../services/authService.js';
import * as userRepo from '../repositories/userRepository.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(app, body.username, body.password);

    if (!result) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        isAdmin: result.user.isAdmin,
      },
    };
  });

  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await authService.refresh(app, body.refreshToken);

    if (!tokens) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    return tokens;
  });

  app.post('/logout', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    await authService.logout(body.refreshToken);
    return { success: true };
  });

  app.get('/me', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const user = await userRepo.findById(request.user.userId);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      xboxGamertag: user.xboxGamertag,
      isAdmin: user.isAdmin,
    };
  });
};

export default authRoutes;
