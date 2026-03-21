import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';

// ---------------------------------------------------------------------------
// buildTableSnapshot
// ---------------------------------------------------------------------------

describe('buildTableSnapshot()', () => {
  it('returns a table object with required subdocuments', () => {
    const table = buildTableSnapshot(mockGameState());
    expect(table).toBeDefined();
    expect(table.top).toBeDefined();
    expect(table.me).toBeDefined();
    expect(table.action).toBeDefined();
    expect(table.actors).toBeInstanceOf(Array);
    expect(table.characters).toBeInstanceOf(Array);
    expect(table.adversaries).toBeInstanceOf(Array);
    expect(table.feature).toBeDefined();
    expect(typeof table.feature.get).toBe('function');
    expect(typeof table.feature.set).toBe('function');
  });

  it('populates table.top.fear from gameState.fear', () => {
    const table = buildTableSnapshot(mockGameState({ fear: 5 }));
    expect(table.top.fear).toBe(5);
  });

  it('populates table.top.map from gameState.mapConfig', () => {
    const mapConfig = { mapSizeFt: 100 };
    const table = buildTableSnapshot(mockGameState({ mapConfig }));
    expect(table.top.map).toBe(mapConfig);
  });

  it('defaults fear to 0 when not provided', () => {
    const table = buildTableSnapshot({});
    expect(table.top.fear).toBe(0);
  });

  it('sets table.me based on _ownerInstanceId', () => {
    const char = mockCharacter({ instanceId: 'owner-123', name: 'Alice' });
    const state = mockGameState({ activeElements: [char], _ownerInstanceId: 'owner-123' });
    const table = buildTableSnapshot(state);
    expect(table.me?.name).toBe('Alice');
    expect(table.me?.instanceId).toBe('owner-123');
  });

  it('separates characters and adversaries', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'a1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char, adv] }));
    expect(table.characters).toHaveLength(1);
    expect(table.adversaries).toHaveLength(1);
    expect(table.characters[0].isCharacter).toBe(true);
    expect(table.adversaries[0].isAdversary).toBe(true);
  });

  it('marks the actor with isActing = true', () => {
    const char = mockCharacter({ instanceId: 'actor-id' });
    const state = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'actor-id',
      action: {
        type: 'attack',
        actorInstanceId: 'actor-id',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    expect(table.me?.isActing).toBe(true);
  });

  it('populates action subdocument with actor and targets', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    expect(table.action?.actor?.instanceId).toBe('char-1');
    expect(table.action?.targets).toHaveLength(1);
    expect(table.action?.target?.instanceId).toBe('adv-1');
    expect(table.action?.attacker?.instanceId).toBe('char-1');
  });

  it('rolls subdocument is undefined when no rolls provided', () => {
    const state = { ...mockGameState(), rolls: undefined };
    const table = buildTableSnapshot(state);
    expect(table.rolls).toBeUndefined();
  });

  it('rolls subdocument contains action and damage roll objects', () => {
    const table = buildTableSnapshot(mockGameState());
    expect(table.rolls?.action).toBeDefined();
    expect(table.rolls?.damage).toBeDefined();
    expect(table.rolls?.action?.hopeDie?.value).toBe(7);
    expect(table.rolls?.action?.fearDie?.value).toBe(4);
  });

  it('table.top.broadcast queues a broadcast mutation', () => {
    const table = buildTableSnapshot(mockGameState());
    table.top.broadcast('hello world');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'broadcast', payload: { message: 'hello world' } })
    );
  });
});

// ---------------------------------------------------------------------------
// Mutation queueing via actor write methods
// ---------------------------------------------------------------------------

