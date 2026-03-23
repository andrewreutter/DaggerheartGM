import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { GroundPound } from '../../../../src/features-v2/abilities/Valor/GroundPound.js';
import { mockCharacter, mockGameState } from '../helpers.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Valor — Ground Pound', () => {
  it('card chip has Recall Cost 2 (hopeCost) and Strength actionLoop text', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Ground Pound',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GroundPound, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(2);

    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Ground Pound',
          trait: 'Strength',
          description: expect.stringMatching(/Strength roll.*Very Close/i),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/4d10\+8/),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/Reaction Roll \(17\)/),
        }),
      })
    );
  });
});
