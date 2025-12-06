import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password utils', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('mypassword');
    expect(hash.length).toBeGreaterThan(50);
  });

  it('should verify a correct password', async () => {
    const hash = await hashPassword('mypassword');
    const isValid = await verifyPassword('mypassword', hash);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('mypassword');
    const isValid = await verifyPassword('wrongpassword', hash);
    expect(isValid).toBe(false);
  });
});
