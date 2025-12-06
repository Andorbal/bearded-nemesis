import crypto from 'crypto';
import { query, queryOne } from '../db/pool.js';
import * as userRepo from '../repositories/userRepository.js';
import { verifyPassword } from '../utils/password.js';
import type { FastifyInstance } from 'fastify';
import type { User, AuthTokens, JwtPayload } from '@bearded-nemesis/shared';

interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
}

export async function login(
  app: FastifyInstance,
  username: string,
  password: string
): Promise<{ user: User; tokens: AuthTokens } | null> {
  const user = await userRepo.findByUsername(username);
  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  const tokens = await generateTokens(app, user);
  return { user, tokens };
}

export async function refresh(
  app: FastifyInstance,
  refreshToken: string
): Promise<AuthTokens | null> {
  const tokenHash = hashToken(refreshToken);

  const row = await queryOne<RefreshTokenRow>(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );

  if (!row) return null;

  const user = await userRepo.findById(row.user_id);
  if (!user) return null;

  // Delete old token
  await query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);

  return generateTokens(app, user);
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

async function generateTokens(app: FastifyInstance, user: User): Promise<AuthTokens> {
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
  };

  const accessToken = app.jwt.sign(payload);
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const refreshTokenHash = hashToken(refreshToken);

  // Store refresh token (expires in 7 days by default, configured in JWT plugin)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, refreshTokenHash, expiresAt]
  );

  return { accessToken, refreshToken };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
