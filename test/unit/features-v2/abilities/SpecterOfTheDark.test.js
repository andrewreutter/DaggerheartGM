import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { SpecterOfTheDark } from '../../../../src/features-v2/abilities/Midnight/SpecterOfTheDark.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runIntent } from '../helpers.js';

describe('Midnight — Specter of the Dark', () => {
  const feat = { ...SpecterOfTheDark, _ownerInstanceId: 'char-1' };

  it('applyDeclarativeFeatures grants physical immunity only while Spectral', () => {
    const off = mockCharacter({
      instanceId: 'char-1',
      featureState: { 'Specter of the Dark': {} },
    });
    const outOff = applyDeclarativeFeatures([feat], off, {});
    expect(outOff.damageAffinities.immunities).not.toContain('physical');

    const on = mockCharacter({
      instanceId: 'char-1',
      featureState: { 'Specter of the Dark': { spectralActive: true } },
    });
    const outOn = applyDeclarativeFeatures([feat], on, {});
    expect(outOn.damageAffinities.immunities).toContain('physical');
  });

  it('card marks Stress, sets Spectral, and queues actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1' })],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Specter of the Dark',
        featureState: { 'Specter of the Dark': {} },
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const main = chips[0];
    expect(main?.stressCost).toBe(1);
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Specter of the Dark',
          key: 'spectralActive',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Specter of the Dark' }),
      })
    );
  });

  it('onIntent clears Spectral when making an attack that targets another creature', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feat, {
      activeElements: [char, adv],
      featureState: { 'Specter of the Dark': { spectralActive: true } },
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
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Specter of the Dark',
          key: 'spectralActive',
          value: false,
        }),
      })
    );
  });
});
