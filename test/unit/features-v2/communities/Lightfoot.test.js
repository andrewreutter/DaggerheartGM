import { describe, it, expect } from 'vitest';
import { Lightfoot } from '../../../../src/features-v2/communities/Wildborne.js';
import { mockTable } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Lightfoot', () => {
  it('has an advantage trigger for moving silently', () => {
    const table = mockTable();
    const resolved = unwrapAll(Lightfoot.advantageTriggers, table);
    expect(resolved).toContain('rolls to move without being heard');
  });

  it('does not include climbing-focused triggers', () => {
    const table = mockTable();
    const resolved = unwrapAll(Lightfoot.advantageTriggers, table);
    expect(resolved.some((s) => String(s).includes('climb'))).toBe(false);
  });

  it('has the correct SRD name', () => {
    expect(Lightfoot.name).toBe('Lightfoot');
  });
});
