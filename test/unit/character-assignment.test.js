import { describe, it, expect } from 'vitest';
import {
  getAssignedPlayerEmails,
  isCharacterAssignedToPlayer,
  toggleAssignedPlayerEmail,
  clearAssignedPlayerEmail,
  assignedPlayerLabel,
} from '../../src/client/lib/character-assignment.js';

const el0 = {}; // unassigned
const elScalar = { assignedPlayerEmail: 'Alice@Example.com', assignedPlayerUid: 'uid-a', playerName: 'Alice' };
const elArray = { assignedPlayerEmails: ['alice@example.com', 'bob@example.com'], assignedPlayerEmail: 'alice@example.com', assignedPlayerUid: 'uid-a', playerName: 'Alice' };
const roster = [
  { email: 'alice@example.com', uid: 'uid-a', name: 'Alice', online: true },
  { email: 'bob@example.com', uid: 'uid-b', name: 'Bob', online: true },
  { email: 'carol@example.com', uid: 'uid-c', name: 'Carol', online: false },
];

describe('getAssignedPlayerEmails', () => {
  it('returns empty for unassigned', () => {
    expect(getAssignedPlayerEmails(el0)).toEqual([]);
    expect(getAssignedPlayerEmails(null)).toEqual([]);
  });

  it('falls back to legacy scalar', () => {
    expect(getAssignedPlayerEmails(elScalar)).toEqual(['alice@example.com']);
  });

  it('normalizes legacy scalar to lowercase', () => {
    expect(getAssignedPlayerEmails({ assignedPlayerEmail: 'ALICE@EXAMPLE.COM' })).toEqual(['alice@example.com']);
  });

  it('returns array when present', () => {
    expect(getAssignedPlayerEmails(elArray)).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('ignores empty-array entries', () => {
    expect(getAssignedPlayerEmails({ assignedPlayerEmails: [] })).toEqual([]);
  });
});

describe('isCharacterAssignedToPlayer', () => {
  it('returns false for unassigned element', () => {
    expect(isCharacterAssignedToPlayer(el0, { email: 'alice@example.com' })).toBe(false);
  });

  it('matches legacy scalar by email (case-insensitive)', () => {
    expect(isCharacterAssignedToPlayer(elScalar, { email: 'alice@example.com' })).toBe(true);
    expect(isCharacterAssignedToPlayer(elScalar, { email: 'ALICE@EXAMPLE.COM' })).toBe(true);
  });

  it('matches array element by email', () => {
    expect(isCharacterAssignedToPlayer(elArray, { email: 'bob@example.com' })).toBe(true);
  });

  it('does not match non-assigned email', () => {
    expect(isCharacterAssignedToPlayer(elArray, { email: 'carol@example.com' })).toBe(false);
  });

  it('matches by uid when uid is the first assignee uid', () => {
    expect(isCharacterAssignedToPlayer(elScalar, { uid: 'uid-a' })).toBe(true);
    expect(isCharacterAssignedToPlayer(elArray, { uid: 'uid-a' })).toBe(true);
  });

  it('does not match a uid that is not the stored assignedPlayerUid', () => {
    expect(isCharacterAssignedToPlayer(elArray, { uid: 'uid-z' })).toBe(false);
  });

  it('returns false for null element', () => {
    expect(isCharacterAssignedToPlayer(null, { email: 'alice@example.com' })).toBe(false);
  });

  it('returns false for empty viewer', () => {
    expect(isCharacterAssignedToPlayer(elArray, {})).toBe(false);
  });
});

describe('toggleAssignedPlayerEmail', () => {
  it('adds a new email when not present', () => {
    const patch = toggleAssignedPlayerEmail(el0, 'alice@example.com', roster);
    expect(patch.assignedPlayerEmails).toEqual(['alice@example.com']);
    expect(patch.assignedPlayerEmail).toBe('alice@example.com');
    expect(patch.assignedPlayerUid).toBe('uid-a');
    expect(patch.playerName).toBe('Alice');
  });

  it('removes an email when already present', () => {
    const patch = toggleAssignedPlayerEmail(elScalar, 'alice@example.com');
    expect(patch.assignedPlayerEmails).toEqual([]);
    expect(patch.assignedPlayerEmail).toBeUndefined();
    expect(patch.assignedPlayerUid).toBeUndefined();
  });

  it('adds a second email, preserves first as scalar', () => {
    const elOne = { ...elScalar, assignedPlayerEmails: ['alice@example.com'] };
    const patch = toggleAssignedPlayerEmail(elOne, 'bob@example.com', roster);
    expect(patch.assignedPlayerEmails).toEqual(['alice@example.com', 'bob@example.com']);
    expect(patch.assignedPlayerEmail).toBe('alice@example.com');
    expect(patch.assignedPlayerUid).toBe('uid-a');
  });

  it('removes the first email, promotes second to scalar', () => {
    const patch = toggleAssignedPlayerEmail(elArray, 'alice@example.com', roster);
    expect(patch.assignedPlayerEmails).toEqual(['bob@example.com']);
    expect(patch.assignedPlayerEmail).toBe('bob@example.com');
    expect(patch.assignedPlayerUid).toBe('uid-b');
    expect(patch.playerName).toBe('Bob');
  });

  it('normalizes email case', () => {
    const patch = toggleAssignedPlayerEmail(el0, 'ALICE@EXAMPLE.COM', roster);
    expect(patch.assignedPlayerEmails).toEqual(['alice@example.com']);
  });

  it('ignores empty email', () => {
    expect(toggleAssignedPlayerEmail(el0, '')).toEqual({});
  });
});

describe('clearAssignedPlayerEmail', () => {
  it('removes a player from the list', () => {
    const patch = clearAssignedPlayerEmail(elArray, 'alice@example.com', roster);
    expect(patch.assignedPlayerEmails).toEqual(['bob@example.com']);
    expect(patch.assignedPlayerEmail).toBe('bob@example.com');
  });

  it('clears everything when only one assignee removed', () => {
    const patch = clearAssignedPlayerEmail(elScalar, 'alice@example.com');
    expect(patch.assignedPlayerEmails).toEqual([]);
    expect(patch.assignedPlayerEmail).toBeUndefined();
    expect(patch.assignedPlayerUid).toBeUndefined();
  });

  it('is a no-op for non-assigned email', () => {
    const patch = clearAssignedPlayerEmail(elScalar, 'carol@example.com');
    expect(patch.assignedPlayerEmails).toEqual(['alice@example.com']);
    expect(patch.assignedPlayerEmail).toBe('alice@example.com');
  });
});

describe('assignedPlayerLabel', () => {
  it('returns null for unassigned', () => {
    expect(assignedPlayerLabel(el0, roster)).toBeNull();
  });

  it('returns first name for single assignee', () => {
    expect(assignedPlayerLabel(elScalar, roster)).toBe('Alice');
  });

  it('returns "Name +N" for multiple assignees', () => {
    expect(assignedPlayerLabel(elArray, roster)).toBe('Alice +1');
  });

  it('falls back to email when no roster entry', () => {
    expect(assignedPlayerLabel(elScalar, [])).toBe('alice@example.com');
  });
});
