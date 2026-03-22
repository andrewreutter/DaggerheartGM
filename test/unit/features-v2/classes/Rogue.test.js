import { describe, it, expect } from 'vitest';
import { RoguesDodge, Cloaked, SneakAttack } from '../../../../src/features-v2/classes/Rogue.js';
import {
  dispatchStateChangeHooks,
  dispatchTokenMoveHooks,
} from '../../../../src/features-v2/engine/action-loop.js';
import {
  mockAction,
  mockCharacter,
  mockAdversary,
  mockRoll,
  runIntent,
  runResolve,
  runReviewAction,
} from '../helpers.js';

const ROGUE_DODGE_KEY = "Rogue's Dodge";

describe("Rogue's Dodge", () => {
  it('queues +2 temporary evasion on intent when targeted, attack, and buff is active', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...RoguesDodge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        featureState: { [ROGUE_DODGE_KEY]: { roguesDodgeActive: true } },
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          stat: 'evasion',
          value: 2,
        }),
      })
    );
  });

  it('does not queue evasion when the buff is inactive', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...RoguesDodge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        featureState: { [ROGUE_DODGE_KEY]: { roguesDodgeActive: false } },
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addTemporaryStatMod')).toHaveLength(0);
  });

  it('clears roguesDodgeActive on resolve when the attack against you succeeds', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(
      { ...RoguesDodge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        featureState: { [ROGUE_DODGE_KEY]: { roguesDodgeActive: true } },
        rolls: mockRoll({ action: { isSuccess: true } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: ROGUE_DODGE_KEY,
          key: 'roguesDodgeActive',
          value: false,
        }),
      })
    );
  });

  it('does not clear roguesDodgeActive when the attack misses', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(
      { ...RoguesDodge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        featureState: { [ROGUE_DODGE_KEY]: { roguesDodgeActive: true } },
        rolls: mockRoll({ action: { isSuccess: false } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(
      mutations.filter(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload?.key === 'roguesDodgeActive' &&
          m.payload?.value === false
      )
    ).toHaveLength(0);
  });

  it('clears roguesDodgeActive on a short rest', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...RoguesDodge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        featureState: { [ROGUE_DODGE_KEY]: { roguesDodgeActive: true } },
        actionType: 'shortRest',
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: ROGUE_DODGE_KEY,
          key: 'roguesDodgeActive',
          value: false,
        }),
      })
    );
  });
});

describe('Cloaked', () => {
  it('onStateChange swaps Hidden for Cloaked on the rogue', () => {
    const rogue = mockCharacter({ instanceId: 'c1', conditions: ['Hidden'] });
    const batch = [{ type: 'addCondition', payload: { instanceId: 'c1', condition: 'Hidden' } }];

    const { mutations } = dispatchStateChangeHooks(
      {
        fear: 0,
        activeElements: [rogue],
        featureState: {},
      },
      [{ ...Cloaked, _ownerInstanceId: 'c1' }],
      batch
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: { instanceId: 'c1', condition: 'Hidden' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'c1', condition: 'Cloaked' },
      })
    );
  });

  it('removes Cloaked on resolve after the rogue makes an attack', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(
      { ...Cloaked, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll(),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: { instanceId: 'char-1', condition: 'Cloaked' },
      })
    );
  });

  it('onTokenMove removes Cloaked when the rogue ends a move within Far of an adversary', () => {
    const rogue = mockCharacter({
      instanceId: 'r1',
      conditions: ['Cloaked'],
      tokenX: 10,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const gameState = {
      fear: 0,
      activeElements: [rogue, adv],
      featureState: {},
      _previousPositions: { r1: { tokenX: 0, tokenY: 0 } },
    };

    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...Cloaked, _ownerInstanceId: 'r1' }],
      { moverInstanceId: 'r1' }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: { instanceId: 'r1', condition: 'Cloaked' },
      })
    );
  });

  it('onTokenMove does not remove Cloaked when the only adversaries are Very Far away', () => {
    const rogue = mockCharacter({
      instanceId: 'r1',
      conditions: ['Cloaked'],
      tokenX: 150,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const gameState = {
      fear: 0,
      activeElements: [rogue, adv],
      featureState: {},
      _previousPositions: { r1: { tokenX: 200, tokenY: 0 } },
    };

    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...Cloaked, _ownerInstanceId: 'r1' }],
      { moverInstanceId: 'r1' }
    );

    expect(mutations.filter((m) => m.type === 'removeCondition')).toHaveLength(0);
  });

  it('onTokenMove does not remove Cloaked when an adversary moves (not the rogue)', () => {
    const rogue = mockCharacter({
      instanceId: 'r1',
      conditions: ['Cloaked'],
      tokenX: 0,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const gameState = {
      fear: 0,
      activeElements: [rogue, adv],
      featureState: {},
      _previousPositions: { 'adv-1': { tokenX: 40, tokenY: 0 } },
    };

    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...Cloaked, _ownerInstanceId: 'r1' }],
      { moverInstanceId: 'adv-1' }
    );

    expect(mutations.filter((m) => m.type === 'removeCondition')).toHaveLength(0);
  });
});

describe('Sneak Attack', () => {
  it('adds tier d6 to damage on a successful attack while Cloaked', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', level: 5, conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({
          action: { isSuccess: true },
          damageDice: [{ name: 'weapon', die: 'd6', value: 3 }],
        }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Sneak Attack',
          die: '3d6',
        }),
      })
    );
  });

  it('does not add dice when not Cloaked and no ally is in melee of the target', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 30, tokenY: 0 });

    const { mutations } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({ action: { isSuccess: true } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.payload?.name === 'Sneak Attack')).toHaveLength(0);
  });

  it('adds dice when an ally is in melee of the target (without Cloaked)', () => {
    const rogue = mockCharacter({ instanceId: 'r1', tokenX: 40, tokenY: 0, level: 2 });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 8, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });

    const { mutations } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'r1' },
      {
        activeElements: [rogue, ally, adv],
        rolls: mockRoll({
          action: { isSuccess: true },
          damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
        }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'r1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Sneak Attack',
          die: '2d6',
        }),
      })
    );
  });

  it('does not add dice on a failed attack', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({ action: { isSuccess: false } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.payload?.name === 'Sneak Attack')).toHaveLength(0);
  });

  it('does not fire on a successful trait roll (CONV-025)', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({ action: { isSuccess: true } }),
        action: mockAction({
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.payload?.name === 'Sneak Attack')).toHaveLength(0);
  });
});
