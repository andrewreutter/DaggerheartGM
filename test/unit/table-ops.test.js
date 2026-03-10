/**
 * Unit tests for src/client/lib/table-ops.js
 *
 * Pure-logic tests for the table operation state transformations.
 * No browser, no DOM, no Firebase needed.
 */
import { describe, it, expect } from 'vitest';
import { applyTableOp, applyPlayerTableOp, RUNTIME_KEYS } from '../../src/client/lib/table-ops.js';

// ---------------------------------------------------------------------------
// applyTableOp — GM-side state transformations
// ---------------------------------------------------------------------------

describe('applyTableOp', () => {
  const mkElement = (overrides = {}) => ({
    id: 'adv-1', instanceId: 'inst-1', elementType: 'adversary',
    name: 'Goblin', currentHp: 5, currentStress: 0, conditions: '',
    ...overrides,
  });

  it('update-element updates matching element', () => {
    const state = { activeElements: [mkElement(), mkElement({ instanceId: 'inst-2' })] };
    const result = applyTableOp({ op: 'update-element', instanceId: 'inst-1', updates: { currentHp: 3 } }, state);
    expect(result.activeElements[0].currentHp).toBe(3);
    expect(result.activeElements[1].currentHp).toBe(5);
  });

  it('add-elements appends new elements', () => {
    const state = { activeElements: [mkElement()] };
    const newEl = mkElement({ instanceId: 'inst-new', name: 'Orc' });
    const result = applyTableOp({ op: 'add-elements', elements: [newEl] }, state);
    expect(result.activeElements).toHaveLength(2);
    expect(result.activeElements[1].name).toBe('Orc');
  });

  it('remove-element removes matching element', () => {
    const state = { activeElements: [mkElement(), mkElement({ instanceId: 'inst-2' })] };
    const result = applyTableOp({ op: 'remove-element', instanceId: 'inst-1' }, state);
    expect(result.activeElements).toHaveLength(1);
    expect(result.activeElements[0].instanceId).toBe('inst-2');
  });

  it('clear-table keeps only characters and resets featureCountdowns', () => {
    const state = {
      activeElements: [
        mkElement(),
        mkElement({ instanceId: 'char-1', elementType: 'character', name: 'Hero' }),
        mkElement({ instanceId: 'env-1', elementType: 'environment', name: 'Forest' }),
      ],
      featureCountdowns: { 'some|key|0': 2 },
    };
    const result = applyTableOp({ op: 'clear-table' }, state);
    expect(result.activeElements).toHaveLength(1);
    expect(result.activeElements[0].elementType).toBe('character');
    expect(result.featureCountdowns).toEqual({});
  });

  it('set-fear sets fearCount', () => {
    const result = applyTableOp({ op: 'set-fear', fearCount: 5 }, {});
    expect(result.fearCount).toBe(5);
  });

  it('set-countdown merges countdown value', () => {
    const state = { featureCountdowns: { 'a|b|0': 1 } };
    const result = applyTableOp({ op: 'set-countdown', key: 'c|d|0', value: 3 }, state);
    expect(result.featureCountdowns).toEqual({ 'a|b|0': 1, 'c|d|0': 3 });
  });

  it('set-battle-mods replaces battle mods', () => {
    const mods = { lessDifficult: true, moreDangerous: false };
    const result = applyTableOp({ op: 'set-battle-mods', tableBattleMods: mods }, {});
    expect(result.tableBattleMods).toEqual(mods);
  });

  it('set-player-emails sets playerEmails', () => {
    const result = applyTableOp({ op: 'set-player-emails', playerEmails: ['a@b.com'] }, {});
    expect(result.playerEmails).toEqual(['a@b.com']);
  });

  it('update-base-data preserves runtime keys while replacing base data', () => {
    const el = mkElement({
      id: 'adv-1', instanceId: 'inst-1', elementType: 'adversary',
      name: 'Goblin', currentHp: 3, currentStress: 1, conditions: 'poisoned',
      role: 'bruiser', tier: 2, hp_max: 10, features: [{ name: 'Smash' }],
    });
    const state = { activeElements: [el] };
    const newBaseData = { id: 'adv-1', role: 'skulk', tier: 3, hp_max: 15, features: [{ name: 'Sneak' }] };
    const result = applyTableOp({ op: 'update-base-data', elementId: 'adv-1', newBaseData }, state);
    const updated = result.activeElements[0];
    expect(updated.role).toBe('skulk');
    expect(updated.hp_max).toBe(15);
    expect(updated.features[0].name).toBe('Sneak');
    // Runtime keys preserved
    expect(updated.instanceId).toBe('inst-1');
    expect(updated.elementType).toBe('adversary');
    expect(updated.name).toBe('Goblin');
    expect(updated.currentHp).toBe(3);
    expect(updated.currentStress).toBe(1);
    expect(updated.conditions).toBe('poisoned');
    expect(updated.tier).toBe(2);
  });

  it('update-base-data does not affect non-matching elements', () => {
    const state = {
      activeElements: [
        mkElement({ id: 'adv-1', instanceId: 'inst-1' }),
        mkElement({ id: 'adv-2', instanceId: 'inst-2', name: 'Orc' }),
      ],
    };
    const result = applyTableOp({ op: 'update-base-data', elementId: 'adv-1', newBaseData: { id: 'adv-1', role: 'new' } }, state);
    expect(result.activeElements[1].name).toBe('Orc');
    expect(result.activeElements[1].id).toBe('adv-2');
  });

  it('unknown op returns empty object', () => {
    const result = applyTableOp({ op: 'nonexistent' }, {});
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// applyPlayerTableOp — Player-side state transformations
// ---------------------------------------------------------------------------

describe('applyPlayerTableOp', () => {
  const mkState = (overrides = {}) => ({
    elements: [
      { instanceId: 'inst-1', elementType: 'adversary', name: 'Goblin', currentHp: 5 },
      { instanceId: 'char-1', elementType: 'character', name: 'Hero' },
    ],
    fearCount: 0,
    featureCountdowns: {},
    tableBattleMods: {},
    playerEmails: [],
    ...overrides,
  });

  it('returns null state as-is', () => {
    expect(applyPlayerTableOp({ op: 'set-fear', fearCount: 1 }, null)).toBeNull();
  });

  it('update-element updates matching element', () => {
    const state = mkState();
    const result = applyPlayerTableOp({ op: 'update-element', instanceId: 'inst-1', updates: { currentHp: 2 } }, state);
    expect(result.elements[0].currentHp).toBe(2);
    expect(result.elements[1].name).toBe('Hero');
  });

  it('add-elements appends elements', () => {
    const state = mkState();
    const result = applyPlayerTableOp({ op: 'add-elements', elements: [{ instanceId: 'new-1', name: 'New' }] }, state);
    expect(result.elements).toHaveLength(3);
  });

  it('remove-element removes matching element', () => {
    const state = mkState();
    const result = applyPlayerTableOp({ op: 'remove-element', instanceId: 'inst-1' }, state);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].instanceId).toBe('char-1');
  });

  it('clear-table keeps only characters', () => {
    const state = mkState({ featureCountdowns: { 'x|y|0': 1 } });
    const result = applyPlayerTableOp({ op: 'clear-table' }, state);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].elementType).toBe('character');
    expect(result.featureCountdowns).toEqual({});
  });

  it('set-fear updates fearCount', () => {
    const state = mkState();
    const result = applyPlayerTableOp({ op: 'set-fear', fearCount: 7 }, state);
    expect(result.fearCount).toBe(7);
  });

  it('set-countdown merges countdown', () => {
    const state = mkState({ featureCountdowns: { 'a|b|0': 1 } });
    const result = applyPlayerTableOp({ op: 'set-countdown', key: 'c|d|0', value: 2 }, state);
    expect(result.featureCountdowns).toEqual({ 'a|b|0': 1, 'c|d|0': 2 });
  });

  it('set-battle-mods replaces mods', () => {
    const state = mkState();
    const mods = { moreDangerous: true };
    const result = applyPlayerTableOp({ op: 'set-battle-mods', tableBattleMods: mods }, state);
    expect(result.tableBattleMods).toEqual(mods);
  });

  it('set-player-emails updates playerEmails', () => {
    const state = mkState();
    const result = applyPlayerTableOp({ op: 'set-player-emails', playerEmails: ['x@y.com'] }, state);
    expect(result.playerEmails).toEqual(['x@y.com']);
  });

  it('unknown op returns state unchanged', () => {
    const state = mkState();
    const result = applyPlayerTableOp({ op: 'nonexistent' }, state);
    expect(result).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// RUNTIME_KEYS sanity check
// ---------------------------------------------------------------------------

describe('RUNTIME_KEYS', () => {
  it('contains expected core keys', () => {
    expect(RUNTIME_KEYS).toContain('instanceId');
    expect(RUNTIME_KEYS).toContain('elementType');
    expect(RUNTIME_KEYS).toContain('currentHp');
    expect(RUNTIME_KEYS).toContain('name');
    expect(RUNTIME_KEYS).toContain('tier');
  });
});
