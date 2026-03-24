import { describe, it, expect } from 'vitest';
import { coerceLibraryAttack } from '../../src/client/lib/library-attack-display.js';

describe('coerceLibraryAttack', () => {
  it('returns structured shape for adversary-style attack', () => {
    const a = coerceLibraryAttack({
      name: 'Claw',
      modifier: 3,
      range: 'Melee',
      damage: '2d8+2',
      trait: 'Phy',
    });
    expect(a?.kind).toBe('structured');
    expect(a.name).toBe('Claw');
    expect(a.damage).toBe('2d8+2');
    expect(a.trait).toBe('Phy');
  });

  it('returns text kind for beastform-style string attack', () => {
    const a = coerceLibraryAttack('2d10+4 Agility | …');
    expect(a).toEqual({ kind: 'text', text: '2d10+4 Agility | …' });
  });

  it('returns null for empty string or missing name on object', () => {
    expect(coerceLibraryAttack('   ')).toBe(null);
    expect(coerceLibraryAttack({ modifier: 2 })).toBe(null);
  });
});
