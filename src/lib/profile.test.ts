import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validateName,
  isProfileComplete,
  fullName,
  usernameChangesRemaining,
  MAX_USERNAME_CHANGES,
} from './profile';

describe('validateUsername', () => {
  it('accepts 3–20 chars of letters/numbers/underscore and trims', () => {
    expect(validateUsername('  big_blue1 ')).toEqual({ ok: true, value: 'big_blue1' });
  });
  it('rejects too short', () => {
    expect(validateUsername('ab').ok).toBe(false);
  });
  it('rejects too long (21)', () => {
    expect(validateUsername('a'.repeat(21)).ok).toBe(false);
  });
  it('rejects spaces and punctuation', () => {
    expect(validateUsername('bad name').ok).toBe(false);
    expect(validateUsername('no-dash').ok).toBe(false);
  });
});

describe('validateName', () => {
  it('accepts 1–50 chars and trims', () => {
    expect(validateName('  Bob ', 'First name')).toEqual({ ok: true, value: 'Bob' });
  });
  it('rejects empty', () => {
    expect(validateName('   ', 'First name').ok).toBe(false);
  });
  it('rejects over 50 chars', () => {
    expect(validateName('x'.repeat(51), 'Last name').ok).toBe(false);
  });
});

describe('isProfileComplete', () => {
  it('is true only when username + first + last are all present', () => {
    expect(isProfileComplete({ username: 'u', firstName: 'A', lastName: 'B' })).toBe(true);
    expect(isProfileComplete({ username: null, firstName: 'A', lastName: 'B' })).toBe(false);
    expect(isProfileComplete({ username: 'u', firstName: '', lastName: 'B' })).toBe(false);
  });
});

describe('fullName', () => {
  it('joins first + last when present', () => {
    expect(fullName({ firstName: 'Ada', lastName: 'Lovelace', name: 'legacy' })).toBe('Ada Lovelace');
  });
  it('falls back to name when parts are missing', () => {
    expect(fullName({ firstName: null, lastName: null, name: 'Legacy Name' })).toBe('Legacy Name');
  });
});

describe('usernameChangesRemaining', () => {
  it('allows MAX changes from a fresh account and counts down', () => {
    expect(MAX_USERNAME_CHANGES).toBe(2);
    expect(usernameChangesRemaining(0)).toBe(2);
    expect(usernameChangesRemaining(1)).toBe(1);
    expect(usernameChangesRemaining(2)).toBe(0);
  });
  it('never goes negative', () => {
    expect(usernameChangesRemaining(3)).toBe(0);
  });
});
