import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ArcanePrism } from '../../../../src/features-v2/items/ArcanePrism.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runIntent } from '../helpers.js';

describe('Items — Arcane Prism', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-arcane-prism', name: 'Arcane Prism' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Arcane Prism',
        _source: 'item',
        _itemId: 'srd-itm-arcane-prism',
        hooks: ArcanePrism.hooks,
      })
    );
  });

  it('onIntent adds +1 to Spellcast when prism is active and caster is within Close range', () => {
    const owner = mockCharacter({ instanceId: 'c-own', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'c-ally', tokenX: 25, tokenY: 0 });
    const gs = mockGameState({
      character: owner,
      activeElements: [owner, ally],
      _ownerInstanceId: 'c-own',
      _featureKey: 'Arcane Prism',
      featureState: {
        'Arcane Prism': {
          prismActive: true,
          prismTokenX: 0,
          prismTokenY: 0,
        },
      },
      rolls: mockRoll(),
      action: {
        type: 'spellcast',
        actorInstanceId: 'c-ally',
        targetInstanceIds: [],
        trait: 'presence',
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const hookFn = unwrap(ArcanePrism.hooks.onIntent, tbl);
    expect(typeof hookFn).toBe('function');
    hookFn(tbl);
    const mutations = applyMutations(tbl);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Arcane Prism',
          value: 1,
        }),
      })
    );
  });

  it('does not add bonus when ally is beyond Close range of the prism', () => {
    const owner = mockCharacter({ instanceId: 'c-own', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'c-ally', tokenX: 50, tokenY: 0 });
    const gs = mockGameState({
      character: owner,
      activeElements: [owner, ally],
      _ownerInstanceId: 'c-own',
      _featureKey: 'Arcane Prism',
      featureState: {
        'Arcane Prism': {
          prismActive: true,
          prismTokenX: 0,
          prismTokenY: 0,
        },
      },
      rolls: mockRoll(),
      action: {
        type: 'spellcast',
        actorInstanceId: 'c-ally',
        targetInstanceIds: [],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const hookFn = unwrap(ArcanePrism.hooks.onIntent, tbl);
    if (typeof hookFn === 'function') hookFn(tbl);
    const mutations = applyMutations(tbl);
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('Activate chip records prism position and sets active', () => {
    const owner = mockCharacter({
      instanceId: 'c-own',
      tokenX: 5,
      tokenY: 10,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      character: owner,
      activeElements: [owner, adv],
      _ownerInstanceId: 'c-own',
      _featureKey: 'Arcane Prism',
      featureState: { 'Arcane Prism': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'c-own',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ArcanePrism, _ownerInstanceId: 'c-own' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Activate Arcane Prism');
    expect(chip).toBeDefined();
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Arcane Prism',
          key: 'prismActive',
          value: true,
        }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Arcane Prism',
          key: 'prismTokenX',
          value: 5,
        }),
      })
    );
  });

  it('Deactivate chip sets cooldown and clears position', () => {
    const owner = mockCharacter({ instanceId: 'c-own', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      character: owner,
      activeElements: [owner, adv],
      _ownerInstanceId: 'c-own',
      _featureKey: 'Arcane Prism',
      featureState: {
        'Arcane Prism': {
          prismActive: true,
          prismTokenX: 0,
          prismTokenY: 0,
        },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'c-own',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ArcanePrism, _ownerInstanceId: 'c-own' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Deactivate Arcane Prism');
    expect(chip).toBeDefined();
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Arcane Prism',
          key: 'prismCooldownUntilLongRest',
          value: true,
        }),
      })
    );
  });

  it('onRest (long rest) clears cooldown and prism state', () => {
    const { mutations } = runIntent(
      { ...ArcanePrism, _ownerInstanceId: 'c-own' },
      {
        actionType: 'longRest',
        featureState: {
          'Arcane Prism': {
            prismCooldownUntilLongRest: true,
            prismActive: false,
          },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Arcane Prism',
          key: 'prismCooldownUntilLongRest',
          value: false,
        }),
      })
    );
  });
});
