import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { MirrorOfMarigold } from '../../../../src/features-v2/consumables/MirrorOfMarigold.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockAdversaryAttackRoll } from '../helpers.js';

describe('Consumables — Mirror of Marigold', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Mirror of Marigold', id: 'srd-cns-mirror-of-marigold' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Mirror of Marigold',
        description: MirrorOfMarigold.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-mirror-of-marigold',
      })
    );
  });

  it('reviewAction chip appears when you are targeted with pending damage', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Mirror of Marigold',
      featureState: { 'Mirror of Marigold': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        trait: 'Agility',
        effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 3, damageType: 'physical' }],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...MirrorOfMarigold, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips.some((c) => c.name === 'Mirror of Marigold')).toBe(true);
  });

  it('reviewAction chip does not appear without pending damage to you', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Mirror of Marigold',
      featureState: { 'Mirror of Marigold': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        effects: [],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...MirrorOfMarigold, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Mirror of Marigold')).toHaveLength(0);
  });

  it('activating the chip negates damage to you, spends 1 Hope, and removes the mirror from inventory', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const damageEffect = {
      type: 'damage',
      target: { instanceId: 'char-1' },
      amount: 5,
      damageType: 'physical',
    };
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Mirror of Marigold',
      featureState: { 'Mirror of Marigold': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        effects: [damageEffect],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...MirrorOfMarigold, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const chip = chips.find((c) => c.name === 'Mirror of Marigold');
    expect(chip).toBeDefined();
    const fromUse = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(damageEffect.amount).toBe(0);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'inventoryRemove',
        payload: expect.objectContaining({ instanceId: 'char-1', itemName: 'Mirror of Marigold' }),
      })
    );
  });
});
