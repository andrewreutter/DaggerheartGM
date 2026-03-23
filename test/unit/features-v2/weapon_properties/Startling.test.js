import { describe, it, expect } from 'vitest';
import { Startling } from '../../../../src/features-v2/weapon_properties/Startling.js';
import {
  mockRoll,
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockChipState,
} from '../helpers.js';
import { activateChip, collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

function tableForStartling(overrides = {}) {
  return buildTableSnapshot(
    mockGameState({
      _ownerInstanceId: 'char-1',
      _featureKey: 'Startling',
      rolls: mockRoll({ isSuccess: true }),
      ...overrides,
    })
  );
}

describe('Startling', () => {
  it('offers a card-phase chip when at least one adversary is in melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advMelee = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 });
    const advFar = mockAdversary({ instanceId: 'adv-2', tokenX: 200, tokenY: 0 });

    const table = tableForStartling({
      activeElements: [char, advMelee, advFar],
    });

    const chips = collectChips([{ ...Startling, _ownerInstanceId: 'char-1' }], 'card', table);

    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);
    expect(chips[0].disabled).toBe(false);
  });

  it('disables the chip when no adversary is in melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advFar = mockAdversary({ instanceId: 'adv-2', tokenX: 200, tokenY: 0 });

    const table = tableForStartling({
      activeElements: [char, advFar],
    });

    const chips = collectChips([{ ...Startling, _ownerInstanceId: 'char-1' }], 'card', table);

    expect(chips).toHaveLength(1);
    expect(chips[0].disabled).toBe(true);
  });

  it('onUse queues a move mutation for each adversary in melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advMelee = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 });
    const advFar = mockAdversary({ instanceId: 'adv-2', tokenX: 200, tokenY: 0 });

    const table = tableForStartling({
      activeElements: [char, advMelee, advFar],
    });

    const collected = collectChips([{ ...Startling, _ownerInstanceId: 'char-1' }], 'card', table);
    expect(collected).toHaveLength(1);

    const mutations = activateChip(collected[0], table, mockChipState());
    const moves = mutations.filter((m) => m.type === 'move');
    expect(moves).toHaveLength(1);
    expect(moves[0].payload).toMatchObject({
      instanceId: 'adv-1',
      desiredCondition: 'Close range between you and this adversary',
      description: 'Forced back to Close range.',
    });
  });

  it('does not require an action loop (card chip with no table.action)', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advMelee = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, advMelee],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Startling',
        action: undefined,
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...Startling, _ownerInstanceId: 'char-1' }], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].disabled).toBe(false);
  });
});
