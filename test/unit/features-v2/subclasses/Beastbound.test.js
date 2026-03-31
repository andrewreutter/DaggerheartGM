import { describe, it, expect } from 'vitest';
import {
  Companion,
  ExpertTraining,
  BattleBonded,
  AdvancedTraining,
  LoyalFriend,
  srdifyRangerCompanion,
} from '../../../../src/features-v2/subclasses/Beastbound.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { mockCharacter, mockAdversary, mockAction, runIntent } from '../helpers.js';

describe('Beastbound — Companion / training / Loyal Friend (narrative)', () => {
  it('Companion has shape-anchored sheet chip + declarative cards (no engine hooks)', () => {
    expect(Array.isArray(Companion.chips)).toBe(true);
    expect(Companion.chips[0].placements?.[0]).toBe(Companion.cards[0].shape);
    expect(Companion.chips[0].onUse).toBeTypeOf('function');
    expect(Companion.hooks).toBeUndefined();
    expect(Companion.name).toBe('Companion');
  });

  it('srdifyRangerCompanion maps runtime companion to shapeId + display fields', () => {
    const out = srdifyRangerCompanion({
      name: 'Artaq',
      species: 'Jhereg',
      evasion: 12,
      attackName: 'Stinger',
      maxStress: 4,
      currentStress: 1,
      experiences: [{ name: 'Odd Clues', score: 2 }],
    });
    expect(out.shapeId).toBe('dh.shape.rangerCompanion');
    expect(out.name).toBe('Artaq');
    expect(out.experiences[0].score).toBe(2);
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

  it('Companion emits virtualTokens when companion data exists', () => {
    const char = mockCharacter({
      instanceId: 'b1',
      companion: {
        name: 'Fang',
        species: 'wolf',
        experiences: [{ name: 'Scent', score: 2 }, { name: 'Pack', score: 2 }],
      },
    });
    const out = applyDeclarativeFeatures([{ ...Companion, _ownerInstanceId: 'b1' }], char, {});
    expect(
      out.virtualTokens.some((t) => t.id === 'beastbound-companion' && t.tokenKind === 'companion'),
    ).toBe(true);
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

  it('uses a placed companion board token for Melee (not the ranger position)', () => {
    const ranger = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 50, tokenY: 0 });
    const bt = {
      elementType: 'boardToken',
      instanceId: 'bt1',
      parentInstanceId: 'char-1',
      tokenKind: 'companion',
      virtualTokenId: 'beastbound-companion',
      label: 'Wolf',
      tokenX: 49,
      tokenY: 0,
      mapId: null,
    };
    const { mutations } = runIntent(
      { ...BattleBonded, _ownerInstanceId: 'char-1' },
      {
        activeElements: [ranger, adv, bt],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );
    expect(mutations.some((m) => m.type === 'addTemporaryStatMod')).toBe(true);
  });
});
