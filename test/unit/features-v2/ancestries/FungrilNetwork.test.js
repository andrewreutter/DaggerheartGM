import { describe, it, expect } from 'vitest';
import { mockTable, mockChipState } from '../helpers.js';
import { FungrilNetwork } from '../../../../src/features-v2/ancestries/Fungril.js';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Fungril Network', () => {
  it('has a card chip available', () => {
    const table = mockTable();
    const chips = collectChips([FungrilNetwork], 'card', table);
    
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Fungril Network');
    expect(chips[0].placements).toContain('card');
  });

  it('triggers action loop when chip is used', () => {
    const table = mockTable();
    const chips = collectChips([FungrilNetwork], 'card', table);
    
    expect(chips).toHaveLength(1);
    const chip = chips[0];
    
    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);
    
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Fungril Network',
          trait: 'Instinct',
          difficulty: 12,
        })
      })
    );
  });
});
