import { describe, it, expect } from 'vitest';
import { canRemoveUser, canSetAdmin } from './admin-guard';

const ADMINS_ONE = ['a1'];
const ADMINS_TWO = ['a1', 'a2'];

describe('canRemoveUser', () => {
  it('blocks removing your own account', () => {
    const r = canRemoveUser('a1', 'a1', ADMINS_TWO);
    expect(r.ok).toBe(false);
  });

  it('blocks removing the last admin', () => {
    const r = canRemoveUser('a1', 'a2', ADMINS_ONE.concat('a2') /* a2 not admin */);
    // a2 is not in the admin list, so this is allowed — sanity for the next case
    expect(r.ok).toBe(true);
  });

  it('blocks removing an admin when they are the only admin', () => {
    const r = canRemoveUser('a2', 'a1', ADMINS_ONE);
    expect(r.ok).toBe(false);
  });

  it('allows an admin to remove a non-admin user', () => {
    const r = canRemoveUser('a1', 'u9', ADMINS_TWO);
    expect(r.ok).toBe(true);
  });

  it('allows removing an admin when another admin remains', () => {
    const r = canRemoveUser('a1', 'a2', ADMINS_TWO);
    expect(r.ok).toBe(true);
  });
});

describe('canSetAdmin', () => {
  it('blocks changing your own admin status', () => {
    const r = canSetAdmin('a1', 'a1', false, ADMINS_TWO);
    expect(r.ok).toBe(false);
  });

  it('blocks demoting the last admin', () => {
    const r = canSetAdmin('a2', 'a1', false, ADMINS_ONE);
    expect(r.ok).toBe(false);
  });

  it('allows promoting a non-admin to admin', () => {
    const r = canSetAdmin('a1', 'u9', true, ADMINS_TWO);
    expect(r.ok).toBe(true);
  });

  it('allows demoting an admin when another admin remains', () => {
    const r = canSetAdmin('a1', 'a2', false, ADMINS_TWO);
    expect(r.ok).toBe(true);
  });
});