describe('Actor write methods (mutation queueing)', () => {
  it('markStress queues a markStress mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.markStress(2);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'c1', amount: 2 } })
    );
  });

  it('clearStress queues a clearStress mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.clearStress(1);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearStress', payload: { instanceId: 'c1', amount: 1 } })
    );
  });

  it('gainHope queues a gainHope mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.gainHope(1);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'gainHope', payload: { instanceId: 'c1', amount: 1 } })
    );
  });

  it('spendHope queues a spendHope mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.spendHope(2);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendHope', payload: { instanceId: 'c1', amount: 2 } })
    );
  });

  it('markHP queues a markHP mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.markHP(1);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markHP', payload: { instanceId: 'c1', amount: 1 } })
    );
  });

  it('clearHP queues a clearHP mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.clearHP(1);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'c1', amount: 1 } })
    );
  });

  it('addCondition queues an addCondition mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.addCondition('Vulnerable');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'addCondition', payload: { instanceId: 'c1', condition: 'Vulnerable' } })
    );
  });

  it('multiple mutations queue in order', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.markStress(1);
    table.me.gainHope(2);
    const mutations = applyMutations(table);
    expect(mutations[0].type).toBe('markStress');
    expect(mutations[1].type).toBe('gainHope');
  });

  it('applyMutations clears the queue after returning', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.markStress(1);
    const first = applyMutations(table);
    expect(first).toHaveLength(1);
    const second = applyMutations(table);
    expect(second).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Roll write methods
// ---------------------------------------------------------------------------

describe('Roll write methods (mutation queueing)', () => {
  it('addStatic queues addRollStatic mutation and updates local dice list', () => {
    const table = buildTableSnapshot(mockGameState());
    table.rolls.action.addStatic({ name: 'Reliable', value: 1 });
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Reliable', value: 1 }),
      })
    );
  });

  it('addDie queues addRollDie mutation', () => {
    const table = buildTableSnapshot(mockGameState());
    table.rolls.damage.addDie({ name: 'Fire', die: 'd4' });
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Fire', die: 'd4' }),
      })
    );
  });

  it('addAdvantageDie queues addAdvantageDie mutation', () => {
    const table = buildTableSnapshot(mockGameState());
    table.rolls.action.addAdvantageDie('Aim');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'addAdvantageDie', payload: { rollKey: 'action', name: 'Aim' } })
    );
  });

  it('removeDie queues removeRollDie mutation', () => {
    const table = buildTableSnapshot(mockGameState());
    table.rolls.action.removeDie('Aim');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'removeRollDie', payload: { rollKey: 'action', name: 'Aim' } })
    );
  });

  it('exposes advantageDice and disadvantageDice getters', () => {
    const table = buildTableSnapshot(mockGameState({
      rolls: mockRoll({ actionDice: [
        { name: 'Stumble', die: 'd6', _disadvantage: true },
        { name: 'Aim', die: 'd6', _advantage: true },
        { name: 'Extra', die: 'd6' },
      ] }),
    }));
    expect(table.rolls.action.advantageDice).toHaveLength(1);
    expect(table.rolls.action.advantageDice[0].name).toBe('Aim');
    expect(table.rolls.action.disadvantageDice).toHaveLength(1);
    expect(table.rolls.action.disadvantageDice[0].name).toBe('Stumble');
  });

  it('removeAdvantageDie queues removeAdvantageDie mutation and removes from local list', () => {
    const table = buildTableSnapshot(mockGameState({
      rolls: mockRoll({ actionDice: [
        { name: 'Aim', die: 'd6', _advantage: true },
      ] }),
    }));
    table.rolls.action.removeAdvantageDie('Aim');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'removeAdvantageDie', payload: { rollKey: 'action', name: 'Aim' } })
    );
    expect(table.rolls.action.advantageDice).toHaveLength(0);
  });

  it('removeDisadvantageDie queues removeDisadvantageDie mutation and removes from local list', () => {
    const table = buildTableSnapshot(mockGameState({
      rolls: mockRoll({ actionDice: [
        { name: 'Stumble', die: 'd6', _disadvantage: true },
      ] }),
    }));
    table.rolls.action.removeDisadvantageDie('Stumble');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'removeDisadvantageDie', payload: { rollKey: 'action', name: 'Stumble' } })
    );
    expect(table.rolls.action.disadvantageDice).toHaveLength(0);
  });

  it('setDie queues setDie mutation on hopeDie', () => {
    const table = buildTableSnapshot(mockGameState());
    table.rolls.action.hopeDie.setDie('d20');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'setDie', payload: { rollKey: 'action', dieType: 'hopeDie', die: 'd20' } })
    );
  });

  it('setDie queues setDie mutation on fearDie', () => {
    const table = buildTableSnapshot(mockGameState());
    table.rolls.action.fearDie.setDie('d6');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'setDie', payload: { rollKey: 'action', dieType: 'fearDie', die: 'd6' } })
    );
  });
});

