import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { Deathrun } from '../../../../src/features-v2/abilities/Bone/Deathrun.js';
import { mockCharacter, mockGameState } from '../helpers.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Bone — Deathrun', () => {
  it('card chip spends 3 Hope and opens an actionLoop with path attacks and cascading weapon damage', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 5 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Deathrun',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Deathrun, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(3);

    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Deathrun',
          description: expect.stringMatching(/Spend 3 Hope/i),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/\+1 bonus to your Proficiency/i),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/can't target the same adversary/i),
        }),
      })
    );
  });

  it('does not expose intent-phase chips', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 5 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Deathrun',
    });
    const tbl = buildTableSnapshot(gs);
    const intent = collectChips([{ ...Deathrun, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toHaveLength(0);
  });
});
