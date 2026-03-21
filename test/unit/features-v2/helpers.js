/**
 * V2 Feature Engine — Test Helpers
 *
 * Factory functions and phase-simulation helpers for writing concise feature
 * tests. Import these instead of touching the engine directly.
 */

import { buildTableSnapshot } from '../../../src/features-v2/engine/table.js';
import { createActionLoop } from '../../../src/features-v2/engine/action-loop.js';
import { collectChips } from '../../../src/features-v2/engine/chip-system.js';
import { unwrap } from '../../../src/features-v2/engine/when.js';

// ---------------------------------------------------------------------------
// Entity factories
// ---------------------------------------------------------------------------

/**
 * Build a minimal character element suitable for use in gameState.activeElements.
 */
export function mockCharacter(overrides = {}) {
  return {
    instanceId: overrides.instanceId ?? 'char-1',
    elementType: 'character',
    name: overrides.name ?? 'Test Character',
    currentHp: overrides.currentHp ?? 4,
    maxHp: overrides.maxHp ?? 6,
    currentStress: overrides.currentStress ?? 0,
    maxStress: overrides.maxStress ?? 6,
    hope: overrides.hope ?? 3,
    maxHope: overrides.maxHope ?? 6,
    currentArmor: overrides.currentArmor ?? 3,
    maxArmor: overrides.maxArmor ?? 3,
    conditions: overrides.conditions ?? [],
    traits: overrides.traits ?? {
      agility: 1,
      strength: 1,
      finesse: 0,
      instinct: 0,
      presence: 0,
      knowledge: 0,
    },
    tokenX: overrides.tokenX ?? null,
    tokenY: overrides.tokenY ?? null,
    ...overrides,
  };
}

/**
 * Build a minimal adversary element.
 */
export function mockAdversary(overrides = {}) {
  return {
    instanceId: overrides.instanceId ?? 'adv-1',
    elementType: 'adversary',
    name: overrides.name ?? 'Test Adversary',
    currentHp: overrides.currentHp ?? 3,
    maxHp: overrides.maxHp ?? 3,
    currentStress: overrides.currentStress ?? 0,
    maxStress: overrides.maxStress ?? 0,
    conditions: overrides.conditions ?? [],
    tokenX: overrides.tokenX ?? null,
    tokenY: overrides.tokenY ?? null,
    ...overrides,
  };
}

/**
 * Build a mock roll result object (used in gameState.rolls).
 */
export function mockRoll(overrides = {}) {
  return {
    action: {
      hopeDie: { value: overrides.hopeValue ?? 7 },
      fearDie: { value: overrides.fearValue ?? 4 },
      dice: overrides.actionDice ?? [],
      statics: overrides.actionStatics ?? [],
      isSuccess: overrides.isSuccess ?? true,
      isCritical: overrides.isCritical ?? false,
      ...(overrides.action ?? {}),
    },
    damage: {
      dice: overrides.damageDice ?? [{ name: 'weapon', die: 'd8', value: 5 }],
      statics: overrides.damageStatics ?? [],
      ...(overrides.damage ?? {}),
    },
    other: overrides.other ?? {},
    ...(overrides.rolls ?? {}),
  };
}

/**
 * Build a mock action config for createActionLoop.
 */
export function mockAction(overrides = {}) {
  return {
    type: overrides.type ?? 'attack',
    actorInstanceId: overrides.actorInstanceId ?? 'char-1',
    targetInstanceIds: overrides.targetInstanceIds ?? ['adv-1'],
    traitKey: overrides.traitKey ?? 'Agility',
    range: overrides.range ?? 'melee',
    rollText: overrides.rollText ?? 'Test Attack [d20+1] damage [d8]',
    weaponId: overrides.weaponId ?? null,
    ...overrides,
  };
}

/**
 * Build a raw game state with sane defaults. Override any field as needed.
 */
export function mockGameState(overrides = {}) {
  const char = overrides.character ?? mockCharacter();
  const adv = overrides.adversary ?? mockAdversary();

  return {
    fear: overrides.fear ?? 0,
    mapConfig: overrides.mapConfig ?? null,
    activeElements: overrides.activeElements ?? [char, adv],
    currentActorInstanceId: overrides.currentActorInstanceId ?? char.instanceId,
    featureState: overrides.featureState ?? {},
    action: overrides.action ?? {
      type: 'attack',
      actorInstanceId: char.instanceId,
      targetInstanceIds: [adv.instanceId],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    },
    rolls: overrides.rolls ?? mockRoll(),
    _ownerInstanceId: overrides._ownerInstanceId ?? char.instanceId,
    _featureKey: overrides._featureKey ?? 'TestFeature',
    ...overrides,
  };
}

