import { describe, it, expect } from 'vitest';
import {
  normalizeInviteEmail,
  emailInInviteList,
  resolveInviteRole,
  normalizeInviteEmailList,
} from '../../src/server/table-invite-access.js';

describe('table-invite-access', () => {
  it('normalizeInviteEmail trims and lowercases', () => {
    expect(normalizeInviteEmail('  A@B.COM ')).toBe('a@b.com');
  });

  it('emailInInviteList matches case-insensitively', () => {
    expect(emailInInviteList('A@b.com', ['x@y.com', 'a@B.COM'])).toBe(true);
  });

  it('resolveInviteRole returns owner when uid matches gm', () => {
    expect(
      resolveInviteRole({
        userUid: 'gm1',
        userEmail: 'gm@x.com',
        gmUid: 'gm1',
        tableState: { playerEmails: [], pendingPlayerEmails: [] },
      })
    ).toBe('owner');
  });

  it('resolveInviteRole returns player when email in playerEmails', () => {
    expect(
      resolveInviteRole({
        userUid: 'p1',
        userEmail: 'P@x.com',
        gmUid: 'gm1',
        tableState: { playerEmails: ['p@x.com'], pendingPlayerEmails: [] },
      })
    ).toBe('player');
  });

  it('resolveInviteRole returns pending when email in pending only', () => {
    expect(
      resolveInviteRole({
        userUid: 'p1',
        userEmail: 'new@x.com',
        gmUid: 'gm1',
        tableState: { playerEmails: [], pendingPlayerEmails: ['New@x.com'] },
        blockedGmUids: [],
      })
    ).toBe('pending');
  });

  it('resolveInviteRole returns none when GM is blocked by invitee', () => {
    expect(
      resolveInviteRole({
        userUid: 'p1',
        userEmail: 'new@x.com',
        gmUid: 'gm1',
        tableState: { playerEmails: [], pendingPlayerEmails: ['new@x.com'] },
        blockedGmUids: ['gm1'],
      })
    ).toBe('none');
  });

  it('normalizeInviteEmailList dedupes and lowercases', () => {
    expect(normalizeInviteEmailList([' A@B.COM ', 'a@b.com', '  ', 3, 'c@d.org'])).toEqual(['a@b.com', 'c@d.org']);
  });
});
