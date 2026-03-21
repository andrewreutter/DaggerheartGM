/**
 * V2 Feature Engine — Chip System
 *
 * Chips are interactive UI elements (buttons or toggles) that let players make
 * choices. This module handles collection, activation, cost deduction, and
 * frequency tracking.
 */

import { unwrapAll, unwrap } from './when.js';
import { applyMutations, queueInternalMutation } from './table.js';

// ---------------------------------------------------------------------------
// collectChips
// ---------------------------------------------------------------------------

/**
 * Iterate all features, unwrap when() conditions, and collect chips whose
 * `placements` array includes the given phase name.
 *
 * @param {object[]} features      — flat array of resolved feature objects (with _ownerInstanceId)
 * @param {string}   phase         — 'card' | 'statblock' | 'create' | 'intent' | 'reviewAction' | 'reviewOutcome'
 * @param {object}   table         — current Game Table Snapshot
 * @param {object}   [usageStore]  — { [chipKey]: { used, cycle } }  for frequency checks
 * @returns {object[]}  active chips with metadata
 */
export function collectChips(features, phase, table, usageStore = {}) {
  const result = [];

  for (const feature of features) {
    // Merge root-level default card action into a synthetic chip list
    const chipsSource = buildChipsForFeature(feature);

    for (const rawChip of chipsSource) {
      // Resolve when() wrappers using current table snapshot
      const chip = unwrapAll(rawChip, table);
      if (!chip || typeof chip !== 'object') continue;

      const placements = chip.placements || ['card'];
      if (!placements.includes(phase)) continue;

      const chipKey = `${feature.name}::${chip.name || feature.name}::${placements.join(',')}`;

      // Check frequency availability
      if (chip.frequency) {
        if (!isChipAvailable(chipKey, chip.frequency, usageStore)) continue;
      }

      result.push({
        ...chip,
        _featureName: feature.name,
        _ownerInstanceId: feature._ownerInstanceId,
        _chipKey: chipKey,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// activateChip
// ---------------------------------------------------------------------------

/**
 * Handle a chip click: toggle state and call onUse(table, chipState).
 *
 * When a toggle chip has a `_gatedHookFn` (attached by the action loop when a
 * feature's hook is gated by this chip), the engine handles snapshot/restore:
 *  - Toggle ON:  snapshot effects, run the hook
 *  - Toggle OFF: restore the snapshotted effects
 *
 * @param {object} chip         — chip descriptor (from collectChips)
 * @param {object} table        — current Game Table Snapshot
 * @param {object} chipState    — mutable chip-local state object
 * @returns {object[]} mutations — queued mutations from the call
 */
export function activateChip(chip, table, chipState = makeChipState()) {
  if (chip.isToggle) {
    chipState._isOn = !chipState._isOn;
  }

  if (chip.isToggle && chip._gatedHookFn) {
    const effects = table.action?.effects;
    if (chipState.isOn) {
      if (effects) {
        chipState.set('_effectsSnapshot', effects.map((e) => ({ ...e })));
      }
      const hookFn = unwrap(chip._gatedHookFn, table);
      if (typeof hookFn === 'function') {
        hookFn(table);
      }
    } else {
      const snapshot = chipState.get('_effectsSnapshot');
      if (snapshot && effects) {
        effects.length = 0;
        effects.push(...snapshot);
      }
    }
  } else if (typeof chip.onUse === 'function') {
    chip.onUse(table, chipState);
  }

  // Declarative temporary stat mods
  if (chip.temporaryStatMods && table.me) {
    for (const [stat, value] of Object.entries(chip.temporaryStatMods)) {
      if (!chip.isToggle || chipState.isOn) {
        queueInternalMutation(table, 'addTemporaryStatMod', { instanceId: table.me.instanceId, stat, value });
      } else {
        queueInternalMutation(table, 'removeTemporaryStatMod', { instanceId: table.me.instanceId, stat, value });
      }
    }
  }

  return applyMutations(table);
}

// ---------------------------------------------------------------------------
// deductChipCosts
// ---------------------------------------------------------------------------

/**
 * Queue resource-cost mutations for the chip's defined costs.
 * Respects hopeCost, stressCost, armorMark, armorClear.
 *
 * @param {object} chip   — chip descriptor
 * @param {object} table  — current Game Table Snapshot (table.me is the owner)
 */
export function deductChipCosts(chip, table) {
  if (!table.me) return;

  if (chip.hopeCost) table.me.spendHope(chip.hopeCost);
  if (chip.stressCost) table.me.markStress(chip.stressCost);
  if (chip.armorMark) table.me.markArmor(chip.armorMark);
  if (chip.armorClear) table.me.clearArmor(chip.armorClear);
}

// ---------------------------------------------------------------------------
// trackChipFrequency
// ---------------------------------------------------------------------------

/**
 * Mark a chip as used for its frequency cycle. Returns whether the chip was
 * available (i.e., not already used this cycle) before marking it used.
 *
 * @param {string} chipKey       — stable key for the chip
 * @param {string} frequency     — 'session' | 'shortRest' | 'longRest' | 'rest'
 * @param {object} usageStore    — mutable object: { [chipKey]: { used, cycle } }
 * @returns {boolean} wasAvailable
 */
export function trackChipFrequency(chipKey, frequency, usageStore) {
  if (usageStore[chipKey]?.used) return false;
  usageStore[chipKey] = { used: true, cycle: frequency };
  return true;
}

/**
 * Reset all chips matching the given frequency cycle.
 *
 * @param {'session'|'shortRest'|'longRest'|'rest'} cycle
 * @param {object} usageStore
 */
export function resetChipFrequency(cycle, usageStore) {
  for (const key of Object.keys(usageStore)) {
    const entry = usageStore[key];
    if (!entry) continue;
    if (
      entry.cycle === cycle ||
      (cycle === 'shortRest' && entry.cycle === 'rest') ||
      (cycle === 'longRest' && entry.cycle === 'rest') ||
      (cycle === 'longRest' && entry.cycle === 'shortRest')
    ) {
      delete usageStore[key];
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the effective chips array for a feature. If the feature has a
 * root-level "Default Card Action" (hopeCost / stressCost / frequency / onUse
 * without an explicit `chips` array), synthesize a single chip for it.
 */
function buildChipsForFeature(feature) {
  if (Array.isArray(feature.chips)) {
    return feature.chips;
  }

  // Root-level default card action shortcut
  const hasDefaultAction =
    feature.hopeCost !== undefined ||
    feature.stressCost !== undefined ||
    feature.armorMark !== undefined ||
    feature.armorClear !== undefined ||
    feature.frequency !== undefined ||
    feature.temporaryStatMods !== undefined ||
    typeof feature.onUse === 'function';

  if (hasDefaultAction) {
    return [
      {
        name: feature.name,
        description: feature.description,
        placements: ['card'],
        hopeCost: feature.hopeCost,
        stressCost: feature.stressCost,
        armorMark: feature.armorMark,
        armorClear: feature.armorClear,
        frequency: feature.frequency,
        isToggle: feature.isToggle,
        temporaryStatMods: feature.temporaryStatMods,
        onUse: feature.onUse,
      },
    ];
  }

  // Purely narrative / passive feature — still gets a card chip so the player
  // can click the card to post a narrative Banner
  return [
    {
      name: feature.name,
      description: feature.description,
      placements: ['card'],
    },
  ];
}

/**
 * Check if a chip is available given its frequency and the current usageStore.
 */
function isChipAvailable(chipKey, frequency, usageStore) {
  return !usageStore[chipKey]?.used;
}

/**
 * Create a fresh mutable chip-state object.
 */
export function makeChipState() {
  const _data = {};
  return {
    _isOn: false,
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
}
