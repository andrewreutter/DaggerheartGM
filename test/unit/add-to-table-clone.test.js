import { describe, it, expect } from 'vitest';
import { shouldCloneOnAddToTable } from '../../src/client/lib/add-to-table-clone.js';

describe('shouldCloneOnAddToTable', () => {
  it('never clones scenes (own, SRD, or public) — place the snapshot only', () => {
    expect(shouldCloneOnAddToTable('scenes', { id: 'mine', _source: 'own' })).toBe(false);
    expect(shouldCloneOnAddToTable('scenes', { id: 'srd-scene-abandoned-grove', _source: 'srd' })).toBe(false);
    expect(shouldCloneOnAddToTable('scenes', { id: 'pub', _source: 'public' })).toBe(false);
    expect(shouldCloneOnAddToTable('scenes', { id: 'legacy-own' })).toBe(false);
  });

  it('still clone-on-play for non-own adversaries and environments', () => {
    expect(shouldCloneOnAddToTable('adversaries', { id: 'srd-adv-bear', _source: 'srd' })).toBe(true);
    expect(shouldCloneOnAddToTable('environments', { id: 'srd-env-chaos-realm', _source: 'srd' })).toBe(true);
    expect(shouldCloneOnAddToTable('environments', { id: 'pub', _source: 'public' })).toBe(true);
  });

  it('does not clone own adversaries or environments', () => {
    expect(shouldCloneOnAddToTable('adversaries', { id: 'mine', _source: 'own' })).toBe(false);
    expect(shouldCloneOnAddToTable('environments', { id: 'mine' })).toBe(false);
  });

  it('does not clone other collections (notes, characters, adventures)', () => {
    expect(shouldCloneOnAddToTable('notes', { id: 'n1', _source: 'srd' })).toBe(false);
    expect(shouldCloneOnAddToTable('characters', { id: 'c1', _source: 'public' })).toBe(false);
    expect(shouldCloneOnAddToTable('adventures', { id: 'a1', _source: 'srd' })).toBe(false);
  });
});
