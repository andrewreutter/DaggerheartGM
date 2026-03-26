import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SweetMoss } from '../../../../src/features-v2/consumables/SweetMoss.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import {
  activateChip,
  collectChips,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

function restAction(overrides = {}) {
  return {
    type: 'shortRest',
    actorInstanceId: 'char-1',
    targetInstanceIds: [],
    trait: null,
    range: null,
    effects: [],
    appliedEffects: [],
    ...overrides,
  };
}

describe('Consumables — Sweet Moss', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Sweet Moss', id: 'srd-cns-sweet-moss' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Sweet Moss',
        description: SweetMoss.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-sweet-moss',
      })
    );
  });

  it('rest placement chips are available during short rest, not on intent or a normal action', () => {
    const feat = { ...SweetMoss, _ownerInstanceId: 'char-1' };

    const shortRestTable = buildTableSnapshot(
      mockGameState({
        action: restAction(),
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sweet Moss',
      })
    );
    const duringRest = collectChips([feat], 'rest', shortRestTable);
    expect(duringRest.map((c) => c.name)).toEqual(['Sweet Moss']);

    expect(collectChips([feat], 'intent', shortRestTable)).toHaveLength(0);

    const attackTable = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sweet Moss',
      })
    );
    expect(collectChips([feat], 'rest', attackTable)).toHaveLength(0);
  });

  it('clear HP option rolls d10 and queues clearHP', () => {
    const t = buildTableSnapshot(
      mockGameState({
        action: restAction(),
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sweet Moss',
        _rng: () => 0.05,
      })
    );
    const chip = unwrap(SweetMoss.chips[0], t);
    const mut = activateChip(chip, t, makeChipState(), { selectedId: 'hp' });
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: 'd10',
          total: 1,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 1,
        }),
      })
    );
  });

  it('clear Stress option rolls d10 and queues clearStress', () => {
    const t = buildTableSnapshot(
      mockGameState({
        action: restAction(),
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sweet Moss',
        _rng: () => 0.95,
      })
    );
    const chip = unwrap(SweetMoss.chips[0], t);
    const mut = activateChip(chip, t, makeChipState(), { selectedId: 'stress' });
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: 'd10',
          total: 10,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 10,
        }),
      })
    );
  });

  it('onIntent does not queue healing outside rest (no root onUse)', () => {
    const { mutations } = runIntent(
      { ...SweetMoss, _ownerInstanceId: 'char-1' },
      {
        activeElements: [mockCharacter({ instanceId: 'char-1' })],
        actionType: 'attack',
      }
    );
    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });
});
