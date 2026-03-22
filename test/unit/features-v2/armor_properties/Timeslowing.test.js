import { describe, it, expect } from 'vitest';
import { Timeslowing } from '../../../../src/features-v2/armor_properties/Timeslowing.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll } from '../helpers.js';

function makeFeature() {
  return { ...Timeslowing, _ownerInstanceId: 'char-1' };
}

function targetedTable() {
  const char = mockCharacter({ instanceId: 'char-1', currentArmor: 2, maxArmor: 3 });
  const adv = mockAdversary({ instanceId: 'adv-1' });
  const state = mockGameState({
    character: char,
    adversary: adv,
    _ownerInstanceId: 'char-1',
    _rng: () => 0.5,
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

describe('Timeslowing', () => {
  it('exposes a reviewAction toggle chip when targeted by an attack', () => {
    const table = targetedTable();
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].armorMark).toBe(1);
  });

  it('does not expose the chip when targeted by a non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 2, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      character: char,
      adversary: adv,
      _ownerInstanceId: 'char-1',
      _rng: () => 0.5,
      rolls: mockRoll(),
      action: {
        type: 'trait',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Presence',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    expect(chips).toHaveLength(0);
  });

  it('toggle on rolls d4 and queues addTemporaryStatMod for evasion', () => {
    const table = targetedTable();
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const mutations = activateChip(chips[0], table, makeChipState());
    const add = mutations.find((m) => m.type === 'addTemporaryStatMod');
    expect(add).toBeDefined();
    expect(add.payload.stat).toBe('evasion');
    expect(add.payload.instanceId).toBe('char-1');
    expect(typeof add.payload.value).toBe('number');
    expect(add.payload.value).toBeGreaterThanOrEqual(1);
    expect(add.payload.value).toBeLessThanOrEqual(4);
  });

  it('toggle off removes the same evasion bonus', () => {
    const table = targetedTable();
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const chipState = makeChipState();
    const on = activateChip(chips[0], table, chipState);
    const bonus = on.find((m) => m.type === 'addTemporaryStatMod')?.payload?.value;
    const off = activateChip(chips[0], table, chipState);
    const remove = off.find((m) => m.type === 'removeTemporaryStatMod');
    expect(remove).toBeDefined();
    expect(remove.payload).toMatchObject({ stat: 'evasion', value: bonus, instanceId: 'char-1' });
  });
});
