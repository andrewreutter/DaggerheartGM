import { describe, it, expect } from 'vitest';
import { Privilege } from '../../../../src/features-v2/communities/Highborne.js';
import { mockTable } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Privilege', () => {
  it('has an advantage trigger for consorting with nobles and negotiating', () => {
    const table = mockTable();
    const resolved = unwrapAll(Privilege.advantageTriggers, table);
    expect(resolved).toContain(
      'rolls to consort with nobles, negotiate prices, or leverage your reputation to get what you want'
    );
  });

  it('is a purely declarative feature with no chips or hooks', () => {
    expect(Privilege.chips).toBeUndefined();
    expect(Privilege.hooks).toBeUndefined();
    expect(Privilege.passiveStatMods).toBeUndefined();
  });

  it('has the correct name', () => {
    expect(Privilege.name).toBe('Privilege');
  });
});
