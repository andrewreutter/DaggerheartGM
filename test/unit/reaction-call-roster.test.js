import { describe, it, expect } from 'vitest';
import {
  buildReactionCallRoster,
  formatReactionCallResultBadge,
  canViewerProceedReaction,
  resolveReactionCallTrait,
} from '../../src/client/lib/reaction-call-roster.js';

describe('resolveReactionCallTrait', () => {
  it('uses the marquee default trait', () => {
    expect(resolveReactionCallTrait({ _reactionTrait: 'agility' }, 'c1')).toBe('agility');
  });

  it('prefers a valid per-character override', () => {
    expect(resolveReactionCallTrait({
      _reactionTrait: 'agility',
      _reactionTraitByInstanceId: { c1: 'presence' },
    }, 'c1')).toBe('presence');
    expect(resolveReactionCallTrait({
      _reactionTrait: 'agility',
      _reactionTraitByInstanceId: { c1: 'presence' },
    }, 'c2')).toBe('agility');
  });

  it('falls back when the override is not a trait key', () => {
    expect(resolveReactionCallTrait({
      _reactionTrait: 'instinct',
      _reactionTraitByInstanceId: { c1: 'not-a-trait' },
    }, 'c1')).toBe('instinct');
  });
});

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
      marquee: {
        _reactionTrait: 'agility',
        _reactionTraitByInstanceId: { c2: 'presence' },
      },
    });
    expect(roster).toEqual([
      { instanceId: 'c1', name: 'Ada', subRoll: null, trait: 'agility' },
      { instanceId: 'c2', name: 'Bea', subRoll: pendingBanners[0], trait: 'presence' },
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
    expect(roster[0].trait).toBeNull();
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
  const elMulti = {
    instanceId: 'c2',
    assignedPlayerEmail: 'a@x.com',
    assignedPlayerEmails: ['a@x.com', 'b@x.com'],
    assignedPlayerUid: 'uid-a',
  };

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

  it('allows any player in assignedPlayerEmails array', () => {
    expect(canViewerProceedReaction({ isPlayer: true, characterEl: elMulti, playerEmail: 'b@x.com' })).toBe(true);
    expect(canViewerProceedReaction({ isPlayer: true, characterEl: elMulti, playerEmail: 'c@x.com' })).toBe(false);
  });
});
