import { describe, it, expect, vi } from 'vitest';
import {
  getRestMovesForCharacter,
  getRestMoveDefinition,
  applyRestMoveSelections,
  LONG_REST_MOVES,
} from '../../src/client/lib/rest-moves.js';

describe('getRestMoveDefinition + applyRestMoveSelections (rest banner ack)', () => {
  it('resolves short and long rest move definitions used on acknowledge', () => {
    expect(getRestMoveDefinition('tend-to-wounds')?.onApply).toEqual(expect.any(Function));
    expect(getRestMoveDefinition('clear-all-stress')?.onApply).toEqual(expect.any(Function));
    expect(getRestMoveDefinition('missing-move')).toBeUndefined();
  });

  it('applies selected short-rest moves without requiring a component import', () => {
    const clearHp = vi.fn();
    const gainHope = vi.fn();
    const char = { instanceId: 'c1', elementType: 'character', tier: 2, maxHp: 6 };
    const wrap = (el) => ({
      ...el,
      clearHp,
      gainHope,
      clearStress: vi.fn(),
      clearArmor: vi.fn(),
    });

    applyRestMoveSelections(
      {
        c1: {
          move1: 'tend-to-wounds',
          move1RollResult: { dice: '1d4', value: 3 },
          move2: 'prepare',
        },
      },
      [char],
      wrap
    );

    expect(clearHp).toHaveBeenCalledWith(5); // 3 + tier 2
    expect(gainHope).toHaveBeenCalledWith(1);
  });

  it('applies long-rest clear-all moves on acknowledge selections', () => {
    const clearStress = vi.fn();
    const char = { instanceId: 'c1', elementType: 'character', maxStress: 5 };
    const wrap = (el) => ({
      ...el,
      clearStress,
      clearHp: vi.fn(),
      clearArmor: vi.fn(),
      gainHope: vi.fn(),
    });

    applyRestMoveSelections(
      { c1: { move1: 'clear-all-stress' } },
      [char],
      wrap
    );

    expect(clearStress).toHaveBeenCalledWith(6); // maxStress + 1
  });
});

describe('getRestMovesForCharacter + V2 passive rest mods', () => {
  it('Clank: Efficient merges long-rest moves into short-rest options (numLongMovesInShortRest)', () => {
    const out = getRestMovesForCharacter({ ancestry: ['Clank'] }, 'short');
    const longIds = new Set(LONG_REST_MOVES.map(m => m.id));
    const shortMoveIds = out.moves.map(m => m.id);
    for (const id of longIds) {
      expect(shortMoveIds).toContain(id);
    }
    expect(out.shortSlots).toBe(2);
    expect(out.longSlots).toBe(2);
  });

  it('Bone Recovery: long-rest moves available during short rest (abilityIds)', () => {
    const out = getRestMovesForCharacter({ abilityIds: ['srd-abl-recovery'] }, 'short');
    const longIds = new Set(LONG_REST_MOVES.map((m) => m.id));
    const shortMoveIds = out.moves.map((m) => m.id);
    for (const id of longIds) {
      expect(shortMoveIds).toContain(id);
    }
  });

  it('Elf: Celestial Trance adds one short and one long rest slot', () => {
    const out = getRestMovesForCharacter({ ancestry: ['Elf'] }, 'short');
    expect(out.shortSlots).toBe(3);
    expect(out.longSlots).toBe(3);
    const longOut = getRestMovesForCharacter({ ancestry: ['Elf'] }, 'long');
    expect(longOut.longSlots).toBe(3);
  });

});
