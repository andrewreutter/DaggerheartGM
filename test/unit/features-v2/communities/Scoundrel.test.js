import { describe, it, expect } from 'vitest';
import { Scoundrel } from '../../../../src/features-v2/communities/Slyborne.js';
import { mockTable } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';

describe('Scoundrel', () => {
  it('exposes an advantage trigger for criminal negotiation, lies, and hiding', () => {
    const table = mockTable();
    const resolved = unwrapAll(Scoundrel.advantageTriggers, table);
    expect(resolved).toContain(
      'rolls to negotiate with criminals, detect lies, or find a safe place to hide'
    );
  });

  it('does not claim unrelated advantage situations', () => {
    const table = mockTable();
    const resolved = unwrapAll(Scoundrel.advantageTriggers, table);
    expect(resolved.some((s) => String(s).includes('balancing'))).toBe(false);
  });

  it('accumulates advantageTriggers via applyDeclarativeFeatures', () => {
    const char = { traits: {} };
    const { advantageTriggers } = applyDeclarativeFeatures([{ ...Scoundrel, _ownerInstanceId: 'c1' }], char, {});
    expect(advantageTriggers.some((t) => t.includes('criminals'))).toBe(true);
  });

  it('has the correct SRD name', () => {
    expect(Scoundrel.name).toBe('Scoundrel');
  });
});
