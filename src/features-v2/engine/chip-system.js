/**
 * V2 Feature Engine — Chip System
 *
 * Chips are interactive UI elements (buttons or toggles) that let players make
 * choices. This module handles collection, activation, cost deduction, and
 * frequency tracking.
 */

import { unwrapAll, unwrap } from './when.js';
import { applyMutations, queueInternalMutation, buildTableSnapshot } from './table.js';
import { loadCharacterFeatures } from './feature-loader.js';

// ---------------------------------------------------------------------------
// resolveChipDisabled
// ---------------------------------------------------------------------------

/**
 * Whether a chip should be treated as disabled (greyed out, no onUse).
 * Supports `isDisabled: true | (table) => boolean`.
 */
export function resolveChipDisabled(chip, table) {
  if (chip == null || typeof chip !== 'object') return false;
  const d = chip.isDisabled;
  if (d === undefined || d === false) return false;
  if (d === true) return true;
  if (typeof d === 'function') return !!d(table);
  return false;
}

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
 * @param {object}   [usageStore]  — { [chipKey]: { used?, cycle, count? } }  for frequency checks
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
        let maxUses = 1;
        if (chip.frequencyMaxUses !== undefined) {
          const raw =
            typeof chip.frequencyMaxUses === 'function' ? chip.frequencyMaxUses(table) : chip.frequencyMaxUses;
          maxUses = Math.max(1, Math.floor(Number(raw)) || 1);
        }
        if (!isChipAvailable(chipKey, chip.frequency, usageStore, maxUses)) continue;
      }

      result.push({
        ...chip,
        disabled: resolveChipDisabled(chip, table),
        _featureName: feature.name,
        _ownerInstanceId: feature._ownerInstanceId,
        _chipKey: chipKey,
      });
    }
  }

  return result;
}

/**
 * Collect chips from **other** party members' loaded features that opt in with
 * `showOnOtherSheets: true`, evaluating predicates with **`table.me` = the viewer**
 * (the character sheet being rendered) while each chip still carries
 * `_ownerInstanceId` / `_crossSheetFromOwnerInstanceId` from the **source** feature.
 *
 * Use this when a mechanic is authored on one class (e.g. Bard **Rally**) but the
 * spend UI must appear on allies who do not have that feature on their own card list.
 *
 * @param {string} viewerInstanceId   — sheet subject (`table.me` in each snapshot)
 * @param {object[]} partyCharacters    — character elements to scan (typically all PCs; viewer may be included; skipped when iterating "other")
 * @param {object} registry             — V2 registry for `loadCharacterFeatures`
 * @param {string} phase                — same as `collectChips` (`'card'`, `'reviewAction'`, …)
 * @param {object} [baseGameState]      — merged into each snapshot: must include `activeElements`, `featureState`, etc.
 * @param {object} [usageStore]         — chip frequency tracking (same as `collectChips`)
 * @returns {object[]}
 */
