import { describe, it, expect } from 'vitest';
import {
  rollShouldUseMapFilteredTargets,
  rollIsHitMissEligibleAttack,
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
