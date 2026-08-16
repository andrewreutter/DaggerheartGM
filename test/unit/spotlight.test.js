import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SPOTLIGHT,
  isSpotlightHolder,
  isGmHolder,
  spotlightCatchUpCount,
  spotlightInactiveBeamOpacity,
  highestCatchUpKeys,
  qualifiesForSpotlightRoll,
  isSpotlightGatedRollMeta,
  assignSpotlightHolder,
  applySpotlightRollAck,
} from '../../src/client/lib/spotlight.js';

describe('qualifiesForSpotlightRoll', () => {
  it('returns action for a Duality PC roll with an attacker', () => {
    expect(
      qualifiesForSpotlightRoll({
        dominant: 'hope',
        _attackerInstanceId: 'pc-1',
      }),
    ).toBe('action');
  });

  it('returns adversary when tagged, even if dominant + attacker are set', () => {
    expect(
      qualifiesForSpotlightRoll({
        dominant: 'hope',
        _attackerInstanceId: 'adv-1',
        _attackerType: 'adversary',
      }),
    ).toBe('adversary');
  });

  it('returns null for reaction, rest, and untagged rolls', () => {
    expect(qualifiesForSpotlightRoll({ dominant: 'fear', _attackerInstanceId: 'pc-1', _isReaction: true })).toBe(null);
    expect(qualifiesForSpotlightRoll({ dominant: 'hope', _attackerInstanceId: 'pc-1', _rest: true })).toBe(null);
    expect(qualifiesForSpotlightRoll({ dominant: 'hope' })).toBe(null);
    expect(qualifiesForSpotlightRoll({ _attackerInstanceId: 'pc-1' })).toBe(null);
    expect(qualifiesForSpotlightRoll({})).toBe(null);
  });
});

describe('isSpotlightGatedRollMeta', () => {
  it('gates intent-panel action rolls and attacks', () => {
    expect(isSpotlightGatedRollMeta({ _intentPanelForActionRoll: true })).toBe(true);
    expect(isSpotlightGatedRollMeta({ _weaponRangeFt: 5 })).toBe(true);
    expect(isSpotlightGatedRollMeta({ _featureNeedsTarget: true })).toBe(true);
  });

  it('excludes reactions, rest, and physical-roll resume', () => {
    expect(isSpotlightGatedRollMeta({ _intentPanelForActionRoll: true, _isReaction: true })).toBe(false);
    expect(isSpotlightGatedRollMeta({ _intentPanelForActionRoll: true, _reactionCallRollDbId: 9 })).toBe(false);
    expect(isSpotlightGatedRollMeta({ _intentPanelForActionRoll: true, _rest: true })).toBe(false);
    expect(isSpotlightGatedRollMeta({ _weaponRangeFt: 5, _v2PhysicalRollResume: true })).toBe(false);
    expect(isSpotlightGatedRollMeta({})).toBe(false);
  });
});

