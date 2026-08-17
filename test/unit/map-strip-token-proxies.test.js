import { describe, it, expect } from 'vitest';
import {
  collapseThumbViewportTokenProxies,
  formatThumbTokenProxyLabel,
} from '../../src/client/lib/map-strip-token-proxies.js';

describe('formatThumbTokenProxyLabel', () => {
  it('returns the abbrev alone for a single token', () => {
    expect(formatThumbTokenProxyLabel({ abbrev: 'LA', count: 1 })).toBe('LA');
    expect(formatThumbTokenProxyLabel({ abbrev: 'FE' })).toBe('FE');
  });

  it('appends xN when several of the same type share a chip', () => {
    expect(formatThumbTokenProxyLabel({ abbrev: 'LA', count: 2 })).toBe('LAx2');
    expect(formatThumbTokenProxyLabel({ abbrev: 'JK', count: 5 })).toBe('JKx5');
  });
});

describe('collapseThumbViewportTokenProxies', () => {
  it('returns an empty array for null or empty input', () => {
    expect(collapseThumbViewportTokenProxies(null)).toEqual([]);
    expect(collapseThumbViewportTokenProxies([])).toEqual([]);
  });

  it('keeps characters and companion board tokens as one chip each even with the same abbrev', () => {
    const tokens = [
      { key: 'c1', kind: 'character', abbrev: 'FE', name: 'Fenn' },
      { key: 'c2', kind: 'character', abbrev: 'FE', name: 'Felix' },
      { key: 'b1', kind: 'board', abbrev: 'WO', name: 'Wolf' },
    ];
    const out = collapseThumbViewportTokenProxies(tokens);
    expect(out).toHaveLength(3);
    expect(out.map((t) => formatThumbTokenProxyLabel(t))).toEqual(['FE', 'FE', 'WO']);
  });

  it('collapses two adversaries of the same type into one LAx2 chip instead of two LA markers', () => {
    const tokens = [
      { key: 'a1', kind: 'adversary', typeId: 'srd-adv-lackey', abbrev: 'LA', name: 'Jagged Knife Lackey', defeated: false },
      { key: 'a2', kind: 'adversary', typeId: 'srd-adv-lackey', abbrev: 'LA', name: 'Jagged Knife Lackey', defeated: false },
    ];
    const out = collapseThumbViewportTokenProxies(tokens);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(2);
    expect(formatThumbTokenProxyLabel(out[0])).toBe('LAx2');
  });

  it('does not merge different adversary types that happen to share an abbrev', () => {
    const tokens = [
      { key: 'a1', kind: 'adversary', typeId: 'srd-adv-lackey', abbrev: 'LA', name: 'Lackey' },
      { key: 'a2', kind: 'adversary', typeId: 'srd-adv-lancer', abbrev: 'LA', name: 'Lancer' },
    ];
    const out = collapseThumbViewportTokenProxies(tokens);
    expect(out).toHaveLength(2);
    expect(out.map((t) => formatThumbTokenProxyLabel(t))).toEqual(['LA', 'LA']);
  });

  it('keeps characters separate from same-abbrev adversaries and preserves encounter order', () => {
    const tokens = [
      { key: 'c1', kind: 'character', abbrev: 'FE', name: 'Fenn' },
      { key: 'a1', kind: 'adversary', typeId: 'lackey', abbrev: 'LA', name: 'Lackey' },
      { key: 'c2', kind: 'character', abbrev: 'BR', name: 'Bram' },
      { key: 'a2', kind: 'adversary', typeId: 'lackey', abbrev: 'LA', name: 'Lackey' },
      { key: 'a3', kind: 'adversary', typeId: 'hexer', abbrev: 'HE', name: 'Hexer' },
    ];
    const out = collapseThumbViewportTokenProxies(tokens);
    expect(out.map((t) => formatThumbTokenProxyLabel(t))).toEqual(['FE', 'LAx2', 'BR', 'HE']);
  });

  it('marks a collapsed chip defeated only when every instance of that type is defeated', () => {
    const mixed = collapseThumbViewportTokenProxies([
      { key: 'a1', kind: 'adversary', typeId: 'lackey', abbrev: 'LA', defeated: true },
      { key: 'a2', kind: 'adversary', typeId: 'lackey', abbrev: 'LA', defeated: false },
    ]);
    expect(mixed).toHaveLength(1);
    expect(mixed[0].defeated).toBe(false);

    const allDown = collapseThumbViewportTokenProxies([
      { key: 'a1', kind: 'adversary', typeId: 'lackey', abbrev: 'LA', defeated: true },
      { key: 'a2', kind: 'adversary', typeId: 'lackey', abbrev: 'LA', defeated: true },
    ]);
    expect(allDown[0].defeated).toBe(true);
  });
});
