import { describe, it, expect } from 'vitest';
import { applyTableOp } from '../../src/client/lib/table-ops.js';

/**
 * Regression: `saveItem` in app.jsx runs this same `applyTableOp` after a successful
 * character PUT so sidebar cards and the sheet update without waiting for SSE.
 */
describe('saveItem optimistic character merge (app.jsx contract)', () => {
  it('merges API saved row into activeElements like character-library-update', () => {
    const prev = [
      {
        instanceId: 'inst-1',
        elementType: 'character',
        id: 'char-1',
        name: 'Before',
        tier: 1,
        currentHp: 3,
        hope: 2,
      },
    ];
    const saved = { id: 'char-1', name: 'After', tier: 2, maxHp: 10 };
    const { activeElements } = applyTableOp(
      { op: 'character-library-update', characterId: 'char-1', newBaseData: saved },
      { activeElements: prev },
    );
    expect(activeElements[0].name).toBe('After');
    expect(activeElements[0].tier).toBe(2);
    expect(activeElements[0].maxHp).toBe(10);
    expect(activeElements[0].currentHp).toBe(3);
    expect(activeElements[0].hope).toBe(2);
  });
});
