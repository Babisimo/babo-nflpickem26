import { describe, it, expect } from 'vitest';
import { generateTempPassword } from './auth-helpers';

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
