import { describe, it, expect } from 'vitest';
import { Deflecting } from '../../../../src/features-v2/weapon_properties/Deflecting.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockCharacter, mockAdversary } from '../helpers.js';

function makeFeature() {
  return { ...Deflecting, _ownerInstanceId: 'c1' };
}

function makeTargetedState(charOverrides = {}) {
  const char = mockCharacter({ instanceId: 'c1', currentArmor: 3, maxArmor: 3, ...charOverrides });
  const adv = mockAdversary({ instanceId: 'adv-1' });
  return mockGameState({
    activeElements: [char, adv],
    _ownerInstanceId: 'c1',
    action: {
      type: 'attack',
      actorInstanceId: 'adv-1',
      targetInstanceIds: ['c1'],
      trait: 'Strength',
      range: 'melee',
      effects: [{ type: 'damage', target: { instanceId: 'c1' }, amount: 10, damageType: 'physical' }],
      appliedEffects: [],
    },
  });
}

describe('Deflecting', () => {
  it('has the correct name and description', () => {
    expect(Deflecting.name).toBe('Deflecting');
    expect(Deflecting.description).toContain('Armor Score');
  });

  it('has a single reviewAction chip', () => {
    expect(Deflecting.chips).toHaveLength(1);
  });

  it('chip appears during reviewAction when the owner is targeted', () => {
    const state = makeTargetedState();
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].armorCost).toBe(1);
    expect(chips[0].isToggle).toBe(true);
  });

  it('chip does NOT appear when the owner is NOT targeted', () => {
    const char = mockCharacter({ instanceId: 'c1', currentArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    expect(chips).toHaveLength(0);
  });

  it('toggle-on queues addTemporaryStatMod with evasion = available armor slots', () => {
    const state = makeTargetedState({ currentArmor: 5 });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const chipState = makeChipState();

    const mutations = activateChip(chips[0], table, chipState);
    const addMut = mutations.find((m) => m.type === 'addTemporaryStatMod');
    expect(addMut).toBeDefined();
    expect(addMut.payload).toMatchObject({ stat: 'evasion', value: 5 });
  });

  it('toggle-off queues removeTemporaryStatMod with the same cached value', () => {
    const state = makeTargetedState({ currentArmor: 4 });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const chipState = makeChipState();

    activateChip(chips[0], table, chipState);
    const offMuts = activateChip(chips[0], table, chipState);
    const removeMut = offMuts.find((m) => m.type === 'removeTemporaryStatMod');
    expect(removeMut).toBeDefined();
    expect(removeMut.payload).toMatchObject({ stat: 'evasion', value: 4 });
  });

  it('uses 0 when no armor slots are available', () => {
    const state = makeTargetedState({ currentArmor: 0 });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const chipState = makeChipState();

    const mutations = activateChip(chips[0], table, chipState);
    const addMut = mutations.find((m) => m.type === 'addTemporaryStatMod');
    expect(addMut.payload).toMatchObject({ stat: 'evasion', value: 0 });
  });
});
