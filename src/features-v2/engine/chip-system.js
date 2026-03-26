/**
 * V2 Feature Engine — Chip System
 *
 * Chips are interactive UI elements (buttons or toggles) that let players make
 * choices. This module handles collection, activation, cost deduction, and
 * frequency tracking.
 */

import { unwrapAll, unwrap, isWhen, unwrapTopLevelWhenChain } from './when.js';
import { applyMutations, queueInternalMutation, buildTableSnapshot } from './table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from './feature-loader.js';

// ---------------------------------------------------------------------------
// evaluateIsDisabled / resolveChipDisabled
// ---------------------------------------------------------------------------

/**
 * Evaluates `chip.isDisabled` for grey-out state and tooltip copy.
 *
 * Supported shapes:
 * - `undefined` | `false` — not disabled
 * - `true` — disabled (no message from this field; use `disabledReason` or generic)
 * - non-empty string — disabled with that message
 * - `(table) => boolean` — `true` disabled; `false` / `null` / `undefined` not disabled
 * - `(table) => string` — non-empty string after trim → disabled with that message; empty → not disabled
 * - `(table) => other truthy` — disabled (no message), same as `true`
 *
 * @returns {{ disabled: boolean, message?: string | null }}
 */
export function evaluateIsDisabled(chip, table) {
  if (chip == null || typeof chip !== 'object') {
    return { disabled: false };
  }
  const d = chip.isDisabled;
  if (d === undefined || d === false) return { disabled: false };
  if (d === true) return { disabled: true, message: null };
  if (typeof d === 'string') {
    const s = d.trim();
    return s ? { disabled: true, message: s } : { disabled: false };
  }
  if (typeof d === 'function') {
    const r = d(table);
    if (r === false || r == null) return { disabled: false };
    if (r === true) return { disabled: true, message: null };
    if (typeof r === 'string') {
      const s = r.trim();
      return s ? { disabled: true, message: s } : { disabled: false };
    }
    return { disabled: !!r, message: null };
  }
  return { disabled: false };
}

/**
 * Whether a chip should be treated as disabled (greyed out, no onUse).
 * Supports `isDisabled: true | string | (table) => boolean | string` (see {@link evaluateIsDisabled}).
 */
export function resolveChipDisabled(chip, table) {
  if (chip == null || typeof chip !== 'object') return false;
  // `collectChips` attaches a pre-evaluated boolean; honor it so callers need not re-pass `table`.
  if (typeof chip.disabled === 'boolean') return chip.disabled;
  return evaluateIsDisabled(chip, table).disabled;
}

// ---------------------------------------------------------------------------
// canPayChipCosts
// ---------------------------------------------------------------------------

/**
 * Whether `table.me` (the feature owner in this snapshot) can pay all resource costs on the chip
 * at the current moment. Matches {@link deductChipCosts} value resolution (number or `(table) => number`).
 *
 * Hope is checked against Hope only — same as `deductChipCosts(chip, table)` with no `costOpts`
 * (armor-for-Hope substitution is not assumed for card/review chips).
 *
 * @param {object} chip
 * @param {object} table  — from {@link buildTableSnapshot}
 * @returns {boolean}
 */
