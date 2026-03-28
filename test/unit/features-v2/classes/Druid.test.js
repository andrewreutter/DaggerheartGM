import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../../../src/features-v2/engine/feature-scope-keys.js';
import {
  collectChips,
  activateChip,
  makeChipState,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { dispatchStateChangeHooks } from '../../../../src/features-v2/engine/action-loop.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

function featureByName(druid, name) {
  const feats = loadCharacterFeatures(druid, registry);
  const f = feats.find((x) => x.name === name);
  if (!f) throw new Error(`Missing feature ${name}`);
  return f;
}

function buildDruidTable(druid, featureName, overrides = {}) {
  const feat = featureByName(druid, featureName);
  return buildTableSnapshot(
    mockGameState({
      registry,
      activeElements: [druid],
      _ownerInstanceId: druid.instanceId,
      _featureKey: featureName,
      _activeFeature: feat,
      action: {
        type: 'free',
        actorInstanceId: druid.instanceId,
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      ...overrides,
    })
  );
}

describe('Druid — Beastform', () => {
  it('card chip sets activeBeastform and spends Stress', () => {
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1 });
    const druid = raw;

    const table = buildDruidTable(druid, 'Beastform', {
      featureState: { [SRD_CLASS_DRUID_SCOPE_KEY]: {} },
    });

    const chips = collectChips([featureByName(druid, 'Beastform')], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);

    const fromUse = activateChip(
      chips[0],
      table,
      makeChipState(),
      { selectedId: 'srd-bst-agile-scout' }
    );
    deductChipCosts(chips[0], table);
    const fromCost = applyMutations(table);
    const mutations = [...fromUse, ...fromCost];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: SRD_CLASS_DRUID_SCOPE_KEY,
          key: 'activeBeastform',
          value: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: { instanceId: 'd1', amount: 1 },
      })
    );
  });

  it('Beastform select chip stays visible alongside Drop out while in beastform', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      activeBeastform: { id: 'srd-bst-agile-scout', name: 'Agile Scout' },
    });
    const druid = raw;
    const table = buildDruidTable(druid, 'Beastform', {
      featureState: { [SRD_CLASS_DRUID_SCOPE_KEY]: {} },
    });
    const chips = collectChips([featureByName(druid, 'Beastform')], 'card', table);
    expect(chips.map((c) => c.name)).toEqual(['Beastform', 'Drop out of Agile Scout Beastform']);
    expect(chips.every((c) => c.disabled === false)).toBe(true);
  });

  it('Beastform onUse clears evolutionTraitKey when switching from Evolution path', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      featureState: {
        [SRD_CLASS_DRUID_SCOPE_KEY]: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: true },
          evolutionTraitKey: 'agility',
        },
      },
    });
    const druid = raw;
    const table = buildDruidTable(druid, 'Beastform', {
      featureState: druid.featureState,
    });
    const chips = collectChips([featureByName(druid, 'Beastform')], 'card', table);
    const transform = chips.find((c) => c.name === 'Beastform');
    const fromUse = activateChip(transform, table, makeChipState(), { selectedId: 'srd-bst-pack-predator' });
    const mutations = [...fromUse];
    expect(
      mutations.some(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload?.featureKey === SRD_CLASS_DRUID_SCOPE_KEY &&
          m.payload?.key === 'evolutionTraitKey' &&
          m.payload?.value === null
      )
    ).toBe(true);
    expect(
      mutations.some(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload?.featureKey === SRD_CLASS_DRUID_SCOPE_KEY &&
          m.payload?.key === 'activeBeastform' &&
          m.payload?.value?.beastformId === 'srd-bst-pack-predator'
      )
    ).toBe(true);
  });
});

describe('Druid — Drop out of Beastform (Beastform card chip)', () => {
  it('card chip clears scoped beastform state via setFeatureState (client clears legacy element mirror)', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      featureState: {
        [SRD_CLASS_DRUID_SCOPE_KEY]: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
          evolutionTraitKey: 'agility',
        },
      },
    });
    const druid = raw;
    const table = buildDruidTable(druid, 'Beastform', {
      featureState: druid.featureState,
    });

    const chips = collectChips([featureByName(druid, 'Beastform')], 'card', table);
    const drop = chips.find((c) => c.name === 'Drop out of Agile Scout Beastform');
    expect(drop).toBeDefined();
    expect(drop.disabled).toBe(false);

    const fromUse = activateChip(drop, table, makeChipState(), {});
    const mutations = [...fromUse];

    expect(
      mutations.filter(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload?.featureKey === SRD_CLASS_DRUID_SCOPE_KEY &&
          m.payload?.value === null
      ).length
    ).toBeGreaterThanOrEqual(1);
    expect(mutations.some((m) => m.type === 'clearBeastformRuntime')).toBe(false);
  });

  it('Drop out chip is omitted when not in beastform', () => {
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1 });
    const druid = raw;
    const table = buildDruidTable(druid, 'Beastform', {
      featureState: {},
    });
    const chips = collectChips([featureByName(druid, 'Beastform')], 'card', table);
    expect(chips.map((c) => c.name)).toEqual(['Beastform']);
  });
});

