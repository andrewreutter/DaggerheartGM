import { describe, it, expect } from 'vitest';
import {
  getFeatureUsageKeyForGuideFeature,
  getDisplayLabelForFeatureUsageKey,
} from '../../src/client/lib/feature-usage-key.js';

describe('feature-usage-key', () => {
  it('class feature without id matches Guide class-Rally-0', () => {
    const el = {
      classFeatures: [{ name: 'Rally', description: 'x' }],
      activeFeatures: [],
    };
    expect(getFeatureUsageKeyForGuideFeature(el, 'Rally')).toBe('class-Rally-0');
  });

  it('class feature with stable id uses id as key', () => {
    const el = {
      classFeatures: [{ id: 'srd-class-rally', name: 'Rally', description: 'x' }],
      activeFeatures: [],
    };
    expect(getFeatureUsageKeyForGuideFeature(el, 'Rally')).toBe('srd-class-rally');
  });

  it('domain ability uses ability- prefix', () => {
    const el = {
      classFeatures: [],
      abilities: [{ id: 'srd-abl-healing-field', name: 'Healing Field' }],
      activeFeatures: [],
    };
    expect(getFeatureUsageKeyForGuideFeature(el, 'Healing Field')).toBe('ability-srd-abl-healing-field');
  });

  it('ability without id uses ability-{index}', () => {
    const el = {
      abilities: [{ name: 'Test Spell' }],
      activeFeatures: [],
    };
    expect(getFeatureUsageKeyForGuideFeature(el, 'Test Spell')).toBe('ability-0');
  });

  it('returns null when the name is not on the character', () => {
    const el = {
      classFeatures: [{ name: 'Rally', description: 'x' }],
      activeFeatures: [],
    };
    expect(getFeatureUsageKeyForGuideFeature(el, 'Unknown Feature')).toBe(null);
  });

  describe('getDisplayLabelForFeatureUsageKey', () => {
    it('resolves class guide keys to feature names', () => {
      const el = {
        classFeatures: [{ name: 'Rally', description: 'x' }],
        activeFeatures: [],
      };
      expect(getDisplayLabelForFeatureUsageKey(el, 'class-Rally-0')).toBe('Rally');
    });

    it('resolves stable class ids to names', () => {
      const el = {
        classFeatures: [{ id: 'srd-class-rally', name: 'Rally', description: 'x' }],
        activeFeatures: [],
      };
      expect(getDisplayLabelForFeatureUsageKey(el, 'srd-class-rally')).toBe('Rally');
    });

    it('resolves ability- keys to spell names', () => {
      const el = {
        abilities: [{ id: 'srd-abl-healing-field', name: 'Healing Field' }],
        activeFeatures: [],
      };
      expect(getDisplayLabelForFeatureUsageKey(el, 'ability-srd-abl-healing-field')).toBe('Healing Field');
    });
  });
});
