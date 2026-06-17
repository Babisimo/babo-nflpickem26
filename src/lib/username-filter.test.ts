import { describe, it, expect } from 'vitest';
import { checkUsernameAllowed } from './username-filter';

describe('checkUsernameAllowed', () => {
  it('allows ordinary usernames', () => {
    expect(checkUsernameAllowed('big_blue1').ok).toBe(true);
    expect(checkUsernameAllowed('GridironGuru').ok).toBe(true);
  });

  it('allows words that merely contain a reserved substring', () => {
    expect(checkUsernameAllowed('modern').ok).toBe(true);
    expect(checkUsernameAllowed('badminton').ok).toBe(true);
  });

  it('blocks reserved handles (exact or word+digits)', () => {
    expect(checkUsernameAllowed('admin').ok).toBe(false);
    expect(checkUsernameAllowed('Admin_07').ok).toBe(false);
    expect(checkUsernameAllowed('official').ok).toBe(false);
    expect(checkUsernameAllowed('moderator').ok).toBe(false);
  });

  it('blocks profanity, including light obfuscation', () => {
    expect(checkUsernameAllowed('shit').ok).toBe(false);
    expect(checkUsernameAllowed('sh1t').ok).toBe(false);
  });
});
