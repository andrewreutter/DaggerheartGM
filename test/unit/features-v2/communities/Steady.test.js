import { describe, it, expect } from 'vitest';
import { Steady } from '../../../../src/features-v2/communities/Ridgeborne.js';
import { mockTable } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Steady', () => {
  it('has an advantage trigger for traversing cliffs and harsh environments', () => {
    const table = mockTable();
    const resolved = unwrapAll(Steady.advantageTriggers, table);
    expect(resolved).toContain(
      'rolls to traverse dangerous cliffs and ledges, navigate harsh environments, and use your survival knowledge'
    );
  });

  it('is a purely declarative feature with no chips or hooks', () => {
    expect(Steady.chips).toBeUndefined();
    expect(Steady.hooks).toBeUndefined();
    expect(Steady.passiveStatMods).toBeUndefined();
  });

  it('has the correct name', () => {
    expect(Steady.name).toBe('Steady');
  });
});