describe('applySpotlightRollAck', () => {
  it('is a no-op (same reference) for non-qualifying rolls', () => {
    const s = { ...DEFAULT_SPOTLIGHT, lastSeenSeq: {} };
    expect(applySpotlightRollAck(s, { dominant: 'hope' })).toBe(s);
    expect(applySpotlightRollAck(DEFAULT_SPOTLIGHT, { _rest: true })).toBe(DEFAULT_SPOTLIGHT);
  });

  it('transfers to GM on Fear and stamps the attacker', () => {
    const start = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    const next = applySpotlightRollAck(start, {
      dominant: 'fear',
      _attackerInstanceId: 'pc-1',
    });
    expect(next).not.toBe(start);
    expect(next.holderType).toBe('gm');
    expect(next.holderInstanceId).toBe(null);
    expect(next.rollSeq).toBe(1);
    expect(next.lastSeenSeq['pc-1']).toBe(1);
    expect(spotlightCatchUpCount(next, 'pc-1')).toBe(0);
  });

  it('opens the spotlight on Hope and Critical', () => {
    const start = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    const hope = applySpotlightRollAck(start, { dominant: 'hope', _attackerInstanceId: 'pc-1' });
    expect(hope.holderType).toBe(null);
    expect(hope.holderInstanceId).toBe(null);
    expect(hope.rollSeq).toBe(1);
    expect(hope.lastSeenSeq['pc-1']).toBe(1);

    const crit = applySpotlightRollAck(start, { dominant: 'critical', _attackerInstanceId: 'pc-1' });
    expect(crit.holderType).toBe(null);
    expect(crit.rollSeq).toBe(1);
    expect(crit.lastSeenSeq['pc-1']).toBe(1);
  });

  it('increments rollSeq on adversary rolls without changing the holder', () => {
    const start = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    const next = applySpotlightRollAck(start, { _attackerType: 'adversary', _attackerInstanceId: 'adv-1' });
    expect(next.holderType).toBe('character');
    expect(next.holderInstanceId).toBe('pc-1');
    expect(next.rollSeq).toBe(1);
    expect(next.lastSeenSeq['pc-1']).toBeUndefined();
    expect(spotlightCatchUpCount(next, 'pc-1')).toBe(1);
    expect(spotlightCatchUpCount(next, 'gm')).toBe(1);
  });
});

describe('spotlightCatchUpCount / highestCatchUpKeys', () => {
  it('treats a missing lastSeenSeq key as 0', () => {
    const s = { holderType: null, holderInstanceId: null, rollSeq: 4, lastSeenSeq: { 'pc-1': 1 } };
    expect(spotlightCatchUpCount(s, 'pc-1')).toBe(3);
    expect(spotlightCatchUpCount(s, 'gm')).toBe(4);
    expect(spotlightCatchUpCount(s, 'pc-2')).toBe(4);
  });

  it('returns keys tied for the max catch-up, and none when max is 0', () => {
    const s = { holderType: null, holderInstanceId: null, rollSeq: 5, lastSeenSeq: { gm: 2, 'pc-1': 2, 'pc-2': 4 } };
    expect(highestCatchUpKeys(s, ['gm', 'pc-1', 'pc-2'])).toEqual(['gm', 'pc-1']);
    expect(highestCatchUpKeys(DEFAULT_SPOTLIGHT, ['gm', 'pc-1'])).toEqual([]);
  });

  it('skips the current holder when ranking catch-up', () => {
    const s = { holderType: 'gm', holderInstanceId: null, rollSeq: 5, lastSeenSeq: { gm: 0, 'pc-1': 3, 'pc-2': 4, 'pc-3': 3 } };
    expect(highestCatchUpKeys(s, ['gm', 'pc-1', 'pc-2', 'pc-3'])).toEqual(['pc-1', 'pc-3']);
  });

  it('scales inactive beam opacity with catch-up so higher counts read brighter', () => {
    const zero = spotlightInactiveBeamOpacity(0);
    const one = spotlightInactiveBeamOpacity(1);
    const two = spotlightInactiveBeamOpacity(2);
    expect(one).toBeGreaterThan(zero);
    expect(two).toBeGreaterThan(one);
    expect(two - one).toBeCloseTo(one - zero);
    expect(spotlightInactiveBeamOpacity(99)).toBeLessThan(0.95);
  });
});

describe('holder helpers / assignSpotlightHolder', () => {
  it('identifies the character and GM holders', () => {
    const pc = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    expect(isSpotlightHolder(pc, 'pc-1')).toBe(true);
    expect(isSpotlightHolder(pc, 'pc-2')).toBe(false);
    expect(isGmHolder(pc)).toBe(false);
    const gm = assignSpotlightHolder(pc, 'gm');
    expect(isGmHolder(gm)).toBe(true);
    expect(gm.holderInstanceId).toBe(null);
    expect(gm.rollSeq).toBe(pc.rollSeq);
    expect(gm.lastSeenSeq).toEqual(pc.lastSeenSeq);
  });
});
