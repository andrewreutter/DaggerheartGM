import { describe, it, expect } from 'vitest';
import { resolveGameTableCharacterEditMode } from '../../src/client/lib/game-table-character-modal-url.js';

describe('resolveGameTableCharacterEditMode', () => {
  it('returns new when the id is not in the library yet (create-from-table stub)', () => {
    expect(resolveGameTableCharacterEditMode({ id: 'a' }, [], true)).toBe('new');
    expect(resolveGameTableCharacterEditMode({ id: 'a' }, [{ id: 'b' }], true)).toBe('new');
  });

  it('returns original or copy when the library row exists', () => {
    expect(resolveGameTableCharacterEditMode({ id: 'a' }, [{ id: 'a' }], true)).toBe('original');
    expect(resolveGameTableCharacterEditMode({ id: 'a' }, [{ id: 'a' }], false)).toBe('copy');
  });
});
