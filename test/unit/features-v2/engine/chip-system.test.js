import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  commitToggleChipToState,
  computeToggleNextIsOn,
  readPersistedToggleIsOn,
  inferToggleScope,
  getV2ToggleStateKey,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  getFrequencyUsedCount,
  buildNextFeatureUsageEntry,
  makeChipState,
  resolveChipDisabled,
  evaluateIsDisabled,
  getChipDisableHint,
  canPayChipCosts,
  buildChipsForFeature,
  hasDeclarativeSheetRepresentation,
  mapV2ChipFrequencyToFeatureUsageCycle,
  getFeatureUsageCycleForV2Chip,
} from '../../../../src/features-v2/engine/chip-system.js';
import { Privilege } from '../../../../src/features-v2/communities/Highborne.js';
import { RetractingClaws } from '../../../../src/features-v2/ancestries/Katari.js';
import { BareBones } from '../../../../src/features-v2/abilities/Valor/BareBones.js';
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

  it('respects frequencyMaxUses > 1 before excluding a session chip', () => {
    const feature = {
      name: 'Triple',
      _ownerInstanceId: 'char-1',
      chips: [
        {
          description: 'Three times',
          placements: ['card'],
          frequency: 'session',
          frequencyMaxUses: 3,
        },
      ],
    };
    const table = mockTable();
    const chipKey = 'Triple::Triple::card';
    const usageStore = { [chipKey]: { cycle: 'session', count: 2, used: false } };
    const chips = collectChips([feature], 'card', table, usageStore);
    expect(chips).toHaveLength(1);
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
    expect(chips[0]._featureSource).toBeUndefined();
    expect(chips[0]._ownerInstanceId).toBe('char-99');
  });

  it('sets disabled from isDisabled(table)', () => {
    const feature = {
      name: 'Gated',
      _ownerInstanceId: 'char-1',
      chips: [
        {
          placements: ['card'],
          isDisabled: (table) => table.feature.get('off') === true,
          onUse: () => {},
        },
      ],
    };
    const table = mockTable({ _featureKey: 'Gated', featureState: { Gated: { off: true } } });
    const chips = collectChips([feature], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].disabled).toBe(true);
  });

  it('sets disabled from static isDisabled: true', () => {
    const feature = {
      name: 'Off',
      _ownerInstanceId: 'char-1',
      chips: [{ placements: ['card'], isDisabled: true, onUse: () => {} }],
    };
    const chips = collectChips([feature], 'card', mockTable());
    expect(chips[0].disabled).toBe(true);
  });

  it('sets disabled when Hope cost exceeds current Hope', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 0 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    const feature = {
      name: 'Costly',
      _ownerInstanceId: 'char-1',
      hopeCost: 1,
      onUse: () => {},
    };
    const chips = collectChips([feature], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].disabled).toBe(false);
    expect(chips[0].resourceUnaffordable).toBe(true);
  });

  it('sets disabled when Stress cost exceeds empty Stress boxes', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentStress: 5, maxStress: 6 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    const feature = {
      name: 'Stressy',
      _ownerInstanceId: 'char-1',
      stressCost: 2,
      onUse: () => {},
    };
    const chips = collectChips([feature], 'card', table);
    expect(chips[0].resourceUnaffordable).toBe(true);
  });

  it('sets disabled when armorMark exceeds free armor slots', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      currentArmor: 3,
      maxArmor: 3,
    });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    const feature = {
      name: 'ArmorSpend',
      _ownerInstanceId: 'char-1',
      armorMark: 1,
      onUse: () => {},
    };
    const chips = collectChips([feature], 'card', table);
    expect(chips[0].resourceUnaffordable).toBe(true);
  });

  it('sets disabled when armorClear exceeds marked armor slots', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      currentArmor: 0,
      maxArmor: 3,
    });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    const feature = {
      name: 'ClearArmor',
      _ownerInstanceId: 'char-1',
      armorClear: 1,
      onUse: () => {},
    };
    const chips = collectChips([feature], 'card', table);
    expect(chips[0].resourceUnaffordable).toBe(true);
  });

  it('sets disabled when gold cost exceeds carried gold', () => {
    const char = mockCharacter({ instanceId: 'char-1', gold: 0 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    const feature = {
      name: 'Greedy',
      _ownerInstanceId: 'char-1',
      goldCost: 1,
      onUse: () => {},
    };
    const chips = collectChips([feature], 'card', table);
    expect(chips[0].resourceUnaffordable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveChipDisabled
// ---------------------------------------------------------------------------

describe('canPayChipCosts()', () => {
  it('is true when table.me is missing', () => {
    const table = buildTableSnapshot({});
    expect(canPayChipCosts({ hopeCost: 99 }, table)).toBe(true);
  });

  it('treats missing character hope as full pool (matches sheet / spend-on-ack semantics)', () => {
    const char = mockCharacter({ instanceId: 'char-1', maxHope: 6 });
    delete char.hope;
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    expect(table.me.hope).toBe(6);
    expect(canPayChipCosts({ hopeCost: 3 }, table)).toBe(true);
    expect(canPayChipCosts({ hopeCost: 2 }, table)).toBe(true);
  });

  it('evaluates function-valued costs', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 2 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);
    expect(
      canPayChipCosts(
        {
          hopeCost: (t) => (t.feature.get('x') ?? 1),
        },
        table
      )
    ).toBe(true);
    table.feature.set('x', 3);
    expect(
      canPayChipCosts(
        {
          hopeCost: (t) => (t.feature.get('x') ?? 1),
        },
        table
      )
    ).toBe(false);
  });
});

describe('resolveChipDisabled()', () => {
  it('is false when isDisabled is omitted', () => {
    expect(resolveChipDisabled({}, mockTable())).toBe(false);
  });

  it('evaluates isDisabled as a function', () => {
    const chip = { isDisabled: () => true };
    expect(resolveChipDisabled(chip, mockTable())).toBe(true);
  });

  it('honors pre-resolved disabled boolean (e.g. from collectChips) before isDisabled', () => {
    expect(resolveChipDisabled({ disabled: true, isDisabled: () => false }, mockTable())).toBe(true);
    expect(resolveChipDisabled({ disabled: false, isDisabled: () => true }, mockTable())).toBe(false);
  });

  it('treats isDisabled string as disabled with message', () => {
    expect(resolveChipDisabled({ isDisabled: 'Reason A' }, mockTable())).toBe(true);
    expect(evaluateIsDisabled({ isDisabled: 'Reason A' }, mockTable())).toEqual({
      disabled: true,
      message: 'Reason A',
    });
  });

  it('treats isDisabled function returning string as disabled with message', () => {
    const chip = { isDisabled: () => 'No targets.' };
    expect(resolveChipDisabled(chip, mockTable())).toBe(true);
    expect(evaluateIsDisabled(chip, mockTable())).toEqual({ disabled: true, message: 'No targets.' });
    expect(getChipDisableHint(chip, mockTable())).toBe('No targets.');
  });

  it('treats isDisabled function returning empty string as not disabled', () => {
    const chip = { isDisabled: () => '' };
    expect(resolveChipDisabled(chip, mockTable())).toBe(false);
    expect(getChipDisableHint(chip, mockTable())).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// activateChip
// ---------------------------------------------------------------------------

describe('activateChip()', () => {
  it('returns no mutations when the chip is disabled', () => {
    const chip = {
      placements: ['card'],
      isDisabled: () => true,
      onUse: (table) => table.me.markStress(99),
    };
    const table = mockTable();
    const mutations = activateChip(chip, table, makeChipState());
    expect(mutations).toEqual([]);
  });

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

  it('stores selectedIds in chip state for multiSelect + isSelect chips', () => {
    const chip = {
      multiSelect: true,
      isSelect: () => [{ id: 'a' }, { id: 'b' }],
      onUse: (table, cs) => {},
    };
    const table = mockTable();
    const chipState = makeChipState();
    activateChip(chip, table, chipState, { selectedIds: ['a', 'b'] });
    expect(chipState.get('selectedIds')).toEqual(['a', 'b']);
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

  it('with armorInsteadOfHope queues markArmor instead of spendHope when substitution allowed and slots allow', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      substituteArmorForHope: true,
      currentArmor: 3,
    });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { hopeCost: 2 };
    deductChipCosts(chip, table, { armorInsteadOfHope: true });
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markArmor', payload: { instanceId: 'char-1', amount: 2 } })
    );
    expect(mutations.find((m) => m.type === 'spendHope')).toBeUndefined();
  });

  it('with armorInsteadOfHope falls back to spendHope when substituteArmorForHope is false', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 3 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { hopeCost: 1 };
    deductChipCosts(chip, table, { armorInsteadOfHope: true });
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendHope', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('with armorInsteadOfHope falls back to spendHope when not enough armor slots', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      substituteArmorForHope: true,
      currentArmor: 1,
    });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { hopeCost: 2 };
    deductChipCosts(chip, table, { armorInsteadOfHope: true });
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

  it('queues spendGold mutation for goldCost', () => {
    const char = mockCharacter({ instanceId: 'char-1', gold: 10 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { goldCost: 1 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendGold', payload: { instanceId: 'char-1', amount: 1 } })
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

  it('queues spendGold mutation for goldCost', () => {
    const char = mockCharacter({ instanceId: 'char-1', gold: 20 });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' });
    const table = buildTableSnapshot(state);

    const chip = { goldCost: 9 };
    deductChipCosts(chip, table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendGold', payload: { instanceId: 'char-1', amount: 9 } })
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

  it('allows multiple uses per cycle when maxUses > 1', () => {
    const store = {};
    expect(trackChipFrequency('k', 'session', store, 3)).toBe(true);
    expect(store.k.count).toBe(1);
    expect(store.k.used).toBe(false);
    expect(trackChipFrequency('k', 'session', store, 3)).toBe(true);
    expect(store.k.count).toBe(2);
    expect(trackChipFrequency('k', 'session', store, 3)).toBe(true);
    expect(store.k.count).toBe(3);
    expect(store.k.used).toBe(true);
    expect(trackChipFrequency('k', 'session', store, 3)).toBe(false);
  });
});

describe('buildNextFeatureUsageEntry()', () => {
  it('increments count and keeps used false until maxUses', () => {
    expect(getFrequencyUsedCount({ used: true })).toBe(1);
    const a = buildNextFeatureUsageEntry(undefined, 'session', 3);
    expect(a).toEqual({ cycle: 'session', count: 1, used: false });
    const b = buildNextFeatureUsageEntry(a, 'session', 3);
    expect(b).toEqual({ cycle: 'session', count: 2, used: false });
    const c = buildNextFeatureUsageEntry(b, 'session', 3);
    expect(c).toEqual({ cycle: 'session', count: 3, used: true });
  });

  it('treats legacy { used: true } as one prior use', () => {
    const next = buildNextFeatureUsageEntry({ used: true, cycle: 'session' }, 'session', 3);
    expect(next).toEqual({ cycle: 'session', count: 2, used: false });
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

// ---------------------------------------------------------------------------
// mapV2ChipFrequencyToFeatureUsageCycle / getFeatureUsageCycleForV2Chip
// ---------------------------------------------------------------------------

describe('mapV2ChipFrequencyToFeatureUsageCycle()', () => {
  it('maps session, shortRest, rest, longRest for table featureUsage clears', () => {
    expect(mapV2ChipFrequencyToFeatureUsageCycle('session')).toBe('session');
    expect(mapV2ChipFrequencyToFeatureUsageCycle('shortRest')).toBe('rest');
    expect(mapV2ChipFrequencyToFeatureUsageCycle('rest')).toBe('rest');
    expect(mapV2ChipFrequencyToFeatureUsageCycle('longRest')).toBe('longRest');
    expect(mapV2ChipFrequencyToFeatureUsageCycle(undefined)).toBeNull();
    expect(mapV2ChipFrequencyToFeatureUsageCycle('unknown')).toBeNull();
  });
});

describe('getFeatureUsageCycleForV2Chip()', () => {
  it('prefers frequency over resetsOn', () => {
    expect(getFeatureUsageCycleForV2Chip({ frequency: 'session', resetsOn: 'rest' })).toBe('session');
  });

  it('uses resetsOn when frequency is absent', () => {
    expect(getFeatureUsageCycleForV2Chip({ resetsOn: 'rest' })).toBe('rest');
  });
});

// ---------------------------------------------------------------------------
// buildChipsForFeature
// ---------------------------------------------------------------------------

describe('buildChipsForFeature()', () => {
  it('returns no synthetic card chips for declarative advantage-only features', () => {
    expect(buildChipsForFeature(Privilege)).toEqual([]);
  });

  it('still synthesizes a narrative card chip when there is no declarative sheet representation', () => {
    const row = { name: 'Narrative', description: 'Flavor only.' };
    const chips = buildChipsForFeature(row);
    expect(chips).toHaveLength(1);
    expect(chips[0].name).toBe('Narrative');
    expect(chips[0].placements).toEqual(['card']);
    expect(chips[0].narrativeBannerOnly).toBe(true);
  });

  it('returns no synthetic card chips for virtualWeapons-only features', () => {
    expect(buildChipsForFeature(RetractingClaws)).toEqual([]);
    expect(hasDeclarativeSheetRepresentation(RetractingClaws)).toBe(true);
  });

  it('returns no synthetic card chips when static passiveStatMods are present', () => {
    const row = {
      name: 'StatStick',
      description: '+1 Evasion',
      passiveStatMods: { evasion: 1 },
    };
    expect(buildChipsForFeature(row)).toEqual([]);
    expect(hasDeclarativeSheetRepresentation(row)).toBe(true);
  });

  it('returns no synthetic card chips for dynamic (function) passiveStatMods — Bare Bones', () => {
    expect(hasDeclarativeSheetRepresentation(BareBones)).toBe(true);
    expect(buildChipsForFeature(BareBones)).toEqual([]);
  });
});

describe('computeToggleNextIsOn / commitToggleChipToState', () => {
  it('computeToggleNextIsOn matches one logical flip from framework toggle key (feature bag)', () => {
    const chip = {
      isToggle: true,
      name: 'TestChip',
      placements: ['card'],
      _featureName: 'TestFeature',
      onUse: () => {},
    };
    const key = getV2ToggleStateKey({ name: 'TestFeature' }, chip);
    const tableOff = mockTable({
      featureState: { TestFeature: { [key]: false } },
      _featureKey: 'TestFeature',
    });
    expect(computeToggleNextIsOn(chip, tableOff)).toBe(true);
    const tableOn = mockTable({
      featureState: { TestFeature: { [key]: true } },
      _featureKey: 'TestFeature',
    });
    expect(computeToggleNextIsOn(chip, tableOn)).toBe(false);
  });

  it('inferToggleScope maps raw feature + sibling activeFeature to source bag (subclass)', () => {
    const wsRow = {
      sourceScopeKey: 'WingedSentinel',
      features: [{ name: 'Wings of Light' }, { name: 'Ethereal Visage' }],
    };
    const flightChip = { name: 'Flight', placements: ['card'] };
    const rawWings = { name: 'Wings of Light' };
    const ethereal = { name: 'Ethereal Visage', _source: 'subclass', _sourceObject: wsRow };
    expect(inferToggleScope(flightChip, rawWings, { activeFeature: ethereal })).toBe('source');
  });

  it('readPersistedToggleIsOn reads subclass scope (source bag) when _featureSource is subclass', () => {
    const chip = {
      name: 'Flight',
      placements: ['card'],
      _featureName: 'Wings of Light',
      _featureSource: 'subclass',
    };
    const key = getV2ToggleStateKey({ name: 'Wings of Light', _source: 'subclass' }, chip);
    const table = mockTable({
      featureState: { WingedSentinel: { [key]: true } },
      _featureKey: 'Wings of Light',
      _activeFeature: {
        name: 'Wings of Light',
        _source: 'subclass',
        _sourceScopeKey: 'WingedSentinel',
      },
      _sourceObject: {},
    });
    expect(readPersistedToggleIsOn(chip, table)).toBe(true);
  });

  it('commitToggleChipToState invokes onUse with the committed isOn', () => {
    const writes = [];
    const chip = {
      isToggle: true,
      onUse: (table, cs) => {
        writes.push(cs.isOn);
      },
    };
    const table = mockTable();
    commitToggleChipToState(chip, table, true, {});
    expect(writes).toEqual([true]);
    writes.length = 0;
    commitToggleChipToState(chip, table, false, {});
    expect(writes).toEqual([false]);
  });
});
