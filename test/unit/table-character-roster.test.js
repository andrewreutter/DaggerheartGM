import { describe, it, expect } from 'vitest';
import {
  summarizeTableCharacterRoster,
  toTableCardDto,
  nextTableIsPublic,
  classifyTableViewer,
} from '../../src/client/lib/table-character-roster.js';

describe('summarizeTableCharacterRoster', () => {
  it('returns empty when data is missing', () => {
    expect(summarizeTableCharacterRoster(undefined)).toEqual({ count: 0, names: [] });
    expect(summarizeTableCharacterRoster(null)).toEqual({ count: 0, names: [] });
    expect(summarizeTableCharacterRoster({})).toEqual({ count: 0, names: [] });
  });

  it('lists character names only (not emails, playerName, or adversaries)', () => {
    const data = {
      playerEmails: ['alice@example.com'],
      elements: [
        { elementType: 'character', name: 'Briar', assignedPlayerEmail: 'alice@example.com', playerName: 'Alice' },
        { elementType: 'character', name: '  Thorn  ' },
        { elementType: 'adversary', name: 'Goblin' },
        { elementType: 'character', name: '' },
      ],
    };
    expect(summarizeTableCharacterRoster(data)).toEqual({
      count: 2,
      names: ['Briar', 'Thorn'],
    });
  });
});

describe('toTableCardDto', () => {
  it('omits emails and uses character names + preview URL', () => {
    const dto = toTableCardDto({
      id: 't1',
      userId: 'gm-1',
      data: {
        tableName: 'Crossroads',
        gmDisplayName: 'Dana',
        tablePreviewUrl: 'https://cdn/preview.png',
        playerEmails: ['secret@example.com'],
        elements: [{ elementType: 'character', name: 'Briar' }],
      },
    });
    expect(dto).toEqual({
      id: 't1',
      name: 'Crossroads',
      gmName: 'Dana',
      previewUrl: 'https://cdn/preview.png',
      characterNames: ['Briar'],
      characterCount: 1,
    });
    expect(JSON.stringify(dto)).not.toMatch(/@/);
    expect(dto.players).toBeUndefined();
  });

  it('includes updatedAt ms when the row has a timestamp', () => {
    const dto = toTableCardDto({
      id: 't1',
      data: { tableName: 'Hunt' },
      updatedAt: new Date('2026-08-18T00:00:00.000Z'),
    });
    expect(dto.updatedAt).toBe(Date.parse('2026-08-18T00:00:00.000Z'));
  });

  it('uses tableId key for invited-room cards', () => {
    const dto = toTableCardDto(
      { id: 't1', userId: 'gm-1', data: { tableName: 'Hunt', gmDisplayName: 'GM' } },
      { tableIdKey: 'tableId' },
    );
    expect(dto.tableId).toBe('t1');
    expect(dto.gmUid).toBe('gm-1');
    expect(dto.tableName).toBe('Hunt');
    expect(dto.id).toBeUndefined();
  });
});

describe('nextTableIsPublic', () => {
  it('only set-table-public changes the flag', () => {
    expect(nextTableIsPublic(true, { op: 'set-fear', fearCount: 1 })).toBe(true);
    expect(nextTableIsPublic(true, { op: 'update-element' })).toBe(true);
    expect(nextTableIsPublic(false, { op: 'set-table-public', isPublic: true })).toBe(true);
    expect(nextTableIsPublic(true, { op: 'set-table-public', isPublic: false })).toBe(false);
    expect(nextTableIsPublic(false, { op: 'set-table-public', isPublic: 1 })).toBe(false);
  });
});

describe('classifyTableViewer', () => {
  it('owner beats invited and public', () => {
    expect(classifyTableViewer({ isOwner: true, isInvited: true, isPublic: true })).toBe('owner');
  });
  it('invited player is not a spectator', () => {
    expect(classifyTableViewer({ isInvited: true, isPublic: true })).toBe('player');
  });
  it('public non-member is spectator', () => {
    expect(classifyTableViewer({ isPublic: true })).toBe('spectator');
  });
  it('private non-member is denied', () => {
    expect(classifyTableViewer({})).toBe('denied');
  });
});
