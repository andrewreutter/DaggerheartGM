import { describe, it, expect } from 'vitest';
import { LowLightLiving } from '../../../../src/features-v2/communities/Underborne.js';
import { mockTable } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Low-Light Living', () => {
  it('has an advantage trigger for hiding, investigating, or perceiving in dim conditions', () => {
    const table = mockTable();
    const resolved = unwrapAll(LowLightLiving.advantageTriggers, table);
    expect(resolved.some((s) => String(s).includes('hide, investigate, or perceive'))).toBe(true);
  });

  it('does not fire for unrelated narrative triggers', () => {
    const table = mockTable();
    const resolved = unwrapAll(LowLightLiving.advantageTriggers, table);
    expect(resolved.some((s) => String(s).includes('nobles'))).toBe(false);
  });

  it('has the correct SRD name', () => {
    expect(LowLightLiving.name).toBe('Low-Light Living');
  });
});
