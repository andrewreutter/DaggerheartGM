import { describe, it, expect, beforeEach } from 'vitest';
import {
  readSavedDiceRolls,
  buildSavedDiceRoll,
  addSavedDiceRoll,
  removeSavedDiceRoll,
} from '../../src/client/lib/saved-dice-rolls.js';

describe('saved-dice-rolls', () => {
  beforeEach(() => {
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
  });

  it('readSavedDiceRolls returns an empty array when nothing is stored', () => {
    expect(readSavedDiceRolls()).toEqual([]);
  });

  it('buildSavedDiceRoll trims the name, defaults to "Roll" when blank, and clones counts', () => {
    const counts = { 6: 2 };
    const entry = buildSavedDiceRoll('  Fireball  ', { dualityOn: true, counts, modifier: 3 });
    expect(entry.name).toBe('Fireball');
    expect(entry.dualityOn).toBe(true);
    expect(entry.counts).toEqual({ 6: 2 });
    expect(entry.counts).not.toBe(counts);
    expect(entry.modifier).toBe(3);
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);

    const blank = buildSavedDiceRoll('   ', { dualityOn: false, counts: {}, modifier: 0 });
    expect(blank.name).toBe('Roll');
  });

  it('buildSavedDiceRoll assigns unique ids to successive entries', () => {
    const a = buildSavedDiceRoll('A', { dualityOn: false, counts: {}, modifier: 0 });
    const b = buildSavedDiceRoll('B', { dualityOn: false, counts: {}, modifier: 0 });
    expect(a.id).not.toBe(b.id);
  });

  it('addSavedDiceRoll appends the entry and persists it for readSavedDiceRolls', () => {
    const entry = buildSavedDiceRoll('Sneak Attack', { dualityOn: false, counts: { 6: 3 }, modifier: 1 });
    const next = addSavedDiceRoll([], entry);
    expect(next).toEqual([entry]);
    expect(readSavedDiceRolls()).toEqual([entry]);
  });

  it('removeSavedDiceRoll drops only the matching id and persists the result', () => {
    const a = buildSavedDiceRoll('A', { dualityOn: false, counts: {}, modifier: 0 });
    const b = buildSavedDiceRoll('B', { dualityOn: false, counts: {}, modifier: 0 });
    const withBoth = addSavedDiceRoll([], a);
    addSavedDiceRoll(withBoth, b);

    const next = removeSavedDiceRoll([a, b], a.id);
    expect(next).toEqual([b]);
    expect(readSavedDiceRolls()).toEqual([b]);
  });

  it('readSavedDiceRolls ignores malformed entries and non-array payloads', () => {
    localStorage.setItem('dh_savedDiceRolls_v1', JSON.stringify('not-an-array'));
    expect(readSavedDiceRolls()).toEqual([]);

    localStorage.setItem('dh_savedDiceRolls_v1', JSON.stringify([{ id: 'x' }, { garbage: true }]));
    expect(readSavedDiceRolls()).toEqual([]);
  });

  it('readSavedDiceRolls returns an empty array on invalid JSON', () => {
    localStorage.setItem('dh_savedDiceRolls_v1', '{not json');
    expect(readSavedDiceRolls()).toEqual([]);
  });
});
