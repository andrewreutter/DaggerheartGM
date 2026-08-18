/**
 * Unit tests for src/server/home-lobby.js
 * - tableCardLobbySignature: stable string from card-visible fields
 * - shouldNotifyHomeLobby: when to fan out to home-lobby subscribers
 * - toTableCardDto cache-bust (tablePreviewAt → ?v= in previewUrl)
 */
import { describe, it, expect, vi } from 'vitest';
import { tableCardLobbySignature, shouldNotifyHomeLobby, notifyHomeLobby } from '../../src/server/home-lobby.js';
import { toTableCardDto } from '../../src/client/lib/table-character-roster.js';

// ── tableCardLobbySignature ─────────────────────────────────────────────────

describe('tableCardLobbySignature', () => {
  it('returns a string', () => {
    expect(typeof tableCardLobbySignature({})).toBe('string');
  });

  it('is stable for identical data', () => {
    const data = { tableName: 'My Table', gmDisplayName: 'GM', elements: [], tablePreviewUrl: 'http://x.com/p.png', tablePreviewAt: 1234 };
    expect(tableCardLobbySignature(data)).toBe(tableCardLobbySignature(data));
  });

  it('changes when tableName changes', () => {
    const base = { tableName: 'A', gmDisplayName: 'GM', elements: [] };
    const changed = { ...base, tableName: 'B' };
    expect(tableCardLobbySignature(base)).not.toBe(tableCardLobbySignature(changed));
  });

  it('changes when a character is added', () => {
    const base = { tableName: 'T', elements: [] };
    const withChar = { tableName: 'T', elements: [{ elementType: 'character', name: 'Hero' }] };
    expect(tableCardLobbySignature(base)).not.toBe(tableCardLobbySignature(withChar));
  });

  it('changes when tablePreviewUrl changes', () => {
    const base = { tableName: 'T', tablePreviewUrl: 'http://x.com/a.png', tablePreviewAt: 1 };
    const changed = { ...base, tablePreviewUrl: 'http://x.com/b.png' };
    expect(tableCardLobbySignature(base)).not.toBe(tableCardLobbySignature(changed));
  });

  it('changes when tablePreviewAt changes', () => {
    const base = { tableName: 'T', tablePreviewUrl: 'http://x.com/p.png', tablePreviewAt: 100 };
    const changed = { ...base, tablePreviewAt: 200 };
    expect(tableCardLobbySignature(base)).not.toBe(tableCardLobbySignature(changed));
  });

  it('does NOT change when only tokenX/tokenY change (not in signature)', () => {
    const base = { tableName: 'T', elements: [{ elementType: 'character', name: 'Hero', tokenX: 0, tokenY: 0 }] };
    const moved = { tableName: 'T', elements: [{ elementType: 'character', name: 'Hero', tokenX: 100, tokenY: 50 }] };
    // Both have the same character name — signature should be equal
    expect(tableCardLobbySignature(base)).toBe(tableCardLobbySignature(moved));
  });

  it('handles null/undefined data gracefully', () => {
    expect(() => tableCardLobbySignature(null)).not.toThrow();
    expect(() => tableCardLobbySignature(undefined)).not.toThrow();
  });
});

// ── shouldNotifyHomeLobby ───────────────────────────────────────────────────

describe('shouldNotifyHomeLobby', () => {
  const data = { tableName: 'T', gmDisplayName: 'GM', elements: [] };

  it('returns false when nothing changed', () => {
    expect(shouldNotifyHomeLobby({ op: { op: 'update-element' }, prevData: data, nextData: data, prevPublic: false, nextPublic: false })).toBe(false);
  });

  it('returns true when tableName changes', () => {
    const next = { ...data, tableName: 'Renamed' };
    expect(shouldNotifyHomeLobby({ op: { op: 'set-table-name' }, prevData: data, nextData: next, prevPublic: false, nextPublic: false })).toBe(true);
  });

  it('returns true for add-player-email (membership op) regardless of data change', () => {
    expect(shouldNotifyHomeLobby({ op: { op: 'add-player-email' }, prevData: data, nextData: data, prevPublic: false, nextPublic: false })).toBe(true);
  });

  it('returns true for remove-player-email', () => {
    expect(shouldNotifyHomeLobby({ op: { op: 'remove-player-email' }, prevData: data, nextData: data, prevPublic: false, nextPublic: false })).toBe(true);
  });

  it('returns true for set-player-emails', () => {
    expect(shouldNotifyHomeLobby({ op: { op: 'set-player-emails' }, prevData: data, nextData: data, prevPublic: false, nextPublic: false })).toBe(true);
  });

  it('returns true when public flag flips', () => {
    expect(shouldNotifyHomeLobby({ op: { op: 'set-table-public' }, prevData: data, nextData: data, prevPublic: false, nextPublic: true })).toBe(true);
  });

  it('returns false for token-only op (update-element without visible change)', () => {
    // prevData and nextData differ only in elements[0].tokenX — not in the signature
    const prev = { tableName: 'T', elements: [{ elementType: 'character', name: 'Hero', tokenX: 0 }] };
    const next = { tableName: 'T', elements: [{ elementType: 'character', name: 'Hero', tokenX: 100 }] };
    expect(shouldNotifyHomeLobby({ op: { op: 'update-element' }, prevData: prev, nextData: next, prevPublic: false, nextPublic: false })).toBe(false);
  });

  it('returns true when a character is added', () => {
    const next = { ...data, elements: [{ elementType: 'character', name: 'Hero' }] };
    expect(shouldNotifyHomeLobby({ op: { op: 'add-elements' }, prevData: data, nextData: next, prevPublic: false, nextPublic: false })).toBe(true);
  });

  it('returns true when tablePreviewAt changes (screenshot refreshed)', () => {
    const prev = { tableName: 'T', tablePreviewUrl: 'http://x.com/p.png', tablePreviewAt: 100, elements: [] };
    const next = { ...prev, tablePreviewAt: 200 };
    expect(shouldNotifyHomeLobby({ op: { op: 'none' }, prevData: prev, nextData: next, prevPublic: false, nextPublic: false })).toBe(true);
  });
});

