import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Lorekeeper } from '../../../../src/features-v2/items/Lorekeeper.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll } from '../helpers.js';

describe('Items — Lorekeeper', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-lorekeeper', name: 'Lorekeeper' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Lorekeeper',
        _source: 'item',
        _itemId: 'srd-itm-lorekeeper',
        hooks: Lorekeeper.hooks,
      })
    );
  });

  it('onIntent adds +1 to action rolls against a recorded hostile creature', () => {
    const owner = mockCharacter({ instanceId: 'c-own' });
    const adv = mockAdversary({ instanceId: 'adv-1', name: 'Shadow Wraith' });
    const gs = mockGameState({
      character: owner,
      activeElements: [owner, adv],
      _ownerInstanceId: 'c-own',
      _featureKey: 'Lorekeeper',
      featureState: {
        Lorekeeper: { lorekeeperNames: ['shadow wraith'] },
      },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'c-own',
        targetInstanceIds: ['adv-1'],
        trait: 'agility',
        range: 'melee',
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const hookFn = unwrap(Lorekeeper.hooks.onIntent, tbl);
    expect(typeof hookFn).toBe('function');
    hookFn(tbl);
    const mutations = applyMutations(tbl);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Lorekeeper',
          value: 1,
        }),
      })
    );
  });

  it('onIntent does not add a bonus when the target was not recorded', () => {
    const owner = mockCharacter({ instanceId: 'c-own' });
    const adv = mockAdversary({ instanceId: 'adv-1', name: 'Shadow Wraith' });
    const gs = mockGameState({
      character: owner,
      activeElements: [owner, adv],
      _ownerInstanceId: 'c-own',
      _featureKey: 'Lorekeeper',
      featureState: {
        Lorekeeper: { lorekeeperNames: ['other beast'] },
      },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'c-own',
        targetInstanceIds: ['adv-1'],
        trait: 'agility',
        range: 'melee',
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const hookFn = unwrap(Lorekeeper.hooks.onIntent, tbl);
    if (typeof hookFn === 'function') hookFn(tbl);
    const mutations = applyMutations(tbl);
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('Record chip stores normalized adversary name in feature state', () => {
    const owner = mockCharacter({ instanceId: 'c-own', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', name: '  Iron Golem  ' });
    const gs = mockGameState({
      character: owner,
      activeElements: [owner, adv],
      _ownerInstanceId: 'c-own',
      _featureKey: 'Lorekeeper',
      featureState: { Lorekeeper: {} },
      action: {
        type: 'attack',
        actorInstanceId: 'c-own',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Lorekeeper, _ownerInstanceId: 'c-own' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Record hostile creature in Lorekeeper');
    expect(chip).toBeDefined();
    const fromUse = [
      ...activateChip(chip, tbl, makeChipState(), { selectedTargetIds: ['adv-1'] }),
      ...applyMutations(tbl),
    ];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Lorekeeper',
          key: 'lorekeeperNames',
          value: ['iron golem'],
        }),
      })
    );
  });
});
