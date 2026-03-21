import { describe, it, expect } from 'vitest';
import { Impenetrable } from '../../../../src/features-v2/armor_properties/Impenetrable.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { runReviewOutcome, mockCharacter, mockAdversary, mockGameState } from '../helpers.js';

describe('Impenetrable', () => {
  it('shows a reviewOutcome chip at 1 HP when an HP loss effect targets the owner', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 1, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...Impenetrable, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [
            {
              stat: 'currentHP',
              target: { instanceId: 'char-1' },
              amount: 1,
            },
          ],
        },
      }
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('shortRest');
  });

  it('does not show the chip when current HP is not 1', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 3, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...Impenetrable, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [
            {
              stat: 'currentHP',
              target: { instanceId: 'char-1' },
              amount: 1,
            },
          ],
        },
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('onUse converts pending HP loss to 1 Stress on the same effect object', () => {
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 3 },
    ];
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 1, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      character: char,
      adversary: adv,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Impenetrable',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Strength',
        range: 'melee',
        effects,
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips([{ ...Impenetrable, _ownerInstanceId: 'char-1' }], 'reviewOutcome', table);
    expect(chips).toHaveLength(1);
    activateChip(chips[0], table, makeChipState());
    expect(effects[0].stat).toBe('currentStress');
    expect(effects[0].amount).toBe(1);
  });
});
