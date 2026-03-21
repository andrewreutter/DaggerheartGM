import { describe, it, expect } from 'vitest';
import { when, isActing, isTargeted, hasDamage, hasPhysicalDamage, isWhen, unwrap, unwrapAll } from '../../../../src/features-v2/engine/when.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTable(meIsActing = false, targets = []) {
  const me = { instanceId: 'char-1', isActing: meIsActing };
  return {
    me,
    action: {
      actor: me,
      targets,
    },
  };
}

// ---------------------------------------------------------------------------
// when()
// ---------------------------------------------------------------------------

describe('when()', () => {
  it('wraps a value with a single predicate', () => {
    const w = when(() => true, 'hello');
    expect(isWhen(w)).toBe(true);
  });

  it('wraps a value with multiple predicates', () => {
    const w = when(() => true, () => true, { foo: 1 });
    expect(isWhen(w)).toBe(true);
  });

  it('throws when called with fewer than 2 arguments', () => {
    expect(() => when(() => true)).toThrow();
    expect(() => when()).toThrow();
  });

  it('does not modify the wrapped value object identity', () => {
    const obj = { nested: true };
    const w = when(() => true, obj);
    expect(isWhen(w)).toBe(true);
    // The wrapper itself is not the original object
    expect(w).not.toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// isActing
// ---------------------------------------------------------------------------

describe('isActing', () => {
  it('returns true when table.me.isActing is true', () => {
    expect(isActing(makeTable(true))).toBe(true);
  });

  it('returns false when table.me.isActing is false', () => {
    expect(isActing(makeTable(false))).toBe(false);
  });

  it('returns false when table.me is absent', () => {
    expect(isActing({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTargeted
// ---------------------------------------------------------------------------

describe('isTargeted', () => {
  it('returns true when table.me is in action.targets', () => {
    const me = { instanceId: 'char-1', isActing: false };
    const table = { me, action: { targets: [me] } };
    expect(isTargeted(table)).toBe(true);
  });

  it('returns false when table.me is not in action.targets', () => {
    const me = { instanceId: 'char-1' };
    const other = { instanceId: 'char-2' };
    const table = { me, action: { targets: [other] } };
    expect(isTargeted(table)).toBe(false);
  });

  it('returns false when action is undefined', () => {
    const me = { instanceId: 'char-1' };
    expect(isTargeted({ me })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasDamage / hasPhysicalDamage
// ---------------------------------------------------------------------------

describe('hasDamage', () => {
  it('returns true when there is a damage effect targeting me with amount > 0', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 5, damageType: 'physical' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(true);
  });

  it('returns false when damage amount is 0', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 0, damageType: 'physical' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(false);
  });

  it('returns false when damage targets someone else', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-2' }, amount: 5, damageType: 'physical' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(false);
  });

  it('returns true for magic damage', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 3, damageType: 'magic' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(true);
  });

  it('returns false when action is undefined', () => {
    expect(hasDamage({ me: { instanceId: 'char-1' } })).toBe(false);
  });
});

describe('hasPhysicalDamage', () => {
  it('returns true for physical damage targeting me', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 5, damageType: 'physical' },
        ],
      },
    };
    expect(hasPhysicalDamage(table)).toBe(true);
  });

  it('returns false for magic damage', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 5, damageType: 'magic' },
        ],
      },
    };
    expect(hasPhysicalDamage(table)).toBe(false);
  });

  it('returns false when action is undefined', () => {
    expect(hasPhysicalDamage({ me: { instanceId: 'char-1' } })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// unwrap()
// ---------------------------------------------------------------------------

describe('unwrap()', () => {
  it('returns non-wrapped values as-is', () => {
    const table = makeTable();
    expect(unwrap(42, table)).toBe(42);
    expect(unwrap('hello', table)).toBe('hello');
    expect(unwrap(null, table)).toBe(null);
    expect(unwrap(undefined, table)).toBe(undefined);
    const obj = { a: 1 };
    expect(unwrap(obj, table)).toBe(obj);
  });

  it('returns the wrapped value when all predicates pass', () => {
    const table = makeTable(true);
    const w = when(isActing, { foo: 'bar' });
    expect(unwrap(w, table)).toEqual({ foo: 'bar' });
  });

  it('returns undefined when a predicate fails', () => {
    const table = makeTable(false);
    const w = when(isActing, { foo: 'bar' });
    expect(unwrap(w, table)).toBe(undefined);
  });

  it('requires ALL predicates to pass', () => {
    const table = makeTable(true);
    const alwaysFalse = () => false;
    const w = when(isActing, alwaysFalse, 42);
    expect(unwrap(w, table)).toBe(undefined);
  });

  it('returns a function value correctly', () => {
    const fn = (t) => t.me.gainHope?.(1);
    const table = makeTable(true);
    const w = when(isActing, fn);
    expect(unwrap(w, table)).toBe(fn);
  });
});

// ---------------------------------------------------------------------------
// unwrapAll()
// ---------------------------------------------------------------------------

describe('unwrapAll()', () => {
  it('passes through non-wrapped primitives', () => {
    const table = makeTable();
    expect(unwrapAll(42, table)).toBe(42);
    expect(unwrapAll('x', table)).toBe('x');
  });

  it('recursively unwraps object values', () => {
    const table = makeTable(true);
    const obj = {
      always: 'yes',
      conditional: when(isActing, 99),
    };
    const result = unwrapAll(obj, table);
    expect(result.always).toBe('yes');
    expect(result.conditional).toBe(99);
  });

  it('omits object keys whose when() wrapper fails', () => {
    const table = makeTable(false);
    const obj = {
      always: 'yes',
      conditional: when(isActing, 99),
    };
    const result = unwrapAll(obj, table);
    expect(result.always).toBe('yes');
    expect('conditional' in result).toBe(false);
  });

  it('filters array elements whose when() wrapper fails', () => {
    const table = makeTable(false);
    const arr = ['always', when(isActing, 'ifActing'), 'also'];
    const result = unwrapAll(arr, table);
    expect(result).toEqual(['always', 'also']);
  });

  it('keeps array elements whose when() wrapper passes', () => {
    const table = makeTable(true);
    const arr = ['always', when(isActing, 'ifActing'), 'also'];
    const result = unwrapAll(arr, table);
    expect(result).toEqual(['always', 'ifActing', 'also']);
  });

  it('resolves a top-level when() wrapper to undefined when false', () => {
    const table = makeTable(false);
    const w = when(isActing, { big: 'object' });
    expect(unwrapAll(w, table)).toBe(undefined);
  });

  it('resolves a top-level when() wrapper to the value when true', () => {
    const table = makeTable(true);
    const w = when(isActing, { big: 'object' });
    expect(unwrapAll(w, table)).toEqual({ big: 'object' });
  });

  it('recursively resolves nested when() in nested objects', () => {
    const table = makeTable(true);
    const obj = {
      outer: {
        inner: when(isActing, 'deep'),
      },
    };
    const result = unwrapAll(obj, table);
    expect(result.outer.inner).toBe('deep');
  });

  it('preserves functions (does not try to recurse into them)', () => {
    const table = makeTable(true);
    const fn = () => {};
    const obj = { hook: fn };
    const result = unwrapAll(obj, table);
    expect(result.hook).toBe(fn);
  });
});
