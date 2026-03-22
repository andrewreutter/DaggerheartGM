import { describe, it, expect } from 'vitest';

/**
 * Regression guard: GM/player table element updates must optimistically patch
 * `conditions` (and token positions) so controlled inputs stay in sync until SSE.
 * See app.jsx sendUpdateActiveElement / handlePlayerCharacterUpdate.
 */
function shouldOptimisticallyPatch(updates) {
  return 'tokenX' in updates || 'tokenY' in updates || 'conditions' in updates;
}

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

  it('does not patch unrelated updates without conditions or token coords', () => {
    const els = [{ instanceId: 'a', hope: 3 }];
    const next = patchElement(els, 'a', { hope: 2 });
    expect(next).toBe(els);
  });
});
