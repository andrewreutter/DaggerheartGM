import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  applyDeclarativeFeatures,
  loadCharacterFeatures,
} from '../../../../src/features-v2/engine/feature-loader.js';
import { HoningRelic } from '../../../../src/features-v2/items/HoningRelic.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

const EXPS = [
  { id: 'exp-a', name: 'Cooking' },
  { id: 'exp-b', name: 'Sailing' },
];

function tableForCreate(overrides = {}) {
  const { featureState, character: charOverrides, ...rest } = overrides;
  const char = mockCharacter({
    instanceId: 'c1',
    experiences: EXPS,
    ...charOverrides,
  });
  return buildTableSnapshot(
    mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Honing Relic',
      featureState: featureState ?? { 'Honing Relic': {} },
      action: {
        type: 'free',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
      ...rest,
    })
  );
}

describe('Items — Honing Relic', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Honing Relic', id: 'srd-itm-honing-relic' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Honing Relic',
        description: HoningRelic.description,
        _source: 'item',
        _itemId: 'srd-itm-honing-relic',
      })
    );
  });

  it('create: choosing an Experience queues +1 and marks choice complete', () => {
    const tbl = tableForCreate();
    const chips = collectChips([{ ...HoningRelic, _ownerInstanceId: 'c1' }], 'create', tbl);
    const pick = chips.find((c) => c.name === 'Honing Relic — Experience');
    expect(pick).toBeDefined();
    const m = activateChip(pick, tbl, makeChipState(), { selectedId: 'exp-b' });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addExperienceBonus',
        payload: { instanceId: 'c1', experienceId: 'exp-b', amount: 1 },
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Honing Relic',
          key: 'experienceChosen',
          value: true,
        }),
      })
    );
  });

  it('create: no chip when the character has no Experiences yet', () => {
    const tbl = tableForCreate({
      character: { experiences: [] },
    });
    const chips = collectChips([{ ...HoningRelic, _ownerInstanceId: 'c1' }], 'create', tbl);
    expect(chips.filter((c) => c.name === 'Honing Relic — Experience')).toHaveLength(0);
  });

  it('create: chip hidden after Experience is chosen', () => {
    const tbl = tableForCreate({
      featureState: { 'Honing Relic': { experienceChosen: true } },
    });
    const chips = collectChips([{ ...HoningRelic, _ownerInstanceId: 'c1' }], 'create', tbl);
    expect(chips.filter((c) => c.name === 'Honing Relic — Experience')).toHaveLength(0);
  });

  it('applyDeclarativeFeatures does not alter stats (choice is create-time)', () => {
    const char = mockCharacter({
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      experiences: EXPS,
    });
    const feats = loadCharacterFeatures(
      mockCharacter({
        ...char,
        inventory: [{ name: 'Honing Relic', id: 'srd-itm-honing-relic' }],
      }),
      registry
    );
    const { stats } = applyDeclarativeFeatures(feats, char, {});
    expect(stats.strength).toBe(1);
  });
});
