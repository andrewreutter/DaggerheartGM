import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { Wrangle } from '../../../../src/features-v2/abilities/Bone/Wrangle.js';
import { mockCharacter, mockGameState } from '../helpers.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Bone — Wrangle', () => {
  it('card chip has Recall Cost 1 (hopeCost) and Agility actionLoop for Close-range repositioning', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Wrangle',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Wrangle, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(1);

    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Wrangle',
          trait: 'Agility',
          description: expect.stringMatching(/Agility roll.*Close range/i),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/willing allies/i),
        }),
      })
    );
  });
});
