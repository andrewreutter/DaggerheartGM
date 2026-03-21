import { describe, it, expect } from 'vitest';
import { Persuasive } from '../../../../src/features-v2/weapon_properties/Persuasive.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockGameState } from '../helpers.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Persuasive', () => {
  it('offers an intent chip on Presence rolls when acting', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Presence' }),
      actionType: 'trait',
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);
    expect(chips[0].isToggle).toBe(true);
    expect(chips[0].placements).toContain('intent');
  });

  it('adds +2 static to action roll when chip is activated', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      action: {
        type: 'trait',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        trait: 'Presence',
        range: null,
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips(
      [{ ...Persuasive, _ownerInstanceId: 'c1' }],
      'intent',
      table
    );

    expect(chips).toHaveLength(1);
    const chipState = makeChipState();
    const mutations = activateChip(chips[0], table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Persuasive',
          value: 2,
        }),
      })
    );
  });

  it('does not offer chip on non-Presence rolls', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Agility' }),
      actionType: 'trait',
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });

  it('does not offer chip when the owner is not the one acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });

    const { chips } = runIntent(
      { ...Persuasive, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char, other],
        action: mockAction({ type: 'trait', actorInstanceId: 'char-1', traitKey: 'Presence' }),
        actionType: 'trait',
      }
    );

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });
});
