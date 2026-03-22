import { describe, it, expect } from 'vitest';
import { KnowTheTide } from '../../../../src/features-v2/communities/Seaborne.js';
import { runIntent, runResolve, mockTable, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

const fearRolls = {
  action: {
    hopeDie: { value: 4 },
    fearDie: { value: 9 },
    dice: [],
    statics: [],
    isSuccess: false,
    isCritical: false,
  },
  damage: { dice: [], statics: [] },
};

const hopeRolls = {
  action: {
    hopeDie: { value: 9 },
    fearDie: { value: 4 },
    dice: [],
    statics: [],
    isSuccess: true,
    isCritical: false,
  },
  damage: { dice: [], statics: [] },
};

describe('Know the Tide', () => {
  it('has the correct name', () => {
    expect(KnowTheTide.name).toBe('Know the Tide');
  });

  describe('onResolve — token accumulation', () => {
    it('adds a token when rolling with Fear', () => {
      const result = runResolve(KnowTheTide, {
        rolls: fearRolls,
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
          appliedEffects: [],
        },
      });

      expect(result.mutations).toContainEqual(
        expect.objectContaining({
          type: 'setFeatureState',
          payload: expect.objectContaining({ key: 'tokens', value: 1 }),
        })
      );
    });

    it('does not add a token when rolling with Hope', () => {
      const result = runResolve(KnowTheTide, {
        rolls: hopeRolls,
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
          appliedEffects: [],
        },
      });

      const tokenMutations = result.mutations.filter(
        (m) => m.type === 'setFeatureState' && m.payload.key === 'tokens'
      );
      expect(tokenMutations).toHaveLength(0);
    });

    it('does not add a token when not the acting character', () => {
      const result = runResolve(KnowTheTide, {
        rolls: fearRolls,
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1', // adversary is acting, not the feature owner
          targetInstanceIds: ['char-1'],
          effects: [],
          appliedEffects: [],
        },
      });

      const tokenMutations = result.mutations.filter(
        (m) => m.type === 'setFeatureState' && m.payload.key === 'tokens'
      );
      expect(tokenMutations).toHaveLength(0);
    });

    it('accumulates tokens across multiple Fear rolls', () => {
      const result = runResolve(KnowTheTide, {
        rolls: fearRolls,
        featureState: { 'Know the Tide': { tokens: 2 } },
        activeElements: [
          mockCharacter({ instanceId: 'char-1', level: 10 }),
          mockAdversary({ instanceId: 'adv-1' }),
        ],
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
          appliedEffects: [],
        },
      });

      expect(result.mutations).toContainEqual(
        expect.objectContaining({
          type: 'setFeatureState',
          payload: expect.objectContaining({ key: 'tokens', value: 3 }),
        })
      );
    });

    it('does not add tokens beyond character level', () => {
      const result = runResolve(KnowTheTide, {
        rolls: fearRolls,
        featureState: { 'Know the Tide': { tokens: 1 } },
        activeElements: [
          mockCharacter({ instanceId: 'char-1', level: 1 }),
          mockAdversary({ instanceId: 'adv-1' }),
        ],
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
          appliedEffects: [],
        },
      });

      expect(result.mutations).toContainEqual(
        expect.objectContaining({
          type: 'setFeatureState',
          payload: expect.objectContaining({ key: 'tokens', value: 1 }),
        })
      );
    });
  });

  describe('onSessionStart — token clearing', () => {
    it('clears all tokens at session start', () => {
      const result = runResolve(KnowTheTide, {
        featureState: { 'Know the Tide': { tokens: 3 } },
        actionType: 'sessionStart',
        action: {
          type: 'sessionStart',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      });

      expect(result.mutations).toContainEqual(
        expect.objectContaining({
          type: 'setFeatureState',
          payload: expect.objectContaining({ key: 'tokens', value: 0 }),
        })
      );
    });
  });

  describe('intent chip — token spending', () => {
    it('shows a chip when tokens are available', () => {
      const result = runIntent(KnowTheTide, {
        featureState: { 'Know the Tide': { tokens: 2 } },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
      });

      expect(result.chips).toHaveLength(1);
      expect(result.chips[0]._featureName).toBe('Know the Tide');
      expect(result.chips[0].placements).toContain('intent');
    });

    it('does not show chip when no tokens are available', () => {
      const result = runIntent(KnowTheTide, {
        featureState: { 'Know the Tide': { tokens: 0 } },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
      });

      expect(result.chips).toHaveLength(0);
    });

    it('adds a static bonus equal to token count and clears tokens when used', () => {
      const result = runIntent(KnowTheTide, {
        featureState: { 'Know the Tide': { tokens: 3 } },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
      });

      expect(result.chips).toHaveLength(1);
      const chip = result.chips[0];

      const table = mockTable({
        featureState: { 'Know the Tide': { tokens: 3 } },
        _featureKey: 'Know the Tide',
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
        rolls: {
          action: { dice: [], statics: [], hopeDie: null, fearDie: null },
          damage: { dice: [], statics: [] },
        },
      });

      chip.onUse(table, mockChipState());
      const mutations = applyMutations(table);

      expect(mutations).toContainEqual(
        expect.objectContaining({
          type: 'addRollStatic',
          payload: expect.objectContaining({
            rollKey: 'action',
            name: 'Know the Tide',
            value: 3,
          }),
        })
      );

      expect(mutations).toContainEqual(
        expect.objectContaining({
          type: 'setFeatureState',
          payload: expect.objectContaining({ key: 'tokens', value: 0 }),
        })
      );
    });
  });
});
