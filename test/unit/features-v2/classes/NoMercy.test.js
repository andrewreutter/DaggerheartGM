import { describe, it, expect } from 'vitest';
import { NoMercy } from '../../../../src/features-v2/classes/Warrior.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('No Mercy (Warrior hope feature)', () => {
  it('adds +1 to the action roll when noMercyActive is set and the owner makes an attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...NoMercy, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'No Mercy': { noMercyActive: true } },
        action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'No Mercy', value: 1 }),
      })
    );
  });

  it('does not add a bonus when noMercyActive is false', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...NoMercy, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'No Mercy': { noMercyActive: false } },
        action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'No Mercy')).toHaveLength(0);
  });

  it('does not add a bonus on a successful trait roll (CONV-025)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...NoMercy, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'No Mercy': { noMercyActive: true } },
        action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'No Mercy')).toHaveLength(0);
  });

  it('clears noMercyActive on a short rest', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...NoMercy, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'No Mercy': { noMercyActive: true } },
        actionType: 'shortRest',
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'No Mercy',
          key: 'noMercyActive',
          value: false,
        }),
      })
    );
  });
});
