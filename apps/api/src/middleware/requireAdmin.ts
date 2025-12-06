import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware that requires the authenticated user to be an admin.
 * Must be used after the authenticate middleware.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user?.isAdmin) {
    reply.status(403).send({ error: 'Admin access required' });
    return;
  }
}
