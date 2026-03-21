import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { when, isActing } from '../../../../src/features-v2/engine/when.js';
import { mockTable, mockGameState, mockCharacter } from '../helpers.js';

// ---------------------------------------------------------------------------
// collectChips
// ---------------------------------------------------------------------------

describe('collectChips()', () => {
  it('collects a chip matching the given phase', () => {
    const feature = {
      name: 'Test Feature',
      _ownerInstanceId: 'char-1',
      chips: [
        {
          description: 'A card chip',
          placements: ['card'],
          onUse: () => {},
        },
      ],
    };
    const table = mockTable({ _ownerInstanceId: 'char-1' });
    const chips = collectChips([feature], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].description).toBe('A card chip');
  });

  it('does not collect chips that do not match the phase', () => {
    const feature = {
      name: 'Test Feature',
      _ownerInstanceId: 'char-1',
      chips: [{ description: 'Intent chip', placements: ['intent'] }],
    };
    const table = mockTable();
    const chips = collectChips([feature], 'reviewOutcome', table);
    expect(chips).toHaveLength(0);
  });

  it('resolves when() wrappers — includes chip when predicate passes', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);

    const feature = {
      name: 'Feline Instincts',
      _ownerInstanceId: 'char-1',
      chips: [
        when(isActing, {
          description: 'Spend 2 Hope to reroll.',
          placements: ['reviewOutcome'],
          hopeCost: 2,
        }),
      ],
    };

    const chips = collectChips([feature], 'reviewOutcome', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(2);
  });

  it('resolves when() wrappers — excludes chip when predicate fails', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    // Actor is adv-1, not char-1
    const state = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);

    const feature = {
      name: 'Feline Instincts',
      _ownerInstanceId: 'char-1',
      chips: [
        when(isActing, {
          description: 'Spend 2 Hope to reroll.',
          placements: ['reviewOutcome'],
          hopeCost: 2,
        }),
      ],
    };

    const chips = collectChips([feature], 'reviewOutcome', table);
    expect(chips).toHaveLength(0);
  });

  it('synthesizes a default card chip for features with root-level hopeCost', () => {
    const feature = {
      name: 'Dance the Tango',
      description: 'A beautiful dance.',
      _ownerInstanceId: 'char-1',
      hopeCost: 1,
      frequency: 'session',
      onUse: () => {},
    };
    const table = mockTable();
    const chips = collectChips([feature], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(1);
    expect(chips[0].frequency).toBe('session');
  });

  it('excludes chips that are exhausted in usageStore', () => {
    const feature = {
      name: 'Burst',
      _ownerInstanceId: 'char-1',
      chips: [{ description: 'Burst!', placements: ['card'], frequency: 'session' }],
    };
    const table = mockTable();
    const chipKey = 'Burst::Burst::card';
    const usageStore = { [chipKey]: { used: true, cycle: 'session' } };
    const chips = collectChips([feature], 'card', table, usageStore);
    expect(chips).toHaveLength(0);
  });

  it('annotates each chip with _featureName and _ownerInstanceId', () => {
    const feature = {
      name: 'Cool Feature',
      _ownerInstanceId: 'char-99',
      chips: [{ description: 'Do it', placements: ['card'] }],
    };
    const table = mockTable();
    const chips = collectChips([feature], 'card', table);
    expect(chips[0]._featureName).toBe('Cool Feature');
    expect(chips[0]._ownerInstanceId).toBe('char-99');
  });
});

// ---------------------------------------------------------------------------
// activateChip
// ---------------------------------------------------------------------------

describe('activateChip()', () => {
  it('calls chip.onUse with table and chipState', () => {
    const calls = [];
    const chip = {
      description: 'Test',
      placements: ['card'],
      onUse: (table, cs) => calls.push({ table, cs }),
    };
    const table = mockTable();
    const chipState = makeChipState();
    activateChip(chip, table, chipState);
    expect(calls).toHaveLength(1);
  });

  it('toggles isOn for toggle chips', () => {
    const chip = {
      isToggle: true,
      onUse: () => {},
    };
    const table = mockTable();
    const chipState = makeChipState();
    expect(chipState.isOn).toBe(false);
    activateChip(chip, table, chipState);
    expect(chipState.isOn).toBe(true);
    activateChip(chip, table, chipState);
    expect(chipState.isOn).toBe(false);
  });

  it('returns mutations queued during onUse', () => {
    const chip = {
      onUse: (table) => table.me.markStress(1),
    };
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const mutations = activateChip(chip, table, makeChipState());
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress' })
    );
  });

  it('handles chips without onUse gracefully', () => {
    const chip = { description: 'No-op chip' };
    const table = mockTable();
    expect(() => activateChip(chip, table, makeChipState())).not.toThrow();
  });

  it('stores selectedTargetIds in chip state for selectTargets chips', () => {
    const calls = [];
    const chip = {
      selectTargets: (table) => table.adversaries,
      onUse: (table, cs) => calls.push(cs.get('selectedTargetIds')),
    };
    const table = mockTable();
    const chipState = makeChipState();
    activateChip(chip, table, chipState, { selectedTargetIds: ['adv-1', 'adv-2'] });
    expect(chipState.get('selectedTargetIds')).toEqual(['adv-1', 'adv-2']);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(['adv-1', 'adv-2']);
  });

  it('does not store selectedTargetIds when selectTargets is absent', () => {
    const chip = { onUse: () => {} };
    const table = mockTable();
    const chipState = makeChipState();
    activateChip(chip, table, chipState, { selectedTargetIds: ['adv-1'] });
    expect(chipState.get('selectedTargetIds')).toBeUndefined();
  });

  it('resolves function-valued temporaryStatMods on toggle-on and caches for toggle-off', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 4 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    const chipState = makeChipState();

    const chip = {
      isToggle: true,
      temporaryStatMods: { evasion: (t) => t.me?.armor ?? 0 },
    };

    // Toggle ON — should resolve function and add evasion: 4
    const onMuts = activateChip(chip, table, chipState);
    const addMut = onMuts.find((m) => m.type === 'addTemporaryStatMod');
    expect(addMut).toBeDefined();
    expect(addMut.payload).toMatchObject({ stat: 'evasion', value: 4 });

    // Toggle OFF — should use cached value (4) for remove
    const offMuts = activateChip(chip, table, chipState);
    const removeMut = offMuts.find((m) => m.type === 'removeTemporaryStatMod');
    expect(removeMut).toBeDefined();
    expect(removeMut.payload).toMatchObject({ stat: 'evasion', value: 4 });
  });

  it('handles static temporaryStatMods as before', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    const chipState = makeChipState();

    const chip = {
      isToggle: true,
      temporaryStatMods: { evasion: 2 },
    };

    const onMuts = activateChip(chip, table, chipState);
    const addMut = onMuts.find((m) => m.type === 'addTemporaryStatMod');
    expect(addMut.payload).toMatchObject({ stat: 'evasion', value: 2 });
  });
});

