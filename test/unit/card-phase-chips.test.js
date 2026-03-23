import { describe, it, expect } from 'vitest';
import { isCardPhaseChip, filterCardPhaseChips } from '../../src/client/lib/card-phase-chips.js';

describe('card-phase-chips', () => {
  it('isCardPhaseChip accepts placement card', () => {
    expect(isCardPhaseChip({ placement: 'card' })).toBe(true);
    expect(isCardPhaseChip({ placement: 'reviewAction' })).toBe(false);
  });

  it('isCardPhaseChip accepts placements array including card', () => {
    expect(isCardPhaseChip({ placements: ['card'] })).toBe(true);
    expect(isCardPhaseChip({ placements: ['card', 'reviewAction'] })).toBe(true);
    expect(isCardPhaseChip({ placements: ['reviewAction'] })).toBe(false);
  });

  it('filterCardPhaseChips preserves order', () => {
    const a = { placements: ['card'] };
    const b = { placement: 'statblock' };
    const c = { placement: 'card' };
    expect(filterCardPhaseChips([a, b, c])).toEqual([a, c]);
  });
});
