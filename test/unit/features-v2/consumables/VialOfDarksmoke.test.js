import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { VialOfDarksmoke } from '../../../../src/features-v2/consumables/VialOfDarksmoke.js';
import registry from '../../../../src/features-v2/registry.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAdversaryAttackRoll,
} from '../helpers.js';

describe('Consumables — Vial of Darksmoke', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Vial of Darksmoke', id: 'srd-cns-vial-of-darksmoke' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Vial of Darksmoke',
        description: VialOfDarksmoke.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-vial-of-darksmoke',
      })
    );
  });

  it('reviewAction chip appears when an adversary attacks you', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Vial of Darksmoke',
      featureState: { 'Vial of Darksmoke': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        trait: 'Agility',
        effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 2 }],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...VialOfDarksmoke, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips.some((c) => c.name === 'Vial of Darksmoke')).toBe(true);
  });

  it('reviewAction chip does not appear when a PC attacks you', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const ally = mockCharacter({ instanceId: 'ally-1', name: 'Ally' });
    const gs = mockGameState({
      activeElements: [char, ally],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Vial of Darksmoke',
      featureState: { 'Vial of Darksmoke': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'ally-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        effects: [],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...VialOfDarksmoke, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Vial of Darksmoke')).toHaveLength(0);
  });

  it('activating the chip rolls Agility d6s (take highest) and queues temporary Evasion', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      traits: { agility: 3, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    let rngCall = 0;
    const rngSeq = [0.99, 0.5, 0.01];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Vial of Darksmoke',
      featureState: { 'Vial of Darksmoke': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 1 }],
      },
      rolls: mockAdversaryAttackRoll(),
      _rng: () => rngSeq[rngCall++],
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...VialOfDarksmoke, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const chip = chips.find((c) => c.name === 'Vial of Darksmoke');
    expect(chip).toBeDefined();
    const fromUse = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({ instanceId: 'char-1', stat: 'evasion', value: 6 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Vial of Darksmoke',
          key: 'vialOfDarksmokeEvasionBonus',
          value: 6,
        }),
      })
    );
  });

  it('onReviewOutcome clears stored evasion bonus after resolution', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Vial of Darksmoke',
      featureState: { 'Vial of Darksmoke': { vialOfDarksmokeEvasionBonus: 4 } },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const fn = unwrap(VialOfDarksmoke.hooks.onReviewOutcome, tbl);
    expect(typeof fn).toBe('function');
    fn(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Vial of Darksmoke',
          key: 'vialOfDarksmokeEvasionBonus',
          value: 0,
        }),
      })
    );
  });
});
