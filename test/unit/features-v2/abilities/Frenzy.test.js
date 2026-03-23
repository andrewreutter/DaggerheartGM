import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import {
  dispatchStateChangeHooks,
  dispatchTokenMoveHooks,
  dispatchSceneEndHooks,
} from '../../../../src/features-v2/engine/action-loop.js';
import { Frenzy } from '../../../../src/features-v2/abilities/Blade/Frenzy.js';
import {
  mockCharacter,
  mockGameState,
  mockAdversary,
  mockRoll,
  mockAdversaryAttackRoll,
  runIntent,
  runReviewOutcome,
} from '../helpers.js';

const frenzyFeat = { ...Frenzy, _ownerInstanceId: 'char-1' };

describe('Blade — Frenzy', () => {
  it('passiveStatMods adds +8 Severe threshold while frenzied', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      armorThresholds: { major: 5, severe: 10 },
    });
    const { stats } = applyDeclarativeFeatures(
      [frenzyFeat],
      { ...char, featureState: { Frenzy: { frenzyActive: true } } },
      {}
    );
    expect(stats.severeThreshold).toBe(18);
  });

  it('onIntent adds +10 damage static on attacks while frenzied', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(frenzyFeat, {
      activeElements: [char, adv],
      featureState: { Frenzy: { frenzyActive: true } },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Frenzy',
          value: 10,
        }),
      })
    );
  });

  it('onReviewOutcome revokes armor commitment while frenzied', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations, narrations } = runReviewOutcome(frenzyFeat, {
      activeElements: [char, adv],
      featureState: { Frenzy: { frenzyActive: true } },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        useArmorByTargetId: { 'char-1': true },
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'char-1' },
            amount: 2,
            damageType: 'physical',
            useArmor: true,
          },
        ],
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    expect(narrations.some((n) => String(n).includes('Frenzy'))).toBe(true);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addNarration',
        payload: expect.objectContaining({
          text: expect.stringContaining('Frenzy'),
        }),
      })
    );
  });

  it('onStateChange ends Frenzy when the last on-map adversary is defeated', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 5,
      tokenY: 0,
      currentHp: 0,
      maxHp: 3,
    });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Frenzy',
      featureState: { Frenzy: { frenzyActive: true } },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [frenzyFeat],
      [{ type: 'markHP', payload: { instanceId: 'adv-1', amount: 1 } }]
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'frenzyActive',
          value: false,
        }),
      })
    );
  });

  it('onTokenMove ends Frenzy when no adversaries remain on the map with HP', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advPost = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 10,
      tokenY: 0,
      currentHp: 0,
      maxHp: 3,
    });
    const gs = {
      fear: 0,
      activeElements: [char, advPost],
      featureState: { Frenzy: { frenzyActive: true } },
      _previousPositions: { 'adv-1': { tokenX: 5, tokenY: 0 } },
    };
    const { mutations } = dispatchTokenMoveHooks(gs, [frenzyFeat], { moverInstanceId: 'adv-1' });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'frenzyActive',
          value: false,
        }),
      })
    );
  });

  it('onSceneEnd clears Frenzy', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Frenzy',
      featureState: { Frenzy: { frenzyActive: true } },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchSceneEndHooks(gs, [frenzyFeat]);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'frenzyActive',
          value: false,
        }),
      })
    );
  });
});
