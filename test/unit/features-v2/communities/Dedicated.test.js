import { describe, it, expect } from 'vitest';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { Dedicated } from '../../../../src/features-v2/communities/Orderborne.js';
import { runIntent, mockTable } from '../helpers.js';

describe('Dedicated', () => {
  it('has a name and description', () => {
    expect(Dedicated.name).toBe('Dedicated');
    expect(typeof Dedicated.description).toBe('string');
  });

  it('queues setHopeDieNotation mutation', () => {
    const result = runIntent(Dedicated);

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].frequency).toBe('rest');

    const table = mockTable({ _ownerInstanceId: 'char-1' });
    result.chips[0].onUse(table);

    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'hopeDie', die: 'd20' }),
      })
    );
  });
});
