import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../../../src/features-v2/engine/feature-scope-keys.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

function druidScoped(fs) {
  return { [SRD_CLASS_DRUID_SCOPE_KEY]: fs };
}

describe('beastform sub-features via applyDeclarativeFeatures (virtualSources)', () => {
  it('includes Agile + Fragile when Agile Scout is active', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      featureState: druidScoped({
        activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
      }),
    });
    const druid = raw;
    const base = loadCharacterFeatures(druid, registry);
    const decl = applyDeclarativeFeatures(base, druid, {}, registry);
    const beast = decl.mergedFeatures.filter((f) => f._source === 'beastform');
    expect(beast.map((f) => f.name).sort()).toEqual(['Agile', 'Fragile']);
    expect(
      beast.every(
        (f) => f._beastformId === 'srd-bst-agile-scout' && f._ownerInstanceId === 'd1'
      )
    ).toBe(true);
    expect(
      decl.advantageTriggers.filter((t) => String(t).startsWith('rolls to '))
    ).toEqual(['rolls to deceive', 'rolls to locate', 'rolls to sneak']);
  });

  it('includes Evolution active beastform sub-features', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      featureState: druidScoped({
        activeBeastform: { beastformId: 'srd-bst-pack-predator', viaEvolution: true },
      }),
    });
    const druid = raw;
    const base = loadCharacterFeatures(druid, registry);
    const decl = applyDeclarativeFeatures(base, druid, {}, registry);
    const beast = decl.mergedFeatures.filter((f) => f._source === 'beastform');
    expect(beast.map((f) => f.name).sort()).toEqual(['Hobbling Strike', 'Pack Hunting']);
  });

  it('does not attach beastform features when no form is active', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      featureState: druidScoped({}),
    });
    const druid = raw;
    const base = loadCharacterFeatures(druid, registry);
    const decl = applyDeclarativeFeatures(base, druid, {}, registry);
    expect(decl.mergedFeatures.some((f) => f._source === 'beastform')).toBe(false);
    expect(decl.virtualFeaturesExpanded.length).toBe(0);
  });

  it('applies Thick Hide +2 major/severe thresholds when Powerful Beast is active', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 2,
      armorThresholds: { major: 7, severe: 12 },
      featureState: druidScoped({
        activeBeastform: { beastformId: 'srd-bst-powerful-beast', viaEvolution: false },
      }),
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const { stats } = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(stats.majorThreshold).toBe(9); // 7 + 2 (Thick Hide)
    expect(stats.severeThreshold).toBe(14); // 12 + 2 (Thick Hide)
  });

  it('applies Hollow Bones -2 major/severe thresholds when Winged Beast is active', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 2,
      armorThresholds: { major: 7, severe: 12 },
      featureState: druidScoped({
        activeBeastform: { beastformId: 'srd-bst-winged-beast', viaEvolution: false },
      }),
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const { stats } = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(stats.majorThreshold).toBe(5); // 7 - 2 (Hollow Bones)
    expect(stats.severeThreshold).toBe(10); // 12 - 2 (Hollow Bones)
  });

  it('applies Physical Defense +3 major/severe thresholds when Mighty Lizard is active', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 2,
      armorThresholds: { major: 4, severe: 9 },
      featureState: druidScoped({
        activeBeastform: { beastformId: 'srd-bst-mighty-lizard', viaEvolution: false },
      }),
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const { stats } = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(stats.majorThreshold).toBe(7); // 4 + 3 (Physical Defense)
    expect(stats.severeThreshold).toBe(12); // 9 + 3 (Physical Defense)
  });

  it('applies Evolved +2 Evasion when Legendary Beast is active', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 5,
      evasion: 12,
      featureState: druidScoped({
        activeBeastform: { beastformId: 'srd-bst-legendary-beast', viaEvolution: false },
      }),
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const { stats } = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(stats.evasion).toBe(14); // 12 + 2 (Evolved)
  });
});
