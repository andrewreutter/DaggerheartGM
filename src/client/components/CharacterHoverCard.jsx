import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, ExternalLink, RefreshCw, Bug, Pencil,
} from 'lucide-react';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { CheckboxTrack } from './DetailCardContent.jsx';
import {
  CharacterStatBlockGraphic,
  HopeHeroTrack,
} from './CharacterStatBlockGraphic.jsx';
import {
  Section,
  CharacterIdentityHeader,
  CharacterTraitGrid,
  CharacterExperiences,
  CharacterWeaponList,
  CharacterFeaturesPanel,
  CharacterFeatureActionsEmphasisCard,
  CharacterSheetDeclarativeCards,
  CharacterAbilityList,
  CharacterInventory,
  DefenseReactionRollGrid,
  TRAIT_FULL,
  formatGold,
  parseBeastformBonus,
} from './CharacterDisplay.jsx';
import {
  CharacterSheetSourceHighlightProvider,
  CharacterSheetHighlightSurface,
} from './CharacterSheetSourceHighlight.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { buildActionForFeatureUse } from '../lib/feature-actions.js';
import {
  wrapEntity,
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
import { buildWeaponRollText } from '../lib/weapon-roll-text.js';
import { WARDEN_OF_THE_ELEMENTS_SCOPE_KEY } from '../../features-v2/engine/feature-scope-keys.js';

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

// ─── Collapsible JSON tree (for debug panel) ──────────────────────────────────

function JsonTree({ data, label, depth = 0, defaultOpen }) {
  const isOpen = defaultOpen ?? depth < 1;
  const [open, setOpen] = useState(isOpen);

  if (data === null || data === undefined) {
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className="text-dh-muted italic">null</span>
      </span>
    );
  }

  if (typeof data !== 'object') {
    const color = typeof data === 'string' ? 'text-emerald-400'
      : typeof data === 'number' ? 'text-amber-300'
      : typeof data === 'boolean' ? 'text-sky-400'
      : 'text-dh';
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
        <span className="text-dh-muted">{brackets[0]}{brackets[1]}</span>
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-0.5 hover:bg-dh-raised/60 rounded px-0.5 -ml-0.5 transition-colors text-left"
      >
        {open
          ? <ChevronDown size={9} className="text-dh-muted shrink-0" />
          : <ChevronRight size={9} className="text-dh-muted shrink-0" />}
        {label != null && <span className="text-violet-300">{label}: </span>}
        {!open && (
          <span className="text-dh-muted">
            {brackets[0]}<span className="text-dh-muted mx-0.5">{entries.length} item{entries.length !== 1 ? 's' : ''}</span>{brackets[1]}
          </span>
        )}
        {open && <span className="text-dh-muted">{brackets[0]}</span>}
      </button>
      {open && (
        <div className="pl-3 border-l border-dh-border ml-1">
          {entries.map(([key, val]) => (
            <div key={key} className="leading-relaxed">
              <JsonTree data={val} label={isArray ? String(key) : key} depth={depth + 1} />
            </div>
          ))}
          <span className="text-dh-muted">{brackets[1]}</span>
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
 *   hideEditButton  — when true, the Edit control is hidden (e.g. character editor already open)
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
  /** When true, omit the header Edit control (e.g. right-drawer editor is open for this character). */
  hideEditButton = false,
  onActionNotification,
  activeElements,
  mapConfig,
  pendingResourceCosts = {},
  /** When set, manual stress increases reduce dashed "pending ack" stress (Game Table). */
  consumePendingStressForManualMark,
  isPlayer = false,
  getValidTargets,
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
  /** `panelEmbedded` — outer frame provides border/shadow (Game Table unified sheet + editor). */
  surfaceVariant = 'default',
  /** When true, identity header is omitted (Game Table shared title bar above sheet + editor). */
  omitHeader = false,
}) {
  /** Manual Hope/Stress/Armor/HP tracks — GM only on Game Table (players keep `updateFn` for rolls, features, etc.). */
  const gmResourceTrackCheckboxEdits = !isPlayer;

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

  /** Wires DEFENSE stat-block CheckboxTracks — mirrors the Resources section (manual edits apply immediately; reinforced clear, etc.). */
  const defenseTrackInteraction = useMemo(() => {
    if (!updateFn || !gmResourceTrackCheckboxEdits) return null;
    const id = el.instanceId;
    const pr = pendingResourceCosts[id] ?? {};
    const out = { stress: undefined, armor: undefined, hp: undefined };
    if ((el.maxStress || 0) > 0) {
      out.stress = {
        onSetFilled: queueManualTrackEdit
          ? (s) => queueManualTrackEdit(el, { currentStress: s })
          : (s) => {
              const prev = el.currentStress ?? 0;
              if (s > prev) consumePendingStressForManualMark?.(id, s - prev);
              updateFn(id, { currentStress: s });
            },
        pendingFilled: (pr.stress ?? 0) + manualAck.stressAdd,
        pendingClearFilled: manualAck.stressClear,
        label: 'Stress',
        verbs: ['Mark', 'Clear'],
      };
    }
    if ((el.maxArmor || 0) > 0) {
      out.armor = {
        onSetFilled: queueManualTrackEdit
          ? (v) => {
              const upd = { currentArmor: v };
              if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
              queueManualTrackEdit(el, upd);
            }
          : (v) => {
              const upd = { currentArmor: v };
              if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
              updateFn(id, upd);
            },
        pendingFilled: (pr.armorMark ?? 0) + manualAck.armorMarkAdd,
        pendingClearFilled: manualAck.armorClear,
        label: 'Armor',
        verbs: ['Mark', 'Clear'],
      };
    }
    if ((el.maxHp || 0) > 0) {
      out.hp = {
        onSetFilled: queueManualTrackEdit
          ? (dmg) => queueManualTrackEdit(el, { currentHp: (el.maxHp || 0) - dmg })
          : (dmg) => updateFn(id, { currentHp: (el.maxHp || 0) - dmg }),
        pendingFilled: manualAck.hpDamageAdd,
        pendingClearFilled: manualAck.hpHealSlots + lifeSupportHealSlots,
        label: 'HP',
        verbs: ['Mark', 'Clear'],
      };
    }
    return out;
  }, [
    updateFn,
    el,
    pendingResourceCosts,
    manualAck,
    lifeSupportHealSlots,
    queueManualTrackEdit,
    consumePendingStressForManualMark,
    gmResourceTrackCheckboxEdits,
  ]);

  /** Header Hope row — same pending/ack semantics as Resources Hope {@link CheckboxTrack}. */
  const hopeTrackInteraction = useMemo(() => {
    if (!updateFn || !gmResourceTrackCheckboxEdits) return null;
    const id = el.instanceId;
    const maxHope = el.maxHope ?? 6;
    if (maxHope <= 0) return null;
    const hopePending = pendingResourceCosts[id]?.hope ?? 0;
    const remainingServer = el.hope ?? maxHope;
    return {
      filled: Math.max(0, remainingServer - hopePending),
      onSetFilled: queueManualTrackEdit
        ? (h) => queueManualTrackEdit(el, { hope: h })
        : (h) => updateFn(id, { hope: h }),
      pendingFilled: hopePending + manualAck.hopeGain,
      pendingClearFilled: manualAck.hopeSpend,
      trackKind: 'hope',
      label: 'Hope',
      verbs: ['Gain', 'Spend'],
      pulseOnDecreaseOnly: true,
    };
  }, [updateFn, el, pendingResourceCosts, manualAck, queueManualTrackEdit, gmResourceTrackCheckboxEdits]);

  const openTargetMenu = (value) => {
    setTargetMenuPending(value);
  };
  const closeTargetMenu = () => {
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
    async ({ featRow, chip, featureKey: passedFeatureKey, selectOpts, placementShape }) => {
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
        onRoll,
        placementShape,
        isPlayer: !!isPlayer,
      });
    },
    [
      v2Registry,
      el,
      el.instanceId,
      displayEl,
      isPlayer,
      tableId,
      activeElementsForV2Snapshots,
      tableFeatureState,
      fearCount,
      mapConfig,
      onActionNotification,
      onRoll,
    ]
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
      ...(feature.hostRollMetaFeatureStateActivate === true && feature._sourceScopeKey
        ? {
            _roguesDodgeFeatureStateActivate: true,
            _roguesDodgeFeatureStateScopeKey: feature._sourceScopeKey,
          }
        : {}),
    };
    if (hasDice && looksLikeActionRoll) {
      rollMeta._intentPanelForActionRoll = true;
      rollMeta._deferExperienceToPreRoll = true;
      if (action.spellcastDC != null || action.spellcastVsRoll) {
        rollMeta._traitKey = (el.spellcastTrait || 'presence').toLowerCase();
        rollMeta._isSpellcastRoll = true;
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
      _isSpellcastRoll: true,
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
      {onEdit && !hideEditButton && (
        <button
          type="button"
          onClick={onEdit}
          title="Edit character"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-dh-muted hover:text-sky-400 border border-dh-strong/35 hover:border-sky-500/45 transition-colors"
        >
          <Pencil size={11} className="shrink-0" aria-hidden />
          Edit
        </button>
      )}
      {(el._daggerstackDebug || el._daggerstackLookupTables) && (
        <button
          onClick={() => setShowDebug(d => !d)}
          title="Debug: view raw Daggerstack payloads"
          className={`p-1 rounded transition-colors ${showDebug ? 'text-amber-400' : 'text-dh-muted hover:text-amber-400'}`}
        >
          <Bug size={11} />
        </button>
      )}
      {hasDaggerstack && onResync && (
        <button
          onClick={onResync}
          disabled={isSyncing}
          title="Re-sync from Daggerstack"
          className="p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-40 transition-colors"
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
          className="p-1 rounded text-dh-muted hover:text-sky-400 transition-colors"
        >
          <ExternalLink size={11} />
        </a>
      )}
    </>
  );

  const stressMaxed = (trackEl.currentStress ?? 0) >= (el.maxStress ?? 6);
  const currentHope = trackEl.hope ?? (el.maxHope ?? 6);

  return (
    <CharacterSheetSourceHighlightProvider disabled={omitHeader}>
    <CharacterSheetHighlightSurface className="relative flex flex-col flex-1 min-h-0">

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
            className="fixed z-[201] rounded-lg border border-amber-600/70 bg-dh-surface shadow-2xl p-2 space-y-2"
            style={{ top, left, minWidth: '140px', maxWidth: '220px' }}
          >
            <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide">
              {targetMenuPending.validTargets.length > 0 ? 'Choose target' : 'No targets in range'}
            </div>
            <div className="space-y-1">
              {targetMenuPending.validTargets.length === 0 ? (
                <p className="text-[11px] text-dh-muted italic px-1 py-1">No valid targets are in range of this attack.</p>
              ) : targetMenuPending.validTargets.map((t) => {
                const sum = formatTargetSummary(t, { hideMax: isPlayer });
                return (
                  <button
                    key={t.instanceId}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleTargetMenuSelect(t); }}
                    className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-amber-600/60 bg-dh-raised/80 text-dh hover:bg-amber-800/60 hover:border-amber-500 transition-colors"
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{t.name}</span>
                      {t.vulnerable && (
                        <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-amber-900/60 border border-amber-600/70 text-amber-200" title="Attacker gains advantage die: Vulnerable Target">Vulnerable</span>
                      )}
                    </div>
                    <div className="text-[10px] text-dh-muted mt-0.5">
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
              className="text-[11px] text-dh-muted hover:text-dh transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      );
    })()}

    <div
      className={
        surfaceVariant === 'panelEmbedded'
          ? 'w-full max-w-full min-w-0 h-full min-h-0 bg-transparent border-0 rounded-none shadow-none overflow-hidden flex flex-col flex-1'
          : 'w-full max-w-full min-w-0 h-full min-h-0 bg-dh-surface border border-dh-border rounded-xl shadow-2xl overflow-hidden flex flex-col flex-1'
      }
    >

      {/* ── Header + Hope (outside sheet scroll) — header omitted when Game Table provides a shared title bar ── */}
      {omitHeader ? (
        (el._daggerstackDebug || el._daggerstackLookupTables || (hasDaggerstack && onResync) || hasDaggerstack) && (
          <div className="flex justify-end items-center gap-1 px-3 py-1.5 border-b dh-tint-spellcast-strip shrink-0">
            {(el._daggerstackDebug || el._daggerstackLookupTables) && (
              <button
                onClick={() => setShowDebug(d => !d)}
                title="Debug: view raw Daggerstack payloads"
                className={`p-1 rounded transition-colors ${showDebug ? 'text-amber-400' : 'text-dh-muted hover:text-amber-400'}`}
              >
                <Bug size={11} />
              </button>
            )}
            {hasDaggerstack && onResync && (
              <button
                onClick={onResync}
                disabled={isSyncing}
                title="Re-sync from Daggerstack"
                className="p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-40 transition-colors"
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
                className="p-1 rounded text-dh-muted hover:text-sky-400 transition-colors"
              >
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )
      ) : (
        <div className="shrink-0">
          <CharacterIdentityHeader el={el} actions={headerActions} />
        </div>
      )}
      {el.description && (
        <div className="px-2 pt-2 pb-2 shrink-0 bg-dh-canvas/20 w-full">
          <p className="text-[11px] text-dh-muted leading-relaxed italic">{el.description}</p>
        </div>
      )}
      {(el.maxHope ?? 0) > 0 && (
        <div className="px-2 py-2 shrink-0 bg-dh-canvas/20">
          <HopeHeroTrack el={displayEl} hopeTrackInteraction={hopeTrackInteraction} />
        </div>
      )}

      <div className="p-3 overflow-y-auto flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-3 items-start">
          <div className="space-y-3 min-w-0">
            <div className="space-y-2 min-w-0">
              <CharacterStatBlockGraphic
                el={displayEl}
                variant="stack"
                compact
                srdData={srdData}
                hideHope
                defenseTrackInteraction={defenseTrackInteraction}
                defenseFooter={
                  <DefenseReactionRollGrid el={displayEl} compact onTraitClick={handleTraitClick} />
                }
              />
            </div>

            <CharacterTraitGrid
              el={displayEl}
              onTraitClick={handleTraitClick}
              onSpellcastRoll={handleSpellcastRoll}
              omitOuterSection
              sheetEmphasisTitle="Traits"
              sheetEmphasisSubtitle="Action Rolls"
            />

            <CharacterExperiences
              el={displayEl}
              omitOuterSection
              sheetEmphasisTitle="Experiences"
              experiencesAsBadges
              hope={currentHope}
              maxHope={el.maxHope ?? 6}
            />

            <CharacterFeaturesPanel
              el={displayEl}
              omitActions
              omitDeclarativeCards
              expandedKeys={expandedKeys}
              onToggleFeature={onToggleFeature}
              onSetFeatureExpandedKeys={onSetFeatureExpandedKeys}
              onUseHopeAbility={onUseHopeAbility}
              onFeatureUse={handleFeatureUse}
              featureUsage={el.featureUsage}
              currentHope={currentHope}
              updateFn={updateFn}
              activeChanneledElement={el.featureState?.[WARDEN_OF_THE_ELEMENTS_SCOPE_KEY]?.channeledElement ?? null}
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
              queueManualTrackEdit={queueManualTrackEdit}
              onRoll={onRoll}
            />
          </div>

          <div className="space-y-3 min-w-0">
            <CharacterWeaponList
              el={displayEl}
              onWeaponClick={handleWeaponClick}
              devastatingActive={devastatingActive}
              onDevastatingToggle={() => setDevastatingActive(d => !d)}
              stressMaxed={stressMaxed}
              onActionNotification={onActionNotification}
              onBeastformAttack={handleBeastformAttack}
              getValidTargets={getValidTargets}
              omitOuterSection
              sheetEmphasisTitle="Offense"
            />
            <CharacterFeatureActionsEmphasisCard
              el={displayEl}
              onV2CardChip={v2TableScoped ? handleV2DomainChip : undefined}
              onShareFeature={onActionNotification ? (feature) => onActionNotification({
                _action: true,
                rollUser: el.name,
                actionName: feature.name,
                actionText: feature.description ?? '',
              }) : undefined}
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
              activeChanneledElement={el.featureState?.[WARDEN_OF_THE_ELEMENTS_SCOPE_KEY]?.channeledElement ?? null}
              pendingBanners={pendingBanners}
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
                if (mod.mode === 'clearStress') {
                  const stress = Math.max(0, (el.currentStress ?? 0) - 1);
                  updateFn(el.instanceId, { currentStress: stress });
                  const kept = (el.activeModifiers || []).filter(m => m.id !== mod.id);
                  updateFn(el.instanceId, { activeModifiers: kept });
                  return;
                }
              } : undefined}
              onUseMode={updateFn ? (mod, mode) => {
                if (mod.name === 'Prayer Die' && mode === 'gainHope') {
                  onActionNotification?.({
                    _action: true,
                    rollUser: el.name,
                    actionName: 'Prayer Die',
                    actionText: `Use Prayer Die to gain ${mod.value} Hope`,
                    _prayerDieGainHope: { modId: mod.id, value: mod.value, instanceId: el.instanceId },
                    _attackerInstanceId: el.instanceId,
                  });
                  return;
                }
                const selfEl = wrapEntity(el, updateFn);
                for (const f of el.classFeatures || []) {
                  const descriptor = resolveClassFeatureDescriptor(displayEl, f.name);
                  if (descriptor?.onModifierUsed) {
                    descriptor.onModifierUsed({ modifier: mod, mode, selfEl, updateActiveElement: updateFn });
                  }
                }
                const kept = (el.activeModifiers || []).filter(m => m.id !== mod.id);
                updateFn(el.instanceId, { activeModifiers: kept });
              } : undefined}
            />
            <CharacterSheetDeclarativeCards
              el={displayEl}
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
              queueManualTrackEdit={queueManualTrackEdit}
              updateFn={updateFn}
              onRoll={onRoll}
              onV2CardChip={v2TableScoped ? handleV2DomainChip : undefined}
              interactionMode={
                (v2TableScoped ? handleV2DomainChip : undefined) || onActionNotification
                  ? 'interactive'
                  : 'preview'
              }
              gmResourceTrackCheckboxEdits={gmResourceTrackCheckboxEdits}
            />
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
            {showResources && (
              <Section label="Resources">
                <div className="space-y-1.5">
                  {(() => {
                    const maxHope = el.maxHope ?? 6;
                    const hopePending = pendingResourceCosts[el.instanceId]?.hope ?? 0;
                    const remainingServer = el.hope ?? maxHope;
                    return maxHope > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-dh-muted w-10 shrink-0">Hope</span>
                        <CheckboxTrack
                          total={maxHope}
                          filled={Math.max(0, remainingServer - hopePending)}
                          pendingFilled={hopePending + manualAck.hopeGain}
                          pendingClearFilled={manualAck.hopeSpend}
                          onSetFilled={gmResourceTrackCheckboxEdits
                            ? (queueManualTrackEdit
                              ? (h) => queueManualTrackEdit(el, { hope: h })
                              : (h) => updateFn(el.instanceId, { hope: h }))
                            : undefined}
                          trackKind="hope"
                          label="Hope"
                          verbs={['Gain', 'Spend']}
                          pulseOnDecreaseOnly
                          fillRow
                          className="flex-1 min-w-0 gap-1"
                          itemClassName="min-h-5 max-h-6 rounded"
                        />
                        <span className="text-[10px] text-dh-muted tabular-nums ml-auto">{maxHope}</span>
                      </div>
                    );
                  })()}
                  {(el.maxArmor || 0) > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-dh-muted w-10 shrink-0">Armor</span>
                      <CheckboxTrack
                        total={el.maxArmor}
                        filled={el.currentArmor || 0}
                        pendingFilled={(pendingResourceCosts[el.instanceId]?.armorMark ?? 0) + manualAck.armorMarkAdd}
                        pendingClearFilled={manualAck.armorClear}
                        onSetFilled={gmResourceTrackCheckboxEdits
                          ? (queueManualTrackEdit
                            ? (v) => {
                                const upd = { currentArmor: v };
                                if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                                queueManualTrackEdit(el, upd);
                              }
                            : (v) => {
                                const upd = { currentArmor: v };
                                if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                                updateFn(el.instanceId, upd);
                              })
                          : undefined}
                        trackKind="armor"
                        label="Armor"
                        verbs={['Mark', 'Clear']}
                      />
                      <span className="text-[10px] text-dh-muted tabular-nums ml-auto">{el.maxArmor}</span>
                    </div>
                  )}
                  {(el.maxHp || 0) > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-dh-muted w-10 shrink-0">HP</span>
                      <CheckboxTrack
                        total={el.maxHp}
                        filled={(el.maxHp || 0) - (el.currentHp ?? el.maxHp ?? 0)}
                        pendingFilled={manualAck.hpDamageAdd}
                        pendingClearFilled={manualAck.hpHealSlots + lifeSupportHealSlots}
                        onSetFilled={gmResourceTrackCheckboxEdits
                          ? (queueManualTrackEdit
                            ? (dmg) => queueManualTrackEdit(el, { currentHp: (el.maxHp || 0) - dmg })
                            : (dmg) => updateFn(el.instanceId, { currentHp: (el.maxHp || 0) - dmg }))
                          : undefined}
                        trackKind="hp"
                        label="HP"
                        verbs={['Mark', 'Clear']}
                      />
                      <span className="text-[10px] text-dh-muted tabular-nums ml-auto">{el.maxHp}</span>
                    </div>
                  )}
                  {(el.maxStress || 0) > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-dh-muted w-10 shrink-0">Stress</span>
                      <CheckboxTrack
                        total={el.maxStress}
                        filled={el.currentStress || 0}
                        pendingFilled={(pendingResourceCosts[el.instanceId]?.stress ?? 0) + manualAck.stressAdd}
                        pendingClearFilled={manualAck.stressClear}
                        onSetFilled={gmResourceTrackCheckboxEdits
                          ? (queueManualTrackEdit
                            ? (s) => queueManualTrackEdit(el, { currentStress: s })
                            : (s) => {
                                const prev = el.currentStress ?? 0;
                                if (s > prev) consumePendingStressForManualMark?.(el.instanceId, s - prev);
                                updateFn(el.instanceId, { currentStress: s });
                              })
                          : undefined}
                        trackKind="stress"
                        label="Stress"
                        verbs={['Mark', 'Clear']}
                      />
                      <span className="text-[10px] text-dh-muted tabular-nums ml-auto">{el.maxStress}</span>
                    </div>
                  )}
                </div>
              </Section>
            )}

            <CharacterInventory el={el} />
          </div>
        </div>
      </div>
    </div>

    {showDebug && (el._daggerstackDebug || el._daggerstackLookupTables) && (
      <div
        className="absolute top-0 flex gap-2 pl-2"
        style={{ left: 'min(96vw, 44rem)' }}
      >
        {[
          ['Supabase Row', el._daggerstackDebug?.supabaseRow],
          ['Resolved Lookups', el._daggerstackDebug?.resolved],
          ['Lookup Tables', el._daggerstackLookupTables],
        ].filter(([, data]) => data).map(([label, data]) => (
          <div key={label} className="w-80 h-[80vh] bg-dh-surface border border-amber-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
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
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-dh-canvas/80 rounded-xl">
        <div className="bg-dh-surface border border-amber-600/60 rounded-lg p-4 shadow-2xl w-56 text-center">
          <div className="text-[11px] font-bold text-amber-300 mb-1">{featureInputPending.feature.name}</div>
          {featureInputPending.subFeature && (
            <div className="text-[10px] text-dh-muted mb-2">{featureInputPending.subFeature.name}</div>
          )}
          <label className="text-[10px] text-dh-muted block mb-1">{featureInputPending.spec.label}</label>
          <input
            type="number"
            min={featureInputPending.spec.min ?? 1}
            max={featureInputPending.spec.max ?? 10}
            value={featureInputValue}
            onChange={e => setFeatureInputValue(e.target.value)}
            className="w-full text-center bg-dh-raised border border-dh-strong rounded px-2 py-1 text-sm text-dh mb-3 focus:outline-none focus:border-amber-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setFeatureInputPending(null)}
              className="flex-1 px-2 py-1 rounded text-[11px] border border-dh-strong text-dh-muted hover:bg-dh-raised transition-colors"
            >Cancel</button>
            <button
              onClick={() => handleFeatureUse(featureInputPending.feature, featureInputPending.subFeature)}
              className="flex-1 px-2 py-1 rounded text-[11px] font-semibold border border-amber-600 bg-amber-900/50 text-amber-200 hover:bg-amber-800 transition-colors"
            >Use</button>
          </div>
        </div>
      </div>
    )}

    </CharacterSheetHighlightSurface>
    </CharacterSheetSourceHighlightProvider>
  );
}
