/**
 * Unit tests for the Feature IoC infrastructure (Phase 1).
 * Covers: wrapEntity, runHook, runPipelineHook, and the five Phase-1 feature files.
 */
import { describe, it, expect, vi } from 'vitest';
import { wrapEntity } from '../../src/features/entity.js';
import { runHook, runPipelineHook } from '../../src/features/hooks.js';
import Painful      from '../../src/features/weapons/Painful.js';
import Invigorating from '../../src/features/weapons/Invigorating.js';
import Lifestealing from '../../src/features/weapons/Lifestealing.js';
import Charged      from '../../src/features/weapons/Charged.js';
import Startling    from '../../src/features/weapons/Startling.js';

// ── wrapEntity ────────────────────────────────────────────────────────────────

describe('wrapEntity', () => {
  function makeEl(overrides = {}) {
    return {
      instanceId: 'el-1',
      name: 'Asha',
      currentStress: 2, maxStress: 6,
      currentHp: 8,     maxHp: 10,
      hope: 3,          maxHope: 6,
      currentArmor: 0,  maxArmor: 3,
      ...overrides,
    };
  }

  it('exposes readable properties from the raw element', () => {
    const update = vi.fn();
    const e = wrapEntity(makeEl(), update);
    expect(e.instanceId).toBe('el-1');
    expect(e.name).toBe('Asha');
    expect(e.currentStress).toBe(2);
    expect(e.maxStress).toBe(6);
    expect(e.currentHp).toBe(8);
    expect(e.maxHp).toBe(10);
    expect(e.hope).toBe(3);
    expect(e.maxHope).toBe(6);
    expect(e.currentArmor).toBe(0);
    expect(e.maxArmor).toBe(3);
  });

  it('markStress calls updateActiveElement with clamped value', () => {
    const update = vi.fn();
    const e = wrapEntity(makeEl({ currentStress: 5, maxStress: 6 }), update);
    e.markStress(2); // would go to 7; clamps to 6
    expect(update).toHaveBeenCalledWith('el-1', { currentStress: 6 });
    expect(e.currentStress).toBe(6);
  });

  it('clearStress calls updateActiveElement with clamped value', () => {
    const update = vi.fn();
    const e = wrapEntity(makeEl({ currentStress: 1 }), update);
    e.clearStress(3); // would go to -2; clamps to 0
    expect(update).toHaveBeenCalledWith('el-1', { currentStress: 0 });
    expect(e.currentStress).toBe(0);
  });

  it('clearHp restores HP up to maxHp', () => {
    const update = vi.fn();
    const e = wrapEntity(makeEl({ currentHp: 9, maxHp: 10 }), update);
    e.clearHp(3); // would go to 12; clamps to 10
    expect(update).toHaveBeenCalledWith('el-1', { currentHp: 10 });
  });

  it('markHp reduces HP, clamped at 0', () => {
    const update = vi.fn();
    const e = wrapEntity(makeEl({ currentHp: 1 }), update);
    e.markHp(5);
    expect(update).toHaveBeenCalledWith('el-1', { currentHp: 0 });
  });

  it('spendHope reduces Hope, clamped at 0', () => {
    const update = vi.fn();
    const e = wrapEntity(makeEl({ hope: 2 }), update);
    e.spendHope(5);
    expect(update).toHaveBeenCalledWith('el-1', { hope: 0 });
  });

  it('chained mutations accumulate correctly in snapshot', () => {
    const update = vi.fn();
    const e = wrapEntity(makeEl({ currentStress: 0, maxStress: 6 }), update);
    e.markStress(1);
    e.markStress(1);
    // Both calls should use the updated snapshot value
    expect(e.currentStress).toBe(2);
    expect(update).toHaveBeenNthCalledWith(1, 'el-1', { currentStress: 1 });
    expect(update).toHaveBeenNthCalledWith(2, 'el-1', { currentStress: 2 });
  });

  it('returns null when el is null', () => {
    expect(wrapEntity(null, vi.fn())).toBeNull();
  });

  it('uses sensible defaults when fields are undefined', () => {
    const update = vi.fn();
    const e = wrapEntity({ instanceId: 'x' }, update);
    expect(e.currentStress).toBe(0);
    expect(e.maxStress).toBe(6);
    expect(e.currentHp).toBe(0);
    expect(e.maxHp).toBe(0);
  });
});

// ── runHook ───────────────────────────────────────────────────────────────────

