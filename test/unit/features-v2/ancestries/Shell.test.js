import { describe, it, expect } from 'vitest';
import { Shell } from '../../../../src/features-v2/ancestries/Galapa.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { mockTable, mockCharacter } from '../helpers.js';

describe('Shell', () => {
  it('exports name and SRD description', () => {
    expect(Shell.name).toBe('Shell');
    expect(Shell.description).toBe(
      'Gain a bonus to your damage thresholds equal to your Proficiency.'
    );
  });

  it('declares passiveStatMods for majorThreshold and severeThreshold', () => {
    expect(Shell.passiveStatMods).toBeDefined();
    expect(typeof Shell.passiveStatMods.majorThreshold).toBe('function');
    expect(typeof Shell.passiveStatMods.severeThreshold).toBe('function');
  });

  it('adds proficiency (default 1) to both thresholds when proficiency is not set', () => {
    const char = mockCharacter({ instanceId: 'c1', armorThresholds: { major: 7, severe: 12 } });
    const table = mockTable({ activeElements: [char], _ownerInstanceId: 'c1' });
    const annotatedFeature = { ...Shell, _ownerInstanceId: 'c1' };

    const result = applyDeclarativeFeatures([annotatedFeature], char, table);

    expect(result.stats.majorThreshold).toBe(8);   // 7 + 1
    expect(result.stats.severeThreshold).toBe(13);  // 12 + 1
  });

  it('adds proficiency (2) to both thresholds when character has proficiency 2', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      proficiency: 2,
      armorThresholds: { major: 7, severe: 12 },
    });
    const table = mockTable({ activeElements: [char], _ownerInstanceId: 'c1' });
    const annotatedFeature = { ...Shell, _ownerInstanceId: 'c1' };

    const result = applyDeclarativeFeatures([annotatedFeature], char, table);

    expect(result.stats.majorThreshold).toBe(9);   // 7 + 2
    expect(result.stats.severeThreshold).toBe(14);  // 12 + 2
  });
});
