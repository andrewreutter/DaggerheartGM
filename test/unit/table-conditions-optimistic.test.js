import { describe, it, expect } from 'vitest';
import { shouldOptimisticallyPatch } from '../../src/client/lib/optimistic-update-fields.js';

/**
 * Regression guard: GM/player table element updates must optimistically patch
 * conditions, token positions, and resource tracks so controlled inputs stay
 * in sync until the authoritative SSE snapshot arrives.
 * See app.jsx sendUpdateActiveElement / handlePlayerCharacterUpdate.
 */
function patchElement(elements, instanceId, updates) {
  if (!shouldOptimisticallyPatch(updates)) return elements;
  return elements.map((el) =>
    el.instanceId === instanceId ? { ...el, ...updates } : el
  );
}

describe('table conditions optimistic patch contract', () => {
  it('patches conditions in place', () => {
    const els = [{ instanceId: 'a', name: 'PC', conditions: '' }];
    const next = patchElement(els, 'a', { conditions: 'Slowed' });
    expect(next[0].conditions).toBe('Slowed');
    expect(next[0].name).toBe('PC');
  });

  it('patches tokenX and tokenY in place', () => {
    const els = [{ instanceId: 'a', tokenX: 0, tokenY: 0 }];
    const next = patchElement(els, 'a', { tokenX: 10, tokenY: 20 });
    expect(next[0].tokenX).toBe(10);
    expect(next[0].tokenY).toBe(20);
  });

  it('patches currentHp in place', () => {
    const els = [{ instanceId: 'a', currentHp: 5 }];
    const next = patchElement(els, 'a', { currentHp: 3 });
    expect(next[0].currentHp).toBe(3);
  });

  it('patches currentStress in place', () => {
    const els = [{ instanceId: 'a', currentStress: 0 }];
    const next = patchElement(els, 'a', { currentStress: 2 });
    expect(next[0].currentStress).toBe(2);
  });

  it('patches hope in place', () => {
    const els = [{ instanceId: 'a', hope: 6 }];
    const next = patchElement(els, 'a', { hope: 4 });
    expect(next[0].hope).toBe(4);
  });

  it('patches currentArmor in place', () => {
    const els = [{ instanceId: 'a', currentArmor: 2 }];
    const next = patchElement(els, 'a', { currentArmor: 1 });
    expect(next[0].currentArmor).toBe(1);
  });

  it('patches mapId in place', () => {
    const els = [{ instanceId: 'a', mapId: null }];
    const next = patchElement(els, 'a', { mapId: 'map-1' });
    expect(next[0].mapId).toBe('map-1');
  });

  it('does not patch unrelated updates without any optimistic fields', () => {
    const els = [{ instanceId: 'a', name: 'PC' }];
    const next = patchElement(els, 'a', { name: 'Other' });
    expect(next).toBe(els);
  });

  it('patches when update contains a mix of optimistic and non-optimistic fields', () => {
    const els = [{ instanceId: 'a', currentHp: 5, name: 'PC' }];
    const next = patchElement(els, 'a', { currentHp: 4, someOtherField: 'x' });
    expect(next[0].currentHp).toBe(4);
    expect(next[0].someOtherField).toBe('x');
  });

  it('does not patch an element that does not match the instanceId', () => {
    const els = [
      { instanceId: 'a', currentHp: 5 },
      { instanceId: 'b', currentHp: 5 },
    ];
    const next = patchElement(els, 'a', { currentHp: 3 });
    expect(next[0].currentHp).toBe(3);
    expect(next[1].currentHp).toBe(5);
  });
});

describe('shouldOptimisticallyPatch', () => {
  it('returns true for tokenX', () => expect(shouldOptimisticallyPatch({ tokenX: 0 })).toBe(true));
  it('returns true for tokenY', () => expect(shouldOptimisticallyPatch({ tokenY: 0 })).toBe(true));
  it('returns true for mapId', () => expect(shouldOptimisticallyPatch({ mapId: 'x' })).toBe(true));
  it('returns true for conditions', () => expect(shouldOptimisticallyPatch({ conditions: '' })).toBe(true));
  it('returns true for currentHp', () => expect(shouldOptimisticallyPatch({ currentHp: 0 })).toBe(true));
  it('returns true for currentStress', () => expect(shouldOptimisticallyPatch({ currentStress: 1 })).toBe(true));
  it('returns true for hope', () => expect(shouldOptimisticallyPatch({ hope: 3 })).toBe(true));
  it('returns true for currentArmor', () => expect(shouldOptimisticallyPatch({ currentArmor: 0 })).toBe(true));
  it('returns true for companion', () => expect(shouldOptimisticallyPatch({ companion: { currentStress: 1 } })).toBe(true));
  it('returns false for unrecognized fields', () => expect(shouldOptimisticallyPatch({ name: 'x' })).toBe(false));
  it('returns false for empty object', () => expect(shouldOptimisticallyPatch({})).toBe(false));
});
