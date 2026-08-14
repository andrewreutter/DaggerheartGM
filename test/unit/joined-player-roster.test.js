import { describe, it, expect } from 'vitest';
import { buildJoinedPlayerRoster, mergePresenceNamesIntoCache } from '../../src/client/lib/joined-player-roster.js';

describe('buildJoinedPlayerRoster', () => {
  it('uses presence name when online, otherwise invited email', () => {
    expect(
      buildJoinedPlayerRoster(
        ['alice@example.com', 'bob@example.com'],
        [{ uid: 'u1', email: 'alice@example.com', name: 'Alice' }],
      ),
    ).toEqual([
      { email: 'alice@example.com', name: 'Alice', online: true, uid: 'u1' },
      { email: 'bob@example.com', name: 'bob@example.com', online: false, uid: undefined },
    ]);
  });

  it('matches emails case-insensitively and dedupes invites', () => {
    expect(
      buildJoinedPlayerRoster(
        ['Alice@Example.com', 'alice@example.com'],
        [{ uid: 'u1', email: 'ALICE@example.com', name: 'Alice' }],
      ),
    ).toEqual([
      { email: 'Alice@Example.com', name: 'Alice', online: true, uid: 'u1' },
    ]);
  });

  it('includes connected players missing from the invite list', () => {
    expect(
      buildJoinedPlayerRoster([], [{ uid: 'u2', email: 'guest@example.com', name: 'Guest' }]),
    ).toEqual([
      { email: 'guest@example.com', name: 'Guest', online: true, uid: 'u2' },
    ]);
  });

  it('retains display name from cache when player goes offline', () => {
    const cache = {};
    mergePresenceNamesIntoCache(cache, [{ email: 'bob@example.com', name: 'Bob' }]);
    const roster = buildJoinedPlayerRoster(
      ['bob@example.com'],
      [], // bob disconnected
      cache,
    );
    expect(roster).toEqual([
      { email: 'bob@example.com', name: 'Bob', online: false, uid: undefined },
    ]);
  });

  it('does not cache names that equal the email address', () => {
    const cache = {};
    mergePresenceNamesIntoCache(cache, [{ email: 'bob@example.com', name: 'bob@example.com' }]);
    expect(cache).toEqual({});
  });
});

describe('mergePresenceNamesIntoCache', () => {
  it('adds names keyed by lowercase email', () => {
    const cache = {};
    mergePresenceNamesIntoCache(cache, [{ email: 'Alice@Example.com', name: 'Alice' }]);
    expect(cache).toEqual({ 'alice@example.com': 'Alice' });
  });

  it('updates an existing entry with a fresher name', () => {
    const cache = { 'alice@example.com': 'Old Name' };
    mergePresenceNamesIntoCache(cache, [{ email: 'alice@example.com', name: 'Alice' }]);
    expect(cache['alice@example.com']).toBe('Alice');
  });
});