describe('runHook', () => {
  it('calls the named hook on each matching feature', () => {
    const hookA = vi.fn();
    const hookB = vi.fn();
    const map = {
      FeatureA: { name: 'FeatureA', myHook: hookA },
      FeatureB: { name: 'FeatureB', myHook: hookB },
    };
    const ctx = { roll: {} };
    runHook(map, new Set(['FeatureA', 'FeatureB']), 'myHook', ctx);
    expect(hookA).toHaveBeenCalledWith(ctx);
    expect(hookB).toHaveBeenCalledWith(ctx);
  });

  it('skips features not in tagNames', () => {
    const hook = vi.fn();
    const map = { Foo: { name: 'Foo', myHook: hook } };
    runHook(map, new Set(['Bar']), 'myHook', {});
    expect(hook).not.toHaveBeenCalled();
  });

  it('skips features that do not implement the hook', () => {
    const map = { Foo: { name: 'Foo' } }; // no myHook
    expect(() => runHook(map, new Set(['Foo']), 'myHook', {})).not.toThrow();
  });

  it('accepts arrays as well as Sets for tagNames', () => {
    const hook = vi.fn();
    const map = { X: { name: 'X', h: hook } };
    runHook(map, ['X'], 'h', {});
    expect(hook).toHaveBeenCalled();
  });

  it('swallows errors from individual hooks and continues', () => {
    const good = vi.fn();
    const map = {
      Bad:  { name: 'Bad',  hook: () => { throw new Error('boom'); } },
      Good: { name: 'Good', hook: good },
    };
    expect(() => runHook(map, new Set(['Bad', 'Good']), 'hook', {})).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});

// ── runPipelineHook ───────────────────────────────────────────────────────────

describe('runPipelineHook', () => {
  it('passes value through chain and returns final result', () => {
    const map = {
      AddOne: { name: 'AddOne', transform: (v) => v + 1 },
      Double: { name: 'Double', transform: (v) => v * 2 },
    };
    const result = runPipelineHook(map, ['AddOne', 'Double'], 'transform', 3, {});
    expect(result).toBe(8); // (3+1)*2
  });

  it('respects priority ordering', () => {
    const order = [];
    const map = {
      High: { name: 'High', priority: 10, xform: (v) => { order.push('High'); return v; } },
      Low:  { name: 'Low',  priority: 90, xform: (v) => { order.push('Low');  return v; } },
    };
    runPipelineHook(map, ['Low', 'High'], 'xform', 0, {});
    expect(order).toEqual(['High', 'Low']);
  });

  it('returns initialValue when no features match', () => {
    const result = runPipelineHook({}, [], 'transform', 42, {});
    expect(result).toBe(42);
  });

  it('keeps previous value when a feature returns undefined', () => {
    const map = { Noop: { name: 'Noop', xform: () => undefined } };
    const result = runPipelineHook(map, ['Noop'], 'xform', 7, {});
    expect(result).toBe(7);
  });
});

// ── Feature files ─────────────────────────────────────────────────────────────

describe('Painful feature', () => {
  it('marks 1 Stress on attacker', () => {
    const attacker = { markStress: vi.fn() };
    Painful.onRollComplete({ attacker, roll: { _action: false } });
    expect(attacker.markStress).toHaveBeenCalledWith(1);
  });

  it('does not throw when attacker is null', () => {
    expect(() => Painful.onRollComplete({ attacker: null, roll: {} })).not.toThrow();
  });
});

describe('Invigorating feature', () => {
  it('clears 1 Stress when Invigorate die is 4', () => {
    const attacker = { clearStress: vi.fn() };
    const roll = { subItems: [{ pre: 'Invigorate', result: '4' }] };
    Invigorating.onRollComplete({ attacker, roll });
    expect(attacker.clearStress).toHaveBeenCalledWith(1);
  });

  it('does nothing when Invigorate die is not 4', () => {
    const attacker = { clearStress: vi.fn() };
    const roll = { subItems: [{ pre: 'Invigorate', result: '3' }] };
    Invigorating.onRollComplete({ attacker, roll });
    expect(attacker.clearStress).not.toHaveBeenCalled();
  });

  it('does nothing when no Invigorate sub-item', () => {
    const attacker = { clearStress: vi.fn() };
    Invigorating.onRollComplete({ attacker, roll: { subItems: [] } });
    expect(attacker.clearStress).not.toHaveBeenCalled();
  });
});

describe('Lifestealing feature', () => {
  it('clears 1 HP when Lifesteal die is 6', () => {
    const attacker = { clearHp: vi.fn() };
    const roll = { subItems: [{ pre: 'Lifesteal', result: '6' }] };
    Lifestealing.onRollComplete({ attacker, roll });
    expect(attacker.clearHp).toHaveBeenCalledWith(1);
  });

  it('does nothing when Lifesteal die is not 6', () => {
    const attacker = { clearHp: vi.fn() };
    const roll = { subItems: [{ pre: 'Lifesteal', result: '5' }] };
    Lifestealing.onRollComplete({ attacker, roll });
    expect(attacker.clearHp).not.toHaveBeenCalled();
  });
});

describe('Charged feature', () => {
  it('marks 1 Stress on attacker', () => {
    const attacker = { markStress: vi.fn() };
    Charged.onRollComplete({ attacker, roll: {} });
    expect(attacker.markStress).toHaveBeenCalledWith(1);
  });
});

describe('Startling feature', () => {
  it('marks 1 Stress when roll is an action notification', () => {
    const attacker = { markStress: vi.fn() };
    Startling.onRollComplete({ attacker, roll: { _action: true } });
    expect(attacker.markStress).toHaveBeenCalledWith(1);
  });

  it('does nothing when roll is not an action notification', () => {
    const attacker = { markStress: vi.fn() };
    Startling.onRollComplete({ attacker, roll: { _action: false } });
    expect(attacker.markStress).not.toHaveBeenCalled();
  });
});