export function canPayChipCosts(chip, table) {
  if (!chip || typeof chip !== 'object') return true;
  const me = table?.me;
  if (!me || me.isCharacter !== true) return true;

  const resolve = (v) => (typeof v === 'function' ? v(table) : v);
  const n = (key) => {
    const raw = resolve(chip[key]);
    if (raw == null || raw === false) return 0;
    const num = Number(raw);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
  };

  const hopeCost = n('hopeCost');
  if (hopeCost > 0) {
    const h = me.hope ?? 0;
    if (h < hopeCost) return false;
  }

  const stressCost = n('stressCost');
  if (stressCost > 0) {
    const cur = me.currentStress ?? 0;
    const maxS = me.maxStress;
    if (maxS != null && maxS - cur < stressCost) return false;
  }

  const goldCost = n('goldCost');
  if (goldCost > 0) {
    const g = me.gold ?? 0;
    if (g < goldCost) return false;
  }

  const armorMark = n('armorMark');
  if (armorMark > 0) {
    const cur = me.armor ?? 0;
    const maxA = me.maxArmor;
    if (maxA != null && maxA - cur < armorMark) return false;
  }

  const armorClear = n('armorClear');
  if (armorClear > 0) {
    const cur = me.armor ?? 0;
    if (cur < armorClear) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// describeChipResourceBlock / getChipDisableHint
// ---------------------------------------------------------------------------

/**
 * Human-readable explanation for why {@link canPayChipCosts} is false.
 * @returns {string|null}
 */
export function describeChipResourceBlock(chip, table) {
  if (!chip || typeof chip !== 'object') return null;
  const me = table?.me;
  if (!me || me.isCharacter !== true) return null;

  const resolve = (v) => (typeof v === 'function' ? v(table) : v);
  const n = (key) => {
    const raw = resolve(chip[key]);
    if (raw == null || raw === false) return 0;
    const num = Number(raw);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
  };

  const parts = [];

  const hopeCost = n('hopeCost');
  if (hopeCost > 0) {
    const h = me.hope ?? 0;
    if (h < hopeCost) parts.push(`Need ${hopeCost} Hope (have ${h}).`);
  }

  const stressCost = n('stressCost');
  if (stressCost > 0) {
    const cur = me.currentStress ?? 0;
    const maxS = me.maxStress;
    if (maxS != null && maxS - cur < stressCost) {
      parts.push(`Need ${stressCost} free Stress box${stressCost === 1 ? '' : 'es'} (${maxS - cur} free).`);
    }
  }

  const goldCost = n('goldCost');
  if (goldCost > 0) {
    const g = me.gold ?? 0;
    if (g < goldCost) parts.push(`Need ${goldCost} gold (have ${g}).`);
  }

  const armorMark = n('armorMark');
  if (armorMark > 0) {
    const cur = me.armor ?? 0;
    const maxA = me.maxArmor;
    if (maxA != null && maxA - cur < armorMark) {
      parts.push(`Need ${armorMark} unmarked armor slot${armorMark === 1 ? '' : 's'} (${maxA - cur} free).`);
    }
  }

  const armorClear = n('armorClear');
  if (armorClear > 0) {
    const cur = me.armor ?? 0;
    if (cur < armorClear) {
      parts.push(`Need ${armorClear} marked armor slot${armorClear === 1 ? '' : 's'} to clear (have ${cur}).`);
    }
  }

  return parts.length ? parts.join(' ') : null;
}

/**
 * Short tooltip when a chip is unusable: resource block, then feature `disabledReason`, else generic.
 * @returns {string|null}
 */
export function getChipDisableHint(chip, table) {
  if (!chip || !table) return null;

  const resourceMsg = describeChipResourceBlock(chip, table);
  if (resourceMsg) return resourceMsg;

  if (!resolveChipDisabled(chip, table)) return null;

  const ev = evaluateIsDisabled(chip, table);
  if (ev.message) return ev.message;

  const dr = chip.disabledReason;
  if (typeof dr === 'function') {
    const s = dr(table);
    return (s && String(s).trim()) || 'Unavailable right now.';
  }
  if (typeof dr === 'string' && dr.trim()) return dr;

  return 'Unavailable right now.';
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
/**
 * Whether a declarative chip **`placements`** entry matches **`shape`** (same reference or same **`shape.id`**).
 * Merged `activeFeatures` rows often shallow-copy SRD + V2 data so `cards[].shape` and `chips[].placements[0]`
 * are not the same object instance even when they describe the same template.
 *
 * @param {object} shape — anchor from the sheet card (`collectSheetCards` / UI)
 * @param {object} placementRef — entry from `chip.placements`
 */
export function shapePlacementMatches(shape, placementRef) {
  if (!shape || typeof shape !== 'object' || !placementRef || typeof placementRef !== 'object') {
    return false;
  }
  if (placementRef === shape) return true;
  const sid = shape.id != null ? String(shape.id) : '';
  const pid = placementRef.id != null ? String(placementRef.id) : '';
  return sid !== '' && pid !== '' && sid === pid;
}

/**
 * Placement anchor for declarative **sheet** cards: chips list the **same `shape` reference or `shape.id`**
 * as {@link buildCardsForFeature} `entry.shape` (e.g. Beastbound `companionShape`) so UI can render
 * them in a slot **below** the rendered template for that shape.
 *
 * @param {object[]} features — merged `activeFeatures` rows
 * @param {object} shape — anchor from the resolved sheet card (reference or same **`id`** as module `cards[].shape`)
 * @param {object} table — from {@link buildTableSnapshot}
 * @param {object} [usageStore]
 * @returns {object[]}
 */
export function collectChipsForShapePlacement(features, shape, table, usageStore = {}) {
  const result = [];
  if (!shape || typeof shape !== 'object' || !Array.isArray(features) || !table) return result;
  const shapeKey = shape.id != null ? String(shape.id) : 'shape';

  for (const feature of features) {
    const chipsSource = buildChipsForFeature(feature);

    for (const rawChip of chipsSource) {
      const chip = unwrapTopLevelWhenChain(rawChip, table);
      if (!chip || typeof chip !== 'object') continue;

      const placements = chip.placements || (chip.placement ? [chip.placement] : ['card']);
      if (!placements.some((p) => shapePlacementMatches(shape, p))) continue;

      const resolvedName =
        typeof chip.name === 'function' ? chip.name(table) : chip.name;
      const chipDisplayName = resolvedName ?? feature.name;
      const chipWithName =
        typeof chip.name === 'function' ? { ...chip, name: chipDisplayName } : { ...chip, name: chipDisplayName };

      const chipKey = `${feature.name}::${chipDisplayName}::shape:${shapeKey}`;

      if (chip.frequency) {
        let maxUses = 1;
        if (chip.frequencyMaxUses !== undefined) {
          const raw =
            typeof chip.frequencyMaxUses === 'function' ? chip.frequencyMaxUses(table) : chip.frequencyMaxUses;
          maxUses = Math.max(1, Math.floor(Number(raw)) || 1);
        }
        if (!isChipAvailable(chipKey, chip.frequency, usageStore, maxUses)) continue;
      }

      const logicDisabled = resolveChipDisabled(chipWithName, table);
      const resourceUnaffordable = !canPayChipCosts(chipWithName, table);
      const disableHint = getChipDisableHint(chipWithName, table);
      result.push({
        ...chipWithName,
        disabled: logicDisabled,
        resourceUnaffordable,
        disableHint,
        _featureName: feature.name,
        _featureSource: feature._source,
        _ownerInstanceId: feature._ownerInstanceId,
        _chipKey: chipKey,
      });
    }
  }

  return result;
}

export function collectChips(features, phase, table, usageStore = {}) {
  const result = [];

  for (const feature of features) {
    // Merge root-level default card action into a synthetic chip list
    const chipsSource = buildChipsForFeature(feature);

    for (const rawChip of chipsSource) {
      // Resolve when() wrappers using current table snapshot
      const chip = unwrapTopLevelWhenChain(rawChip, table);
      if (!chip || typeof chip !== 'object') continue;

      const placements = chip.placements || (chip.placement ? [chip.placement] : ['card']);
      if (!placements.includes(phase)) continue;

      const resolvedName =
        typeof chip.name === 'function' ? chip.name(table) : chip.name;
      const chipDisplayName = resolvedName ?? feature.name;
      const chipWithName =
        typeof chip.name === 'function' ? { ...chip, name: chipDisplayName } : { ...chip, name: chipDisplayName };

      const chipKey = `${feature.name}::${chipDisplayName}::${placements.join(',')}`;

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

      const logicDisabled = resolveChipDisabled(chipWithName, table);
      const resourceUnaffordable = !canPayChipCosts(chipWithName, table);
      const disableHint = getChipDisableHint(chipWithName, table);
      result.push({
        ...chipWithName,
        disabled: logicDisabled,
        /** True when Hope/Stress/Gold/Armor costs cannot be paid; UI should grey out like `disabled`. */
        resourceUnaffordable,
        /** Precomputed tooltip when the chip is unusable ({@link getChipDisableHint}). */
        disableHint,
        _featureName: feature.name,
        _featureSource: feature._source,
        _ownerInstanceId: feature._ownerInstanceId,
        _chipKey: chipKey,
      });
    }
  }

  return result;
}

/**
 * Collect chips from party members' loaded features that opt in with
 * `showOnOtherSheets: true`, evaluating predicates with **`table.me` = the viewer**
 * (the character sheet being rendered) while each chip still carries
 * `_ownerInstanceId` / `_crossSheetFromOwnerInstanceId` from the **source** feature.
 *
 * The **viewer’s own** character is included so `showOnOtherSheets` does not hide these
 * chips from the owner (e.g. Bard **Rally** spend on the Bard’s sheet as well as allies’).
 *
 * Use this when a mechanic is authored on one class (e.g. Bard **Rally**) but the
 * spend UI must also appear on allies who do not have that feature on their own card list.
 *
 * @param {string} viewerInstanceId   — sheet subject (`table.me` in each snapshot)
 * @param {object[]} partyCharacters    — character elements to scan (typically all PCs; **includes** the viewer)
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
    if (!oid) continue;

    const base = loadCharacterFeatures(other, registry);
    const tableBase = {
      top: {
        fear: baseGameState.fear ?? 0,
        map: baseGameState.mapConfig ?? baseGameState.map ?? null,
      },
      featureState: baseGameState.featureState,
    };
    const decl = applyDeclarativeFeatures(base, other, tableBase, registry);
    for (const feature of decl.mergedFeatures) {
      const table = buildTableSnapshot({
        ...baseGameState,
        activeElements: baseGameState.activeElements ?? partyCharacters,
        _ownerInstanceId: viewerInstanceId,
        _featureKey: feature.name,
        _activeFeature: feature,
        registry,
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
// Toggle persistence (framework keys — authors do not choose storage keys)
// ---------------------------------------------------------------------------

/**
 * Stable key for `table.source` / `table.feature` toggle state. Matches the chip identity
 * used in {@link collectChips} (`feature.name`, resolved chip name, placements).
 *
 * @param {object} feature — feature descriptor (needs `name`; bag inference uses `_source` / `_sourceScopeKey` or `table` in {@link inferToggleScope})
 * @param {object} chip
 * @param {object} [table] — only needed when `chip.name` is a function
 */
export function getV2ToggleStateKey(feature, chip, table) {
  const fname = feature?.name ?? 'Feature';
  const resolvedName =
    typeof chip.name === 'function' ? chip.name(table) : chip.name;
  const cname = resolvedName ?? fname;
  const pl = (chip.placements || ['card']).join(',');
  return `_v2t:${fname}::${cname}::${pl}`;
}

/**
 * Which bag holds toggle state: subclass features default to `source` (shared scope);
 * everything else defaults to `feature`. Optional `chip.toggleScope` overrides.
 *
 * Subclass scope is inferred when:
 * - `feature._source === 'subclass'` (loader-merged rows), or
 * - `feature._sourceScopeKey` starts with `subclasses:` (merged rows), or
 * - `table.activeFeature` is a subclass row (`_source === 'subclass'`) and the toggle
 *   belongs to the same registry option (`_sourceObject.features` contains `feature.name`)
 *   or is the same feature as `activeFeature` (`name` match). This lets raw feature
 *   exports omit `_source` when predicates call `toggleIsOn(table, WingsOfLight, chip)`.
 *
 * @param {object} chip
 * @param {object} feature
 * @param {object} [table] — snapshot from {@link buildTableSnapshot} (needed for raw exports)
 * @returns {'source'|'feature'}
 */
export function inferToggleScope(chip, feature, table) {
  if (chip.toggleScope === 'source' || chip.toggleScope === 'feature') return chip.toggleScope;
  if (feature?._source === 'subclass') return 'source';
  const fsk = feature?._sourceScopeKey;
  if (typeof fsk === 'string' && fsk.startsWith('subclasses:')) return 'source';

  const af = table?.activeFeature;
  if (af?._source === 'subclass' && feature?.name) {
    const siblings = af._sourceObject?.features;
    if (Array.isArray(siblings) && siblings.some((f) => f && f.name === feature.name)) return 'source';
    if (af.name === feature.name) return 'source';
  }
  return 'feature';
}

function getToggleBag(table, scope) {
  if (scope === 'source' && typeof table?.source?.get === 'function') return table.source;
  return table?.feature;
}

/**
 * Read persisted on/off for a toggle chip using only the framework key from {@link getV2ToggleStateKey}
 * (`_v2t:…` in `table.source` or `table.feature` bags).
 *
 * @param {object} chip — from {@link collectChips} should carry `_featureName` / `_featureSource`
 * @param {object} table
 * @param {object} [featureForScope] — when not collecting (e.g. predicates), pass the feature object (`name`;
 *   `_source` optional if `table.activeFeature` is a loader-merged subclass row — see {@link inferToggleScope})
 */
export function readPersistedToggleIsOn(chip, table, featureForScope) {
  const feature =
    featureForScope ??
    (chip._featureName ? { name: chip._featureName, _source: chip._featureSource } : null);
  if (!feature?.name) return false;
  const key = getV2ToggleStateKey(feature, chip, table);
  const scope = inferToggleScope(chip, feature, table);
  const bag = getToggleBag(table, scope);
  if (!bag || typeof bag.get !== 'function') return false;
  return bag.get(key) === true;
}

/** Predicate helper: is this card toggle currently on? */
export function toggleIsOn(table, feature, chip) {
  return readPersistedToggleIsOn(chip, table, feature);
}

function persistToggleToBag(chip, table, isOn) {
  if (!chip.isToggle || chip.persistToggle === false) return;
  const fname = chip._featureName;
  if (!fname) return;
  const feature = { name: fname, _source: chip._featureSource };
  const key = getV2ToggleStateKey(feature, chip, table);
  const scope = inferToggleScope(chip, feature, table);
  const bag = getToggleBag(table, scope);
  if (!bag || typeof bag.set !== 'function') return;
  bag.set(key, isOn === true);
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
 * **Persisted toggles:** For `isToggle` chips, the framework writes on/off under a deterministic
 * key (see {@link getV2ToggleStateKey}) in `table.source` (subclass) or `table.feature` (default).
 * Set **`persistToggle: false`** when the toggle is UI-only and must not persist (e.g. one-shot
 * review chips). Authors should not call `table.source.set` / `table.feature.set` for boolean
 * toggle state — use side-effect-only `onUse` when needed.
 *
 * @param {object} chip                  — chip descriptor (from collectChips)
 * @param {object} table                 — current Game Table Snapshot
 * @param {object} chipState             — mutable chip-local state object
 * @param {object} [selectOpts]          — { selectedId } or { selectedIds } for isSelect chips
 * @returns {object[]} mutations          — queued mutations from the call
 */
function runChipActivationCore(chip, table, chipState, selectOpts) {
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

  if (chip.isToggle && !chip._gatedHookFn) {
    persistToggleToBag(chip, table, chipState.isOn);
  }

  return applyMutations(table);
}

/**
 * Result of one logical toggle click (seed from persisted framework toggle state, else off),
 * then flip. Used for Game Table deferred banners to show tentative on/off before GM ack.
 * @param {object} chip
 * @param {object} table
 * @returns {boolean|undefined} — `undefined` if not a toggle chip
 */
export function computeToggleNextIsOn(chip, table) {
  if (!chip?.isToggle) return undefined;
  const chipState = makeChipState();
  if (chip.persistToggle !== false && chip._featureName && !chip._gatedHookFn) {
    chipState._isOn = readPersistedToggleIsOn(chip, table);
  }
  chipState._isOn = !chipState._isOn;
  return chipState._isOn;
}

/**
 * Apply a toggle chip as if it ended in `committedIsOn` (no flip). Used when GM ack applies
 * a deferred toggle banner that froze the intended next state at click time.
 * @param {object} chip
 * @param {object} table
 * @param {boolean} committedIsOn
 * @param {object} [selectOpts]
 * @returns {object[]}
 */
export function commitToggleChipToState(chip, table, committedIsOn, selectOpts = {}) {
  if (resolveChipDisabled(chip, table)) return [];
  if (!chip.isToggle) {
    return activateChip(chip, table, makeChipState(), selectOpts);
  }
  const chipState = makeChipState();
  chipState._isOn = !!committedIsOn;
  return runChipActivationCore(chip, table, chipState, selectOpts);
}

export function activateChip(chip, table, chipState = makeChipState(), selectOpts = {}) {
  if (resolveChipDisabled(chip, table)) return [];

  if (chip.isToggle) {
    if (chip.persistToggle !== false && chip._featureName && !chip._gatedHookFn) {
      chipState._isOn = readPersistedToggleIsOn(chip, table);
    }
    chipState._isOn = !chipState._isOn;
  }

  return runChipActivationCore(chip, table, chipState, selectOpts);
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
// Table featureUsage cycle (Phase 1 element.featureUsage)
// ---------------------------------------------------------------------------

/**
 * Map V2 chip `frequency` / `resetsOn` values to **`element.featureUsage[key].cycle`**
 * (`'session' | 'rest' | 'longRest'`) so Start Session / Short Rest / Long Rest clears
 * in `GMTableView` match engine semantics (`shortRest` → short-rest bucket `rest`).
 *
 * @param {unknown} freq
 * @returns {'session'|'rest'|'longRest'|null}
 */
export function mapV2ChipFrequencyToFeatureUsageCycle(freq) {
  if (freq == null || freq === '') return null;
  if (freq === 'session') return 'session';
  if (freq === 'longRest') return 'longRest';
  if (freq === 'shortRest' || freq === 'rest') return 'rest';
  return null;
}

/**
 * @param {object|null|undefined} chip — resolved engine chip (may have `frequency` and/or `resetsOn`)
 * @returns {'session'|'rest'|'longRest'|null}
 */
export function getFeatureUsageCycleForV2Chip(chip) {
  if (!chip || typeof chip !== 'object') return null;
  const raw = chip.frequency != null ? chip.frequency : chip.resetsOn;
  return mapV2ChipFrequencyToFeatureUsageCycle(raw);
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
 * True when the feature already has an obvious non-chip representation on the
 * character sheet (badges, virtual weapon cards, etc.), so a synthetic
 * title-matching card chip would be redundant next to {@link buildChipsForFeature}'s
 * fallback narrative chip.
 *
 * Keep in sync with declarative badge extraction in
 * `collectDeclarativePassiveBadges` (client) where applicable.
 *
 * @param {object} feature
 * @returns {boolean}
 */
export function hasDeclarativeSheetRepresentation(feature) {
  if (!feature || typeof feature !== 'object') return false;
  if (Array.isArray(feature.cards) && feature.cards.length > 0) return true;
  if (Array.isArray(feature.advantageTriggers) && feature.advantageTriggers.length > 0) return true;
  if (Array.isArray(feature.virtualWeapons) && feature.virtualWeapons.length > 0) return true;

  const psm = feature.passiveStatMods;
  if (psm && typeof psm === 'object' && !psm._predicates) {
    for (const v of Object.values(psm)) {
      if (typeof v === 'number' && v !== 0) return true;
    }
  }

  const d = feature.damageAffinities;
  if (d && typeof d === 'object') {
    const { resistances = [], immunities = [], vulnerabilities = [] } = d;
    if (
      (Array.isArray(resistances) && resistances.length > 0) ||
      (Array.isArray(immunities) && immunities.length > 0) ||
      (Array.isArray(vulnerabilities) && vulnerabilities.length > 0)
    ) {
      return true;
    }
  }

  const r = feature.rangeOverrides;
  if (r && typeof r === 'object' && Object.keys(r).length > 0) return true;

  return false;
}

/**
 * Build the effective chips array for a feature. If the feature has a
 * root-level "Default Card Action" (hopeCost / stressCost / frequency / onUse
 * without an explicit `chips` array), synthesize a single chip for it.
 */
export function buildChipsForFeature(feature) {
  if (Array.isArray(feature.chips)) {
    return feature.chips;
  }

  // Root-level default card action shortcut
  const hasDefaultAction =
    feature.hopeCost !== undefined ||
    feature.stressCost !== undefined ||
    feature.goldCost !== undefined ||
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
        goldCost: feature.goldCost,
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

  // Declarative-only sheet representation (badges, virtual weapons, …) — no
  // synthetic card chip; GuideFeatureCard already surfaces those affordances.
  if (hasDeclarativeSheetRepresentation(feature)) {
    return [];
  }

  // Purely narrative / hook-only automation — fallback card chip so the player
  // can post a narrative Banner (visually de-emphasized vs actionable chips).
  return [
    {
      name: feature.name,
      description: feature.description,
      placements: ['card'],
      narrativeBannerOnly: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Declarative sheet cards (SRD-shaped display objects; not action-loop chips)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ placement: 'sheet'|'editor', shape: object|null, resolve: unknown }} NormalizedCardEntry
 */

/**
 * @param {unknown} raw
 * @returns {NormalizedCardEntry}
 */
export function normalizeCardEntry(raw) {
  if (
    raw != null &&
    typeof raw === 'object' &&
    !isWhen(raw) &&
    (raw.placement === 'sheet' || raw.placement === 'editor') &&
    Object.prototype.hasOwnProperty.call(raw, 'resolve')
  ) {
    return {
      placement: raw.placement,
      shape: raw.shape ?? null,
      resolve: raw.resolve,
    };
  }
  return { placement: 'sheet', shape: null, resolve: raw };
}

/**
 * Normalized `cards` entries from a feature definition (`when()` wrappers live under `resolve`).
 * @param {object} feature
 * @returns {NormalizedCardEntry[]}
 */
export function buildCardsForFeature(feature) {
  if (!feature || typeof feature !== 'object') return [];
  const cards = Array.isArray(feature.cards) ? feature.cards : [];
  return cards.map(normalizeCardEntry);
}

/**
 * @param {'sheet'|'editor'} placement
 * @param {object[]} features — merged `activeFeatures` rows
 * @param {object} table — from {@link buildTableSnapshot} or editor stub
 * @returns {{ feature: object, card: object, shape: object|null }[]}
 */
function collectCardsForPlacement(features, table, placement) {
  const result = [];
  if (!Array.isArray(features) || !table) return result;

  for (const feature of features) {
    if (!feature || typeof feature !== 'object') continue;
    const entries = buildCardsForFeature(feature);
    for (const entry of entries) {
      if (entry.placement !== placement) continue;
      const resolved = unwrapAll(entry.resolve, table);
      if (resolved === undefined || resolved === null) continue;
      const items = Array.isArray(resolved) ? resolved : [resolved];
      for (const item of items) {
        let card = item;
        if (typeof item === 'function') {
          try {
            card = item(table);
          } catch {
            continue;
          }
        }
        if (!card || typeof card !== 'object') continue;
        result.push({ feature, card, shape: entry.shape });
      }
    }
  }
  return result;
}

/**
 * Evaluate declarative **sheet** cards for the current table snapshot.
 * Each leaf resolves to a plain object (optionally via `(table) => object`). Skips undefined / null.
 *
 * @param {object[]} features — merged `activeFeatures` rows
 * @param {object} table — from {@link buildTableSnapshot}
 * @returns {{ feature: object, card: object, shape: object|null }[]}
 */
export function collectSheetCards(features, table) {
  return collectCardsForPlacement(features, table, 'sheet');
}

/**
 * Declarative **editor** cards (character builder). Uses the same `when()` / `resolve` rules with an editor `table` stub.
 *
 * @param {object[]} features — merged `activeFeatures` rows
 * @param {object} table — editor stub (`buildEditorTableStub`)
 * @returns {{ feature: object, card: object, shape: object|null }[]}
 */
export function collectEditorCards(features, table) {
  return collectCardsForPlacement(features, table, 'editor');
}

/**
 * Unwrap `when()` wrappers and return leaf values (chip objects or other nodes).
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function flattenChipsForDisplay(raw) {
  const out = [];
  function walk(node) {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node === 'object' && node._value !== undefined && Array.isArray(node._predicates)) {
      walk(node._value);
      return;
    }
    out.push(node);
  }
  walk(raw);
  return out;
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