// ── notifyHomeLobby ─────────────────────────────────────────────────────────

describe('notifyHomeLobby', () => {
  it('calls notifyChange for owner uid', () => {
    const mgr = { notifyChange: vi.fn() };
    notifyHomeLobby(mgr, { ownerUid: 'uid-gm', playerEmails: [], notifyPublic: false });
    expect(mgr.notifyChange).toHaveBeenCalledWith('home_owned', 'uid-gm');
  });

  it('calls notifyChange for each invited email (lowercased)', () => {
    const mgr = { notifyChange: vi.fn() };
    notifyHomeLobby(mgr, { ownerUid: 'uid-gm', playerEmails: ['Alice@Example.com', 'bob@test.com'], notifyPublic: false });
    expect(mgr.notifyChange).toHaveBeenCalledWith('home_invited', 'alice@example.com');
    expect(mgr.notifyChange).toHaveBeenCalledWith('home_invited', 'bob@test.com');
  });

  it('calls notifyChange for home_public when notifyPublic is true', () => {
    const mgr = { notifyChange: vi.fn() };
    notifyHomeLobby(mgr, { ownerUid: 'uid-gm', playerEmails: [], notifyPublic: true });
    expect(mgr.notifyChange).toHaveBeenCalledWith('home_public', 'all');
  });

  it('does NOT call home_public when notifyPublic is false', () => {
    const mgr = { notifyChange: vi.fn() };
    notifyHomeLobby(mgr, { ownerUid: 'uid-gm', playerEmails: [], notifyPublic: false });
    expect(mgr.notifyChange).not.toHaveBeenCalledWith('home_public', 'all');
  });
});

// ── toTableCardDto cache-bust ────────────────────────────────────────────────

describe('toTableCardDto cache-bust', () => {
  it('appends ?v=<tablePreviewAt> to previewUrl when both fields are set', () => {
    const row = {
      id: 'tbl-1',
      data: { tablePreviewUrl: 'https://cdn.example.com/preview.png', tablePreviewAt: 1700000000000 },
    };
    const dto = toTableCardDto(row);
    expect(dto.previewUrl).toBe('https://cdn.example.com/preview.png?v=1700000000000');
  });

  it('returns plain previewUrl when tablePreviewAt is absent', () => {
    const row = {
      id: 'tbl-1',
      data: { tablePreviewUrl: 'https://cdn.example.com/preview.png' },
    };
    const dto = toTableCardDto(row);
    expect(dto.previewUrl).toBe('https://cdn.example.com/preview.png');
  });

  it('returns null previewUrl when tablePreviewUrl is absent', () => {
    const row = { id: 'tbl-1', data: { tablePreviewAt: 1700000000000 } };
    const dto = toTableCardDto(row);
    expect(dto.previewUrl).toBeNull();
  });

  it('does not add a duplicate ?v= if previewUrl already has a query string', () => {
    const row = {
      id: 'tbl-1',
      data: {
        tablePreviewUrl: 'https://cdn.example.com/preview.png?w=640',
        tablePreviewAt: 123456,
      },
    };
    const dto = toTableCardDto(row);
    expect(dto.previewUrl).toContain('v=123456');
    // URL is well-formed: ?w=640&v=123456 (no duplicate ?)
    expect(dto.previewUrl?.split('?').length).toBe(2);
  });
});
