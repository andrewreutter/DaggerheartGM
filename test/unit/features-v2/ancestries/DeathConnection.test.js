import { describe, it, expect } from 'vitest';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockTable, mockChipState } from '../helpers.js';
import { DeathConnection } from '../../../../src/features-v2/ancestries/Fungril.js';

describe('Death Connection', () => {
  it('has a card chip', () => {
    const table = mockTable();
    const annotatedFeature = {
      ...DeathConnection,
      _ownerInstanceId: 'char-1',
    };
    const chips = collectChips([annotatedFeature], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Death Connection');
    expect(chips[0].placements).toContain('card');
  });

  it('queues actionLoop mutation when chip is used', () => {
    const table = mockTable();
    const annotatedFeature = {
      ...DeathConnection,
      _ownerInstanceId: 'char-1',
    };
    const chips = collectChips([annotatedFeature], 'card', table);
    expect(chips[0].stressCost).toBe(1);

    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Death Connection',
          description:
            'Extracting a memory from a corpse related to a specific emotion or sensation.',
        }),
      })
    );
  });
});
