import { describe, it, expect } from 'vitest';
import {
  hashResetToken,
  generateResetToken,
  isResetTokenValid,
  RESET_TOKEN_TTL_MS,
} from './password-reset';

describe('hashResetToken', () => {
  it('is a deterministic 64-char hex sha256 digest', () => {
    const h = hashResetToken('abc');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken('abc')).toBe(h);
  });

  it('differs for different inputs', () => {
    expect(hashResetToken('abc')).not.toBe(hashResetToken('abd'));
  });
});

describe('generateResetToken', () => {
  it('returns a base64url token whose hash matches hashResetToken', () => {
    const { token, tokenHash } = generateResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(tokenHash).toBe(hashResetToken(token));
  });

  it('produces unique tokens across calls', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateResetToken().token));
    expect(tokens.size).toBe(20);
  });
});

describe('isResetTokenValid', () => {
  const now = new Date('2026-06-17T12:00:00Z');

  it('is valid when unused and not expired', () => {
    const rec = { expiresAt: new Date('2026-06-17T12:30:00Z'), usedAt: null };
    expect(isResetTokenValid(rec, now)).toBe(true);
  });

  it('is invalid when already used', () => {
    const rec = { expiresAt: new Date('2026-06-17T12:30:00Z'), usedAt: new Date('2026-06-17T11:00:00Z') };
    expect(isResetTokenValid(rec, now)).toBe(false);
  });

  it('is invalid when expired', () => {
    const rec = { expiresAt: new Date('2026-06-17T11:59:59Z'), usedAt: null };
    expect(isResetTokenValid(rec, now)).toBe(false);
  });

  it('exposes a one-hour TTL', () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});
