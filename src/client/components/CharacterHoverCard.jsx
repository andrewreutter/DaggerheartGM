import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AlertCircle, Sparkles, Heart, Shield,
  ChevronDown, ChevronRight, ExternalLink, RefreshCw, Bug, Pencil,
} from 'lucide-react';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { CheckboxTrack } from './DetailCardContent.jsx';
import {
  Section,
  CharacterIdentityHeader,
  CharacterTraitGrid,
  CharacterExperiences,
  CharacterDefenseRow,
  CharacterWeaponList,
  CharacterFeaturesPanel,
  CharacterAbilityList,
  CharacterInventory,
  CharacterCompanion,
  TRAIT_FULL,
  WEAPON_TAG_DESCRIPTIONS,
  formatGold,
  parseBeastformBonus,
} from './CharacterDisplay.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { buildActionForFeatureUse } from '../lib/feature-actions.js';
import {
  runCharacterHook,
  wrapEntity,
  wrapRoll,
  resolveWeaponTagDescriptor,
  getWeaponTagAutomatedForBanner,
  resolveOriginFeatureDescriptor,
  resolveClassFeatureDescriptor,
  resolveAbilityDescriptor,
} from '../lib/game-table-mechanics.js';
import { getEffectiveWeaponRange, recomputeCharacter } from '../lib/character-calc.js';
import { mergeV2DeclarativeSheetOverlay, buildV2RegistryWithSrdItems } from '../lib/v2-declarative-sheet.js';
import { mergeDisplayElIntoTableActiveElements } from '../lib/build-feature-card-model.js';
import { postTableOp, postV2CrossSheetChip } from '../lib/api.js';
import { applyV2LifecycleMutations } from '../lib/table-ops.js';
import {
  collectV2CrossSheetChips,
  activateV2CrossSheetChip,
} from '../lib/v2-cross-sheet-lifecycle.js';
import { runV2OwnedCardChipTableAction } from '../lib/v2-owned-card-chip-table.js';
import { v2RollDieExtrasFromActionLoopPayload } from '../lib/v2-action-notification-dice.js';
import { getFeatureUsageKeyForGuideFeature } from '../lib/feature-usage-key.js';
import { rangeBandNameToFt } from '../lib/map-range.js';
import { formatTargetSummary } from '../lib/helpers.js';
import {
  findPendingManualTrackBanner,
  mergeManualTrackDisplay,
  getPendingManualTrackAckDeltas,
  getLifeSupportPendingHealSlots,
} from '../lib/manual-track-action-loop.js';

// formatGold is re-exported from CharacterDisplay; re-export it for callers that
// already import it from here (keeps backwards-compatibility during migration).
export { formatGold };

/**
 * Append "Vulnerable Target" advantage d6 to rollText, in the same keep-highest pool
 * as any existing advantage dice (last [d6] or [Nd6kh] in the string).
 */
function appendVulnerableTargetToRollText(rollText) {
  const idxD6 = rollText.lastIndexOf(' [d6]');
  const khMatches = [...rollText.matchAll(/ \[\d+d6kh\]/g)];
  const idxKh = khMatches.length > 0 ? khMatches[khMatches.length - 1].index : -1;
  const lastIdx = Math.max(idxD6, idxKh);
  if (lastIdx === -1) {
    return rollText + ' Vulnerable Target [d6]';
  }
  const bracketStart = rollText.indexOf(' [', lastIdx);
  const label = rollText.substring(lastIdx + 1, bracketStart);
  const bracket = rollText.substring(bracketStart);
  const n = bracket === ' [d6]' ? 1 : parseInt(bracket.match(/\d+/)[0], 10);
  return rollText.substring(0, lastIdx) + ' ' + label + ' and Vulnerable Target [' + (n + 1) + 'd6kh]';
}

// ─── Roll text builders ───────────────────────────────────────────────────────

/**
 * Build a roll string for a Daggerheart action roll.
 * Hope [d12] / Fear [d12] are separate expressions so the server can detect
 * which die is dominant.
 */
function buildTraitRollText(charName, traitKey, traitScore, expName, experienceModifier = 2) {
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${traitName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    parts.push(`${traitName} [${traitScore}]`);
  }
  if (expName) {
    parts.push(`${expName} [${experienceModifier}]`);
  }
  return parts.join(' ');
}

/** Returns true when the feature should be shown as a tag on the roll banner. */
function isShowTagFeature(name, characterEl) {
  return resolveWeaponTagDescriptor(name, characterEl)?.showTag === true;
}

/**
 * Build descriptive tag text for a feature in the roll banner.
 * Delegates to the merged descriptor's `tagText` (string or function).
 * Falls back to SRD text or WEAPON_TAG_DESCRIPTIONS for unregistered features.
 */
function buildFeatureTagText(feature, traits, level, characterEl) {
  const f = resolveWeaponTagDescriptor(feature.name, characterEl);
  if (f) {
    const t = f.tagText;
    if (typeof t === 'function') return t({ traits, level });
    if (typeof t === 'string') return t;
  }
  return feature.text || feature.description || WEAPON_TAG_DESCRIPTIONS[feature.name] || '';
}

function buildWeaponRollText(charName, weaponName, traitKey, traitScore, expName, damageStr, feature, traits, level, opts = {}, rollMeta = {}, characterEl = null) {
  const experienceModifier = opts.experienceModifier ?? 2;
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${weaponName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    parts.push(`${traitName} [${traitScore}]`);
  }
  if (expName) {
    parts.push(`${expName} [${experienceModifier}]`);
  }

  const featureSet = feature?.name ? [feature.name] : [];
  const rollCtx = { traits, level, opts };

  // Pre-damage additions (e.g. Reliable [1])
  for (const name of featureSet) {
    const f = resolveWeaponTagDescriptor(name, characterEl);
    const pre = f?.prependRollParts;
    if (Array.isArray(pre) && pre.length) parts.push(...pre);
  }

  // Damage string — rewrite via pipeline hook, except when devastating toggle overrides
  if (damageStr) {
    let effectiveDamage = damageStr;
    if (opts.devastating) {
      const dm = damageStr.trim().match(/^(\d*d\d+)([+-]\d+)?(.*)$/i);
      if (dm) effectiveDamage = `d20${dm[2] || ''}${dm[3] || ''}`;
    } else {
      // Create synthetic roll object and wrap it for mutation-based rewriteDamage hooks
      const syntheticRoll = { damageStr, ...rollMeta };
      const wrappedRoll = wrapRoll(syntheticRoll);
      rollCtx.roll = wrappedRoll;
      const weaponRows = (characterEl?.activeFeatures || []).filter(
        (row) => row.type === 'weapon' && featureSet.includes(row.name)
      );
      if (weaponRows.length) {
        runCharacterHook(weaponRows, 'rewriteDamage', rollCtx);
      }
      // Read the mutated value (fallback to original if no mutation occurred)
      effectiveDamage = wrappedRoll.damageStr ?? damageStr;
    }
    const m = effectiveDamage.trim().match(/^([^\s]+)(?:\s+(.+))?$/);
    if (m) {
      parts.push(`damage [${m[1]}]`);
      if (m[2]) parts.push(m[2].toLowerCase());
    }
  }

  // Post-damage additions (e.g. Reload [d6], Invigorate [d4], Lifesteal [d6])
  for (const name of featureSet) {
    const f = resolveWeaponTagDescriptor(name, characterEl);
    const app = f?.appendRollParts;
    if (Array.isArray(app) && app.length) parts.push(...app);
  }

  // Feature tag when feature opts in with showTag: true, or automated (banner narration / applied style).
  if (feature && (isShowTagFeature(feature.name, characterEl) || getWeaponTagAutomatedForBanner(feature.name, characterEl))) {
    let tagText;
    if (opts.devastating) {
      tagText = 'd20 damage die, mark 1 Stress (active)';
    } else if (feature.name === 'Doubled Up' && opts.secondaryDamage) {
      tagText = `${opts.secondaryDamage} -- deal to another Melee target`;
    } else {
      tagText = buildFeatureTagText(feature, traits, level, characterEl);
    }
    if (tagText) parts.push(`{${feature.name}: ${tagText}}`);
  }
  return parts.join(' ');
}

