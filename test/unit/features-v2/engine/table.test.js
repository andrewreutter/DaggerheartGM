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
    expect(table.featureState).toBeDefined();
    expect(typeof table.featureState).toBe('object');
  });

  it('exposes gameState.featureState on the snapshot as table.featureState', () => {
    const fs = { Reinforced: { reinforcedActive: true } };
    const table = buildTableSnapshot(mockGameState({ featureState: fs }));
    expect(table.featureState).toBe(fs);
  });

  it('defaults table.mutationBatch to [] when _mutationBatch is absent', () => {
    const table = buildTableSnapshot(mockGameState());
    expect(table.mutationBatch).toEqual([]);
  });

  it('exposes a copy of _mutationBatch on table.mutationBatch', () => {
    const batch = [{ type: 'clearArmor', payload: { instanceId: 'c1', amount: 1 } }];
    const table = buildTableSnapshot(mockGameState({ _mutationBatch: batch }));
    expect(table.mutationBatch).toEqual(batch);
    expect(table.mutationBatch).not.toBe(batch);
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

  it('table.me.weaponRenderHints and primaryWeapon.isDisabled respect merged hints on the element', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      traits: { presence: 2 },
      primaryWeapon: { id: 'w-pomp', name: 'Test', tier: 1, range: 'melee', trait: 'agility', damage: 'd6' },
      weaponRenderHints: { 'w-pomp': { isDisabled: true, disabledReason: 'Requires Presence ≤ 0' } },
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.weaponRenderHints).toEqual({
      'w-pomp': { isDisabled: true, disabledReason: 'Requires Presence ≤ 0' },
    });
    expect(table.me?.primaryWeapon?.isDisabled).toBe(true);
    expect(table.me?.primaryWeapon?.disabledReason).toBe('Requires Presence ≤ 0');
  });

  it('exposes beastformOptions from element._beastformOptions for characters', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      _beastformOptions: [{ id: 'srd-bst-test', name: 'Test Form', tier: 1 }],
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.beastformOptions).toHaveLength(1);
    expect(table.me?.beastformOptions[0].id).toBe('srd-bst-test');
  });

  it('returns [] for beastformOptions on adversaries even if _beastformOptions is set', () => {
    const adv = mockAdversary({
      instanceId: 'a1',
      _beastformOptions: [{ id: 'x', name: 'n', tier: 1 }],
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [adv], _ownerInstanceId: 'a1' }));
    expect(table.me?.beastformOptions).toEqual([]);
  });

  it('exposes inBeastform when element has activeBeastform with id', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      _beastformOptions: [{ id: 'srd-bst-test', name: 'Test Form', tier: 1 }],
      activeBeastform: { id: 'srd-bst-test', name: 'Test Form' },
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.inBeastform).toBe(true);
  });

  it('exposes inBeastform when element uses beastformId', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      activeBeastform: { beastformId: 'srd-bst-agile-scout' },
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.inBeastform).toBe(true);
  });

  it('exposes inBeastform from gameState.featureState.Beastform', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      featureState: {
        Beastform: { activeBeastform: { beastformId: 'srd-bst-agile-scout' } },
      },
    }));
    expect(table.me?.inBeastform).toBe(true);
  });

  it('inBeastform is false when no active form', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      _beastformOptions: [{ id: 'x', name: 'n', tier: 1 }],
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me?.inBeastform).toBe(false);
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

  it('exposes weaponId on table.action when present in gameState', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w-primary',
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    expect(table.action?.weaponId).toBe('w-primary');
  });

  it('exposes armorScore and gold on table.me for resource features', () => {
    const char = mockCharacter({ instanceId: 'char-1', armorScore: 3, gold: 18 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    expect(table.me?.armorScore).toBe(3);
    expect(table.me?.gold).toBe(18);
  });

  it('exposes difficulty on adversary actors', () => {
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [adv], _ownerInstanceId: 'adv-1' }));
    expect(table.me?.difficulty).toBe(12);
  });

  it('exposes difficultyMod, effectiveDifficulty on adversaries', () => {
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12, difficultyMod: -2 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [adv], _ownerInstanceId: 'adv-1' }));
    expect(table.me?.difficultyMod).toBe(-2);
    expect(table.me?.effectiveDifficulty).toBe(10);
  });

  it('queues runtimeStatMod via actor.applyStatMod("difficulty", …)', () => {
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 14 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [adv], _ownerInstanceId: 'adv-1' }));
    table.me.applyStatMod('difficulty', -2);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'runtimeStatMod',
        payload: { instanceId: 'adv-1', stat: 'difficulty', delta: -2 },
      })
    );
  });

  it('applyStatMod("difficulty") throws on a character', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    expect(() => table.me.applyStatMod('difficulty', -2)).toThrow(/adversaries/);
  });

  it('applyStatMod throws for an unknown stat key', () => {
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [adv], _ownerInstanceId: 'adv-1' }));
    expect(() => table.me.applyStatMod('evasion', 1)).toThrow(/unsupported stat/);
  });

  it('exposes focusTargetInstanceId and isFocusTarget on actors', () => {
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const char = mockCharacter({ instanceId: 'char-1', focusTargetInstanceId: 'adv-1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char, adv], _ownerInstanceId: 'char-1' }));
    expect(table.me?.focusTargetInstanceId).toBe('adv-1');
    expect(table.me?.isFocusTarget(table.adversaries[0])).toBe(true);
  });

  it('falls back legacy focusTargetId to focusTargetInstanceId', () => {
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const char = mockCharacter({ instanceId: 'char-1', focusTargetId: 'adv-1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char, adv], _ownerInstanceId: 'char-1' }));
    expect(table.me?.focusTargetInstanceId).toBe('adv-1');
  });

  it('queues setFocusTarget when table.me.setFocusTarget is called', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    table.me.setFocusTarget('adv-9');
    const mutations = applyMutations(table);
    expect(mutations.some((m) => m.type === 'setFocusTarget')).toBe(true);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFocusTarget',
        payload: { instanceId: 'char-1', focusTargetInstanceId: 'adv-9' },
      })
    );
  });

  it('exposes rangerFocusOnNextAttack and focusedBy on actors', () => {
    const adv = mockAdversary({ instanceId: 'adv-1', focusedBy: 'Aria' });
    const char = mockCharacter({ instanceId: 'char-1', rangerFocusOnNextAttack: true });
    const tAdv = buildTableSnapshot(mockGameState({ activeElements: [adv], _ownerInstanceId: 'adv-1' }));
    const tChar = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    expect(tChar.me?.rangerFocusOnNextAttack).toBe(true);
    expect(tAdv.me?.focusedBy).toBe('Aria');
  });

  it('queues setRangerFocusOnNextAttack and setFocusedBy mutations', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    table.me.setRangerFocusOnNextAttack(true);
    const m1 = applyMutations(table);
    expect(m1).toContainEqual(
      expect.objectContaining({
        type: 'setRangerFocusOnNextAttack',
        payload: { instanceId: 'char-1', value: true },
      })
    );
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const t2 = buildTableSnapshot(mockGameState({ activeElements: [adv], _ownerInstanceId: 'adv-1' }));
    t2.me.setFocusedBy('Aria');
    const m2 = applyMutations(t2);
    expect(m2).toContainEqual(
      expect.objectContaining({
        type: 'setFocusedBy',
        payload: { instanceId: 'adv-1', focusedBy: 'Aria' },
      })
    );
  });

  it('exposes focus target id on table.me for comparison to table.action.target (no action-level Focus helper)', () => {
    const char = mockCharacter({ instanceId: 'char-1', focusTargetId: 'adv-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    const stored = table.me?.focusTargetInstanceId;
    const targetId = table.action?.target?.instanceId;
    expect(stored).toBe('adv-1');
    expect(targetId).toBe('adv-1');
    expect(stored === targetId).toBe(true);
  });

  it('exposes reactionContext and isLeaveMeleeReaction on table.action', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'a1' });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        action: {
          type: 'reaction',
          actorInstanceId: 'c1',
          targetInstanceIds: ['a1'],
          trait: 'Agility',
          reactionContext: { kind: 'leaveMelee', moverInstanceId: 'a1' },
          effects: [],
          appliedEffects: [],
        },
      })
    );
    expect(table.action.reactionContext).toEqual({ kind: 'leaveMelee', moverInstanceId: 'a1' });
    expect(table.action.isLeaveMeleeReaction).toBe(true);
  });

  it('exposes table.tokenMove only when _tokenMove is set', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 10, tokenY: 0 });
    const t1 = buildTableSnapshot(
      mockGameState({ activeElements: [char, adv], _ownerInstanceId: 'c1' })
    );
    expect(t1.tokenMove).toBeUndefined();

    const t2 = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'c1',
        _tokenMove: { moverInstanceId: 'a1' },
        _previousPositions: { a1: { tokenX: 2, tokenY: 0 } },
      })
    );
    expect(t2.tokenMove?.moverInstanceId).toBe('a1');
    expect(t2.tokenMove?.mover?.instanceId).toBe('a1');
    expect(t2.me?.instanceId).toBe('c1');
  });

  it('queues spendGold mutation from table.me.spendGold', () => {
    const char = mockCharacter({ instanceId: 'char-1', gold: 20 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    table.me.spendGold(9);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'spendGold', payload: { instanceId: 'char-1', amount: 9 } })
    );
  });

  it('exposes activeFeature and source for declarative weapon features', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const feat = { name: 'TestProp', _weaponId: 'w1', _sourceObject: { id: 'w1', tier: 2 } };
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _activeFeature: feat,
        _sourceObject: feat._sourceObject,
      })
    );
    expect(table.activeFeature).toBe(feat);
    expect(table.source?.tier).toBe(2);
  });

  it('exposes useArmorByTargetId and per-effect useArmor on table.action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const dmg = {
      type: 'damage',
      target: { instanceId: 'char-1', name: char.name },
      amount: 2,
      damageType: 'phy',
      useArmor: true,
    };
    const state = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        useArmorByTargetId: { 'char-1': true },
        effects: [dmg],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(state);
    expect(table.action?.useArmorByTargetId).toEqual({ 'char-1': true });
    expect(table.action?.effects?.[0]?.useArmor).toBe(true);
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

  it('domainLoadout / domainVault are snapshots; moveDomainCardToVault queues domainCardMoveToVault', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      domainLoadout: [{ id: 'a', level: 1 }],
      domainVault: [{ id: 'b', level: 2 }],
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me.domainLoadout).toEqual([{ id: 'a', level: 1 }]);
    expect(table.me.domainVault).toEqual([{ id: 'b', level: 2 }]);
    table.me.moveDomainCardToVault('a');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: { instanceId: 'c1', cardId: 'a' },
      })
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

  it('spendHope with armorInstead queues markArmor when substituteArmorForHope and slots are available', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      substituteArmorForHope: true,
      currentArmor: 2,
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me.substituteArmorForHope).toBe(true);
    table.me.spendHope(1, { armorInstead: true });
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markArmor', payload: { instanceId: 'c1', amount: 1 } })
    );
    expect(mutations.find((m) => m.type === 'spendHope')).toBeUndefined();
  });

  it('spendHope with armorInstead throws without substituteArmorForHope', () => {
    const char = mockCharacter({ instanceId: 'c1', currentArmor: 2 });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(table.me.substituteArmorForHope).toBe(false);
    expect(() => table.me.spendHope(1, { armorInstead: true })).toThrow(/substituteArmorForHope/);
  });

  it('spendHope with armorInstead throws when not enough armor slots', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      substituteArmorForHope: true,
      currentArmor: 0,
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    expect(() => table.me.spendHope(1, { armorInstead: true })).toThrow(/Not enough available armor/);
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

  it('swapHopeFear queues swapHopeFearDice and swaps backing die values', () => {
    const gs = mockGameState({
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 9 },
          dice: [],
          statics: [],
          isSuccess: true,
          isCritical: false,
        },
        damage: {},
      },
    });
    const table = buildTableSnapshot(gs);
    table.rolls.action.swapHopeFear();
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'swapHopeFearDice', payload: { rollKey: 'action' } })
    );
    expect(table.rolls.action.hopeDie.value).toBe(9);
    expect(table.rolls.action.fearDie.value).toBe(3);
  });

  it('gmDie reroll queues rerollDie with dieType gmDie (adversary / GM attack)', () => {
    const table = buildTableSnapshot(
      mockGameState({
        rolls: mockRoll({
          action: {
            gmDie: { value: 12 },
            hopeDie: null,
            fearDie: null,
            dice: [],
            statics: [],
            isSuccess: true,
            isCritical: false,
          },
        }),
      })
    );
    table.rolls.action.gmDie.reroll();
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie', payload: { rollKey: 'action', dieType: 'gmDie' } })
    );
  });

  it('damage rerollAllDice queues rerollDie for each named die', () => {
    const table = buildTableSnapshot(
      mockGameState({
        rolls: mockRoll({
          damageDice: [
            { name: 'A', die: 'd8', value: 3 },
            { name: 'B', die: 'd6', value: 2 },
          ],
        }),
      })
    );
    table.rolls.damage.rerollAllDice();
    const mutations = applyMutations(table);
    expect(mutations).toHaveLength(2);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'damage', dieType: 'damageDie', dieName: 'A' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'damage', dieType: 'damageDie', dieName: 'B' },
      })
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

  const DUALITY_TYPES = ['action', 'trait', 'attack', 'spellcast', 'reaction', 'tagTeam'];
  const NON_DUALITY_TYPES = ['damage', 'free', 'shortRest', 'longRest', 'sessionStart'];
  const HOPE_FEAR_TYPES = ['action', 'trait', 'attack', 'spellcast', 'tagTeam'];
  const NO_HOPE_FEAR_TYPES = ['reaction', 'damage', 'free'];
  const TRAIT_FINAL_TYPES = ['trait', 'attack', 'spellcast', 'reaction', 'tagTeam'];
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

  for (const type of ['action', 'trait', 'attack', 'spellcast', 'tagTeam', 'damage']) {
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

describe('table.source (shared option state)', () => {
  it('is null when there is no source row', () => {
    const table = buildTableSnapshot(mockGameState({}));
    expect(table.source).toBeNull();
  });

  it('is the raw row when sourceScopeKey is absent', () => {
    const row = { name: 'Plain', tier: 1 };
    const table = buildTableSnapshot(
      mockGameState({
        _activeFeature: { name: 'X', _sourceObject: row },
        _sourceObject: row,
      })
    );
    expect(table.source).toBe(row);
  });

  it('adds get/set that share one featureState bag and queue setFeatureState', () => {
    const row = { name: 'Warden of the Elements', sourceScopeKey: 'WardenOfTheElements' };
    const fs = {};
    const table = buildTableSnapshot(
      mockGameState({
        _featureKey: 'Elemental Incarnation',
        _activeFeature: {
          name: 'Elemental Incarnation',
          _sourceScopeKey: 'WardenOfTheElements',
          _sourceObject: row,
        },
        _sourceObject: row,
        featureState: fs,
      })
    );
    expect(table.source.name).toBe('Warden of the Elements');
    expect(table.source.get('channeledElement')).toBeUndefined();
    table.source.set('channeledElement', 'air');
    expect(table.source.get('channeledElement')).toBe('air');
    expect(fs.WardenOfTheElements?.channeledElement).toBe('air');
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: { featureKey: 'WardenOfTheElements', key: 'channeledElement', value: 'air' },
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

  describe('table.action.reduceIncomingPhysicalSeverityBySteps', () => {
    it('reduces incoming physical damage amounts for the feature owner', () => {
      const char = mockCharacter({ instanceId: 'char-1' });
      const adv = mockAdversary({ instanceId: 'adv-1' });
      const effects = [
        {
          type: 'damage',
          target: { instanceId: 'char-1' },
          amount: 3,
          damageType: 'physical',
        },
      ];
      const gs = mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
          appliedEffects: [],
        },
      });
      const table = buildTableSnapshot(gs);
      table.action.reduceIncomingPhysicalSeverityBySteps(1);
      expect(effects[0].amount).toBe(2);
      table.action.reduceIncomingPhysicalSeverityBySteps(2);
      expect(effects[0].amount).toBe(0);
    });

    it('ignores magic damage and damage to other targets', () => {
      const char = mockCharacter({ instanceId: 'char-1' });
      const adv = mockAdversary({ instanceId: 'adv-1' });
      const effects = [
        {
          type: 'damage',
          target: { instanceId: 'char-1' },
          amount: 3,
          damageType: 'magic',
        },
        {
          type: 'damage',
          target: { instanceId: 'adv-1' },
          amount: 2,
          damageType: 'physical',
        },
      ];
      const gs = mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
          appliedEffects: [],
        },
      });
      const table = buildTableSnapshot(gs);
      table.action.reduceIncomingPhysicalSeverityBySteps(1);
      expect(effects[0].amount).toBe(3);
      expect(effects[1].amount).toBe(2);
    });
  });

  describe('activeModifiers (actor API)', () => {
    it('exposes activeModifiers from element.activeModifiers', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        activeModifiers: [{ id: 'm1', name: 'Rally Die', dice: 'd8' }],
      });
      const t = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      expect(t.me.activeModifiers).toEqual([{ id: 'm1', name: 'Rally Die', dice: 'd8' }]);
    });

    it('addActiveModifier and removeActiveModifier queue mutations', () => {
      const char = mockCharacter({ instanceId: 'c1' });
      const t = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      t.me.addActiveModifier({ id: 'x1', name: 'Test', dice: 'd6', refreshOn: 'session' });
      let m = applyMutations(t);
      expect(
        m.some(
          (x) =>
            x.type === 'appendActiveModifier' &&
            x.payload.instanceId === 'c1' &&
            x.payload.modifier?.id === 'x1'
        )
      ).toBe(true);
      t.me.removeActiveModifier('x1');
      m = applyMutations(t);
      expect(m.some((x) => x.type === 'removeActiveModifier' && x.payload.id === 'x1')).toBe(true);
    });

    it('derives tier from level when element.tier is absent', () => {
      const char = mockCharacter({ instanceId: 'c1', level: 1 });
      const t = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      expect(t.me.tier).toBe(1);
      const char5 = mockCharacter({ instanceId: 'c2', level: 5 });
      const t2 = buildTableSnapshot(mockGameState({ activeElements: [char5], _ownerInstanceId: 'c2' }));
      expect(t2.me.tier).toBe(3);
    });

    it('exposes contactsEverywhereSessionUses (default 1)', () => {
      const char = mockCharacter({ instanceId: 'c1' });
      const t = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      expect(t.me.contactsEverywhereSessionUses).toBe(1);
      const char3 = mockCharacter({ instanceId: 'c2', contactsEverywhereSessionUses: 3 });
      const t2 = buildTableSnapshot(mockGameState({ activeElements: [char3], _ownerInstanceId: 'c2' }));
      expect(t2.me.contactsEverywhereSessionUses).toBe(3);
    });

    it('exposes shadowStepperVeryFarUnlocked (default false)', () => {
      const char = mockCharacter({ instanceId: 'c1' });
      const t = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      expect(t.me.shadowStepperVeryFarUnlocked).toBe(false);
      const char2 = mockCharacter({ instanceId: 'c2', shadowStepperVeryFarUnlocked: true });
      const t2 = buildTableSnapshot(mockGameState({ activeElements: [char2], _ownerInstanceId: 'c2' }));
      expect(t2.me.shadowStepperVeryFarUnlocked).toBe(true);
    });
  });

  describe('Prayer Dice pool + reducePendingDamageForTarget', () => {
    it('exposes spellcastTrait and prayerDice from element', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        spellcastTrait: 'presence',
        prayerDice: { pool: [2, 3] },
      });
      const t = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      expect(t.me.spellcastTrait).toBe('presence');
      expect(t.me.prayerDice).toEqual({ pool: [2, 3] });
    });

    it('setPrayerDicePool, removePrayerDieAt, clearPrayerDicePool queue mutations', () => {
      const char = mockCharacter({ instanceId: 'c1' });
      const t = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      t.me.setPrayerDicePool([1, 4]);
      let m = applyMutations(t);
      expect(m.some((x) => x.type === 'setPrayerDicePool' && x.payload.pool.length === 2)).toBe(true);
      t.me.removePrayerDieAt(0);
      m = applyMutations(t);
      expect(m.some((x) => x.type === 'removePrayerDieAt' && x.payload.index === 0)).toBe(true);
      t.me.clearPrayerDicePool();
      m = applyMutations(t);
      expect(m.some((x) => x.type === 'setPrayerDicePool' && x.payload.pool.length === 0)).toBe(true);
    });

    it('reducePendingDamageForTarget reduces damage when ally within Far, not when veryFar', () => {
      const seraph = mockCharacter({ instanceId: 's1', tokenX: 0, tokenY: 0 });
      const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 40, tokenY: 0, hope: 3 });
      const effects = [{ type: 'damage', target: { instanceId: 'ally-1' }, amount: 10, damageType: 'physical' }];
      const gs = mockGameState({
        activeElements: [seraph, ally],
        _ownerInstanceId: 's1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          effects,
          appliedEffects: [],
        },
      });
      const table = buildTableSnapshot(gs);
      table.action.reducePendingDamageForTarget('ally-1', 3);
      expect(effects[0].amount).toBe(7);

      const allyFar = { ...ally, instanceId: 'ally-2', tokenX: 200, tokenY: 0 };
      const effects2 = [{ type: 'damage', target: { instanceId: 'ally-2' }, amount: 10, damageType: 'physical' }];
      const gs2 = mockGameState({
        activeElements: [seraph, allyFar],
        _ownerInstanceId: 's1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-2'],
          effects: effects2,
          appliedEffects: [],
        },
      });
      const table2 = buildTableSnapshot(gs2);
      table2.action.reducePendingDamageForTarget('ally-2', 3);
      expect(effects2[0].amount).toBe(10);
    });

    it('reducePendingDamageForTarget works for self without range check', () => {
      const seraph = mockCharacter({ instanceId: 's1', tokenX: 0, tokenY: 0 });
      const effects = [{ type: 'damage', target: { instanceId: 's1' }, amount: 5, damageType: 'physical' }];
      const gs = mockGameState({
        activeElements: [seraph],
        _ownerInstanceId: 's1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['s1'],
          effects,
          appliedEffects: [],
        },
      });
      const table = buildTableSnapshot(gs);
      table.action.reducePendingDamageForTarget('s1', 2);
      expect(effects[0].amount).toBe(3);
    });
  });

  describe('Tag Team session API', () => {
    it('exposes budget, remaining, consume, and reset mutations', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        extraTagTeamInitiationsPerSession: 1,
        tagTeamInitiationsUsedThisSession: 0,
      });
      const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      expect(table.me.tagTeamInitiationsBudget).toBe(2);
      expect(table.me.tagTeamInitiationsRemaining).toBe(2);
      table.me.consumeTagTeamInitiation();
      let m = applyMutations(table);
      expect(m.some((x) => x.type === 'setTagTeamInitiationsUsed' && x.payload.value === 1)).toBe(true);
      table.me.resetTagTeamInitiationsForSession();
      m = applyMutations(table);
      expect(m.some((x) => x.type === 'setTagTeamInitiationsUsed' && x.payload.value === 0)).toBe(true);
    });

    it('throws when consumeTagTeamInitiation exceeds budget', () => {
      const char = mockCharacter({
        instanceId: 'c1',
        tagTeamInitiationsUsedThisSession: 1,
      });
      const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
      expect(table.me.tagTeamInitiationsRemaining).toBe(0);
      expect(() => table.me.consumeTagTeamInitiation()).toThrow(/No Tag Team initiations remaining/);
    });

    it('tagTeamInitiatorHopeCost uses partner discount when type is tagTeam', () => {
      const partner = mockCharacter({ instanceId: 'partner', tagTeamPartnerHopeDiscount: 1 });
      const initiator = mockCharacter({ instanceId: 'init' });
      const gs = mockGameState({
        activeElements: [partner, initiator],
        _ownerInstanceId: 'init',
        action: {
          type: 'tagTeam',
          actorInstanceId: 'init',
          targetInstanceIds: [],
          tagTeamPartnerInstanceId: 'partner',
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      });
      const table = buildTableSnapshot(gs);
      expect(table.action.tagTeamPartnerInstanceId).toBe('partner');
      expect(table.action.tagTeamInitiatorHopeCost).toBe(2);
    });

    it('tagTeamInitiatorHopeCost is 3 when type is not tagTeam', () => {
      const partner = mockCharacter({ instanceId: 'partner', tagTeamPartnerHopeDiscount: 1 });
      const initiator = mockCharacter({ instanceId: 'init' });
      const gs = mockGameState({
        activeElements: [partner, initiator],
        _ownerInstanceId: 'init',
        action: {
          type: 'attack',
          actorInstanceId: 'init',
          targetInstanceIds: [partner.instanceId],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      });
      const table = buildTableSnapshot(gs);
      expect(table.action.tagTeamInitiatorHopeCost).toBe(3);
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
