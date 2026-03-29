import { describe, it, expect } from 'vitest';
import {
  buildCompactAdversaryAiCatalog,
  buildCompactEnvironmentAiCatalog,
} from '../../src/encounter-ai-catalog.js';

describe('encounter-ai-catalog axis scoping', () => {
  it('scopes adversary catalog to focus tier×role', () => {
    const full = buildCompactAdversaryAiCatalog([]);
    const scoped = buildCompactAdversaryAiCatalog([], { focusTier: 2, focusRole: 'bruiser' });
    expect(Object.keys(full.examplesByTierRole).length).toBeGreaterThan(1);
    expect(Object.keys(scoped.examplesByTierRole)).toEqual(['2:bruiser']);
    expect(scoped.axes.tiers).toEqual([2]);
    expect(scoped.axes.roles).toEqual(['bruiser']);
  });

  it('scopes environment catalog to focus tier×type', () => {
    const full = buildCompactEnvironmentAiCatalog([]);
    const scoped = buildCompactEnvironmentAiCatalog([], { focusTier: 3, focusType: 'social' });
    expect(Object.keys(full.examplesByTierType).length).toBeGreaterThan(1);
    expect(Object.keys(scoped.examplesByTierType)).toEqual(['3:social']);
    expect(scoped.axes.tiers).toEqual([3]);
    expect(scoped.axes.types).toEqual(['social']);
  });
});
