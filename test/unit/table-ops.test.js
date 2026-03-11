/**
 * Unit tests for src/client/lib/table-ops.js and src/client/lib/character-calc.js
 *
 * Pure-logic tests for the table operation state transformations and
 * character calculation utilities.
 * No browser, no DOM, no Firebase needed.
 */
import { describe, it, expect } from 'vitest';
import { applyTableOp, applyPlayerTableOp, RUNTIME_KEYS, CHARACTER_RUNTIME_KEYS } from '../../src/client/lib/table-ops.js';
import { computeArmorModifiers } from '../../src/client/lib/character-calc.js';

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

  it('character-library-update replaces base data while preserving runtime keys', () => {
    const char = {
      id: 'char-1', instanceId: 'inst-c', elementType: 'character',
      name: 'Stale Name', tier: 1, maxHp: 6, weapons: [{ name: 'Hand Runes' }],
      currentHp: 4, currentStress: 1, hope: 3, currentArmor: 1,
      conditions: 'dazed', tokenX: 10, tokenY: 20,
      assignedPlayerEmail: 'p@example.com', assignedPlayerUid: 'uid-p', playerName: 'Player',
    };
    const state = { activeElements: [mkElement(), char] };
    const newBaseData = {
      id: 'char-1', name: 'Fresh Name', tier: 2, maxHp: 8,
      weapons: [{ name: 'Dualstaff' }], class: 'Ranger', _source: 'own',
    };
    const result = applyTableOp({ op: 'character-library-update', characterId: 'char-1', newBaseData }, state);
    const updated = result.activeElements[1];

    // Base data replaced from newBaseData
    expect(updated.name).toBe('Fresh Name');
    expect(updated.tier).toBe(2);
    expect(updated.maxHp).toBe(8);
    expect(updated.weapons[0].name).toBe('Dualstaff');
    expect(updated.class).toBe('Ranger');

    // Runtime keys preserved
    expect(updated.instanceId).toBe('inst-c');
    expect(updated.elementType).toBe('character');
    expect(updated.currentHp).toBe(4);
    expect(updated.currentStress).toBe(1);
    expect(updated.hope).toBe(3);
    expect(updated.currentArmor).toBe(1);
    expect(updated.conditions).toBe('dazed');
    expect(updated.tokenX).toBe(10);
    expect(updated.tokenY).toBe(20);
    expect(updated.assignedPlayerEmail).toBe('p@example.com');
    expect(updated.assignedPlayerUid).toBe('uid-p');
    expect(updated.playerName).toBe('Player');
  });

  it('character-library-update does not affect non-matching elements', () => {
    const state = { activeElements: [mkElement({ id: 'adv-1', instanceId: 'inst-1' })] };
    const result = applyTableOp({ op: 'character-library-update', characterId: 'char-1', newBaseData: { id: 'char-1' } }, state);
    expect(result.activeElements[0]).toBe(state.activeElements[0]);
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

  it('character-library-update replaces base data while preserving runtime keys', () => {
    const state = mkState({
      elements: [
        { instanceId: 'inst-1', elementType: 'adversary', name: 'Goblin', currentHp: 5 },
        {
          id: 'char-1', instanceId: 'char-1', elementType: 'character',
          name: 'Stale Name', tier: 1, maxHp: 6, weapons: [{ name: 'Hand Runes' }],
          currentHp: 4, currentStress: 1, hope: 3, currentArmor: 1,
          conditions: 'dazed', tokenX: 5, tokenY: 10,
          assignedPlayerEmail: 'p@example.com', assignedPlayerUid: 'uid-p', playerName: 'Player',
        },
      ],
    });
    const newBaseData = {
      id: 'char-1', name: 'Fresh Name', tier: 2, maxHp: 8,
      weapons: [{ name: 'Dualstaff' }], class: 'Ranger',
    };
    const result = applyPlayerTableOp({ op: 'character-library-update', characterId: 'char-1', newBaseData }, state);
    const updated = result.elements[1];

    expect(updated.name).toBe('Fresh Name');
    expect(updated.tier).toBe(2);
    expect(updated.maxHp).toBe(8);
    expect(updated.weapons[0].name).toBe('Dualstaff');
    expect(updated.class).toBe('Ranger');

    expect(updated.instanceId).toBe('char-1');
    expect(updated.elementType).toBe('character');
    expect(updated.currentHp).toBe(4);
    expect(updated.currentStress).toBe(1);
    expect(updated.hope).toBe(3);
    expect(updated.currentArmor).toBe(1);
    expect(updated.conditions).toBe('dazed');
    expect(updated.tokenX).toBe(5);
    expect(updated.tokenY).toBe(10);
    expect(updated.assignedPlayerEmail).toBe('p@example.com');
    expect(updated.assignedPlayerUid).toBe('uid-p');
    expect(updated.playerName).toBe('Player');
  });

  it('character-library-update does not affect non-matching or non-character elements', () => {
    const state = mkState();
    const result = applyPlayerTableOp({ op: 'character-library-update', characterId: 'nobody', newBaseData: {} }, state);
    expect(result.elements[0]).toBe(state.elements[0]);
    expect(result.elements[1]).toBe(state.elements[1]);
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

// ---------------------------------------------------------------------------
// CHARACTER_RUNTIME_KEYS — keys preserved per-element when resolving characters
// ---------------------------------------------------------------------------

describe('CHARACTER_RUNTIME_KEYS', () => {
  it('contains the expected table-local keys', () => {
    expect(CHARACTER_RUNTIME_KEYS).toContain('instanceId');
    expect(CHARACTER_RUNTIME_KEYS).toContain('elementType');
    expect(CHARACTER_RUNTIME_KEYS).toContain('currentHp');
    expect(CHARACTER_RUNTIME_KEYS).toContain('currentStress');
    expect(CHARACTER_RUNTIME_KEYS).toContain('hope');
    expect(CHARACTER_RUNTIME_KEYS).toContain('currentArmor');
    expect(CHARACTER_RUNTIME_KEYS).toContain('conditions');
    expect(CHARACTER_RUNTIME_KEYS).toContain('tokenX');
    expect(CHARACTER_RUNTIME_KEYS).toContain('tokenY');
    expect(CHARACTER_RUNTIME_KEYS).toContain('assignedPlayerEmail');
    expect(CHARACTER_RUNTIME_KEYS).toContain('assignedPlayerUid');
    expect(CHARACTER_RUNTIME_KEYS).toContain('playerName');
  });

  it('does NOT contain base-data keys that should come from the library', () => {
    // These fields should come from the library record, not the stored element.
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('name');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('tier');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxHp');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxStress');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxHope');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxArmor');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('evasion');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('traits');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('class');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('weapons');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('classFeatures');
  });
});

// ---------------------------------------------------------------------------
// Character resolution logic — simulates the resolvedActiveElements useMemo
// ---------------------------------------------------------------------------

describe('character resolution logic', () => {
  // Pure function that mirrors the app.jsx useMemo logic.
  const resolveElements = (activeElements, libraryCharacters) => {
    const libraryById = new Map(libraryCharacters.map(c => [c.id, c]));
    return activeElements.map(el => {
      if (el.elementType !== 'character' || !el.id) return el;
      const libraryChar = libraryById.get(el.id);
      if (!libraryChar) return el;
      const runtime = {};
      CHARACTER_RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
      return { ...libraryChar, ...runtime };
    });
  };

  it('merges library base data onto a character element', () => {
    const stored = {
      id: 'char-1', instanceId: 'inst-1', elementType: 'character',
      name: 'Old Name', tier: 1, maxHp: 6,
      currentHp: 4, currentStress: 1, hope: 3,
      conditions: 'dazed', tokenX: 10, tokenY: 20,
    };
    const library = [{ id: 'char-1', name: 'Updated Name', tier: 2, maxHp: 8, class: 'Bard' }];
    const [resolved] = resolveElements([stored], library);

    // Base data comes from library
    expect(resolved.name).toBe('Updated Name');
    expect(resolved.tier).toBe(2);
    expect(resolved.maxHp).toBe(8);
    expect(resolved.class).toBe('Bard');

    // Runtime state preserved from stored element
    expect(resolved.currentHp).toBe(4);
    expect(resolved.currentStress).toBe(1);
    expect(resolved.hope).toBe(3);
    expect(resolved.conditions).toBe('dazed');
    expect(resolved.tokenX).toBe(10);
    expect(resolved.tokenY).toBe(20);
    expect(resolved.instanceId).toBe('inst-1');
    expect(resolved.elementType).toBe('character');
  });

  it('falls back to stored data when library character is not found', () => {
    const stored = {
      id: 'char-99', instanceId: 'inst-1', elementType: 'character',
      name: 'Orphan', maxHp: 6, currentHp: 5,
    };
    const library = [{ id: 'char-1', name: 'Someone Else' }];
    const [resolved] = resolveElements([stored], library);

    expect(resolved).toBe(stored); // exact same reference
  });

  it('passes through non-character elements unchanged', () => {
    const adversary = { id: 'adv-1', instanceId: 'inst-a', elementType: 'adversary', name: 'Goblin' };
    const library = [];
    const [resolved] = resolveElements([adversary], library);
    expect(resolved).toBe(adversary);
  });

  it('falls through for characters without an id (manually created)', () => {
    const stored = {
      instanceId: 'inst-manual', elementType: 'character', name: 'Manual Hero', currentHp: 5,
    };
    const library = [{ id: 'char-1', name: 'Library Hero' }];
    const [resolved] = resolveElements([stored], library);
    expect(resolved).toBe(stored);
  });

  it('resolves multiple instances of the same library character independently', () => {
    const el1 = { id: 'char-1', instanceId: 'inst-1', elementType: 'character', currentHp: 3, conditions: 'hurt' };
    const el2 = { id: 'char-1', instanceId: 'inst-2', elementType: 'character', currentHp: 6, conditions: '' };
    const library = [{ id: 'char-1', name: 'Hero', maxHp: 8 }];
    const resolved = resolveElements([el1, el2], library);

    expect(resolved[0].instanceId).toBe('inst-1');
    expect(resolved[0].currentHp).toBe(3);
    expect(resolved[0].conditions).toBe('hurt');
    expect(resolved[1].instanceId).toBe('inst-2');
    expect(resolved[1].currentHp).toBe(6);
    // Both pick up library base data
    expect(resolved[0].name).toBe('Hero');
    expect(resolved[1].name).toBe('Hero');
    expect(resolved[0].maxHp).toBe(8);
    expect(resolved[1].maxHp).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// computeArmorModifiers — armor feature stat/roll modifier extraction
// ---------------------------------------------------------------------------

describe('computeArmorModifiers', () => {
  it('returns empty result for null armor', () => {
    const result = computeArmorModifiers(null);
    expect(result.traits).toEqual({});
    expect(result.evasion).toBe(0);
    expect(result.rollModifiers).toEqual([]);
    expect(result.feature).toBeNull();
    expect(result.sources).toEqual([]);
  });

  it('returns empty result for armor without features', () => {
    const result = computeArmorModifiers({ name: 'Leather Armor', features: [] });
    expect(result.traits).toEqual({});
    expect(result.evasion).toBe(0);
    expect(result.feature).toBeNull();
  });

  it('parses Flexible: +1 to Evasion', () => {
    const armor = { name: 'Gambeson Armor', features: [{ name: 'Flexible', description: '+1 to Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(1);
    expect(result.feature).toEqual({ name: 'Flexible', description: '+1 to Evasion' });
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ armor: 'Gambeson Armor', feature: 'Flexible', stat: 'evasion', value: 1 });
  });

  it('parses Heavy: -1 to Evasion', () => {
    const armor = { name: 'Chainmail Armor', features: [{ name: 'Heavy', description: '-1 to Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(-1);
    expect(result.sources[0].value).toBe(-1);
  });

  it('parses Very Heavy: -2 to Evasion; -1 to Agility', () => {
    const armor = { name: 'Full Plate Armor', features: [{ name: 'Very Heavy', description: '-2 to Evasion; -1 to Agility' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(-2);
    expect(result.traits.agility).toBe(-1);
    expect(result.sources).toHaveLength(2);
  });

  it('parses Gilded: +1 to Presence', () => {
    const armor = { name: 'Bellamoi Fine Armor', features: [{ name: 'Gilded', description: '+1 to Presence' }] };
    const result = computeArmorModifiers(armor);
    expect(result.traits.presence).toBe(1);
    expect(result.evasion).toBe(0);
    expect(result.sources).toHaveLength(1);
  });

  it('parses Difficult: -1 to all character traits and Evasion', () => {
    const armor = { name: 'Savior Chainmail', features: [{ name: 'Difficult', description: '-1 to all character traits and Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.traits.agility).toBe(-1);
    expect(result.traits.strength).toBe(-1);
    expect(result.traits.finesse).toBe(-1);
    expect(result.traits.instinct).toBe(-1);
    expect(result.traits.presence).toBe(-1);
    expect(result.traits.knowledge).toBe(-1);
    expect(result.evasion).toBe(-1);
    expect(result.sources).toHaveLength(7);
  });

  it('parses Channeling: +1 to Spellcast Rolls as a roll modifier', () => {
    const armor = { name: 'Channeling Armor', features: [{ name: 'Channeling', description: '+1 to Spellcast Rolls' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(0);
    expect(result.traits).toEqual({});
    expect(result.rollModifiers).toHaveLength(1);
    expect(result.rollModifiers[0]).toMatchObject({ name: 'Channeling', score: 1, rollType: 'spellcast' });
  });

  it('parses Quiet: +2 bonus to rolls to move silently as a roll modifier', () => {
    const armor = { name: 'Tyris Soft Armor', features: [{ name: 'Quiet', description: 'You gain a +2 bonus to rolls you make to move silently.' }] };
    const result = computeArmorModifiers(armor);
    expect(result.rollModifiers).toHaveLength(1);
    expect(result.rollModifiers[0]).toMatchObject({ name: 'Quiet', score: 2, rollType: 'stealth' });
  });

  it('stores feature info for display-only features like Truthseeking', () => {
    const armor = { name: 'Veritas Opal Armor', features: [{ name: 'Truthseeking', description: 'This armor glows when another creature within Close range tells a lie.' }] };
    const result = computeArmorModifiers(armor);
    expect(result.feature).toEqual({ name: 'Truthseeking', description: 'This armor glows when another creature within Close range tells a lie.' });
    expect(result.evasion).toBe(0);
    expect(result.traits).toEqual({});
    expect(result.rollModifiers).toEqual([]);
  });

  it('handles armor with feature using text field instead of description', () => {
    const armor = { name: 'Gambeson', features: [{ name: 'Flexible', text: '+1 to Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(1);
    expect(result.feature.description).toBe('+1 to Evasion');
  });
});
