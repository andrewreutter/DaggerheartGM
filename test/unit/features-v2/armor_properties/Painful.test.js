import { describe, it, expect } from 'vitest';
import { Painful } from '../../../../src/features-v2/armor_properties/Painful.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

describe('Painful', () => {
  it('queues markStress(1) when armor use is committed', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...Painful, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Strength',
          range: 'melee',
          effects: [
            { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 1 },
          ],
          useArmorByTargetId: { 'char-1': true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: { instanceId: 'char-1', amount: 1 },
      })
    );
  });

  it('does not mark Stress when armor is not committed', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...Painful, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Strength',
          range: 'melee',
          effects: [
            { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 1 },
          ],
        },
      }
    );
    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});
