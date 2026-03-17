/**
 * Unit tests for Bard Rally Die feature updates:
 * - producesModifier has mode: 'clearStress'
 * - _rallyClearStress handling clears correct stress amount
 */
import { describe, it, expect } from 'vitest';
import Bard from '../../src/features/classes/Bard.js';

describe('Bard Rally Die producesModifier', () => {
  it('has mode clearStress', () => {
    expect(Bard.hopeAbility.producesModifier.mode).toBe('clearStress');
  });

  it('has consumeOnUse: true', () => {
    expect(Bard.hopeAbility.producesModifier.consumeOnUse).toBe(true);
  });

  it('has dice property', () => {
    expect(Bard.hopeAbility.producesModifier.dice).toBeTruthy();
  });

  it('has refreshOn: use', () => {
    expect(Bard.hopeAbility.producesModifier.refreshOn).toBe('use');
  });
});

describe('_rallyClearStress logic', () => {
  // Simulate the GMTableView handleBannerAcknowledge logic for _rallyClearStress
  function applyRallyClearStress(charEl, roll) {
    if (!roll._rallyClearStress || !roll._attackerInstanceId) return null;
    const rollTotal = roll.total ?? parseInt(roll.subItems?.[0]?.result, 10) ?? 0;
    const newStress = Math.max(0, (charEl.currentStress ?? 0) - rollTotal);
    const newMods = (charEl.activeModifiers || []).filter(m => m.id !== roll._rallyDieModId);
    return { currentStress: newStress, activeModifiers: newMods };
  }

  it('clears stress equal to roll total', () => {
    const charEl = { instanceId: 'c1', currentStress: 4, activeModifiers: [{ id: 'mod-1', name: 'Rally Die' }] };
    const roll = { _rallyClearStress: true, _attackerInstanceId: 'c1', total: 3, _rallyDieModId: 'mod-1' };
    const result = applyRallyClearStress(charEl, roll);
    expect(result.currentStress).toBe(1);
    expect(result.activeModifiers).toHaveLength(0);
  });

  it('clamps stress to 0 when result exceeds current stress', () => {
    const charEl = { instanceId: 'c1', currentStress: 2, activeModifiers: [{ id: 'mod-1', name: 'Rally Die' }] };
    const roll = { _rallyClearStress: true, _attackerInstanceId: 'c1', total: 5, _rallyDieModId: 'mod-1' };
    const result = applyRallyClearStress(charEl, roll);
    expect(result.currentStress).toBe(0);
  });

  it('falls back to subItems result when total is absent', () => {
    const charEl = { instanceId: 'c1', currentStress: 3, activeModifiers: [{ id: 'mod-1', name: 'Rally Die' }] };
    const roll = {
      _rallyClearStress: true,
      _attackerInstanceId: 'c1',
      total: undefined,
      subItems: [{ result: '2' }],
      _rallyDieModId: 'mod-1',
    };
    const result = applyRallyClearStress(charEl, roll);
    expect(result.currentStress).toBe(1);
  });

  it('only removes the matching modifier by id', () => {
    const charEl = {
      instanceId: 'c1',
      currentStress: 2,
      activeModifiers: [
        { id: 'mod-1', name: 'Rally Die' },
        { id: 'mod-2', name: 'Other' },
      ],
    };
    const roll = { _rallyClearStress: true, _attackerInstanceId: 'c1', total: 1, _rallyDieModId: 'mod-1' };
    const result = applyRallyClearStress(charEl, roll);
    expect(result.activeModifiers).toHaveLength(1);
    expect(result.activeModifiers[0].id).toBe('mod-2');
  });
});
