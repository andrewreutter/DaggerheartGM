/**
 * Pure view-model for guide-driven feature cards (Feature Authoring Guide).
 * Uses the same chip list synthesis as the V2 engine (`buildChipsForFeature`).
 */

import { buildChipsForFeature, collectChips, flattenChipsForDisplay } from '../../features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../features-v2/engine/table.js';
import { unwrapAll, isWhen } from '../../features-v2/engine/when.js';
import { mergeV2TableFeatureState } from './v2-action-loop-bridge.js';
import { filterCardPhaseChips } from './card-phase-chips.js';
import { parsePassiveStats } from './feature-actions.js';
import { deriveFeatureActionFromV2Row } from './v2-derive-feature-action.js';

/**
 * Safe `table.me` for sheet preview when there is no owner id (library / new character).
 * Predicates must not throw — e.g. Bard `isDisabled` calls `table.me.rangeFrom(...)`.
 */
const STUB_SHEET_ME = Object.freeze({
  instanceId: null,
  isCharacter: true,
  isAdversary: false,
  lastPosition: null,
  rangeFrom: () => null,
  get rangeFromTarget() {
    return null;
  },
});

/**
 * Minimal `table` shape for V2 chip predicates when there is no `instanceId` (library preview / new character).
 * Must include fields that {@link resolveChipDisabled} / `isDisabled(table)` callbacks read (e.g. `table.characters`).
 */
export const V2_TABLE_STUB_NO_INSTANCE_ID = Object.freeze({
  me: STUB_SHEET_ME,
  characters: [],
  actors: [],
  adversaries: [],
  feature: { get: () => null, set: () => {} },
  source: { get: () => null, set: () => {} },
  rolls: {},
  action: {},
  featureState: {},
  registry: { beastforms: {} },
  top: { fear: 0, map: null, shortRest: null, longRest: null },
});

const PSM_LABELS = {
  evasion: 'Evasion',
  armorScore: 'Armor Score',
  maxHP: 'Max HP',
  maxStress: 'Max Stress',
  maxHope: 'Max Hope',
  maxArmor: 'Armor slots',
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
  majorThreshold: 'Major threshold',
  severeThreshold: 'Severe threshold',
  numShortRestSlots: 'Short rest slots',
  numLongRestSlots: 'Long rest slots',
  numLongMovesInShortRest: 'Long moves in short rest',
};

export { flattenChipsForDisplay };