// ---------------------------------------------------------------------------
// deductChipCosts
// ---------------------------------------------------------------------------

describe('deductChipCosts()', () => {
  it('queues spendHope mutation for hopeCost', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { hopeCost: 2 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendHope', payload: { instanceId: 'char-1', amount: 2 } })
    );
  });

  it('queues markStress mutation for stressCost', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { stressCost: 1 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('queues markArmor for armorMark', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { armorMark: 1 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markArmor' })
    );
  });

  it('does nothing when table.me is null', () => {
    const table = buildTableSnapshot({});
    expect(() => deductChipCosts({ hopeCost: 1 }, table)).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Function-valued costs
  // ---------------------------------------------------------------------------

  it('evaluates function hopeCost with table and deducts the result', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { hopeCost: () => 3 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendHope', payload: { instanceId: 'char-1', amount: 3 } })
    );
  });

  it('evaluates function stressCost with table and deducts the result', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { stressCost: () => 2 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'char-1', amount: 2 } })
    );
  });

  it('evaluates function stressCost reading feature state set by onUse', () => {
    // Simulates the Bouncing use-case: onUse stores a target count in feature
    // state; stressCost reads it so the GM is charged the right amount.
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(state);

    // Simulate onUse having stored bounceTargets = 3
    table.feature.set('bounceTargets', 3);

    const chip = { stressCost: (t) => t.feature.get('bounceTargets') ?? 1 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'char-1', amount: 3 } })
    );
  });

  it('evaluates function armorMark with table', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { armorMark: () => 1 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markArmor', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('skips cost when function returns 0', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { stressCost: () => 0 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations.some((m) => m.type === 'markStress')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// trackChipFrequency / resetChipFrequency
// ---------------------------------------------------------------------------

describe('trackChipFrequency()', () => {
  it('returns true (available) on first use and marks as used', () => {
    const store = {};
    const available = trackChipFrequency('key1', 'session', store);
    expect(available).toBe(true);
    expect(store['key1'].used).toBe(true);
  });

  it('returns false on second use (already used)', () => {
    const store = {};
    trackChipFrequency('key1', 'session', store);
    const available = trackChipFrequency('key1', 'session', store);
    expect(available).toBe(false);
  });
});

describe('resetChipFrequency()', () => {
  it('resets session chips on session cycle', () => {
    const store = { key1: { used: true, cycle: 'session' } };
    resetChipFrequency('session', store);
    expect(store.key1).toBeUndefined();
  });

  it('resets shortRest chips on shortRest cycle', () => {
    const store = { key1: { used: true, cycle: 'shortRest' } };
    resetChipFrequency('shortRest', store);
    expect(store.key1).toBeUndefined();
  });

  it('resets rest chips on shortRest (rest = both short and long)', () => {
    const store = { key1: { used: true, cycle: 'rest' } };
    resetChipFrequency('shortRest', store);
    expect(store.key1).toBeUndefined();
  });

  it('resets shortRest chips on longRest (long rest includes short rest)', () => {
    const store = { key1: { used: true, cycle: 'shortRest' } };
    resetChipFrequency('longRest', store);
    expect(store.key1).toBeUndefined();
  });

  it('does not reset session chips on shortRest', () => {
    const store = { key1: { used: true, cycle: 'session' } };
    resetChipFrequency('shortRest', store);
    expect(store.key1).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// makeChipState
// ---------------------------------------------------------------------------

describe('makeChipState()', () => {
  it('starts with isOn = false', () => {
    const cs = makeChipState();
    expect(cs.isOn).toBe(false);
  });

  it('get/set work independently', () => {
    const cs = makeChipState();
    cs.set('foo', 42);
    expect(cs.get('foo')).toBe(42);
  });

  it('two instances do not share state', () => {
    const cs1 = makeChipState();
    const cs2 = makeChipState();
    cs1.set('x', 1);
    expect(cs2.get('x')).toBeUndefined();
  });
});
