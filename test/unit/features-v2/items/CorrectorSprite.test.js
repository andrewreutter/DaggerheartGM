import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState, trackChipFrequency } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { CorrectorSprite } from '../../../../src/features-v2/items/CorrectorSprite.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll } from '../helpers.js';

describe('Items — Corrector Sprite', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-corrector-sprite', name: 'Corrector Sprite' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Corrector Sprite',
        _source: 'item',
        _itemId: 'srd-itm-corrector-sprite',
        chips: CorrectorSprite.chips,
      })
    );
  });

  it('intent chip adds an advantage die on attack', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Corrector Sprite',
      featureState: { 'Corrector Sprite': {} },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        weaponId: null,
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...CorrectorSprite, _ownerInstanceId: 'c1' }], 'intent', tbl);
    const chip = chips.find((c) => c.name === 'Corrector Sprite');
    expect(chip).toBeDefined();
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Corrector Sprite',
        }),
      })
    );
  });

  it('does not offer the intent chip when frequency is exhausted', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Corrector Sprite',
      featureState: { 'Corrector Sprite': {} },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chipKey = 'Corrector Sprite::Corrector Sprite::intent';
    const usageStore = {};
    trackChipFrequency(chipKey, 'shortRest', usageStore);
    const chips = collectChips([{ ...CorrectorSprite, _ownerInstanceId: 'c1' }], 'intent', tbl, usageStore);
    expect(chips.find((c) => c.name === 'Corrector Sprite')).toBeUndefined();
  });
});
