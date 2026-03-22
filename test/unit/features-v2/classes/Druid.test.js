import { describe, it, expect } from 'vitest';
import { Beastform, Evolution } from '../../../../src/features-v2/classes/Druid.js';
import {
  attachBeastformOptions,
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
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

describe('Druid — Beastform', () => {
  it('card chip sets activeBeastform and spends Stress', () => {
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1 });
    const druid = attachBeastformOptions(raw, registry);

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [druid],
        _ownerInstanceId: 'd1',
        _featureKey: 'Beastform',
        featureState: { Beastform: {} },
        action: {
          type: 'free',
          actorInstanceId: 'd1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...Beastform, _ownerInstanceId: 'd1' }], 'card', table);
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
          featureKey: 'Beastform',
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

  it('Beastform select chip is disabled while already in beastform', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      activeBeastform: { id: 'srd-bst-agile-scout', name: 'Agile Scout' },
    });
    const druid = attachBeastformOptions(raw, registry);
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [druid],
        _ownerInstanceId: 'd1',
        _featureKey: 'Beastform',
        featureState: { Beastform: {} },
        action: {
          type: 'free',
          actorInstanceId: 'd1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );
    const chips = collectChips([{ ...Beastform, _ownerInstanceId: 'd1' }], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].disabled).toBe(true);
  });
});

describe('Druid — Evolution', () => {
  it('card chip sets activeBeastform via Evolution and spends Hope', () => {
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1, hope: 5 });
    const druid = attachBeastformOptions(raw, registry);

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [druid],
        _ownerInstanceId: 'd1',
        _featureKey: 'Evolution',
        featureState: { Evolution: {} },
        action: {
          type: 'free',
          actorInstanceId: 'd1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...Evolution, _ownerInstanceId: 'd1' }], 'card', table);
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
          featureKey: 'Evolution',
          key: 'activeBeastform',
          value: { beastformId: 'srd-bst-agile-scout', viaEvolution: true },
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Evolution',
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
        Beastform: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    });
    const druid = attachBeastformOptions(raw, registry);
    const feats = loadCharacterFeatures(druid, registry);
    const out = applyDeclarativeFeatures(feats, druid, {}, registry);
    expect(out.stats.agility).toBe(2);
    expect(out.stats.evasion).toBe(12);
    expect(out.virtualWeapons.some((w) => w.id === '__beastform_natural__')).toBe(true);
    expect(out.weaponRenderHints['srd-wpn-test']?.isDisabled).toBe(true);
    expect(out.domainLoadoutDisabled).toBe(true);
  });

  it('Evolution adds +1 to chosen trait via evolutionTraitKey', () => {
    const raw = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      featureState: {
        Evolution: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: true },
          evolutionTraitKey: 'agility',
        },
      },
    });
    const druid = attachBeastformOptions(raw, registry);
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
        Beastform: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    });
    const druid = attachBeastformOptions(raw, registry);
    const feats = loadCharacterFeatures(druid, registry);
    const beastformFeat = feats.find((f) => f.name === 'Beastform');
    const gs = {
      activeElements: [druid],
      featureState: druid.featureState,
      _mutationBatch: [{ type: 'markHP', payload: { instanceId: 'd1', amount: 1 } }],
    };
    const { mutations } = dispatchStateChangeHooks(gs, [beastformFeat], gs._mutationBatch);
    const clears = mutations.filter((m) => m.type === 'setFeatureState' && m.payload?.key === 'activeBeastform');
    expect(clears.some((m) => m.payload?.value === null)).toBe(true);
  });
});