// ---------------------------------------------------------------------------
// Fear write methods (table.top)
// ---------------------------------------------------------------------------

describe('Fear write methods (table.top)', () => {
  it('gainFear queues a gainFear mutation', () => {
    const table = buildTableSnapshot(mockGameState({ fear: 2 }));
    table.top.gainFear(3);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'gainFear', payload: { amount: 3 } })
    );
  });

  it('spendFear queues a spendFear mutation', () => {
    const table = buildTableSnapshot(mockGameState({ fear: 4 }));
    table.top.spendFear(2);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendFear', payload: { amount: 2 } })
    );
  });
});

// ---------------------------------------------------------------------------
// Movement write method (actor.move)
// ---------------------------------------------------------------------------

describe('actor.move() (mutation queueing)', () => {
  it('queues a move mutation with conditionFn and description', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    const condition = (t) => t.me.rangeFromTarget !== 'melee';
    table.me.move(condition, 'Push out of melee');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({ instanceId: 'c1', description: 'Push out of melee' }),
      })
    );
    // conditionFn must be preserved as a function in the mutation payload
    const moveMutation = mutations.find(m => m.type === 'move');
    expect(typeof moveMutation.payload.conditionFn).toBe('function');
  });

  it('queues a move mutation without description when omitted', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.move(() => true);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'move', payload: expect.objectContaining({ instanceId: 'c1' }) })
    );
  });

  it('can be called on action.target (not just table.me)', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    table.action.target.move(() => true, 'Knockback');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({ instanceId: 'adv-1', description: 'Knockback' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Inventory and loadout write methods
// ---------------------------------------------------------------------------

describe('actor.inventory and actor.loadout (mutation queueing)', () => {
  it('inventory.add queues an inventoryAdd mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    const item = { name: 'Health Potion', id: 'item-hp-1' };
    table.me.inventory.add(item);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'inventoryAdd',
        payload: { instanceId: 'c1', item },
      })
    );
  });

  it('inventory.remove queues an inventoryRemove mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.inventory.remove('Health Potion');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'inventoryRemove',
        payload: { instanceId: 'c1', itemName: 'Health Potion' },
      })
    );
  });

  it('loadout.swapCard queues a loadoutSwapCard mutation', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    table.me.loadout.swapCard('card-old', 'card-new');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'loadoutSwapCard',
        payload: { instanceId: 'c1', currentCardId: 'card-old', newCardId: 'card-new' },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Action context helper booleans
// ---------------------------------------------------------------------------

describe('table.action helper booleans', () => {
  function makeTableWithType(type) {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    return buildTableSnapshot(mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type,
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
    }));
  }

  const DUALITY_TYPES = ['action', 'trait', 'attack', 'spellcast', 'reaction'];
  const NON_DUALITY_TYPES = ['damage', 'free', 'shortRest', 'longRest', 'sessionStart'];
  const HOPE_FEAR_TYPES = ['action', 'trait', 'attack', 'spellcast'];
  const NO_HOPE_FEAR_TYPES = ['reaction', 'damage', 'free'];
  const TRAIT_FINAL_TYPES = ['trait', 'attack', 'spellcast', 'reaction'];
  const TRAIT_MUTABLE_TYPES = ['action'];

  for (const type of DUALITY_TYPES) {
    it(`isDualityRoll is true for type '${type}'`, () => {
      expect(makeTableWithType(type).action.isDualityRoll).toBe(true);
    });
  }

  for (const type of NON_DUALITY_TYPES) {
    it(`isDualityRoll is false for type '${type}'`, () => {
      expect(makeTableWithType(type).action.isDualityRoll).toBe(false);
    });
  }

  for (const type of HOPE_FEAR_TYPES) {
    it(`generatesHopeFear is true for type '${type}'`, () => {
      expect(makeTableWithType(type).action.generatesHopeFear).toBe(true);
    });
  }

  for (const type of NO_HOPE_FEAR_TYPES) {
    it(`generatesHopeFear is false for type '${type}'`, () => {
      expect(makeTableWithType(type).action.generatesHopeFear).toBe(false);
    });
  }

  it("isReaction is true for type 'reaction'", () => {
    expect(makeTableWithType('reaction').action.isReaction).toBe(true);
  });

  for (const type of ['action', 'trait', 'attack', 'spellcast', 'damage']) {
    it(`isReaction is false for type '${type}'`, () => {
      expect(makeTableWithType(type).action.isReaction).toBe(false);
    });
  }

  for (const type of TRAIT_FINAL_TYPES) {
    it(`traitIsFinal is true for type '${type}'`, () => {
      expect(makeTableWithType(type).action.traitIsFinal).toBe(true);
    });
  }

  for (const type of TRAIT_MUTABLE_TYPES) {
    it(`traitIsFinal is false for type '${type}'`, () => {
      expect(makeTableWithType(type).action.traitIsFinal).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Feature state
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// table.me.proficiency
// ---------------------------------------------------------------------------

describe('table.me.proficiency', () => {
  it('defaults to 1 when element has no proficiency field', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.proficiency).toBe(1);
  });

  it('reads proficiency from the element when present', () => {
    const char = mockCharacter({ instanceId: 'c1', proficiency: 3 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.proficiency).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// table.me.level
// ---------------------------------------------------------------------------

describe('table.me.level', () => {
  it('defaults to 1 when element has no level field', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.level).toBe(1);
  });

  it('reads level from the element when present', () => {
    const char = mockCharacter({ instanceId: 'c1', level: 7 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.level).toBe(7);
  });
});

describe('table.feature (local state)', () => {
  it('get returns undefined for unset keys', () => {
    const table = buildTableSnapshot(mockGameState({ _featureKey: 'MyFeature' }));
    expect(table.feature.get('timesUsed')).toBeUndefined();
  });

  it('set and get roundtrip a value', () => {
    const table = buildTableSnapshot(mockGameState({ _featureKey: 'MyFeature' }));
    table.feature.set('timesUsed', 3);
    expect(table.feature.get('timesUsed')).toBe(3);
  });

  it('set queues a setFeatureState mutation', () => {
    const table = buildTableSnapshot(mockGameState({ _featureKey: 'MyFeature' }));
    table.feature.set('pushActive', true);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: { featureKey: 'MyFeature', key: 'pushActive', value: true },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// table.me.lastPosition
// ---------------------------------------------------------------------------

describe('table.me.lastPosition', () => {
  it('is null when _previousPositions is not provided', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.lastPosition).toBeNull();
  });

  it('is null when _previousPositions has no entry for the owner', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const table = buildTableSnapshot(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'c1', _previousPositions: {} })
    );
    expect(table.me?.lastPosition).toBeNull();
  });

  it('is null when the previous position has a null tokenX', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _previousPositions: { 'c1': { tokenX: null, tokenY: 50 } },
      })
    );
    expect(table.me?.lastPosition).toBeNull();
  });

  it('rangeFrom returns the correct range band from the previous position', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 0, tokenY: 0 });
    // Previous position was 50 ft from the adversary → 'far'
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        _previousPositions: { 'c1': { tokenX: 50, tokenY: 0 } },
      })
    );
    const advActor = table.adversaries[0];
    expect(table.me?.lastPosition?.rangeFrom(advActor)).toBe('far');
  });

  it('rangeFrom returns veryFar when previous position was more than 100 ft away', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 0, tokenY: 0 });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        _previousPositions: { 'c1': { tokenX: 150, tokenY: 0 } },
      })
    );
    const advActor = table.adversaries[0];
    expect(table.me?.lastPosition?.rangeFrom(advActor)).toBe('veryFar');
  });

  it('rangeFrom returns null when the other actor has no token position', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1' }); // tokenX/Y default to null
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        _previousPositions: { 'c1': { tokenX: 50, tokenY: 0 } },
      })
    );
    const advActor = table.adversaries[0];
    expect(table.me?.lastPosition?.rangeFrom(advActor)).toBeNull();
  });

  it('rangeFromTarget returns the band from previous position to the action target', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 0, tokenY: 0 });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        _previousPositions: { 'c1': { tokenX: 80, tokenY: 0 } },
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          targetInstanceIds: ['a1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );
    // Previous position (80, 0) to target (0, 0) = 80 ft → 'far'
    expect(table.me?.lastPosition?.rangeFromTarget).toBe('far');
  });

  describe('table.me.weapons / primaryWeapon / secondaryWeapon', () => {
    it('returns null for primaryWeapon when element has no weapons', () => {
      const table = buildTableSnapshot(mockGameState());
      expect(table.me.primaryWeapon).toBeNull();
      expect(table.me.secondaryWeapon).toBeNull();
      expect(table.me.weapons).toEqual([]);
    });

    it('builds primaryWeapon from element.primaryWeapon with tier as number', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        primaryWeapon: { id: 'w1', name: 'Sword', tier: '2', range: 'melee', trait: 'Agility', damage: 'd8' },
      });
      const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
      expect(table.me.primaryWeapon).toMatchObject({ id: 'w1', name: 'Sword', tier: 2, range: 'melee' });
    });

    it('derives primaryWeapon from element.weapons[0] when primaryWeapon is absent', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        weapons: [
          { id: 'w1', name: 'Sword', tier: '1', range: 'melee' },
          { id: 'w2', name: 'Dagger', tier: '1', range: 'veryClose' },
        ],
      });
      const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
      expect(table.me.primaryWeapon.id).toBe('w1');
      expect(table.me.secondaryWeapon.id).toBe('w2');
      expect(table.me.weapons).toHaveLength(2);
    });

    it('applies _rangeOverrides to weapon ranges', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        primaryWeapon: { id: 'w1', name: 'Sword', tier: '1', range: 'melee' },
        _rangeOverrides: { melee: 'veryClose' },
      });
      const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
      expect(table.me.primaryWeapon.range).toBe('veryClose');
      expect(table.me.weapons[0].range).toBe('veryClose');
    });

    it('does not override non-matching ranges', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        primaryWeapon: { id: 'w2', name: 'Bow', tier: '1', range: 'close' },
        _rangeOverrides: { melee: 'veryClose' },
      });
      const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
      expect(table.me.primaryWeapon.range).toBe('close');
    });

    it('includes pre-computed virtualWeapons in table.me.weapons', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        primaryWeapon: { id: 'w1', name: 'Sword', tier: '1', range: 'melee' },
        virtualWeapons: [{ id: 'vw1', name: 'Claws', tier: '1', range: 'melee' }],
      });
      const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
      expect(table.me.weapons).toHaveLength(2);
      expect(table.me.weapons[1].id).toBe('vw1');
    });
  });

  it('treats tokenX: 0 as a valid position (CONV-013)', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 0, tokenY: 0 });
    // Previous position at (0, 8) — should NOT be treated as missing because tokenX is 0
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        _previousPositions: { 'c1': { tokenX: 0, tokenY: 8 } },
      })
    );
    const advActor = table.adversaries[0];
    // (0,8) to (0,0) = 8 ft → 'veryClose' (would be null if tokenX: 0 were misread as null)
    expect(table.me?.lastPosition?.rangeFrom(advActor)).toBe('veryClose');
  });
});
