import { describe, it, expect } from 'vitest';
import { layoutTokenDotRing } from '../../src/client/lib/token-dot-ring.js';
import { conditionMarks } from '../../src/client/lib/condition-symbols.js';

const HP = { color: '#ef4444', total: 6, filled: 2 };
const STRESS = { color: '#f97316', total: 5, filled: 1 };

describe('layoutTokenDotRing', () => {
  it('returns null when there are no dots', () => {
    expect(layoutTokenDotRing(40, 40, [])).toBeNull();
    expect(layoutTokenDotRing(40, 40, [{ color: '#ef4444', total: 0, filled: 0 }])).toBeNull();
  });

  it('does not reserve a slot for an empty conditions group', () => {
    const without = layoutTokenDotRing(40, 40, [HP, STRESS]);
    const withEmpty = layoutTokenDotRing(40, 40, [
      HP,
      STRESS,
      { kind: 'condition', total: 0, filled: 0, marks: [] },
    ]);
    expect(withEmpty).toEqual(without);
    expect(without.dots.every((d) => d.kind === 'resource')).toBe(true);
  });

  it('adds a conditions group that takes ring space only when marks exist', () => {
    const marks = conditionMarks('Vulnerable, Hidden');
    const without = layoutTokenDotRing(40, 40, [HP, STRESS]);
    const withMarks = layoutTokenDotRing(40, 40, [
      HP,
      STRESS,
      { kind: 'condition', total: marks.length, filled: marks.length, marks },
    ]);
    expect(without.dots).toHaveLength(11);
    expect(withMarks.dots).toHaveLength(13);
    const conditionDots = withMarks.dots.filter((d) => d.kind === 'condition');
    expect(conditionDots).toHaveLength(2);
    expect(conditionDots.map((d) => d.symbol)).toEqual(marks.map((m) => m.symbol));
    expect(conditionDots.map((d) => d.name)).toEqual(['Vulnerable', 'Hidden']);
    // Extra group respaces later resource pips (Stress starts at index 6 in both layouts).
    expect(withMarks.dots[6].x).not.toBeCloseTo(without.dots[6].x, 5);
    expect(withMarks.dots[6].y).not.toBeCloseTo(without.dots[6].y, 5);
  });
});