export function collectChipsForOtherCharacterSheets(
  viewerInstanceId,
  partyCharacters,
  registry,
  phase,
  baseGameState = {},
  usageStore = {}
) {
  const result = [];
  if (!viewerInstanceId || !Array.isArray(partyCharacters)) return result;

  for (const other of partyCharacters) {
    const oid = other.instanceId || other.id;
    if (!oid || oid === viewerInstanceId) continue;

    const feats = loadCharacterFeatures(other, registry);
    for (const feature of feats) {
      const table = buildTableSnapshot({
        ...baseGameState,
        activeElements: baseGameState.activeElements ?? partyCharacters,
        _ownerInstanceId: viewerInstanceId,
        _featureKey: feature.name,
        _activeFeature: feature,
      });
      const chips = collectChips([feature], phase, table, usageStore);
      for (const c of chips) {
        if (!c.showOnOtherSheets) continue;
        result.push({
          ...c,
          _crossSheetFromOwnerInstanceId: feature._ownerInstanceId,
          /** Sheet subject (`table.me`) during collection — {@link activateV2ReviewChip} must mirror for costs. */
          _crossSheetViewerInstanceId: viewerInstanceId,
        });
      }
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
 * For select chips (`isSelect` is a function), pass `{ selectedId }` in the
 * fourth argument. The engine stores it in chipState so `onUse` can read it
 * via `chip.get('selectedId')`. **Evolution** (Druid) may also pass `{ evolutionTraitKey }`
 * (trait key to raise by +1 until the form ends).
 *
 * When `multiSelect: true` and `isSelect` is set, pass `{ selectedIds: string[] }`
 * (e.g. Attack of Opportunity outcomes). Use `chip.get('selectedIds')` in `onUse`.
 * Optional `maxSelections` on the chip (number or `(table) => number`) caps how many
 * IDs the UI should allow; the engine does not validate counts.
 *
 * @param {object} chip                  — chip descriptor (from collectChips)
 * @param {object} table                 — current Game Table Snapshot
 * @param {object} chipState             — mutable chip-local state object
 * @param {object} [selectOpts]          — { selectedId } or { selectedIds } for isSelect chips
 * @returns {object[]} mutations          — queued mutations from the call
 */
export function activateChip(chip, table, chipState = makeChipState(), selectOpts = {}) {
  if (resolveChipDisabled(chip, table)) return [];

  if (chip.isToggle) {
    chipState._isOn = !chipState._isOn;
  }

  // For select chips, persist the chosen option id(s) into chip state before onUse
  if (typeof chip.isSelect === 'function') {
    if (chip.multiSelect === true && selectOpts.selectedIds !== undefined) {
      chipState.set('selectedIds', selectOpts.selectedIds);
    } else if (selectOpts.selectedId !== undefined) {
      chipState.set('selectedId', selectOpts.selectedId);
    }
    if (selectOpts.evolutionTraitKey !== undefined) {
      chipState.set('evolutionTraitKey', selectOpts.evolutionTraitKey);
    }
  }

  // For target-select chips, persist chosen target instance IDs into chip state before onUse
  if (typeof chip.selectTargets === 'function' && selectOpts.selectedTargetIds !== undefined) {
    chipState.set('selectedTargetIds', selectOpts.selectedTargetIds);
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

  // Declarative temporary stat mods (values may be static numbers or (table) => number functions)
  if (chip.temporaryStatMods && table.me) {
    for (const [stat, rawValue] of Object.entries(chip.temporaryStatMods)) {
      const resolve = (v) => (typeof v === 'function' ? v(table) : v);
      if (!chip.isToggle || chipState.isOn) {
        const resolved = resolve(rawValue);
        if (chip.isToggle) {
          const stored = chipState.get('_temporaryStatMods') || {};
          stored[stat] = resolved;
          chipState.set('_temporaryStatMods', stored);
        }
        queueInternalMutation(table, 'addTemporaryStatMod', { instanceId: table.me.instanceId, stat, value: resolved });
      } else {
        const stored = chipState.get('_temporaryStatMods') || {};
        const resolved = stored[stat] ?? resolve(rawValue);
        queueInternalMutation(table, 'removeTemporaryStatMod', { instanceId: table.me.instanceId, stat, value: resolved });
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
 * Each cost property can be a static number OR a function `(table) => number`.
 * Functions are evaluated at deduction time so that costs can depend on runtime
 * state — for example, feature state set in a preceding onUse call:
 *
 *   stressCost: (table) => table.feature.get('bounceTargets') ?? 1
 *
 * @param {object} chip   — chip descriptor
 * @param {object} table  — current Game Table Snapshot (table.me is the owner)
 * @param {{ armorInsteadOfHope?: boolean }} [costOpts] — When true and `hopeCost` applies, uses
 *   armor-for-Hope substitution (`markArmor` instead of `spendHope`) only if
 *   `table.me.substituteArmorForHope` and there are enough armor slots; otherwise spends Hope.
 */
export function deductChipCosts(chip, table, costOpts = {}) {
  if (!table.me) return;

  const resolve = (v) => (typeof v === 'function' ? v(table) : v);

  const hopeCost = resolve(chip.hopeCost);
  const stressCost = resolve(chip.stressCost);
  const goldCost = resolve(chip.goldCost);
  const armorMark = resolve(chip.armorMark);
  const armorClear = resolve(chip.armorClear);

  if (hopeCost) {
    const wantsArmor = costOpts?.armorInsteadOfHope === true;
    const canSubstitute =
      wantsArmor &&
      table.me.substituteArmorForHope === true &&
      (table.me.armor ?? 0) >= hopeCost;
    table.me.spendHope(hopeCost, canSubstitute ? { armorInstead: true } : {});
  }
  if (stressCost) table.me.markStress(stressCost);
  if (goldCost) table.me.spendGold(goldCost);
  if (armorMark) table.me.markArmor(armorMark);
  if (armorClear) table.me.clearArmor(armorClear);
}

// ---------------------------------------------------------------------------
// trackChipFrequency
// ---------------------------------------------------------------------------

/**
 * Read how many times a chip has been consumed this frequency cycle.
 * Legacy entries used `{ used: true }` without `count` (treated as 1).
 */
function getFrequencyUsedCount(entry) {
  if (!entry) return 0;
  if (typeof entry.count === 'number') return entry.count;
  if (entry.used) return 1;
  return 0;
}

/**
 * Mark a chip as used for its frequency cycle. Returns whether another use was
 * still available before incrementing.
 *
 * @param {string} chipKey       — stable key for the chip
 * @param {string} frequency     — 'session' | 'shortRest' | 'longRest' | 'rest'
 * @param {object} usageStore    — mutable object: { [chipKey]: { used?, cycle, count? } }
 * @param {number} [maxUses]     — max uses per cycle (default 1). When >1, `count` tracks consumption.
 * @returns {boolean} wasAvailable
 */
export function trackChipFrequency(chipKey, frequency, usageStore, maxUses = 1) {
  const max = Math.max(1, Math.floor(Number(maxUses)) || 1);
  const used = getFrequencyUsedCount(usageStore[chipKey]);
  if (used >= max) return false;
  const next = used + 1;
  usageStore[chipKey] = { cycle: frequency, count: next, used: next >= max };
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
    typeof feature.onUse === 'function' ||
    typeof feature.isSelect === 'function';

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
        frequencyMaxUses: feature.frequencyMaxUses,
        isToggle: feature.isToggle,
        temporaryStatMods: feature.temporaryStatMods,
        isSelect: feature.isSelect,
        isDisabled: feature.isDisabled,
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
 * @param {number} [maxUses]  — default 1
 */
function isChipAvailable(chipKey, frequency, usageStore, maxUses = 1) {
  const max = Math.max(1, Math.floor(Number(maxUses)) || 1);
  return getFrequencyUsedCount(usageStore[chipKey]) < max;
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
