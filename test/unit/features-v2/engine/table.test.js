import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockCharacter, mockAdversary } from '../helpers.js';

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
