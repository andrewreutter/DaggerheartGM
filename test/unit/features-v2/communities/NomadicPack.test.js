import { describe, it, expect } from 'vitest';
import { collectChips, trackChipFrequency } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { NomadicPack } from '../../../../src/features-v2/communities/Wanderborne.js';
import { mockTable, mockChipState } from '../helpers.js';

describe('Nomadic Pack', () => {
  const annotated = { ...NomadicPack, _ownerInstanceId: 'char-1' };

  it('offers a create chip that adds a Nomadic Pack to inventory', () => {
    const table = mockTable();
    const chips = collectChips([annotated], 'create', table);
    expect(chips).toHaveLength(1);
    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'inventoryAdd',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          item: expect.objectContaining({ name: 'Nomadic Pack', id: 'nomadic-pack' }),
        }),
      })
    );
  });

  it('offers a session card chip that queues an action loop when used', () => {
    const table = mockTable();
    const chips = collectChips([annotated], 'card', table, {});
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(1);
    expect(chips[0].frequency).toBe('session');

    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Nomadic Pack',
          description: expect.stringContaining('Nomadic Pack'),
        }),
      })
    );
  });

  it('does not offer the session card chip after it has been marked used for this session', () => {
    const table = mockTable();
    const usageStore = {};
    const first = collectChips([annotated], 'card', table, usageStore);
    expect(first).toHaveLength(1);
    const chipKey = first[0]._chipKey;
    trackChipFrequency(chipKey, 'session', usageStore);

    const second = collectChips([annotated], 'card', table, usageStore);
    expect(second).toHaveLength(0);
  });
});
