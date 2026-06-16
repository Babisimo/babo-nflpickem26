import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateTempPassword } from './auth-helpers';

describe('password helpers', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(hash).not.toBe('s3cret!');
    expect(await verifyPassword('s3cret!', hash)).toBe(true);
  });
  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('generateTempPassword', () => {
  it('matches the Word-XXXX shape and is at least 8 chars', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(/^[A-Za-z]+-[A-HJ-NP-Z2-9]{4}$/);
      expect(pw.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('is not constant across calls', () => {
    const set = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(set.size).toBeGreaterThan(1);
  });
});
