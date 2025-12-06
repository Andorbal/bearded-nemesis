import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { pool } from '../../db/pool.js';
import * as userRepo from '../../repositories/userRepository.js';
import adminUserRoutes from './users.js';
import type { JwtPayload } from '@bearded-nemesis/shared';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

describe('Admin User Routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let testAdminId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create test users
    const admin = await userRepo.create({
      username: 'adminroutes_admin',
      passwordHash: 'hash',
      displayName: 'Test Admin',
      isAdmin: true,
    });
    testAdminId = admin.id;

    const user = await userRepo.create({
      username: 'adminroutes_user',
      passwordHash: 'hash',
      displayName: 'Test User',
      isAdmin: false,
    });
    testUserId = user.id;

    // Setup Fastify app
    app = Fastify();
    await app.register(jwt, { secret: 'test-secret' });

    app.decorate('authenticate', async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    await app.register(adminUserRoutes, { prefix: '/admin/users' });

    adminToken = app.jwt.sign({
      userId: testAdminId,
      username: 'adminroutes_admin',
      isAdmin: true,
    });

    userToken = app.jwt.sign({
      userId: testUserId,
      username: 'adminroutes_user',
      isAdmin: false,
    });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE username LIKE $1', ['adminroutes_%']);
    await app.close();
  });

  it('should list all users including deleted for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);
  });

  it('should deny access to non-admin users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should create a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        username: 'adminroutes_newuser',
        password: 'password123',
        displayName: 'New User',
        xboxGamertag: 'NewGamer123',
        isAdmin: false,
      },
    });

    expect(response.statusCode).toBe(200);
    const user = response.json();
    expect(user.username).toBe('adminroutes_newuser');
    expect(user.displayName).toBe('New User');
    expect(user.xboxGamertag).toBe('NewGamer123');
    expect(user.isAdmin).toBe(false);
  });

  it('should get user details by ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/admin/users/${testUserId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const user = response.json();
    expect(user.id).toBe(testUserId);
    expect(user.username).toBe('adminroutes_user');
  });

  it('should update user details', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${testUserId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        displayName: 'Updated Name',
        xboxGamertag: 'UpdatedTag',
      },
    });

    expect(response.statusCode).toBe(200);
    const user = response.json();
    expect(user.displayName).toBe('Updated Name');
    expect(user.xboxGamertag).toBe('UpdatedTag');
  });

  it('should soft delete a user', async () => {
    const tempUser = await userRepo.create({
      username: 'adminroutes_deleteme',
      passwordHash: 'hash',
      displayName: 'Delete Me',
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/admin/users/${tempUser.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });

    // Verify soft deleted
    const deleted = await userRepo.findById(tempUser.id);
    expect(deleted).toBeNull();
  });

  it('should prevent admin from deleting themselves', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/admin/users/${testAdminId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('Cannot delete yourself');
  });

  it('should allow deleting an admin when multiple admins exist', async () => {
    // Create a second admin that we'll delete
    const adminToDelete = await userRepo.create({
      username: 'adminroutes_deletableadmin',
      passwordHash: 'hash',
      displayName: 'Deletable Admin',
      isAdmin: true,
    });

    // The testAdmin (already created in beforeAll) deletes this new admin
    // This should succeed because there are multiple admins
    const response = await app.inject({
      method: 'DELETE',
      url: `/admin/users/${adminToDelete.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });

    // Verify the admin was soft deleted
    const deleted = await userRepo.findById(adminToDelete.id);
    expect(deleted).toBeNull();
  });

  it('should restore a soft-deleted user', async () => {
    const tempUser = await userRepo.create({
      username: 'adminroutes_restoreme',
      passwordHash: 'hash',
      displayName: 'Restore Me',
    });

    // Soft delete
    await userRepo.softDelete(tempUser.id);

    // Restore
    const response = await app.inject({
      method: 'POST',
      url: `/admin/users/${tempUser.id}/restore`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });

    // Verify restored
    const restored = await userRepo.findById(tempUser.id);
    expect(restored).not.toBeNull();
  });

  it('should reset user password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/admin/users/${testUserId}/reset-password`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        newPassword: 'newpassword123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
  });
});
