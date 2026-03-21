/**
 * V2 Feature Engine — Action Loop
 *
 * The Action Loop is the core state machine that drives every event at the
 * table. An attack, a trait roll, a short rest, a session start — all are
 * Action Loops.
 *
 * Phases: Intent → Roll → Review Action → Review Outcome → Resolve
 * (Rest loops: onRest fires during the Roll phase; no dice are involved.)
 * (Session Start loops: onSessionStart fires during Resolve.)
 *
 * Usage:
 *   const loop = createActionLoop(gameState, actionConfig);
 *   const intentResult = loop.runPhase('intent');
 *   // ... dice are rolled externally ...
 *   const reviewActionResult = loop.runPhase('reviewAction');
 *   // ... engine applies thresholds ...
 *   const reviewOutcomeResult = loop.runPhase('reviewOutcome');
 *   const resolveResult = loop.runPhase('resolve');
 */

import { buildTableSnapshot, applyMutations } from './table.js';
import { collectChips } from './chip-system.js';
import { unwrap, unwrapAll } from './when.js';

// Phase names used in placements
const PHASE_CHIP_PLACEMENT = {
  intent: 'intent',
  reviewAction: 'reviewAction',
  reviewOutcome: 'reviewOutcome',
  resolve: 'resolve',
};

/**
 * Create an Action Loop instance.
 *
 * @param {object} gameState     — raw game state (see table.js for shape)
 * @param {object} actionConfig  — { type, actorInstanceId, targetInstanceIds?,
 *                                   rollText?, weaponId?, traitKey? }
 * @param {object[]} features    — flat array of all feature objects for all
 *                                 characters on the table, each annotated with
 *                                 `_ownerInstanceId`
 * @param {object} [usageStore]  — mutable frequency-tracking store
 * @returns {object} loop
 */
export function createActionLoop(gameState, actionConfig, features = [], usageStore = {}) {
  // Merge action config into the game state so table snapshots see it
  const stateWithAction = {
    ...gameState,
    action: {
      type: actionConfig.type,
      actorInstanceId: actionConfig.actorInstanceId,
      targetInstanceIds: actionConfig.targetInstanceIds || [],
      trait: actionConfig.traitKey,
      range: actionConfig.range,
      effects: [],
      appliedEffects: [],
    },
  };

  const phaseResults = {};

  /**
   * Run a single phase of the Action Loop.
   *
   * @param {'intent'|'reviewAction'|'reviewOutcome'|'resolve'} phase
   * @returns {{ chips: object[], mutations: object[], narrations: string[] }}
   */
  function runPhase(phase) {
    const allMutations = [];
    const allNarrations = [];
    const activeChips = [];

    for (const feature of features) {
      // Set the owner context on the game state
      const featureState = {
        ...stateWithAction,
        _ownerInstanceId: feature._ownerInstanceId,
        _featureKey: feature.name,
        featureState: gameState.featureState,
      };

      // Build a fresh table snapshot for this feature
      const table = buildTableSnapshot(featureState);

      // 1. Run the lifecycle hook for this phase (unless gated by a toggle chip)
      const hookName = hookNameForPhase(phase, actionConfig.type);
      const hookFnRaw = hookName ? feature.hooks?.[hookName] : undefined;
      const phaseChipPlacement = PHASE_CHIP_PLACEMENT[phase];
      const gatedByChip = hookFnRaw && phaseChipPlacement &&
        hasToggleChipGate(feature, phaseChipPlacement, table);

      if (hookFnRaw && !gatedByChip) {
        const hookFn = unwrap(hookFnRaw, table);
        if (typeof hookFn === 'function') {
          hookFn(table);
        }
      }

      // 2. Collect chips for this phase
      if (phaseChipPlacement) {
        const chips = collectChips([feature], phaseChipPlacement, table, usageStore);

        // Attach gated hook to toggle chips so activateChip can run it
        if (gatedByChip) {
          for (const chip of chips) {
            if (chip.isToggle) {
              chip._gatedHookFn = hookFnRaw;
            }
          }
        }

        activeChips.push(...chips);
      }

      // 3. Harvest mutations from this feature's snapshot
      const mutations = applyMutations(table);
      allMutations.push(...mutations);

      // Extract narrations from mutations
      for (const m of mutations) {
        if (m.type === 'addNarration') allNarrations.push(m.payload.text);
      }
    }

    const result = {
      phase,
      chips: activeChips,
      mutations: allMutations,
      narrations: allNarrations,
    };

    phaseResults[phase] = result;
    return result;
  }

  return {
    actionConfig,
    runPhase,
    getPhaseResult(phase) {
      return phaseResults[phase] || null;
    },
    /**
     * Update the shared action effects list (e.g. after dice are resolved by
     * the server). Allows onReviewOutcome hooks to read actual roll results.
     */
    setEffects(effects) {
      stateWithAction.action.effects = effects;
      stateWithAction.action.pendingEffects = effects;
    },
    setAppliedEffects(effects) {
      stateWithAction.action.appliedEffects = effects;
    },
    setRolls(rolls) {
      stateWithAction.rolls = rolls;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a feature has a toggle chip (without explicit onUse) at the
 * given phase placement.  When true, the engine skips the hook during runPhase
 * and attaches it to the chip for snapshot/restore activation.
 */
function hasToggleChipGate(feature, phase, table) {
  const chips = feature.chips || [];
  for (const rawChip of chips) {
    const chip = unwrapAll(rawChip, table);
    if (!chip || typeof chip !== 'object') continue;
    const placements = chip.placements || ['card'];
    if (placements.includes(phase) && chip.isToggle && !chip.onUse) return true;
  }
  return false;
}

function hookNameForPhase(phase, actionType) {
  if (phase === 'intent') {
    if (actionType === 'shortRest' || actionType === 'longRest') return 'onRest';
    if (actionType === 'sessionStart') return 'onSessionStart';
    return 'onIntent';
  }
  if (phase === 'reviewAction') return 'onReviewAction';
  if (phase === 'reviewOutcome') return 'onReviewOutcome';
  if (phase === 'resolve') {
    if (actionType === 'shortRest' || actionType === 'longRest') return 'onRest';
    if (actionType === 'sessionStart') return 'onSessionStart';
    return 'onResolve';
  }
  return null;
}
