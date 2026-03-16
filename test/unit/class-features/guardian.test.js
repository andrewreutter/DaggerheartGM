import { describe, it, expect, vi } from 'vitest';
import Guardian from '../../../src/features/classes/Guardian.js';

function makeEntity(overrides = {}) {
  const updates = vi.fn();
  const el = {
    instanceId: 'g1',
    activeModifiers: [],
    thresholds: { major: 4, severe: 8 },
    ...overrides,
  };
  return { el, updates };
}

describe('Guardian.onHpDealt', () => {
  it('does nothing when no Unstoppable Die chip is present', () => {
    const { el, updates } = makeEntity();
    Guardian.onHpDealt({ character: { ...el, updateActiveElement: updates }, hpDealt: 2, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });

  it('increments d4 → d6 on first HP dealt', () => {
    const mod = { id: 'unstoppable-die-g1', name: 'Unstoppable Die', dice: 'd4', refreshOn: 'longRest' };
    const { el, updates } = makeEntity({ activeModifiers: [mod] });
    const character = { ...el, activeModifiers: [mod] };
    Guardian.onHpDealt({ character, hpDealt: 1, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('g1', { activeModifiers: [{ ...mod, dice: 'd6' }] });
  });

  it('increments d6 → d8', () => {
    const mod = { id: 'unstoppable-die-g1', name: 'Unstoppable Die', dice: 'd6', refreshOn: 'longRest' };
    const { el, updates } = makeEntity({ activeModifiers: [mod] });
    Guardian.onHpDealt({ character: { ...el }, hpDealt: 3, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('g1', { activeModifiers: [{ ...mod, dice: 'd8' }] });
  });

  it('caps at d10 — no further increment', () => {
    const mod = { id: 'unstoppable-die-g1', name: 'Unstoppable Die', dice: 'd10', refreshOn: 'longRest' };
    const { el, updates } = makeEntity({ activeModifiers: [mod] });
    Guardian.onHpDealt({ character: { ...el }, hpDealt: 2, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });

  it('does not fire when hpDealt < 1', () => {
    const mod = { id: 'unstoppable-die-g1', name: 'Unstoppable Die', dice: 'd4', refreshOn: 'longRest' };
    const { el, updates } = makeEntity({ activeModifiers: [mod] });
    Guardian.onHpDealt({ character: { ...el }, hpDealt: 0, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });
});

describe('Guardian.modifyPreThresholdDamage', () => {
  const thresholds = { major: 4, severe: 8 };

  it('returns dmgTotal unchanged when no Unstoppable Die chip', () => {
    const target = { activeModifiers: [], thresholds };
    expect(Guardian.modifyPreThresholdDamage(6, { target })).toBe(6);
  });

  it('reduces Severe-tier damage to just below severe threshold', () => {
    const target = { activeModifiers: [{ id: 'unstoppable-die-g1' }], thresholds };
    expect(Guardian.modifyPreThresholdDamage(10, { target })).toBe(7); // severe - 1 = 7
  });

  it('reduces Major-tier damage to just below major threshold', () => {
    const target = { activeModifiers: [{ id: 'unstoppable-die-g1' }], thresholds };
    expect(Guardian.modifyPreThresholdDamage(5, { target })).toBe(3); // major - 1 = 3
  });

  it('reduces Minor-tier damage to 0', () => {
    const target = { activeModifiers: [{ id: 'unstoppable-die-g1' }], thresholds };
    expect(Guardian.modifyPreThresholdDamage(2, { target })).toBe(0);
  });

  it('does not affect 0 damage', () => {
    const target = { activeModifiers: [{ id: 'unstoppable-die-g1' }], thresholds };
    expect(Guardian.modifyPreThresholdDamage(0, { target })).toBe(0);
  });
});
