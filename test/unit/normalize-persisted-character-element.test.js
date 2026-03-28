import { describe, it, expect } from 'vitest';
import { normalizePersistedCharacterElement } from '../../src/client/lib/normalize-persisted-character-element.js';

describe('normalizePersistedCharacterElement', () => {
  it('migrates legacy featureUsage key Rally-0 to guide key class-Rally-0', () => {
    const el = normalizePersistedCharacterElement({
      elementType: 'character',
      instanceId: 'c1',
      classFeatures: [{ name: 'Rally', description: 'x' }],
      featureUsage: { 'Rally-0': { used: true, cycle: 'session' } },
    });
    expect(el.featureUsage['class-Rally-0']).toEqual({ used: true, cycle: 'session' });
    expect(el.featureUsage['Rally-0']).toBeUndefined();
  });

  it('mirrors focusTargetId and focusTargetInstanceId', () => {
    const a = normalizePersistedCharacterElement({
      elementType: 'character',
      instanceId: 'c1',
      focusTargetId: 'adv-1',
    });
    expect(a.focusTargetInstanceId).toBe('adv-1');
    expect(a.focusTargetId).toBe('adv-1');
  });
});
