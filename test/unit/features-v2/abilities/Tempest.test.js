import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { Tempest } from '../../../../src/features-v2/abilities/Sage/Tempest.js';
import { mockGameState, mockCharacter } from '../helpers.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Sage — Tempest', () => {
  it('card chip has recall Hope cost 2 and three tempest modes', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const chips = collectChips(
      [{ ...Tempest, _ownerInstanceId: 'char-1' }],
      'card',
      buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }))
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(2);
    expect(typeof chips[0].isSelect).toBe('function');
    const opts = chips[0].isSelect();
    expect(opts).toHaveLength(3);
    expect(opts.map((o) => o.id)).toEqual(['blizzard', 'hurricane', 'sandstorm']);
  });

  it('queues actionLoop with Spellcast trait (Blizzard)', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'instinct' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Tempest',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Tempest, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState(), { selectedId: 'blizzard' });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Tempest',
          trait: 'Instinct',
          description: expect.stringMatching(/Blizzard.*2d20\+8/s),
        }),
      })
    );
  });

  it('queues actionLoop for Hurricane and Sandstorm', () => {
    const char = mockCharacter({ instanceId: 'c2', spellcastTrait: 'presence' });
    const tbl = buildTableSnapshot(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'c2', _featureKey: 'Tempest' })
    );
    const chips = collectChips([{ ...Tempest, _ownerInstanceId: 'c2' }], 'card', tbl);

    const mh = activateChip(chips[0], tbl, makeChipState(), { selectedId: 'hurricane' });
    expect(mh).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/Hurricane.*3d10\+10/s),
        }),
      })
    );

    const ms = activateChip(chips[0], tbl, makeChipState(), { selectedId: 'sandstorm' });
    expect(ms).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/Sandstorm.*5d6\+9/s),
        }),
      })
    );
  });
});