function formatPassiveStatKey(key, value) {
  const label = PSM_LABELS[key] || key;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value} ${label}`;
}

function pushDamageAffinities(row, badges) {
  const d = row.damageAffinities;
  if (!d || typeof d !== 'object') return;
  const { resistances, immunities, vulnerabilities } = d;
  if (Array.isArray(resistances) && resistances.length) {
    const parts = resistances.map((x) => (typeof x === 'string' ? x : x?._value)).filter(Boolean);
    if (parts.length) badges.push(`Resist: ${parts.join(', ')}`);
  }
  if (Array.isArray(immunities) && immunities.length) {
    badges.push(`Immune: ${immunities.join(', ')}`);
  }
  if (Array.isArray(vulnerabilities) && vulnerabilities.length) {
    badges.push(`Vulnerable: ${vulnerabilities.join(', ')}`);
  }
}

function pushRangeOverrides(row, badges) {
  const r = row.rangeOverrides;
  if (!r || typeof r !== 'object') return;
  for (const [from, to] of Object.entries(r)) {
    badges.push(`Range: ${from} → ${to}`);
  }
}

/**
 * Collect declarative passive badges from a merged feature row (guide Appendix A).
 * Skips dynamic `when`-wrapped `passiveStatMods` trees (handled visually via description).
 * Does not duplicate `advantageTriggers` as chips — those stay in the markdown description only.
 */
export function collectDeclarativePassiveBadges(row) {
  const badges = [];
  const psm = row.passiveStatMods;
  if (psm && typeof psm === 'object' && !psm._predicates) {
    for (const [k, v] of Object.entries(psm)) {
      if (typeof v === 'number' && v !== 0) badges.push(formatPassiveStatKey(k, v));
    }
  }
  pushDamageAffinities(row, badges);
  pushRangeOverrides(row, badges);
  return badges;
}

function formatFrequency(freq) {
  if (!freq) return null;
  if (freq === 'session') return 'Once per session';
  if (freq === 'longRest') return 'Once per long rest';
  if (freq === 'shortRest') return 'Once per short rest';
  if (freq === 'rest') return 'Once per rest';
  return String(freq);
}

/**
 * Human-facing feature title for cards / Actions strip. Falls back to `row.name`.
 * When `displayName` is a function, it receives the same `table` snapshot as V2 card chips
 * (or {@link V2_TABLE_STUB_NO_INSTANCE_ID} when no owner/table was passed).
 *
 * @param {object} row — merged activeFeatures row (or registry feature object)
 * @param {object} [table] — from `buildTableSnapshot` / `buildGuideFeatureTableSnapshot`
 * @returns {string}
 */
export function resolveFeatureDisplayName(row, table) {
  const fallback = row?.name != null ? String(row.name) : 'Feature';
  if (!row || typeof row !== 'object') return fallback;
  const dn = row.displayName;
  if (dn == null) return fallback;
  const t = table ?? V2_TABLE_STUB_NO_INSTANCE_ID;
  if (typeof dn === 'function') {
    try {
      const s = dn(t);
      if (s == null) return fallback;
      const str = String(s).trim();
      return str !== '' ? str : fallback;
    } catch {
      return fallback;
    }
  }
  const str = String(dn).trim();
  return str !== '' ? str : fallback;
}

/** @param {object} chip */
function chipPlacementsArray(chip) {
  if (Array.isArray(chip.placements) && chip.placements.length) return chip.placements;
  if (chip.placement) return [chip.placement];
  return ['card'];
}

/** Placements that can surface as interactive chips (card row or action-loop phases). */
const CONDITIONAL_CHIP_PLACEMENTS = ['card', 'intent', 'reviewAction', 'reviewOutcome'];

/**
 * Innermost chip object from a `when()` tree — predicates not evaluated.
 * @param {*} node
 * @returns {object|null}
 */
function getDefinitionLeafChip(node) {
  if (node == null) return null;
  if (isWhen(node)) return getDefinitionLeafChip(node._value);
  return typeof node === 'object' ? node : null;
}

/**
 * True when at least one chip on this feature is `when()`-gated and **all** predicates
 * fail for the current table snapshot, so no contextual chip is shown yet (e.g. Prayer Dice
 * before a roll). Pure predicate check — not frequency exhaustion.
 *
 * @param {object} row
 * @param {object} table
 * @param {string|number} ownerInstanceId
 * @returns {boolean}
 */
export function hasHiddenConditionalPhaseChips(row, table, ownerInstanceId) {
  if (!row || typeof row !== 'object' || !table || ownerInstanceId == null || ownerInstanceId === '') {
    return false;
  }
  const feature = { ...row, _ownerInstanceId: ownerInstanceId };
  const rawList = buildChipsForFeature(feature);
  let anyBranchUnwrapped = false;
  let hasHiddenContextualBranch = false;
  for (const raw of rawList) {
    const resolved = unwrapAll(raw, table);
    if (resolved !== undefined && resolved !== null) {
      anyBranchUnwrapped = true;
      continue;
    }
    const leaf = getDefinitionLeafChip(raw);
    if (!leaf || typeof leaf !== 'object') continue;
    const placements = chipPlacementsArray(leaf);
    if (!placements.some((p) => CONDITIONAL_CHIP_PLACEMENTS.includes(p))) continue;
    hasHiddenContextualBranch = true;
  }
  // Mutually exclusive when() branches (e.g. Prayer Die — Action vs Damage): only one unwraps at a
  // time — still "in context" if any branch is active.
  if (anyBranchUnwrapped) return false;
  return hasHiddenContextualBranch;
}

/**
 * Whether the row has declarative `advantageTriggers` (strings or `when()`-wrapped).
 * Advantage is evaluated during the action loop Intent phase.
 *
 * @param {object} row
 * @returns {boolean}
 */
function hasPassiveAdvantageTriggers(row) {
  const adv = row?.advantageTriggers;
  if (adv == null) return false;
  let found = false;
  function walk(node) {
    if (found || node == null) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node === 'object' && node._value !== undefined && Array.isArray(node._predicates)) {
      walk(node._value);
      return;
    }
    if (typeof node === 'string' && node.trim()) {
      found = true;
      return;
    }
    if (node && typeof node === 'object' && typeof node._value === 'string' && node._value.trim()) {
      found = true;
    }
  }
  walk(adv);
  return found;
}

/**
 * Whether the feature participates in action-loop phases (intent / reviewAction / reviewOutcome)
 * via `hooks`, chip `placements`, and/or passive `advantageTriggers` (Intent). Pure — no table snapshot.
 *
 * @param {object} row — merged activeFeatures row
 * @returns {{ intent: boolean, reviewAction: boolean, reviewOutcome: boolean }}
 */
export function collectActionLoopPhaseFlags(row) {
  const flags = { intent: false, reviewAction: false, reviewOutcome: false };
  if (!row || typeof row !== 'object') return flags;

  const hook = (k) => row.hooks?.[k] != null || row[k] != null;
  if (hook('onIntent')) flags.intent = true;
  if (hook('onReviewAction')) flags.reviewAction = true;
  if (hook('onReviewOutcome')) flags.reviewOutcome = true;

  if (hasPassiveAdvantageTriggers(row)) flags.intent = true;

  const built = buildChipsForFeature(row);
  const flat = flattenChipsForDisplay(built);
  for (const chip of flat) {
    if (!chip || typeof chip !== 'object') continue;
    const placements = chipPlacementsArray(chip);
    if (placements.includes('intent')) flags.intent = true;
    if (placements.includes('reviewAction')) flags.reviewAction = true;
    if (placements.includes('reviewOutcome')) flags.reviewOutcome = true;
  }

  return flags;
}

/**
 * @param {object} row — merged activeFeatures row (class/subclass/ancestry/community)
 * @param {{
 *   useLegacyTextFallback?: boolean,
 *   table?: object,
 *   ownerInstanceId?: string,
 *   usageStore?: object,
 * }} [options] — when `table` + `ownerInstanceId` are set, card chips match the V2 engine (`collectChips` evaluates `when()` and `isDisabled`).
 * @returns {object} view model for GuideFeatureCard — includes **`name`** (stable id), **`displayName`** (UI title from {@link resolveFeatureDisplayName}), and existing fields.
 */
export function buildFeatureCardModel(row, options = {}) {
  const useLegacy = options.useLegacyTextFallback === true;
  const description = row.description ?? '';
  const table = options.table;
  const ownerInstanceId = options.ownerInstanceId ?? row._ownerInstanceId;
  const usageStore = options.usageStore ?? {};

  let cardChips;
  if (table && ownerInstanceId) {
    const feature = { ...row, _ownerInstanceId: ownerInstanceId };
    cardChips = collectChips([feature], 'card', table, usageStore);
  } else {
    const built = buildChipsForFeature(row);
    const flat = flattenChipsForDisplay(built);
    cardChips = filterCardPhaseChips(flat);
  }

  const declarativePassive = collectDeclarativePassiveBadges(row);
  const legacyAction = useLegacy
    ? deriveFeatureActionFromV2Row(row)
    : { isActive: false, dice: [], spellcastVsRoll: false };
  const legacyPassive =
    useLegacy && !legacyAction.isActive && declarativePassive.length === 0
      ? parsePassiveStats(description)
      : [];

  /** @type {{ frequency?: string, hopeCost?: number, stressCost?: number, armorMark?: number, armorClear?: number } | null} */
  let liftedHeader = null;
  if (cardChips.length === 1) {
    const c = cardChips[0];
    liftedHeader = {
      frequency: c.frequency,
      hopeCost: typeof c.hopeCost === 'number' ? c.hopeCost : undefined,
      stressCost: typeof c.stressCost === 'number' ? c.stressCost : undefined,
      armorMark: typeof c.armorMark === 'number' ? c.armorMark : undefined,
      armorClear: typeof c.armorClear === 'number' ? c.armorClear : undefined,
    };
    if (
      !liftedHeader.frequency &&
      !liftedHeader.hopeCost &&
      !liftedHeader.stressCost &&
      !liftedHeader.armorMark &&
      !liftedHeader.armorClear
    ) {
      liftedHeader = null;
    }
  }

  const hasDice =
    legacyAction.spellcastDC != null || legacyAction.spellcastVsRoll === true;

  const showLegacyUseStrip =
    cardChips.length === 0 && !!legacyAction.isActive && !row.__guideHideLegacyUse;

  const displayName = resolveFeatureDisplayName(row, table);

  return {
    name: row.name,
    displayName,
    description,
    sourceType: row.sourceType,
    sourceLabel: typeof row.source === 'string' ? row.source : row.source?.name,
    cardChips,
    liftedHeader,
    declarativePassive,
    legacyPassive,
    legacyAction,
    hasDice,
    showLegacyUseStrip,
    /** True when the engine shows only the synthetic narrative Banner chip (no costs). */
    isNarrativeOnlyCard:
      cardChips.length === 1 &&
      cardChips[0].narrativeBannerOnly === true,
    actionLoopPhases: collectActionLoopPhaseFlags(row),
    /** Header hint: at least one contextual chip exists but `when()` predicates are not met yet. */
    hasHiddenConditionalPhaseChips:
      table && ownerInstanceId != null && ownerInstanceId !== ''
        ? hasHiddenConditionalPhaseChips(row, table, ownerInstanceId)
        : false,
  };
}

/**
 * Table SSE `activeElements` omit client-only fields. Merge the displayed character (`el` from
 * recompute + `mergeV2DeclarativeSheetOverlay`) over the matching row so `buildTableSnapshot` →
 * `table.me` matches the sheet for `isSelect` chips. Pass **`registry`** on `v2TableContext` for
 * Druid Beastform / Evolution (`table.registry.beastforms`).
 *
 * @param {object} el — merged display element (e.g. hover card `displayEl`)
 * @param {{ activeElements?: object[] } | null | undefined} v2TableContext
 * @returns {object[]}
 */
export function mergeDisplayElIntoTableActiveElements(el, v2TableContext) {
  const raw = v2TableContext?.activeElements ?? [el];
  if (!Array.isArray(raw)) return el?.instanceId || el?.id ? [el] : [];
  const ownerKey = el?.instanceId ?? el?.id;
  if (ownerKey == null || ownerKey === '') return raw;
  const idStr = String(ownerKey);
  const merged = raw.map((a) =>
    String(a.instanceId ?? a.id) === idStr ? { ...a, ...el } : a,
  );
  const hasOwner = merged.some((a) => String(a.instanceId ?? a.id) === idStr);
  const normalizedEl = { ...el, elementType: el.elementType || 'character', instanceId: ownerKey };
  // If activeElements omitted this PC (stale list, or [] after a table switch until loadTableState/SSE — common on secondary tables), the owner never enters actorMap → table.me is null and chip predicates crash (e.g. table.me.rangeFrom).
  return hasOwner ? merged : [...merged, normalizedEl];
}

/**
 * Table snapshot for V2 card chips (matches `GuideFeatureCard` / `buildFeatureCardModel` with table).
 *
 * @param {object} featRow
 * @param {object} el
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object, activeElements?: object[], registry?: object } | null | undefined} v2TableContext
 */
function buildSheetSnapshotGameState(el, featRow, v2TableContext, activeElements, ownerKey) {
  return {
    fear: v2TableContext?.fearCount ?? 0,
    mapConfig: v2TableContext?.mapConfig ?? null,
    activeElements,
    featureState: mergeV2TableFeatureState(v2TableContext?.tableFeatureState, activeElements),
    action: {
      type: 'free',
      actorInstanceId: ownerKey,
      targetInstanceIds: [],
      effects: [],
      appliedEffects: [],
    },
    _ownerInstanceId: ownerKey,
    _featureKey: featRow?.name,
    _activeFeature: featRow,
    registry: v2TableContext?.registry,
  };
}

/**
 * @param {object} el
 * @returns {string|number|null|undefined}
 */
export function getSheetOwnerKey(el) {
  const k = el?.instanceId ?? el?.id;
  if (k == null || k === '') return null;
  return k;
}

export function buildGuideFeatureTableSnapshot(el, featRow, v2TableContext) {
  const ownerKey = getSheetOwnerKey(el);
  if (ownerKey == null) {
    return V2_TABLE_STUB_NO_INSTANCE_ID;
  }
  let activeElements = mergeDisplayElIntoTableActiveElements(el, v2TableContext);
  let table = buildTableSnapshot(buildSheetSnapshotGameState(el, featRow, v2TableContext, activeElements, ownerKey));
  if (!table.me) {
    const idStr = String(ownerKey);
    const withoutDup = activeElements.filter((a) => String(a.instanceId ?? a.id) !== idStr);
    activeElements = [
      ...withoutDup,
      { ...el, elementType: el.elementType || 'character', instanceId: ownerKey },
    ];
    table = buildTableSnapshot(buildSheetSnapshotGameState(el, featRow, v2TableContext, activeElements, ownerKey));
  }
  return table;
}

/**
 * @returns {{ model: ReturnType<typeof buildFeatureCardModel>, table: object }}
 */
export function buildFeatureCardModelForCharacter(featRow, el, v2TableContext) {
  const table = buildGuideFeatureTableSnapshot(el, featRow, v2TableContext);
  const ownerKey = getSheetOwnerKey(el);
  const baseOpts = { useLegacyTextFallback: false, table };
  if (ownerKey == null) {
    return {
      model: buildFeatureCardModel(featRow, baseOpts),
      table,
    };
  }
  const usageStore =
    el?.featureUsage && typeof el.featureUsage === 'object' ? el.featureUsage : {};
  return {
    model: buildFeatureCardModel(featRow, {
      ...baseOpts,
      ownerInstanceId: ownerKey,
      usageStore,
    }),
    table,
  };
}

/**
 * Feature rows on a character that expose at least one `isToggle` card chip (V2 engine).
 * Dedupes by `_sourceScopeKey` or `type:name`. Used by the Game Table character panel.
 *
 * @param {object} el — merged display character (`recompute` + `mergeV2DeclarativeSheetOverlay`)
 * @param {{ activeElements?: object[], fearCount?: number, mapConfig?: object|null, tableFeatureState?: object, registry?: object } | null | undefined} v2TableContext
 * @returns {{ featRow: object, model: ReturnType<typeof buildFeatureCardModel>, table: object }[]}
 */
export function collectV2IsToggleCardFeatureGroups(el, v2TableContext) {
  const af = Array.isArray(el.activeFeatures) ? el.activeFeatures : [];
  const out = [];
  const seen = new Set();
  for (const row of af) {
    if (!row || typeof row !== 'object' || row.name == null) continue;
    const { model, table } = buildFeatureCardModelForCharacter(row, el, v2TableContext);
    const hasToggle = (model.cardChips || []).some((c) => c && c.isToggle);
    if (!hasToggle) continue;
    const dedupe = row._sourceScopeKey || `${row.type || 'x'}:${row.name}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ featRow: row, model, table });
  }
  return out;
}

export { formatFrequency, filterCardPhaseChips };
