import { describe, it, expect } from 'vitest';
import { Reinforced } from '../../../../src/features-v2/armor_properties/Reinforced.js';
import { dispatchStateChangeHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, runReviewAction } from '../helpers.js';

describe('Reinforced (armor property)', () => {
  it('adds +2 to major and severe thresholds when reinforcedActive is set in feature state', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      armorThresholds: { major: 5, severe: 10 },
      featureState: { Reinforced: { reinforcedActive: true } },
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));

    const { stats } = applyDeclarativeFeatures([{ ...Reinforced, _ownerInstanceId: 'c1' }], char, table);
    expect(stats.majorThreshold).toBe(7);
    expect(stats.severeThreshold).toBe(12);
  });

  it('adds 0 when reinforcedActive is absent or false', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      armorThresholds: { major: 5, severe: 10 },
      featureState: { Reinforced: { reinforcedActive: false } },
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));

    const { stats } = applyDeclarativeFeatures([{ ...Reinforced, _ownerInstanceId: 'c1' }], char, table);
    expect(stats.majorThreshold).toBe(5);
    expect(stats.severeThreshold).toBe(10);
  });

  it('sets reinforcedActive when targeted, armor use committed, and exactly one armor slot remains', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'char-1' }, amount: 4, useArmor: true },
    ];

    const { mutations } = runReviewAction(
      { ...Reinforced, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          trait: 'Strength',
          range: 'melee',
          effects,
          useArmorByTargetId: { 'char-1': true },
        },
      }
    );

    expect(
      mutations.some(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload.featureKey === 'Reinforced' &&
          m.payload.key === 'reinforcedActive' &&
          m.payload.value === true
      )
    ).toBe(true);
  });

  it('does not set reinforcedActive when more than one armor slot remains', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 2, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'char-1' }, amount: 4, useArmor: true },
    ];

    const { mutations } = runReviewAction(
      { ...Reinforced, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
          useArmorByTargetId: { 'char-1': true },
        },
      }
    );

    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('does not set reinforcedActive when armor use is not committed', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'char-1' }, amount: 4 },
    ];

    const { mutations } = runReviewAction(
      { ...Reinforced, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
        },
      }
    );

    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('clears reinforcedActive via onStateChange when clearArmor is applied in a batch', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 2, maxArmor: 3 });
    const gameState = mockGameState({
      activeElements: [char],
      featureState: { Reinforced: { reinforcedActive: true } },
    });

    const { mutations } = dispatchStateChangeHooks(
      gameState,
      [{ ...Reinforced, _ownerInstanceId: 'char-1' }],
      [
        {
          type: 'clearArmor',
          payload: { instanceId: 'char-1', amount: 1 },
        },
      ]
    );

    expect(
      mutations.some(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload.featureKey === 'Reinforced' &&
          m.payload.key === 'reinforcedActive' &&
          m.payload.value === false
      )
    ).toBe(true);
  });

  it('does not clear reinforcedActive onStateChange when reinforcedActive is already false', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 2, maxArmor: 3 });
    const gameState = mockGameState({
      activeElements: [char],
      featureState: { Reinforced: { reinforcedActive: false } },
    });

    const { mutations } = dispatchStateChangeHooks(
      gameState,
      [{ ...Reinforced, _ownerInstanceId: 'char-1' }],
      [{ type: 'clearArmor', payload: { instanceId: 'char-1', amount: 1 } }]
    );

    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });
});
