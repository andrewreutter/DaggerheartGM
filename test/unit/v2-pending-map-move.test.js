import { describe, it, expect } from 'vitest';
import {
  getV2PendingMoveBlockInfo,
  clearV2PendingMoveElementsForRoll,
  registerV2PendingMapMove,
  unregisterV2PendingMapMovesForRoll,
  migrateV2PendingMapRollId,
  ensureV2PendingMapRegistry,
  collectV2PendingMapMoveReEvalUpdates,
  V2_KICK_PENDING_MAP_LOCK,
} from '../../src/client/lib/v2-pending-map-move.js';
import { getPendingMapRehydrateEntry } from '../../src/client/lib/v2-pending-map-rehydrate-registry.js';

describe('v2-pending-map-move', () => {
  it('getV2PendingMoveBlockInfo is blocked when an element has matching v2PendingMove', () => {
    const roll = { _rollDbId: 7 };
    const elements = [
      { instanceId: 'a', v2PendingMove: { rollDbId: 7, description: 'Knockback', moverInstanceId: 'a' } },
    ];
    expect(getV2PendingMoveBlockInfo(roll, elements)).toEqual({
      blocked: true,
      desiredCondition: 'Knockback',
      description: '',
      featureName: '',
    });
  });

  it('getV2PendingMoveBlockInfo includes featureName from registry when registered', () => {
    registerV2PendingMapMove({
      rollDbId: 7,
      moverInstanceId: 'a',
      conditionFn: () => false,
      desiredCondition: 'Knockback',
      chipStub: { _featureName: 'Kick', _ownerInstanceId: 'c1' },
    });
    const roll = { _rollDbId: 7 };
    const elements = [
      { instanceId: 'a', v2PendingMove: { rollDbId: 7, description: 'Knockback', moverInstanceId: 'a' } },
    ];
    expect(getV2PendingMoveBlockInfo(roll, elements)).toEqual({
      blocked: true,
      desiredCondition: 'Knockback',
      description: '',
      featureName: 'Kick',
    });
    unregisterV2PendingMapMovesForRoll(7);
  });

  it('getV2PendingMoveBlockInfo is not blocked when no match', () => {
    expect(getV2PendingMoveBlockInfo({ _rollDbId: 1 }, [{ instanceId: 'x', v2PendingMove: { rollDbId: 2 } }])).toEqual({
      blocked: false,
      desiredCondition: '',
      description: '',
      featureName: '',
    });
  });

  it('getV2PendingMoveBlockInfo is not blocked when conditionMet is true', () => {
    expect(
      getV2PendingMoveBlockInfo(
        { _rollDbId: 5 },
        [{ instanceId: 'a', v2PendingMove: { rollDbId: 5, moverInstanceId: 'a', conditionMet: true } }]
      )
    ).toEqual({
      blocked: false,
      desiredCondition: '',
      description: '',
      featureName: '',
    });
  });

  it('getV2PendingMoveBlockInfo treats rollDbId number vs string as the same roll', () => {
    expect(
      getV2PendingMoveBlockInfo(
        { _rollDbId: '42' },
        [{ instanceId: 'a', v2PendingMove: { rollDbId: 42, moverInstanceId: 'a', conditionMet: true } }]
      ).blocked
    ).toBe(false);
  });

  it('getV2PendingMoveBlockInfo resolves featureName from rehydrateKey when registry is empty', () => {
    expect(
      getV2PendingMoveBlockInfo(
        { _rollDbId: 77 },
        [
          {
            instanceId: 'm1',
            v2PendingMove: {
              rollDbId: 77,
              moverInstanceId: 'm1',
              rehydrateKey: 'faun.kick.push',
              conditionMet: false,
            },
          },
        ]
      ).featureName
    ).toBe('Kick');
  });

  it('rehydrate registry exposes Kick entries by rehydrateKey', () => {
    expect(getPendingMapRehydrateEntry('faun.kick.push')?.featureName).toBe('Kick');
    expect(getPendingMapRehydrateEntry('faun.kick.leap')?.featureName).toBe('Kick');
    expect(getPendingMapRehydrateEntry('unknown.key')).toBe(null);
  });

  it('ensureV2PendingMapRegistry does not register when rehydrateKey is missing', () => {
    const activeElements = [
      {
        instanceId: 'target-mover',
        v2PendingMove: {
          rollDbId: 902,
          moverInstanceId: 'target-mover',
          desiredCondition: 'Very Close',
          conditionMet: false,
          frozenInstanceId: 'attacker',
        },
      },
    ];
    const pendingBanners = [
      { _rollDbId: 902, _attackerInstanceId: 'attacker', _selectedTargetInstanceId: 'target-mover' },
    ];
    ensureV2PendingMapRegistry(activeElements, pendingBanners);
    expect(getV2PendingMoveBlockInfo({ _rollDbId: 902 }, activeElements).featureName).toBe('');
  });

  it('ensureV2PendingMapRegistry registers when rehydrateKey is persisted', () => {
    const activeElements = [
      {
        instanceId: 'target-mover',
        v2PendingMove: {
          rollDbId: 903,
          moverInstanceId: 'target-mover',
          rehydrateKey: 'faun.kick.push',
          desiredCondition: 'Very Close',
          conditionMet: false,
          frozenInstanceId: 'attacker',
        },
      },
    ];
    const pendingBanners = [
      { _rollDbId: 903, _attackerInstanceId: 'attacker', _selectedTargetInstanceId: 'target-mover' },
    ];
    ensureV2PendingMapRegistry(activeElements, pendingBanners);
    expect(getV2PendingMoveBlockInfo({ _rollDbId: 903 }, activeElements).featureName).toBe('Kick');
    unregisterV2PendingMapMovesForRoll(903);
  });

  it('collectV2PendingMapMoveReEvalUpdates returns [] without srdData', () => {
    expect(
      collectV2PendingMapMoveReEvalUpdates(
        [{ instanceId: 'm', v2PendingMove: { rollDbId: 1, moverInstanceId: 'm' } }],
        [{ _rollDbId: 1 }],
        null
      )
    ).toEqual([]);
  });

  it('ensureV2PendingMapRegistry repopulates registry after reload', () => {
    const activeElements = [
      {
        instanceId: 'mover',
        v2PendingMove: {
          rollDbId: 55,
          moverInstanceId: 'mover',
          rehydrateKey: 'faun.kick.push',
          desiredCondition: 'Very Close',
          description: '',
          conditionMet: false,
        },
      },
    ];
    const pendingBanners = [{ _rollDbId: 55, _attackerInstanceId: 'attacker' }];
    ensureV2PendingMapRegistry(activeElements, pendingBanners);
    expect(getV2PendingMoveBlockInfo({ _rollDbId: 55 }, activeElements).featureName).toBe('Kick');
    unregisterV2PendingMapMovesForRoll(55);
  });

  it('ensureV2PendingMapRegistry uses frozenInstanceId for Kick push when roll lacks attacker', () => {
    unregisterV2PendingMapMovesForRoll(56);
    const activeElements = [
      {
        instanceId: 'target-mover',
        v2PendingMove: {
          rollDbId: 56,
          moverInstanceId: 'target-mover',
          rehydrateKey: 'faun.kick.push',
          frozenInstanceId: 'faun-attacker',
          desiredCondition: 'x',
          conditionMet: false,
        },
      },
    ];
    const pendingBanners = [{ _rollDbId: 56 }];
    ensureV2PendingMapRegistry(activeElements, pendingBanners);
    expect(getV2PendingMoveBlockInfo({ _rollDbId: 56 }, activeElements).featureName).toBe('Kick');
    unregisterV2PendingMapMovesForRoll(56);
  });

  it('migrateV2PendingMapRollId finds registry entry when old roll id is string and entry is number', () => {
    registerV2PendingMapMove({
      rollDbId: 10,
      moverInstanceId: 'm1',
      conditionFn: () => false,
      desiredCondition: 'Kick line',
      chipStub: { _featureName: 'Kick', _ownerInstanceId: 'c1' },
    });
    const updates = migrateV2PendingMapRollId('10', 20);
    expect(updates).toEqual([
      {
        instanceId: 'm1',
        updates: {
          v2PendingMove: {
            rollDbId: 20,
            desiredCondition: 'Kick line',
            description: '',
            moverInstanceId: 'm1',
            conditionMet: false,
          },
        },
      },
    ]);
    unregisterV2PendingMapMovesForRoll(20);
  });

  it('clearV2PendingMoveElementsForRoll clears registry entries and returns updates', () => {
    registerV2PendingMapMove({
      rollDbId: 99,
      moverInstanceId: 'm1',
      conditionFn: () => false,
      desiredCondition: 'x',
      chipStub: { _featureName: 'Kick', _ownerInstanceId: 'c1' },
    });
    const activeElements = [{ instanceId: 'm1', v2PendingMove: { rollDbId: 99, moverInstanceId: 'm1' } }];
    const updates = clearV2PendingMoveElementsForRoll(99, activeElements);
    expect(updates).toEqual([{ instanceId: 'm1', updates: { v2PendingMove: null } }]);
    unregisterV2PendingMapMovesForRoll(99);
  });

  it('clearV2PendingMoveElementsForRoll removes frozen actor move lock', () => {
    const lock = 'Kick: pending map position';
    const activeElements = [
      {
        instanceId: 'm1',
        v2PendingMove: {
          rollDbId: 5,
          moverInstanceId: 'm1',
          frozenInstanceId: 'other',
          frozenLockSource: lock,
        },
      },
      { instanceId: 'other', moveDisabledSources: [lock] },
    ];
    const updates = clearV2PendingMoveElementsForRoll(5, activeElements);
    expect(updates).toEqual([
      { instanceId: 'm1', updates: { v2PendingMove: null } },
      {
        instanceId: 'other',
        updates: {
          moveDisabledSources: [],
          v2MoveLockRollDbId: null,
          v2MoveLockSource: null,
        },
      },
    ]);
  });

  it('clearV2PendingMoveElementsForRoll fallback unlocks by v2MoveLockRollDbId when mover blob missing', () => {
    const lock = 'Kick: pending map position';
    const activeElements = [
      {
        instanceId: 'only-frozen',
        moveDisabledSources: [lock],
        v2MoveLockRollDbId: 12,
        v2MoveLockSource: lock,
      },
    ];
    const updates = clearV2PendingMoveElementsForRoll(12, activeElements);
    expect(updates).toEqual([
      {
        instanceId: 'only-frozen',
        updates: {
          moveDisabledSources: [],
          v2MoveLockRollDbId: null,
          v2MoveLockSource: null,
        },
      },
    ]);
  });

  it('clearV2PendingMoveElementsForRoll rollMeta strips Kick lock when roll id migrated off mover blob', () => {
    const lock = V2_KICK_PENDING_MAP_LOCK;
    const activeElements = [
      { instanceId: 'mover', v2PendingMove: { rollDbId: 195, moverInstanceId: 'mover' } },
      {
        instanceId: 'attacker',
        moveDisabledSources: [lock],
        v2MoveLockRollDbId: 194,
        v2MoveLockSource: lock,
      },
    ];
    const updates = clearV2PendingMoveElementsForRoll(195, activeElements, {
      _attackerInstanceId: 'attacker',
      _selectedTargetInstanceId: 'mover',
    });
    const attacker = updates.find((u) => u.instanceId === 'attacker');
    expect(attacker?.updates.moveDisabledSources).toEqual([]);
    expect(attacker?.updates.v2MoveLockRollDbId).toBe(null);
    expect(attacker?.updates.v2MoveLockSource).toBe(null);
  });

  it('migrateV2PendingMapRollId updates registry and element patch', () => {
    registerV2PendingMapMove({
      rollDbId: 10,
      moverInstanceId: 'm1',
      conditionFn: () => false,
      desiredCondition: 'Kick line',
      chipStub: { _featureName: 'Kick', _ownerInstanceId: 'c1' },
    });
    const updates = migrateV2PendingMapRollId(10, 20);
    expect(updates).toEqual([
      {
        instanceId: 'm1',
        updates: {
          v2PendingMove: {
            rollDbId: 20,
            desiredCondition: 'Kick line',
            description: '',
            moverInstanceId: 'm1',
            conditionMet: false,
          },
        },
      },
    ]);
    const roll = { _rollDbId: 20 };
    const elements = [{ instanceId: 'm1', v2PendingMove: updates[0].updates.v2PendingMove }];
    expect(getV2PendingMoveBlockInfo(roll, elements).blocked).toBe(true);
    expect(getV2PendingMoveBlockInfo(roll, elements).featureName).toBe('Kick');
    unregisterV2PendingMapMovesForRoll(20);
  });

  it('migrateV2PendingMapRollId preserves conditionMet true from activeElements', () => {
    registerV2PendingMapMove({
      rollDbId: 10,
      moverInstanceId: 'm1',
      conditionFn: () => true,
      desiredCondition: 'Kick line',
      chipStub: { _featureName: 'Kick', _ownerInstanceId: 'c1' },
    });
    const updates = migrateV2PendingMapRollId(10, 20, [
      { instanceId: 'm1', v2PendingMove: { rollDbId: 10, moverInstanceId: 'm1', conditionMet: true } },
    ]);
    expect(updates[0].updates.v2PendingMove.conditionMet).toBe(true);
    unregisterV2PendingMapMovesForRoll(20);
  });

  it('migrateV2PendingMapRollId preserves rehydrateKey from activeElements', () => {
    registerV2PendingMapMove({
      rollDbId: 10,
      moverInstanceId: 'm1',
      conditionFn: () => false,
      desiredCondition: 'Kick line',
      chipStub: { _featureName: 'Kick', _ownerInstanceId: 'c1' },
    });
    const updates = migrateV2PendingMapRollId(10, 20, [
      { instanceId: 'm1', v2PendingMove: { rollDbId: 10, moverInstanceId: 'm1', rehydrateKey: 'faun.kick.leap' } },
    ]);
    expect(updates[0].updates.v2PendingMove.rehydrateKey).toBe('faun.kick.leap');
    unregisterV2PendingMapMovesForRoll(20);
  });

  it('migrateV2PendingMapRollId updates frozen element v2MoveLockRollDbId when present', () => {
    registerV2PendingMapMove({
      rollDbId: 10,
      moverInstanceId: 'm1',
      conditionFn: () => false,
      desiredCondition: 'Kick line',
      chipStub: { _featureName: 'Kick', _ownerInstanceId: 'c1' },
    });
    const updates = migrateV2PendingMapRollId(10, 20, [
      {
        instanceId: 'm1',
        v2PendingMove: {
          rollDbId: 10,
          moverInstanceId: 'm1',
          frozenInstanceId: 'other',
          frozenLockSource: 'Kick: pending map position',
        },
      },
    ]);
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual({ instanceId: 'other', updates: { v2MoveLockRollDbId: 20 } });
    unregisterV2PendingMapMovesForRoll(20);
  });
});
