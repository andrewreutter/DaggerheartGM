import { describe, it, expect } from 'vitest';
import {
  loadAdversaryFeatures,
  mergeAdversaryV2Overlay,
} from '../../../../src/features-v2/engine/adversary-feature-loader.js';
import registry from '../../../../src/features-v2/registry.js';

describe('loadAdversaryFeatures', () => {
  it('returns [] for missing or empty features', () => {
    expect(loadAdversaryFeatures(null, registry)).toEqual([]);
    expect(loadAdversaryFeatures({}, registry)).toEqual([]);
    expect(loadAdversaryFeatures({ features: [] }, registry)).toEqual([]);
  });

  it('annotates SRD-only features with adversary scope when no registry template exists', () => {
    const rows = loadAdversaryFeatures(
      {
        id: 'srd-adv-test-bug',
        instanceId: 'adv-i1',
        features: [
          {
            id: 'srd-adv-test-bug-feat-missing',
            name: 'Unit Test Missing Registry Feature XYZZY',
            type: 'action',
            description: 'Not in adversary_features registry.',
          },
        ],
      },
      registry
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Unit Test Missing Registry Feature XYZZY');
    expect(rows[0]._source).toBe('adversary');
    expect(rows[0]._ownerInstanceId).toBe('adv-i1');
    expect(rows[0]._sourceObject).toBeNull();
    expect(rows[0]._sourceScopeKey).toBe(
      'adversary:srd-adv-test-bug:srd-adv-test-bug-feat-missing'
    );
    expect(rows[0]._adversaryId).toBe('srd-adv-test-bug');
  });

  it('merges registry template by feature name and sets linkage fields', () => {
    const TestFeat = {
      name: 'Inventory Test Feature',
      description: 'Registry body',
      chips: [],
    };
    const reg = {
      ...registry,
      adversary_features: {
        [TestFeat.name]: TestFeat,
      },
    };
    const rows = loadAdversaryFeatures(
      {
        id: 'adv-x',
        instanceId: 'inst-1',
        features: [
          {
            id: 'f1',
            name: 'Inventory Test Feature',
            type: 'passive',
            description: 'SRD line overrides for table',
          },
        ],
      },
      reg
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('SRD line overrides for table');
    expect(rows[0]._source).toBe('adversary');
    expect(rows[0]._sourceObject).toBe(TestFeat);
    expect(rows[0]._sourceScopeKey).toBe('adversary_features:Inventory Test Feature');
    expect(rows[0].chips).toEqual([]);
  });

  it('merges Ghost passive with physical resistance from registry overrides', () => {
    const rows = loadAdversaryFeatures(
      {
        id: 'srd-adv-test-ghost',
        instanceId: 'adv-i1',
        features: [
          {
            id: 'f-ghost',
            name: 'Ghost',
            type: 'passive',
            description: 'SRD line',
          },
        ],
      },
      registry
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].damageAffinities?.resistances).toEqual(['physical']);
    expect(rows[0].description).toBe('SRD line');
  });

  it('keeps narrative Horde passive text from generated defaults (no fake mechanics)', () => {
    const rows = loadAdversaryFeatures(
      {
        id: 'srd-adv-test-horde',
        instanceId: 'adv-i1',
        features: [
          {
            id: 'f-h',
            name: 'Horde (1d4+1)',
            type: 'passive',
            description: 'When the Mosquitoes have marked half or more of their HP…',
          },
        ],
      },
      registry
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toContain('Mosquitoes');
    expect(rows[0].damageAffinities).toBeUndefined();
  });

  it('merges Overwhelm reaction via `Name::type` registry key when passive shares the same name', () => {
    const rows = loadAdversaryFeatures(
      {
        id: 'srd-adv-zombie',
        instanceId: 'adv-z',
        features: [
          {
            id: 'f-ov',
            name: 'Overwhelm',
            type: 'reaction',
            description: 'When the Zombies mark HP…',
          },
        ],
      },
      registry
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('reaction');
    expect(rows[0]._sourceObject).toBe(registry.adversary_features['Overwhelm::reaction']);
    expect(rows[0].description).toBe('When the Zombies mark HP…');
  });

  it('includes Terrifying interactive card toggle chips from registry', () => {
    const rows = loadAdversaryFeatures(
      {
        id: 'srd-adv-test',
        instanceId: 'adv-i1',
        features: [
          {
            id: 'f1',
            name: 'Terrifying',
            type: 'passive',
            description: 'When the Knight makes a successful attack…',
          },
        ],
      },
      registry
    );
    expect(rows[0].chips?.length).toBeGreaterThan(0);
    expect(rows[0].chips[0].isToggle).toBe(true);
  });
});

describe('adversary registry barrel', () => {
  it('registry keys match descriptor names (except composite collision keys)', () => {
    for (const [key, row] of Object.entries(registry.adversary_features)) {
      if (key.includes('::')) {
        const [base, suffix] = key.split('::');
        expect(base).toBe(row.name);
        expect(suffix).toBe(row.type);
      } else {
        expect(row.name).toBe(key);
      }
    }
  });
});

describe('mergeAdversaryV2Overlay', () => {
  it('returns activeFeatures + merged featureState without mutating inputs', () => {
    const base = {
      id: 'srd-adv-bear',
      name: 'Bear',
      features: [
        { id: 'f1', name: 'Momentum', type: 'reaction', description: 'When the Bear makes…' },
      ],
    };
    const raw = {
      instanceId: 'table-1',
      featureState: { TestScope: { x: 1 } },
    };
    const merged = mergeAdversaryV2Overlay(base, raw, registry, {});
    expect(merged.instanceId).toBe('table-1');
    expect(merged.featureState).toEqual({ TestScope: { x: 1 } });
    expect(merged.activeFeatures).toHaveLength(1);
    expect(merged.activeFeatures[0].name).toBe('Momentum');
    expect(base.features).toHaveLength(1);
  });
});
