import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { requireAdmin } from './requireAdmin.js';
import type { JwtPayload } from '@bearded-nemesis/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

describe('requireAdmin middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(jwt, { secret: 'test-secret' });

    // Add authenticate decorator
    app.decorate('authenticate', async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    // Test route that requires admin
    app.get('/admin/test', {
      onRequest: [app.authenticate, requireAdmin],
    }, async () => {
      return { success: true };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow access for admin users', async () => {
    const token = app.jwt.sign({
      userId: 1,
      username: 'admin',
      isAdmin: true,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/test',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
  });

  it('should deny access for non-admin users', async () => {
    const token = app.jwt.sign({
      userId: 2,
      username: 'user',
      isAdmin: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/test',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Admin access required' });
  });

  it('should deny access for unauthenticated users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/test',
    });

    expect(response.statusCode).toBe(401);
  });
});
