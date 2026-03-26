import { describe, it, expect } from 'vitest';
import {
  restCyclesToClear,
  computeRestBannerRefreshPreview,
} from '../../src/client/lib/rest-banner-refresh-preview.js';

describe('rest-banner-refresh-preview', () => {
  it('restCyclesToClear matches GMTableView short vs long rest', () => {
    expect(restCyclesToClear('short')).toEqual(['rest']);
    expect(restCyclesToClear('long')).toEqual(['rest', 'longRest']);
  });

  it('lists featureUsage keys and modifiers that will clear on short rest', () => {
    const characterEl = {
      instanceId: 'a',
      featureUsage: {
        Rally: { used: true, cycle: 'rest' },
        Kick: { used: true, cycle: 'longRest' },
      },
      activeModifiers: [{ id: 'm1', name: 'Test Buff', refreshOn: 'rest' }],
    };
    const mergedCharacterEl = { instanceId: 'a', classFeatures: [], subclassFeatures: [], ancestryFeatures: [], communityFeatures: [] };
    const r = computeRestBannerRefreshPreview({
      characterEl,
      mergedCharacterEl,
      activeElements: [characterEl],
      registry: {},
      restDuration: 'short',
    });
    expect(r.resetting.usageLabels).toEqual(['Rally']);
    expect(r.resetting.modifierLabels).toEqual(['Test Buff']);
  });

  it('long rest clears both rest and longRest usage entries', () => {
    const characterEl = {
      instanceId: 'a',
      featureUsage: {
        Rally: { used: true, cycle: 'rest' },
        Kick: { used: true, cycle: 'longRest' },
      },
    };
    const mergedCharacterEl = { instanceId: 'a', classFeatures: [], subclassFeatures: [], ancestryFeatures: [], communityFeatures: [] };
    const r = computeRestBannerRefreshPreview({
      characterEl,
      mergedCharacterEl,
      activeElements: [characterEl],
      registry: {},
      restDuration: 'long',
    });
    expect(r.resetting.usageLabels.sort()).toEqual(['Kick', 'Rally']);
  });

  it('notes Shifting and consumable rest bonus when applicable', () => {
    const characterEl = {
      instanceId: 'a',
      disadvantageSources: ['Shifting'],
      featureState: { 'consumables:PotionOfStability': { restBonusActive: true } },
    };
    const mergedCharacterEl = { instanceId: 'a', classFeatures: [], subclassFeatures: [], ancestryFeatures: [], communityFeatures: [] };
    const r = computeRestBannerRefreshPreview({
      characterEl,
      mergedCharacterEl,
      activeElements: [characterEl],
      registry: {},
      restDuration: 'short',
    });
    expect(r.resetting.notes).toContain('Shifting (clears disadvantage)');
    expect(r.resetting.notes.some((n) => n.includes('consumable'))).toBe(true);
  });
});
