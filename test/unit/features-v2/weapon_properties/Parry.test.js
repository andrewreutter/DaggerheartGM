import { describe, it, expect } from 'vitest';
import { Parry } from '../../../../src/features-v2/weapon_properties/Parry.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';

function makeFeature() {
  return { ...Parry, _ownerInstanceId: 'c1' };
}

function makeTargetedState(overrides = {}) {
  const char = mockCharacter({ instanceId: 'c1' });
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
      effects: [
        { type: 'damage', target: { instanceId: 'c1' }, amount: 10, damageType: 'physical' },
      ],
      appliedEffects: [],
    },
    rolls: mockRoll({
      damageDice: [
        { name: 'weapon', die: 'd8', value: 5 },
        { name: 'bonus', die: 'd6', value: 3 },
      ],
    }),
    _rng: overrides._rng,
    ...overrides,
  });
}

describe('Parry', () => {
  it('offers a reviewAction chip when the owner is targeted by an attack', () => {
    const state = makeTargetedState();
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);

    expect(chips).toHaveLength(1);
    expect(chips[0].isToggle).toBe(true);
    expect(chips[0].placements).toContain('reviewAction');
  });

  it('does not offer chip when owner is not targeted', () => {
    const char = mockCharacter({ instanceId: 'c1' });
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

  it('does not offer chip on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      action: {
        type: 'trait',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['c1'],
        trait: 'Strength',
        range: 'melee',
        effects: [
          { type: 'damage', target: { instanceId: 'c1' }, amount: 10, damageType: 'physical' },
        ],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);

    expect(chips).toHaveLength(0);
  });

  it('reduces damage when parry die matches an attacker damage die', () => {
    const state = makeTargetedState({
      _rng: () => 4 / 8, // d8 rolls (4/8)*8+1 = 5 → matches weapon die value 5
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);

    expect(chips).toHaveLength(1);
    const chipState = makeChipState();
    const mutations = activateChip(chips[0], table, chipState);

    const narrations = mutations.filter((m) => m.type === 'addNarration');
    expect(narrations.length).toBeGreaterThan(0);
    expect(narrations[0].payload.text).toContain('cancelled');
  });

  it('does not reduce damage when parry die does not match', () => {
    const state = makeTargetedState({
      _rng: () => 6 / 8, // d8 rolls 7 → does not match 5 or 3
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips([makeFeature()], 'reviewAction', table);

    expect(chips).toHaveLength(1);
    const chipState = makeChipState();
    const mutations = activateChip(chips[0], table, chipState);

    const narrations = mutations.filter((m) => m.type === 'addNarration');
    expect(narrations.length).toBeGreaterThan(0);
    expect(narrations[0].payload.text).toContain('no matching');
  });
});
