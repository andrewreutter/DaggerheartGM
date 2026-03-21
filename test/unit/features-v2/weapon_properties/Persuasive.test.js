import { describe, it, expect } from 'vitest';
import { Persuasive } from '../../../../src/features-v2/weapon_properties/Persuasive.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Persuasive', () => {
  it('offers an intent chip on Presence rolls when acting', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Presence' }),
      actionType: 'trait',
    });

    const intentChips = chips.filter((c) => c.placements?.includes('intent'));
    expect(intentChips).toHaveLength(1);
    expect(intentChips[0].stressCost).toBe(1);
  });

  it('chip onUse adds +2 static to the action roll', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        trait: 'Presence',
        range: null,
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);

    const chips = collectChips(
      [{ ...Persuasive, _ownerInstanceId: 'char-1' }],
      'intent',
      table
    );

    expect(chips.length).toBeGreaterThan(0);
    const chipState = makeChipState();
    const mutations = activateChip(chips[0], table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Persuasive', value: 2 }),
      })
    );
  });

  it('does not offer a chip on non-Presence rolls', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Agility' }),
      actionType: 'trait',
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });

  it('does not offer a chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runIntent({ ...Persuasive, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'trait', traitKey: 'Presence', actorInstanceId: 'char-1' }),
      actionType: 'trait',
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });
});
