import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import authRoutes from './routes/auth.js';
import songRoutes from './routes/songs.js';
import setlistRoutes from './routes/setlists.js';
import playthroughRoutes from './routes/playthroughs.js';
import wsPlaythroughRoutes from './routes/ws-playthroughs.js';
import adminUserRoutes from './routes/admin/users.js';
import adminSongRoutes from './routes/admin/songs.js';
import type { JwtPayload } from '@bearded-nemesis/shared';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

const config = loadConfig();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
  },
});

await app.register(cors, {
  origin: true, // Allow all origins in dev, configure for prod
});

await app.register(jwt, {
  secret: config.jwtSecret,
  sign: {
    expiresIn: config.jwtAccessExpiry,
  },
});

// Register WebSocket support BEFORE routes
await app.register(websocket);

// Register multipart for file uploads
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// Auth decorator
app.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Health check
app.get('/health', async () => {
  return { status: 'ok' };
});

// Register static file serving for cover art
await app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/',
});

// Register routes
await app.register(authRoutes, { prefix: '/auth' });
await app.register(songRoutes, { prefix: '/songs' });
await app.register(setlistRoutes, { prefix: '/setlists' });
await app.register(playthroughRoutes, { prefix: '/playthroughs' });
await app.register(adminUserRoutes, { prefix: '/admin/users' });
await app.register(adminSongRoutes, { prefix: '/admin/songs' });

// Register WebSocket routes (no prefix, handled in route definition)
await app.register(wsPlaythroughRoutes);

// Start server
try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`API listening on http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
