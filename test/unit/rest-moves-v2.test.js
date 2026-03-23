import { describe, it, expect } from 'vitest';
import { getRestMovesForCharacter, LONG_REST_MOVES } from '../../src/client/lib/rest-moves.js';

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
