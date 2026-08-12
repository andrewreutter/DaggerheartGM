import { describe, it, expect } from 'vitest';
import {
  buildReactionCallRoster,
  formatReactionCallResultBadge,
  canViewerProceedReaction,
} from '../../src/client/lib/reaction-call-roster.js';

describe('buildReactionCallRoster', () => {
  const characters = [
    { instanceId: 'c1', name: 'Ada' },
    { instanceId: 'c2', name: 'Bea' },
  ];

  it('lists each target and attaches a correlated pending sub-roll', () => {
    const pendingBanners = [
      { _rollDbId: 9, _reactionCallRollDbId: 1, _attackerInstanceId: 'c2', total: 14, dominant: 'hope' },
    ];
    const roster = buildReactionCallRoster({
      targetInstanceIds: ['c1', 'c2'],
      marqueeRollDbId: 1,
      pendingBanners,
      tableCharacters: characters,
    });
    expect(roster).toEqual([
      { instanceId: 'c1', name: 'Ada', subRoll: null },
      { instanceId: 'c2', name: 'Bea', subRoll: pendingBanners[0] },
    ]);
  });

  it('ignores sub-rolls from a different marquee', () => {
    const roster = buildReactionCallRoster({
      targetInstanceIds: ['c1'],
      marqueeRollDbId: 1,
      pendingBanners: [
        { _rollDbId: 9, _reactionCallRollDbId: 2, _attackerInstanceId: 'c1', total: 20 },
      ],
      tableCharacters: characters,
    });
    expect(roster[0].subRoll).toBeNull();
  });
});

describe('formatReactionCallResultBadge', () => {
  it('treats a critical as an automatic success', () => {
    expect(formatReactionCallResultBadge({ total: 8, dominant: 'critical' }, 15)).toEqual({
      total: 8,
      label: '✦ Critical!',
      success: true,
    });
  });

  it('compares total to difficulty', () => {
    expect(formatReactionCallResultBadge({ total: 12, dominant: 'hope' }, 10)).toMatchObject({
      label: 'Success',
      success: true,
    });
    expect(formatReactionCallResultBadge({ total: 9, dominant: 'fear' }, 10)).toMatchObject({
      label: 'Failure',
      success: false,
    });
  });

  it('prefers the sub-roll difficulty over the fallback', () => {
    expect(formatReactionCallResultBadge({ total: 11, _difficulty: 12 }, 10)).toMatchObject({
      label: 'Failure',
    });
  });

  it('returns null until a numeric total exists', () => {
    expect(formatReactionCallResultBadge(null, 10)).toBeNull();
    expect(formatReactionCallResultBadge({ dominant: 'hope' }, 10)).toBeNull();
  });
});

describe('canViewerProceedReaction', () => {
  const el = { instanceId: 'c1', assignedPlayerEmail: 'a@x.com', assignedPlayerUid: 'uid-a' };

  it('allows the GM for any character', () => {
    expect(canViewerProceedReaction({ isPlayer: false, characterEl: el })).toBe(true);
  });

  it('allows an assigned player by email or uid', () => {
    expect(canViewerProceedReaction({ isPlayer: true, characterEl: el, playerEmail: 'a@x.com' })).toBe(true);
    expect(canViewerProceedReaction({ isPlayer: true, characterEl: el, playerUid: 'uid-a' })).toBe(true);
  });

  it('denies an unassigned player', () => {
    expect(canViewerProceedReaction({ isPlayer: true, characterEl: el, playerEmail: 'b@x.com', playerUid: 'other' })).toBe(false);
    expect(canViewerProceedReaction({ isPlayer: true, characterEl: null, playerEmail: 'a@x.com' })).toBe(false);
  });
});
