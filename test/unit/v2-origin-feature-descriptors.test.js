import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  v2OriginFeatureDescriptorsByName,
  getV2OriginFeatureDescriptor,
} from '../../src/client/lib/v2-origin-feature-descriptors.js';
import { getAncestryExperienceBonus } from '../../src/client/lib/ancestry-experience-bonus.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('v2-origin-feature-descriptors', () => {
  it('indexes V2 ancestry features by display name', () => {
    expect(getV2OriginFeatureDescriptor('Purposeful Design')?.name).toBe('Purposeful Design');
    expect(v2OriginFeatureDescriptorsByName['Thick Skin']?.name).toBe('Thick Skin');
  });

  it('indexes V2 community features by display name', () => {
    expect(getV2OriginFeatureDescriptor('Privilege')?.name).toBe('Privilege');
  });

  it('does not import legacy features/registry paths', () => {
    const src = readFileSync(join(__dirname, '../../src/client/lib/v2-origin-feature-descriptors.js'), 'utf8');
    expect(src).not.toMatch(/features\/registry/);
    expect(src).not.toMatch(/\.\.\/\.\.\/features\/ancestries/);
  });
});

describe('ancestry-experience-bonus', () => {
  it('matches Clank Purposeful Design (+1 experience pick)', () => {
    expect(getAncestryExperienceBonus('Clank')).toEqual({
      amount: 1,
      featureName: 'Purposeful Design',
    });
    expect(getAncestryExperienceBonus('Human')).toBeNull();
  });
});
