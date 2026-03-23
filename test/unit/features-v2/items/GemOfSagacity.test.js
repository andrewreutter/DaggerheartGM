import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { GemOfSagacity } from '../../../../src/features-v2/items/GemOfSagacity.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Items — Gem of Sagacity', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Gem of Sagacity', id: 'srd-itm-gem-of-sagacity' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Gem of Sagacity',
        description: GemOfSagacity.description,
        _source: 'item',
        _itemId: 'srd-itm-gem-of-sagacity',
      })
    );
  });

  it('declares Knowledge for the primary weapon id by default', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      primaryWeaponId: 'srd-wep-battleaxe',
      traits: { agility: 0, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 2 },
    });
    const feats = loadCharacterFeatures(
      { ...char, inventory: [{ id: 'srd-itm-gem-of-sagacity' }] },
      registry
    );
    expect(feats).toContainEqual(expect.objectContaining({ name: 'Gem of Sagacity' }));
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponTraitOverrides).toEqual({ 'srd-wep-battleaxe': 'Knowledge' });
  });

  it('uses attachedWeaponId from feature state when set', () => {
    const char = mockCharacter({
      instanceId: 'c2',
      primaryWeaponId: 'srd-wep-primary',
      secondaryWeaponId: 'srd-wep-secondary',
      featureState: {
        'Gem of Sagacity': { attachedWeaponId: 'srd-wep-secondary' },
      },
    });
    const feats = loadCharacterFeatures(
      { ...char, inventory: [{ id: 'srd-itm-gem-of-sagacity' }] },
      registry
    );
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponTraitOverrides).toEqual({ 'srd-wep-secondary': 'Knowledge' });
  });

  it('does not set an override when no weapon id can be resolved', () => {
    const char = mockCharacter({
      instanceId: 'c3',
      primaryWeaponId: null,
    });
    const feats = loadCharacterFeatures(
      { ...char, inventory: [{ id: 'srd-itm-gem-of-sagacity' }] },
      registry
    );
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponTraitOverrides).toEqual({});
  });

  it('weaponTraitOverrides callback reads table.feature for the Gem row', () => {
    const gs = mockGameState({
      activeElements: [
        mockCharacter({
          instanceId: 'c4',
          primaryWeaponId: 'srd-wep-x',
          inventory: [{ id: 'srd-itm-gem-of-sagacity' }],
        }),
      ],
      _ownerInstanceId: 'c4',
      _featureKey: 'Gem of Sagacity',
      featureState: {
        'Gem of Sagacity': { attachedWeaponId: 'srd-wep-override' },
      },
    });
    const tbl = buildTableSnapshot(gs);
    const out = GemOfSagacity.weaponTraitOverrides(tbl, GemOfSagacity, gs.activeElements[0]);
    expect(out).toEqual({ 'srd-wep-override': 'Knowledge' });
  });
});
