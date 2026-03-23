import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BloodOfTheYorgi } from '../../../../src/features-v2/consumables/BloodOfTheYorgi.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Blood of the Yorgi', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Blood of the Yorgi', id: 'srd-cns-blood-of-the-yorgi' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Blood of the Yorgi',
        description: BloodOfTheYorgi.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-blood-of-the-yorgi',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Blood of the Yorgi' }],
      }),
      registry
    );
    expect(
      feats.some((f) => f.name === 'Blood of the Yorgi' && f._source === 'consumable')
    ).toBe(true);
  });

  it('onUse queues move (Very Far-range teleport) and actionLoop when token is on the map', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Blood of the Yorgi',
    });
    const table = buildTableSnapshot(gs);
    BloodOfTheYorgi.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          description: expect.stringContaining('Blood of the Yorgi'),
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Blood of the Yorgi',
        }),
      })
    );
  });

  it('move predicate allows landings within Very Far (≤300 ft) and rejects farther', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const base = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Blood of the Yorgi',
    });
    const table = buildTableSnapshot(base);
    BloodOfTheYorgi.onUse(table);
    const mutations = applyMutations(table);
    const moveMut = mutations.find((m) => m.type === 'move');
    const fn = moveMut.payload.conditionFn;

    const okFar = mockCharacter({ instanceId: 'char-1', tokenX: 150, tokenY: 0 });
    expect(fn(buildTableSnapshot({ ...base, activeElements: [okFar] }))).toBe(true);

    const okEdge = mockCharacter({ instanceId: 'char-1', tokenX: 300, tokenY: 0 });
    expect(fn(buildTableSnapshot({ ...base, activeElements: [okEdge] }))).toBe(true);

    const tooFar = mockCharacter({ instanceId: 'char-1', tokenX: 301, tokenY: 0 });
    expect(fn(buildTableSnapshot({ ...base, activeElements: [tooFar] }))).toBe(false);
  });
});