// ─── Collapsible JSON tree (for debug panel) ──────────────────────────────────

function JsonTree({ data, label, depth = 0, defaultOpen }) {
  const isOpen = defaultOpen ?? depth < 1;
  const [open, setOpen] = useState(isOpen);

  if (data === null || data === undefined) {
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className="text-slate-500 italic">null</span>
      </span>
    );
  }

  if (typeof data !== 'object') {
    const color = typeof data === 'string' ? 'text-emerald-400'
      : typeof data === 'number' ? 'text-amber-300'
      : typeof data === 'boolean' ? 'text-sky-400'
      : 'text-slate-300';
    const display = typeof data === 'string' ? `"${data}"` : String(data);
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className={color}>{display}</span>
      </span>
    );
  }

  const isArray = Array.isArray(data);
  const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
  const brackets = isArray ? ['[', ']'] : ['{', '}'];

  if (entries.length === 0) {
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className="text-slate-600">{brackets[0]}{brackets[1]}</span>
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-0.5 hover:bg-slate-800/60 rounded px-0.5 -ml-0.5 transition-colors text-left"
      >
        {open
          ? <ChevronDown size={9} className="text-slate-500 shrink-0" />
          : <ChevronRight size={9} className="text-slate-500 shrink-0" />}
        {label != null && <span className="text-violet-300">{label}: </span>}
        {!open && (
          <span className="text-slate-600">
            {brackets[0]}<span className="text-slate-500 mx-0.5">{entries.length} item{entries.length !== 1 ? 's' : ''}</span>{brackets[1]}
          </span>
        )}
        {open && <span className="text-slate-600">{brackets[0]}</span>}
      </button>
      {open && (
        <div className="pl-3 border-l border-slate-800 ml-1">
          {entries.map(([key, val]) => (
            <div key={key} className="leading-relaxed">
              <JsonTree data={val} label={isArray ? String(key) : key} depth={depth + 1} />
            </div>
          ))}
          <span className="text-slate-600">{brackets[1]}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CharacterHoverCard — detailed character sheet panel.
 *
 * Props:
 *   el              — character element from activeElements
 *   updateFn        — (instanceId, patch) => void
 *   onResync        — () => void  (optional; triggers re-sync from Daggerstack)
 *   isSyncing       — bool
 *   onRoll          — (rollText, displayName, rollMeta?) => void
 *   onSpendHope     — (instanceId) => void
 *   onUseHopeAbility — (instanceId) => void  (legacy; now routed through onFeatureUse)
 *   showResources   — bool
 *   onEdit          — () => void
 *   onDebugMouseEnter / onDebugMouseLeave — for debug panel hover
 *   onActionNotification — (data) => void
 */

/**
 * Compute the total roll-modifier bonus for a given roll type.
 * Auto-apply mods matching the type are always included (e.g. Channeling on
 * spellcast rolls). The manually-selected mod is added only when it is not
 * auto-apply (i.e. situational mods like Quiet that the player activates).
 */
function getRollModBonus(rollModifiers, activeRollMod, rollType) {
  const autoBonus = rollModifiers
    .filter(rm => rm.autoApply && rm.rollType === rollType)
    .reduce((sum, rm) => sum + rm.score, 0);
  const manualBonus = activeRollMod && !activeRollMod.autoApply ? activeRollMod.score : 0;
  return autoBonus + manualBonus;
}

export function CharacterHoverCard({
  el,
  updateFn,
  expandedKeys,
  onToggleFeature,
  onSetFeatureExpandedKeys,
  onResync,
  isSyncing,
  onRoll,
  onSpendHope,
  onUseHopeAbility,
  showResources = false,
  onEdit,
  onDebugMouseEnter,
  onDebugMouseLeave,
  onActionNotification,
  activeElements,
  mapConfig,
  hideCompanionSection = false,
  pendingResourceCosts = {},
  /** When set, manual stress increases reduce dashed "pending ack" stress (Game Table). */
  consumePendingStressForManualMark,
  isPlayer = false,
  getValidTargets,
  targetMenuOpenRef,
  system,
  characters,
  fearCount = 0,
  tableFeatureState,
  /** Game Table id — required for V2 cross-sheet chips (GM: `postTableOp`; player: `postV2CrossSheetChip`) */
  tableId,
  /** Pending dice/action banners — used to show dashed pending manual track edits */
  pendingBanners,
  /** `{ [rollDbId]: instanceId }` — Life Support ally pre-selection for pending heal preview */
  lifeSupportSelections = {},
  /** When set, manual resource track clicks queue an action banner (GM ack applies) */
  queueManualTrackEdit,
}) {
  const [showDebug, setShowDebug] = useState(false);
  const [devastatingActive, setDevastatingActive] = useState(false);
  const [selectedRollModIndex, setSelectedRollModIndex] = useState(null);
  const [selectedModId, setSelectedModId] = useState(null);
  // For features that requiresInputForFeature (e.g. Sorcerer Channel Raw Power)
  const [featureInputPending, setFeatureInputPending] = useState(null); // { feature, subFeature, action, spec }

  const [featureInputValue, setFeatureInputValue] = useState('');
  // Druid beastform selection (shared by Beastform class feature and Evolution hope ability)
  // In-place target menu before sending roll: { type: 'weapon'|'beastform', rollText, displayName, rollMeta, validTargets, opts?, anchorRect? }
  const [targetMenuPending, setTargetMenuPending] = useState(null);

  /** GM or assigned player with `updateFn` — full V2 card chips (Beastform, Evolution, Elemental Incarnation, domain cards). */
  const v2TableScoped = !!(updateFn && tableId);

  const pendingManualRoll = useMemo(
    () => findPendingManualTrackBanner(pendingBanners ?? [], el.instanceId),
    [pendingBanners, el.instanceId]
  );
  const trackEl = useMemo(
    () => mergeManualTrackDisplay(el, pendingManualRoll),
    [el, pendingManualRoll]
  );
  const manualAck = useMemo(
    () => getPendingManualTrackAckDeltas(el, pendingManualRoll),
    [el, pendingManualRoll]
  );
  const lifeSupportHealSlots = useMemo(
    () => getLifeSupportPendingHealSlots(pendingBanners, lifeSupportSelections, el.instanceId),
    [pendingBanners, lifeSupportSelections, el.instanceId]
  );

  // targetMenuOpenRef is kept in sync synchronously in every setTargetMenuPending call below.
  // (useEffect would be async/post-render, causing a race condition with onMouseLeave.)
  const openTargetMenu = (value) => {
    if (targetMenuOpenRef) targetMenuOpenRef.current = true;
    setTargetMenuPending(value);
  };
  const closeTargetMenu = () => {
    if (targetMenuOpenRef) targetMenuOpenRef.current = false;
    setTargetMenuPending(null);
  };

  useEffect(() => {
    if (!targetMenuPending) return;
    const onKey = (e) => { if (e.key === 'Escape') closeTargetMenu(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [targetMenuPending]);

  const { srdData } = useCharacterSrdData();

  const v2Registry = useMemo(
    () => (srdData ? buildV2RegistryWithSrdItems(srdData) : null),
    [srdData]
  );

  // Recompute for display so experiences (and other derived fields) reflect ancestry bonus on game table
  const displayEl = useMemo(() => {
    if (!srdData) return el;
    const base = recomputeCharacter(el, srdData);
    return mergeV2DeclarativeSheetOverlay(base, el, srdData, {
      fearCount,
      mapConfig,
      tableFeatureState,
    });
  }, [el, srdData, fearCount, mapConfig, tableFeatureState]);

  /** Same merge as Guide V2 snapshots — ensures this PC is in the actor map when SSE activeElements is stale/short. */
  const activeElementsForV2Snapshots = useMemo(
    () => mergeDisplayElIntoTableActiveElements(displayEl, { activeElements }),
    [displayEl, activeElements]
  );

  const crossSheetChips = useMemo(() => {
    if (!v2Registry || !el.instanceId || !Array.isArray(activeElementsForV2Snapshots)) return [];
    return collectV2CrossSheetChips(el.instanceId, activeElementsForV2Snapshots, v2Registry, 'card', {
      tableFeatureState,
      fearCount,
      mapConfig,
    });
  }, [v2Registry, el.instanceId, activeElementsForV2Snapshots, tableFeatureState, fearCount, mapConfig]);

  const handleCrossSheetChipClick = useCallback(
    (chip) => {
      if (!v2Registry || !el.instanceId || !tableId) return;
      if (chip.disabled || chip.resourceUnaffordable) return;
      const { mutations } = activateV2CrossSheetChip(chip, el.instanceId, activeElementsForV2Snapshots, v2Registry, {
        tableFeatureState,
        fearCount,
        mapConfig,
      });
      const { updates, actionLoopNotifications } = applyV2LifecycleMutations(
        activeElementsForV2Snapshots,
        mutations,
        chip._ownerInstanceId
      );
      if (updates.length > 0) {
        postTableOp({ op: 'update-elements', updates }, tableId);
      }
      for (const p of actionLoopNotifications) {
        const baseDesc = p.description || '';
        const actionText =
          p.affectedSummary && String(p.affectedSummary).trim()
            ? `${baseDesc}\n${p.affectedSummary}`
            : baseDesc;
        onActionNotification?.({
          _action: true,
          rollUser: p.rollUser || 'Table',
          actionName: p.title,
          actionText,
          _v2ActionLoop: true,
          _reactorInstanceId: p.instanceId,
          ...v2RollDieExtrasFromActionLoopPayload(p),
          ...(Array.isArray(p.affectedNames) && p.affectedNames.length > 0
            ? { _affectedNames: p.affectedNames, _affectedInstanceIds: p.affectedInstanceIds }
            : {}),
        });
      }
    },
    [v2Registry, el.instanceId, tableId, activeElementsForV2Snapshots, tableFeatureState, fearCount, mapConfig, onActionNotification]
  );

  const handlePlayerCrossSheetChipClick = useCallback(
    async (chip) => {
      if (!el.instanceId || !tableId) return;
      if (chip.disabled || chip.resourceUnaffordable) return;
      if (chip._chipKey == null || chip._chipKey === '') return;
      try {
        await postV2CrossSheetChip(tableId, { viewerInstanceId: el.instanceId, chipKey: chip._chipKey });
      } catch (err) {
        console.error(err);
      }
    },
    [el.instanceId, tableId]
  );

  const handleV2DomainChip = useCallback(
    async ({ featRow, chip, featureKey: passedFeatureKey, selectOpts }) => {
      if (!v2Registry || !el.instanceId || !tableId || !Array.isArray(activeElementsForV2Snapshots)) return;
      await runV2OwnedCardChipTableAction({
        featRow,
        chip,
        passedFeatureKey,
        selectOpts,
        displayEl,
        el,
        activeElementsForV2Snapshots,
        v2Registry,
        tableFeatureState,
        fearCount,
        mapConfig,
        tableId,
        onActionLoopNotification: onActionNotification,
        isPlayer: !!isPlayer,
      });
    },
    [v2Registry, el, el.instanceId, displayEl, isPlayer, tableId, activeElementsForV2Snapshots, tableFeatureState, fearCount, mapConfig, onActionNotification]
  );

  const traits = displayEl.traits || {};
  const hasDaggerstack = !!el.daggerstackUrl;
  const rollModifiers = el.armorMods?.rollModifiers || [];
  const activeRollMod = selectedRollModIndex != null ? rollModifiers[selectedRollModIndex] : null;
  const activeModifiers = el.activeModifiers || [];
  const selectedMod = selectedModId != null ? activeModifiers.find(m => m.id === selectedModId) : null;

  // Compute modifier eligibility for class features that auto-enable/disable chips (dispatch by feature name).
  // (e.g. Rogue's Sneak Attack requires Cloaked or ally-in-Melee proximity).
  const modifierEligibility = useMemo(() => {
    const allClassFeatures = [...(el.classFeatures || []), ...(el.subclassFeatures || [])];
    let result = {};
    for (const f of allClassFeatures) {
      const descriptor = resolveClassFeatureDescriptor(displayEl, f.name);
      if (descriptor?.computeModifierEligibility) {
        Object.assign(result, descriptor.computeModifierEligibility({
          el,
          activeElements: activeElements ?? [],
          mapConfig: mapConfig ?? {},
        }) || {});
      }
    }
    return result;
  }, [el, displayEl, activeElements, mapConfig]);

  // ── Feature roll text builder ────────────────────────────────────────────────
  // Spellcast and ad-hoc dice come from merged V2 rows (`enrichHoverActionMeta`) + registry `clientHoverUseRoll`.
  const buildFeatureRollText = (feature, subFeature, action) => {
    const charName = el.name;
    const featName = subFeature ? subFeature.name : feature.name;
    const parts = [];

    const frd =
      resolveClassFeatureDescriptor(displayEl, feature.name) ??
      resolveAbilityDescriptor(displayEl, feature.name) ??
      resolveOriginFeatureDescriptor(displayEl, feature.name);
    const hoverRoll = frd?.clientHoverUseRoll ?? null;

    if (action.spellcastDC != null || action.spellcastVsRoll) {
      const traitKey = (displayEl.spellcastTrait || el.spellcastTrait || 'presence').toLowerCase();
      const bfForSpellcast = parseBeastformBonus(displayEl.activeBeastform?.trait_bonus);
      const beastformBonus = bfForSpellcast?.stat === traitKey ? bfForSpellcast.bonus : 0;
      const baseScore = traits[traitKey] ?? 0;
      const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, 'spellcast');
      const modBonus = selectedMod?.mode === 'roll' && selectedMod.dice ? 0 : (selectedMod?.bonus ?? 0);
      const effectiveScore = baseScore + beastformBonus + rollModBonus + modBonus;
      parts.push(`${charName} ${featName} Hope [d12] Fear [d12]`);
      if (effectiveScore !== 0) {
        parts.push(`${TRAIT_FULL[traitKey] || traitKey} [${effectiveScore}]`);
      }
      parts.push(
        action.spellcastDC != null
          ? `{${featName}: Spellcast Roll DC ${action.spellcastDC}}`
          : `{${featName}: Spellcast Roll}`,
      );
    } else if (hoverRoll === 'duality') {
      parts.push(`${charName} ${featName} Hope [d12] Fear [d12]`);
    } else if (typeof hoverRoll === 'string' && hoverRoll && hoverRoll !== 'duality') {
      parts.push(`${charName} ${featName} [${hoverRoll}]`);
    }

    // Append cost tags so the ResultBanner can display them
    if (action.hopeCost > 0)  parts.push(`{HopeCost: Spend ${action.hopeCost} Hope}`);
    if (action.stressCost > 0) parts.push(`{StressCost: Mark ${action.stressCost} Stress}`);
    if (action.armorClear > 0) parts.push(`{ArmorClear: Clear ${action.armorClear} Armor slot}`);
    if (action.armorMark > 0)  parts.push(`{ArmorMark: Mark ${action.armorMark} Armor slot}`);

    // Include selected active modifier (roll-mode die) in the roll
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      parts.push(`${selectedMod.name} [${selectedMod.dice}]`);
    }

    return parts.join(' ');
  };

  // ── Feature use handler ──────────────────────────────────────────────────────
  // Called when user clicks Use on a feature or a SubFeatureCard.
  const handleFeatureUse = onRoll || onActionNotification ? (feature, subFeature = null, event = null) => {
    // Galapa Retract: toggle retractedActive and keep move/resistance/disadvantage in sync (no banner).
    if (feature.name === 'Retract' && updateFn && el?.instanceId) {
      const source = 'Galapa - Retract';
      const nextActive = !el.retractedActive;
      const resistance = Array.isArray(el.resistance) ? el.resistance.filter(r => !(r.type === 'physical' && r.source === source)) : [];
      if (nextActive) resistance.push({ type: 'physical', source });
      const disadvantageSources = Array.isArray(el.disadvantageSources) ? el.disadvantageSources.filter(s => s !== source) : [];
      if (nextActive) disadvantageSources.push(source);
      const moveDisabledSources = Array.isArray(el.moveDisabledSources) ? el.moveDisabledSources.filter(s => s !== source) : [];
      if (nextActive) moveDisabledSources.push(source);
      updateFn(el.instanceId, { retractedActive: nextActive, resistance, disadvantageSources, moveDisabledSources });
      return;
    }
    // Sorcerer Channel Raw Power (and any future class feature) requires an input value
    // before dispatch. Show an inline prompt and defer actual dispatch until submitted. (Dispatch by feature name.)
    const classFeatForInput =
      resolveClassFeatureDescriptor(displayEl, feature.name) ?? resolveAbilityDescriptor(displayEl, feature.name);
    const requiredInputSpec = classFeatForInput?.requiresInput;
    if (requiredInputSpec && !featureInputPending) {
      const action = buildActionForFeatureUse(displayEl, feature, subFeature);
      setFeatureInputPending({ feature, subFeature, action, spec: requiredInputSpec });
      setFeatureInputValue(String(requiredInputSpec.default ?? 1));
      return;
    }

    const activeDesc = subFeature ? (subFeature.description || '') : (feature.description || '');
    const action = buildActionForFeatureUse(displayEl, feature, subFeature);
    // Sub-feature cost may come from name, e.g. "Hold Them Off (3 Hope)" — prefer explicit number
    if (subFeature && typeof subFeature.hopeCost === 'number') action.hopeCost = subFeature.hopeCost;
    const featName = subFeature ? subFeature.name : feature.name;

    // Feature-level key for usage tracking — must match Guide `entry.key` (see feature-usage-key.js)
    const featureKey = getFeatureUsageKeyForGuideFeature(el, feature.name) ?? feature.name;

    // ── Prayer Dice: roll Nd4, chips are created from results on banner dismiss ──
    // Bypass the target-picker path entirely — the description mentions "ally" but
    // clicking Prayer Dice is just rolling, not spending a specific die yet.
    if (feature.name === 'Prayer Dice') {
      const spellcastCount = (el.spellcastTrait && el.traits?.[el.spellcastTrait])
        ? el.traits[el.spellcastTrait]
        : 2;
      const diceExprs = Array(Math.max(1, spellcastCount)).fill('[d4]').join(' ');
      const rollText = `${el.name} Prayer Dice ${diceExprs}`;
      const displayName = `${el.name} Prayer Dice`;  // shown as banner header
      const prayerRollMeta = {
        _featureUse: true,
        _isPrayerDiceRoll: true,
        _attackerInstanceId: el.instanceId,
        _featureName: 'Prayer Dice',
        _featureKey: featureKey,
        _frequency: 'session',
      };
      onRoll?.(rollText, displayName, prayerRollMeta, { characterEl: el });
      return;
    }

    // _inputValue carries card level / numeric inputs (e.g. Sorcerer Channel Raw Power)
    const inputVal = featureInputPending?.feature?.name === feature.name
      ? (parseFloat(featureInputValue) || (featureInputPending.spec?.default ?? 1))
      : null;
    if (featureInputPending) setFeatureInputPending(null);

    const forceAction =
      resolveClassFeatureDescriptor(displayEl, feature.name)?.forceActionNotification === true ||
      resolveAbilityDescriptor(displayEl, feature.name)?.forceActionNotification === true;
    const featDesc =
      resolveClassFeatureDescriptor(displayEl, feature.name) ??
      resolveAbilityDescriptor(displayEl, feature.name) ??
      resolveOriginFeatureDescriptor(displayEl, feature.name);
    const hoverRoll = featDesc?.clientHoverUseRoll ?? null;
    const hasDice =
      !forceAction &&
      (action.spellcastDC != null ||
        action.spellcastVsRoll ||
        (typeof hoverRoll === 'string' && hoverRoll.length > 0));
    const looksLikeActionRoll =
      action.spellcastDC != null ||
      action.spellcastVsRoll ||
      hoverRoll === 'duality' ||
      (typeof hoverRoll === 'string' && /^d12\b/i.test(hoverRoll));
    const rollMeta = {
      _featureUse: true,
      _attackerInstanceId: el.instanceId,
      _featureName: feature.name,
      _subFeatureName: subFeature?.name || null,
      _hopeCost: action.hopeCost,
      _stressCost: action.stressCost,
      _armorMark: action.armorMark,
      _armorClear: action.armorClear,
      _frequency: action.frequency,
      _featureKey: featureKey,
      _targetType: action.targetType,
      ...(inputVal !== null ? { _inputValue: inputVal } : {}),
      // Legacy action-notification path (no V2 activateV2OwnedCardChip): GM ack applies via applyFeatureResources.
      ...(feature.name === "Rogue's Dodge"
        ? {
            _roguesDodgeFeatureStateActivate: true,
          }
        : {}),
    };
    if (hasDice && looksLikeActionRoll) {
      rollMeta._intentPanelForActionRoll = true;
      rollMeta._deferExperienceToPreRoll = true;
      if (action.spellcastDC != null || action.spellcastVsRoll) {
        rollMeta._traitKey = (el.spellcastTrait || 'presence').toLowerCase();
      } else {
        rollMeta._traitKey = Object.keys(traits)[0] || 'agility';
      }
    }

    if (hasDice) {
      // Dice roll path — experience Hope cost applied on GM ack, not here
      let rollText = buildFeatureRollText(feature, subFeature, action);
      if (!rollText) return;
      const displayName = subFeature ? `${el.name} ${feature.name}: ${subFeature.name}` : `${el.name} ${feature.name}`;
      onRoll?.(rollText, displayName, rollMeta, { characterEl: el });
      if (selectedMod) setSelectedModId(null);
    } else {
      // Action notification path (costs but no dice, or comms-only)
      const truncDesc = activeDesc.length > 150 ? activeDesc.slice(0, 150) + '…' : activeDesc;
      const actionText = truncDesc;
      const notification = {
        _action: true,
        rollUser: el.name,
        actionName: featName,
        actionText,
        tags: [
          ...(action.hopeCost > 0  ? [{ name: 'HopeCost',  text: `Spend ${action.hopeCost} Hope` }]  : []),
          ...(action.stressCost > 0 ? [{ name: 'StressCost', text: `Mark ${action.stressCost} Stress` }] : []),
          ...(action.armorClear > 0 ? [{ name: 'ArmorClear', text: `Clear ${action.armorClear} Armor slot` }] : []),
          ...(action.armorMark > 0  ? [{ name: 'ArmorMark',  text: `Mark ${action.armorMark} Armor slot` }]  : []),
        ],
        ...rollMeta,
      };

      // Features that require an adversary target: show in-place picker at click time,
      // like weapon attacks. Picker appears before the notification is sent so both
      // GM and players select the target when initiating the action.
      // Skip picker for force-action features (e.g. Elemental Incarnation Fire/Water) where target is unused.
      if (action.targetType === 'adversary' && getValidTargets && onActionNotification && !forceAction) {
        const closeFt = rangeBandNameToFt('Close') ?? 30;
        let validTargets = getValidTargets(el.instanceId, { weaponRangeFt: closeFt }) ?? [];
        if (validTargets.length === 0) {
          // Attacker not on map or no targets in range: fall back to ALL adversaries
          validTargets = (getValidTargets(el.instanceId, {}) ?? []).filter(t => t.type === 'adversary');
        }
        const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
        openTargetMenu({ type: 'feature_action', notification, validTargets, anchorRect });
        return;
      }

      onActionNotification?.(notification);
    }
  } : undefined;

  // Beastform trait bonus for rolls (must match display in CharacterTraitGrid — uses merged overlay)
  const beastformTraitBonus = parseBeastformBonus(displayEl.activeBeastform?.trait_bonus);
  const getBeastformTraitBonus = (traitKey) =>
    (beastformTraitBonus?.stat === traitKey ? beastformTraitBonus.bonus : 0);

  // ── Trait click handler (used by both trait chips and Reaction row) ───────────
  // Same roll text (trait in roll), same meta (_traitKey, _attackerInstanceId, experience/mod/advantage).
  // Only difference for Reaction: displayName and _isReaction flag.
  const handleTraitClick = onRoll ? (traitKey, opts) => {
    const isReaction = opts?.isReaction === true;
    const baseScore = traits[traitKey] ?? 0;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, traitKey);
    const effectiveScore = baseScore + getBeastformTraitBonus(traitKey) + rollModBonus;
    let rollText = buildTraitRollText(el.name, traitKey, effectiveScore, null, 2);
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    const displayName = isReaction ? `${el.name} — Reaction (${TRAIT_FULL[traitKey]})` : `${el.name} ${TRAIT_FULL[traitKey]}`;
    const traitRollMeta = {
      _attackerInstanceId: el.instanceId,
      _traitKey: traitKey,
      ...(isReaction && { _isReaction: true }),
      ...(selectedMod?.consumeOnUse && { _usedModifierId: selectedMod.id }),
      _intentPanelForActionRoll: true,
      _deferExperienceToPreRoll: true,
    };
    onRoll(rollText, displayName, traitRollMeta, { characterEl: el });
    if (selectedMod) setSelectedModId(null);
  } : undefined;

  // ── Spellcast roll handler ─────────────────────────────────────────────────
  const handleSpellcastRoll = onRoll && (displayEl.spellcastTrait || el.spellcastTrait) ? () => {
    const traitKey = (displayEl.spellcastTrait || el.spellcastTrait).toLowerCase();
    const baseScore = traits[traitKey] ?? 0;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, 'spellcast');
    const effectiveScore = baseScore + getBeastformTraitBonus(traitKey) + rollModBonus;
    let rollText = buildTraitRollText(el.name + ' Spellcast', traitKey, effectiveScore, null, 2);
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    const displayName = `${el.name} Spellcast`;
    const spellcastRollMeta = {
      _attackerInstanceId: el.instanceId,
      _traitKey: traitKey,
      _intentPanelForActionRoll: true,
      _deferExperienceToPreRoll: true,
    };
    if (selectedMod?.consumeOnUse) spellcastRollMeta._usedModifierId = selectedMod.id;
    onRoll(rollText, displayName, spellcastRollMeta, { characterEl: el });
    if (selectedMod) setSelectedModId(null);
  } : undefined;

  // Send roll (used after target selection or when no target menu needed)
  const sendWeaponRoll = (rollText, displayName, rollMeta, opts) => {
    onRoll(rollText, displayName, rollMeta, { characterEl: el });
    if (selectedMod) setSelectedModId(null);
    if (opts?.devastating) {
      const maxStress = el.maxStress ?? 6;
      const newStress = Math.min((el.currentStress ?? 0) + 1, maxStress);
      updateFn(el.instanceId, { currentStress: newStress });
      setDevastatingActive(false);
    }
  };

  // ── Weapon click handler ─────────────────────────────────────────────────────
  const handleWeaponClick = onRoll ? (weapon, rollMeta = {}, event = null) => {
    const traitKey = (weapon.trait || '').toLowerCase();
    const baseTrait = traits[traitKey] ?? 0;
    const opts = {};
    if (rollMeta.devastating) opts.devastating = true;
    if (rollMeta.secondaryDamage) opts.secondaryDamage = rollMeta.secondaryDamage;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, traitKey);
    const effectiveTrait = baseTrait + getBeastformTraitBonus(traitKey) + rollModBonus;
    // Virtual weapons (e.g. Elemental Breath) can add Proficiency to damage and a damage type for the roll.
    let damageStr = weapon.damage;
    if (weapon.damageProficiency && el.proficiency != null) {
      const base = weapon.damage || 'd8';
      const prof = el.proficiency ? `+${el.proficiency}` : '';
      const type = (weapon.damageType || '').toLowerCase();
      damageStr = `${base}${prof}${type ? ' ' + type : ''}`;
    }
    let rollText = buildWeaponRollText(
      el.name, weapon.name, traitKey, effectiveTrait,
      null, damageStr, weapon.feature, traits, el.level, opts, rollMeta, el,
    );
    const rangeStr = getEffectiveWeaponRange(weapon, el.ancestryFeatures) || weapon.effectiveRange || weapon.range;
    if (rangeStr) rollText += ` ${rangeStr}`;
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    let displayName = `${el.name} ${weapon.name}`;
    rollMeta._attackerInstanceId = el.instanceId;
    if (weapon.id != null) rollMeta._weaponId = weapon.id;
    rollMeta._traitKey = (weapon.trait || '').toLowerCase();
    if (rangeStr) {
      const ft = rangeBandNameToFt(rangeStr);
      if (ft != null) rollMeta._weaponRangeFt = ft;
    }
    if (selectedMod?.consumeOnUse) rollMeta._usedModifierId = selectedMod.id;
    rollMeta._intentPanelForActionRoll = true;
    rollMeta._deferExperienceToPreRoll = true;
    if (weapon._featureName) rollMeta._featureName = weapon._featureName;
    if (weapon._featureName && (weapon.onAcknowledge || weapon.stressCost != null || weapon.hopeCost != null)) rollMeta._featureNeedsTarget = true;
    if (weapon.multiTarget) {
      rollMeta._multiTarget = true;
      if (weapon.multiTargetMax != null) rollMeta._multiTargetMax = weapon.multiTargetMax;
    }
    if (weapon._kick) rollMeta._stressCost = 1;
    // Ranger's Focus: use on next attack (toggle adds Hope cost and title suffix)
    if (el.rangerFocusOnNextAttack && updateFn) {
      rollMeta._rangerFocusAttempt = true;
      rollMeta._hopeCost = (rollMeta._hopeCost || 0) + 1;
      displayName = `${el.name} ${weapon.name} with Ranger's Focus attempt`;
    }

    if (getValidTargets && rollMeta._weaponRangeFt != null) {
      const validTargets = getValidTargets(el.instanceId, {
        weaponRangeFt: rollMeta._weaponRangeFt,
      }) ?? [];
      if (validTargets.length === 0) return;
      // Multi-target weapons: send roll immediately; target selection happens on the banner.
      if (weapon.multiTarget) {
        sendWeaponRoll(rollText, displayName, rollMeta, opts);
        if (rollMeta._rangerFocusAttempt && updateFn) updateFn(el.instanceId, { rangerFocusOnNextAttack: false });
        return;
      }
      const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
      openTargetMenu({ type: 'weapon', rollText, displayName, rollMeta, validTargets, opts, anchorRect });
      return;
    }
    sendWeaponRoll(rollText, displayName, rollMeta, opts);
    if (rollMeta._rangerFocusAttempt && updateFn) updateFn(el.instanceId, { rangerFocusOnNextAttack: false });
  } : undefined;

  const handleTargetMenuSelect = (target) => {
    if (!targetMenuPending) return;
    let { type, rollText, displayName, rollMeta, opts, notification } = targetMenuPending;

    // Action notification with pre-selected target (e.g. Make a Scene, Bard)
    if (type === 'feature_action') {
      onActionNotification?.({
        ...notification,
        _selectedTargetInstanceId: target.instanceId,
        _selectedTargetName: target.name,
      });
      closeTargetMenu();
      return;
    }

    if (target.type === 'adversary' && target.vulnerable) {
      rollText = appendVulnerableTargetToRollText(rollText);
    }
    onRoll(rollText, displayName, { ...rollMeta, _selectedTargetInstanceId: target.instanceId }, { characterEl: el });
    if (type === 'weapon') {
      if (rollMeta._rangerFocusAttempt && updateFn) updateFn(el.instanceId, { rangerFocusOnNextAttack: false });
      if (selectedMod) setSelectedModId(null);
      if (opts?.devastating) {
        const maxStress = el.maxStress ?? 6;
        const newStress = Math.min((el.currentStress ?? 0) + 1, maxStress);
        updateFn(el.instanceId, { currentStress: newStress });
        setDevastatingActive(false);
      }
    }
    closeTargetMenu();
  };

  const handleTargetMenuCancel = () => {
    closeTargetMenu();
  };

  // ── Beastform helpers ────────────────────────────────────────────────────────

  /**
   * Parse a beastform attack string like "Melee Agility d4 phy" into parts.
   * Returns { range, traitKey, damage, dmgType } or null.
   */
  const parseBeastformAttack = (attackStr) => {
    const parts = (attackStr || '').trim().split(/\s+/);
    if (parts.length < 3) return null;
    return {
      range: parts[0],
      traitKey: parts[1].toLowerCase(),
      damage: parts[2],
      dmgType: parts[3] || '',
    };
  };

  // Click to set/clear the selected beastform advantage (mutually exclusive)
  const handleBeastformAdvantageSelect = updateFn ? (adv) => {
    updateFn(el.instanceId, { selectedBeastformAdvantage: adv });
  } : undefined;

  // Build and fire a beastform attack roll (merge display overlay so SRD attack/trait_bonus resolve when table state is minimal)
  const mergedActiveBeastform =
    displayEl.activeBeastform || el.activeBeastform
      ? { ...(el.activeBeastform || {}), ...(displayEl.activeBeastform || {}) }
      : null;
  const handleBeastformAttack = onRoll && mergedActiveBeastform ? (event = null) => {
    const bf = mergedActiveBeastform;
    const parsed = parseBeastformAttack(bf.attack);
    if (!parsed) return;
    const { range, traitKey, damage, dmgType } = parsed;
    const traitScore = traits[traitKey] ?? 0;
    const bfBonus = parseBeastformBonus(bf.trait_bonus);
    const effectiveScore = traitScore + (bfBonus?.stat === traitKey ? bfBonus.bonus : 0);
    const traitName = TRAIT_FULL[traitKey] || traitKey;
    const profBonus = el.proficiency ? `+${el.proficiency}` : '';
    const dmgStr = profBonus ? `${damage}${profBonus}` : damage;
    let rollText = `${el.name} ${bf.name} ${traitName} Hope [d12] Fear [d12]`;
    if (effectiveScore !== 0) rollText += ` ${traitName} [${effectiveScore}]`;
    rollText += ` damage [${dmgStr}]`;
    if (dmgType) rollText += ` ${dmgType}`;
    if (range) rollText += ` ${range}`;
    if (el.selectedBeastformAdvantage) rollText += ` ${el.selectedBeastformAdvantage} [d6]`;
    const displayName = `${el.name} ${bf.name}`;
    const beastformRollMeta = { _attackerInstanceId: el.instanceId };
    if (range) {
      const ft = rangeBandNameToFt(range);
      if (ft != null) beastformRollMeta._weaponRangeFt = ft;
    }
    if (getValidTargets && beastformRollMeta._weaponRangeFt != null) {
      const validTargets = getValidTargets(el.instanceId, {
        weaponRangeFt: beastformRollMeta._weaponRangeFt,
      }) ?? [];
      if (validTargets.length === 0) return;
      const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
      openTargetMenu({ type: 'beastform', rollText, displayName, rollMeta: beastformRollMeta, validTargets, anchorRect });
      return;
    }
    onRoll(rollText, displayName, beastformRollMeta, { characterEl: el });
  } : undefined;

  // ── Header action buttons ────────────────────────────────────────────────────
  const headerActions = (
    <>
      {onEdit && (
        <button
          onClick={onEdit}
          title="Edit character"
          className="p-1 rounded text-slate-500 hover:text-sky-400 transition-colors"
        >
          <Pencil size={11} />
        </button>
      )}
      {(el._daggerstackDebug || el._daggerstackLookupTables) && (
        <button
          onClick={() => setShowDebug(d => !d)}
          title="Debug: view raw Daggerstack payloads"
          className={`p-1 rounded transition-colors ${showDebug ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
        >
          <Bug size={11} />
        </button>
      )}
      {hasDaggerstack && onResync && (
        <button
          onClick={onResync}
          disabled={isSyncing}
          title="Re-sync from Daggerstack"
          className="p-1 rounded text-slate-500 hover:text-sky-400 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
        </button>
      )}
      {hasDaggerstack && (
        <a
          href={el.daggerstackUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on Daggerstack"
          className="p-1 rounded text-slate-500 hover:text-sky-400 transition-colors"
        >
          <ExternalLink size={11} />
        </a>
      )}
    </>
  );

  const stressMaxed = (trackEl.currentStress ?? 0) >= (el.maxStress ?? 6);
  const currentHope = trackEl.hope ?? (el.maxHope ?? 6);

  return (
    <div className="relative flex flex-col flex-1 min-h-0">

    {/* ── Target selection popover (fixed, anchored to clicked weapon card) ── */}
    {targetMenuPending && (() => {
      const rect = targetMenuPending.anchorRect;
      const top = rect ? Math.min(rect.bottom + 4, window.innerHeight - 160) : window.innerHeight / 2;
      const left = rect ? Math.min(rect.left, window.innerWidth - 200) : window.innerWidth / 2;
      return (
        <>
          {/* Transparent backdrop — click to dismiss */}
          <div
            className="fixed inset-0 z-[200]"
            onClick={handleTargetMenuCancel}
          />
          {/* Popover */}
          <div
            className="fixed z-[201] rounded-lg border border-amber-600/70 bg-slate-900 shadow-2xl p-2 space-y-2"
            style={{ top, left, minWidth: '140px', maxWidth: '220px' }}
          >
            <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide">
              {targetMenuPending.validTargets.length > 0 ? 'Choose target' : 'No targets in range'}
            </div>
            <div className="space-y-1">
              {targetMenuPending.validTargets.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic px-1 py-1">No valid targets are in range of this attack.</p>
              ) : targetMenuPending.validTargets.map((t) => {
                const sum = formatTargetSummary(t, { hideMax: isPlayer });
                return (
                  <button
                    key={t.instanceId}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleTargetMenuSelect(t); }}
                    className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-amber-600/60 bg-slate-800/80 text-slate-200 hover:bg-amber-800/60 hover:border-amber-500 transition-colors"
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{t.name}</span>
                      {t.vulnerable && (
                        <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-amber-900/60 border border-amber-600/70 text-amber-200" title="Attacker gains advantage die: Vulnerable Target">Vulnerable</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {[sum.hp, sum.stress].filter(Boolean).join(' · ')}
                      {sum.conditions ? ` · ${sum.conditions}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleTargetMenuCancel(); }}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      );
    })()}

    <div className="w-[22rem] bg-slate-900 border border-sky-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0">

      {/* ── Header ── */}
      <div className="shrink-0">
        <CharacterIdentityHeader el={el} actions={headerActions} />
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">

        <CharacterDefenseRow el={displayEl} />

        {/* ── Traits ── */}
        <CharacterTraitGrid
          el={displayEl}
          onTraitClick={handleTraitClick}
          onSpellcastRoll={handleSpellcastRoll}
        />

        {/* ── Experiences + Modifier Bin ── */}
        <CharacterExperiences
          el={displayEl}
          experiencesAsBadges
          hope={currentHope}
          maxHope={el.maxHope ?? 6}
          rollModifiers={rollModifiers}
          selectedRollModIndex={selectedRollModIndex}
          onSelectRollMod={onRoll ? setSelectedRollModIndex : undefined}
          selectedModId={selectedModId}
          onSelectMod={onRoll ? setSelectedModId : undefined}
          modifierEligibility={modifierEligibility}
          beastformAdvantages={displayEl.activeBeastform?.advantages
            ? displayEl.activeBeastform.advantages.split(',').map(s => s.trim()).filter(Boolean)
            : undefined}
          selectedBeastformAdvantage={el.selectedBeastformAdvantage ?? null}
          onSelectBeastformAdvantage={updateFn ? handleBeastformAdvantageSelect : undefined}
          crossSheetChips={crossSheetChips}
          onCrossSheetChipClick={
            tableId ? (isPlayer ? handlePlayerCrossSheetChipClick : handleCrossSheetChipClick) : undefined
          }
          onUseMod={updateFn ? (mod) => {
            // clearStress mode chips (e.g. Rogue's Dodge): clear 1 Stress and consume the modifier
            if (mod.mode === 'clearStress') {
              const stress = Math.max(0, (el.currentStress ?? 0) - 1);
              updateFn(el.instanceId, { currentStress: stress });
              const kept = (el.activeModifiers || []).filter(m => m.id !== mod.id);
              updateFn(el.instanceId, { activeModifiers: kept });
              return;
            }
          } : undefined}
          onUseMode={updateFn ? (mod, mode) => {
            // Prayer Die: gainHope → post ActionBanner for GM ack (not direct apply)
            if (mod.name === 'Prayer Die' && mode === 'gainHope') {
              onActionNotification?.({
                _action: true,
                rollUser: el.name,
                actionName: 'Prayer Die',
                actionText: `Use Prayer Die to gain ${mod.value} Hope`,
                _prayerDieGainHope: { modId: mod.id, value: mod.value, instanceId: el.instanceId },
                _attackerInstanceId: el.instanceId,
              });
              return; // Die is consumed on GM ack, not here
            }
            // Dispatch class feature onModifierUsed hook (per-feature)
            const selfEl = wrapEntity(el, updateFn);
            for (const f of el.classFeatures || []) {
              const descriptor = resolveClassFeatureDescriptor(displayEl, f.name);
              if (descriptor?.onModifierUsed) {
                descriptor.onModifierUsed({ modifier: mod, mode, selfEl, updateActiveElement: updateFn });
              }
            }
            // Consume the modifier chip after use
            const kept = (el.activeModifiers || []).filter(m => m.id !== mod.id);
            updateFn(el.instanceId, { activeModifiers: kept });
          } : undefined}
        />

        {/* ── Resource tracks ── */}
        {showResources && (
          <Section label="Resources">
            <div className="space-y-1.5">
              {(() => {
                const maxHope = el.maxHope ?? 6;
                const hopePending = pendingResourceCosts[el.instanceId]?.hope ?? 0;
                const remainingServer = el.hope ?? maxHope;
                return maxHope > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={11} className="text-amber-400 shrink-0" />
                    <span className="text-[11px] text-slate-400 w-10 shrink-0">Hope</span>
                    <CheckboxTrack
                      total={maxHope}
                      filled={Math.max(0, remainingServer - hopePending)}
                      pendingFilled={hopePending + manualAck.hopeGain}
                      pendingClearFilled={manualAck.hopeSpend}
                      onSetFilled={queueManualTrackEdit
                        ? (h) => queueManualTrackEdit(el, { hope: h })
                        : (h) => updateFn(el.instanceId, { hope: h })}
                      fillColor="bg-amber-400"
                      label="Hope"
                      verbs={['Gain', 'Spend']}
                      pulseOnDecreaseOnly
                    />
                    <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.hope ?? maxHope}/{maxHope}</span>
                  </div>
                );
              })()}
              {(el.maxArmor || 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Shield size={11} className="text-cyan-500 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">Armor</span>
                  <CheckboxTrack
                    total={el.maxArmor}
                    filled={el.currentArmor || 0}
                    pendingFilled={(pendingResourceCosts[el.instanceId]?.armorMark ?? 0) + manualAck.armorMarkAdd}
                    pendingClearFilled={manualAck.armorClear}
                    onSetFilled={queueManualTrackEdit
                      ? (v) => {
                          const upd = { currentArmor: v };
                          if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                          queueManualTrackEdit(el, upd);
                        }
                      : (v) => {
                          const upd = { currentArmor: v };
                          if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                          updateFn(el.instanceId, upd);
                        }}
                    fillColor="bg-cyan-500"
                    label="Armor"
                    verbs={['Mark', 'Clear']}
                  />
                    <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentArmor || 0}/{el.maxArmor}</span>
                </div>
              )}
              {(el.maxHp || 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Heart size={11} className="text-red-500 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">HP</span>
                  <CheckboxTrack
                    total={el.maxHp}
                    filled={(el.maxHp || 0) - (el.currentHp ?? el.maxHp ?? 0)}
                    pendingFilled={manualAck.hpDamageAdd}
                    pendingClearFilled={manualAck.hpHealSlots + lifeSupportHealSlots}
                    onSetFilled={queueManualTrackEdit
                      ? (dmg) => queueManualTrackEdit(el, { currentHp: (el.maxHp || 0) - dmg })
                      : (dmg) => updateFn(el.instanceId, { currentHp: (el.maxHp || 0) - dmg })}
                    fillColor="bg-red-500"
                    label="HP"
                    verbs={['Mark', 'Clear']}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentHp ?? el.maxHp}/{el.maxHp}</span>
                </div>
              )}
              {(el.maxStress || 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={11} className="text-orange-500 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">Stress</span>
                  <CheckboxTrack
                    total={el.maxStress}
                    filled={el.currentStress || 0}
                    pendingFilled={(pendingResourceCosts[el.instanceId]?.stress ?? 0) + manualAck.stressAdd}
                    pendingClearFilled={manualAck.stressClear}
                    onSetFilled={queueManualTrackEdit
                      ? (s) => queueManualTrackEdit(el, { currentStress: s })
                      : (s) => {
                          const prev = el.currentStress ?? 0;
                          if (s > prev) consumePendingStressForManualMark?.(el.instanceId, s - prev);
                          updateFn(el.instanceId, { currentStress: s });
                        }}
                    fillColor="bg-orange-500"
                    label="Stress"
                    verbs={['Mark', 'Clear']}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentStress || 0}/{el.maxStress}</span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Weapons (or Beastform Attack when transformed) ── */}
        <CharacterWeaponList
          el={displayEl}
          onWeaponClick={handleWeaponClick}
          devastatingActive={devastatingActive}
          onDevastatingToggle={() => setDevastatingActive(d => !d)}
          stressMaxed={stressMaxed}
          onActionNotification={onActionNotification}
          onBeastformAttack={handleBeastformAttack}
          getValidTargets={getValidTargets}
        />

        {/* ── Inventory ── */}
        <CharacterInventory el={el} />

        <CharacterFeaturesPanel
          el={displayEl}
          expandedKeys={expandedKeys}
          onToggleFeature={onToggleFeature}
          onSetFeatureExpandedKeys={onSetFeatureExpandedKeys}
          onUseHopeAbility={onUseHopeAbility}
          onFeatureUse={handleFeatureUse}
          featureUsage={el.featureUsage}
          currentHope={currentHope}
          updateFn={updateFn}
          activeChanneledElement={el.featureState?.WardenOfTheElements?.channeledElement ?? null}
          prayerDice={(el.activeModifiers || []).filter(m => m.name === 'Prayer Die')}
          onPrayerDieGainHope={onActionNotification ? (mod) => onActionNotification({
            _action: true,
            rollUser: el.name,
            actionName: 'Prayer Die',
            actionText: `Use Prayer Die to gain ${mod.value} Hope`,
            _prayerDieGainHope: { modId: mod.id, value: mod.value, instanceId: el.instanceId },
            _attackerInstanceId: el.instanceId,
          }) : undefined}
          onShareFeature={onActionNotification ? (feature) => onActionNotification({
            _action: true,
            rollUser: el.name,
            actionName: feature.name,
            actionText: feature.description ?? '',
          }) : undefined}
          onV2CardChip={v2TableScoped ? handleV2DomainChip : undefined}
          v2TableContext={
            v2TableScoped
              ? {
                  fearCount,
                  mapConfig,
                  tableFeatureState,
                  activeElements,
                  registry: v2Registry ?? undefined,
                }
              : undefined
          }
          pendingBanners={pendingBanners}
        />

        {/* ── Domain Cards ── */}
        <CharacterAbilityList
          el={displayEl}
          expandedKeys={expandedKeys}
          onToggleFeature={onToggleFeature}
          onFeatureUse={handleFeatureUse}
          featureUsage={el.featureUsage}
          onV2DomainChip={v2TableScoped ? handleV2DomainChip : undefined}
          v2TableContext={
            v2TableScoped
              ? {
                  fearCount,
                  mapConfig,
                  tableFeatureState,
                  activeElements,
                  registry: v2Registry ?? undefined,
                }
              : undefined
          }
        />

        {/* ── Companion (hidden when shown as second card in overlay) ── */}
        {!hideCompanionSection && <CharacterCompanion el={trackEl} />}

        {/* ── Description ── */}
        {el.description && (
          <Section label="Description">
            <p className="text-[11px] text-slate-400 leading-relaxed italic">{el.description}</p>
          </Section>
        )}

      </div>
    </div>

    {showDebug && (el._daggerstackDebug || el._daggerstackLookupTables) && (
      <div
        className="absolute top-0 flex gap-2 pl-2"
        style={{ left: '22rem' }}
        onMouseEnter={onDebugMouseEnter}
        onMouseLeave={onDebugMouseLeave}
      >
        {[
          ['Supabase Row', el._daggerstackDebug?.supabaseRow],
          ['Resolved Lookups', el._daggerstackDebug?.resolved],
          ['Lookup Tables', el._daggerstackLookupTables],
        ].filter(([, data]) => data).map(([label, data]) => (
          <div key={label} className="w-80 h-[80vh] bg-slate-900 border border-amber-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-amber-950/30 border-b border-amber-900/30 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">{label}</p>
            </div>
            <div className="flex-1 overflow-auto min-h-0 p-2 text-[9px] font-mono">
              <JsonTree data={data} defaultOpen={true} />
            </div>
          </div>
        ))}
      </div>
    )}

    {/* ── Feature input overlay (e.g. Sorcerer Channel Raw Power card level) ── */}
    {featureInputPending && (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 rounded-xl">
        <div className="bg-slate-900 border border-amber-600/60 rounded-lg p-4 shadow-2xl w-56 text-center">
          <div className="text-[11px] font-bold text-amber-300 mb-1">{featureInputPending.feature.name}</div>
          {featureInputPending.subFeature && (
            <div className="text-[10px] text-slate-400 mb-2">{featureInputPending.subFeature.name}</div>
          )}
          <label className="text-[10px] text-slate-400 block mb-1">{featureInputPending.spec.label}</label>
          <input
            type="number"
            min={featureInputPending.spec.min ?? 1}
            max={featureInputPending.spec.max ?? 10}
            value={featureInputValue}
            onChange={e => setFeatureInputValue(e.target.value)}
            className="w-full text-center bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white mb-3 focus:outline-none focus:border-amber-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setFeatureInputPending(null)}
              className="flex-1 px-2 py-1 rounded text-[11px] border border-slate-600 text-slate-400 hover:bg-slate-800 transition-colors"
            >Cancel</button>
            <button
              onClick={() => handleFeatureUse(featureInputPending.feature, featureInputPending.subFeature)}
              className="flex-1 px-2 py-1 rounded text-[11px] font-semibold border border-amber-600 bg-amber-900/50 text-amber-200 hover:bg-amber-800 transition-colors"
            >Use</button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