/**
 * Build a Game Table Snapshot with sane defaults.
 */
export function mockTable(overrides = {}) {
  return buildTableSnapshot(mockGameState(overrides));
}

/**
 * Create a fresh mutable chip-state object for testing chip.onUse.
 */
export function mockChipState(overrides = {}) {
  const _data = { ...overrides };
  const state = {
    _isOn: overrides._isOn ?? false,
    get isOn() {
      return this._isOn;
    },
    get(key) {
      return _data[key];
    },
    set(key, value) {
      _data[key] = value;
    },
  };
  return state;
}

// ---------------------------------------------------------------------------
// Phase-simulation helpers
// ---------------------------------------------------------------------------

/**
 * Run a single feature through the Intent phase and return chips + mutations.
 *
 * @param {object} feature        — feature object (with optional _ownerInstanceId)
 * @param {object} [tableOverrides]
 * @returns {{ chips, mutations, narrations, table }}
 */
export function runIntent(feature, tableOverrides = {}) {
  return _runPhase(feature, 'intent', tableOverrides);
}

/**
 * Run a single feature through the Review Outcome phase and return chips + mutations.
 */
export function runReviewOutcome(feature, tableOverrides = {}) {
  return _runPhase(feature, 'reviewOutcome', tableOverrides);
}

/**
 * Run a single feature through the Review Action phase and return chips + mutations.
 */
export function runReviewAction(feature, tableOverrides = {}) {
  return _runPhase(feature, 'reviewAction', tableOverrides);
}

/**
 * Run a single feature through the Resolve phase and return mutations.
 */
export function runResolve(feature, tableOverrides = {}) {
  return _runPhase(feature, 'resolve', tableOverrides);
}

/**
 * Run a single feature through the resolveAction phase (chips only; no lifecycle hook).
 */
export function runResolveAction(feature, tableOverrides = {}) {
  return _runPhase(feature, 'resolveAction', tableOverrides);
}

/**
 * Run reviewAction then resolveAction on one shared loop so `featureState` persists.
 */
export function runReviewActionThenResolveAction(feature, tableOverrides = {}) {
  const char = mockCharacter({ instanceId: 'char-1' });
  const adv = mockAdversary({ instanceId: 'adv-1' });

  const annotatedFeature = {
    ...feature,
    _ownerInstanceId: feature._ownerInstanceId ?? 'char-1',
  };

  const actionType = tableOverrides.actionType ?? 'attack';

  const gameState = mockGameState({
    ...tableOverrides,
    activeElements: tableOverrides.activeElements ?? [char, adv],
    _ownerInstanceId: annotatedFeature._ownerInstanceId,
    _featureKey: feature.name ?? 'TestFeature',
  });

  const loop = createActionLoop(
    gameState,
    mockAction({
      type: actionType,
      actorInstanceId: annotatedFeature._ownerInstanceId,
      ...tableOverrides.action,
    }),
    [annotatedFeature],
    tableOverrides.usageStore ?? {}
  );

  if (tableOverrides.action?.effects) {
    loop.setEffects(tableOverrides.action.effects);
  }

  const reviewAction = loop.runPhase('reviewAction');
  const resolveAction = loop.runPhase('resolveAction');

  return {
    reviewAction,
    resolveAction,
    chips: resolveAction.chips,
    mutations: [...reviewAction.mutations, ...resolveAction.mutations],
    narrations: [...reviewAction.narrations, ...resolveAction.narrations],
    loop,
    gameState,
  };
}

function _runPhase(feature, phase, tableOverrides) {
  const char = mockCharacter({ instanceId: 'char-1' });
  const adv = mockAdversary({ instanceId: 'adv-1' });

  const annotatedFeature = {
    ...feature,
    _ownerInstanceId: feature._ownerInstanceId ?? 'char-1',
  };

  const actionType = tableOverrides.actionType ?? 'attack';

  const gameState = mockGameState({
    ...tableOverrides,
    activeElements: tableOverrides.activeElements ?? [char, adv],
    _ownerInstanceId: annotatedFeature._ownerInstanceId,
    _featureKey: feature.name ?? 'TestFeature',
  });

  const loop = createActionLoop(
    gameState,
    mockAction({
      type: actionType,
      actorInstanceId: annotatedFeature._ownerInstanceId,
      ...tableOverrides.action,
    }),
    [annotatedFeature],
    tableOverrides.usageStore ?? {}
  );

  // Set effects if provided in action config (for review/resolve phases)
  if (tableOverrides.action?.effects) {
    loop.setEffects(tableOverrides.action.effects);
  }

  const result = loop.runPhase(phase);

  return {
    chips: result.chips,
    mutations: result.mutations,
    narrations: result.narrations,
    loop,
  };
}