describe('Druid — Evolution', () => {
  it('card chip sets activeBeastform via Evolution and spends Hope', () => {
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1, hope: 5 });
    const druid = raw;

    const table = buildDruidTable(druid, 'Evolution', {
      featureState: { [SRD_CLASS_DRUID_SCOPE_KEY]: {} },
    });

    const chips = collectChips([featureByName(druid, 'Evolution')], 'card', table);
    expect(chips[0].hopeCost).toBe(3);

    const fromUse = activateChip(
      chips[0],
      table,
      makeChipState(),
      { selectedId: 'srd-bst-agile-scout', evolutionTraitKey: 'agility' }
    );
    deductChipCosts(chips[0], table);
    const fromCost = applyMutations(table);
    const mutations = [...fromUse, ...fromCost];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: SRD_CLASS_DRUID_SCOPE_KEY,
          key: 'activeBeastform',
          value: { beastformId: 'srd-bst-agile-scout', viaEvolution: true },
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: SRD_CLASS_DRUID_SCOPE_KEY,
          key: 'evolutionTraitKey',
          value: 'agility',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: { instanceId: 'd1', amount: 3 },
      })
    );
  });

  it('Evolution select chip stays visible while already in beastform', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      activeBeastform: { id: 'srd-bst-agile-scout', name: 'Agile Scout' },
    });
    const druid = raw;
    const table = buildDruidTable(druid, 'Evolution', {
      featureState: { [SRD_CLASS_DRUID_SCOPE_KEY]: {} },
    });
    const chips = collectChips([featureByName(druid, 'Evolution')], 'card', table);
    expect(chips.map((c) => c.name)).toEqual(['Evolution']);
    expect(chips[0].disabled).toBe(false);
  });
});

describe('Druid — beastform declarative overlay', () => {
  it('merges Agile Scout stats, virtual weapon, weapon hints, domain lockout', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      evasion: 10,
      primaryWeaponId: 'srd-wpn-test',
      featureState: {
        [SRD_CLASS_DRUID_SCOPE_KEY]: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const out = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(out.stats.agility).toBe(2);
    expect(out.stats.evasion).toBe(12);
    expect(out.virtualWeapons.some((w) => w.id === '__beastform_natural__')).toBe(true);
    expect(out.weaponRenderHints['srd-wpn-test']?.isDisabled).toBe(true);
    expect(out.domainLoadoutDisabled).toBe(true);
  });

  it('reads active beastform from scoped class bag when present', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      evasion: 10,
      primaryWeaponId: 'srd-wpn-test',
      featureState: {
        [SRD_CLASS_DRUID_SCOPE_KEY]: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const out = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(out.stats.evasion).toBe(12);
    expect(out.domainLoadoutDisabled).toBe(true);
  });

  it('Evolution adds +1 to chosen trait via evolutionTraitKey (scoped bag)', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      featureState: {
        [SRD_CLASS_DRUID_SCOPE_KEY]: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: true },
          evolutionTraitKey: 'agility',
        },
      },
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const out = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(out.stats.agility).toBe(3);
  });

});

describe('Druid — auto-drop beastform at 0 HP', () => {
  it('dispatchStateChangeHooks queues clear mutations via Beastform onStateChange', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      currentHp: 0,
      featureState: {
        [SRD_CLASS_DRUID_SCOPE_KEY]: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    });
    const druid = raw;
    const feats = loadCharacterFeatures(druid, registry);
    const beastformFeat = feats.find((f) => f.name === 'Beastform');
    const gs = {
      activeElements: [druid],
      featureState: druid.featureState,
      _mutationBatch: [{ type: 'markHP', payload: { instanceId: 'd1', amount: 1 } }],
    };
    const { mutations } = dispatchStateChangeHooks(gs, [beastformFeat], gs._mutationBatch);
    const clears = mutations.filter((m) => m.type === 'setFeatureState' && m.payload?.key === 'activeBeastform');
    expect(clears.some((m) => m.payload?.value === null && m.payload?.featureKey === SRD_CLASS_DRUID_SCOPE_KEY)).toBe(
      true
    );
  });
});
