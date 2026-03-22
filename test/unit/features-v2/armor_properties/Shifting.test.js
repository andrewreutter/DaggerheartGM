import { describe, it, expect } from 'vitest';
import { Shifting } from '../../../../src/features-v2/armor_properties/Shifting.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll } from '../helpers.js';

function makeFeature() {
  return { ...Shifting, _ownerInstanceId: 'char-1' };
}

function targetedTable() {
  const char = mockCharacter({ instanceId: 'char-1', currentArmor: 2, maxArmor: 3 });
  const adv = mockAdversary({ instanceId: 'adv-1' });
  const state = mockGameState({
    character: char,
    adversary: adv,
    _ownerInstanceId: 'char-1',
    rolls: mockRoll(),
    action: {
      type: 'attack',
      actorInstanceId: 'adv-1',
      targetInstanceIds: ['char-1'],
      trait: 'Strength',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    },
  });
  return buildTableSnapshot(state);
}

describe('Shifting', () => {
  it('exposes a reviewAction chip when the owner is targeted', () => {
    const table = targetedTable();
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].armorMark).toBe(1);
    expect(chips[0].isToggle).toBe(true);
  });

  it('does not expose a chip when the owner is the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      character: char,
      adversary: adv,
      _ownerInstanceId: 'char-1',
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
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

  it('toggle on adds a disadvantage die to the attack roll', () => {
    const table = targetedTable();
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const mutations = activateChip(chips[0], table, makeChipState());
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDisadvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Shifting' }),
      })
    );
  });

  it('toggle off removes the disadvantage die', () => {
    const table = targetedTable();
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const chipState = makeChipState();
    activateChip(chips[0], table, chipState);
    const off = activateChip(chips[0], table, chipState);
    expect(off).toContainEqual(
      expect.objectContaining({
        type: 'removeDisadvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Shifting' }),
      })
    );
  });
});
