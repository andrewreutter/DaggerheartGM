import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { FaneOfTheWilds } from '../../../../src/features-v2/abilities/Sage/FaneOfTheWilds.js';
import { mockGameState, mockCharacter, mockAdversary, mockRoll, runReviewAction } from '../helpers.js';
import { buildTableSnapshot, applyMutations as applyTableMutations } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';

const sageCards = () => [
  { id: 'srd-abl-healing-field', domain: 'sage' },
  { id: 'srd-abl-forest-sprites', domain: 'sage' },
];

describe('Sage — Fane of the Wilds', () => {
  it('onRest (long rest) sets tokens to Sage domain cards in loadout + vault', () => {
    const char = mockCharacter({
      instanceId: 'f1',
      domainLoadout: sageCards(),
      domainVault: [{ id: 'srd-abl-thorn-skin', domain: 'sage' }],
    });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'f1',
      _featureKey: 'Fane of the Wilds',
      featureState: { 'Fane of the Wilds': {} },
      action: {
        type: 'longRest',
        actorInstanceId: 'f1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const hook = unwrap(FaneOfTheWilds.hooks.onRest, tbl);
    expect(typeof hook).toBe('function');
    hook(tbl);
    const m = applyTableMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Fane of the Wilds',
          key: 'faneWildsTokens',
          value: 3,
        }),
      })
    );
  });

  it('onRest (short rest) does not change tokens', () => {
    const char = mockCharacter({
      instanceId: 'f2',
      domainLoadout: sageCards(),
    });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'f2',
      _featureKey: 'Fane of the Wilds',
      featureState: { 'Fane of the Wilds': { faneWildsTokens: 7 } },
      action: {
        type: 'shortRest',
        actorInstanceId: 'f2',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const hook = unwrap(FaneOfTheWilds.hooks.onRest, tbl);
    expect(hook).toBeUndefined();
  });

  it('reviewAction chip spends tokens to add static bonus to Spellcast roll', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { presence: 2, agility: 0, strength: 0, finesse: 0, instinct: 0, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Fane of the Wilds',
        featureState: { 'Fane of the Wilds': { faneWildsTokens: 4 } },
        action: {
          type: 'spellcast',
          actorInstanceId: 'char-1',
          targetInstanceIds: [adv.instanceId],
          trait: 'presence',
          range: 'far',
          abilityId: null,
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ isSuccess: true, isCritical: false }),
      })
    );
    const chips = collectChips([{ ...FaneOfTheWilds, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const fane = chips.find((c) => c.name === 'Fane of the Wilds');
    expect(fane).toBeDefined();
    const m = [...activateChip(fane, tbl, makeChipState(), { selectedId: '2' }), ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Fane of the Wilds', value: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'faneWildsTokens', value: 2 }),
      })
    );
  });

  it('onReviewAction grants 1 token on critical Sage domain Spellcast', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      domainLoadout: [{ id: 'srd-abl-healing-field', domain: 'sage' }],
      traits: { presence: 2, agility: 0, strength: 0, finesse: 0, instinct: 0, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Fane of the Wilds',
        featureState: { 'Fane of the Wilds': { faneWildsTokens: 1 } },
        action: {
          type: 'spellcast',
          actorInstanceId: 'char-1',
          targetInstanceIds: [adv.instanceId],
          trait: 'presence',
          range: 'far',
          abilityId: 'srd-abl-healing-field',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ isSuccess: true, isCritical: true }),
      })
    );
    const hook = unwrap(FaneOfTheWilds.hooks.onReviewAction, tbl);
    expect(typeof hook).toBe('function');
    hook(tbl);
    const m = applyTableMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'faneWildsTokens', value: 2 }),
      })
    );
  });

  it('runReviewAction exposes Fane chip on spellcast when tokens > 0', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { presence: 2, agility: 0, strength: 0, finesse: 0, instinct: 0, knowledge: 0 },
    });
    const { chips } = runReviewAction(
      { ...FaneOfTheWilds, _ownerInstanceId: 'char-1' },
      {
        actionType: 'spellcast',
        character: char,
        featureState: { 'Fane of the Wilds': { faneWildsTokens: 2 } },
        action: { traitKey: 'presence', range: 'far', abilityId: 'srd-abl-healing-field' },
        rolls: mockRoll(),
      }
    );
    expect(chips.some((c) => c.name === 'Fane of the Wilds')).toBe(true);
  });
});
