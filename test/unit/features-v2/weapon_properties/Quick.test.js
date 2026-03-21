import { describe, it, expect } from 'vitest';
import { Quick } from '../../../../src/features-v2/weapon_properties/Quick.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

function makeFeature() {
  return { ...Quick, _ownerInstanceId: 'c1' };
}

function makeAttackState() {
  const char = mockCharacter({ instanceId: 'c1' });
  const adv = mockAdversary({ instanceId: 'adv-1' });
  return mockGameState({
    activeElements: [char, adv],
    _ownerInstanceId: 'c1',
    action: {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [
        { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical' },
      ],
      appliedEffects: [],
    },
    rolls: mockRoll({
      damageDice: [{ name: 'weapon', die: 'd8', value: 5 }],
    }),
  });
}

describe('Quick', () => {
  it('offers a reviewAction chip when the owner is making an attack', () => {
    const state = makeAttackState();
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);

    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);
    expect(chips[0].isToggle).toBe(true);
    expect(chips[0].placements).toContain('reviewAction');
  });

  it('does not offer chip on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      action: {
        type: 'trait',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
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

  it('does not offer chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const other = mockCharacter({ instanceId: 'c2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, other, adv],
      _ownerInstanceId: 'c1',
      action: {
        type: 'attack',
        actorInstanceId: 'c2',
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

  it('queues addDamageRoll mutation when chip is activated', () => {
    const state = makeAttackState();
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);
    const chipState = makeChipState();

    const mutations = activateChip(chips[0], table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Quick',
          dice: 'd8',
        }),
      })
    );
  });
});
