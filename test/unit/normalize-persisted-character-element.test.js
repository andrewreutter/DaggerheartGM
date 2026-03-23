import { describe, it, expect } from 'vitest';
import { normalizePersistedCharacterElement } from '../../src/client/lib/normalize-persisted-character-element.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../src/features-v2/engine/feature-scope-keys.js';

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

  it('migrates Beastform bag into Druid scoped featureState', () => {
    const el = normalizePersistedCharacterElement({
      elementType: 'character',
      instanceId: 'd1',
      featureState: {
        Beastform: { activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false } },
      },
    });
    expect(el.featureState.Beastform).toBeUndefined();
    expect(el.featureState[SRD_CLASS_DRUID_SCOPE_KEY].activeBeastform.beastformId).toBe('srd-bst-agile-scout');
  });

  it('migrates legacy activeChanneledElement into WardenOfTheElements featureState', () => {
    const el = normalizePersistedCharacterElement({
      elementType: 'character',
      instanceId: 'c1',
      activeChanneledElement: 'earth',
    });
    expect(el.featureState.WardenOfTheElements.channeledElement).toBe('earth');
    expect(el.activeChanneledElement).toBeUndefined();
  });

  it('migrates flat consumable key to scoped bag', () => {
    const el = normalizePersistedCharacterElement({
      elementType: 'character',
      instanceId: 'c1',
      featureState: {
        'Hopehold Flare': { active: true, activatorInstanceId: 'c1' },
      },
    });
    expect(el.featureState['Hopehold Flare']).toBeUndefined();
    expect(el.featureState['consumables:srd-cns-hopehold-flare'].active).toBe(true);
  });
});
