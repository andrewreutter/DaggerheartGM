import { describe, it, expect } from 'vitest';
import { summarizeTablePlayerRoster } from '../../src/db.js';

describe('summarizeTablePlayerRoster', () => {
  it('returns empty roster when data is missing', () => {
    expect(summarizeTablePlayerRoster(undefined)).toEqual({ count: 0, players: [] });
    expect(summarizeTablePlayerRoster(null)).toEqual({ count: 0, players: [] });
    expect(summarizeTablePlayerRoster({})).toEqual({ count: 0, players: [] });
  });

  it('uses playerName from a matching assigned character, else the email', () => {
    const data = {
      playerEmails: ['alice@example.com', 'bob@example.com'],
      elements: [
        { assignedPlayerEmail: 'alice@example.com', playerName: 'Alice' },
        { assignedPlayerEmail: 'bob@example.com' },
      ],
    };
    expect(summarizeTablePlayerRoster(data)).toEqual({
      count: 2,
      players: [
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'bob@example.com' },
      ],
    });
  });

  it('ignores elements without playerName even when the email matches', () => {
    const data = {
      playerEmails: ['a@x.com'],
      elements: [{ assignedPlayerEmail: 'a@x.com', playerName: '' }],
    };
    expect(summarizeTablePlayerRoster(data).players[0].name).toBe('a@x.com');
  });
});
