import { describe, it, expect } from 'vitest';
import { WellRead } from '../../../../src/features-v2/communities/Loreborne.js';
import { mockTable } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Well-Read', () => {
  it('has an advantage trigger for history, culture, and politics rolls', () => {
    const table = mockTable();
    const resolved = unwrapAll(WellRead.advantageTriggers, table);
    expect(resolved).toContain(
      'rolls that involve the history, culture, or politics of a prominent person or place'
    );
  });

  it('is a purely declarative feature with no chips or hooks', () => {
    expect(WellRead.chips).toBeUndefined();
    expect(WellRead.hooks).toBeUndefined();
    expect(WellRead.passiveStatMods).toBeUndefined();
  });

  it('has the correct name', () => {
    expect(WellRead.name).toBe('Well-Read');
  });
});
