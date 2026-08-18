import { describe, it, expect } from 'vitest';
import {
  rollShouldUseMapFilteredTargets,
  rollIsHitMissEligibleAttack,
  classifyAttackAgainstTarget,
  shouldApplyDamageOnAcknowledge,
  countAttackHitsAndMisses,
  resolveAttackTargetDefense,
} from '../../src/client/lib/banner-target-roll.js';

describe('rollIsHitMissEligibleAttack', () => {
  it('returns true when damage sub-items exist', () => {
    expect(rollIsHitMissEligibleAttack({ _attackerInstanceId: 'a' }, true)).toBe(true);
  });

  it('returns true for PC attack with weapon range and no damage (Retracting Claws)', () => {
    expect(
      rollIsHitMissEligibleAttack(
        { _attackerInstanceId: 'a', _weaponRangeFt: 5 },
        false
      )
    ).toBe(true);
  });

  it('returns true for virtual weapon with featureNeedsTarget and no damage', () => {
    expect(
      rollIsHitMissEligibleAttack(
        { _attackerInstanceId: 'a', _featureNeedsTarget: true },
        false
      )
    ).toBe(true);
  });

  it('returns false for non-attack rolls without damage', () => {
    expect(rollIsHitMissEligibleAttack({ _attackerInstanceId: 'a', _traitKey: 'agility' }, false)).toBe(
      false
    );
  });

  it('returns false for adversary rolls without damage', () => {
    expect(
      rollIsHitMissEligibleAttack(
        { _attackerInstanceId: 'adv', _attackerType: 'adversary', _attackRangeFt: 5 },
        false
      )
    ).toBe(false);
  });
});

describe('rollShouldUseMapFilteredTargets', () => {
  it('returns true for featureNeedsTarget', () => {
    expect(rollShouldUseMapFilteredTargets({ _featureNeedsTarget: true }, false)).toBe(true);
  });

  it('returns true for PC attack with weapon range and no damage (Retracting Claws)', () => {
    expect(
      rollShouldUseMapFilteredTargets(
        { _attackerInstanceId: 'a', _weaponRangeFt: 5 },
        false
      )
    ).toBe(true);
  });

  it('returns true for PC attack with weapon range and damage', () => {
    expect(
      rollShouldUseMapFilteredTargets(
        { _attackerInstanceId: 'a', _weaponRangeFt: 5 },
        true
      )
    ).toBe(true);
  });

  it('returns false for PC attack with damage but no range meta', () => {
    expect(rollShouldUseMapFilteredTargets({ _attackerInstanceId: 'a' }, true)).toBe(false);
  });

  it('returns true for adversary attack with attack range and damage', () => {
    expect(
      rollShouldUseMapFilteredTargets(
        { _attackerInstanceId: 'adv', _attackerType: 'adversary', _attackRangeFt: 5 },
        true
      )
    ).toBe(true);
  });

  it('returns false for adversary attack with attack range but no damage', () => {
    expect(
      rollShouldUseMapFilteredTargets(
        { _attackerInstanceId: 'adv', _attackerType: 'adversary', _attackRangeFt: 5 },
        false
      )
    ).toBe(false);
  });
});

describe('shouldApplyDamageOnAcknowledge', () => {
  const pc = { instanceId: 'pc1', type: 'character', evasion: 12 };

  it('does not apply damage when an adversary attack misses the PC evasion', () => {
    const roll = { total: 8, _attackerType: 'adversary' };
    expect(shouldApplyDamageOnAcknowledge(roll, pc, { effectiveTotal: 8 })).toBe(false);
    expect(classifyAttackAgainstTarget(roll, pc, { effectiveTotal: 8 })).toBe('miss');
  });

  it('applies damage when the attack meets or beats evasion', () => {
    const roll = { total: 12, _attackerType: 'adversary' };
    expect(shouldApplyDamageOnAcknowledge(roll, pc, { effectiveTotal: 12 })).toBe(true);
    expect(classifyAttackAgainstTarget(roll, pc, { effectiveTotal: 12 })).toBe('hit');
  });

  it('applies damage on Duality Critical even when the total is below evasion', () => {
    const roll = { total: 6, dominant: 'critical' };
    expect(shouldApplyDamageOnAcknowledge(roll, pc, { effectiveTotal: 6 })).toBe(true);
  });

  it('applies damage when the target has no numeric defense (unknown, not a miss)', () => {
    const roll = { total: 4, _attackerType: 'adversary' };
    expect(shouldApplyDamageOnAcknowledge(roll, { instanceId: 'pc2', type: 'character' }, { effectiveTotal: 4 })).toBe(true);
    expect(classifyAttackAgainstTarget(roll, { instanceId: 'pc2', type: 'character' }, { effectiveTotal: 4 })).toBe('unknown');
  });

  it('treats pending evasion bonus as extra defense', () => {
    const roll = { total: 12, _attackerType: 'adversary' };
    const opts = {
      effectiveTotal: 12,
      tableCharacters: [{ instanceId: 'pc1' }],
      getPendingEvasionBonus: () => 2,
    };
    expect(resolveAttackTargetDefense(pc, opts)).toBe(14);
    expect(shouldApplyDamageOnAcknowledge(roll, pc, opts)).toBe(false);
  });

  it('applies damage on Locked On auto-success even when the total is below evasion', () => {
    const roll = { total: 5, _attackerType: 'adversary' };
    expect(shouldApplyDamageOnAcknowledge(roll, pc, { effectiveTotal: 5, forceHit: true })).toBe(true);
  });
});

describe('countAttackHitsAndMisses', () => {
  it('counts mixed hit and miss for multi-target Acknowledge', () => {
    const roll = { total: 11 };
    const { hitCount, missCount } = countAttackHitsAndMisses(
      roll,
      [
        { instanceId: 'a', type: 'character', evasion: 10 },
        { instanceId: 'b', type: 'character', evasion: 14 },
      ],
      { effectiveTotal: 11 },
    );
    expect(hitCount).toBe(1);
    expect(missCount).toBe(1);
  });
});
