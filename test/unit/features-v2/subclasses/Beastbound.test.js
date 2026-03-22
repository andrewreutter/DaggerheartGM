import { describe, it, expect } from 'vitest';
import {
  Companion,
  ExpertTraining,
  BattleBonded,
  AdvancedTraining,
  LoyalFriend,
} from '../../../../src/features-v2/subclasses/Beastbound.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { mockCharacter, mockAdversary, mockAction, runIntent } from '../helpers.js';

describe('Beastbound — Companion / training / Loyal Friend (narrative)', () => {
  it('Companion has no executable hooks or chips (sheet + level-up choices)', () => {
    expect(Companion.chips).toBeUndefined();
    expect(Companion.hooks).toBeUndefined();
    expect(Companion.name).toBe('Companion');
  });

  it('Expert Training and Advanced Training are advancement-only text', () => {
    expect(ExpertTraining.hooks).toBeUndefined();
    expect(AdvancedTraining.hooks).toBeUndefined();
  });

  it('Loyal Friend is narrative-only (GM resolves the swap)', () => {
    expect(LoyalFriend.hooks).toBeUndefined();
    expect(LoyalFriend.chips).toBeUndefined();
  });

  it('merges with other Beastbound exports in declarative pass without error', () => {
    const char = mockCharacter({ instanceId: 'b1' });
    const out = applyDeclarativeFeatures(
      [
        { ...Companion, _ownerInstanceId: 'b1' },
        { ...BattleBonded, _ownerInstanceId: 'b1' },
      ],
      char,
      {}
    );
    expect(out.stats).toBeDefined();
  });
});

describe('Beastbound — Battle-Bonded', () => {
  it('queues +2 temporary evasion on intent when an adversary attacks you in Melee (companion shares your space)', () => {
    const ranger = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });

    const { mutations } = runIntent(
      { ...BattleBonded, _ownerInstanceId: 'char-1' },
      {
        activeElements: [ranger, adv],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          stat: 'evasion',
          value: 2,
        }),
      })
    );
  });

  it('does not queue evasion when the adversary is beyond Melee of your position', () => {
    const ranger = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 120, tokenY: 0 });

    const { mutations } = runIntent(
      { ...BattleBonded, _ownerInstanceId: 'char-1' },
      {
        activeElements: [ranger, adv],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addTemporaryStatMod')).toHaveLength(0);
  });
});
