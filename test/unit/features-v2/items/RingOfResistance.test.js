import { describe, it, expect } from 'vitest';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { RingOfResistance } from '../../../../src/features-v2/items/RingOfResistance.js';
import registry from '../../../../src/features-v2/registry.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAdversaryAttackRoll,
  mockAction,
} from '../helpers.js';

describe('Items — Ring of Resistance', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Ring of Resistance', id: 'srd-itm-ring-of-resistance' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Ring of Resistance',
        description: RingOfResistance.description,
        _source: 'item',
        _itemId: 'srd-itm-ring-of-resistance',
      })
    );
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Ring of Resistance', id: 'srd-itm-ring-of-resistance' },
          { name: 'Ring of Resistance', id: 'srd-itm-ring-of-resistance' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Ring of Resistance').length).toBe(1);
  });

  it('reviewAction toggle + gated hook halves physical damage on a hit', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1' },
        amount: 10,
        damageType: 'physical',
      },
    ];

    const gs = mockGameState({
      character: char,
      adversary: adv,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Ring of Resistance',
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
    });

    const loop = createActionLoop(
      gs,
      mockAction({
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
      }),
      [{ ...RingOfResistance, _ownerInstanceId: 'char-1' }],
      {}
    );

    const ra = loop.runPhase('reviewAction');
    expect(ra.chips).toHaveLength(1);
    expect(ra.chips[0].isToggle).toBe(true);
    expect(ra.chips[0]._gatedHookFn).toBe(RingOfResistance.hooks.onReviewAction);

    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Ring of Resistance',
      _activeFeature: RingOfResistance,
    });
    [...activateChip(ra.chips[0], tbl, makeChipState()), ...applyMutations(tbl)];

    expect(effects[0].amount).toBe(5);
  });

  it('halves magic damage the same way', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1' },
        amount: 9,
        damageType: 'magic',
      },
    ];

    const gs = mockGameState({
      character: char,
      adversary: adv,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Ring of Resistance',
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
    });

    const loop = createActionLoop(
      gs,
      mockAction({
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
      }),
      [{ ...RingOfResistance, _ownerInstanceId: 'char-1' }],
      {}
    );

    const ra = loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Ring of Resistance',
      _activeFeature: RingOfResistance,
    });
    [...activateChip(ra.chips[0], tbl, makeChipState()), ...applyMutations(tbl)];

    expect(effects[0].amount).toBe(4);
  });

  it('does not offer the chip on a miss', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1' },
        amount: 10,
        damageType: 'physical',
      },
    ];

    const gs = mockGameState({
      character: char,
      adversary: adv,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Ring of Resistance',
      rolls: mockAdversaryAttackRoll({ isSuccess: false }),
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
    });

    const loop = createActionLoop(
      gs,
      mockAction({
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
      }),
      [{ ...RingOfResistance, _ownerInstanceId: 'char-1' }],
      {}
    );

    const ra = loop.runPhase('reviewAction');
    expect(ra.chips).toHaveLength(0);
  });
});
