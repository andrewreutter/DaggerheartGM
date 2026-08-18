import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SPOTLIGHT,
  isSpotlightHolder,
  isGmHolder,
  spotlightCatchUpCount,
  SPOTLIGHT_ACTIVE_BEAM_OPACITY,
  SPOTLIGHT_GM_INACTIVE_BEAM_OPACITY,
  spotlightBeamOpacity,
  spotlightCharacterTooltip,
  showChooseSpotlightBanner,
  spotlightInactiveBeamOpacity,
  highestCatchUpKeys,
  qualifiesForSpotlightRoll,
  isSpotlightGatedRollMeta,
  assignSpotlightHolder,
  grantSpotlightToCharacter,
  actionRollPassesSpotlightToGm,
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

describe('actionRollPassesSpotlightToGm', () => {
  it('is true for Fear, a miss, or a total below DC', () => {
    expect(actionRollPassesSpotlightToGm({ dominant: 'fear' })).toBe(true);
    expect(actionRollPassesSpotlightToGm({ dominant: 'hope', isSuccess: false })).toBe(true);
    expect(actionRollPassesSpotlightToGm({ dominant: 'hope', total: 10, _difficulty: 12 })).toBe(true);
  });

  it('is false for Critical, a hit, or Hope with no failure signal', () => {
    expect(actionRollPassesSpotlightToGm({ dominant: 'critical', isSuccess: false })).toBe(false);
    expect(actionRollPassesSpotlightToGm({ dominant: 'hope', isSuccess: true })).toBe(false);
    expect(actionRollPassesSpotlightToGm({ dominant: 'hope', total: 16, _difficulty: 12 })).toBe(false);
    expect(actionRollPassesSpotlightToGm({ dominant: 'hope' })).toBe(false);
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

  it('transfers to GM on a failed Hope roll (miss / below DC)', () => {
    const start = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    const miss = applySpotlightRollAck(start, {
      dominant: 'hope',
      _attackerInstanceId: 'pc-1',
      isSuccess: false,
    });
    expect(miss.holderType).toBe('gm');
    expect(miss.holderInstanceId).toBe(null);
    expect(miss.lastSeenSeq['pc-1']).toBe(1);

    const belowDc = applySpotlightRollAck(start, {
      dominant: 'hope',
      _attackerInstanceId: 'pc-1',
      total: 11,
      _difficulty: 15,
    });
    expect(belowDc.holderType).toBe('gm');
  });

  it('opens the spotlight on successful Hope and Critical', () => {
    const start = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    const hope = applySpotlightRollAck(start, { dominant: 'hope', _attackerInstanceId: 'pc-1', isSuccess: true });
    expect(hope.holderType).toBe(null);
    expect(hope.holderInstanceId).toBe(null);
    expect(hope.rollSeq).toBe(1);
    expect(hope.lastSeenSeq['pc-1']).toBe(1);

    const hopeDc = applySpotlightRollAck(start, {
      dominant: 'hope',
      _attackerInstanceId: 'pc-1',
      total: 16,
      _difficulty: 15,
    });
    expect(hopeDc.holderType).toBe(null);

    const crit = applySpotlightRollAck(start, { dominant: 'critical', _attackerInstanceId: 'pc-1' });
    expect(crit.holderType).toBe(null);
    expect(crit.rollSeq).toBe(1);
    expect(crit.lastSeenSeq['pc-1']).toBe(1);

    const critBelowDc = applySpotlightRollAck(start, {
      dominant: 'critical',
      _attackerInstanceId: 'pc-1',
      total: 8,
      _difficulty: 15,
    });
    expect(critBelowDc.holderType).toBe(null);
  });

  it('increments rollSeq on adversary rolls without changing the holder', () => {
    const start = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    const next = applySpotlightRollAck(start, { _attackerType: 'adversary', _attackerInstanceId: 'adv-1' });
    expect(next.holderType).toBe('character');
    expect(next.holderInstanceId).toBe('pc-1');
    expect(next.rollSeq).toBe(1);
    expect(next.lastSeenSeq['pc-1']).toBeUndefined();
    expect(spotlightCatchUpCount(next, 'pc-1')).toBe(1);
    expect(spotlightCatchUpCount(next, 'gm')).toBe(0);
  });
});

describe('spotlightCatchUpCount / highestCatchUpKeys', () => {
  it('treats a missing lastSeenSeq key as 0 for characters, and never tracks the GM', () => {
    const s = { holderType: null, holderInstanceId: null, rollSeq: 4, lastSeenSeq: { 'pc-1': 1 } };
    expect(spotlightCatchUpCount(s, 'pc-1')).toBe(3);
    expect(spotlightCatchUpCount(s, 'gm')).toBe(0);
    expect(spotlightCatchUpCount(s, 'pc-2')).toBe(4);
  });

  it('returns character keys tied for the max catch-up, and none when max is 0', () => {
    const s = { holderType: null, holderInstanceId: null, rollSeq: 5, lastSeenSeq: { gm: 2, 'pc-1': 2, 'pc-2': 4 } };
    expect(highestCatchUpKeys(s, ['gm', 'pc-1', 'pc-2'])).toEqual(['pc-1']);
    expect(highestCatchUpKeys(DEFAULT_SPOTLIGHT, ['gm', 'pc-1'])).toEqual([]);
  });

  it('skips the current holder when ranking catch-up', () => {
    const s = { holderType: 'gm', holderInstanceId: null, rollSeq: 5, lastSeenSeq: { gm: 0, 'pc-1': 3, 'pc-2': 4, 'pc-3': 3 } };
    expect(highestCatchUpKeys(s, ['gm', 'pc-1', 'pc-2', 'pc-3'])).toEqual(['pc-1', 'pc-3']);
  });

  it('builds the character-beam tooltip with turn count and give-spotlight line', () => {
    expect(spotlightCharacterTooltip(3, 'Mira')).toBe(
      '3 turns since last Spotlight.\nClick to give Spotlight to Mira.',
    );
    expect(spotlightCharacterTooltip(0, '  ')).toBe(
      '0 turns since last Spotlight.\nClick to give Spotlight to character.',
    );
    expect(spotlightCharacterTooltip(2, 'Mira', { active: true })).toBe(
      '2 turns since last Spotlight.\nClick to clear Spotlight.',
    );
  });

  it('scales inactive beam opacity with catch-up so higher counts read brighter', () => {
    const zero = spotlightInactiveBeamOpacity(0);
    const one = spotlightInactiveBeamOpacity(1);
    const two = spotlightInactiveBeamOpacity(2);
    expect(one).toBeGreaterThan(zero);
    expect(two).toBeGreaterThan(one);
    expect(two - one).toBeCloseTo(one - zero);
    expect(spotlightInactiveBeamOpacity(99)).toBeLessThan(SPOTLIGHT_ACTIVE_BEAM_OPACITY);
  });

  it('keeps the GM inactive beam at about 50% so the crown cone stays readable', () => {
    expect(SPOTLIGHT_GM_INACTIVE_BEAM_OPACITY).toBeCloseTo(0.5);
    expect(spotlightBeamOpacity(false, { count: 0, minOpacity: SPOTLIGHT_GM_INACTIVE_BEAM_OPACITY }))
      .toBe(SPOTLIGHT_GM_INACTIVE_BEAM_OPACITY);
    expect(spotlightBeamOpacity(false, { count: 0 })).toBeLessThan(SPOTLIGHT_GM_INACTIVE_BEAM_OPACITY);
    expect(spotlightBeamOpacity(true, { count: 0, minOpacity: SPOTLIGHT_GM_INACTIVE_BEAM_OPACITY }))
      .toBe(SPOTLIGHT_ACTIVE_BEAM_OPACITY);
  });
});

describe('showChooseSpotlightBanner', () => {
  it('is true only when play is allowed and the spotlight is open', () => {
    expect(showChooseSpotlightBanner(true, DEFAULT_SPOTLIGHT)).toBe(true);
    expect(showChooseSpotlightBanner(true, { holderType: null, holderInstanceId: null, rollSeq: 2, lastSeenSeq: {} })).toBe(true);
    expect(showChooseSpotlightBanner(true, assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'gm'))).toBe(false);
    expect(showChooseSpotlightBanner(true, assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1'))).toBe(false);
    expect(showChooseSpotlightBanner(false, DEFAULT_SPOTLIGHT)).toBe(false);
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

  it('clears the spotlight when the current holder is assigned again', () => {
    const pc = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'character', 'pc-1');
    const clearedPc = assignSpotlightHolder(pc, 'character', 'pc-1');
    expect(clearedPc.holderType).toBe(null);
    expect(clearedPc.holderInstanceId).toBe(null);
    expect(clearedPc.rollSeq).toBe(pc.rollSeq);

    const gm = assignSpotlightHolder(DEFAULT_SPOTLIGHT, 'gm');
    const clearedGm = assignSpotlightHolder(gm, 'gm');
    expect(clearedGm.holderType).toBe(null);
    expect(isGmHolder(clearedGm)).toBe(false);
  });
});

describe('grantSpotlightToCharacter', () => {
  it('always sets the character holder and never toggles off', () => {
    const fromOpen = grantSpotlightToCharacter(DEFAULT_SPOTLIGHT, 'pc-1');
    expect(fromOpen.holderType).toBe('character');
    expect(fromOpen.holderInstanceId).toBe('pc-1');
    expect(fromOpen.rollSeq).toBe(DEFAULT_SPOTLIGHT.rollSeq);
    expect(fromOpen.lastSeenSeq).toEqual(DEFAULT_SPOTLIGHT.lastSeenSeq);

    const already = grantSpotlightToCharacter(fromOpen, 'pc-1');
    expect(already.holderType).toBe('character');
    expect(already.holderInstanceId).toBe('pc-1');
    expect(already.rollSeq).toBe(fromOpen.rollSeq);

    const switched = grantSpotlightToCharacter(fromOpen, 'pc-2');
    expect(switched.holderType).toBe('character');
    expect(switched.holderInstanceId).toBe('pc-2');
  });

  it('preserves rollSeq and lastSeenSeq when granting over a GM holder', () => {
    const gm = { holderType: 'gm', holderInstanceId: null, rollSeq: 7, lastSeenSeq: { 'pc-1': 3 } };
    const next = grantSpotlightToCharacter(gm, 'pc-1');
    expect(next.holderType).toBe('character');
    expect(next.holderInstanceId).toBe('pc-1');
    expect(next.rollSeq).toBe(7);
    expect(next.lastSeenSeq).toEqual({ 'pc-1': 3 });
  });
});
