import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTouchDevice } from '../lib/useTouchDevice.js';
import { useHoverOverlay } from '../lib/useHoverOverlay.js';
import { Zap, Trash2, Dices, ChevronDown, ChevronRight, X, Plus, Camera, Swords, AlertTriangle, Tag, Flame, Edit, Users, RefreshCw, ExternalLink, Eye, EyeOff, Circle, Square, CheckSquare, StickyNote, ArrowLeftToLine } from 'lucide-react';
import { BattleMap, CHARACTER_TRAY_WIDTH_PX } from './BattleMap.jsx';
import { EncounterAdversaryInstancePlayerSummary } from './EncounterAdversaryMarkedSummary.jsx';
import { playerEncounterInstanceRowVisible } from '../lib/encounter-adversary-player-summary.js';
import { PlayerAdversaryTargetAid } from './PlayerAdversaryTargetAid.jsx';
import { GameTableCharacterListCard } from './GameTableCharacterListCard.jsx';
import { AnchoredFloatingPanel } from './AnchoredFloatingPanel.jsx';
import { ActionLog } from './ActionLog.jsx';
import { parseFeatureCategory, parseAllCountdownValues, generateId, effectiveThresholds, effectiveEvasion, computeHpLoss, isAdversaryDefeated, getDifficultyLabel, parseBeastformBonus, isWingsOfLightFlying, extractGmFeatureWhenClause } from '../lib/helpers.js';
import { findSessionCountdownBySource } from '../lib/session-countdowns.js';
import { SessionCountdownsPanel, buildTrackedSessionEntryFromFeature, buildLinkedPairFromFeatureCountdowns } from './SessionCountdownsPanel.jsx';
import { FeatureDescription } from './FeatureDescription.jsx';
import { EnvironmentCardContent, AdversaryCardContent, CheckboxTrack } from './DetailCardContent.jsx';
import { CharacterSheetEmphasisCard } from './CharacterStatBlockGraphic.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { ItemPickerModal } from './modals/ItemPickerModal.jsx';
import { EncounterNoteEditorModal } from './modals/EncounterNoteEditorModal.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { handleAiConceptTextareaKeyDown } from '../lib/ai-concept-textarea.js';
import { indexResolvedItemsByRequestId } from '../lib/resolve-items-index.js';
import { buildSystemContext } from '../lib/feature-context.js';
import { withActionBannerSuppression } from '../lib/action-notification-banner.js';
import {
  postRoll as postRollToServer,
  postTableOp,
  postActionNotification,
  postBannerAck,
  postBannerCancel,
  postRerollHopeDie,
  postBannerGenericRerollRequest,
  postRerollDualityDice,
  postBannerRangerFocusRerollRequest,
  postBannerHoldThemOff,
  postBannerTargets,
  postBannerWingsD8,
  postBannerWingsD8Toggle,
  postBannerMakeASceneTarget,
  postBannerChipResolve,
  postBannerAddDamage,
  postBannerActionAddDie,
  postBannerActionAddStatic,
  postBannerRerollDie,
  postCharacterUpdate,
  postHopeDieUpgrade,
  postPlayerIntent,
  postPlayerV2ReviewChip,
  clearPlayerIntent,
  syncDaggerstackCharacter,
  resolveItems,
  requestGoogleContactsAccess,
  searchGoogleContacts,
  conceptAiEnabled,
  imageGenEnabled,
  postEncounterAiBuild,
  postAdversaryAiBuild,
  postEnvironmentAiBuild,
} from '../lib/api.js';
import { generateAndApplyBattleMapQuietly } from '../lib/quiet-battle-map-generate.js';
import { useAiUiPreference } from '../lib/ai-ui-preference-context.jsx';
import { shouldShowConceptAiUi } from '../lib/ai-ui-visibility.js';
import { AiDismissBuildWithAiLink } from './AiDismissBuildWithAiLink.jsx';
import {
  characterSheetTableInteractionFlags,
  gateTableOpForPrepMode,
  gmResourceTrackCheckboxEditsAllowed,
  isPrepModeElementUpdateBlocked,
} from '../lib/table-session-gate.js';
import { isOwnItem, ROLE_BP_COST, DEFAULT_CHARACTER_STARTING_HOPE, ROLES } from '../lib/constants.js';
import {
  characterDrawerEditMismatch as computeCharacterDrawerEditMismatch,
  shouldSuppressCharacterOverlayOutsideDismiss,
} from '../lib/character-drawer-edit-mismatch.js';
import { resolveGameTableCharacterEditMode } from '../lib/game-table-character-modal-url.js';
import { computeBattlePoints, computeAutoModifiers, computeTotalBudgetMod, computeBudget } from '../lib/battle-points.js';
import { getUnscaledAdversary, getBaselineStats } from '../lib/adversary-defaults.js';
import { ensureEditorListIds } from '../lib/ensure-editor-list-ids.js';
import { coerceEnvironmentType, coerceEnvironmentTier } from '../lib/environment-coerce.js';
import { CharacterHoverCard } from './CharacterHoverCard.jsx';
import {
  CHARACTER_TABLE_EDITOR_DRAWER_WIDTH,
  CHARACTER_TABLE_EDITOR_DRAWER_WIDTH_WITH_EDITOR,
  CHARACTER_TABLE_SHEET_COLUMN_WIDTH,
  CHARACTER_TABLE_SHEET_COLUMN_WIDTH_WITH_EDITOR,
  characterTableUnifiedCardWidth,
} from '../lib/character-table-layout.js';
import { GameTableCharacterSheetTitleBar } from './GameTableCharacterSheetTitleBar.jsx';
import {
  CharacterSheetSourceHighlightProvider,
  CharacterSheetHighlightSurface,
} from './CharacterSheetSourceHighlight.jsx';
import { resolveV2LibraryItemSourcePath } from '../../features-v2/resolve-feature-source-path.js';
import { TRAIT_FULL } from './CharacterDisplay.jsx';
import { FeatureResourceCostIcons } from './FeatureResourceCostIcons.jsx';
import { FrequencyCycleChipSuffix, getFrequencyCycleWord } from '../lib/frequency-cycle-ui.jsx';
import { DiceRoller } from './DiceRoller.jsx';
import { ConditionsTextInput } from './ConditionsTextInput.jsx';
import { Tooltip } from './Tooltip.jsx';
import { usePortalHoverTooltip, PortalHoverTooltipLayer } from '../lib/portal-hover-tooltip.jsx';
import {
  wrapEntity,
  wrapRoll,
  runCharacterHook,
  resolveParryWeaponFeature,
  resolveResilientArmorFeature,
  resolveArmorModifyPreThresholdDescriptor,
  resolveWeaponOnBannerAckDescriptor,
  resolveOriginFeatureDescriptor,
  resolveClassFeatureDescriptor,
  resolveVirtualWeaponBehavior,
  resolveWeaponTagDescriptor,
  buildRollBaseBannerNarrationParts,
} from '../lib/game-table-mechanics.js';
import { buildAdvantageTriggerPrerollChips } from '../lib/advantage-trigger-preroll.js';
import { applyRangerFocusV2IntentToPending } from '../lib/ranger-focus-v2-intent.js';
import { extractDetailsValues } from '../lib/dice-utils.js';
import { getCharactersWithinFarRange, getCharactersWithinCloseRangeWithMarkedHp, getAdversariesWithinMeleeRange, getAdversariesWithinRangeFt, getCharactersWithinRangeFt, getCharactersWithinRangeOfAny, rangeBandNameToFt, rangeFtToLabel, RANGE_BANDS_FT, tokenDistanceFt, positionAtDistanceFt } from '../lib/map-range.js';
import { mapConfigHasImage } from '../lib/map-table-state.js';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { recomputeCharacter, isCharacterComplete, getEffectiveWeaponRange } from '../lib/character-calc.js';
import { mergeV2DeclarativeSheetOverlay, buildV2RegistryWithSrdItems } from '../lib/v2-declarative-sheet.js';
import {
  collectMissingCompanionBoardTokenElements,
  hasCompanionBoardToken,
} from '../lib/board-token-utils.js';
import {
  applyDeferredV2ToggleOnAckFromRoll,
  applyV2OwnedCardChipEngineResultToTable,
  runV2OwnedCardChipTableAction,
} from '../lib/v2-owned-card-chip-table.js';
import {
  collectV2ReviewActionChips,
  activateV2ReviewChip,
  resolveV2ReviewChipPicker as resolveV2ReviewChipPickerFromBridge,
  getV2ReviewChipDisableHint,
  annotateV2ReviewChipsBannerConsumed,
  v2BannerChipActivationKey,
  migrateV2BannerConsumedOnUseKeys,
  recordV2BannerConsumedOnUse,
  pruneV2BannerConsumedOnUseKeys,
  runV2DamageAckReviewActionHooks,
  runV2IntentPhaseForTraitRoll,
  runV2RestHooksForTable,
  computeV2DamageBannerAckNotices,
  sumPendingEvasionBonusFromFeatureState,
  buildPendingEvasionBonusAckCleanupUpdates,
  runV2DamageApplyReviewOutcomePhase,
  collectV2WeaponIntentChips,
  buildV2PreRollWeaponAttackRollSkeleton,
  buildV2PreRollTraitRollSkeleton,
  collectV2RestPlacementChipsForCharacter,
  activateV2RestPlacementChip,
  expandTableCharactersAncestryForV2Loader,
} from '../lib/v2-action-loop-bridge.js';
import { buildV2ChipViewer } from '../lib/v2-chip-session-view.js';
import { buildWeaponRollText } from '../lib/weapon-roll-text.js';
import { runV2TokenMoveHooks } from '../lib/v2-cross-sheet-lifecycle.js';
import { applyV2BannerMutations, applyV2LifecycleMutations, partitionV2BannerChipMutations } from '../lib/table-ops.js';
import { mergeV2TableFeatureState } from '../lib/v2-action-loop-bridge.js';
import { buildTableSnapshot, applyMutations } from '../../features-v2/engine/table.js';
import { dispatchSessionEndHooks } from '../../features-v2/engine/action-loop.js';
import { RALLY_FEATURE_STATE_BAG_KEY, RALLY_SESSION_VOLATILE_KEYS } from '../../features-v2/classes/Bard.js';
import { ROGUE_CLASS_FEATURE_STATE_SCOPE } from '../../features-v2/classes/Rogue.js';
import { SHIFTING_DISADVANTAGE_SOURCE_ID } from '../../features-v2/armor_properties/Shifting.js';
import { stripConsumableRestBonusPending } from '../../features-v2/engine/consumable-rest-bonus.js';
import { v2ClassSubclassFeatureDescriptorsByName } from '../lib/v2-class-subclass-feature-descriptors.js';
import { getV2OriginFeatureDescriptor } from '../lib/v2-origin-feature-descriptors.js';
import { v2RollDieExtrasFromActionLoopPayload } from '../lib/v2-action-notification-dice.js';
import {
  applyChargedProficiencyBonusToRollText,
  applyDevastatingDamageRewriteToRollText,
} from '../lib/weapon-roll-text.js';
import {
  clearV2PendingMoveElementsForRoll,
  collectV2PendingMapMoveReEvalUpdates,
  evaluateV2PendingMapMovesForMover,
  ensureV2PendingMapRegistry,
  getV2PendingMoveBlockInfo as getV2PendingMoveBlockInfoFromElements,
  migrateV2PendingMapRollId,
} from '../lib/v2-pending-map-move.js';
import { buildForcedMovementActionNotification } from '../lib/v2-forced-movement-banner.js';
import { getExperienceModifierForCharacter, insertExperienceIntoRollText } from '../lib/experience-roll.js';
import { computeRestBannerRefreshPreview } from '../lib/rest-banner-refresh-preview.js';
import { runBeforeMarkStress, runBeforeMarkHP, runBeforeMarkArmor } from '../lib/origin-lifecycle.js';
import { reducePendingStressAfterManualMark } from '../lib/pending-resource-costs.js';
import {
  buildClearBeastformStateMutations,
  hasDeclarativeBeastformFragileDrop,
  legacyBeastformFeaturesLookFragile,
  shouldDropBeastformFromDamage,
} from '../lib/beastform-vtt-drop.js';
import { getRestMovesForCharacter } from '../lib/rest-moves.js';
import {
  buildManualTrackActionRoll,
  findPendingManualTrackBanner,
  getPendingManualTrackAckDeltas,
  getLifeSupportPendingHealSlots,
} from '../lib/manual-track-action-loop.js';

function stripRallyVolatileSessionKeys(fs) {
  if (!fs?.[RALLY_FEATURE_STATE_BAG_KEY]) return fs;
  const bag = { ...fs[RALLY_FEATURE_STATE_BAG_KEY] };
  for (const k of RALLY_SESSION_VOLATILE_KEYS) delete bag[k];
  const next = { ...fs };
  if (Object.keys(bag).length === 0) delete next[RALLY_FEATURE_STATE_BAG_KEY];
  else next[RALLY_FEATURE_STATE_BAG_KEY] = bag;
  return next;
}

/**
 * Shared hook: after layout, measure a fixed-position overlay and compute a
 * vertical pixel adjustment so it stays within the viewport (8px padding).
 * Returns the adjustment value to add to the overlay's `top` style.
 */
function useViewportClamp(ref, isActive, key) {
  const [adjust, setAdjust] = useState(0);
  const keyRef = useRef(null);

  useLayoutEffect(() => {
    if (!isActive || !ref.current) {
      keyRef.current = null;
      if (adjust !== 0) setAdjust(0);
      return;
    }
    if (keyRef.current !== key) {
      keyRef.current = key;
      if (adjust !== 0) { setAdjust(0); return; }
    } else if (adjust !== 0) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.top < 102) setAdjust(102 - rect.top);
    else if (rect.bottom > vh - 8) setAdjust(vh - 8 - rect.bottom);
  }, [isActive, key, adjust]);

  return adjust;
}

// Strip boundaries (1-indexed in the spec, 0-indexed here):
// Amber (Failure w/ Hope): items 1–6, Violet (Success w/ Fear): items 6–13,
// Navy (Failure w/ Fear): items 12–16. Ranges overlap intentionally.
const HOPE_END = 6;
const FEAR_SUCCESS_START = 5;
const FEAR_SUCCESS_END = 13;
const FEAR_FAILURE_START = 11;
const DEFAULT_GM_MOVES = [
  { name: 'Show how the world reacts.', example: '\u201cThe kick shatters the door. Light spills in from the barracks as a half-dozen sleepy soldiers stumble to their feet, looking worried.\u201d' },
  { name: 'Ask a question and build on the answer.', example: '\u201cHow is it that you notice the assassin lurking in the treetops?\u201d' },
  { name: 'Make an NPC act in accordance with their motive.', example: '\u201cThe Jagged Knife Bandit snips the gold purse off the merchant\u2019s hip and attempts to escape.\u201d' },
  { name: 'Lean on the character\u2019s goals to drive them to action.', example: '\u201cThe relic you\u2019ve been trying to recover for your people floats ominously in the center of the altar, surrounded by cultists preparing to drain its power.\u201d' },
  { name: 'Signal an imminent off-screen threat.', example: '\u201cYou hear the crashing of falling trees and shattered branches as thundering steps approach. What do you do?\u201d' },
  { name: 'Reveal an unwelcome truth or unexpected danger.', example: '\u201cHe reaches into his cloak and produces the Orb of Vengeance as you realize that he was the necromancer the entire time.\u201d' },
  { name: 'Force the group to split up.', example: '\u201cThe elementals are scattering\u2014two heading for the town, three bearing down on the mill. What do you do?\u201d' },
  { name: 'Make a PC mark Stress as a consequence for their actions.', example: '\u201cYou can pull the baron to safety if you mark a Stress. Otherwise you can only get yourself out of the way. What do you do?\u201d' },
  { name: 'Make a move the characters don\u2019t see.', example: '\u201cYou brace for the alarm\u2026 but the door clicks open and everything seems fine\u2026 for now.\u201d' },
  { name: 'Show the collateral damage.', example: '\u201cThe Minotaur Wrecker barrels into the street, shattering a vegetable cart, sending cabbages flying and knocking the merchant into the wall.\u201d' },
  { name: 'Clear a temporary condition or effect.', example: '\u201cThe guard cuts through the vines that are holding her legs in place. She looks around to find her next target and raises her sword.\u201d' },
  { name: 'Shift the environment.', example: '\u201cAs soon as you cross, the ancient rope bridge snaps, leaving you stranded.\u201d' },
  { name: 'Spotlight an adversary.', example: '\u201cAs the Skeleton Dredge shambles forward to strike you, you see the two others on their flank turn their attention toward you as well.\u201d' },
  { name: 'Capture someone or something important.', example: '\u201cThe thief slides past you and jumps into the cart, grabbing the idol from the seat and stuffing it into their pouch.\u201d' },
  { name: 'Use a PC\u2019s backstory against them.', example: '\u201cYour mentor sighs, drawing their blade. \u2018I wish it didn\u2019t come to this, child. But you still don\u2019t understand what sacrifices are required to maintain the peace.\u2019\u201d' },
  { name: 'Take away an opportunity permanently.', example: '\u201cThe door slams shut, cutting you off from the vault as the temple continues to collapse. You\u2019ll need to find another exit if you want to make it out alive.\u201d' },
];


const ROLE_MOVES = {
  bruiser:  'The {name} roars in anger, preparing for its next strike. The next time the {name} attacks, it gains an additional 1d4 to its attack roll.',
  horde:    'The {name} rally together, gaining strength. They clear 1 HP or 1 Stress.',
  leader:   'The {name} encourages one of their allies, giving them advantage on their next attack roll.',
  minion:   'The {name} moves into a better position, surrounding the target.',
  ranged:   'The {name} focuses for their next attack, adding +X to the damage of their next attack if it hits.',
  skulk:    'The {name} retreats to a better position, disengaging from the PCs.',
  standard: 'The {name} braces for the next attack. Their difficulty increases by 1 until the next GM Turn.',
  support:  'The {name} clears a condition on themselves or someone else.',
};

const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;

function parseFearCost(description) {
  const m = (description || '').match(/(?:spend|mark)\s+(\d+|a|an)\s+fear/i);
  if (!m) return 1;
  const v = m[1].toLowerCase();
  return (v === 'a' || v === 'an') ? 1 : (parseInt(v, 10) || 1);
}

function buildAttackRollText(name, modifier, range, damage, trait, sourceName) {
  const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  return `${sourceName} ${name} [d20${modStr}] damage [${damage}] ${(trait || 'phy').toLowerCase()} ${range}`;
}

function CaptureTableModal({ activeElements, saveItem, onClose, navigate }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const adversaries = activeElements.filter(el => el.elementType === 'adversary');
    const environments = activeElements.filter(el => el.elementType === 'environment');

    // Collapse duplicate adversaries into { adversaryId, count }.
    const advMap = new Map();
    adversaries.forEach(el => {
      if (advMap.has(el.id)) {
        advMap.get(el.id).count += 1;
      } else {
        advMap.set(el.id, { adversaryId: el.id, count: 1 });
      }
    });
    const adversaryRefs = [...advMap.values()];
    const environmentRefs = environments.map(el => el.id);

    const item = { id: generateId(), name: name.trim(), adversaries: adversaryRefs, environments: environmentRefs, scenes: [] };
    await saveItem('scenes', item);

    setSaving(false);
    onClose();
    navigate(`/library/scenes/${item.id}`);
  };

  return (
    <div className="fixed inset-0 z-[53] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-dh flex items-center gap-2"><Camera size={18} /> Capture Table as Scene</h2>
          <button type="button" tabIndex={0} onClick={onClose} className="text-dh-muted hover:text-dh"><X size={18} /></button>
        </div>

        <p className="text-sm text-dh-muted mb-5">Save the current table contents as a reusable Scene, including all adversaries and environments.</p>

        <label className="block text-sm font-medium text-dh mb-1">Scene Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder="e.g. Bandit Ambush"
          autoFocus
          className="w-full bg-dh-raised border border-dh-strong rounded-lg px-3 py-2 text-sm text-dh placeholder-dh-muted outline-none focus:border-red-500 mb-5"
        />

        <div className="flex justify-end gap-2">
          <button type="button" tabIndex={0} onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-dh-muted hover:text-dh bg-dh-raised border border-dh-strong hover:border-dh-strong transition-colors">Cancel</button>
          <button
            type="button"
            tabIndex={0}
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save as Scene'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Strip runtime tracking fields to get the base item data for form editing.
function getItemData(element) {
  const { instanceId, elementType, currentHp, currentStress, conditions, ...rest } = element;
  return rest;
}

const COLLECTION_TO_ELEMENT_TYPE = { adversaries: 'adversary', environments: 'environment', characters: 'character', notes: 'note' };

/** Get damage total and type from a roll. Sums all damage sub-items. Returns null if no damage sub. */
function getDamageFromRoll(roll) {
  const damageSubs = (roll.subItems || []).filter(s => /damage/i.test(s.pre || '') && s.input);
  if (!damageSubs.length) return null;
  let total = 0;
  for (const sub of damageSubs) {
    const v = parseInt(sub.result, 10);
    if (!Number.isNaN(v)) total += v;
  }
  const first = damageSubs[0];
  const post = (first.post || '').trim().split(/\s+/);
  const type = (post[0] && /^[a-z]+$/.test(post[0])) ? post[0] : '';
  return { total, type };
}

/** Enrich roll with damageTotal, hpLoss, dmgType, and target name for the selected target (so ancestry chips can use roll.damageTotal / roll.hpLoss / roll.dmgType / roll.target). */
function enrichRollWithDamage(roll, elements) {
  if (!roll._selectedTargetInstanceId) return;
  const targetEl = elements?.find(e => e.instanceId === roll._selectedTargetInstanceId);
  if (!targetEl) return;
  roll._selectedTargetName = targetEl.name ?? null;
  const dmg = getDamageFromRoll(roll);
  if (!dmg) return;
  roll.damageTotal = dmg.total;
  roll.hpLoss = computeHpLoss(dmg.total, effectiveThresholds(targetEl));
  roll.dmgType = dmg.type;
}

function pickTallestGmSection(prLen, actionsLen, fearLen) {
  const max = Math.max(prLen, actionsLen, fearLen);
  if (prLen === max) return 'pr';
  if (actionsLen === max) return 'actions';
  return 'fear';
}

/** Portaled GM Moves preview: full adversary/environment sheet with feature highlight (PCs: compact preview). */
function GmMovesFeatureTooltipPanel({
  item,
  feature,
  hoveredFeature,
  featureCountdowns,
  onAddAdversary,
  scaledToggleState,
  onAdversaryScaledToggle,
  updateActiveElement,
}) {
  if (item.kind === 'environment') {
    return (
      <div className="p-4 max-h-[min(70vh,calc(100vh-48px))] overflow-y-auto">
        {item.element.imageUrl && (
          <div className="float-right ml-2 mb-2 w-14 aspect-square overflow-hidden rounded-lg border border-dh-border">
            <img src={item.element.imageUrl} alt="" className="h-full w-full object-cover opacity-90" />
          </div>
        )}
        <h3 className="text-lg font-bold text-dh mb-2 pr-16">{item.element.name}</h3>
        <EnvironmentCardContent
          element={item.element}
          hoveredFeature={hoveredFeature}
          cardKey={item.element.instanceId}
          featureCountdowns={featureCountdowns}
          updateCountdown={null}
          onAddAdversary={onAddAdversary}
        />
      </div>
    );
  }
  if (item.kind === 'character') {
    return (
      <div className="p-4 max-h-[min(70vh,calc(100vh-48px))] overflow-y-auto">
        <h3 className="text-lg font-bold text-dh mb-2">{item.element.name}</h3>
        <div
          data-feature-key={feature.featureKey}
          className="rounded-lg border border-yellow-500/50 bg-dh-inset/40 p-2"
        >
          <div className="font-semibold text-dh text-sm">{feature.name}</div>
          <FeatureDescription description={feature.description} />
        </div>
      </div>
    );
  }
  const el = item.baseElement;
  const showScaled = scaledToggleState[el.id] ?? true;
  const displayEl = el._scaledFromTier != null && !showScaled ? getUnscaledAdversary(el) : el;
  const scaledMeta = el._scaledFromTier != null ? { fromTier: el._scaledFromTier, showScaled } : null;
  return (
    <div className="p-4 max-h-[min(70vh,calc(100vh-48px))] overflow-y-auto">
      {el.imageUrl && (
        <div className="float-right ml-2 mb-2 w-14 aspect-square overflow-hidden rounded-lg border border-dh-border">
          <img src={el.imageUrl} alt="" className="h-full w-full object-cover opacity-90" />
        </div>
      )}
      <h3 className="text-lg font-bold text-dh mb-2 pr-16">
        {displayEl.name}
        {item.instances.length > 1 && (
          <span className="text-dh-muted font-normal ml-1.5">×{item.instances.length}</span>
        )}
      </h3>
      <AdversaryCardContent
        element={displayEl}
        hoveredFeature={hoveredFeature}
        cardKey={el.id}
        count={item.instances.length}
        instances={item.instances}
        updateFn={updateActiveElement}
        showInstanceRemove={false}
        featureCountdowns={featureCountdowns}
        updateCountdown={null}
        onRollAttack={null}
        scaledMeta={scaledMeta}
        onScaledToggle={scaledMeta && onAdversaryScaledToggle ? () => onAdversaryScaledToggle(el.id) : null}
      />
    </div>
  );
}

function buildGameTableNewAdversaryStub(tier = 1, role = 'standard') {
  const id = generateId();
  const r = ROLES.includes(String(role).toLowerCase()) ? String(role).toLowerCase() : 'standard';
  const t = Number.isFinite(Number(tier)) && tier >= 1 && tier <= 4 ? Number(tier) : 1;
  const baseline = getBaselineStats(r, t) || getBaselineStats('standard', 1);
  return {
    id,
    name: '',
    tier: t,
    role: r,
    ...baseline,
    motive: '',
    description: '',
    imageUrl: '',
    _additionalImages: [],
    experiences: ensureEditorListIds([]),
    features: ensureEditorListIds([]),
    is_public: false,
  };
}

function buildGameTableNewEnvironmentStub(tier = 1, type = 'exploration') {
  const dt = coerceEnvironmentTier(tier) ?? 1;
  const dtype = coerceEnvironmentType(type);
  return {
    id: generateId(),
    name: '',
    tier: dt,
    type: dtype,
    difficulty: 10,
    description: '',
    impulses: '',
    imageUrl: '',
    _additionalImages: [],
    features: ensureEditorListIds([]),
    potential_adversaries: [],
    is_public: false,
  };
}

export function GMTableView({ tableId, activeElements, updateActiveElement: pushTableElementUpdate, removeActiveElement, updateActiveElementsBaseData, data, saveItem, saveImage, addToTable, sendDoAddToTable, onMergeAdversary, user, route, navigate, featureCountdowns = {}, sessionCountdowns = [], updateCountdown, partySize = 1, partyTier = 1, characters = [], tableBattleMods, setTableBattleMods, fearCount = 0, setFearCount, tableName = '', tableStateReady = false, onTableNameChange, onDeleteTable, ensureScenesLoaded, ensureAdventuresLoaded, ensureCharactersLoaded, clearTable, isPlayer = false, playerEmail, connectedPlayers = [], playerEmails = [], setPlayerEmails, gmUid, onPlayerAddCharacter, pendingBanners = [], pendingPlayerIntent = null, onFeatureRequestSuccess, onFeatureRequestCancel, rangerFocusRequestedBannerIds, onRangerFocusRerollRequestSuccess, onRangerFocusRerollRequestCancel, previewAsPlayerEmail = null, onPreviewAsPlayer, onExitPreview, actionLog = [], setActionLog, mapConfig, maps = [], activeMapId = null, gmMapView = null, onSetActiveMap, onAddMap, onAddMapWithImage, onRemoveMap, onRenameMap, onMapConfigChange, onMapViewSync, lifeSupportSelections = {}, onLifeSupportSelect, onLifeSupportClear, restMovesSelections = {}, onRestMoveSelect, onRestMoveClear, tableFeatureState = {}, sessionPlayAllowed = true, sessionStarted = true, sessionPaused = false, mapPings = [], onDismissMapPing = () => {}, appendMapPing = () => {},
  mapScribbles = [],
  mapViews = [], gmActiveViewId = null, onSetActiveView, onAddMapViewOp, onRemoveMapView, onRenameMapView, onSetViewBroadcast, onSetMapShare,
  onSetMapOverlay,
  onSetMapViewOverlay,
  playerSelectedViewId = null, onPlayerSelectView,
  playerFreeMapExplore = false,
  playerFreeExploreMapId = null,
  onPlayerEnterMapFreeExplore,
  onPlayerExitMapFreeExplore,
  onMapFreeExplore,
  onForcePlayersToMapView,
  onBattleMapViewportAspectChange,
}) {
  const { hideAiUi } = useAiUiPreference();
  const showConceptAiUi = shouldShowConceptAiUi(conceptAiEnabled, hideAiUi);
  const isTouch = useTouchDevice();
  const { srdData } = useCharacterSrdData();
  const v2Registry = useMemo(() => (srdData ? buildV2RegistryWithSrdItems(srdData) : null), [srdData]);

  /** Same shape as {@link CharacterHoverCard} / Actions strip — V2 card chips on sidebar character cards. */
  const v2TableContextForPanels = useMemo(
    () => ({
      activeElements,
      fearCount,
      mapConfig,
      tableFeatureState,
      registry: v2Registry ?? undefined,
    }),
    [activeElements, fearCount, mapConfig, tableFeatureState, v2Registry]
  );

  /** Mirrors `table_state` top for `gateTableOpForPrepMode` (sendOp bypass path). */
  const tableStateForGate = useMemo(
    () => ({ top: { sessionStarted: sessionStarted === false ? false : true, sessionPaused: sessionPaused === true } }),
    [sessionStarted, sessionPaused]
  );

  const [playBlockedDialog, setPlayBlockedDialog] = useState(null);
  /** Until reload: GM skips prep/pause prompts; blocked ops get `bypassPrepGate` (session flags unchanged). */
  const [playBlockedAllowAllEdits, setPlayBlockedAllowAllEdits] = useState(false);

  const sendOp = useCallback(
    (op) => {
      if (
        playBlockedAllowAllEdits &&
        !sessionPlayAllowed &&
        op &&
        typeof op === 'object' &&
        op.bypassPrepGate !== true
      ) {
        const gated = gateTableOpForPrepMode(tableStateForGate, op);
        if (!gated.ok) {
          postTableOp({ ...op, bypassPrepGate: true }, tableId);
          return;
        }
      }
      postTableOp(op, tableId);
    },
    [tableId, playBlockedAllowAllEdits, sessionPlayAllowed, tableStateForGate]
  );

  const trackSessionCountdownFromGmMove = useCallback(
    (feature, cd, cdIdx) => {
      if (findSessionCountdownBySource(sessionCountdowns, feature.cardKey, feature.featureKey, cdIdx)) return;
      const entry = buildTrackedSessionEntryFromFeature({
        feature,
        cd,
        cdIdx,
        sourceName: feature.sourceName,
      });
      sendOp({ op: 'session-countdown-upsert', entry });
    },
    [sessionCountdowns, sendOp]
  );

  const trackLinkedPairFromGmMove = useCallback(
    (feature, cds) => {
      const entries = buildLinkedPairFromFeatureCountdowns({ feature, cds, sourceName: feature.sourceName });
      for (const entry of entries) {
        sendOp({ op: 'session-countdown-upsert', entry });
      }
    },
    [sendOp]
  );

  const updateActiveElement = useCallback((instanceId, updates) => {
    if (!sessionPlayAllowed && isPrepModeElementUpdateBlocked(updates)) {
      if (!isPlayer) {
        if (playBlockedAllowAllEdits) {
          return pushTableElementUpdate(instanceId, updates, { bypassPrepGate: true });
        }
        setPlayBlockedDialog({ kind: 'element', instanceId, updates });
      }
      return;
    }
    return pushTableElementUpdate(instanceId, updates);
  }, [sessionPlayAllowed, pushTableElementUpdate, isPlayer, playBlockedAllowAllEdits]);

  const handleRollTransportError = useCallback((err, logLabel) => {
    if (err?.playBlocked === 'paused' || err?.playBlocked === 'prep') return;
    if (err?.message === 'cancelled') return;
    if (logLabel) console.error(logLabel, err);
  }, []);

  const postRoll = useCallback((rollText, displayName, tid, rollMeta = {}) => {
    if (!sessionPlayAllowed && !rollMeta.silent) {
      if (isPlayer) return Promise.reject(new Error('Session not started'));
      if (playBlockedAllowAllEdits) {
        return postRollToServer(rollText, displayName, tid, { ...rollMeta, bypassPrepGate: true });
      }
      return new Promise((resolve, reject) => {
        setPlayBlockedDialog({
          kind: 'roll',
          rollText,
          displayName,
          tid,
          rollMeta,
          resolve,
          reject,
        });
      });
    }
    return postRollToServer(rollText, displayName, tid, rollMeta);
  }, [sessionPlayAllowed, postRollToServer, isPlayer, playBlockedAllowAllEdits]);

  /** Silent server roll (no banner). Mirrors `api.postRollSilent` but uses wrapped `postRoll` for prep/session behavior. */
  const postRollSilent = useCallback(async (rollText, displayName, tid) => {
    const rollData = await postRoll(rollText, displayName, tid, { silent: true });
    const value =
      typeof rollData.total === 'number'
        ? rollData.total
        : parseInt(rollData.subItems?.[0]?.result, 10) || 0;
    return { ...rollData, value };
  }, [postRoll]);

  // ── Hover overlay hooks (desktop: mouseenter/leave; touch: tap-to-toggle) ──
  const suppressCharacterOverlayOutsideDismissRef = useRef(false);
  const trackerOverlay    = useHoverOverlay({ hideDelay: 120, isTouch });
  const characterOverlay  = useHoverOverlay({
    hideDelay: 120,
    isTouch,
    mode: 'click',
    getClickToggleKey: (d) => d?.element?.instanceId,
    suppressOutsideDismissRef: suppressCharacterOverlayOutsideDismissRef,
  });
  const potAdvOverlay     = useHoverOverlay({ hideDelay: 120, isTouch });
  const gmMovesOverlay    = useHoverOverlay({ hideDelay: 150, isTouch, mode: 'click', getClickToggleKey: () => 'gm-moves' });
  const gmMovesPortalTooltip = usePortalHoverTooltip();

  // GM Feature hover (multi-trigger within GM Moves panel — managed separately)
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [gmHoverOverlayActive, setGmHoverOverlayActive] = useState(false);
  const gmHoverHideTimer = useRef(null);
  const lastHoveredElementRef = useRef(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [modalOpen, setModalOpen] = useState(null); // null | 'adversaries' | 'environments' | 'scenes'
  const [characterPanelAiConcept, setCharacterPanelAiConcept] = useState('');
  const [encounterAiConcept, setEncounterAiConcept] = useState('');
  /** null = use adjusted budget from BP card math */
  const [encounterAiBudgetUser, setEncounterAiBudgetUser] = useState(null);
  const [encounterAiCountCurrent, setEncounterAiCountCurrent] = useState(true);
  const [encounterAiIncludePublic, setEncounterAiIncludePublic] = useState(false);
  const [encounterAiGenerateMap, setEncounterAiGenerateMap] = useState(false);
  const [encounterAiBuilding, setEncounterAiBuilding] = useState(false);
  /** 'plan' | 'resolving' | null — shown under Build with AI while the encounter LLM / homebrew pipeline runs. */
  const [encounterAiBuildPhase, setEncounterAiBuildPhase] = useState(null);
  /** After Build with AI: summary = plan copy; notes = technical warnings (catalog trims, BP checks). */
  const [encounterAiBuildFeedback, setEncounterAiBuildFeedback] = useState(null);
  /** Once per table + ready: default "Generate a new battle map" from whether the active map has art. */
  const encounterAiGenerateMapInitRef = useRef(false);
  /** Viewport anchor for programmatic character sheet open (Add Character → create / pick). */
  const addCharacterAnchorRef = useRef(null);

  // Feature card expand/collapse: per-user, unshared (localStorage), keyed by character instanceId.
  const [featureExpanded, setFeatureExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dh_featureExpanded') ?? 'null') ?? {}; }
    catch { return {}; }
  });
  const toggleFeatureExpanded = useCallback((instanceId, key) => {
    setFeatureExpanded(prev => {
      const current = prev[instanceId] ?? [];
      const isOpen = current.includes(key);
      const next = isOpen ? current.filter(k => k !== key) : [...current, key];
      const updated = { ...prev, [instanceId]: next };
      try { localStorage.setItem('dh_featureExpanded', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const setFeatureExpandedKeys = useCallback((instanceId, keys) => {
    setFeatureExpanded((prev) => {
      const updated = { ...prev, [instanceId]: keys };
      try { localStorage.setItem('dh_featureExpanded', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Dice roller ref — banners are added/removed purely by the pendingBanners subscription effect.

  // Load scenes/adventures when picker opens so it can display the list.
  const [pickerLoading, setPickerLoading] = useState(false);
  useEffect(() => {
    if (modalOpen === 'scenes' && ensureScenesLoaded) {
      if ((data.scenes || []).length > 0) {
        setPickerLoading(false);
        return;
      }
      setPickerLoading(true);
      ensureScenesLoaded().finally(() => setPickerLoading(false));
    } else if (modalOpen === 'adventures' && ensureAdventuresLoaded) {
      if ((data.adventures || []).length > 0) {
        setPickerLoading(false);
        return;
      }
      setPickerLoading(true);
      ensureAdventuresLoaded().finally(() => setPickerLoading(false));
    } else if (modalOpen === 'characters' && ensureCharactersLoaded) {
      if ((data.characters || []).length > 0) {
        setPickerLoading(false);
        return;
      }
      setPickerLoading(true);
      ensureCharactersLoaded().finally(() => setPickerLoading(false));
    } else {
      setPickerLoading(false);
    }
  }, [modalOpen, ensureScenesLoaded, ensureAdventuresLoaded, data.scenes?.length, data.adventures?.length]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e) => { if (e.key === 'Escape') setLightboxUrl(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxUrl]);

  const [showStripLegend, setShowStripLegend] = useState(false);
  const [rolledKey, setRolledKey] = useState(null);
  // In-place target picker for adversary attacks (shown before rolling when attackers are on the map with a range).
  const [adversaryTargetMenu, setAdversaryTargetMenu] = useState(null);

  useEffect(() => {
    if (!adversaryTargetMenu) return;
    const handler = (e) => { if (e.key === 'Escape') setAdversaryTargetMenu(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [adversaryTargetMenu]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [budgetCardOpen, setBudgetCardOpen] = useState(false);
  const [diceCanvasHidden, setDiceCanvasHidden] = useState(false);

  // Action banners with adversary target: { [rollDbId]: selectedAdversaryInstanceId } — pre-populated from player's in-place pick, cleared on ack
  const [actionAdversarySelections, setActionAdversarySelections] = useState({});
  // Character dialog removed — characters are now managed through the Library picker
  const [playerEmailInput, setPlayerEmailInput] = useState('');
  const [showPlayerEmailPanel, setShowPlayerEmailPanel] = useState(false);
  const [contactsToken, setContactsToken] = useState(null);
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const contactsDebounceRef = useRef(null);
  // dialogSyncing / dialogSyncError removed — character dialog replaced by Library picker
  const overlayScrollRef = useRef(null);
  const gmFeatureOverlayRef = useRef(null); // outer ref for touch outside-tap dismiss
  /** Main character sheet column (not companion) — layout ref for the unified sheet + editor card. */
  const characterSheetColumnRef = useRef(null);
  const [characterEditorPortalEl, setCharacterEditorPortalEl] = useState(null);
  /** Live form + save flags from portaled `ItemDetailModal` for the shared Game Table title bar. */
  const [characterDrawerChromeSync, setCharacterDrawerChromeSync] = useState(null);
  const characterTableDetailModalRef = useRef(null);
  // editState: null | { step: 'choice', baseElement, instances, collection }
  //                  | { step: 'form', item, collection, mode, baseElement, instances? }
  const [editState, setEditState] = useState(null);

  useEffect(() => {
    const portaledChar =
      editState?.step === 'form' &&
      editState?.presentation === 'rightDrawer' &&
      editState?.collection === 'characters';
    if (!portaledChar) setCharacterDrawerChromeSync(null);
  }, [editState?.step, editState?.presentation, editState?.collection]);

  const [scaledToggleState, setScaledToggleState] = useState({});
  const trackerKey = trackerOverlay.data
    ? (trackerOverlay.data.kind === 'environment' ? trackerOverlay.data.element.instanceId : trackerOverlay.data.baseElement.id)
    : null;
  const trackerAdjust = useViewportClamp(trackerOverlay.overlayRef, trackerOverlay.isOpen, trackerKey);

  const [resyncingCharId, setResyncingCharId] = useState(null);
  const [preRollBanner, setPreRollBanner] = useState(null); // { rollWrapper, chips, characterEl, onProceed } when player has onAct chips
  const [preRollExperienceIndex, setPreRollExperienceIndex] = useState(null); // intent panel: PC experience for action roll
  const [preRollCompanionExperienceIndex, setPreRollCompanionExperienceIndex] = useState(null);
  const [selectedPreRollChips, setSelectedPreRollChips] = useState([]); // one boolean per chip when preRollBanner is set
  const [preRollDifficulty, setPreRollDifficulty] = useState(15); // DC 5–30 when GM shows difficulty chip
  const [preRollAdvantages, setPreRollAdvantages] = useState([]); // string[]: optional name per advantage ('' = default "Advantage")
  const [preRollDisadvantages, setPreRollDisadvantages] = useState([]); // string[]: optional name per disadvantage ('' = default "Disadvantage")
  /** Intent panel: review/change attack target (same list as in-sheet target menu). */
  const [preRollTargetInstanceId, setPreRollTargetInstanceId] = useState(null);

  const potAdvKey = potAdvOverlay.data?.element?.id ?? null;
  const potAdvAdjust = useViewportClamp(potAdvOverlay.overlayRef, potAdvOverlay.isOpen, potAdvKey);

  const handlePotentialAdversaryHover = async (adversaryId, rect) => {
    potAdvOverlay.cancelClose();
    try {
      const result = await resolveItems({ adversaries: [adversaryId] });
      const adversary = result.adversaries?.[0];
      if (adversary) {
        potAdvOverlay.show({ element: adversary, top: rect.top, bottom: rect.bottom });
      }
    } catch (err) {
      console.warn('Failed to resolve potential adversary for hover:', err);
    }
  };

  const handleResyncCharacter = async (el) => {
    if (!el.daggerstackUrl || !el.daggerstackEmail || !el.daggerstackPassword) return;
    setResyncingCharId(el.instanceId);
    try {
      const { character, _debug, _lookupTables } = await syncDaggerstackCharacter(el.daggerstackUrl, el.daggerstackEmail, el.daggerstackPassword);
      // Preserve runtime state (current HP/stress/hope/armor, conditions, playerName)
      const updatedCharacter = {
        ...character,
        _daggerstackDebug: _debug,
        _daggerstackLookupTables: _lookupTables,
        instanceId: el.instanceId,
        elementType: 'character',
        currentHp: el.currentHp,
        currentStress: el.currentStress,
        hope: el.hope,
        currentArmor: el.currentArmor,
        conditions: el.conditions,
        playerName: el.playerName || character.playerName,
      };
      updateActiveElement(el.instanceId, updatedCharacter);
      // Also save to the library so the resolution layer propagates the re-synced
      // base data to any future table loads and other table instances.
      if (el.id) {
        saveItem('characters', { ...character, id: el.id }).catch(err => console.error('Re-sync library save failed:', err));
      }
      // Update hover card element reference
      const prevCharData = characterOverlay.data;
      if (prevCharData?.element?.instanceId === el.instanceId) {
        characterOverlay.show({ ...prevCharData, element: { ...prevCharData.element, ...character, _daggerstackDebug: _debug, _daggerstackLookupTables: _lookupTables, instanceId: el.instanceId } });
      }
    } catch (err) {
      console.error('Re-sync failed:', err);
      alert(`Re-sync failed: ${err.message}`);
    } finally {
      setResyncingCharId(null);
    }
  };

  // gmMovesOverlay — handled by useHoverOverlay hook declared above
  const [openConditions, setOpenConditions] = useState(() => new Set()); // instanceIds with conditions input open
  // Roll IDs where onChipAck called roll.setWithHope() — persisted until banner ack or banner removal.
  const [chipHopeConvertedIds, setChipHopeConvertedIds] = useState(() => new Set());
  /** Pending `_rollDbId` → Set of activation keys (`v2BannerChipActivationKey`) for one-shot `onUse` review chips. */
  const [v2BannerConsumedOnUseByRollDbId, setV2BannerConsumedOnUseByRollDbId] = useState(() => new Map());
  // Prune chipHopeConvertedIds when the corresponding banner is no longer pending.
  useEffect(() => {
    if (chipHopeConvertedIds.size === 0) return;
    const pendingIds = new Set((pendingBanners || []).map(r => r._rollDbId).filter(id => id != null));
    setChipHopeConvertedIds(prev => {
      const next = new Set([...prev].filter(id => pendingIds.has(id)));
      return next.size !== prev.size ? next : prev;
    });
  }, [pendingBanners]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const pendingIds = (pendingBanners || []).map((r) => r._rollDbId).filter((id) => id != null);
    setV2BannerConsumedOnUseByRollDbId((prev) => pruneV2BannerConsumedOnUseKeys(prev, pendingIds));
  }, [pendingBanners]);
  // ── Damage application state ─────────────────────────────────────────────
  const diceRollerRef = useRef(null);
  /** Latest action-banner adversary picker list — for withActionBannerSuppression (defined before useMemo). */
  const actionAdversaryTargetsRef = useRef([]);
  const pendingDamageRef = useRef(null); // stash applied damage for ack broadcast

  // Pending resource costs: shown as "halfway" on Hope/Stress/Armor until GM acks (or banner dismissed).
  // Updated when any client adds a roll with costs (initiator or on SSE forward) so everyone sees pending.
  const [pendingResourceCosts, setPendingResourceCosts] = useState(() => ({}));
  const getRollCosts = (roll) => {
    if (!roll?._attackerInstanceId) return null;
    const hope = (parseInt(roll._hopeCost, 10) || 0) + (parseInt(roll._experienceHopeCost, 10) || 0);
    const stress = parseInt(roll._stressCost, 10) || 0;
    const armorMark = parseInt(roll._armorMark, 10) || 0;
    const armorClear = parseInt(roll._armorClear, 10) || 0;
    if (hope === 0 && stress === 0 && armorMark === 0 && armorClear === 0) return null;
    return { instanceId: roll._attackerInstanceId, hope, stress, armorMark, armorClear };
  };
  const addPendingCosts = (roll) => {
    const c = getRollCosts(roll);
    if (!c) return;
    setPendingResourceCosts(prev => {
      const cur = prev[c.instanceId] || { hope: 0, stress: 0, armorMark: 0, armorClear: 0 };
      return {
        ...prev,
        [c.instanceId]: {
          hope: cur.hope + c.hope,
          stress: cur.stress + c.stress,
          armorMark: cur.armorMark + c.armorMark,
          armorClear: cur.armorClear + c.armorClear,
        },
      };
    });
  };
  const removePendingCosts = (roll) => {
    const c = getRollCosts(roll);
    if (!c) return;
    setPendingResourceCosts(prev => {
      const cur = prev[c.instanceId];
      if (!cur) return prev;
      const next = {
        hope: Math.max(0, cur.hope - c.hope),
        stress: Math.max(0, cur.stress - c.stress),
        armorMark: Math.max(0, cur.armorMark - c.armorMark),
        armorClear: Math.max(0, cur.armorClear - c.armorClear),
      };
      if (next.hope === 0 && next.stress === 0 && next.armorMark === 0 && next.armorClear === 0) {
        const { [c.instanceId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [c.instanceId]: next };
    });
  };

  /** When the GM manually marks stress on a card while rolls show dashed "pending" boxes, drop the matching pending tally. */
  const consumePendingStressForManualMark = useCallback((instanceId, delta) => {
    setPendingResourceCosts(prev => reducePendingStressAfterManualMark(prev, instanceId, delta));
  }, []);

  const wrappedPartyCharacters = useMemo(() =>
    activeElements.filter(e => e.elementType === 'character').map(el => wrapEntity(el, updateActiveElement)),
    [activeElements, updateActiveElement]
  );

  const system = useMemo(
    () => buildSystemContext(tableId, (n) => diceRollerRef.current?.addRoll(n)),
    [tableId]
  );

  // Apply HP/Stress changes to a target after optional Parry reduction.
  // armorOpts: { applyReduction?, markSlot?, feature?, postRollSilent?, useImpenetrable? }
  //   applyReduction: reduce hpLoss by 1 (or 2 for Fortified) — set by armor button
  //   markSlot: actually consume an armor slot — false when Resilient saves it
  //   feature: armor feature name ('Fortified', 'Painful', 'Reinforced', etc.)
  //   postRollSilent: (text, displayName) => Promise<{ value? }> for Timeslowing 1d4
  //   useImpenetrable: use Impenetrable (Mark Stress instead of last HP, 1/rest)
  // dmgType: 'phy' | 'mag' | '' — damage type from the roll's post tag (Phase 3)
  const applyDamageToTarget = async (target, effectiveDmgTotal, tagNames, roll, armorOpts = {}, dmgType = '') => {
    const { applyReduction = false, markSlot = false, feature = null, postRollSilent = null, useImpenetrable = false } = armorOpts;

    // Wrap target and roll so feature hooks receive clean semantic APIs.
    const entityTarget = wrapEntity(target, updateActiveElement);
    const wrappedRoll = wrapRoll(roll);
    const ctx = { target: entityTarget, character: entityTarget, tagNames, roll: wrappedRoll, dmgType, characters: wrappedPartyCharacters, system };

    // Store initial damage total and use roll.damageTotal as the pipeline accumulator
    if (wrappedRoll.damageTotal == null) {
      wrappedRoll._initialDamageTotal = effectiveDmgTotal;
      wrappedRoll.damageTotal = effectiveDmgTotal;
    } else {
      wrappedRoll._initialDamageTotal = wrappedRoll.damageTotal;
      wrappedRoll.damageTotal = effectiveDmgTotal;
    }

    // Pre-threshold damage modification (e.g. Warded, Guardian Unstoppable) — unified over activeFeatures for characters
    // Hooks read from roll.damageTotal and return the new value
    if (target.elementType === 'character' && Array.isArray(target.activeFeatures) && target.activeFeatures.length > 0) {
      const participants = target.activeFeatures.filter(f => typeof f.modifyPreThresholdDamage === 'function');
      participants.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
      for (const feature of participants) {
        try {
          const featureCtx = { ...ctx, source: feature.source, feature };
          const result = feature.modifyPreThresholdDamage(featureCtx);
          if (result !== undefined) wrappedRoll.damageTotal = result;
        } catch (err) {
          console.error(`[features] ${feature.name}.modifyPreThresholdDamage threw:`, err);
        }
      }
    } else {
      const descriptor = resolveArmorModifyPreThresholdDescriptor(target);
      if (descriptor && typeof descriptor.modifyPreThresholdDamage === 'function') {
        try {
          const featureCtx = { ...ctx, feature: descriptor };
          const result = descriptor.modifyPreThresholdDamage(featureCtx);
          if (result !== undefined) wrappedRoll.damageTotal = result;
        } catch (err) {
          console.error(`[features] ${target.armorFeatureName}.modifyPreThresholdDamage threw:`, err);
        }
      }
    }

    // Character resistance to physical damage (e.g. Galapa Retract, or resistance array)
    if (target.elementType === 'character' && (dmgType === 'phy' || dmgType === 'Physical')) {
      const resistance = Array.isArray(target.resistance) ? target.resistance : [];
      const hasResistance = target.retractedActive
        || resistance.some(r => (r.type === 'physical' || r.type === 'Physical'));
      if (hasResistance) wrappedRoll.damageTotal = Math.floor(wrappedRoll.damageTotal / 2);
    }

    // Store initial HP loss and use roll.hpLoss as the pipeline accumulator
    const initialHpLoss = computeHpLoss(wrappedRoll.damageTotal, target.thresholds);
    wrappedRoll._initialHpLoss = initialHpLoss;
    wrappedRoll.hpLoss = initialHpLoss;

    // HP loss modification (e.g. Deadly adds +1 on Severe) — from attacker's weapon features when character, else by tag names
    // Hooks read from roll.hpLoss and return the new value
    const attackerEl = roll?._attackerInstanceId ? activeElements.find(e => e.instanceId === roll._attackerInstanceId) : null;
    if (attackerEl?.activeFeatures?.length && tagNames.size > 0) {
      const weaponFeaturesForRoll = attackerEl.activeFeatures.filter(f => f.type === 'weapon' && tagNames.has(f.name));
      const participants = weaponFeaturesForRoll.filter(f => typeof f.modifyHpLoss === 'function');
      participants.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
      for (const feature of participants) {
        try {
          const featureCtx = { ...ctx, source: feature.source, feature };
          const result = feature.modifyHpLoss(featureCtx);
          if (result !== undefined) wrappedRoll.hpLoss = result;
        } catch (err) {
          console.error(`[features] ${feature.name}.modifyHpLoss threw:`, err);
        }
      }
    }

    // Armor reduction when a slot is used
    if (applyReduction) {
      let reduction = 1;
      if (target.elementType === 'character' && Array.isArray(target.activeFeatures) && feature) {
        const armorRow = target.activeFeatures.find((f) => f.type === 'armor' && f.name === feature);
        if (armorRow?.armorReduction != null) reduction = armorRow.armorReduction;
      }
      wrappedRoll.hpLoss = Math.max(0, wrappedRoll.hpLoss - reduction);
    }

    // Ancestry/feature HP reduction (e.g. Dwarf Thick Skin from onChipAck reduceHpLoss(1))
    const hpLossReduction = Math.max(0, Math.floor(roll?._hpLossReduction ?? 0));
    wrappedRoll.hpLoss = Math.max(0, wrappedRoll.hpLoss - hpLossReduction);

    // Impenetrable (1/rest): substitute 1 Stress for the last HP when damage would reduce to 0
    let hpLossToApply = wrappedRoll.hpLoss;
    if (target.elementType === 'character' && wrappedRoll.hpLoss > 0 && useImpenetrable && target.armorFeatureName === 'Impenetrable') {
      const currentHp = target.currentHp ?? target.maxHp ?? 0;
      const wouldBeZero = currentHp - wrappedRoll.hpLoss <= 0;
      const hasStressSpace = (target.currentStress ?? 0) < (target.maxStress ?? 6);
      const usedThisRest = target.featureUsage?.Impenetrable?.cycle === 'rest';
      if (wouldBeZero && hasStressSpace && !usedThisRest) {
        hpLossToApply = Math.max(0, currentHp - 1); // leave at 1 HP
        entityTarget.markStress(1);
        entityTarget.setFeatureUsed('Impenetrable', 'rest');
      }
    }

    // V2 Phase C: one hydrated `reviewOutcome` pass at damage commit (opt-in registry rows only).
    if (
      (target.type === 'character' ||
        target.type === 'adversary' ||
        target.elementType === 'character' ||
        target.elementType === 'adversary') &&
      srdData &&
      roll?._attackerInstanceId &&
      hpLossToApply > 0
    ) {
      const v2DamageOutcome = runV2DamageApplyReviewOutcomePhase({
        roll,
        targetElement: target,
        activeElements,
        srdData,
        fearCount,
        mapConfig,
        tableFeatureState,
        damageAmount: wrappedRoll.damageTotal,
        hpLossAmount: hpLossToApply,
      });
      for (const u of v2DamageOutcome.elementUpdates) {
        updateActiveElement(u.instanceId, u.updates);
      }
      for (const p of v2DamageOutcome.actionLoopNotifications || []) {
        const baseDesc = p.description || '';
        const actionText =
          p.affectedSummary && String(p.affectedSummary).trim()
            ? `${baseDesc}\n${p.affectedSummary}`
            : baseDesc;
        postActionNotification(
          withActionBannerSuppression(
            {
              _action: true,
              rollUser: 'Table',
              actionName: p.title,
              actionText,
              _v2ActionLoop: true,
              _reactorInstanceId: p.instanceId,
              ...v2RollDieExtrasFromActionLoopPayload(p),
              ...(Array.isArray(p.affectedNames) && p.affectedNames.length > 0
                ? { _affectedNames: p.affectedNames, _affectedInstanceIds: p.affectedInstanceIds }
                : {}),
            },
            { actionAdversaryTargets: actionAdversaryTargetsRef.current }
          )
        ).catch(() => {});
      }
      if (typeof v2DamageOutcome.adjustedHpLoss === 'number') {
        hpLossToApply = v2DamageOutcome.adjustedHpLoss;
        wrappedRoll.hpLoss = hpLossToApply;
      }
    }

    // Origin lifecycle: onMarkHP can cancel (character only)
    if (target.elementType === 'character' && hpLossToApply > 0) {
      const hpCancel = runBeforeMarkHP(target, hpLossToApply, 'damage', updateActiveElement, { characters: wrappedPartyCharacters, system });
      if (hpCancel.cancel) hpLossToApply = 0;
    }
    if (hpLossToApply > 0) entityTarget.markHp(hpLossToApply);

    // Armor slot marking and triggered effects (Painful, Reinforced, Timeslowing, Shifting, etc.)
    // markArmor() runs first so hooks see the post-mark count via target.currentArmor.
    if (markSlot) {
      if (target.elementType === 'character') {
        const armorCancel = runBeforeMarkArmor(target, 1, feature ?? 'armor', updateActiveElement, { characters: wrappedPartyCharacters, system });
        if (!armorCancel.cancel) entityTarget.markArmor();
      } else {
        entityTarget.markArmor();
      }
      const armorFeatureName = feature ?? null;
      if (armorFeatureName) {
        const descriptor =
          target.elementType === 'character' && Array.isArray(target.activeFeatures)
            ? target.activeFeatures.find((f) => f.type === 'armor' && f.name === armorFeatureName && typeof f.onAfterMarkArmor === 'function')
            : null;
        const fn = descriptor?.onAfterMarkArmor;
        if (typeof fn === 'function') {
          const afterCtx = {
            character: entityTarget,
            amount: 1,
            source: armorFeatureName,
            feature: descriptor,
            roll: ctx.roll,
            postRollSilent,
            tagNames: ctx.tagNames,
            dmgType: ctx.dmgType,
            characters: wrappedPartyCharacters,
            system,
          };
          try {
            const result = fn(afterCtx);
            if (result != null && typeof result.then === 'function') await result;
          } catch (err) {
            console.error(`[features] ${armorFeatureName}.onAfterMarkArmor threw:`, err);
          }
        }
      }
    }

    // Beastform auto-drop: same scoped `setFeatureState` clears as V2 Drop chip / `clearBeastformState`
    // (table-ops mirrors legacy `activeBeastform` + `selectedBeastformAdvantage` when scoped activeBeastform is nulled).
    if (target.elementType === 'character') {
      let displayMerged = null;
      if (srdData) {
        try {
          displayMerged = mergeV2DeclarativeSheetOverlay(recomputeCharacter(target, srdData), target, srdData, {
            fearCount,
            mapConfig,
            tableFeatureState,
          });
        } catch {
          displayMerged = null;
        }
      }
      const activeBf = displayMerged?.activeBeastform ?? target.activeBeastform;
      if (activeBf) {
        const effectiveAf = displayMerged?.activeFeatures ?? target.activeFeatures;
        const fragileDeclarative = hasDeclarativeBeastformFragileDrop(effectiveAf);
        const isFragile = fragileDeclarative || legacyBeastformFeaturesLookFragile(activeBf);
        const dropped = shouldDropBeastformFromDamage({
          currentHp: entityTarget.currentHp,
          hpLossToApply,
          hasFragile: isFragile,
        });
        if (dropped) {
          const mutations = buildClearBeastformStateMutations();
          const { updates } = applyV2LifecycleMutations(activeElements, mutations, target.instanceId);
          if (updates.length > 0) {
            sendOp({ op: 'update-elements', updates });
          } else {
            updateActiveElement(target.instanceId, { activeBeastform: null, selectedBeastformAdvantage: null });
          }
          const reason = entityTarget.currentHp === 0 ? '(last HP)' : '(Fragile — Major or greater damage)';
          handleActionNotification({
            _action: true,
            rollUser: target.name || '',
            actionName: 'Dropped out of Beastform',
            actionText: `${target.name} drops out of Beastform ${reason}.`,
          });
        }
      }
    }

    // Dispatch onDamageReceived (e.g. Elemental Incarnation Severe drop)
    if (target.elementType === 'character' && wrappedRoll.hpLoss >= 1 && Array.isArray(target.activeFeatures)) {
      runCharacterHook(target.activeFeatures, 'onDamageReceived', {
        character: entityTarget,
        dmgTotal: wrappedRoll.damageTotal,
        hpLoss: wrappedRoll.hpLoss,
        updateActiveElement,
        characters: wrappedPartyCharacters,
      });
    }

    return entityTarget.currentHp;
  };

  // Called from the banner's "Apply to" target badge.
  // Async to support Parry (which requires a server roll before applying damage).
  // dmgType: 'phy' | 'mag' | '' — damage type extracted from the roll (Phase 3)
  const handleApplyDamage = async (target, dmgTotal, tags = [], roll = null, dmgType = '') => {
    if (roll?._treatAsMissForTarget === target.instanceId) return;
    const tagNames = new Set((tags || []).map(t => t.name));
    let effectiveDmgTotal = dmgTotal;

    // Parry: if target is a character with a Parry weapon, invoke the Parry hook (silent roll — no second banner)
    if (target.type === 'character' && roll?.subItems) {
      const charEl = activeElements.find(el => el.instanceId === target.instanceId);
      const parryWeapon = (charEl?.weapons || []).find(w => w.feature?.name === 'Parry');
      if (parryWeapon) {
        const parryFeature = resolveParryWeaponFeature(charEl);
        if (parryFeature?.onBeforeDamageApplied) {
          const wrappedTarget = wrapEntity(charEl || target, updateActiveElement);
          const wrappedRoll = wrapRoll(roll);
          const result = await parryFeature.onBeforeDamageApplied({
            target: wrappedTarget,
            roll: wrappedRoll,
            feature: parryFeature,
            system,
            effectiveDmgTotal,
            characters: wrappedPartyCharacters,
          });
          if (result !== undefined) {
            effectiveDmgTotal = result;
          }
        }
      }
    }

    // Armor usage: when the banner's armor button was clicked
    let armorOpts = {};
    if (target.useArmor && (target.currentArmor ?? 0) < (target.maxArmor ?? 0)) {
      const feature = target.armorFeatureName ?? null;
      const isLastSlot = (target.currentArmor ?? 0) + 1 >= (target.maxArmor ?? 0);
      let markSlot = true;

      // Resilient: on the last slot, invoke the Resilient hook which may save the slot
      if (feature === 'Resilient' && isLastSlot) {
        const resilientFeature = resolveResilientArmorFeature(target);
        if (resilientFeature?.onLastArmorSlot) {
          const character = wrapEntity(target, updateActiveElement);
          const result = await resilientFeature.onLastArmorSlot({
            character,
            system,
            characters: wrappedPartyCharacters,
            feature: resilientFeature,
          });
          if (result?.saveSlot) markSlot = false;
        }
      }

      armorOpts = { applyReduction: true, markSlot, feature };
    }
    armorOpts = { ...armorOpts, postRollSilent, useImpenetrable: !!target.useImpenetrable };

    // Generic damage modifiers from active banner chips (e.g. Increased Fortitude toggle path)
    const modifiers = Array.isArray(target.damageModifiers) ? target.damageModifiers : [];
    if (roll?._damageTotalOverride == null && target.type === 'character' && modifiers.length > 0) {
      const charEl = activeElements.find(el => el.instanceId === target.instanceId);
      if (charEl) {
        for (const mod of modifiers) {
          const applies = mod.dmgType == null || mod.dmgType === dmgType;
          if (!applies || typeof mod.apply !== 'function') continue;
          const hopeCost = mod.hopeCost ?? 0;
          const stressCost = mod.stressCost ?? 0;
          const hasHope = (charEl.hope ?? 0) >= hopeCost;
          const hasStress = stressCost <= 0 || (charEl.currentStress != null && charEl.maxStress != null && (charEl.maxStress - charEl.currentStress) >= stressCost);
          if (hopeCost > 0 && !hasHope) continue;
          if (stressCost > 0 && !hasStress) continue;
          if (hopeCost > 0) updateActiveElement(target.instanceId, { hope: Math.max(0, (charEl.hope ?? 0) - hopeCost) });
          if (stressCost > 0) {
            const nextStress = Math.min(charEl.maxStress ?? 0, (charEl.currentStress ?? 0) + stressCost);
            updateActiveElement(target.instanceId, { currentStress: nextStress });
          }
          effectiveDmgTotal = mod.apply(effectiveDmgTotal);
          break; // apply first matching modifier only (current behavior)
        }
      }
    }

    const newHp = await applyDamageToTarget(target, effectiveDmgTotal, tagNames, roll, armorOpts, dmgType);
    const hpApplied = (target.currentHp ?? target.maxHp ?? 0) - newHp;

    const charEl = target.type === 'character'
      ? activeElements.find(e => e.instanceId === target.instanceId) : null;

    const v2DamageAck = runV2DamageAckReviewActionHooks({
      roll,
      activeElements,
      srdData,
      fearCount,
      mapConfig,
      tableFeatureState,
      hpApplied,
    });
    if (v2DamageAck.elementUpdates?.length) {
      sendOp({ op: 'update-elements', updates: v2DamageAck.elementUpdates });
    }
    for (const pr of v2DamageAck.postRolls || []) {
      postRoll(pr.rollText, pr.displayName, tableId, pr.rollMeta).catch(err => handleRollTransportError(err));
    }
    for (const n of v2DamageAck.actionNotifications || []) {
      handleActionNotification(n);
    }

    // Burning (Emberwoven): when a character with Burning armor is hit in Melee, the attacker marks 1 Stress
    if (hpApplied >= 1 && charEl?.armorFeatureName === 'Burning' && roll?._attackerInstanceId) {
      const attackerIds = roll._attackerInstanceIds ?? (roll._attackerInstanceId ? [roll._attackerInstanceId] : []);
      const isMelee = charEl.tokenX != null && charEl.tokenY != null
        ? attackerIds.some(id => {
            const att = activeElements.find(e => e.instanceId === id);
            return att?.tokenX != null && att?.tokenY != null
              && tokenDistanceFt(charEl.tokenX, charEl.tokenY, att.tokenX, att.tokenY) <= RANGE_BANDS_FT.MELEE;
          })
        : (roll._attackRangeFt != null && roll._attackRangeFt <= RANGE_BANDS_FT.MELEE);
      if (isMelee && attackerIds.length > 0) {
        const attackerId = attackerIds[0];
        const attackerEl = activeElements.find(e => e.instanceId === attackerId);
        if (attackerEl) {
          wrapEntity(attackerEl, updateActiveElement).markStress(1);
          const attackerName = attackerEl.name ?? 'Attacker';
          handleActionNotification({ _action: true, rollUser: charEl.name,
            actionName: 'Burning', actionText: `Burning: ${attackerName} marked 1 Stress.` });
        }
      }
    }

    // Sharp (Spiked Plate): when a character with Sharp armor is hit in Melee, the attacker takes 1d4 damage
    if (hpApplied >= 1 && charEl?.armorFeatureName === 'Sharp' && roll?._attackerInstanceId) {
      const attackerIds = roll._attackerInstanceIds ?? (roll._attackerInstanceId ? [roll._attackerInstanceId] : []);
      const isMelee = charEl.tokenX != null && charEl.tokenY != null
        ? attackerIds.some(id => {
            const att = activeElements.find(e => e.instanceId === id);
            return att?.tokenX != null && att?.tokenY != null
              && tokenDistanceFt(charEl.tokenX, charEl.tokenY, att.tokenX, att.tokenY) <= RANGE_BANDS_FT.MELEE;
          })
        : (roll._attackRangeFt != null && roll._attackRangeFt <= RANGE_BANDS_FT.MELEE);
      if (isMelee && attackerIds.length > 0) {
        const sharpTargetId = attackerIds[0];
        postRoll(`${charEl.name} Sharp retaliation damage [1d4]`, charEl.name, tableId, {
          _attackerInstanceId: charEl.instanceId,
          _selectedTargetInstanceId: sharpTargetId,
        }).catch(err => handleRollTransportError(err));
      }
    }

    // Ranger's Focus: on hit, mark target as "Focused by X" and clear previous focus for this Ranger
    const isAdversaryTarget = target.elementType === 'adversary' || target.type === 'adversary';
    let attackerName = null;
    if (roll?._rangerFocusAttempt && roll._attackerInstanceId && isAdversaryTarget) {
      const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      attackerName = attackerEl?.name || roll.rollUser || 'Ranger';
      activeElements.forEach(el => {
        if (el.elementType === 'adversary' && el.instanceId !== target.instanceId && el.focusedBy === attackerName) {
          updateActiveElement(el.instanceId, { focusedBy: null });
        }
      });
      updateActiveElement(target.instanceId, { focusedBy: attackerName });
    }
    // Focused-by effect: when the Ranger deals damage to their Focus target, the target marks 1 Stress.
    if (isAdversaryTarget && roll?._attackerInstanceId) {
      const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      const name = attackerEl?.name || roll.rollUser || '';
      if (name && (target.focusedBy === name || (roll?._rangerFocusAttempt && roll._attackerInstanceId))) {
        wrapEntity(target, updateActiveElement).markStress(1);
      }
    }

    // Locked On (weapon): on a successful hit, set lock so the next primary attack vs this target auto-succeeds
    if (hpApplied >= 1 && roll?._attackerInstanceId) {
      const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      const hasLockedOn = (attackerEl?.weapons || []).some(w => w.feature?.name === 'Locked On');
      if (attackerEl?.elementType === 'character' && hasLockedOn) {
        updateActiveElement(roll._attackerInstanceId, { lockedOnTargetInstanceId: target.instanceId });
      }
    }

    // onHpDealt (e.g. Guardian Unstoppable ratchet, Ranger's Focus self-Stress)
    if (hpApplied >= 1 && roll?._attackerInstanceId) {
      const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      if (attackerEl?.elementType === 'character' && Array.isArray(attackerEl.activeFeatures) && attackerEl.activeFeatures.length > 0) {
        const entityAttacker = wrapEntity(attackerEl, updateActiveElement);
        const entityTarget = wrapEntity(target, updateActiveElement);
        runCharacterHook(attackerEl.activeFeatures, 'onHpDealt', {
          character: entityAttacker,
          hpDealt: hpApplied,
          target: entityTarget,
          updateActiveElement,
          characters: wrappedPartyCharacters,
        });
      }
    }

    pendingDamageRef.current = { instanceId: target.instanceId, newHp };
  };

  // Action notification (e.g. Startling, session-cycle banners): fire-and-forget broadcast.
  // Defined before handleConcussiveKnock so it can be listed in that useCallback's dependency array.
  const handleActionNotification = (notification) => {
    const payload = withActionBannerSuppression(notification, {
      actionAdversaryTargets: actionAdversaryTargetsRef.current,
    });
    if (!sessionPlayAllowed && !payload._sessionStart) {
      if (!isPlayer) {
        if (playBlockedAllowAllEdits) {
          dismissAllHoverCards();
          postActionNotification(payload, tableId, { bypassPrepGate: true }).catch(() => {});
          return;
        }
        setPlayBlockedDialog({ kind: 'action', notification: payload });
      }
      return;
    }
    dismissAllHoverCards();
    postActionNotification(payload, tableId).catch(() => {});
  };

  const handleRestBannerV2Chip = useCallback(
    (rawChip, characterEl, isPlayerSession) => {
      if (!srdData || !characterEl?.instanceId) return;
      const restBanner = pendingBanners?.find((b) => b._rest);
      if (!restBanner) return;
      const duration = restBanner._restDuration === 'long' ? 'long' : 'short';
      const merged = mergeV2DeclarativeSheetOverlay(recomputeCharacter(characterEl, srdData), characterEl, srdData, {
        fearCount,
        mapConfig,
        tableFeatureState,
      });
      const registry = buildV2RegistryWithSrdItems(srdData);
      const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
      const { mutations, engineChip, error } = activateV2RestPlacementChip({
        mergedCharacterEl: merged,
        rawChip,
        activeElements: activeForLoader,
        registry,
        restDuration: duration,
        fearCount,
        mapConfig,
        tableFeatureState,
      });
      if (error || !mutations?.length) return;
      applyV2OwnedCardChipEngineResultToTable({
        result: { mutations, engineChip },
        featRow: { name: rawChip._featureName || engineChip?._featureName || 'Rest' },
        passedFeatureKey: null,
        el: characterEl,
        activeElementsForV2Snapshots: activeElements,
        tableId,
        onActionLoopNotification: handleActionNotification,
        isPlayer: isPlayerSession,
      });
    },
    [srdData, pendingBanners, activeElements, fearCount, mapConfig, tableFeatureState, tableId]
  );

  /** Beastbound companion `boardToken`: auto-add when missing (GM only); ref avoids duplicate add-elements before SSE. */
  const autoCompanionBoardTokenPendingRef = useRef(new Set());
  useEffect(() => {
    if (isPlayer || !tableId) return;
    const charIds = new Set(
      activeElements.filter((e) => e.elementType === 'character').map((e) => e.instanceId),
    );
    for (const id of [...autoCompanionBoardTokenPendingRef.current]) {
      if (!charIds.has(id)) autoCompanionBoardTokenPendingRef.current.delete(id);
    }
    for (const el of activeElements) {
      if (el.elementType === 'character' && hasCompanionBoardToken(activeElements, el.instanceId)) {
        autoCompanionBoardTokenPendingRef.current.delete(el.instanceId);
      }
    }
    const missing = collectMissingCompanionBoardTokenElements(activeElements);
    const toSend = [];
    for (const row of missing) {
      const pid = row.parentInstanceId;
      if (autoCompanionBoardTokenPendingRef.current.has(pid)) continue;
      autoCompanionBoardTokenPendingRef.current.add(pid);
      toSend.push(row);
    }
    if (toSend.length === 0) return;
    sendOp({ op: 'add-elements', elements: toSend });
  }, [activeElements, isPlayer, tableId, sendOp]);

  /** V2 Phase 4: token move hooks (e.g. Cloaked, Attack of Opportunity) after map drag commit. */
  const handleTokenDragEnd = useCallback(
    ({ instanceId, previousTokenFt, postMoveActiveElements }) => {
      if (!postMoveActiveElements?.length || isPlayer) return;
      if (v2Registry && sessionPlayAllowed) {
        const { mutations } = runV2TokenMoveHooks(
          {
            moverInstanceId: instanceId,
            previousTokenFt: previousTokenFt || null,
            postMoveActiveElements,
            tableFeatureState,
            fearCount,
            mapConfig,
          },
          v2Registry
        );
        if (mutations?.length) {
          const { updates, actionLoopNotifications } = applyV2LifecycleMutations(postMoveActiveElements, mutations, undefined);
          if (updates.length > 0) {
            sendOp({ op: 'update-elements', updates });
          }
          for (const p of actionLoopNotifications) {
            const baseDesc = p.description || '';
            const actionText =
              p.affectedSummary && String(p.affectedSummary).trim()
                ? `${baseDesc}\n${p.affectedSummary}`
                : baseDesc;
            postActionNotification(
              withActionBannerSuppression(
                {
                  _action: true,
                  rollUser: 'Table',
                  actionName: p.title,
                  actionText,
                  _v2ActionLoop: true,
                  _reactorInstanceId: p.instanceId,
                  ...v2RollDieExtrasFromActionLoopPayload(p),
                  ...(Array.isArray(p.affectedNames) && p.affectedNames.length > 0
                    ? { _affectedNames: p.affectedNames, _affectedInstanceIds: p.affectedInstanceIds }
                    : {}),
                },
                { actionAdversaryTargets: actionAdversaryTargetsRef.current }
              ),
              tableId
            ).catch(() => {});
          }
        }
      }
      if (srdData && pendingBanners?.length && sessionPlayAllowed) {
        const moveUpdates = evaluateV2PendingMapMovesForMover(instanceId, {
          postMoveActiveElements,
          pendingBanners,
          srdData,
          fearCount,
          mapConfig,
          tableFeatureState,
        });
        if (moveUpdates.length > 0) {
          sendOp({ op: 'update-elements', updates: moveUpdates });
        }
      }
    },
    [v2Registry, isPlayer, sessionPlayAllowed, tableFeatureState, fearCount, mapConfig, sendOp, srdData, pendingBanners, tableId]
  );

  // Player action notification — fire-and-forget broadcast to GM room.
  const handlePlayerActionNotification = (notification) => {
    const payload = withActionBannerSuppression(notification, {
      actionAdversaryTargets: actionAdversaryTargetsRef.current,
    });
    if (!sessionPlayAllowed && !payload._sessionStart) {
      return;
    }
    dismissAllHoverCards();
    postActionNotification(payload, tableId).catch(() => {});
  };

  /** Adversary HP/stress: apply immediately (no GM-ack banner). Cancels stale manual-track banners for this instance. */
  const applyAdversaryManualTrackDirect = useCallback(
    async (instanceId, updates) => {
      if (!instanceId || !updates || Object.keys(updates).length === 0) return;
      dismissAllHoverCards();
      for (const r of pendingBanners || []) {
        if (r._manualTrackEdit && r._targetInstanceId === instanceId && r._rollDbId != null) {
          await postBannerAck(r._rollDbId, 'cancel', { tableId }).catch(() => {});
        }
      }
      updateActiveElement(instanceId, updates);
    },
    [pendingBanners, tableId, updateActiveElement]
  );

  // Concussive (weapon): spend 1 Hope to knock the damage target to Far range (50 ft from attacker).
  const handleConcussiveKnock = useCallback((roll, targetInstanceId) => {
    if (!roll?._attackerInstanceId || !targetInstanceId) return;
    const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
    if (!attackerEl || (attackerEl.hope ?? 0) < 1) return;
    updateActiveElement(roll._attackerInstanceId, { hope: Math.max(0, (attackerEl.hope ?? 0) - 1) });
    const targetEl = activeElements.find(e => e.instanceId === targetInstanceId);
    if (targetEl?.tokenX != null && targetEl?.tokenY != null && attackerEl.tokenX != null && attackerEl.tokenY != null) {
      const pos = positionAtDistanceFt(attackerEl.tokenX, attackerEl.tokenY, targetEl.tokenX, targetEl.tokenY, 50);
      updateActiveElement(targetInstanceId, { tokenX: pos.x, tokenY: pos.y });
    }
    const targetName = targetEl?.name ?? 'Target';
    handleActionNotification({ _action: true, rollUser: attackerEl.name ?? '', actionName: 'Concussive', actionText: `Concussive: ${targetName} knocked to Far range.` });
  }, [activeElements, updateActiveElement, handleActionNotification]);

  // Apply Hope/Fear side effects after the dice animation completes.
  // Separated from handleDaggerheartRoll so effects fire when the banner dismisses.
  const applyRollSideEffects = (dominant, rollUser) => {
    if (dominant === 'fear') {
      setFearCount(prev => Math.min(prev + 1, 12));
    } else if (dominant === 'hope' || dominant === 'critical') {
      const characters = activeElements.filter(el => el.elementType === 'character');
      if (!characters.length) return;

      const nameLower = (rollUser || '').toLowerCase().trim();
      // Exact match on name or playerName
      let match = characters.find(
        el => el.name?.toLowerCase() === nameLower || el.playerName?.toLowerCase() === nameLower
      );
      // Prefix match: rollUser might be "CharName TraitName AttackName" from optimistic rolls
      if (!match) {
        match = characters.find(
          el => (el.name && nameLower.startsWith(el.name.toLowerCase())) ||
                (el.playerName && nameLower.startsWith(el.playerName.toLowerCase()))
        );
      }
      // Fall back to the only character when there's exactly one and no name match.
      if (!match && characters.length === 1) match = characters[0];
      if (!match) return;

      const maxHope = match.maxHope ?? 6;
      // el.hope undefined means the track is at full but the field was never written — treat as maxHope.
      const currentHope = match.hope ?? maxHope;
      const newHope = Math.min(currentHope + 1, maxHope);
      // Always update and pulse, even if the increment is capped.
      const updates = { hope: newHope };
      if (dominant === 'critical') {
        const currentStress = match.currentStress ?? 0;
        updates.currentStress = Math.max(0, currentStress - 1);
      }
      updateActiveElement(match.instanceId, updates);
    }
  };

  // NOTE: handleRollResult removed — banners are driven purely by the pendingBanners
  // subscription. Roll handlers are fire-and-forget; the action log is populated in
  // app.jsx by the pendingBanners effect (new banners → new log entries).

  // Find the attacking character element from a roll user string.
  const findAttacker = (rollUser) => {
    const chars = activeElements.filter(el => el.elementType === 'character');
    const nameLower = (rollUser || '').toLowerCase().trim();
    let attacker = chars.find(el =>
      el.name?.toLowerCase() === nameLower || el.playerName?.toLowerCase() === nameLower
    );
    if (!attacker) attacker = chars.find(el =>
      (el.name && nameLower.startsWith(el.name.toLowerCase())) ||
      (el.playerName && nameLower.startsWith(el.playerName.toLowerCase()))
    );
    if (!attacker && chars.length === 1) attacker = chars[0];
    return attacker || null;
  };


  // Full reroll: cancel current banner and post the same roll again (shared by Human Adaptability and other features).
  // extraMeta is merged into the new roll (Adaptability applies stress on chip ack so passes {}).
  const performFullReroll = useCallback((roll, extraMeta = {}) => {
    if (roll._rollDbId) postBannerAck(roll._rollDbId, 'cancel', { tableId }).catch(() => {});
    if (!roll.rollText) return;
    const attacker = roll._attackerInstanceId
      ? activeElements.find(e => e.instanceId === roll._attackerInstanceId)
      : findAttacker(roll.rollUser);
    postRoll(roll.rollText, roll.rollUser ?? roll.displayName, isPlayer ? tableId : null, {
      _attackerInstanceId: attacker?.instanceId,
      ...extraMeta,
    }).catch(err => handleRollTransportError(err, 'Full reroll failed:'));
  }, [isPlayer, tableId, activeElements, postBannerAck, postRoll, handleRollTransportError]);

  // Quick: apply the same damage to a second target, marking 1 Stress on the attacker.
  const handleQuickTarget = async (target, dmgTotal, tags, roll, dmgType = '') => {
    await handleApplyDamage(target, dmgTotal, tags, roll, dmgType);
    const attacker = findAttacker(roll.rollUser);
    if (attacker?.elementType === 'character') {
      const stressCancel = await runBeforeMarkStress(attacker, 1, 'Quick', updateActiveElement, { postRollSilent, gmUid: isPlayer ? tableId : null, postAction: postActionForStress, characters: wrappedPartyCharacters, system });
      if (!stressCancel.cancel) {
        const effective = 1 - (stressCancel.reduceBy ?? 0);
        if (effective > 0) {
          const maxStress = attacker.maxStress ?? 6;
          const newStress = Math.min((attacker.currentStress ?? 0) + effective, maxStress);
          updateActiveElement(attacker.instanceId, { currentStress: newStress });
        }
      }
    }
  };

  // Bouncing: apply damage to an additional target and mark 1 Stress on the attacker.
  // Does NOT dismiss — banner stays in bouncingPhase for another target if desired.
  const handleBouncingTarget = async (target, dmgTotal, tags, roll, dmgType = '') => {
    await handleApplyDamage(target, dmgTotal, tags, roll, dmgType);
    const attacker = findAttacker(roll.rollUser);
    if (attacker?.elementType === 'character') {
      const stressCancel = await runBeforeMarkStress(attacker, 1, 'Bouncing', updateActiveElement, { postRollSilent, gmUid: isPlayer ? tableId : null, postAction: postActionForStress, characters: wrappedPartyCharacters, system });
      if (!stressCancel.cancel) {
        const effective = 1 - (stressCancel.reduceBy ?? 0);
        if (effective > 0) {
          const maxStress = attacker.maxStress ?? 6;
          const newStress = Math.min((attacker.currentStress ?? 0) + effective, maxStress);
          updateActiveElement(attacker.instanceId, { currentStress: newStress });
        }
      }
    }
  };

  // Not This Time (Wizard): Cancel the current banner, then reroll (fire-and-forget).
  // The 3 Hope cost is persisted as _notThisTimeHopeCost and applied on Acknowledge.
  const handleNotThisTime = (wizard, roll) => {
    const el = activeElements.find(e => e.instanceId === wizard.instanceId);
    if (!el) return;
    const maxHope = el.maxHope ?? 6;
    const currentHope = el.hope ?? maxHope;
    if (currentHope < 3) return;

    if (roll._rollDbId) postBannerAck(roll._rollDbId, 'cancel', { tableId }).catch(() => {});

    const rollText = roll.rollText;
    if (!rollText) return;

    postRoll(rollText, roll.rollUser, tableId, {
      _notThisTime: true, _wizardName: wizard.name,
      _notThisTimeHopeCost: 3,
      _wizardInstanceId: wizard.instanceId,
    }).catch(err => handleRollTransportError(err, 'Not This Time reroll failed:'));
  };

  // Origin lifecycle (e.g. Unshakable): post action banner with character name.
  const postActionForStress = (charEl, actionName, actionText) => {
    const notifier = isPlayer ? handlePlayerActionNotification : handleActionNotification;
    notifier({ _action: true, rollUser: charEl?.name ?? 'Character', actionName, actionText });
  };

  /**
   * Manual HP/Stress/Hope/Armor (and companion stress): apply to table state immediately, then post
   * an action banner for the log; Acknowledge only dismisses the banner.
   */
  const applyManualTrackUpdatesNow = useCallback(
    async (targetEl, u) => {
      const tid = targetEl?.instanceId;
      if (!tid || !u || Object.keys(u).length === 0) return { ok: false };
      const el = activeElements.find((e) => e.instanceId === tid);
      if (!el) return { ok: false };

      const uKeys = Object.keys(u);
      if (uKeys.length === 1 && uKeys[0] === 'companion' && u.companion != null && el.companion != null) {
        updateActiveElement(tid, { companion: { ...el.companion, ...u.companion } });
        return { ok: true };
      }

      if (u.currentHp !== undefined && el.elementType === 'character') {
        const prevHp = el.currentHp ?? el.maxHp ?? 0;
        const nextHp = u.currentHp;
        if (nextHp < prevHp) {
          const dmg = prevHp - nextHp;
          const hpCancel = runBeforeMarkHP(el, dmg, 'manual-track', updateActiveElement, { characters: wrappedPartyCharacters, system });
          if (hpCancel.cancel) return { ok: false };
        }
      }

      if (u.currentArmor !== undefined && el.elementType === 'character') {
        const prevA = el.currentArmor ?? 0;
        const nextA = u.currentArmor;
        if (nextA > prevA) {
          const armorCancel = runBeforeMarkArmor(el, nextA - prevA, 'manual-track', updateActiveElement, { characters: wrappedPartyCharacters, system });
          if (armorCancel.cancel) return { ok: false };
        }
      }

      let finalUpdates = { ...u };
      if (u.currentStress !== undefined && el.elementType === 'character') {
        const prevS = el.currentStress ?? 0;
        const nextS = u.currentStress;
        if (nextS > prevS) {
          const stressCancel = await runBeforeMarkStress(el, nextS - prevS, 'manual-track', updateActiveElement, {
            postRollSilent,
            gmUid: isPlayer ? tableId : null,
            postAction: postActionForStress,
            characters: wrappedPartyCharacters,
            system,
          });
          if (stressCancel.cancel) return { ok: false };
          const effective = nextS - prevS - (stressCancel.reduceBy ?? 0);
          const maxS = el.maxStress ?? 6;
          finalUpdates.currentStress = Math.min(prevS + Math.max(0, effective), maxS);
          const appliedDelta = finalUpdates.currentStress - prevS;
          if (appliedDelta > 0) {
            setPendingResourceCosts((prev) => reducePendingStressAfterManualMark(prev, tid, appliedDelta));
          }
        }
      }

      if (el.reinforcedActive && u.currentArmor != null && u.currentArmor < (el.currentArmor ?? 0)) {
        finalUpdates.reinforcedActive = false;
      }

      updateActiveElement(tid, finalUpdates);
      return { ok: true };
    },
    [
      activeElements,
      updateActiveElement,
      wrappedPartyCharacters,
      system,
      postRollSilent,
      isPlayer,
      tableId,
      postActionForStress,
    ]
  );

  const queueManualTrackEdit = useCallback(
    async (targetEl, updates) => {
      if (!targetEl?.instanceId || !updates || Object.keys(updates).length === 0) return;
      dismissAllHoverCards();
      for (const r of pendingBanners || []) {
        if (r._manualTrackEdit && r._targetInstanceId === targetEl.instanceId && r._rollDbId != null) {
          await postBannerAck(r._rollDbId, 'cancel', { tableId }).catch(() => {});
        }
      }
      const payload = buildManualTrackActionRoll(targetEl, updates);
      const { ok } = await applyManualTrackUpdatesNow(targetEl, updates);
      if (!ok) return;
      if (isPlayer) handlePlayerActionNotification(payload);
      else handleActionNotification(payload);
    },
    [pendingBanners, tableId, isPlayer, applyManualTrackUpdatesNow]
  );

  // Retracting Claws (Katari): apply Vulnerable to the selected adversary (no damage).
  const handleApplyVulnerable = (target) => {
    if (target?.type !== 'adversary') return;
    updateActiveElement(target.instanceId, { vulnerable: true });
  };

  // Ranger's Focus: end Focus to reroll Duality dice (Fear result vs Focus target). Clear focus, cancel banner, post new roll.
  const handleRangerFocusReroll = (roll) => {
    // Clear focusedBy on the adversary (source of truth; focusTargetId on Ranger may not be set).
    const focusTargetId = roll._selectedTargetInstanceId || null;
    if (focusTargetId) {
      const adv = activeElements.find(e => e.elementType === 'adversary' && e.instanceId === focusTargetId);
      if (adv) updateActiveElement(adv.instanceId, { focusedBy: null });
    }
    // Also clear focusTargetId on the Ranger if it happens to be set.
    if (roll._attackerInstanceId) {
      const ranger = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      if (ranger?.focusTargetId) updateActiveElement(ranger.instanceId, { focusTargetId: null });
    }
    if (roll._rollDbId) postBannerAck(roll._rollDbId, 'cancel', { tableId }).catch(() => {});
    if (!roll.rollText || !roll.subItems) return;
    postRerollDualityDice(roll).catch(err => console.error('Ranger Focus reroll failed:', err));
  };

  // Ranger's Focus: player toggles reroll request — sets or clears _rangerFocusRerollRequestedBy.
  const handleRangerFocusRerollRequest = (bannerId) => {
    if (tableId) {
      postBannerRangerFocusRerollRequest(tableId, bannerId)
        .then((res) => {
          if (res?.requested) onRangerFocusRerollRequestSuccess?.(bannerId);
          else onRangerFocusRerollRequestCancel?.(bannerId);
        })
        .catch(() => {});
    }
  };

  // Hold Them Off (Ranger): GM or player toggles "Spend 3 Hope to select two more targets" on the banner.
  const handleHoldThemOffToggle = (bannerId, active) => {
    if (tableId) {
      postBannerHoldThemOff(tableId, bannerId, active).catch(() => {});
    }
  };

  // Multi-target selection: GM or player changes selected targets or armor toggles (synced across clients).
  const handleBannerTargetsChange = (bannerId, patch) => {
    if (tableId) postBannerTargets(tableId, bannerId, patch).catch(() => {});
  };

  // Wings of Light (Winged Sentinel): GM clicks toggle — spend 1 Hope and roll 1d8, patch banner.
  const handleWingsD8Toggle = (bannerId) => {
    postBannerWingsD8(bannerId, tableId).catch(() => {});
  };

  // Wings of Light: Player toggles _wingsOfLightAddD8 on banner (shared state).
  const handleWingsD8ToggleRequest = (bannerId, value) => {
    if (tableId) postBannerWingsD8Toggle(tableId, bannerId, value).catch(() => {});
  };

  // Wings of Light: When applying damage and roll had _wingsOfLightAddD8 but no _wingsOfLightD8Result (player toggled), ack with wingsOfLightD8 to get d8 and return it.
  const getWingsD8Extra = async (roll) => {
    if (roll._wingsOfLightD8Result != null) return roll._wingsOfLightD8Result;
    const res = await postBannerAck(roll._rollDbId, 'acknowledge', { wingsOfLightD8: true, tableId });
    return res?.wingsOfLightD8Result ?? 0;
  };

  // Doubled Up: parse secondary weapon damage from the tag and apply to a second target.
  const handleDoubledUpTarget = (target, tags, roll) => {
    const doubledTag = (tags || []).find(t => t.name === 'Doubled Up');
    if (!doubledTag) return;
    const dmgMatch = doubledTag.text?.match(/^([^\s]+)/);
    if (!dmgMatch) return;
    // Parse the secondary damage dice expression from the tag and resolve it.
    // For simplicity, use the full damage string (e.g. "d6+3 phy") and just extract the dice part.
    const fullDmg = doubledTag.text.split('--')[0].trim();
    const dicePart = fullDmg.match(/^([^\s]+)/)?.[1] || '';
    // Roll the secondary weapon damage via server.
    const secRollText = `Doubled Up damage [${dicePart}]`;
    postRoll(secRollText, `${roll.rollUser} (Doubled Up)`, tableId).then(secRollData => {
      const secDamageSub = (secRollData.subItems || []).find(s => /damage/i.test(s.pre || '') && s.input);
      const secDmgTotal = secDamageSub ? parseInt(secDamageSub.result, 10) : 0;
      if (secDmgTotal > 0) {
        handleApplyDamage(target, secDmgTotal, [], secRollData);
      }
    }).catch(err => handleRollTransportError(err, 'Doubled Up roll failed:'));
  };

  /** Set roll.isSuccess from selected target (adversary: difficulty, character: evasion). Used by banner reactions and virtual-weapon onAcknowledge. */
  const enrichRollWithIsSuccess = (roll, elements) => {
    if (!roll._selectedTargetInstanceId) return;
    const target = elements?.find(e => e.instanceId === roll._selectedTargetInstanceId);
    if (!target) return;
    const isAdversary = target.elementType === 'adversary' || target.type === 'adversary';
    let defense = isAdversary
      ? target.difficulty
      : (effectiveEvasion(target, srdData) ?? target.evasion ?? null);
    if (!isAdversary) {
      const pending = sumPendingEvasionBonusFromFeatureState(target);
      if (pending > 0) defense = (defense ?? 0) + pending;
    }
    if (defense == null) return;
    let effectiveTotal = roll.total ?? 0;
    if (roll.dominant != null) {
      effectiveTotal += (roll._prayerAddRollDie?.value ?? 0);
    }
    roll.isSuccess = effectiveTotal >= defense;
  };

  // GM acknowledges a banner: apply all game side-effects, broadcast to other clients via banner-ack.
  // This is the unified replacement for handleDiceRollComplete + handlePlayerRollComplete.
  // options: { selectedLifeSupportTargetInstanceId?: string, selectedActionAdversaryTargetInstanceId?: string, selectedRetractingClawsTargetInstanceId?: string } for single-target selection.
  const handleBannerAcknowledge = async (bannerId, roll, options = {}) => {
    removePendingCosts(roll);

    if (roll._rollDbId != null) {
      const v2Clears = clearV2PendingMoveElementsForRoll(roll._rollDbId, activeElements, roll);
      if (v2Clears.length) {
        sendOp({ op: 'update-elements', updates: v2Clears });
      }
    }

    // Manual resource track edit: state was applied when the edit was made; ack only dismisses.
    if (roll._manualTrackEdit && roll._targetInstanceId && roll._manualUpdates) {
      if (roll._rollDbId) postBannerAck(roll._rollDbId, 'acknowledge', { tableId }).catch(() => {});
      return;
    }

    // Rest banner: server already applied fear on ack; run move onApply hooks, then clear rest-move state and run feature/rest cycle clear.
    if (roll._rest && roll._rollDbId) {
      postBannerAck(roll._rollDbId, 'acknowledge', { tableId }).catch(() => {});
      const perRoll = restMovesSelections[roll._rollDbId] || {};
      const restContext = {};
      for (const instanceId of Object.keys(perRoll)) {
        const charEl = activeElements.find(e => e.elementType === 'character' && e.instanceId === instanceId);
        if (!charEl) continue;
        const sel = perRoll[instanceId] || {};
        const charWrapped = wrapEntity(charEl, updateActiveElement);
        const slots = Object.keys(sel)
          .filter(k => /^move\d+$/.test(k) && sel[k])
          .map(k => parseInt(k.replace('move', ''), 10))
          .sort((a, b) => a - b);
        for (const slot of slots) {
          const moveId = sel['move' + slot];
          if (!moveId) continue;
          const def = getRestMoveDefinition(moveId);
          if (typeof def?.onApply !== 'function') continue;
          const targetInstanceId = sel['move' + slot + 'TargetInstanceId'];
          const targetEl = targetInstanceId
            ? activeElements.find(e => e.elementType === 'character' && e.instanceId === targetInstanceId)
            : charEl;
          const targetWrapped = targetEl ? wrapEntity(targetEl, updateActiveElement) : charWrapped;
          const rollResult = sel['move' + slot + 'RollResult'];
          const rollArg = rollResult ? { dice: rollResult.dice, value: rollResult.value } : {};
          def.onApply(restContext, rollArg, targetWrapped, charWrapped);
        }
      }
      if (onRestMoveClear) onRestMoveClear(roll._rollDbId);
      const cyclesToClear = roll._restDuration === 'long' ? ['rest', 'longRest'] : ['rest'];
      runRestCycleClear(cyclesToClear);
      return;
    }

    // Start Session banner: acknowledge, mark session active on table state, then run session clear + onSessionStart hooks.
    if (roll._sessionStart && roll._rollDbId) {
      postBannerAck(roll._rollDbId, 'acknowledge', { tableId }).catch(() => {});
      await postTableOp({ op: 'set-table-top', top: { sessionStarted: true, sessionPaused: false, lastPlayActivityAt: Date.now() } }, tableId);
      runSessionStartClear();
      return;
    }

    // Virtual weapon feature: apply stressCost/hopeCost then delegate to onAcknowledge if present.
    if (roll._featureNeedsTarget && options.selectedFeatureTargetInstanceId && roll._featureName) {
      const selfEl = roll._attackerInstanceId ? activeElements.find(e => e.instanceId === roll._attackerInstanceId) : null;
      const behavior = resolveVirtualWeaponBehavior(roll._featureName, selfEl);
      if (behavior) {
        const targetEl = activeElements.find(e => e.instanceId === options.selectedFeatureTargetInstanceId);
        const self = selfEl ? wrapEntity(selfEl, updateActiveElement) : null;
        if (targetEl) {
          if (self) {
            const n = Number(behavior.stressCost) || 0;
            if (n > 0) self.markStress(n);
            const h = Number(behavior.hopeCost) || 0;
            if (h > 0) self.spendHope(h);
          }
          if (typeof behavior.onAcknowledge === 'function') {
            if (!roll._selectedTargetInstanceId && options.selectedFeatureTargetInstanceId) {
              roll._selectedTargetInstanceId = options.selectedFeatureTargetInstanceId;
            }
            enrichRollWithIsSuccess(roll, activeElements);
            behavior.onAcknowledge({
              target: wrapEntity(targetEl, updateActiveElement),
              ...(selfEl && { self: wrapEntity(selfEl, updateActiveElement) }),
              roll: wrapRoll(roll),
            });
          }
        }
      }
    }

    // Weapon feature onBannerAck: run when GM accepts a roll that has damage and selected target(s).
    // Same semantic as "when GM accepts the banner" — unified with ancestry chip onBannerAck.
    const tagNames = (roll.tags || []).map(t => (typeof t === 'string' ? t : t?.name)).filter(Boolean);
    const targetIds = Array.isArray(roll._selectedTargetInstanceIds)
      ? roll._selectedTargetInstanceIds
      : (roll._selectedTargetInstanceId ? [roll._selectedTargetInstanceId] : []);
    if (tagNames.length > 0 && targetIds.length > 0) {
      const wr = wrapRoll(roll);
      const attackerEl = roll._attackerInstanceId
        ? activeElements.find(e => e.instanceId === roll._attackerInstanceId)
        : null;
      for (const name of tagNames) {
        const f = resolveWeaponOnBannerAckDescriptor(attackerEl, name);
        if (typeof f?.onBannerAck !== 'function') continue;
        for (const id of targetIds) {
          const targetEl = activeElements.find(e => e.instanceId === id);
          if (targetEl) f.onBannerAck({ roll: wr, target: wrapEntity(targetEl, updateActiveElement), system });
        }
      }
    }

    if (roll._action) {
      // V2 deferred card toggles (`gameTableDeferUntilBannerAck` + `isToggle`): engine `onUse` + costs on GM ack.
      const isV2DeferToggleAck =
        (roll._v2DeferUntilBannerAck === true && typeof roll._v2DeferToggleNext === 'boolean') ||
        roll._wingsOfLightFlightDefer === true;
      if (isV2DeferToggleAck && roll._attackerInstanceId && srdData && v2Registry) {
        const aid = roll._attackerInstanceId;
        const charEl = activeElements.find((e) => e.instanceId === aid && e.elementType === 'character');
        if (charEl) {
          const displayEl = mergeV2DeclarativeSheetOverlay(recomputeCharacter(charEl, srdData), charEl, srdData, {
            fearCount,
            mapConfig,
            tableFeatureState,
          });
          await applyDeferredV2ToggleOnAckFromRoll({
            roll,
            displayEl,
            el: charEl,
            activeElementsForV2Snapshots: activeElements,
            v2Registry,
            tableFeatureState,
            fearCount,
            mapConfig,
            tableId,
            onActionLoopNotification: handleActionNotification,
          });
        }
      }

      // Card toggle chips (e.g. Galapa Retract): state applies only on GM ack; banner was already posted on click.
      if (roll._cardToggle) {
        const ct = roll._cardToggle;
        const el = activeElements.find(e => e.instanceId === ct.instanceId);
        const descriptor = resolveOriginFeatureDescriptor(el, ct.featureName);
        const cardChips = descriptor?.chips?.filter(c => c.placement === 'card') || descriptor?.cardChips || [];
        const toggleChip = cardChips.find(c => typeof c.onToggle === 'function');
        if (el && toggleChip) {
          // Batch toggle key + onToggle effects (moveDisabledSources, resistance, disadvantageSources) into one op
          const batch = { [ct.derivedToggleKey]: ct.nextActive };
          const batchUpdate = (instanceId, updates) => { if (instanceId === ct.instanceId) Object.assign(batch, updates); };
          const character = wrapEntity(el, batchUpdate);
          const get = (key, defaultVal) => {
            const bag = el._originFeatureState?.[ct.featureName];
            return bag != null && key in bag ? bag[key] : defaultVal;
          };
          const set = (key, value) => {
            const current = el._originFeatureState ?? {};
            const featureBag = current[ct.featureName] ?? {};
            const next = { ...current, [ct.featureName]: { ...featureBag, [key]: value } };
            updateActiveElement(ct.instanceId, { _originFeatureState: next });
          };
          const featureObj = descriptor ? { ...descriptor, get, set } : { name: ct.featureName, source: ct.featureSource, get, set };
          const chip = { isActive: ct.nextActive };
          toggleChip.onToggle({ character, chip, feature: featureObj, characters: wrappedPartyCharacters, system });
          updateActiveElement(ct.instanceId, batch);
        } else {
          updateActiveElement(ct.instanceId, { [ct.derivedToggleKey]: ct.nextActive });
        }
      }

      // Apply feature costs for _featureUse action notifications
      let resourceAck = null;
      if (roll._featureUse && roll._attackerInstanceId) {
        const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);

        // Batch all updates from resource deduction + class feature activation into a single
        // update-elements op to avoid a race condition where two concurrent postTableOp calls
        // each read the same initial state and the last write overwrites the other.
        const batchMap = {}; // { instanceId: updates }
        const batchCollect = (id, upd) => { batchMap[id] = { ...(batchMap[id] || {}), ...upd }; };

        resourceAck = await applyFeatureResources(roll._attackerInstanceId, roll, batchCollect);

        // Dispatch class feature activation hook by feature name (e.g. Druid Beastform, Bard Make a Scene)
        if (attackerEl && roll._featureName) {
          const classFeat = resolveClassFeatureDescriptor(attackerEl, roll._featureName);
          if (classFeat?.onFeatureActivated && attackerEl.class === classFeat.class) {
            const selfEl = wrapEntity(attackerEl, batchCollect);
            // Action-with-adversary-target: pass selected adversary (e.g. Make a Scene difficultyMod)
            const actionAdversaryTargetId = options?.selectedActionAdversaryTargetInstanceId ?? roll._selectedTargetInstanceId ?? null;
            const targetEl = actionAdversaryTargetId
              ? activeElements.find(e => e.instanceId === actionAdversaryTargetId) ?? null
              : null;
            classFeat.onFeatureActivated({
              featureName: roll._featureName ?? null,
              subFeatureName: roll._subFeatureName ?? null,
              inputValue: roll._inputValue ?? null,
              targetEl,
              selfEl,
              updateActiveElement: batchCollect,
              roll: wrapRoll(roll, undefined, selfEl?.instanceId),
              characters: wrappedPartyCharacters,
              feature: classFeat,
              system,
            });
            if (roll._action && roll._targetType === 'adversary' && roll._rollDbId != null) {
              setActionAdversarySelections(prev => {
                const next = { ...prev };
                delete next[roll._rollDbId];
                return next;
              });
            }
          }
        }
        // Send all batched updates (resource costs + class feature effects) as one atomic op
        const batchEntries = Object.entries(batchMap);
        if (batchEntries.length > 0) {
          sendOp({ op: 'update-elements', updates: batchEntries.map(([id, upd]) => ({ instanceId: id, updates: upd })) });
        }
      }
      if (roll._attackerInstanceId) {
        const actionTagNames = new Set((roll.tags || []).map(t => t.name));
        const actionAttackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
        const actionAttacker = actionAttackerEl ? wrapEntity(actionAttackerEl, updateActiveElement) : null;
        if (actionAttackerEl?.activeFeatures?.length && actionTagNames.size > 0) {
          const weaponFeaturesForRoll = actionAttackerEl.activeFeatures.filter(f => f.type === 'weapon' && actionTagNames.has(f.name));
          runCharacterHook(weaponFeaturesForRoll, 'onRollComplete', { attacker: actionAttacker, roll, characters: wrappedPartyCharacters, system });
        }
      }
      // Rousing Speech: clear 2 Stress from each character within Far range.
      const rousingUpdates = [];
      if (roll._featureName === 'Rousing Speech' && roll._rousingSpeechTargets?.length > 0) {
        for (const t of roll._rousingSpeechTargets) {
          const targetEl = activeElements.find(e => e.instanceId === t.instanceId);
          if (!targetEl) continue;
          const newStress = Math.max(0, (targetEl.currentStress ?? 0) - 2);
          updateActiveElement(t.instanceId, { currentStress: newStress });
          rousingUpdates.push({ instanceId: t.instanceId, updates: { currentStress: newStress } });
        }
      }

      // Life Support: clear 1 HP on the selected ally (single target).
      const lifeSupportUpdates = [];
      if (roll._featureName === 'Life Support' && options.selectedLifeSupportTargetInstanceId) {
        const targetInstanceId = options.selectedLifeSupportTargetInstanceId;
        const targetEl = activeElements.find(e => e.instanceId === targetInstanceId);
        if (targetEl) {
          const maxHp = targetEl.maxHp ?? 0;
          const currentHp = targetEl.currentHp ?? maxHp;
          const newHp = Math.min(currentHp + 1, maxHp);
          updateActiveElement(targetInstanceId, { currentHp: newHp });
          lifeSupportUpdates.push({ instanceId: targetInstanceId, updates: { currentHp: newHp } });
        }
      }

      if (roll._lifeSupportTargets != null && onLifeSupportClear) onLifeSupportClear(roll._rollDbId);

      // Prayer Die: +Hope via ActionBanner — gain Hope and consume the die on GM ack.
      if (roll._prayerDieGainHope) {
        const { modId, value, instanceId } = roll._prayerDieGainHope;
        const charEl = activeElements.find(e => e.instanceId === instanceId);
        if (charEl) {
          const maxHope = charEl.maxHope ?? 6;
          const newHope = Math.min((charEl.hope ?? maxHope) + value, maxHope);
          const newMods = (charEl.activeModifiers || []).filter(m => m.id !== modId);
          updateActiveElement(instanceId, { hope: newHope, activeModifiers: newMods });
        }
      }

      postBannerAck(roll._rollDbId, 'acknowledge', { tableId }).catch(() => {});
      return;
    }

    // Prayer Dice: build _addModifiers from roll subItems — one chip per d4 result.
    // Chips have usageModes: ['gainHope']:
    //   'gainHope' → click +Hope to post ActionBanner; GM acks to gain Hope equal to die value.
    // Adding to a roll or reducing damage is handled directly in roll/damage banners via the
    // availablePrayerDice prop — no usageMode needed for those cases.
    if (roll._isPrayerDiceRoll && roll._attackerInstanceId && Array.isArray(roll.subItems) && roll.subItems.length > 0) {
      const baseId = `prayer-${roll._attackerInstanceId}-${Date.now()}`;
      roll._addModifiers = roll.subItems
        .map((sub, i) => {
          const val = parseInt(sub.result, 10);
          if (Number.isNaN(val)) return null;
          return {
            id: `${baseId}-${i}`,
            name: 'Prayer Die',
            value: val,
            dice: String(val),
            mode: 'roll',
            usageModes: ['gainHope'],
            consumeOnUse: true,
            refreshOn: 'session',
          };
        })
        .filter(Boolean);
    }

    // Apply feature costs for dice rolls (feature-use rolls and weapon rolls with costs e.g. Kick)
    let resourceAck = null;
    if (roll._attackerInstanceId && (roll._featureUse || (roll._stressCost > 0) || (roll._hopeCost > 0) || (roll._armorMark > 0) || (roll._armorClear > 0))) {
      resourceAck = await applyFeatureResources(roll._attackerInstanceId, roll);
    }
    // Remove consumed one-shot modifier (e.g. used via _usedModifierId in roll meta)
    if (roll._usedModifierId && roll._attackerInstanceId) {
      const modEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      if (modEl?.activeModifiers?.length > 0) {
        const kept = modEl.activeModifiers.filter(m => m.id !== roll._usedModifierId);
        if (kept.length !== modEl.activeModifiers.length) {
          updateActiveElement(roll._attackerInstanceId, { activeModifiers: kept });
        }
      }
    }
    // Apply deferred costs from Not This Time (3 Hope)
    if (roll._notThisTimeHopeCost > 0 && roll._wizardInstanceId) {
      const wizardEl = activeElements.find(e => e.instanceId === roll._wizardInstanceId);
      if (wizardEl) {
        const newHope = Math.max(0, (wizardEl.hope ?? wizardEl.maxHope ?? 6) - roll._notThisTimeHopeCost);
        updateActiveElement(roll._wizardInstanceId, { hope: newHope });
      }
    }
    // Hold Them Off (Ranger): 3 Hope when 2–3 targets selected (passed via options from ResultBanner).
    if (options.holdThemOffHopeCost > 0 && options.attackerInstanceId) {
      const attackerEl = activeElements.find(e => e.instanceId === options.attackerInstanceId);
      if (attackerEl) {
        const maxHope = attackerEl.maxHope ?? 6;
        const newHope = Math.max(0, (attackerEl.hope ?? maxHope) - options.holdThemOffHopeCost);
        updateActiveElement(options.attackerInstanceId, { hope: newHope });
      }
    }
    // Ranger's Focus: weapon roll with "Use on next attack" — deduct Hope
    if (roll._rangerFocusAttempt && roll._hopeCost > 0 && roll._attackerInstanceId) {
      const rangerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      if (rangerEl) {
        const maxHope = rangerEl.maxHope ?? 6;
        const current = rangerEl.hope ?? maxHope;
        updateActiveElement(roll._attackerInstanceId, { hope: Math.max(0, current - roll._hopeCost) });
      }
    }
    // Experience: deduct 1 Hope and clear selected experience when an experience was used in the roll.
    if (roll._experienceHopeCost > 0 && roll._attackerInstanceId) {
      const expAttackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      if (expAttackerEl) {
        const maxHope = expAttackerEl.maxHope ?? 6;
        const current = expAttackerEl.hope ?? maxHope;
        updateActiveElement(roll._attackerInstanceId, {
          hope: Math.max(0, current - roll._experienceHopeCost),
          selectedExperienceIndex: null,
        });
      }
    }
    // Dispatch onRollComplete for weapon features on the roll
    {
      const rollTagNames = new Set((roll.tags || []).map(t => t.name));
      const attackerEl = roll._attackerInstanceId
        ? activeElements.find(e => e.instanceId === roll._attackerInstanceId)
        : findAttacker(roll.rollUser);
      const attacker = attackerEl ? wrapEntity(attackerEl, updateActiveElement) : null;
      if (attackerEl?.activeFeatures?.length && rollTagNames.size > 0) {
        const weaponFeaturesForRoll = attackerEl.activeFeatures.filter(f => f.type === 'weapon' && rollTagNames.has(f.name));
        runCharacterHook(weaponFeaturesForRoll, 'onRollComplete', { attacker, roll, characters: wrappedPartyCharacters, system });
      }
    }
    // Fearless-style hope conversion (V2 review chips set chipHopeConvertedIds).
    let hopeConversionRequested = !!(roll._rollDbId != null && chipHopeConvertedIds.has(roll._rollDbId));
    if (hopeConversionRequested && roll._rollDbId != null) {
      setChipHopeConvertedIds(prev => { const next = new Set(prev); next.delete(roll._rollDbId); return next; });
    }
    if (hopeConversionRequested) {
      const attackerId = roll._attackerInstanceId;
      if (attackerId) {
        const attackerEl = activeElements.find(e => e.instanceId === attackerId);
        if (attackerEl) {
          const maxHope = attackerEl.maxHope ?? 6;
          const current = attackerEl.hope ?? maxHope;
          updateActiveElement(attackerId, { hope: Math.min(current + 1, maxHope) });
        }
      }
    } else {
      applyRollSideEffects(roll.dominant, roll.rollUser);
    }
    const dmgPending = pendingDamageRef.current;
    pendingDamageRef.current = null;
    if (dmgPending) {
      updateActiveElement(dmgPending.instanceId, { currentHp: dmgPending.newHp });
    }
    // Consume prayer dies selected in this roll — read from roll (server-authoritative shared state).
    // Deduplicate in case the same die was selected for both +Roll and -Dmg (rare but possible).
    const prayerDiesToConsume = [roll._prayerAddRollDie, roll._prayerDmgReduceDie]
      .filter(Boolean)
      .filter((die, idx, arr) => arr.findIndex(d => d.id === die.id) === idx);
    for (const die of prayerDiesToConsume) {
      const charEl = activeElements.find(e => e.instanceId === die.ownerInstanceId);
      if (charEl) {
        const newMods = (charEl.activeModifiers || []).filter(m => m.id !== die.id);
        updateActiveElement(die.ownerInstanceId, { activeModifiers: newMods });
      }
    }
    // Locked On (weapon): consume the lock when this attack (targeting the locked target) is acknowledged
    if (roll._attackerInstanceId) {
      const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      const locked = attackerEl?.lockedOnTargetInstanceId;
      if (locked != null) {
        const selectedId = roll._selectedTargetInstanceId ?? roll._selectedTargetInstanceIds?.[0];
        if (selectedId === locked) updateActiveElement(roll._attackerInstanceId, { lockedOnTargetInstanceId: null });
      }
    }
    if (!options?.alreadyAcked) {
      {
        const sel = roll._selectedTargetInstanceId ?? (Array.isArray(roll._selectedTargetInstanceIds) && roll._selectedTargetInstanceIds[0]);
        for (const el of activeElements) {
          if (el.elementType !== 'character') continue;
          const u = buildPendingEvasionBonusAckCleanupUpdates(el, sel);
          if (u) updateActiveElement(el.instanceId, u);
        }
      }
      postBannerAck(roll._rollDbId, 'acknowledge', { tableId }).catch(() => {});
    }
  };

  // GM cancels a banner: dismiss without any effects.
  const handleBannerCancel = (bannerId, roll) => {
    if (roll._rollDbId != null) {
      const v2Clears = clearV2PendingMoveElementsForRoll(roll._rollDbId, activeElements, roll);
      if (v2Clears.length) {
        sendOp({ op: 'update-elements', updates: v2Clears });
      }
    }
    if (roll._lifeSupportTargets != null && onLifeSupportClear) onLifeSupportClear(roll._rollDbId);
    if (roll._rest && roll._rollDbId != null && onRestMoveClear) onRestMoveClear(roll._rollDbId);
    removePendingCosts(roll);
    pendingDamageRef.current = null;
    postBannerAck(roll._rollDbId, 'cancel', { tableId }).catch(() => {});
  };

  /** GM: cancel every pending banner (same as Cancel on each card). */
  const handleCancelAllBanners = () => {
    const list = pendingBanners || [];
    if (list.length === 0) return;
    if (!window.confirm(`Cancel all ${list.length} pending banner${list.length === 1 ? '' : 's'}? No roll effects will apply.`)) return;
    for (const roll of [...list]) {
      if (roll._rollDbId == null) continue;
      handleBannerCancel(`sub-${roll._rollDbId}`, roll);
    }
  };

  // Keep for legacy calls (applyDamageToTarget, etc.) that still pass dmgPending on the old path
  const handleSpendHope = (instanceId) => {
    const el = activeElements.find(e => e.instanceId === instanceId);
    if (!el) return;
    const maxHope = el.maxHope ?? 6;
    const currentHope = el.hope ?? maxHope;
    const newHope = Math.max(0, currentHope - 1);
    updateActiveElement(instanceId, { hope: newHope, selectedExperienceIndex: null });
  };

  const handleUseHopeAbility = (instanceId) => {
    const el = activeElements.find(e => e.instanceId === instanceId);
    if (!el) return;
    const maxHope = el.maxHope ?? 6;
    const currentHope = el.hope ?? maxHope;
    if (currentHope < 3) return;
    updateActiveElement(instanceId, { hope: currentHope - 3, selectedExperienceIndex: null });
  };

  // ── Feature resource application ─────────────────────────────────────────────
  // Called on banner dismiss when roll._featureUse is true.
  // Applies Hope/Stress/Armor costs and marks feature as used.
  // Returns { instanceId, updates } when updates were applied (for including in dice-ack).
  // updateFn defaults to updateActiveElement (fire-and-forget postTableOp).
  // Pass a custom collector function to batch all updates into a single op.
  const applyFeatureResources = async (instanceId, roll, updateFn = updateActiveElement) => {
    const el = activeElements.find(e => e.instanceId === instanceId);
    if (!el) return null;
    const updates = {};

    if (roll._hopeCost > 0) {
      const useHopefulArmor = roll._hopefulArmorInsteadByInstanceId?.[instanceId];
      const hasHopeful = el.armorMods?.feature?.name === 'Hopeful' || el.armorFeatureName === 'Hopeful';
      const armorSlotsFree = (el.maxArmor ?? 0) - (el.currentArmor ?? 0);
      const substitute = useHopefulArmor && hasHopeful && armorSlotsFree > 0
        ? Math.min(roll._hopeCost, armorSlotsFree)
        : 0;
      if (substitute > 0) {
        updates.currentArmor = Math.min((el.currentArmor ?? 0) + substitute, el.maxArmor ?? 0);
      }
      const hopeToSpend = roll._hopeCost - substitute;
      if (hopeToSpend > 0) {
        const maxHope = el.maxHope ?? 6;
        const current = el.hope ?? maxHope;
        updates.hope = Math.max(0, current - hopeToSpend);
      }
    }
    if (roll._stressCost > 0) {
      const stressCancel = await runBeforeMarkStress(el, roll._stressCost, 'feature-use', updateActiveElement, { postRollSilent, gmUid: isPlayer ? tableId : null, postAction: postActionForStress, characters: wrappedPartyCharacters, system });
      if (!stressCancel.cancel) {
        const effective = roll._stressCost - (stressCancel.reduceBy ?? 0);
        if (effective > 0) {
          const maxStress = el.maxStress ?? 6;
          updates.currentStress = Math.min((el.currentStress ?? 0) + effective, maxStress);
        }
      }
    }
    if (roll._armorClear > 0) {
      updates.currentArmor = Math.max(0, (el.currentArmor ?? 0) - roll._armorClear);
    }
    if (roll._armorMark > 0) {
      const maxArmor = el.maxArmor ?? 0;
      updates.currentArmor = Math.min((el.currentArmor ?? 0) + roll._armorMark, maxArmor);
    }
    if (roll._featureKey && roll._frequency) {
      updates.featureUsage = {
        ...(el.featureUsage || {}),
        [roll._featureKey]: { used: true, cycle: roll._frequency },
      };
    }
    if (roll._roguesDodgeFeatureStateActivate) {
      const scope = roll._roguesDodgeFeatureStateScopeKey ?? ROGUE_CLASS_FEATURE_STATE_SCOPE;
      updates.featureState = {
        ...(el.featureState || {}),
        [scope]: { ...(el.featureState?.[scope] || {}), roguesDodgeActive: true },
      };
    }
    // Feature-specific modifier additions — attacker only (e.g. Prayer Dice d4 chips)
    if (roll._addModifiers?.length > 0) {
      const base = [...(el.activeModifiers || [])];
      for (const m of roll._addModifiers) {
        if (m && m.id != null && !base.some((x) => x.id === m.id)) base.push(m);
      }
      updates.activeModifiers = base;
    }
    if (Object.keys(updates).length > 0) {
      updateFn(instanceId, updates);
    }
    return Object.keys(updates).length > 0 ? { instanceId, updates } : null;
  };

  // Run session-start clear and ancestry hooks (used when GM acknowledges Start Session banner).
  const runSessionStartClear = () => {
    let sessionTableFeatureState = tableFeatureState;
    const charactersList = activeElements.filter(e => e.elementType === 'character');
    const cyclesToClear = ['session'];
    for (const char of charactersList) {
      const updates = {};
      if (char.featureUsage) {
        const nextUsage = { ...char.featureUsage };
        let changed = false;
        for (const [key, val] of Object.entries(nextUsage)) {
          if (cyclesToClear.includes(val.cycle)) {
            delete nextUsage[key];
            changed = true;
          }
        }
        if (changed) updates.featureUsage = nextUsage;
      }
      if (char.activeModifiers?.length > 0) {
        const kept = char.activeModifiers.filter(m => !cyclesToClear.includes(m.refreshOn));
        if (kept.length !== char.activeModifiers.length) updates.activeModifiers = kept;
      }
      if (char.featureState?.[RALLY_FEATURE_STATE_BAG_KEY]) {
        updates.featureState = stripRallyVolatileSessionKeys({ ...char.featureState });
      }
      if (Object.keys(updates).length > 0) {
        updateActiveElement(char.instanceId, updates);
      }
    }
    // Root `table_state.featureState` merges into banner snapshots; clear Rally volatile keys (mirrors `runSessionEndClear`).
    if (tableFeatureState?.[RALLY_FEATURE_STATE_BAG_KEY]) {
      const tf = stripRallyVolatileSessionKeys({ ...tableFeatureState });
      sessionTableFeatureState = tf;
      sendOp({ op: 'set-table-feature-state', featureState: tf });
    }
    // V2: `hooks.onSessionStart(table)` lives on registry rows; merged `activeFeatures` often omit `hooks`.
    if (v2Registry && srdData) {
      // SRD-derived fields (`spellcastTrait`, `traits`, `tier`) are often absent on raw table elements
      // but required by V2 `hooks.onSessionStart` (e.g. Seraph Prayer Dice count).
      let workingElements = activeElements.map((e) => {
        if (e.elementType !== 'character') return { ...e };
        const rec = recomputeCharacter(e, srdData);
        if (!rec || rec === e) return { ...e };
        return {
          ...e,
          spellcastTrait: rec.spellcastTrait ?? e.spellcastTrait,
          traits: rec.traits ?? e.traits,
          tier: rec.tier ?? e.tier,
        };
      });

      const resolveV2SessionStartDescriptor = (f) => {
        if (typeof f.onSessionStart === 'function') return null;
        const desc = v2ClassSubclassFeatureDescriptorsByName[f.name] || getV2OriginFeatureDescriptor(f.name);
        const hook = f.hooks?.onSessionStart ?? desc?.hooks?.onSessionStart;
        if (typeof hook !== 'function') return null;
        const sessionStartOnce = desc?.sessionStartOnce === true;
        return { hook, sessionStartOnce };
      };

      const applyElUpdates = (els, upd) => {
        const m = new Map(upd.map((u) => [u.instanceId, u.updates]));
        return els.map((el) => {
          const u = m.get(el.instanceId);
          return u ? { ...el, ...u } : el;
        });
      };

      const runV2Hook = (instanceId, resolved) => {
        const gameState = {
          fear: fearCount,
          mapConfig,
          top: { sessionStarted: true },
          activeElements: workingElements,
          featureState: mergeV2TableFeatureState(sessionTableFeatureState, workingElements),
          registry: v2Registry,
          _ownerInstanceId: instanceId,
        };
        const table = buildTableSnapshot(gameState);
        resolved.hook(table);
        const mutations = applyMutations(table);
        if (!mutations?.length) return;
        const { updates, actionLoopNotifications } = applyV2LifecycleMutations(workingElements, mutations, undefined);
        if (updates.length) {
          sendOp({ op: 'update-elements', updates });
          workingElements = applyElUpdates(workingElements, updates);
        }
        for (const p of actionLoopNotifications) {
          const baseDesc = p.description || '';
          const actionText =
            p.affectedSummary && String(p.affectedSummary).trim()
              ? `${baseDesc}\n${p.affectedSummary}`
              : baseDesc;
          postActionNotification(
            withActionBannerSuppression(
              {
                _action: true,
                rollUser: 'Table',
                actionName: p.title || 'Session start',
                actionText,
                _v2ActionLoop: true,
                _reactorInstanceId: p.instanceId,
                ...v2RollDieExtrasFromActionLoopPayload(p),
                ...(Array.isArray(p.affectedNames) && p.affectedNames.length > 0
                  ? { _affectedNames: p.affectedNames, _affectedInstanceIds: p.affectedInstanceIds }
                  : {}),
              },
              { actionAdversaryTargets: actionAdversaryTargetsRef.current }
            )
          ).catch(() => {});
        }
      };

      const onceDone = new Set();
      for (const char of charactersList) {
        for (const f of char.activeFeatures || []) {
          const t = f.type;
          if (t !== 'ancestry' && t !== 'community' && t !== 'class' && t !== 'subclass') continue;
          const r = resolveV2SessionStartDescriptor(f);
          if (!r || !r.sessionStartOnce) continue;
          if (onceDone.has(f.name)) continue;
          onceDone.add(f.name);
          runV2Hook(char.instanceId, r);
        }
      }
      for (const char of charactersList) {
        for (const f of char.activeFeatures || []) {
          const t = f.type;
          if (t !== 'ancestry' && t !== 'community' && t !== 'class' && t !== 'subclass') continue;
          const r = resolveV2SessionStartDescriptor(f);
          if (!r || r.sessionStartOnce) continue;
          runV2Hook(char.instanceId, r);
        }
      }
    }

    /** Legacy: top-level `onSessionStart` only (Phase 1). */
    const sessionByName = new Map();
    for (const char of charactersList) {
      for (const f of char.activeFeatures || []) {
        if (typeof f.onSessionStart !== 'function') continue;
        if (typeof f.hooks?.onSessionStart === 'function') continue;
        const t = f.type;
        if (t !== 'ancestry' && t !== 'community' && t !== 'class' && t !== 'subclass') continue;
        if (!sessionByName.has(f.name)) sessionByName.set(f.name, f);
      }
    }
    const getFeatureForCharacter = (el, featureName) => {
      const row = el.activeFeatures?.find((x) => x.name === featureName);
      const descriptor = row || {};
      const get = (key, defaultVal) => { const bag = el._originFeatureState?.[featureName]; return bag != null && key in bag ? bag[key] : defaultVal; };
      const set = (key, value) => {
        const current = el._originFeatureState ?? {};
        const next = { ...current, [featureName]: { ...(current[featureName] ?? {}), [key]: value } };
        updateActiveElement(el.instanceId, { _originFeatureState: next });
      };
      return { ...descriptor, get, set };
    };
    const wrappedCharacters = charactersList.map(el => wrapEntity(el, updateActiveElement));
    for (const [, descriptor] of sessionByName) {
      const hook = descriptor.onSessionStart;
      if (typeof hook !== 'function') continue;
      if (descriptor.sessionStartOnce) {
        hook({ feature: null, characters: wrappedCharacters, system });
      } else {
        const charsWithFeature = charactersList.filter((el) =>
          (el.activeFeatures || []).some(
            (af) =>
              af.name === descriptor.name &&
              typeof af.onSessionStart === 'function' &&
              typeof af.hooks?.onSessionStart !== 'function',
          )
        );
        for (const el of charsWithFeature) {
          hook({ feature: getFeatureForCharacter(el, descriptor.name), character: wrapEntity(el, updateActiveElement), characters: wrappedCharacters, system });
        }
      }
    }
  };

  /** GM End Session: clear Rally/session bags, optional V2 `onSessionEnd`, then persist `top.sessionStarted: false`. */
  const runSessionEndClear = () => {
    const charactersList = activeElements.filter((e) => e.elementType === 'character');
    const batchMap = {};
    for (const char of charactersList) {
      const updates = {};
      if (char.featureState?.[RALLY_FEATURE_STATE_BAG_KEY]) {
        updates.featureState = stripRallyVolatileSessionKeys({ ...char.featureState });
      }
      if (Object.keys(updates).length > 0) batchMap[char.instanceId] = updates;
    }
    if (Object.keys(batchMap).length > 0) {
      sendOp({
        op: 'update-elements',
        updates: Object.entries(batchMap).map(([instanceId, updates]) => ({ instanceId, updates })),
      });
    }
    if (tableFeatureState?.[RALLY_FEATURE_STATE_BAG_KEY]) {
      sendOp({ op: 'set-table-feature-state', featureState: stripRallyVolatileSessionKeys({ ...tableFeatureState }) });
    }
    if (v2Registry && srdData) {
      let workingElements = activeElements.map((e) => {
        if (e.elementType !== 'character') return { ...e };
        const rec = recomputeCharacter(e, srdData);
        if (!rec || rec === e) return { ...e };
        return {
          ...e,
          spellcastTrait: rec.spellcastTrait ?? e.spellcastTrait,
          traits: rec.traits ?? e.traits,
          tier: rec.tier ?? e.tier,
        };
      });
      const flat = [];
      for (const char of charactersList) {
        for (const f of char.activeFeatures || []) {
          const t = f.type;
          if (t !== 'ancestry' && t !== 'community' && t !== 'class' && t !== 'subclass') continue;
          if (typeof f.hooks?.onSessionEnd !== 'function') continue;
          flat.push({ ...f, _ownerInstanceId: char.instanceId });
        }
      }
      if (flat.length) {
        const gameState = {
          fear: fearCount,
          mapConfig,
          top: { sessionStarted: false },
          activeElements: workingElements,
          featureState: mergeV2TableFeatureState(tableFeatureState, workingElements),
          registry: v2Registry,
        };
        const { mutations: sessionEndMutations } = dispatchSessionEndHooks(gameState, flat);
        if (sessionEndMutations?.length) {
          const { updates } = applyV2LifecycleMutations(workingElements, sessionEndMutations, undefined);
          if (updates.length) sendOp({ op: 'update-elements', updates });
        }
      }
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm('End the session? You can use Start Session again when you are ready to play.')) return;
    runSessionEndClear();
    await postTableOp({ op: 'set-table-top', top: { sessionStarted: false, sessionPaused: false } }, tableId);
  };

  const handleResumeSession = async () => {
    await postTableOp({ op: 'set-table-top', top: { sessionPaused: false, lastPlayActivityAt: Date.now() } }, tableId);
  };

  // ── Session / Rest cycle handlers ────────────────────────────────────────────
  // Start Session: post action banner; clear + onSessionStart run when GM acknowledges.
  // Short/Long Rest: post 1d4 roll → RestBanner; clear runs on ack.
  const handleSessionCycle = (cycle) => {
    const label = cycle === 'session' ? 'Start Session'
      : cycle === 'rest' ? 'Short Rest'
      : 'Long Rest';

    if ((cycle === 'rest' || cycle === 'longRest') && !sessionPlayAllowed) {
      return;
    }

    if (cycle === 'rest' || cycle === 'longRest') {
      const displayName = user?.displayName || user?.email || 'GM';
      const actionText = cycle === 'rest'
        ? 'Short rest — choose your moves per character (some ancestries grant extra slots), then acknowledge to add Fear and refresh rest-use features.'
        : 'Long rest — choose your moves per character (some ancestries grant extra slots), then acknowledge to add Fear and refresh rest and long-rest features.';
      postRoll(' [1d4]', displayName, tableId, {
        _action: true,
        _rest: true,
        _restDuration: cycle === 'rest' ? 'short' : 'long',
        actionName: label,
        actionText,
      }).catch(err => handleRollTransportError(err, 'Rest roll failed:'));
      return;
    }

    // Start Session: post banner only; session reset runs on GM acknowledge.
    const cycleNotification = {
      _action: true,
      _sessionStart: true,
      rollUser: 'GM',
      actionName: label,
      actionText:
        'Start Session — acknowledge to reset **session-frequency feature uses**, clear **session-refresh modifiers** (e.g. Rally die tokens), refresh **Rally** pooled dice, and run **session-start hooks** (e.g. Seraph Prayer Dice pool).',
    };
    handleActionNotification(cycleNotification);
  };

  // Run the same character clear as session cycle (used when rest banner is acknowledged).
  const runRestCycleClear = (cyclesToClear) => {
    const charactersList = activeElements.filter(e => e.elementType === 'character');
    const batchMap = {};
    for (const char of charactersList) {
      const updates = {};
      if (char.featureUsage) {
        const nextUsage = { ...char.featureUsage };
        let changed = false;
        for (const [key, val] of Object.entries(nextUsage)) {
          if (cyclesToClear.includes(val.cycle)) {
            delete nextUsage[key];
            changed = true;
          }
        }
        if (changed) updates.featureUsage = nextUsage;
      }
      if (char.activeModifiers?.length > 0) {
        const kept = char.activeModifiers.filter(m => !cyclesToClear.includes(m.refreshOn));
        if (kept.length !== char.activeModifiers.length) updates.activeModifiers = kept;
      }
      // Warden channel + Rogue's Dodge: cleared via generic V2 `onRest` in `runV2RestHooksForTable` (batched below).
      // Shifting (armor): disadvantage until rest — clear on rest
      if (cyclesToClear.includes('rest') && Array.isArray(char.disadvantageSources) && char.disadvantageSources.includes(SHIFTING_DISADVANTAGE_SOURCE_ID)) {
        updates.disadvantageSources = char.disadvantageSources.filter(s => s !== SHIFTING_DISADVANTAGE_SOURCE_ID);
      }
      // Potion of Stability (rest) — clear `restBonusActive` on consumable scope bags after rest completes
      const strippedRest = stripConsumableRestBonusPending(char.featureState);
      if (strippedRest) updates.featureState = strippedRest;
      if (Object.keys(updates).length > 0) batchMap[char.instanceId] = updates;
    }
    if (cyclesToClear.includes('rest') && srdData) {
      const restDuration = cyclesToClear.includes('longRest') ? 'long' : 'short';
      const v2r = runV2RestHooksForTable({
        activeElements: charactersList,
        srdData,
        fearCount,
        mapConfig,
        tableFeatureState,
        restDuration,
      });
      const mergeFs = (a, b) => {
        if (!b) return a || {};
        const o = { ...(a || {}) };
        for (const [k, v] of Object.entries(b)) {
          if (v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object') {
            o[k] = { ...o[k], ...v };
          } else {
            o[k] = v;
          }
        }
        return o;
      };
      for (const { instanceId, updates } of v2r.updates || []) {
        if (!instanceId || !updates || Object.keys(updates).length === 0) continue;
        const prev = batchMap[instanceId] || {};
        const nextFs = mergeFs(prev.featureState, updates.featureState);
        batchMap[instanceId] = {
          ...prev,
          ...updates,
          ...(Object.keys(nextFs).length ? { featureState: nextFs } : {}),
        };
      }
    }
    if (Object.keys(batchMap).length > 0) {
      sendOp({ op: 'update-elements', updates: Object.entries(batchMap).map(([instanceId, updates]) => ({ instanceId, updates })) });
    }
  };

  // Track previous pendingBanners so removePendingCosts fires for non-initiating clients
  // when a banner disappears from the subscription snapshot (acknowledged or cancelled elsewhere).
  // Also flush V2 pending map move + movement locks (e.g. Kick freezeOther) so Cancel / player cancel
  // cannot leave stale moveDisabledSources if the dismiss handler ran with stale activeElements.
  const prevPendingRef = useRef([]);
  useEffect(() => {
    const prev = prevPendingRef.current;
    const current = pendingBanners;
    prev.forEach(roll => {
      if (!current.some(r => r._rollDbId === roll._rollDbId)) {
        removePendingCosts(roll);
        if (roll._rollDbId != null) {
          const v2Clears = clearV2PendingMoveElementsForRoll(roll._rollDbId, activeElements, roll);
          if (v2Clears.length) {
            sendOp({ op: 'update-elements', updates: v2Clears });
          }
        }
      }
    });
    prevPendingRef.current = current;
  }, [pendingBanners, activeElements, sendOp]);

  const pendingBannerDbIdsRef = useRef(new Set());
  const isFirstBannersSnapshotRef = useRef(true);

  const [collapsedSections, setCollapsedSections] = useState(() =>
    new Set(activeElements.length > 0 ? ['Defaults'] : [])
  );
  const toggleSection = (name) => setCollapsedSections(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  useEffect(() => {
    if (!gmMovesOverlay.isOpen) {
      setHoveredFeature(null);
      gmMovesPortalTooltip.hide();
    }
  }, [gmMovesOverlay.isOpen, gmMovesPortalTooltip.hide]);

  useEffect(() => {
    if (!gmMovesPortalTooltip.tooltip && hoveredFeature?.fromChip) {
      setHoveredFeature(null);
    }
  }, [gmMovesPortalTooltip.tooltip, hoveredFeature?.fromChip]);

  // Touch: dismiss GM feature overlay on tap outside
  useEffect(() => {
    if (!isTouch || !gmHoverOverlayActive) return;
    const handler = (e) => {
      if (
        gmFeatureOverlayRef.current && !gmFeatureOverlayRef.current.contains(e.target) &&
        gmMovesOverlay.overlayRef.current && !gmMovesOverlay.overlayRef.current.contains(e.target)
      ) {
        setGmHoverOverlayActive(false);
        setHoveredFeature(null);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    return () => document.removeEventListener('touchstart', handler);
  }, [isTouch, gmHoverOverlayActive]);

  const DEFAULT_BATTLE_MODS = { lessDifficult: false, slightlyMoreDangerous: false, damageBoostPlusOne: false, damageBoostD4: false, damageBoostStatic: false, moreDangerous: false };
  const effectiveMods = tableBattleMods || DEFAULT_BATTLE_MODS;

  const setDifficulty = (val) => {
    if (!setTableBattleMods) return;
    setTableBattleMods(prev => ({
      ...(prev || DEFAULT_BATTLE_MODS),
      lessDifficult: val === 'lessDifficult',
      slightlyMoreDangerous: val === 'slightlyMoreDangerous',
      moreDangerous: val === 'moreDangerous',
    }));
  };

  const setDamageBoost = (val) => {
    if (!setTableBattleMods) return;
    setTableBattleMods(prev => ({
      ...(prev || DEFAULT_BATTLE_MODS),
      damageBoostPlusOne: val === 'plusOne',
      damageBoostD4: val === 'd4',
      damageBoostStatic: val === 'static',
    }));
  };

  const tableDamageBoost = effectiveMods.damageBoostD4 ? 'd4' : effectiveMods.damageBoostStatic ? 'static' : effectiveMods.damageBoostPlusOne ? 'plusOne' : null;

  const gameTableBasePath = tableId ? `/table/${tableId}` : '/table';

  const handleAddEmptyNote = useCallback(() => {
    const id = generateId();
    void (async () => {
      const newEls = await addToTable({ id, name: 'Note', body: '' }, 'notes');
      const el = newEls?.[0];
      if (!el) return;
      navigate(`${gameTableBasePath}/notes/${id}`);
      setEditState({
        step: 'note',
        item: { id, name: 'Note', body: '' },
        baseElement: el,
      });
    })();
  }, [addToTable, navigate, gameTableBasePath]);

  const getAddCharacterAnchorRect = useCallback(() => {
    const el = addCharacterAnchorRef.current;
    if (!el) return { top: 140, bottom: 280 };
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  }, []);

  const openNewCharacterEditor = useCallback(
    async (opts = {}) => {
      const { pendingAiConcept } = opts;
      const newId = generateId();
      const stub = {
        id: newId,
        name: '',
        level: 1,
        baseTraits: {},
        hope: DEFAULT_CHARACTER_STARTING_HOPE,
        experiences: [
          { name: '', score: 2, id: generateId() },
          { name: '', score: 2, id: generateId() },
        ],
      };
      const rect = getAddCharacterAnchorRect();
      if (isPlayer && onPlayerAddCharacter) {
        const res = await onPlayerAddCharacter({ ...stub, elementType: 'character' });
        const newEl = res?.character;
        if (!newEl?.instanceId) return;
        navigate(`${gameTableBasePath}/characters/${stub.id}`, { replace: true });
        setEditState({
          step: 'form',
          item: stub,
          collection: 'characters',
          mode: 'new',
          baseElement: newEl,
          instances: [newEl],
          presentation: 'rightDrawer',
          ...(pendingAiConcept?.trim() ? { pendingCharacterAiConcept: pendingAiConcept.trim() } : {}),
        });
        characterOverlay.show({ element: newEl, top: rect.top, bottom: rect.bottom });
        return;
      }
      const newEls = await addToTable(stub, 'characters');
      const newEl = newEls?.[0];
      if (!newEl) return;
      navigate(`${gameTableBasePath}/characters/${stub.id}`, { replace: true });
      setEditState({
        step: 'form',
        item: stub,
        collection: 'characters',
        mode: 'new',
        baseElement: newEl,
        instances: [newEl],
        presentation: 'rightDrawer',
        ...(pendingAiConcept?.trim() ? { pendingCharacterAiConcept: pendingAiConcept.trim() } : {}),
      });
      characterOverlay.show({ element: newEl, top: rect.top, bottom: rect.bottom });
    },
    [
      addToTable,
      characterOverlay,
      gameTableBasePath,
      getAddCharacterAnchorRect,
      isPlayer,
      navigate,
      onPlayerAddCharacter,
    ],
  );

  const openNewAdversaryEditor = useCallback(
    async (opts = {}) => {
      const { pendingAiConcept, tier = 1, role = 'standard' } = opts;
      const stub = buildGameTableNewAdversaryStub(tier, role);
      const newEls = await addToTable(stub, 'adversaries');
      const newEl = newEls?.[0];
      if (!newEl) return;
      navigate(`${gameTableBasePath}/adversaries/${stub.id}`, { replace: true });
      setEditState({
        step: 'form',
        item: stub,
        collection: 'adversaries',
        mode: 'original',
        instances: [newEl],
        baseElement: newEl,
        ...(pendingAiConcept?.trim() ? { pendingAdversaryAiConcept: pendingAiConcept.trim() } : {}),
      });
    },
    [addToTable, gameTableBasePath, navigate],
  );

  const openNewEnvironmentEditor = useCallback(
    async (opts = {}) => {
      const { pendingAiConcept, tier = 1, type = 'exploration' } = opts;
      const stub = buildGameTableNewEnvironmentStub(tier, type);
      const newEls = await addToTable(stub, 'environments');
      const newEl = newEls?.[0];
      if (!newEl) return;
      navigate(`${gameTableBasePath}/environments/${stub.id}`, { replace: true });
      setEditState({
        step: 'form',
        item: stub,
        collection: 'environments',
        mode: 'original',
        instances: [newEl],
        baseElement: newEl,
        ...(pendingAiConcept?.trim() ? { pendingEnvironmentAiConcept: pendingAiConcept.trim() } : {}),
      });
    },
    [addToTable, gameTableBasePath, navigate],
  );

  // Deep-link: open modal when URL has /table/:collection/:id (e.g. refresh, back/forward, shared link)
  const { modalCollection, modalItemId } = route || {};
  useEffect(() => {
    if (!modalCollection || !modalItemId) return;
    if (modalCollection === 'notes') {
      if (editState?.step === 'note' && editState?.baseElement?.id === modalItemId) return;
      const baseElement = activeElements.find(e => e.elementType === 'note' && e.id === modalItemId);
      if (!baseElement) {
        navigate(gameTableBasePath, { replace: true });
        return;
      }
      setEditState({
        step: 'note',
        item: {
          id: baseElement.id,
          name: baseElement.name || 'Note',
          body: baseElement.body || '',
          imageUrl: baseElement.imageUrl || '',
          visibility: baseElement.visibility === 'gm' ? 'gm' : 'players',
        },
        baseElement,
      });
      return;
    }
    // Don't overwrite if user already opened via handleEditClick (choice or form)
    if (editState?.collection === modalCollection && editState?.baseElement?.id === modalItemId) {
      return;
    }
    const elType = COLLECTION_TO_ELEMENT_TYPE[modalCollection];
    if (!elType) return;
    const instances = activeElements.filter(e => e.elementType === elType && e.id === modalItemId);
    const baseElement = instances[0];
    if (!baseElement) {
      navigate(gameTableBasePath, { replace: true });
      return;
    }
    const canEditOriginal = isOwnItem(baseElement);
    let mode;
    let item;
    if (modalCollection === 'characters') {
      mode = resolveGameTableCharacterEditMode(baseElement, data?.characters, canEditOriginal);
      const inLibrary = mode !== 'new';
      item = inLibrary
        ? (data?.characters?.find(i => i.id === baseElement.id) || getItemData(baseElement))
        : getItemData(baseElement);
    } else {
      mode = canEditOriginal ? 'original' : 'copy';
      item = canEditOriginal
        ? (data[modalCollection]?.find(i => i.id === baseElement.id) || getItemData(baseElement))
        : getItemData(baseElement);
    }
    setEditState({
      step: 'form',
      item,
      collection: modalCollection,
      mode,
      instances,
      baseElement,
      presentation: modalCollection === 'characters' ? 'rightDrawer' : undefined,
    });
    if (modalCollection === 'characters') {
      characterOverlay.show({ element: baseElement, top: 100, bottom: 220 });
    }
    // characterOverlay.show is stable; including characterOverlay in deps would re-run every render if the hook returns a new object reference.
  }, [modalCollection, modalItemId, activeElements, data, editState?.collection, editState?.baseElement?.id, editState?.step, navigate, gameTableBasePath]);

  // Close modal when URL no longer has item (e.g. user pressed back).
  useEffect(() => {
    if (!modalCollection && !modalItemId && editState) {
      setEditState(null);
    }
  }, [modalCollection, modalItemId, editState]);

  const closeEditModal = () => {
    setEditState(null);
    navigate(gameTableBasePath, { replace: true });
  };

  /** Pinned sheet (hover overlay) vs character being edited — when they diverge, do not merge form into the sheet and close the editor. */
  const characterDrawerEditMismatch = useMemo(
    () => computeCharacterDrawerEditMismatch(editState, characterOverlay),
    [editState, characterOverlay.isOpen, characterOverlay.data?.element?.instanceId],
  );

  suppressCharacterOverlayOutsideDismissRef.current = shouldSuppressCharacterOverlayOutsideDismiss(
    editState,
    characterOverlay,
    characterDrawerEditMismatch,
  );

  useEffect(() => {
    if (!characterOverlay.isOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (suppressCharacterOverlayOutsideDismissRef.current) return;
      characterOverlay.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [characterOverlay.isOpen, characterOverlay.close]);

  useEffect(() => {
    if (!gmMovesOverlay.isOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      gmMovesOverlay.close();
      gmMovesPortalTooltip.hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gmMovesOverlay.isOpen, gmMovesOverlay.close, gmMovesPortalTooltip.hide]);

  useEffect(() => {
    if (characterDrawerEditMismatch) setCharacterDrawerChromeSync(null);
  }, [characterDrawerEditMismatch]);

  useLayoutEffect(() => {
    if (!characterDrawerEditMismatch) return;
    setEditState(null);
    navigate(gameTableBasePath, { replace: true });
  }, [characterDrawerEditMismatch, navigate, gameTableBasePath]);

  /** Opens the library character editor as a right-hand drawer (from CharacterHoverCard sheet). */
  const openTableCharacterEditor = useCallback((liveEl) => {
    if (!liveEl) return;
    if (liveEl.id) {
      const libraryItem = data.characters?.find(i => i.id === liveEl.id) || liveEl;
      navigate(`${gameTableBasePath}/characters/${liveEl.id}`);
      setEditState({
        step: 'form',
        item: libraryItem,
        collection: 'characters',
        mode: 'original',
        instances: [liveEl],
        baseElement: liveEl,
        presentation: 'rightDrawer',
      });
    } else {
      navigate(`${gameTableBasePath}/characters/${liveEl.instanceId}`);
      setEditState({
        step: 'form',
        item: liveEl,
        collection: 'characters',
        mode: 'copy',
        instances: [liveEl],
        baseElement: liveEl,
        presentation: 'rightDrawer',
      });
    }
  }, [data.characters, gameTableBasePath, navigate]);

  const handleAddPotentialAdversary = async (adversaryId) => {
    try {
      const result = await resolveItems({ adversaries: [adversaryId] });
      const adversary = result.adversaries?.[0];
      if (adversary) addToTable(adversary, 'adversaries');
    } catch (err) {
      console.warn('Failed to resolve potential adversary:', err);
    }
  };

  const handleEditClick = (instances, baseElement, collection) => {
    navigate(`${gameTableBasePath}/${collection}/${baseElement.id}`);
    const canEditOriginal = isOwnItem(baseElement);
    if (!canEditOriginal) {
      setEditState({ step: 'form', item: getItemData(baseElement), collection, mode: 'copy', instances, baseElement });
    } else {
      setEditState({ step: 'choice', instances, baseElement, collection });
    }
  };

  const handleChoiceEditCopy = () => {
    const { instances, baseElement, collection } = editState;
    setEditState({ step: 'form', item: getItemData(baseElement), collection, mode: 'copy', instances, baseElement });
  };

  const handleChoiceEditOriginal = () => {
    const { baseElement, collection } = editState;
    const libraryItem = data[collection]?.find(i => i.id === baseElement.id) || getItemData(baseElement);
    setEditState({ ...editState, step: 'form', item: libraryItem, mode: 'original' });
  };

  const handleEditFormSave = async (editedData) => {
    const { mode, collection, baseElement } = editState;
    setEditState(null);
    const itemWithId = { ...editedData, id: baseElement.id };
    if (mode === 'copy') {
      updateActiveElementsBaseData(
        el => el.id === baseElement.id,
        itemWithId
      );
    } else {
      const saved = await saveItem(collection, itemWithId);
      // Characters: saveItem mirrors library into activeElements. Adversaries/environments: same, using
      // server `saved` — then persist table blob (update-base-data op) with that row.
      if (collection !== 'characters' && saved) {
        updateActiveElementsBaseData(el => el.id === saved.id, saved);
      }
    }
  };

  const dismissAllHoverCards = () => {
    trackerOverlay.close();
    characterOverlay.close();
    potAdvOverlay.close();
    gmMovesOverlay.close();
    gmMovesPortalTooltip.hide();
    if (gmHoverHideTimer.current) { clearTimeout(gmHoverHideTimer.current); gmHoverHideTimer.current = null; }
    setHoveredFeature(null);
    setGmHoverOverlayActive(false);
  };

  const cancelPlayBlockedDialog = useCallback(() => {
    setPlayBlockedDialog((d) => {
      if (d?.kind === 'roll' && d.reject) d.reject(new Error('cancelled'));
      return null;
    });
  }, []);

  const confirmPlayBlockedDialog = useCallback(async (dlg) => {
    if (!dlg) return;
    setPlayBlockedDialog(null);
    if (dlg.kind === 'element') {
      pushTableElementUpdate(dlg.instanceId, dlg.updates, { bypassPrepGate: true });
    } else if (dlg.kind === 'roll') {
      try {
        const result = await postRollToServer(dlg.rollText, dlg.displayName, dlg.tid, {
          ...dlg.rollMeta,
          bypassPrepGate: true,
        });
        dlg.resolve?.(result);
      } catch (e) {
        dlg.reject?.(e);
      }
    } else if (dlg.kind === 'action') {
      dismissAllHoverCards();
      postActionNotification(
        withActionBannerSuppression(dlg.notification, {
          actionAdversaryTargets: actionAdversaryTargetsRef.current,
        }),
        tableId,
        { bypassPrepGate: true }
      ).catch(() => {});
    }
  }, [pushTableElementUpdate, postRollToServer, postActionNotification, dismissAllHoverCards]);

  const allowAllEditsAndConfirmPending = useCallback(() => {
    setPlayBlockedAllowAllEdits(true);
    if (playBlockedDialog) void confirmPlayBlockedDialog(playBlockedDialog);
  }, [playBlockedDialog, confirmPlayBlockedDialog]);

  const handleRoll = (feature, event) => {
    if (!feature._rollData && !feature._diceRoll) return;
    dismissAllHoverCards();
    let rollText;
    if (feature._rollData) {
      const { modifier, range, damage, trait } = feature._rollData;
      rollText = buildAttackRollText(feature.name, modifier, range, damage, trait, feature.sourceName);
    } else {
      const { patterns, includeAttack, attackModifier, attackDamage, attackTrait, attackRange } = feature._diceRoll;
      const parts = [`${feature.sourceName} ${feature.name}`];
      if (includeAttack) {
        const modStr = attackModifier >= 0 ? `+${attackModifier}` : `${attackModifier}`;
        parts.push(`Attack [1d20${modStr}]`);
      }
      if (attackDamage) {
        parts.push(attackTrait ? `damage [${attackDamage}] ${(attackTrait || '').toLowerCase()}` : `damage [${attackDamage}]`);
        if (attackRange) parts.push(attackRange);
      }
      patterns.forEach(p => parts.push(`[${p}]`));
      rollText = parts.join(' ');
    }
    const displayName = `${feature.sourceName} ${feature.name}`;
    // For GM Moves adversary attacks with a range: show in-place target picker if instances are on the map.
    if (feature._rollData?.range) {
      const instances = activeElements.filter(e => e.elementType === 'adversary' && e.id === feature.cardKey);
      const onMap = instances.filter(i => i.tokenX != null && i.tokenY != null);
      if (onMap.length >= 1) {
        const rangeFt = rangeBandNameToFt(feature._rollData.range);
        if (rangeFt != null) {
          const rollMeta = { _attackerType: 'adversary', _attackRangeFt: rangeFt };
          if (onMap.length === 1) rollMeta._attackerInstanceId = onMap[0].instanceId;
          else rollMeta._attackerInstanceIds = onMap.map(i => i.instanceId);
          const inRange = rollMeta._attackerInstanceIds?.length > 0
            ? getCharactersWithinRangeOfAny(activeElements, rollMeta._attackerInstanceIds, rangeFt)
            : getCharactersWithinRangeFt(activeElements, rollMeta._attackerInstanceId, rangeFt);
          const ids = new Set(inRange.map(c => c.instanceId));
          const validTargets = damageTargets.filter(t => t.type === 'character' && ids.has(t.instanceId));
          const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
          setAdversaryTargetMenu({ anchorRect, rollText, displayName, rollMeta, validTargets, rolledKey: `${feature.cardKey}|${feature.featureKey}` });
          return;
        }
      }
    }
    const key = `${feature.cardKey}|${feature.featureKey}`;
    postRoll(rollText, displayName, tableId).then(() => {
      setRolledKey(key);
      setTimeout(() => setRolledKey(prev => prev === key ? null : prev), 1500);
    }).catch(err => handleRollTransportError(err, 'Roll failed:'));
  };

  const handleCardRoll = (attackData, sourceName, attackerInstances, event) => {
    dismissAllHoverCards();
    const { name, modifier, range, damage, trait, patterns } = attackData;
    let rollText;
    if (patterns) {
      const parts = [`${sourceName} ${name}`];
      patterns.forEach(p => parts.push(`[${p}]`));
      rollText = parts.join(' ');
    } else {
      rollText = buildAttackRollText(name, modifier, range, damage, trait, sourceName);
    }
    const displayName = `${sourceName} ${name}`;
    let rollMeta = {};
    if (Array.isArray(attackerInstances) && attackerInstances.length > 0 && range) {
      const onMap = attackerInstances.filter(i => i.tokenX != null && i.tokenY != null);
      if (onMap.length >= 1) {
        const rangeFt = rangeBandNameToFt(range);
        if (rangeFt != null) {
          rollMeta._attackerType = 'adversary';
          rollMeta._attackRangeFt = rangeFt;
          if (onMap.length === 1) {
            rollMeta._attackerInstanceId = onMap[0].instanceId;
          } else {
            rollMeta._attackerInstanceIds = onMap.map(i => i.instanceId);
          }
        }
      }
    }
    if (rollMeta._attackRangeFt != null) {
      const inRange = rollMeta._attackerInstanceIds?.length > 0
        ? getCharactersWithinRangeOfAny(activeElements, rollMeta._attackerInstanceIds, rollMeta._attackRangeFt)
        : getCharactersWithinRangeFt(activeElements, rollMeta._attackerInstanceId, rollMeta._attackRangeFt);
      const ids = new Set(inRange.map(c => c.instanceId));
      const validTargets = damageTargets.filter(t => t.type === 'character' && ids.has(t.instanceId));
      const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
      setAdversaryTargetMenu({ anchorRect, rollText, displayName, rollMeta, validTargets });
      return;
    }
    postRoll(rollText, displayName, tableId, Object.keys(rollMeta).length ? rollMeta : undefined).catch(err => handleRollTransportError(err, 'Roll failed:'));
  };

  const handleTraitRoll = (rollText, displayName, rollMeta = {}) => {
    dismissAllHoverCards();
    postRoll(rollText, displayName || rollText, tableId, rollMeta)
      .catch(err => handleRollTransportError(err, 'Trait roll failed:'));
  };

  // Roll handler for a player acting on their own character.
  // Routes through POST /api/room/:gmUid/roll (validated server-side, real dice).
    // When context.characterEl is provided, collects preroll chips from origin features; if any chips are added,
  // shows a pre-roll banner instead of posting immediately.
  const handlePlayerOwnRoll = (rollText, displayName, rollMeta = {}, context = null) => {
    // GM uses /api/room/my/roll (tableId=null) so server uses req.uid and banner subscription key matches; player uses table-scoped endpoint.
    const targetTableId = isPlayer ? tableId : null;
    const meta = { ...rollMeta, _playerInitiated: true };

    // Resolve character from activeElements so we have latest runtime (e.g. disadvantageSources from Galapa Retract).
    const contextChar = context?.characterEl;
    const characterEl = contextChar && contextChar.instanceId
      ? (activeElements.find(e => e.instanceId === contextChar.instanceId) || contextChar)
      : (rollMeta._attackerInstanceId
          ? activeElements.find(e => e.instanceId === rollMeta._attackerInstanceId && e.elementType === 'character')
          : null) || contextChar;

    if (!characterEl) {
      dismissAllHoverCards();
      postRoll(rollText, displayName || rollText, targetTableId, meta)
        .catch(err => handleRollTransportError(err, 'Player roll failed:'));
      return;
    }

    /** Merged sheet (incl. beastform synthetic `activeFeatures` / advantageTriggers) — read-only for preroll chip collection; keep `characterEl` for persisted state. */
    const characterElForIntent =
      srdData && characterEl.instanceId
        ? mergeV2DeclarativeSheetOverlay(recomputeCharacter(characterEl, srdData), characterEl, srdData, {
            fearCount,
            mapConfig,
            tableFeatureState,
          })
        : characterEl;

    let textToUse = rollText;
    if (characterEl.disadvantageSources?.length > 0) {
      textToUse = insertDisadvantageD6(textToUse, characterEl.disadvantageSources[0]);
    }
    const advantageNames = [];
    const disadvantageNames = [];
    const pending = { rollText: textToUse, displayName, meta, rollBonus: 0, rollBonusLabel: null };
    const rollWrapper = {
      get rollText() { return pending.rollText; },
      set rollText(v) { pending.rollText = v; },
      get displayName() { return pending.displayName; },
      set displayName(v) { pending.displayName = v; },
      get meta() { return pending.meta; },
      get _traitKey() { return pending.meta?._traitKey; },
      isMine: true,
      isReaction: !!rollMeta._isReaction,
      addAdvantageDie(name) {
        advantageNames.push(name);
      },
      addDisadvantage(name) {
        disadvantageNames.push(name);
      },
      /**
       * Remove all disadvantage from this roll (undo addDisadvantage, strip disadvantage from roll text,
       * including GM-set difficulty disadvantage) and append a message to the roll string.
       * Used by e.g. Goblin Surefooted (ignore disadvantage on Agility rolls).
       */
      removeDisadvantage() {
        const fromGM = [...disadvantageNames];
        disadvantageNames.length = 0;
        const { strippedText, removedLabels } = stripDisadvantageFromRollText(pending.rollText);
        pending.rollText = strippedText;
        const allRemoved = [...fromGM, ...removedLabels];
        if (allRemoved.length > 0) {
          pending.rollText = pending.rollText.trimEnd() + ` — disadvantage removed: ${allRemoved.join(', ')}`;
        }
      },
      addRollBonus(n) {
        pending.rollBonus = (pending.rollBonus || 0) + n;
      },
      setFromText(text) {
        pending.rollText = text ?? pending.rollText;
      },
      setDisplayName(name) {
        pending.displayName = name ?? pending.displayName;
      },
      setMeta(m) {
        if (m != null) pending.meta = { ...pending.meta, ...m };
      },
      getFinalRollText() {
        let t = pending.rollText;
        if (advantageNames.length > 0) {
          t += advantageNames.length === 1
            ? ` ${advantageNames[0]} [d6]`
            : ` ${advantageNames.join(' and ')} [${advantageNames.length}d6kh]`;
        }
        if (pending.rollBonus) t += ` + ${pending.rollBonus}`;
        for (const name of disadvantageNames) {
          t = insertDisadvantageD6(t, name);
        }
        return t;
      },
    };

    const canvas = { chips: [] };
    canvas.isUsed = (featureKey) => !!(characterEl.featureUsage?.[featureKey]?.used);
    canvas.addChip = (descriptor) => {
      const featureName = descriptor._featureName;
      const merged = { ...descriptor, _featureName: featureName };
      const hadCustomIsVisible = typeof descriptor.isVisible === 'function';
      if (merged.resetsOn) {
        if (featureName) {
          const originList = [...(characterEl.ancestryFeatures || []), ...(characterEl.communityFeatures || [])];
          merged._featureKey = `${featureName}-${Math.max(0, originList.findIndex(f => f.name === featureName))}`;
        } else {
          merged._featureKey = null;
        }
        if (!hadCustomIsVisible) {
          merged.isVisible = (r) => r.isMine && merged._featureKey != null && !canvas.isUsed(merged._featureKey);
        }
        merged._used = !!(merged._featureKey && canvas.isUsed(merged._featureKey));
      }
      const featureReader = { get(key, d) { const bag = characterEl._originFeatureState?.[featureName]; return bag != null && key in bag ? bag[key] : d; } };
      const baseDescriptor = featureName ? resolveOriginFeatureDescriptor(characterEl, featureName) : null;
      const featureWithState = baseDescriptor && getFeatureStateFor
        ? { ...baseDescriptor, ...getFeatureStateFor(characterEl, featureName) }
        : (getFeatureStateFor && featureName ? getFeatureStateFor(characterEl, featureName) : { get: () => undefined, set: () => {} });
      const character = wrapEntity(characterEl, updateActiveElement);
      const canvasContext = { roll: rollWrapper, character, characters: wrappedPartyCharacters, system, feature: featureWithState };
      // Backward compatible: support legacy (roll, featureState, context?) signature
      const isVisibleResult = typeof merged.isVisible === 'function' 
        ? (merged.isVisible.length === 1 ? merged.isVisible(canvasContext) : merged.isVisible(rollWrapper, featureReader, canvasContext))
        : true;
      // When isVisible returns a number N > 0, add N copies of the chip (each can be toggled and onUse called).
      const count = typeof isVisibleResult === 'number' && isVisibleResult > 0
        ? Math.floor(isVisibleResult)
        : (isVisibleResult ? 1 : 0);
      if (count === 0 && typeof merged.isVisible === 'function' && hadCustomIsVisible) return;
      for (let i = 0; i < count; i++) canvas.chips.push({ ...merged });
    };

    // GM-initiated character roll: add difficulty chip so banner is shown and GM can set DC before rolling.
    // Skip for attack rolls (weapon/beastform/feature-with-target); those use the target's difficulty or evasion.
    const isAttackRoll = (meta) => (meta._weaponRangeFt != null || meta._featureNeedsTarget === true);
    if (!isPlayer && !isAttackRoll(meta)) {
      canvas.chips.push({ _difficultyChip: true, label: 'Difficulty (optional)' });
    }

    const getFeatureStateFor = (el, featureName) => {
      const get = (key, defaultVal) => {
        const bag = el._originFeatureState?.[featureName];
        return bag != null && key in bag ? bag[key] : defaultVal;
      };
      const set = (key, value) => {
        const current = el._originFeatureState ?? {};
        const featureBag = current[featureName] ?? {};
        const next = { ...current, [featureName]: { ...featureBag, [key]: value } };
        el._originFeatureState = next;
        updateActiveElement(el.instanceId, { _originFeatureState: next });
      };
      return { get, set };
    };
    // Collect pre-roll chips from declarative chips array (placement: 'preroll').
    if (Array.isArray(characterElForIntent.activeFeatures) && characterElForIntent.activeFeatures.length > 0) {
      for (const feature of characterElForIntent.activeFeatures) {
        const prerollChips = feature.chips?.filter(c => c.placement === 'preroll') || [];
        for (const c of prerollChips) {
          canvas.addChip({ ...c, _featureName: feature.name });
        }
      }
    } else {
      const featureNames = [...(characterElForIntent.ancestryFeatures || []).map(f => f.name), ...(characterElForIntent.communityFeatures || []).map(f => f.name)];
      for (const name of featureNames) {
        const descriptor = resolveOriginFeatureDescriptor(characterElForIntent, name);
        const prerollChips = descriptor?.chips?.filter(c => c.placement === 'preroll') || [];
        for (const c of prerollChips) {
          canvas.addChip({ ...c, _featureName: name });
        }
      }
    }

    for (const advChip of buildAdvantageTriggerPrerollChips(characterElForIntent, {
      resolveOriginFeatureDescriptor,
      resolveClassFeatureDescriptor,
      resolveWeaponTagDescriptor,
    })) {
      canvas.addChip(advChip);
    }

    if (srdData && meta._intentPanelForActionRoll === true) {
      const tableChars = activeElements.filter((e) => e.elementType === 'character');
      const { viewer } = buildV2ChipViewer({
        isPlayer,
        user,
        playerEmail,
        previewAsPlayerEmail,
        tableCharacters: tableChars,
      });
      const v2WeaponIntent = collectV2WeaponIntentChips({
        pendingMeta: meta,
        pendingRollText: textToUse,
        characterEl: characterElForIntent,
        activeElements,
        srdData,
        fearCount,
        mapConfig,
        tableFeatureState,
        viewer,
      });
      for (const c of v2WeaponIntent) {
        canvas.chips.push(c);
      }
    }

    const intentMandatory = meta._intentPanelForActionRoll === true;
    if (canvas.chips.length === 0 && !intentMandatory) {
      const tkFast = pending.meta?._traitKey;
      if (tkFast && characterEl?.instanceId && srdData) {
        const intentMuts = runV2IntentPhaseForTraitRoll({
          traitKey: tkFast,
          actorInstanceId: characterEl.instanceId,
          activeElements,
          srdData,
          fearCount,
          mapConfig,
          tableFeatureState,
        });
        for (const m of intentMuts) {
          if (m?.type === 'addAdvantageDie' && m.payload?.name) {
            rollWrapper.addAdvantageDie(m.payload.name);
          }
        }
      }
      const onRollCtx = {
        roll: rollWrapper,
        characters: wrappedPartyCharacters,
        system,
        character: wrapEntity(characterEl, updateActiveElement),
        updateActiveElement,
        _characterEl: characterEl,
      };
      if (Array.isArray(characterEl.activeFeatures) && characterEl.activeFeatures.length > 0) {
        runCharacterHook(characterEl.activeFeatures, 'onRoll', onRollCtx);
      } else {
        const originNames = [...(characterEl.ancestryFeatures || []).map(f => f.name), ...(characterEl.communityFeatures || []).map(f => f.name)];
        const originRows = originNames.map((n) => resolveOriginFeatureDescriptor(characterEl, n)).filter(Boolean);
        if (originRows.length) {
          runCharacterHook(originRows, 'onRoll', onRollCtx);
        }
      }
      const metaWithLabel = { ...pending.meta, ...(pending.rollBonusLabel ? { _staticModifierLabel: pending.rollBonusLabel } : {}) };
      dismissAllHoverCards();
      postRoll(rollWrapper.getFinalRollText(), pending.displayName || rollText, targetTableId, metaWithLabel)
        .catch(err => handleRollTransportError(err, 'Player roll failed:'));
      return;
    }

    const onProceed = async () => {
      const finalText = rollWrapper.getFinalRollText();
      const metaWithLabel = { ...pending.meta, ...(pending.rollBonusLabel ? { _staticModifierLabel: pending.rollBonusLabel } : {}) };
      try {
        await postRoll(finalText, pending.displayName || pending.rollText, targetTableId, metaWithLabel);
        setPreRollBanner(null);
        setSelectedPreRollChips([]);
      } catch (err) {
        handleRollTransportError(err, '[GMTableView] onProceed postRoll failed:');
      }
    };
    dismissAllHoverCards();
    setPreRollExperienceIndex(null);
    setPreRollCompanionExperienceIndex(null);
    setPreRollBanner({ rollWrapper, chips: canvas.chips, characterEl, onProceed, getFeatureStateFor, pending });
    setSelectedPreRollChips(canvas.chips.map(() => false));

    // Broadcast the intent to the GM so they can see the pre-roll banner too.
    // Serialize chips to plain objects (strip functions) for JSON transport.
    if (isPlayer && tableId) {
      const serializableChips = canvas.chips
        .filter(c => !c._difficultyChip)
        .map(c => ({
          label: c.label || c.name || c._featureName || '',
          description: c.description || '',
          hopeCost: c.hopeCost || 0,
          stressCost: c.stressCost || 0,
          frequency: c.frequency || null,
          isToggle: c.isToggle || false,
          v2Intent: !!c._v2IntentChip,
        }));
      postPlayerIntent(tableId, {
        characterName: characterEl?.name || '',
        characterInstanceId: characterEl?.instanceId || '',
        rollText: pending.rollText,
        chips: serializableChips,
      });
    }
  };

  /** V2 `isToggle` card chips on sidebar character cards (GM; assigned players on their own card — same path as hover sheet). */
  const handleCharacterPanelV2CardChip = useCallback(
    (characterEl, displayEl) => (payload) => {
      if (!tableId || !v2Registry) return;
      const isOwner =
        !isPlayer ||
        (playerEmail != null && characterEl?.assignedPlayerEmail === playerEmail) ||
        (user?.uid != null && characterEl?.assignedPlayerUid === user.uid);
      if (!isOwner) return;
      const isMyCharacter = playerEmail != null && characterEl?.assignedPlayerEmail === playerEmail;
      const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(
        sessionPlayAllowed,
        isPlayer,
        !isPlayer ? true : isMyCharacter,
      );
      if (!sheetOwner) return;
      const usePlayerTablePath = isPlayer;
      void runV2OwnedCardChipTableAction({
        featRow: payload.featRow,
        chip: payload.chip,
        passedFeatureKey: payload.featureKey,
        selectOpts: payload.selectOpts,
        placementShape: payload.placementShape,
        displayEl,
        el: characterEl,
        activeElementsForV2Snapshots: activeElements,
        v2Registry,
        tableFeatureState,
        fearCount,
        mapConfig,
        tableId,
        onActionLoopNotification: usePlayerTablePath ? handlePlayerActionNotification : handleActionNotification,
        onRoll: allowPlayMechanics
          ? (rollPayload) =>
              handlePlayerOwnRoll(
                rollPayload.rollText,
                rollPayload.displayName || characterEl?.name,
                rollPayload.rollMeta || {},
                { characterEl }
              )
          : undefined,
        isPlayer: usePlayerTablePath,
      });
    },
    [
      isPlayer,
      playerEmail,
      user?.uid,
      sessionPlayAllowed,
      tableId,
      v2Registry,
      activeElements,
      tableFeatureState,
      fearCount,
      mapConfig,
      handleActionNotification,
      handlePlayerActionNotification,
      handlePlayerOwnRoll,
    ]
  );

  /** Weapon roll from player adversary map pin — target is the pinned adversary (skips in-sheet target menu). */
  const handlePlayerAdversaryPinWeaponClick = useCallback(
    (characterEl, displayChar, adversaryEl, weapon, rollMeta = {}) => {
      if (!sessionPlayAllowed) return;
      const el = displayChar;
      const traits = el.traits || {};
      const traitKey = (weapon.trait || '').toLowerCase();
      const baseTrait = traits[traitKey] ?? 0;
      const bfBonus = parseBeastformBonus(el.activeBeastform?.trait_bonus);
      const beastExtra = bfBonus?.stat === traitKey ? bfBonus.bonus : 0;
      const effectiveTrait = baseTrait + beastExtra;
      const opts = {};
      if (rollMeta.devastating) opts.devastating = true;
      if (rollMeta.secondaryDamage) opts.secondaryDamage = rollMeta.secondaryDamage;
      let damageStr = weapon.damage;
      if (weapon.damageProficiency && el.proficiency != null) {
        const base = weapon.damage || 'd8';
        const prof = el.proficiency ? `+${el.proficiency}` : '';
        const type = (weapon.damageType || '').toLowerCase();
        damageStr = `${base}${prof}${type ? ' ' + type : ''}`;
      }
      let rollText = buildWeaponRollText(
        el.name,
        weapon.name,
        traitKey,
        effectiveTrait,
        null,
        damageStr,
        weapon.feature,
        traits,
        el.level,
        opts,
        rollMeta,
        el,
      );
      const rangeStr = getEffectiveWeaponRange(weapon, el.ancestryFeatures) || weapon.effectiveRange || weapon.range;
      if (rangeStr) rollText += ` ${rangeStr}`;
      const displayName = `${el.name} ${weapon.name}`;
      const meta = {
        ...rollMeta,
        _attackerInstanceId: el.instanceId,
        _traitKey: traitKey,
        _intentPanelForActionRoll: true,
        _deferExperienceToPreRoll: true,
        _selectedTargetInstanceId: adversaryEl.instanceId,
      };
      if (rangeStr) {
        const ft = rangeBandNameToFt(rangeStr);
        if (ft != null) meta._weaponRangeFt = ft;
      }
      if (weapon.id != null) meta._weaponId = weapon.id;
      if (weapon.multiTarget) {
        meta._multiTarget = true;
        if (weapon.multiTargetMax != null) meta._multiTargetMax = weapon.multiTargetMax;
      }
      handlePlayerOwnRoll(rollText, displayName, meta, { characterEl: el });
    },
    [sessionPlayAllowed, handlePlayerOwnRoll],
  );

  const clearPreRollBanner = () => {
    setPreRollBanner(null);
    setSelectedPreRollChips([]);
    setPreRollExperienceIndex(null);
    setPreRollCompanionExperienceIndex(null);
    setPreRollAdvantages([]);
    setPreRollDisadvantages([]);
    setPreRollTargetInstanceId(null);
    if (isPlayer && tableId) clearPlayerIntent(tableId);
  };

  useEffect(() => {
    if (!preRollBanner) {
      setPreRollTargetInstanceId(null);
      return;
    }
    const id = preRollBanner.pending?.meta?._selectedTargetInstanceId;
    setPreRollTargetInstanceId(id ?? null);
  }, [preRollBanner]);

  const handlePreRollProceed = async () => {
    if (!preRollBanner) return;
    const intentUsedLog = [];
    const { rollWrapper, chips, characterEl, onProceed, getFeatureStateFor, pending } = preRollBanner;
    // Clear the GM's intent banner as dice are now rolling
    if (isPlayer && tableId) clearPlayerIntent(tableId);
    const charEl = activeElements.find(e => e.instanceId === characterEl.instanceId) || characterEl;
    const traitKeyPre = pending.meta?._traitKey;
    if (traitKeyPre && charEl?.instanceId && srdData) {
      const intentMuts = runV2IntentPhaseForTraitRoll({
        traitKey: traitKeyPre,
        actorInstanceId: charEl.instanceId,
        activeElements,
        srdData,
        fearCount,
        mapConfig,
        tableFeatureState,
      });
      for (const m of intentMuts) {
        if (m?.type === 'addAdvantageDie' && m.payload?.name) {
          rollWrapper.addAdvantageDie(m.payload.name);
        }
      }
    }
    if (pending.meta?._deferExperienceToPreRoll) {
      const m = pending.meta;
      let expName = null;
      let mod = 2;
      if (m._companionExperienceForRoll) {
        const idx = preRollCompanionExperienceIndex;
        const exp = idx != null ? charEl.companion?.experiences?.[idx] : null;
        if (exp) {
          expName = exp.name;
          mod = getExperienceModifierForCharacter(charEl, exp.id);
        }
      } else {
        const idx = preRollExperienceIndex;
        const exp = idx != null ? charEl.experiences?.[idx] : null;
        if (exp) {
          expName = exp.name;
          mod = getExperienceModifierForCharacter(charEl, exp.id);
        }
      }
      const tk = m._traitKey || (charEl.spellcastTrait || 'presence').toLowerCase();
      let newText = pending.rollText;
      if (expName != null) {
        newText = insertExperienceIntoRollText(newText, tk, expName, mod);
        intentUsedLog.push(`Experience: ${expName}`);
      }
      pending.rollText = newText;
      const nextMeta = { ...m };
      if (expName != null) nextMeta._experienceHopeCost = 1;
      else delete nextMeta._experienceHopeCost;
      delete nextMeta._deferExperienceToPreRoll;
      pending.meta = nextMeta;
      if (m._companionExperienceForRoll) {
        updateActiveElement(charEl.instanceId, {
          companion: {
            ...charEl.companion,
            selectedExperienceIndex: preRollCompanionExperienceIndex ?? undefined,
          },
        });
      } else {
        updateActiveElement(charEl.instanceId, { selectedExperienceIndex: preRollExperienceIndex });
      }
    }
    const hasDifficultyChip = chips.some(c => c._difficultyChip);
    if (hasDifficultyChip) {
      rollWrapper.meta._difficulty = preRollDifficulty;
      for (const name of preRollAdvantages) {
        rollWrapper.addAdvantageDie((name && name.trim()) || 'Advantage');
        intentUsedLog.push((name && name.trim()) ? `Advantage: ${name.trim()}` : 'Advantage');
      }
      for (const name of preRollDisadvantages) {
        rollWrapper.addDisadvantage((name && name.trim()) || 'Disadvantage');
        intentUsedLog.push((name && name.trim()) ? `Disadvantage: ${name.trim()}` : 'Disadvantage');
      }
    }
                    const onRollCtxProceed = {
                      roll: rollWrapper,
                      characters: wrappedPartyCharacters,
                      system,
                      character: wrapEntity(charEl, updateActiveElement),
                      updateActiveElement,
                      _characterEl: charEl,
                    };
                    if (Array.isArray(charEl.activeFeatures) && charEl.activeFeatures.length > 0) {
                      runCharacterHook(charEl.activeFeatures, 'onRoll', onRollCtxProceed);
                    } else {
                      const proceedNames = [...(charEl.ancestryFeatures || []).map(f => f.name), ...(charEl.communityFeatures || []).map(f => f.name)];
                      const proceedRows = proceedNames.map((n) => resolveOriginFeatureDescriptor(charEl, n)).filter(Boolean);
                      if (proceedRows.length) {
                        runCharacterHook(proceedRows, 'onRoll', onRollCtxProceed);
                      }
                    }
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      if (chip._difficultyChip) continue;
      if (chip._used) continue;
      if (!selectedPreRollChips[i]) continue;
      if (chip._v2IntentChip) {
        const updates = {};
        if (chip.stressCost) {
          const cur = charEl.currentStress ?? 0;
          const max = charEl.maxStress ?? 6;
          updates.currentStress = Math.min(cur + chip.stressCost, max);
        }
        if (chip.hopeCost) {
          const cur = charEl.hope ?? (charEl.maxHope ?? 6);
          updates.hope = Math.max(0, cur - chip.hopeCost);
        }
        if (Object.keys(updates).length) updateActiveElement(charEl.instanceId, updates);
        if (chip._featureName === 'Devastating' && chip.isToggle) {
          pending.meta = { ...pending.meta, devastating: true };
          pending.rollText = applyDevastatingDamageRewriteToRollText(pending.rollText);
        }
        if (chip._featureName === 'Charged' && chip.isToggle) {
          pending.meta = { ...pending.meta, chargedIntent: true };
          pending.rollText = applyChargedProficiencyBonusToRollText(pending.rollText);
        }
        if (chip._featureName === 'Persuasive') {
          rollWrapper.addRollBonus(2);
        }
        {
          const { pendingMeta, displayName } = applyRangerFocusV2IntentToPending({
            pendingMeta: pending.meta,
            displayName: pending.displayName,
            chip,
          });
          pending.meta = pendingMeta;
          pending.displayName = displayName;
        }
        const line = chip.label || chip.name || chip._featureName || 'Feature';
        const costBits = [];
        if (chip.hopeCost) costBits.push(`${chip.hopeCost} Hope`);
        if (chip.stressCost) costBits.push(`${chip.stressCost} Stress`);
        intentUsedLog.push(costBits.length ? `${line} (${costBits.join(', ')})` : line);
        continue;
      }
      if (chip._advantageTriggerChip) {
        if (chip._featureName) rollWrapper.addAdvantageDie(chip._featureName);
        intentUsedLog.push(`Advantage die: ${chip._featureName || chip.label || 'feature'}`);
        continue;
      }
      const updates = {};
      if (chip.stressCost) {
        const cur = charEl.currentStress ?? 0;
        const max = charEl.maxStress ?? 6;
        updates.currentStress = Math.min(cur + chip.stressCost, max);
      }
      if (chip.hopeCost) {
        const cur = charEl.hope ?? (charEl.maxHope ?? 6);
        updates.hope = Math.max(0, cur - chip.hopeCost);
      }
      if (Object.keys(updates).length) updateActiveElement(charEl.instanceId, updates);
      if (chip.requestHopeDieUpgrade) postHopeDieUpgrade(rollWrapper.meta).catch(() => {});
      if (chip.resetsOn && chip._featureKey) wrapEntity(charEl, updateActiveElement).setFeatureUsed(chip._featureKey, chip.resetsOn);
      const descriptor = chip._featureName ? resolveOriginFeatureDescriptor(charEl, chip._featureName) : null;
      const featureState = getFeatureStateFor && chip._featureName ? getFeatureStateFor(charEl, chip._featureName) : { get: () => undefined, set: () => {} };
      const feature = descriptor ? { ...descriptor, ...featureState } : { ...featureState };
      const character = wrapEntity(charEl, updateActiveElement);
      if (pending && chip._featureName && !pending.rollBonusLabel) pending.rollBonusLabel = chip._featureName;
      if (typeof chip.onUse === 'function') chip.onUse({ roll: rollWrapper, character, feature, characters: wrappedPartyCharacters, system });
      {
        const line = [chip._featureName, chip.name].filter(Boolean).join(' — ') || chip.label || 'Feature';
        const costBits = [];
        if (chip.hopeCost) costBits.push(`${chip.hopeCost} Hope`);
        if (chip.stressCost) costBits.push(`${chip.stressCost} Stress`);
        intentUsedLog.push(costBits.length ? `${line} (${costBits.join(', ')})` : line);
      }
    }
    setPreRollAdvantages([]);
    setPreRollDisadvantages([]);
    if (intentUsedLog.length > 0 || preRollTargetInstanceId != null) {
      pending.meta = {
        ...pending.meta,
        ...(intentUsedLog.length > 0 ? { _v2IntentUsedLog: intentUsedLog } : {}),
        ...(preRollTargetInstanceId != null ? { _selectedTargetInstanceId: preRollTargetInstanceId } : {}),
      };
    }
    await onProceed();
  };

  useEffect(() => {
    if (!preRollBanner) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearPreRollBanner();
      } else if (e.key === 'Enter') {
        const t = e.target;
        if (t && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && t.tagName !== 'SELECT') {
          e.preventDefault();
          handlePreRollProceed();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [preRollBanner, preRollExperienceIndex, preRollCompanionExperienceIndex]);

  // Group adversaries of the same type (same id) into consolidated entries.
  // Environments remain as individual entries.
  const consolidatedElements = useMemo(() => {
    const result = [];
    const seenAdvKeys = {}; // key -> index in result

    activeElements.forEach(el => {
      if (el.elementType === 'character') {
        result.push({ kind: 'character', element: el });
      } else if (el.elementType === 'note') {
        result.push({ kind: 'note', element: el });
      } else if (el.elementType === 'environment') {
        result.push({ kind: 'environment', element: el });
      } else if (el.elementType === 'adversary') {
        const key = el.id;
        if (seenAdvKeys[key] === undefined) {
          seenAdvKeys[key] = result.length;
          result.push({ kind: 'adversary-group', baseElement: el, instances: [el] });
        } else {
          result[seenAdvKeys[key]].instances.push(el);
        }
      }
    });

    return result;
  }, [activeElements]);

  const consolidatedByCardKey = useMemo(() => {
    const m = new Map();
    for (const item of consolidatedElements) {
      if (item.kind === 'adversary-group') m.set(item.baseElement.id, item);
      else if (item.kind === 'environment' || item.kind === 'character' || item.kind === 'note') {
        m.set(item.element.instanceId, item);
      }
    }
    return m;
  }, [consolidatedElements]);

  // Find the consolidated element whose cardKey matches the hovered feature (for overlay).
  const hoveredElement = useMemo(() => {
    if (!hoveredFeature) return null;
    for (const item of consolidatedElements) {
      if (item.kind === 'adversary-group') {
        const key = item.baseElement.id;
        if (key === hoveredFeature.cardKey) { lastHoveredElementRef.current = item; return item; }
      } else {
        if (item.element.instanceId === hoveredFeature.cardKey) { lastHoveredElementRef.current = item; return item; }
      }
    }
    return null;
  }, [hoveredFeature, consolidatedElements]);

  useEffect(() => {
    if (!hoveredFeature || hoveredFeature.fromChip || !overlayScrollRef.current) return;
    const el = overlayScrollRef.current.querySelector(`[data-feature-key="${hoveredFeature.featureKey}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [hoveredFeature]);

  // Minimal adversary list for action-banner adversary picker — safe for both GM and player views.
  const actionAdversaryTargets = useMemo(() =>
    consolidatedElements
      .filter(item => item.kind === 'adversary-group')
      .flatMap(item =>
        item.instances
          .filter(inst => !isAdversaryDefeated({ ...item.baseElement, currentHp: inst.currentHp }))
          .map((inst, idx) => ({
            instanceId: inst.instanceId,
            name: item.instances.length > 1 ? `${item.baseElement.name} #${idx + 1}` : item.baseElement.name,
            type: 'adversary',
          }))
      ),
    [consolidatedElements]);
  actionAdversaryTargetsRef.current = actionAdversaryTargets;

  // Flat list of all hittable targets for the damage banner: characters + adversary instances.
  const damageTargets = useMemo(() => {
    const targets = [];
    for (const item of consolidatedElements) {
      if (item.kind === 'character') {
        const el = item.element;
        targets.push({
          instanceId: el.instanceId,
          name: el.name,
          type: 'character',
          thresholds: effectiveThresholds(el),
          maxHp: el.maxHp ?? 0,
          currentHp: el.currentHp ?? el.maxHp ?? 0,
          currentStress: el.currentStress ?? 0,
          maxStress: el.maxStress ?? 6,
          currentArmor: el.currentArmor ?? 0,
          maxArmor: el.maxArmor ?? 0,
          armorFeatureName: el.armorMods?.feature?.name ?? null,
          armorScore: el.armorScore ?? 0,
          evasion: effectiveEvasion(el, srdData) ?? el.evasion ?? null,
          featureUsage: el.featureUsage ?? {},
          conditions: el.conditions ?? '',
          resistance: el.resistance ?? [],
          retractedActive: el.retractedActive ?? false,
        });
      } else if (item.kind === 'adversary-group') {
        const { baseElement, instances } = item;
        instances.forEach((inst, idx) => {
          if (isAdversaryDefeated({ ...baseElement, currentHp: inst.currentHp })) return;
          targets.push({
            instanceId: inst.instanceId,
            name: instances.length > 1 ? `${baseElement.name} #${idx + 1}` : baseElement.name,
            type: 'adversary',
            difficulty: (baseElement.difficulty ?? 0) + (inst.difficultyMod ?? 0),
            thresholds: baseElement.hp_thresholds,
            maxHp: baseElement.hp_max ?? 0,
            currentHp: inst.currentHp ?? baseElement.hp_max ?? 0,
            currentStress: inst.currentStress ?? 0,
            maxStress: baseElement.stress_max ?? 0,
            vulnerable: inst.vulnerable ?? false,
            focusedBy: inst.focusedBy ?? null,
            conditions: inst.conditions ?? '',
          });
        });
      }
    }
    return targets;
  }, [consolidatedElements, srdData]);

  // Returns names of adversaries within Very Close of the Water Druid attacker that will mark Stress.
  const getV2DamageBannerAckNotices = useCallback(
    (roll, selectedDamageTargetId) =>
      computeV2DamageBannerAckNotices({ roll, activeElements, selectedDamageTargetId }),
    [activeElements],
  );

  // Character attacks with weapon range: filter to adversaries within range. Adversary attacks with range: filter to characters in range.
  const getTargetsForRoll = useCallback((roll) => {
    if (roll._attackerInstanceId && roll._weaponRangeFt != null) {
      const inRange = getAdversariesWithinRangeFt(activeElements, roll._attackerInstanceId, roll._weaponRangeFt);
      const ids = new Set(inRange.map(m => m.instanceId));
      return damageTargets.filter(t => t.type === 'adversary' && ids.has(t.instanceId));
    }
    if (roll._attackerType === 'adversary' && roll._attackRangeFt != null && (roll._attackerInstanceId || (roll._attackerInstanceIds && roll._attackerInstanceIds.length > 0))) {
      const inRange = roll._attackerInstanceIds?.length > 0
        ? getCharactersWithinRangeOfAny(activeElements, roll._attackerInstanceIds, roll._attackRangeFt)
        : getCharactersWithinRangeFt(activeElements, roll._attackerInstanceId, roll._attackRangeFt);
      const ids = new Set(inRange.map(c => c.instanceId));
      return damageTargets.filter(t => t.type === 'character' && ids.has(t.instanceId));
    }
    return damageTargets;
  }, [activeElements, damageTargets]);

  // Valid targets for in-place menu before roll (same logic as getTargetsForRoll; returns { instanceId, name }[] for character attacks).
  const getValidTargets = useCallback((attackerInstanceId, opts) => {
    const syntheticRoll = {
      _attackerInstanceId: attackerInstanceId,
      _weaponRangeFt: opts?.weaponRangeFt,
    };
    return getTargetsForRoll(syntheticRoll);
  }, [getTargetsForRoll]);

  // For adversary-attack banners: which character targets add disadvantage (e.g. Orc Sturdy at 1 HP). Call onTargeted via activeFeatures.
  const getTargetDisadvantageLabels = useCallback((roll) => {
    if (!roll?.rollText || roll._attackerType !== 'adversary') return {};
    const characterTargets = getTargetsForRoll(roll).filter(t => t.type === 'character');
    const out = {};
    for (const t of characterTargets) {
      const el = activeElements.find(e => e.instanceId === t.instanceId);
      if (!Array.isArray(el?.activeFeatures) || el.activeFeatures.length === 0) continue;
      const disadvantageFeatures = [];
      const wrappedChar = wrapEntity(el, updateActiveElement);
      for (const feature of el.activeFeatures) {
        if (typeof feature.onTargeted !== 'function') continue;
        const pendingRoll = {
          get rollText() { return roll.rollText; },
          set rollText(_v) {},
          addDisadvantage(name) { disadvantageFeatures.push(name ?? feature.name); },
        };
        feature.onTargeted({ roll: pendingRoll, character: wrappedChar, characters: wrappedPartyCharacters, system });
      }
      if (disadvantageFeatures.length) out[t.instanceId] = disadvantageFeatures;
    }
    return out;
  }, [activeElements, getTargetsForRoll, updateActiveElement, wrappedPartyCharacters]);

  // For adversary target menu (pre-roll): get disadvantage feature names for one character target.
  const getDisadvantageForTarget = useCallback((rollText, targetInstanceId) => {
    const el = activeElements.find(e => e.instanceId === targetInstanceId);
    if (!Array.isArray(el?.activeFeatures) || el.activeFeatures.length === 0) return [];
    const disadvantageFeatures = [];
    const wrappedChar = wrapEntity(el, updateActiveElement);
    for (const feature of el.activeFeatures) {
      if (typeof feature.onTargeted !== 'function') continue;
      const pendingRoll = {
        get rollText() { return rollText; },
        set rollText(_v) {},
        addDisadvantage(name) { disadvantageFeatures.push(name ?? feature.name); },
      };
      feature.onTargeted({ roll: pendingRoll, character: wrappedChar, characters: wrappedPartyCharacters, system });
    }
    return disadvantageFeatures;
  }, [activeElements, updateActiveElement, wrappedPartyCharacters]);

  // Deduplicate actions by adversary id — same type only appears once in the board. Exclude adversary types that have no living (non-defeated) instances.
  const consolidatedMenu = useMemo(() => {
    const menu = { 'Passives': [], 'Reactions': [], 'Fear Actions': [], 'Actions': [] };
    const seenAdvIds = new Set();
    const adversaryIdsWithAlive = new Set();
    activeElements.forEach(el => {
      if (el.elementType === 'adversary' && !isAdversaryDefeated(el)) adversaryIdsWithAlive.add(el.id);
    });

    activeElements.forEach(element => {
      if (element.elementType === 'adversary') {
        if (!adversaryIdsWithAlive.has(element.id)) return;
        if (seenAdvIds.has(element.id)) return;
        seenAdvIds.add(element.id);
      }

      const cardKey = element.elementType === 'adversary'
        ? element.id
        : element.instanceId;

      if (element.attack && element.attack.name) {
        menu['Actions'].push({
          id: `${element.instanceId}-attack`,
          name: element.attack.name,
          type: 'action',
          description: `${element.attack.modifier >= 0 ? '+' : ''}${element.attack.modifier} ${element.attack.range} | ${element.attack.damage} ${element.attack.trait?.toLowerCase()}`,
          sourceName: element.name,
          cardKey,
          featureKey: 'attack',
          _rollData: {
            modifier: element.attack.modifier || 0,
            range: element.attack.range || 'Melee',
            damage: element.attack.damage || 'd6',
            trait: element.attack.trait || 'phy',
          },
        });
      }

      element.features?.forEach((feature, featureIdx) => {
        const category = parseFeatureCategory(feature);
        const m = feature.type === 'action' && feature.description ? ATTACK_DESC_RE.exec(feature.description) : null;
        const dicePatterns = feature.description
          ? [...feature.description.matchAll(DICE_PATTERN_RE)].map(dm => dm[0])
          : [];
        const includeAttack = /\bmakes?\b.*?\battack\b/is.test(feature.description || '');
        menu[category].push({
          ...feature,
          sourceName: element.name,
          cardKey,
          featureKey: `feat-${featureIdx}`,
          _rollData: m ? {
            modifier: parseInt(m[1]),
            range: m[2],
            damage: m[3],
            trait: m[4],
          } : null,
          _diceRoll: !m && (dicePatterns.length > 0 || includeAttack) ? {
            patterns: dicePatterns,
            includeAttack,
            attackModifier: includeAttack ? (element.attack?.modifier ?? 0) : null,
            attackDamage: includeAttack && dicePatterns.length === 0 ? (element.attack?.damage || null) : null,
            attackTrait: includeAttack && dicePatterns.length === 0 ? (element.attack?.trait || null) : null,
            attackRange: includeAttack && dicePatterns.length === 0 ? (element.attack?.range || 'Melee') : null,
          } : null,
        });
      });

      if (element.elementType === 'adversary') {
        const role = (element.role || 'standard').toLowerCase();
        const template = ROLE_MOVES[role];
        if (template) {
          const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
          menu['Actions'].push({
            id: `${element.instanceId}-role-move`,
            name: `${roleLabel} Move`,
            type: 'action',
            description: template.replace(/\{name\}/g, element.name),
            sourceName: element.name,
            cardKey,
            featureKey: 'role-move',
            _isRoleMove: true,
          });
        }
      }
    });
    return menu;
  }, [activeElements]);

  const gmMovesPrFeatures = useMemo(
    () => [...(consolidatedMenu.Passives ?? []), ...(consolidatedMenu.Reactions ?? [])],
    [consolidatedMenu],
  );
  const gmMovesActionFeatures = consolidatedMenu.Actions ?? [];
  const gmMovesFearFeatures = consolidatedMenu['Fear Actions'] ?? [];
  const tallGmSection = pickTallestGmSection(
    gmMovesPrFeatures.length,
    gmMovesActionFeatures.length,
    gmMovesFearFeatures.length,
  );

  const removeGroup = (instances) => {
    instances.forEach(inst => removeActiveElement(inst.instanceId));
  };

  // Compute total BP from active adversary elements.
  const advElements = activeElements.filter(e => e.elementType === 'adversary');
  const countById = {};
  const roleAndTierById = {};
  advElements.forEach(e => {
    countById[e.id] = (countById[e.id] || 0) + 1;
    roleAndTierById[e.id] = { role: e.role || 'standard', tier: e.tier ?? 1, name: e.name || '' };
  });
  const tableAdvSummary = Object.entries(countById).map(([id, count]) => ({
    ...roleAndTierById[id], count,
  }));
  const tableBP = computeBattlePoints(tableAdvSummary, partySize);
  const tableBudget = 3 * partySize + 2;
  const tableAutoMods = computeAutoModifiers(tableAdvSummary, partyTier);
  const totalMod = computeTotalBudgetMod(tableAutoMods, effectiveMods);
  const adjustedBudget = tableBudget + totalMod;
  const encounterAiTargetBudget = encounterAiBudgetUser != null ? encounterAiBudgetUser : adjustedBudget;
  const encounterAiRemainingBattlePoints = Math.max(
    0,
    encounterAiTargetBudget - (encounterAiCountCurrent ? tableBP : 0),
  );

  useEffect(() => {
    encounterAiGenerateMapInitRef.current = false;
  }, [tableId]);

  useEffect(() => {
    if (!tableStateReady || encounterAiGenerateMapInitRef.current) return;
    encounterAiGenerateMapInitRef.current = true;
    setEncounterAiGenerateMap(!mapConfigHasImage(mapConfig));
  }, [tableStateReady, mapConfig, tableId]);

  const runEncounterAiBuild = useCallback(async () => {
    const q = encounterAiConcept.trim();
    if (!q || !sendDoAddToTable || encounterAiBuilding) return;
    setEncounterAiBuilding(true);
    setEncounterAiBuildPhase('plan');
    setEncounterAiBuildFeedback(null);
    let mapPromise = Promise.resolve();
    try {
      mapPromise =
        encounterAiGenerateMap && imageGenEnabled && onMapConfigChange
          ? generateAndApplyBattleMapQuietly(mapConfig, q, onMapConfigChange).catch((err) => {
              console.warn('Quiet battle map generation failed:', err);
            })
          : Promise.resolve();

      const hasEnv = activeElements.some(e => e.elementType === 'environment');
      const baseOpts = {
        partySize,
        partyTier,
        remainingBattlePoints: encounterAiRemainingBattlePoints,
        includePublic: encounterAiIncludePublic,
        hasEnvironmentOnTable: hasEnv,
        tableAdversarySummary: tableAdvSummary,
      };

      let plan = await postEncounterAiBuild(q, { ...baseOpts, step: 'plan' });
      if (plan.requiresFinish) {
        setEncounterAiBuildPhase('resolving');
        plan = await postEncounterAiBuild(q, {
          ...baseOpts,
          step: 'finish',
          encounterPlan: plan.encounterPlan,
        });
      }
      setEncounterAiBuildPhase('applying');

      const notes = (plan.warnings || []).filter(Boolean);
      const summary = typeof plan.justification === 'string' ? plan.justification.trim() : '';
      const hbReport = Array.isArray(plan.homebrewReport) ? plan.homebrewReport : [];
      const hbLines = hbReport
        .filter((r) => r.via === 'homebrew' || r.label === 'homebrew')
        .map((r) => {
          if (r.kind === 'adversary') {
            const tail =
              r.fromId != null
                ? ` — replaced unknown id ${r.fromId}`
                : r.source === 'llm_synthetic' && r.concept
                  ? ` — ${r.concept}`
                  : '';
            return `Homebrew adversary (${r.role}, tier ${r.tier})${tail}`;
          }
          if (r.kind === 'environment') {
            const tail =
              r.fromId != null
                ? ` — replaced unknown id ${r.fromId}`
                : r.source === 'llm_synthetic' && r.concept
                  ? ` — ${r.concept}`
                  : '';
            return `Homebrew environment (${r.type}, tier ${r.tier})${tail}`;
          }
          return null;
        })
        .filter(Boolean);
      if (hbLines.length) notes.unshift(hbLines.join(' · '));

      const advIds = [...new Set((plan.adversaryAdds || []).map((a) => a.id))];
      const envIds = [...new Set((plan.environmentAdds || []).map((e) => e.id))];
      if (advIds.length || envIds.length) {
        const resolved = await resolveItems({ adversaries: advIds, environments: envIds }, { adopt: true });
        const advById = indexResolvedItemsByRequestId(resolved.adversaries);
        const envById = indexResolvedItemsByRequestId(resolved.environments);
        for (const row of plan.adversaryAdds || []) {
          const item = advById[row.id];
          if (!item) continue;
          for (let i = 0; i < row.count; i++) {
            await sendDoAddToTable(item, 'adversaries', tableId);
          }
        }
        for (const row of plan.environmentAdds || []) {
          const item = envById[row.id];
          if (!item) continue;
          for (let i = 0; i < row.count; i++) {
            await sendDoAddToTable(item, 'environments', tableId);
          }
        }
      }

      if (plan.homebrewAdversaryPatches?.length) {
        for (const spec of plan.homebrewAdversaryPatches) {
          const stub = buildGameTableNewAdversaryStub(spec.tier, spec.role);
          const merged = { ...stub, ...spec.patch };
          const saved = await saveItem('adversaries', merged);
          if (!saved) continue;
          const n = spec.count || 1;
          for (let i = 0; i < n; i++) {
            await sendDoAddToTable(saved, 'adversaries', tableId);
          }
        }
      } else {
        for (const spec of plan.needsSyntheticAdversaries || []) {
          const { patch } = await postAdversaryAiBuild(spec.concept, { tier: spec.tier, role: spec.role });
          const stub = buildGameTableNewAdversaryStub(spec.tier, spec.role);
          const merged = { ...stub, ...patch };
          const saved = await saveItem('adversaries', merged);
          if (!saved) continue;
          const n = spec.count || 1;
          for (let i = 0; i < n; i++) {
            await sendDoAddToTable(saved, 'adversaries', tableId);
          }
        }
      }

      if (plan.homebrewEnvironmentPatch) {
        const ne = plan.homebrewEnvironmentPatch;
        const stub = buildGameTableNewEnvironmentStub(ne.tier, ne.type);
        const merged = { ...stub, ...ne.patch };
        const saved = await saveItem('environments', merged);
        if (saved) await sendDoAddToTable(saved, 'environments', tableId);
      } else if (plan.needsSyntheticEnvironment) {
        const ne = plan.needsSyntheticEnvironment;
        const { patch } = await postEnvironmentAiBuild(ne.concept, { tier: ne.tier, type: ne.type });
        const stub = buildGameTableNewEnvironmentStub(ne.tier, ne.type);
        const merged = { ...stub, ...patch };
        const saved = await saveItem('environments', merged);
        if (saved) await sendDoAddToTable(saved, 'environments', tableId);
      }

      setEncounterAiBuildFeedback(
        summary || notes.length
          ? {
              summary: summary || null,
              notes: notes.length ? notes.join(' · ') : null,
            }
          : null,
      );
      setEncounterAiConcept('');
    } catch (e) {
      console.error(e);
      setEncounterAiBuildFeedback({ summary: null, notes: e?.message || 'Encounter build failed' });
    } finally {
      await mapPromise.catch(() => {});
      setEncounterAiBuildPhase(null);
      setEncounterAiBuilding(false);
    }
  }, [
    encounterAiConcept,
    encounterAiGenerateMap,
    sendDoAddToTable,
    encounterAiBuilding,
    activeElements,
    partySize,
    partyTier,
    encounterAiRemainingBattlePoints,
    encounterAiIncludePublic,
    tableAdvSummary,
    tableId,
    saveItem,
    mapConfig,
    onMapConfigChange,
    imageGenEnabled,
  ]);

  const tableDiff = tableBP - adjustedBudget;
  const tableDiffColor = tableDiff > 0 ? 'text-red-400' : tableDiff < 0 ? 'text-emerald-400' : 'text-dh-muted';
  const activeAutoMods = Object.values(tableAutoMods).filter(m => m.active);
  const tableCharacters = activeElements.filter(e => e.elementType === 'character');
  /** Session role + assigned PC + `viewer` for {@link collectV2ReviewActionChips} (single source of truth). */
  const chipViewer = useMemo(
    () => buildV2ChipViewer({ isPlayer, user, playerEmail, previewAsPlayerEmail, tableCharacters }),
    [isPlayer, user?.uid, playerEmail, previewAsPlayerEmail, tableCharacters]
  );
  const playerViewerCharacterInstanceId = chipViewer.assignedCharacterInstanceId;

  const wizardsWithHope = tableCharacters.filter(c => {
    const cls = (c.class || '').toLowerCase();
    const hope = c.hope ?? (c.maxHope ?? 6);
    return cls === 'wizard' && hope >= 3;
  });

  // Recomputed character display (evasion, thresholds, etc.) so sidebar cards match sheet (e.g. Simiah Nimble +1).
  const characterDisplayByInstanceId = useMemo(() => {
    if (!srdData) return new Map();
    const map = new Map();
    for (const el of tableCharacters) {
      const base = recomputeCharacter(el, srdData);
      map.set(
        el.instanceId,
        mergeV2DeclarativeSheetOverlay(base, el, srdData, {
          fearCount,
          mapConfig,
          tableFeatureState,
        })
      );
    }
    return map;
  }, [srdData, tableCharacters, fearCount, mapConfig, tableFeatureState]);

  function renderAdversaryTargetAid(adversaryEl) {
    if (tableCharacters.length === 0) return null;
    const { allowPlayMechanics } = characterSheetTableInteractionFlags(sessionPlayAllowed, isPlayer, true);
    return (
      <PlayerAdversaryTargetAid
        adversaryInstanceId={adversaryEl.instanceId}
        adversaryElement={adversaryEl}
        characterElements={tableCharacters}
        primaryInstanceId={isPlayer ? playerViewerCharacterInstanceId : null}
        canInteractWithCharacter={(instanceId) => {
          if (!isPlayer) return true;
          if (playerViewerCharacterInstanceId == null || playerViewerCharacterInstanceId === '') return false;
          return instanceId === playerViewerCharacterInstanceId;
        }}
        characterDisplayByInstanceId={characterDisplayByInstanceId}
        v2TableContext={v2TableContextForPanels}
        onV2CardChipFactory={handleCharacterPanelV2CardChip}
        getValidTargets={allowPlayMechanics ? getValidTargets : undefined}
        onWeaponClick={
          allowPlayMechanics
            ? (characterEl, displayChar, weapon, rollMeta) =>
                handlePlayerAdversaryPinWeaponClick(characterEl, displayChar, adversaryEl, weapon, rollMeta)
            : undefined
        }
      />
    );
  }

  const renderPinnedCharacterPanel = useCallback(
    ({ element, anchorX, anchorY, onClose, onRemoveFromMap }) => {
      const el = activeElements.find((e) => e.instanceId === element.instanceId) || element;
      if (el.elementType !== 'character') return null;
      const isMyChar = isPlayer && playerEmail != null && el.assignedPlayerEmail === playerEmail;
      const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(
        sessionPlayAllowed,
        isPlayer,
        isMyChar,
      );
      const gmTrackCheckbox = gmResourceTrackCheckboxEditsAllowed(isPlayer);
      const cardTrackUpdateFn = sheetOwner && gmTrackCheckbox ? updateActiveElement : undefined;
      const cardQueueManualTracks = allowPlayMechanics && gmTrackCheckbox ? queueManualTrackEdit : undefined;
      const pendingManual = findPendingManualTrackBanner(pendingBanners, el.instanceId);
      const manualAck = getPendingManualTrackAckDeltas(el, pendingManual);
      const lsHeal = getLifeSupportPendingHealSlots(pendingBanners, lifeSupportSelections, el.instanceId);
      const displayChar = characterDisplayByInstanceId.get(el.instanceId) ?? el;
      const charComplete = isCharacterComplete(el);
      return (
        <AnchoredFloatingPanel
          anchorX={anchorX}
          anchorY={anchorY}
          onEscape={onClose}
          className="w-56 min-w-0 max-w-[min(18rem,92vw)]"
        >
          <GameTableCharacterListCard
            el={el}
            displayChar={displayChar}
            isMyCharacter={isMyChar}
            isPlayer={isPlayer}
            sheetTriggerProps={characterOverlay.triggerProps((e) => ({
              element: el,
              top: e.currentTarget.getBoundingClientRect().top,
              bottom: e.currentTarget.getBoundingClientRect().bottom,
            }))}
            charComplete={charComplete}
            pendingResourceCosts={pendingResourceCosts}
            manualAck={manualAck}
            lsHeal={lsHeal}
            cardTrackUpdateFn={cardTrackUpdateFn}
            cardQueueManualTracks={cardQueueManualTracks}
            consumePendingStressForManualMark={consumePendingStressForManualMark}
            playerEmails={playerEmails}
            connectedPlayers={connectedPlayers}
            onAssignPlayerEmail={(instanceId, email) => updateActiveElement(instanceId, { assignedPlayerEmail: email })}
            onRemoveFromTable={
              !isPlayer
                ? (instanceId) => {
                    const row = activeElements.find((e) => e.instanceId === instanceId);
                    if (window.confirm(`Remove ${row?.name || 'Unnamed'} from the table?`)) removeActiveElement(instanceId);
                  }
                : undefined
            }
            cardRootProps={{}}
            trailingHeaderActions={
              <>
                {onRemoveFromMap && (
                  <button
                    type="button"
                    onClick={onRemoveFromMap}
                    className="p-1 rounded text-dh-muted hover:text-amber-400 transition-colors"
                    title="Remove from map (return to tray)"
                  >
                    <ArrowLeftToLine size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded text-dh-muted hover:text-white transition-colors"
                  title="Close"
                >
                  <X size={13} />
                </button>
              </>
            }
            v2Registry={srdData ? v2Registry : null}
            v2TableContext={v2TableContextForPanels}
            onV2CardChipFactory={handleCharacterPanelV2CardChip}
            pendingBanners={pendingBanners}
          />
        </AnchoredFloatingPanel>
      );
    },
    [
      activeElements,
      characterDisplayByInstanceId,
      characterOverlay.triggerProps,
      pendingResourceCosts,
      pendingBanners,
      lifeSupportSelections,
      queueManualTrackEdit,
      updateActiveElement,
      removeActiveElement,
      playerEmails,
      connectedPlayers,
      isPlayer,
      playerEmail,
      sessionPlayAllowed,
      consumePendingStressForManualMark,
      srdData,
      v2Registry,
      v2TableContextForPanels,
      handleCharacterPanelV2CardChip,
    ],
  );

  /** V2 engine `reviewAction` chips for pending banners (Phase 2 — keyed by `_rollDbId`). */
  const v2ReviewChipsByRollDbId = useMemo(() => {
    const m = new Map();
    if (!srdData) return m;
    const { viewer } = chipViewer;
    for (const roll of pendingBanners || []) {
      const id = roll._rollDbId;
      if (id == null) continue;
      const chips = collectV2ReviewActionChips({
        roll,
        activeElements,
        srdData,
        fearCount,
        mapConfig,
        tableFeatureState,
        viewer,
      });
      const consumed = v2BannerConsumedOnUseByRollDbId.get(id);
      const annotated = annotateV2ReviewChipsBannerConsumed(chips, consumed);
      if (annotated.length) m.set(id, annotated);
    }
    return m;
  }, [
    pendingBanners,
    activeElements,
    srdData,
    fearCount,
    mapConfig,
    tableFeatureState,
    v2BannerConsumedOnUseByRollDbId,
    chipViewer,
  ]);

  const getV2ReviewChipPicker = useCallback(
    (chip, roll) =>
      resolveV2ReviewChipPickerFromBridge(chip, roll, activeElements, srdData, {
        fearCount,
        mapConfig,
        tableFeatureState,
      }),
    [activeElements, srdData, fearCount, mapConfig, tableFeatureState]
  );

  const getV2ReviewChipDisableHintCb = useCallback(
    (chip, roll) =>
      getV2ReviewChipDisableHint(chip, roll, activeElements, srdData, {
        fearCount,
        mapConfig,
        tableFeatureState,
      }),
    [activeElements, srdData, fearCount, mapConfig, tableFeatureState]
  );

  const handleV2ReviewChip = useCallback(
    async (chip, roll, selectOpts = {}) => {
      if (isPlayer) return;
      if (chip?._v2BannerOnUseConsumed) return;
      if (typeof chip.isSelect === 'function') {
        if (chip.multiSelect) {
          if (!Array.isArray(selectOpts.selectedIds) || selectOpts.selectedIds.length === 0) return;
        } else if (selectOpts.selectedId == null || selectOpts.selectedId === '') return;
      }
      if (typeof chip.selectTargets === 'function' && !(selectOpts.selectedTargetIds?.length > 0)) return;

      const { mutations, error } = activateV2ReviewChip(chip, roll, activeElements, srdData, {
        fearCount,
        mapConfig,
        tableFeatureState,
        selectOpts,
      });
      if (error) return;

      const { localMutations, serverFollowups, engineRollDisplayOnly, unsupported } =
        partitionV2BannerChipMutations(mutations);
      const { updates, skipped } = applyV2BannerMutations(activeElements, localMutations, chip._ownerInstanceId);
      if (updates.length) {
        sendOp({ op: 'update-elements', updates });
      }

      // Fearless / engine: setRollOutcome('hope') — same as Phase 1 roll.setWithHope() + chipHopeConvertedIds ack path.
      if (roll._rollDbId != null && Array.isArray(engineRollDisplayOnly)) {
        for (const m of engineRollDisplayOnly) {
          if (
            m?.type === 'setRollOutcome' &&
            m.payload?.rollKey === 'action' &&
            m.payload?.outcome === 'hope'
          ) {
            setChipHopeConvertedIds((prev) => new Set([...prev, roll._rollDbId]));
            break;
          }
        }
      }

      let currentBannerId = roll._rollDbId;
      for (const f of serverFollowups) {
        if (f.kind === 'addDamage') {
          const dice = String(f.payload?.dice ?? '').trim();
          if (!dice || currentBannerId == null) continue;
          const extraDamageLabel = String(f.payload?.name || chip._featureName || 'V2').slice(0, 80);
          try {
            const prevId = currentBannerId;
            const newRoll = await postBannerAddDamage(currentBannerId, {
              extraDamage: dice,
              extraDamageLabel,
              suppressAncestryFeature: chip._featureName,
              tableId,
            });
            if (newRoll?._rollDbId != null) {
              currentBannerId = newRoll._rollDbId;
              if (prevId !== currentBannerId) {
                const migrateUpdates = migrateV2PendingMapRollId(prevId, currentBannerId, activeElements);
                if (migrateUpdates.length) sendOp({ op: 'update-elements', updates: migrateUpdates });
                setV2BannerConsumedOnUseByRollDbId((prev) =>
                  migrateV2BannerConsumedOnUseKeys(prevId, currentBannerId, prev)
                );
              }
            }
          } catch (e) {
            console.warn('[V2] postBannerAddDamage failed:', e);
          }
        } else if (f.kind === 'rerollDie') {
          if (currentBannerId == null) continue;
          try {
            const prevId = currentBannerId;
            const newRoll = await postBannerRerollDie(currentBannerId, {
              dieType: f.dieType,
              suppressAncestryFeature: chip._featureName,
            });
            if (newRoll?._rollDbId != null) {
              currentBannerId = newRoll._rollDbId;
              if (prevId !== currentBannerId) {
                const migrateUpdates = migrateV2PendingMapRollId(prevId, currentBannerId, activeElements);
                if (migrateUpdates.length) sendOp({ op: 'update-elements', updates: migrateUpdates });
                setV2BannerConsumedOnUseByRollDbId((prev) =>
                  migrateV2BannerConsumedOnUseKeys(prevId, currentBannerId, prev)
                );
              }
            }
          } catch (e) {
            console.warn('[V2] postBannerRerollDie failed:', e);
          }
        } else if (f.kind === 'patchActionRollAddDie') {
          const die = String(f.payload?.die ?? '').trim();
          if (!die || currentBannerId == null) continue;
          const extraName = String(f.payload?.name ?? chip._featureName ?? 'Bonus').slice(0, 120);
          try {
            await postBannerActionAddDie(currentBannerId, {
              die,
              name: extraName,
              tableId,
            });
          } catch (e) {
            console.warn('[V2] postBannerActionAddDie failed:', e);
          }
        } else if (f.kind === 'patchActionRollAddStatic') {
          const v = Number(f.payload?.value);
          if (!Number.isFinite(v) || currentBannerId == null) continue;
          const extraName = String(f.payload?.name ?? chip._featureName ?? 'Bonus').slice(0, 120);
          try {
            await postBannerActionAddStatic(currentBannerId, {
              value: v,
              name: extraName,
              tableId,
            });
          } catch (e) {
            console.warn('[V2] postBannerActionAddStatic failed:', e);
          }
        } else if (f.kind === 'forcedMovementNotice') {
          const p = f.payload || f.mutation?.payload;
          if (p) {
            const notice = buildForcedMovementActionNotification(p, activeElements);
            if (chip?._featureName) notice.actionName = String(chip._featureName).slice(0, 120);
            handleActionNotification(notice);
          }
        }
      }

      const unhandled = [...skipped, ...unsupported];
      if (unhandled.length) {
        console.warn('[V2] Banner mutations not applied (engine/VTT follow-up required):', unhandled.map((m) => m.type));
      }

      setV2BannerConsumedOnUseByRollDbId((prev) => recordV2BannerConsumedOnUse(currentBannerId, chip, prev));
    },
    [
      isPlayer,
      activeElements,
      srdData,
      fearCount,
      mapConfig,
      tableFeatureState,
      sendOp,
      tableId,
      handleActionNotification,
    ]
  );

  const handlePlayerV2ReviewChip = useCallback(
    async (chip, roll, selectOpts = {}) => {
      if (!isPlayer || !tableId) return;
      if (chip?._v2BannerOnUseConsumed) return;
      const vid = playerViewerCharacterInstanceId;
      if (!vid || roll._rollDbId == null) return;
      if (typeof chip.isSelect === 'function') {
        if (chip.multiSelect) {
          if (!Array.isArray(selectOpts.selectedIds) || selectOpts.selectedIds.length === 0) return;
        } else if (selectOpts.selectedId == null || selectOpts.selectedId === '') return;
      }
      if (typeof chip.selectTargets === 'function' && !(selectOpts.selectedTargetIds?.length > 0)) return;

      const activationKey = v2BannerChipActivationKey(chip);
      try {
        const data = await postPlayerV2ReviewChip(tableId, {
          viewerInstanceId: vid,
          bannerId: roll._rollDbId,
          activationKey,
          selectOpts,
        });
        if (data?.hopeConvertedRollDbId != null) {
          setChipHopeConvertedIds((prev) => new Set([...prev, data.hopeConvertedRollDbId]));
        }
        for (const m of data?.bannerMigrations || []) {
          if (m.from != null && m.to != null) {
            setV2BannerConsumedOnUseByRollDbId((prev) =>
              migrateV2BannerConsumedOnUseKeys(m.from, m.to, prev)
            );
          }
        }
        const finalDbId = data?.currentRollDbId ?? roll._rollDbId;
        setV2BannerConsumedOnUseByRollDbId((prev) =>
          recordV2BannerConsumedOnUse(finalDbId, chip, prev)
        );
      } catch (e) {
        console.warn('[V2] player review chip failed:', e);
      }
    },
    [isPlayer, tableId, playerViewerCharacterInstanceId]
  );

  const getV2PendingMoveBlockInfo = useCallback(
    (roll) => getV2PendingMoveBlockInfoFromElements(roll, activeElements),
    [activeElements]
  );

  /** Restore pending-map `conditionFn` registry after reload (`conditionFn` is not JSON-serializable). */
  useLayoutEffect(() => {
    if (isPlayer) return;
    ensureV2PendingMapRegistry(activeElements, pendingBanners || []);
  }, [isPlayer, activeElements, pendingBanners]);

  /**
   * Re-evaluate `v2PendingMove.conditionMet` when `srdData` / banners / elements are ready.
   * Token-drag evaluation alone misses the first paint after reload (no drag yet, or `srdData` still loading).
   */
  useEffect(() => {
    if (isPlayer || !srdData || !pendingBanners?.length || !activeElements?.length) return;
    const updates = collectV2PendingMapMoveReEvalUpdates(activeElements, pendingBanners, srdData, {
      fearCount,
      mapConfig,
      tableFeatureState,
    });
    if (updates.length > 0) {
      sendOp({ op: 'update-elements', updates });
    }
  }, [
    isPlayer,
    srdData,
    activeElements,
    pendingBanners,
    fearCount,
    mapConfig,
    tableFeatureState,
    sendOp,
  ]);

  // Sync DiceRoller with the authoritative pendingBanners subscription snapshot.
  useEffect(() => {
    if (!pendingBanners) return;
    const isFirst = isFirstBannersSnapshotRef.current;
    isFirstBannersSnapshotRef.current = false;

    function getBannerNarration(roll) {
      const attackerEl = roll._attackerInstanceId
        ? activeElements.find((e) => e.instanceId === roll._attackerInstanceId && e.elementType === 'character')
        : null;
      const parts = buildRollBaseBannerNarrationParts(roll, attackerEl);
      return parts.filter(p => p?.text);
    }

    const lastBanner = pendingBanners[pendingBanners.length - 1];
    for (const banner of pendingBanners) {
      const dbId = banner._rollDbId;
      if (!dbId) continue;
      const replacedId = banner._replacedRollDbId;
      if (replacedId != null && pendingBannerDbIdsRef.current.has(replacedId)) {
        pendingBannerDbIdsRef.current.delete(replacedId);
        pendingBannerDbIdsRef.current.add(dbId);
        let rousingSpeechTargets;
        if (banner._action && banner._featureName === 'Rousing Speech' && banner._attackerInstanceId) {
          rousingSpeechTargets = getCharactersWithinFarRange(activeElements, banner._attackerInstanceId);
        }
        let lifeSupportTargets;
        if (banner._action && banner._featureName === 'Life Support' && banner._attackerInstanceId) {
          lifeSupportTargets = getCharactersWithinCloseRangeWithMarkedHp(activeElements, banner._attackerInstanceId);
        }
        if (banner._action && banner._targetType === 'adversary' && banner._selectedTargetInstanceId && dbId != null) {
          setActionAdversarySelections(prev => prev[dbId] ? prev : { ...prev, [dbId]: banner._selectedTargetInstanceId });
        }
        const narrations = getBannerNarration(banner);
        const augmentedBanner = {
          ...banner,
          ...(narrations.length ? { _narrations: narrations } : {}),
          ...(rousingSpeechTargets !== undefined ? { _rousingSpeechTargets: rousingSpeechTargets } : {}),
          ...(lifeSupportTargets !== undefined ? { _lifeSupportTargets: lifeSupportTargets } : {}),
          _isPlayerRoll: banner._playerInitiated === true,
          _rollId: `sub-${dbId}`,
        };
        diceRollerRef.current?.replaceBannerByDbId?.(replacedId, augmentedBanner);
        continue;
      }
      if (pendingBannerDbIdsRef.current.has(dbId)) {
        diceRollerRef.current?.updateBannerRollByDbId?.(dbId, banner);
        if (banner._action && banner._targetType === 'adversary' && banner._selectedTargetInstanceId != null) {
          setActionAdversarySelections(prev => ({ ...prev, [dbId]: banner._selectedTargetInstanceId }));
        }
        continue;
      }
      pendingBannerDbIdsRef.current.add(dbId);

      let rousingSpeechTargets;
      if (banner._action && banner._featureName === 'Rousing Speech' && banner._attackerInstanceId) {
        rousingSpeechTargets = getCharactersWithinFarRange(activeElements, banner._attackerInstanceId);
      }
      let lifeSupportTargets;
      if (banner._action && banner._featureName === 'Life Support' && banner._attackerInstanceId) {
        lifeSupportTargets = getCharactersWithinCloseRangeWithMarkedHp(activeElements, banner._attackerInstanceId);
      }
      if (banner._action && banner._targetType === 'adversary' && banner._selectedTargetInstanceId && dbId != null) {
        setActionAdversarySelections(prev => prev[dbId] ? prev : { ...prev, [dbId]: banner._selectedTargetInstanceId });
      }
      const narrations = getBannerNarration(banner);
      diceRollerRef.current?.addRoll({
        ...banner,
        ...(narrations.length ? { _narrations: narrations } : {}),
        ...(rousingSpeechTargets !== undefined ? { _rousingSpeechTargets: rousingSpeechTargets } : {}),
        ...(lifeSupportTargets !== undefined ? { _lifeSupportTargets: lifeSupportTargets } : {}),
        _isPlayerRoll: banner._playerInitiated === true,
        _fromHistory: banner !== lastBanner,
        _rollId: `sub-${dbId}`,
      });
      if (!isFirst) addPendingCosts(banner);
    }

    const currentDbIds = new Set(pendingBanners.map(b => b._rollDbId).filter(Boolean));
    for (const dbId of pendingBannerDbIdsRef.current) {
      if (!currentDbIds.has(dbId)) {
        pendingBannerDbIdsRef.current.delete(dbId);
        diceRollerRef.current?.dismissBannerByDbId?.(dbId);
      }
    }
  }, [pendingBanners, activeElements, wrappedPartyCharacters]);

  // Display overrides for banners (e.g. Fearless setWithHope via V2 review chip).
  const displayOverridesByRollId = useMemo(() => {
    const store = {};
    if (!pendingBanners?.length) return store;
    for (const roll of pendingBanners) {
      if (roll._rollDbId != null && chipHopeConvertedIds.has(roll._rollDbId)) {
        store[roll._rollDbId] = { ...(store[roll._rollDbId] || {}), dominantForDisplay: 'hope' };
      }
    }
    return store;
  }, [pendingBanners, chipHopeConvertedIds]);

  // Per-character rest move lists — merged V2 `passiveStatMods` (CONV-011) via `_v2RestSlotStats`.
  const restMovesPerCharacter = useMemo(() => {
    const restBanner = pendingBanners?.find(b => b._rest);
    if (!restBanner || !srdData) return {};
    const duration = restBanner._restDuration || 'short';
    const chars = activeElements.filter(e => e.elementType === 'character');
    const out = {};
    for (const c of chars) {
      const merged = mergeV2DeclarativeSheetOverlay(recomputeCharacter(c, srdData), c, srdData, {
        fearCount,
        mapConfig,
        tableFeatureState,
      });
      out[c.instanceId] = getRestMovesForCharacter(c, duration === 'long' ? 'long' : 'short', {
        mergedRestStats: merged._v2RestSlotStats,
      });
    }
    return out;
  }, [pendingBanners, activeElements, srdData, fearCount, mapConfig, tableFeatureState]);

  const restBannerChipsByInstanceId = useMemo(() => {
    const restBanner = pendingBanners?.find(b => b._rest);
    if (!restBanner || !srdData) return {};
    const duration = restBanner._restDuration === 'long' ? 'long' : 'short';
    const registry = buildV2RegistryWithSrdItems(srdData);
    const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
    const out = {};
    for (const c of activeElements.filter(e => e.elementType === 'character')) {
      const merged = mergeV2DeclarativeSheetOverlay(recomputeCharacter(c, srdData), c, srdData, {
        fearCount,
        mapConfig,
        tableFeatureState,
      });
      out[c.instanceId] = collectV2RestPlacementChipsForCharacter({
        mergedCharacterEl: merged,
        activeElements: activeForLoader,
        registry,
        restDuration: duration,
        fearCount,
        mapConfig,
        tableFeatureState,
      });
    }
    return out;
  }, [pendingBanners, activeElements, srdData, fearCount, mapConfig, tableFeatureState]);

  const restRefreshPreviewByInstanceId = useMemo(() => {
    const restBanner = pendingBanners?.find(b => b._rest);
    if (!restBanner || !srdData) return {};
    const duration = restBanner._restDuration === 'long' ? 'long' : 'short';
    const registry = buildV2RegistryWithSrdItems(srdData);
    const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
    const out = {};
    for (const c of activeElements.filter(e => e.elementType === 'character')) {
      const merged = mergeV2DeclarativeSheetOverlay(recomputeCharacter(c, srdData), c, srdData, {
        fearCount,
        mapConfig,
        tableFeatureState,
      });
      out[c.instanceId] = computeRestBannerRefreshPreview({
        characterEl: c,
        mergedCharacterEl: merged,
        activeElements: activeForLoader,
        registry,
        restDuration: duration,
        fearCount,
        mapConfig,
        tableFeatureState,
      });
    }
    return out;
  }, [pendingBanners, activeElements, srdData, fearCount, mapConfig, tableFeatureState]);

  // Ranger's Focus: Rangers who have a focused adversary (derived from focusedBy on adversaries).
  // We use the adversary's focusedBy field as the source of truth rather than focusTargetId on the
  // character, because the "Use on next attack" weapon path only sets focusedBy on the adversary.
  const rangerFocusRerollChars = tableCharacters
    .filter(c => (c.class || '').toLowerCase() === 'ranger' && (!isPlayer || c.assignedPlayerEmail === playerEmail))
    .map(c => {
      const focusedAdv = activeElements.find(el => el.elementType === 'adversary' && el.focusedBy === c.name);
      return { instanceId: c.instanceId, name: c.name, focusedAdversaryInstanceId: focusedAdv?.instanceId ?? null };
    })
    .filter(c => c.focusedAdversaryInstanceId != null);

  // Hold Them Off (Ranger): All Rangers have this as their hope ability. Show toggle when ≥3 Hope.
  // Hold Them Off is a hope ability (in hopeAbility/hopeFeature), NOT a classFeature entry.
  const holdThemOffChars = tableCharacters
    .filter(c =>
      (c.class || '').toLowerCase() === 'ranger' &&
      (c.hope ?? (c.maxHope ?? 6)) >= 3 &&
      (!isPlayer || c.assignedPlayerEmail === playerEmail)
    )
    .map(c => ({ instanceId: c.instanceId, name: c.name }));

  // Locked On (weapon): roll DB IDs where the attacker has lockedOnTargetInstanceId === selected target (auto-success badge)
  const lockedOnAutoSuccessRollDbIds = useMemo(() => {
    const set = new Set();
    if (!pendingBanners?.length) return set;
    for (const roll of pendingBanners) {
      const dbId = roll._rollDbId;
      if (!dbId || !roll._attackerInstanceId) continue;
      const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      const locked = attackerEl?.lockedOnTargetInstanceId;
      if (!locked) continue;
      const selectedId = roll._selectedTargetInstanceId ?? roll._selectedTargetInstanceIds?.[0];
      if (selectedId === locked) set.add(dbId);
    }
    return set;
  }, [pendingBanners, activeElements]);

  // Wings of Light (Winged Sentinel): characters currently flying — show "Spend Hope for d8" on their attack banners.
  const wingsOfLightFlyingInstanceIds = useMemo(() => {
    const set = new Set();
    for (const c of tableCharacters) {
      if (!isWingsOfLightFlying(c)) continue;
      const hasWings = (c.subclass === 'Winged Sentinel') ||
        (c.subclassFeatures || []).some(f => f.name === 'Wings of Light');
      if (hasWings && (!isPlayer || c.assignedPlayerEmail === playerEmail)) set.add(c.instanceId);
    }
    return set;
  }, [tableCharacters, isPlayer, playerEmail]);

  const difficultyValue = effectiveMods.lessDifficult ? 'lessDifficult' : effectiveMods.slightlyMoreDangerous ? 'slightlyMoreDangerous' : effectiveMods.moreDangerous ? 'moreDangerous' : '';
  const damageBoostValue = effectiveMods.damageBoostPlusOne ? 'plusOne' : effectiveMods.damageBoostD4 ? 'd4' : effectiveMods.damageBoostStatic ? 'static' : '';

  const showGmMovesChipTooltip = (e, feature) => {
    const item = consolidatedByCardKey.get(feature.cardKey);
    if (!item) return;
    const hf = { cardKey: feature.cardKey, featureKey: feature.featureKey, fromChip: true };
    setHoveredFeature(hf);
    gmMovesPortalTooltip.showFromPointerEvent(e, {
      wide: true,
      renderInner: (
        <GmMovesFeatureTooltipPanel
          item={item}
          feature={feature}
          hoveredFeature={hf}
          featureCountdowns={featureCountdowns}
          onAddAdversary={handleAddPotentialAdversary}
          scaledToggleState={scaledToggleState}
          onAdversaryScaledToggle={(id) => setScaledToggleState((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))}
          updateActiveElement={updateActiveElement}
        />
      ),
      extra: <span className="sr-only" aria-hidden>preview</span>,
    });
  };

  const renderGmMovesPassiveChip = (feature) => {
    const item = consolidatedByCardKey.get(feature.cardKey);
    const whenText = extractGmFeatureWhenClause(feature.description);
    return (
      <button
        type="button"
        key={`${feature.cardKey}-${feature.featureKey}`}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dh-strong bg-dh-raised/90 px-2 py-1 text-left text-xs text-dh transition-colors hover:border-dh-hope/40"
        onMouseEnter={(e) => {
          if (isTouch) return;
          if (!item) return;
          showGmMovesChipTooltip(e, feature);
        }}
        onMouseLeave={() => {
          gmMovesPortalTooltip.scheduleClose();
        }}
        onClick={(e) => {
          const canRoll = !!(feature._rollData || feature._diceRoll);
          if (canRoll) handleRoll(feature, e);
        }}
      >
        <span className="min-w-0 flex-1 truncate font-medium leading-snug">{whenText}</span>
        <span className="shrink-0 text-[10px] text-dh-muted">{feature.sourceName}</span>
      </button>
    );
  };

  const renderGmMovesFeatureCardRow = (feature, category) => {
    const rowItem = consolidatedByCardKey.get(feature.cardKey);
    const allCds = parseAllCountdownValues(feature.description);
    const cdKey = `${feature.cardKey}|${feature.featureKey}`;
    const cdVals = allCds.map((cd, cdIdx) =>
      featureCountdowns[`${cdKey}|${cdIdx}`] ?? cd.value
    );
    const canRoll = !!(feature._rollData || feature._diceRoll);
    const justRolled = rolledKey === cdKey;
    return (
      <div
        key={`${feature.cardKey}-${feature.featureKey}-${feature.name}`}
        onMouseEnter={(e) => {
          if (isTouch) return;
          if (!rowItem) return;
          showGmMovesChipTooltip(e, feature);
        }}
        onMouseLeave={() => {
          if (isTouch) return;
          gmMovesPortalTooltip.scheduleClose();
        }}
        onClick={(e) => {
          if (category === 'Fear Actions') {
            if (setFearCount) setFearCount((prev) => Math.max(0, prev - parseFearCost(feature.description)));
          }
          if (canRoll) handleRoll(feature, e);
        }}
        className={`group flex w-full rounded border bg-dh-raised/50 text-left transition-all hover:bg-dh-raised ${(category === 'Fear Actions' || canRoll) ? 'cursor-pointer' : 'cursor-default'} ${justRolled ? 'border-green-600 bg-green-900/20' : 'border-dh-strong hover:border-r-yellow-500'}`}
      >
        {feature._isRoleMove && (
          <div className="flex shrink-0 gap-[3px] py-1.5 pl-1">
            <div className="h-full w-1 rounded-full bg-dh-hope/90" />
            <div className="h-full w-1 rounded-full bg-fuchsia-500/85" />
          </div>
        )}
        <div className="min-w-0 flex-1 p-2">
          <div className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-dh">
              {feature.name}
              {canRoll && (
                <Dices size={11} className={`shrink-0 ${justRolled ? 'text-green-400' : 'text-dh-muted transition-colors group-hover:text-red-400'}`} />
              )}
            </span>
            <span className="shrink-0 rounded bg-dh-surface px-1.5 py-0.5 text-[10px] text-dh-muted">{feature.sourceName}</span>
          </div>
          {!feature._isRoleMove && feature.featureKey !== 'attack' && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-dh-muted">
              <FeatureDescription description={feature.description} />
            </p>
          )}
          {allCds.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-dh-strong pt-1.5" onClick={(e) => e.stopPropagation()}>
              {allCds.map((cd, cdIdx) => (
                <div key={cdIdx} className="flex items-center gap-1">
                  <span className="text-[10px] text-dh-muted">{allCds.length > 1 ? cd.label : 'Countdown'}</span>
                  <div className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => updateCountdown(feature.cardKey, feature.featureKey, cdIdx, Math.max(0, cdVals[cdIdx] - 1))}
                      className="flex h-4 w-4 items-center justify-center rounded bg-dh-hover text-[10px] font-bold leading-none text-dh transition-colors hover:bg-red-800"
                    >−</button>
                    <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums text-dh-hope">{cdVals[cdIdx]}</span>
                    <button
                      type="button"
                      onClick={() => updateCountdown(feature.cardKey, feature.featureKey, cdIdx, cdVals[cdIdx] + 1)}
                      className="flex h-4 w-4 items-center justify-center rounded bg-dh-hover text-[10px] font-bold leading-none text-dh transition-colors hover:bg-green-800"
                    >+</button>
                  </div>
                </div>
              ))}
              {!isPlayer && (
                <div className="w-full flex flex-wrap items-center gap-1 mt-1">
                  {allCds.map((cd, cdIdx) => {
                    const tracked = findSessionCountdownBySource(sessionCountdowns, feature.cardKey, feature.featureKey, cdIdx);
                    return (
                      <button
                        key={`track-${cdIdx}`}
                        type="button"
                        onClick={() => !tracked && trackSessionCountdownFromGmMove(feature, cd, cdIdx)}
                        disabled={!!tracked}
                        className={`text-[9px] px-1.5 py-0.5 rounded border ${tracked ? 'border-emerald-800/50 text-emerald-400/80 cursor-default' : 'border-dh-border text-dh-muted hover:text-dh-hope hover:border-dh-hope/40'}`}
                      >
                        {tracked ? 'On table' : 'Add to table'}
                      </button>
                    );
                  })}
                  {allCds.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => trackLinkedPairFromGmMove(feature, allCds)}
                      className="text-[9px] px-1.5 py-0.5 rounded border border-dh-border text-dh-muted hover:text-sky-400 hover:border-sky-500/40"
                    >
                      Track linked pair
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const gmMovesPrSection = (
    <CharacterSheetEmphasisCard title="Passives & Reactions" compact>
      <div className="pr-0.5">
        <div className="flex flex-wrap gap-1.5">
          {gmMovesPrFeatures.length === 0 ? (
            <span className="text-xs text-dh-muted">—</span>
          ) : (
            gmMovesPrFeatures.map(renderGmMovesPassiveChip)
          )}
        </div>
      </div>
    </CharacterSheetEmphasisCard>
  );
  const gmMovesActionsSection = (
    <CharacterSheetEmphasisCard title="Actions" compact>
      <div className="space-y-1.5 pr-0.5">
        {gmMovesActionFeatures.length === 0 ? (
          <span className="text-xs text-dh-muted">—</span>
        ) : (
          gmMovesActionFeatures.map((f) => renderGmMovesFeatureCardRow(f, 'Actions'))
        )}
      </div>
    </CharacterSheetEmphasisCard>
  );
  const gmMovesFearSection = (
    <CharacterSheetEmphasisCard title="Fear Actions" compact>
      <div className="space-y-1.5 pr-0.5">
        {gmMovesFearFeatures.length === 0 ? (
          <span className="text-xs text-dh-muted">—</span>
        ) : (
          gmMovesFearFeatures.map((f) => renderGmMovesFeatureCardRow(f, 'Fear Actions'))
        )}
      </div>
    </CharacterSheetEmphasisCard>
  );

  const gmMovesMainColumns = (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      {tallGmSection === 'pr' && (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2">{gmMovesPrSection}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {gmMovesActionsSection}
            {gmMovesFearSection}
          </div>
        </>
      )}
      {tallGmSection === 'actions' && (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2">{gmMovesActionsSection}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {gmMovesPrSection}
            {gmMovesFearSection}
          </div>
        </>
      )}
      {tallGmSection === 'fear' && (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2">{gmMovesFearSection}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {gmMovesPrSection}
            {gmMovesActionsSection}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Preview-as-player banner */}
      {previewAsPlayerEmail && (() => {
        const p = connectedPlayers.find(c => c.email === previewAsPlayerEmail);
        const name = p?.name || previewAsPlayerEmail;
        return (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-dh-raised border-b border-dh-strong text-dh text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="shrink-0" />
              <span>Previewing as <strong>{name}</strong></span>
            </div>
            <button
              onClick={onExitPreview}
              className="flex items-center gap-1 hover:text-dh transition-colors"
              title="Exit preview"
            >
              <EyeOff size={12} />
              Exit preview
            </button>
          </div>
        );
      })()}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Characters Panel */}
      <div className="w-56 bg-dh-canvas border-r border-dh-border flex flex-col overflow-y-auto shrink-0">
        <div className="p-3 bg-dh-canvas border-b border-dh-border sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-dh uppercase tracking-wider flex items-center gap-2 text-sm">
              <Users size={15} className="text-sky-400" /> Characters
            </h2>
            {!isPlayer && (
              <button
                onClick={() => setShowPlayerEmailPanel(p => !p)}
                className="text-dh-muted hover:text-sky-400 transition-colors"
                title="Manage invited players"
              ><Users size={13} /></button>
            )}
          </div>
          {/* Player email management (GM only) */}
          {!isPlayer && showPlayerEmailPanel && (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] text-dh-muted uppercase tracking-wider font-semibold">Invited Players</p>
              {playerEmails.map(email => {
                const connected = connectedPlayers.find(p => p.email === email);
                const isPreviewing = previewAsPlayerEmail === email;
                return (
                  <div key={email} className="flex items-center gap-1.5">
                    {connected && (
                      <Circle size={6} className="text-green-400 fill-green-400 shrink-0" />
                    )}
                    <span className="flex-1 text-xs text-dh truncate">{email}</span>
                    <button
                      onClick={() => onPreviewAsPlayer?.(isPreviewing ? null : email)}
                      title={isPreviewing ? 'Exit preview' : `Preview as ${connected?.name || email}`}
                      className={`shrink-0 transition-colors ${isPreviewing ? 'text-sky-400 hover:text-sky-300' : 'text-dh-muted hover:text-sky-400'}`}
                    >
                      {isPreviewing ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    <button
                      onClick={() => setPlayerEmails?.(prev => prev.filter(e => e !== email))}
                      className="text-dh-muted hover:text-red-400 transition-colors shrink-0"
                    ><X size={11} /></button>
                  </div>
                );
              })}
              {/* Email input with contacts autocomplete */}
              <div className="relative">
                <div className="flex gap-1">
                  <input
                    type="email"
                    placeholder="player@email.com"
                    value={playerEmailInput}
                    onChange={e => {
                      const val = e.target.value;
                      setPlayerEmailInput(val);
                      if (contactsDebounceRef.current) clearTimeout(contactsDebounceRef.current);
                      if (!val.trim() || !contactsToken) { setContactSuggestions([]); return; }
                      contactsDebounceRef.current = setTimeout(async () => {
                        setContactsLoading(true);
                        const results = await searchGoogleContacts(val, contactsToken);
                        setContactsLoading(false);
                        if (results === null) {
                          // token expired
                          setContactsToken(null);
                          setContactSuggestions([]);
                        } else {
                          setContactSuggestions(results.filter(r => !playerEmails.includes(r.email)));
                        }
                      }, 300);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { setContactSuggestions([]); return; }
                      if (e.key === 'Enter' && playerEmailInput.trim()) {
                        setPlayerEmails?.(prev => prev.includes(playerEmailInput.trim()) ? prev : [...prev, playerEmailInput.trim()]);
                        setPlayerEmailInput('');
                        setContactSuggestions([]);
                      }
                    }}
                    onBlur={() => setTimeout(() => setContactSuggestions([]), 150)}
                    className="flex-1 bg-dh-surface border border-dh-strong rounded px-2 py-1 text-xs text-dh outline-none focus:border-sky-500 min-w-0"
                  />
                  <button
                    onClick={() => {
                      if (playerEmailInput.trim()) {
                        setPlayerEmails?.(prev => prev.includes(playerEmailInput.trim()) ? prev : [...prev, playerEmailInput.trim()]);
                        setPlayerEmailInput('');
                        setContactSuggestions([]);
                      }
                    }}
                    className="px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded transition-colors shrink-0"
                  ><Plus size={11} /></button>
                </div>
                {/* Autocomplete dropdown */}
                {contactSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-0.5 bg-dh-raised border border-dh-strong rounded shadow-lg z-30 overflow-hidden">
                    {contactSuggestions.map(({ name, email }) => (
                      <button
                        key={email}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setPlayerEmails?.(prev => prev.includes(email) ? prev : [...prev, email]);
                          setPlayerEmailInput('');
                          setContactSuggestions([]);
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-dh-hover cursor-pointer"
                      >
                        {name && <span className="block text-xs text-dh truncate">{name}</span>}
                        <span className="block text-[10px] text-dh-muted truncate">{email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Connect Google Contacts prompt */}
                {!contactsToken && (
                  <button
                    onClick={async () => {
                      const token = await requestGoogleContactsAccess();
                      if (token) setContactsToken(token);
                    }}
                    className="mt-1 text-[10px] text-sky-500 hover:text-sky-400 transition-colors"
                  >
                    {contactsLoading ? 'Searching…' : '+ Connect Google Contacts'}
                  </button>
                )}
              </div>
              {/* Connected players */}
              {connectedPlayers.length > 0 && (
                <div className="pt-1 border-t border-dh-border">
                  <p className="text-[10px] text-dh-muted mb-1">Online ({connectedPlayers.length})</p>
                  {connectedPlayers.map(p => (
                    <div key={p.uid} className="flex items-center gap-1.5 text-[10px] text-dh">
                      <Circle size={6} className="text-green-400 fill-green-400 shrink-0" />
                      <span className="truncate">{p.name || p.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Player view: show who's online */}
          {isPlayer && connectedPlayers.length > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] text-dh-muted uppercase tracking-wider">Online ({connectedPlayers.length})</p>
              {connectedPlayers.map(p => (
                <div key={p.uid} className="flex items-center gap-1.5 text-[10px] text-dh">
                  <Circle size={6} className="text-green-400 fill-green-400 shrink-0" />
                  <span className="truncate">{p.name || p.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-2 space-y-3">
          {/* + Add Character button — opens the character picker */}
          <button
            type="button"
            ref={addCharacterAnchorRef}
            onClick={() => setModalOpen('characters')}
            className="w-full rounded-lg border border-dashed border-dh-strong bg-dh-raised/60 hover:border-sky-500/50 hover:bg-dh-hover px-2.5 py-1.5 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus size={12} className="text-sky-500" />
            <span className="text-xs font-semibold text-dh">Add Character</span>
          </button>

          {consolidatedElements.filter(item => item.kind === 'character').map(({ element: el }) => {
            const isMyCharacter = isPlayer && playerEmail != null && el.assignedPlayerEmail === playerEmail;
            const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(
              sessionPlayAllowed,
              isPlayer,
              isMyCharacter,
            );
            const gmTrackCheckbox = gmResourceTrackCheckboxEditsAllowed(isPlayer);
            const cardTrackUpdateFn = sheetOwner && gmTrackCheckbox ? updateActiveElement : undefined;
            const cardQueueManualTracks = allowPlayMechanics && gmTrackCheckbox ? queueManualTrackEdit : undefined;
            const pendingManual = findPendingManualTrackBanner(pendingBanners, el.instanceId);
            const manualAck = getPendingManualTrackAckDeltas(el, pendingManual);
            const lsHeal = getLifeSupportPendingHealSlots(pendingBanners, lifeSupportSelections, el.instanceId);
            const displayChar = characterDisplayByInstanceId.get(el.instanceId) ?? el;
            const charComplete = isCharacterComplete(el);
            return (
              <GameTableCharacterListCard
                key={el.instanceId}
                el={el}
                displayChar={displayChar}
                isMyCharacter={isMyCharacter}
                isPlayer={isPlayer}
                sheetTriggerProps={characterOverlay.triggerProps((e) => ({
                  element: el,
                  top: e.currentTarget.getBoundingClientRect().top,
                  bottom: e.currentTarget.getBoundingClientRect().bottom,
                }))}
                charComplete={charComplete}
                pendingResourceCosts={pendingResourceCosts}
                manualAck={manualAck}
                lsHeal={lsHeal}
                cardTrackUpdateFn={cardTrackUpdateFn}
                cardQueueManualTracks={cardQueueManualTracks}
                consumePendingStressForManualMark={consumePendingStressForManualMark}
                playerEmails={playerEmails}
                connectedPlayers={connectedPlayers}
                onAssignPlayerEmail={(instanceId, email) => updateActiveElement(instanceId, { assignedPlayerEmail: email })}
                onRemoveFromTable={
                  !isPlayer
                    ? (instanceId) => {
                        const row = activeElements.find((e) => e.instanceId === instanceId);
                        if (window.confirm(`Remove ${row?.name || 'Unnamed'} from the table?`)) removeActiveElement(instanceId);
                      }
                    : undefined
                }
                cardRootProps={{}}
                v2Registry={srdData ? v2Registry : null}
                v2TableContext={v2TableContextForPanels}
                onV2CardChipFactory={handleCharacterPanelV2CardChip}
                pendingBanners={pendingBanners}
              />
            );
          })}

          {consolidatedElements.filter(item => item.kind === 'character').length === 0 && (
            <div className="text-center text-dh-muted text-xs py-6">
              No characters yet.
            </div>
          )}

          {showConceptAiUi && (
            <div className="rounded-lg border border-violet-800/45 bg-violet-950/20 p-3 space-y-2">
              <label className="text-xs font-medium text-dh block">
                Describe a character concept, we&apos;ll match it as best as we can
              </label>
              <textarea
                value={characterPanelAiConcept}
                onChange={(e) => setCharacterPanelAiConcept(e.target.value)}
                onKeyDown={(e) =>
                  handleAiConceptTextareaKeyDown(e, {
                    canSubmit: !!characterPanelAiConcept.trim(),
                    onSubmit: () => {
                      const q = characterPanelAiConcept.trim();
                      if (!q) return;
                      void openNewCharacterEditor({ pendingAiConcept: q });
                      setCharacterPanelAiConcept('');
                    },
                  })
                }
                rows={3}
                className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-violet-500 focus:outline-none resize-y"
                placeholder="e.g. A cheerful halfling thief who grew up in a library…"
              />
              <button
                type="button"
                onClick={() => {
                  const q = characterPanelAiConcept.trim();
                  if (!q) return;
                  void openNewCharacterEditor({ pendingAiConcept: q });
                  setCharacterPanelAiConcept('');
                }}
                disabled={!characterPanelAiConcept.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-violet-700/60 bg-violet-900/50 text-violet-100 hover:bg-violet-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Build with AI
              </button>
              <AiDismissBuildWithAiLink />
            </div>
          )}
        </div>
      </div>

      {/* GM Moves — click to toggle; Escape / outside click close */}
      {gmMovesOverlay.isOpen && (
      <div
        ref={gmMovesOverlay.overlayRef}
        className="fixed z-[55] flex gap-2"
        style={{
          right: 'calc(14rem)',
          paddingRight: '8px',
          top: 90,
          width: 'min(96vw, calc(14rem + 28rem + 28rem + 2rem))',
          maxHeight: 'calc(100dvh - 98px)',
        }}
      >
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-dh-strong bg-dh-surface shadow-2xl"
          style={{ maxHeight: 'calc(100dvh - 98px)' }}
        >
          <div className="z-10 shrink-0 rounded-t-xl border-b border-dh-strong bg-dh-canvas p-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-dh">
              <Zap size={16} className="text-dh-hope" /> GM Moves
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex items-start gap-2 p-2">
            <div className="flex w-52 shrink-0 flex-col self-start overflow-hidden rounded-lg border border-dh-border bg-dh-surface/90">
              <div className="shrink-0 border-b border-dh-border bg-dh-canvas px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-dh-muted">Default Moves</span>
              </div>
              <div className="p-2">
                <div className="flex gap-2">
                  <div
                    className="relative w-4 shrink-0 cursor-default"
                    onMouseEnter={() => { if (!isTouch) setShowStripLegend(true); }}
                    onMouseLeave={() => { if (!isTouch) setShowStripLegend(false); }}
                    onClick={() => { if (isTouch) setShowStripLegend((v) => !v); }}
                  >
                    <div className="absolute left-0 w-1 rounded-full bg-dh-hope/90" style={{ top: 0, height: `${(HOPE_END / DEFAULT_GM_MOVES.length) * 100}%` }} />
                    <div className="absolute left-[5px] w-1 rounded-full bg-fuchsia-500/85" style={{ top: `${(FEAR_SUCCESS_START / DEFAULT_GM_MOVES.length) * 100}%`, height: `${((FEAR_SUCCESS_END - FEAR_SUCCESS_START) / DEFAULT_GM_MOVES.length) * 100}%` }} />
                    <div className="absolute left-[10px] w-1 rounded-full bg-blue-900" style={{ top: `${(FEAR_FAILURE_START / DEFAULT_GM_MOVES.length) * 100}%`, bottom: 0 }} />
                    {showStripLegend && (
                      <div className="pointer-events-none absolute left-6 top-0 z-50 w-48 rounded-lg border border-dh-strong bg-dh-raised p-3 shadow-xl">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-dh-muted">When to use</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-dh-hope" />
                            <span className="text-xs text-dh">Failure with Hope</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-fuchsia-500" />
                            <span className="text-xs text-dh">Success with Fear</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-blue-900" />
                            <span className="text-xs text-dh">Failure with Fear</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {DEFAULT_GM_MOVES.map((move, idx) => (
                      <div
                        key={idx}
                        onMouseEnter={(e) => {
                          if (isTouch) return;
                          gmMovesPortalTooltip.showFromPointerEvent(e, {
                            wide: true,
                            label: move.name,
                            description: move.example,
                          });
                        }}
                        onMouseLeave={() => gmMovesPortalTooltip.scheduleClose()}
                        onClick={(e) => {
                          if (!isTouch) return;
                          gmMovesPortalTooltip.showFromPointerEvent(e, {
                            wide: true,
                            label: move.name,
                            description: move.example,
                          });
                        }}
                        className="w-full cursor-default rounded px-2 py-1 text-left text-xs leading-snug text-dh transition-colors hover:bg-dh-raised"
                      >
                        {move.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {gmMovesMainColumns}
              {activeElements.length === 0 && (
                <div className="text-center text-xs text-dh-muted">
                  No active elements. Add adversaries, environments, or scenes to populate the table.
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Center Column */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-dh-canvas relative">
        {/* Pre-roll banner (onAct chips, e.g. Quick Reactions) — popover overlay */}
        {preRollBanner && (
          <div
            className="shrink-0 z-20 border-b border-dh-border bg-dh-surface/95 px-4 py-3 text-dh max-h-[min(50vh,420px)] overflow-y-auto pointer-events-auto"
            role="region"
            aria-labelledby="preroll-title"
          >
            <div className="max-w-3xl mx-auto w-full">
              <div id="preroll-title" className="text-sm font-bold text-dh mb-2">Before you roll</div>
              <p className="text-xs text-dh mb-2">Choose experience and optional toggles, then Proceed.</p>
              {preRollBanner.pending?.meta?._deferExperienceToPreRoll && (() => {
                const cel = activeElements.find(e => e.instanceId === preRollBanner.characterEl.instanceId) || preRollBanner.characterEl;
                const meta = preRollBanner.pending.meta;
                const isComp = meta._companionExperienceForRoll;
                const exps = isComp ? (cel.companion?.experiences || []) : (cel.experiences || []);
                const hope = cel.hope ?? (cel.maxHope ?? 6);
                if (exps.length === 0) return null;
                return (
                  <div className="mb-3 w-full">
                    <div className="text-[11px] font-semibold text-dh mb-1.5">
                      Experience <span className="text-dh-hope-soft font-normal">(1 Hope)</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {exps.map((exp, i) => {
                        const selected = isComp ? preRollCompanionExperienceIndex === i : preRollExperienceIndex === i;
                        const noHope = hope === 0;
                        const disabled = noHope && !selected;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (isComp) {
                                setPreRollCompanionExperienceIndex(selected ? null : i);
                              } else {
                                setPreRollExperienceIndex(selected ? null : i);
                              }
                            }}
                            className={`text-[11px] rounded px-2 py-0.5 border transition-colors font-medium
                              ${disabled
                                ? 'opacity-35 cursor-not-allowed bg-dh-raised border-dh-strong text-dh-muted'
                                : selected
                                  ? 'bg-sky-900/60 border-sky-500 text-sky-100 ring-1 ring-sky-500/50 cursor-pointer'
                                  : 'bg-dh-raised border-dh-strong text-dh hover:bg-dh-hover/60 hover:border-dh-strong cursor-pointer'}`}
                          >
                            {exp.name}
                            {exp.score != null && (
                              <span className={`font-bold ml-1 ${disabled ? 'text-dh-muted' : 'text-sky-400'}`}>+{exp.score}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {hope === 0 && (
                      <p className="text-[9px] text-red-500/70 mt-0.5">No Hope — cannot select an experience</p>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const chips = preRollBanner.chips;
                const diffChip = chips.find((c) => c._difficultyChip);
                const hasDifficultyChip = !!diffChip;
                const advantageTriggerIndices = chips.reduce((acc, c, i) => {
                  if (c._advantageTriggerChip) acc.push(i);
                  return acc;
                }, []);
                const showAdvantageSection = advantageTriggerIndices.length > 0 || hasDifficultyChip;

                const meta = preRollBanner.pending?.meta;
                const syntheticRoll = {
                  _attackerInstanceId: meta?._attackerInstanceId ?? preRollBanner.characterEl?.instanceId,
                  _attackerType: meta?._attackerType,
                  _weaponRangeFt: meta?._weaponRangeFt,
                  _attackRangeFt: meta?._attackRangeFt,
                  _attackerInstanceIds: meta?._attackerInstanceIds,
                  _featureNeedsTarget: meta?._featureNeedsTarget,
                };
                const rawPrerollTargets = getTargetsForRoll(syntheticRoll);
                const isPcAttack = syntheticRoll._attackerInstanceId != null && syntheticRoll._attackerType !== 'adversary';
                const prerollIntentTargets = isPcAttack
                  ? rawPrerollTargets.filter((t) => t.type === 'adversary')
                  : rawPrerollTargets.filter((t) => t.type === 'character');
                const prerollTargetRangeLabel =
                  meta?._weaponRangeFt != null
                    ? rangeFtToLabel(meta._weaponRangeFt)
                    : meta?._attackerType === 'adversary' && meta?._attackRangeFt != null
                      ? rangeFtToLabel(meta._attackRangeFt)
                      : null;
                const showPreRollTargetPicker = !!meta?._selectedTargetInstanceId && prerollIntentTargets.length > 0;

                const celForIntent =
                  activeElements.find((e) => e.instanceId === preRollBanner.characterEl.instanceId) ||
                  preRollBanner.characterEl;
                const syntheticRollForV2Intent =
                  srdData &&
                  (meta?._weaponRangeFt != null || meta?._weaponId != null
                    ? buildV2PreRollWeaponAttackRollSkeleton({
                        pendingMeta: meta,
                        pendingRollText: preRollBanner.pending.rollText,
                        characterEl: celForIntent,
                      })
                    : buildV2PreRollTraitRollSkeleton({
                        pendingMeta: meta,
                        pendingRollText: preRollBanner.pending.rollText,
                        characterEl: celForIntent,
                      }));

                const renderPrerollToggle = (i, emerald) => {
                  const chip = chips[i];
                  const selected = selectedPreRollChips[i];
                  const used = chip._used;
                  const v2Hint =
                    chip._v2IntentChip && syntheticRollForV2Intent
                      ? getV2ReviewChipDisableHint(chip, syntheticRollForV2Intent, activeElements, srdData, {
                          fearCount,
                          mapConfig,
                          tableFeatureState,
                        })
                      : null;
                  const v2Disabled = !!v2Hint;
                  const label = chip.label ?? chip.name ?? '';
                  const costParts = [];
                  if (chip.stressCost) costParts.push(`${chip.stressCost} Stress`);
                  if (chip.hopeCost) costParts.push(`${chip.hopeCost} Hope`);
                  const costLabel = costParts.length ? ` (${costParts.join(', ')})` : '';
                  const cycleWord = getFrequencyCycleWord(chip.resetsOn);
                  const descForTooltip =
                    typeof chip.description === 'string' && chip.description.trim() !== ''
                      ? chip.description.trim()
                      : null;
                  const tooltipLabel = used
                    ? (cycleWord ? `Already used (${cycleWord})` : 'Already used')
                    : v2Hint || (descForTooltip ?? label) + costLabel;
                  const selEmerald = emerald && selected && !used && !v2Disabled;
                  const unselEmerald = emerald && !selected && !used && !v2Disabled;
                  return (
                    <Tooltip key={i} label={tooltipLabel} placement="bottom-left">
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={used || v2Disabled}
                          onClick={used || v2Disabled ? undefined : () => setSelectedPreRollChips((prev) => {
                            const next = [...prev];
                            next[i] = !next[i];
                            return next;
                          })}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            used
                              ? 'border-dh-strong bg-dh-raised/30 text-dh-muted cursor-not-allowed opacity-70'
                              : selEmerald
                                ? 'border-emerald-600 bg-emerald-900/50 text-emerald-100'
                                : unselEmerald
                                  ? 'border-emerald-700/60 bg-emerald-950/35 text-emerald-200/90 hover:border-emerald-500 hover:bg-emerald-900/30'
                                  : selected
                                    ? 'border-sky-500 bg-sky-950/40 text-dh ring-1 ring-sky-500/40'
                                    : 'border-dh-strong bg-dh-raised/40 text-dh-muted hover:border-dh-strong hover:text-dh'
                          }`}
                        >
                          <Square size={12} className={`shrink-0 ${selected && !used ? 'hidden' : ''}`} />
                          <CheckSquare size={12} className={`shrink-0 ${selected && !used ? '' : 'hidden'}`} />
                          <span className="truncate max-w-[180px]">{label}</span>
                          {!used && <FeatureResourceCostIcons action={chip} iconSize={9} className="ml-0.5" />}
                          {chip.resetsOn && (
                            <FrequencyCycleChipSuffix frequency={chip.resetsOn} iconSize={9} className="ml-0.5" />
                          )}
                        </button>
                      </span>
                    </Tooltip>
                  );
                };

                return (
                  <>
                    {hasDifficultyChip && (
                      <div className="mb-3 w-full flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-dh" htmlFor="preroll-difficulty">
                          {diffChip.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="preroll-difficulty"
                            type="range"
                            min={5}
                            max={30}
                            step={1}
                            value={preRollDifficulty}
                            onChange={(e) => setPreRollDifficulty(Number(e.target.value))}
                            className="flex-1 h-2 rounded-full appearance-none bg-gradient-to-r from-slate-600 to-slate-900 cursor-pointer accent-sky-500"
                            aria-label="Difficulty (DC 5–30)"
                          />
                          <span className="text-sm font-bold tabular-nums text-dh shrink-0 w-8" aria-live="polite">
                            {preRollDifficulty}
                          </span>
                        </div>
                        <span className="text-[10px] text-dh-muted">{getDifficultyLabel(preRollDifficulty)}</span>
                      </div>
                    )}
                    {showPreRollTargetPicker && (
                      <div className="mb-3 w-full flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-dh">
                          Target{prerollTargetRangeLabel ? ` (within ${prerollTargetRangeLabel})` : ''}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {prerollIntentTargets.map((t) => {
                            const selected = preRollTargetInstanceId === t.instanceId;
                            return (
                              <button
                                key={t.instanceId}
                                type="button"
                                onClick={() => setPreRollTargetInstanceId(t.instanceId)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                                  selected
                                    ? 'border-sky-500 bg-sky-950/40 text-dh ring-1 ring-sky-500/40'
                                    : 'border-dh-strong bg-dh-raised/40 text-dh hover:border-dh-strong hover:text-dh'
                                }`}
                              >
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-dh-muted">
                          Same valid targets as the in-sheet picker (range, map position, etc.).
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 items-center mb-3">
                      {chips.map((chip, i) => {
                        if (chip._difficultyChip || chip._advantageTriggerChip) return null;
                        return renderPrerollToggle(i, false);
                      })}
                    </div>
                    {showAdvantageSection && (
                      <div className="mb-3 w-full flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-dh">Advantage</span>
                        {advantageTriggerIndices.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {advantageTriggerIndices.map((ti) => renderPrerollToggle(ti, true))}
                          </div>
                        )}
                        {hasDifficultyChip && (
                          <>
                            {preRollAdvantages.map((name, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={name}
                                  onChange={(e) => setPreRollAdvantages((prev) => {
                                    const next = [...prev];
                                    next[idx] = e.target.value;
                                    return next;
                                  })}
                                  placeholder="Advantage"
                                  className="flex-1 min-w-0 rounded px-2 py-1 text-[11px] bg-dh-raised border border-dh-strong text-dh placeholder-dh-muted focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                  aria-label="Advantage name"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreRollAdvantages((prev) => prev.filter((_, i) => i !== idx))}
                                  className="shrink-0 p-1 rounded text-dh-muted hover:bg-dh-hover hover:text-dh"
                                  aria-label="Remove advantage"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setPreRollAdvantages((prev) => [...prev, ''])}
                              className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-dh-muted hover:text-sky-400 hover:bg-dh-raised/80 border border-dh-strong hover:border-dh-strong"
                            >
                              <Plus size={12} /> Add advantage [d6]
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {hasDifficultyChip && (
                      <div className="mb-3 w-full flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-dh">Disadvantage</span>
                        {preRollDisadvantages.map((name, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setPreRollDisadvantages((prev) => {
                                const next = [...prev];
                                next[idx] = e.target.value;
                                return next;
                              })}
                              placeholder="Disadvantage"
                              className="flex-1 min-w-0 rounded px-2 py-1 text-[11px] bg-dh-raised border border-dh-strong text-dh placeholder-dh-muted focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                              aria-label="Disadvantage name"
                            />
                            <button
                              type="button"
                              onClick={() => setPreRollDisadvantages((prev) => prev.filter((_, i) => i !== idx))}
                              className="shrink-0 p-1 rounded text-dh-muted hover:bg-dh-hover hover:text-dh"
                              aria-label="Remove disadvantage"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPreRollDisadvantages((prev) => [...prev, ''])}
                          className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-dh-muted hover:text-sky-400 hover:bg-dh-raised/80 border border-dh-strong hover:border-dh-strong"
                        >
                          <Plus size={12} /> Add disadvantage [d6]
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreRollProceed}
                  className="px-3 py-1.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-hover text-dh hover:bg-dh-strong"
                >
                  Proceed
                </button>
                <button
                  type="button"
                  onClick={clearPreRollBanner}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* GM read-only intent banner: shown when a player has opened their pre-roll banner */}
        {!isPlayer && pendingPlayerIntent && createPortal(
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-3 py-2.5 rounded-xl shadow-2xl bg-dh-surface/95 border border-dh-strong text-dh flex flex-col gap-1.5 pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-dh-muted">Intent</span>
              <span className="text-[11px] font-semibold text-dh truncate">{pendingPlayerIntent.characterName}</span>
            </div>
            {pendingPlayerIntent.rollText && (
              <p className="text-[10px] text-dh-muted truncate font-mono">{pendingPlayerIntent.rollText}</p>
            )}
            {pendingPlayerIntent.chips?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pendingPlayerIntent.chips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-dh-inset border border-dh-border text-dh">
                    <span className="truncate max-w-[140px]">{chip.label || chip.description}</span>
                    <FeatureResourceCostIcons action={chip} iconSize={9} />
                  </span>
                ))}
              </div>
            )}
            <p className="text-[9px] text-dh-muted italic">Player is deciding — dice haven't rolled yet.</p>
          </div>,
          document.body
        )}

        {typeof document !== 'undefined' && playBlockedDialog && !isPlayer && createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-blocked-dialog-title"
            onClick={cancelPlayBlockedDialog}
          >
            <div
              className="max-w-md w-full rounded-xl border border-dh-strong bg-dh-surface p-5 shadow-2xl text-dh"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="play-blocked-dialog-title" className="text-base font-semibold text-dh mb-2">
                {sessionStarted === false ? 'Session not started' : 'Session paused'}
              </h2>
              <p className="text-sm text-dh-muted mb-4">
                {sessionStarted === false
                  ? 'Play is blocked until you start the session. You can cancel, apply this one action, or allow all further edits until you reload — prep mode stays on.'
                  : 'Play is blocked while the session is paused. You can cancel, apply this one action, or allow all further edits until you reload — the pause stays.'}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  tabIndex={0}
                  className="px-3 py-1.5 rounded-lg text-sm border border-dh-strong bg-dh-raised text-dh hover:bg-dh-hover"
                  onClick={cancelPlayBlockedDialog}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  tabIndex={0}
                  title="Until page reload"
                  className="px-3 py-1.5 rounded-lg text-sm border border-sky-700/70 bg-sky-950/50 text-sky-100 hover:bg-sky-900/60"
                  onClick={allowAllEditsAndConfirmPending}
                >
                  Allow all edits
                </button>
                <button
                  type="button"
                  tabIndex={0}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-700/80 bg-amber-900/50 text-amber-100 hover:bg-amber-800/60"
                  onClick={() => confirmPlayBlockedDialog(playBlockedDialog)}
                >
                  Do it anyway
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Whiteboard — self-managing; relative so the DiceRoller overlay anchors here */}
        <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col relative">
          <DiceRoller
            ref={diceRollerRef}
            isPlayer={isPlayer}
            diceCanvasHidden={diceCanvasHidden}
            currentUserUid={user?.uid}
            onBannerAcknowledge={!isPlayer ? handleBannerAcknowledge : undefined}
            onBannerCancel={!isPlayer ? handleBannerCancel : (tableId ? (bannerId, roll) => postBannerCancel(tableId, roll._rollDbId).catch(() => {}) : undefined)}
            lifeSupportSelections={lifeSupportSelections}
            onLifeSupportSelect={onLifeSupportSelect}
            onLifeSupportClear={onLifeSupportClear}
            restMovesSelections={restMovesSelections}
            onRestMoveSelect={onRestMoveSelect}
            onRestMoveClear={onRestMoveClear}
            restTableCharacters={activeElements.filter(e => e.elementType === 'character')}
            restMovesPerCharacter={restMovesPerCharacter}
            restBannerChipsByInstanceId={restBannerChipsByInstanceId}
            restRefreshPreviewByInstanceId={restRefreshPreviewByInstanceId}
            onRestBannerV2Chip={handleRestBannerV2Chip}
            restCanEditColumn={isPlayer ? (instanceId) => {
              const el = activeElements.find(e => e.instanceId === instanceId);
              const byUid = el?.assignedPlayerUid === user?.uid;
              const byEmail = !!playerEmail && el?.assignedPlayerEmail === playerEmail;
              return byUid || byEmail;
            } : () => true}
            restGmUid={tableId}
            actionAdversarySelections={actionAdversarySelections}
            onActionAdversarySelect={(rollDbId, instanceId) => {
              setActionAdversarySelections(prev => ({ ...prev, [rollDbId]: instanceId }));
              // Sync selection to server so all clients (GM + player) see the same choice
              postBannerMakeASceneTarget(tableId, rollDbId, instanceId).catch(() => {});
            }}
            actionAdversaryTargets={actionAdversaryTargets}
            targets={isPlayer ? [] : damageTargets}
            getTargetsForRoll={getTargetsForRoll}
            getTargetDisadvantageLabels={!isPlayer ? getTargetDisadvantageLabels : undefined}
            onApplyDamage={isPlayer ? undefined : handleApplyDamage}
            onApplyVulnerable={!isPlayer ? handleApplyVulnerable : undefined}
            onConcussiveKnock={!isPlayer ? handleConcussiveKnock : undefined}
            canApplyDamage={!isPlayer}
            onQuickTarget={isPlayer ? undefined : handleQuickTarget}
            onDoubledUpTarget={isPlayer ? undefined : handleDoubledUpTarget}
            onBouncingTarget={isPlayer ? undefined : handleBouncingTarget}
            wizardsWithHope={isPlayer ? [] : wizardsWithHope}
            onNotThisTime={isPlayer ? undefined : handleNotThisTime}
            displayOverridesByRollId={displayOverridesByRollId}
            tableCharacters={tableCharacters}
            sessionRole={chipViewer.sessionRole}
            rangerFocusRerollChars={rangerFocusRerollChars}
            onRangerFocusReroll={isPlayer ? undefined : handleRangerFocusReroll}
            onRangerFocusRerollRequest={isPlayer ? handleRangerFocusRerollRequest : undefined}
            rangerFocusRequestedBannerIds={rangerFocusRequestedBannerIds}
            holdThemOffChars={holdThemOffChars}
            onHoldThemOffToggle={tableId ? handleHoldThemOffToggle : undefined}
            lockedOnAutoSuccessRollDbIds={lockedOnAutoSuccessRollDbIds}
            onBannerTargetsChange={tableId ? handleBannerTargetsChange : undefined}
            wingsOfLightFlyingInstanceIds={wingsOfLightFlyingInstanceIds}
            onWingsD8Toggle={!isPlayer ? handleWingsD8Toggle : undefined}
            onWingsD8ToggleRequest={isPlayer && tableId ? handleWingsD8ToggleRequest : undefined}
            onGetWingsD8Extra={!isPlayer ? getWingsD8Extra : undefined}
            getV2DamageBannerAckNotices={!isPlayer ? getV2DamageBannerAckNotices : undefined}
            bannerStripLeftOffset={tableCharacters.length > 0 ? CHARACTER_TRAY_WIDTH_PX : 0}
            v2ReviewChipsByRollDbId={v2ReviewChipsByRollDbId}
            onV2ReviewChip={isPlayer ? handlePlayerV2ReviewChip : handleV2ReviewChip}
            resolveV2ReviewChipPicker={getV2ReviewChipPicker}
            getV2ReviewChipDisableHint={getV2ReviewChipDisableHintCb}
            canUseV2ReviewChips={!isPlayer || !!playerViewerCharacterInstanceId}
            getV2PendingMoveBlockInfo={!isPlayer ? getV2PendingMoveBlockInfo : undefined}
          />
          <BattleMap
            gmUid={tableId}
            user={user}
            isPlayer={isPlayer}
            activeElements={activeElements}
            updateActiveElement={updateActiveElement}
            queueManualTrackEdit={queueManualTrackEdit}
            pendingBanners={pendingBanners}
            pendingResourceCosts={pendingResourceCosts}
            lifeSupportSelections={lifeSupportSelections}
            mapConfig={mapConfig}
            maps={maps}
            activeMapId={activeMapId}
            gmMapView={gmMapView}
            mapViews={mapViews}
            gmActiveViewId={gmActiveViewId}
            onSetActiveView={onSetActiveView}
            onAddMapViewOp={onAddMapViewOp}
            onRemoveMapView={onRemoveMapView}
            onRenameMapView={onRenameMapView}
            onSetViewBroadcast={onSetViewBroadcast}
            onSetMapShare={onSetMapShare}
            playerSelectedViewId={playerSelectedViewId}
            onPlayerSelectView={onPlayerSelectView}
            playerFreeMapExplore={playerFreeMapExplore}
            playerFreeExploreMapId={playerFreeExploreMapId}
            onPlayerEnterMapFreeExplore={onPlayerEnterMapFreeExplore}
            onPlayerExitMapFreeExplore={onPlayerExitMapFreeExplore}
            onMapFreeExplore={onMapFreeExplore}
            onForcePlayersToMapView={onForcePlayersToMapView}
            onSetActiveMap={onSetActiveMap}
            onAddMap={onAddMap}
            onAddMapWithImage={onAddMapWithImage}
            onRemoveMap={onRemoveMap}
            onRenameMap={onRenameMap}
            tableId={tableId}
            onMapConfigChange={onMapConfigChange}
            onMapViewSync={onMapViewSync}
            tableName={tableName}
            tableStateReady={tableStateReady}
            onTableNameChange={onTableNameChange}
            onDeleteTable={onDeleteTable}
            onClearDice={() => diceRollerRef.current?.clearDice?.()}
            diceCanvasHidden={diceCanvasHidden}
            onToggleDiceVisibility={() => setDiceCanvasHidden(v => !v)}
            pendingBannerCount={!isPlayer ? (pendingBanners?.length ?? 0) : 0}
            onCancelAllBanners={!isPlayer ? handleCancelAllBanners : undefined}
            onTokenDragEnd={!isPlayer ? handleTokenDragEnd : undefined}
            mapPings={mapPings}
            onDismissMapPing={onDismissMapPing}
            appendMapPing={appendMapPing}
            mapScribbles={mapScribbles}
            onSetMapOverlay={onSetMapOverlay}
            onSetMapViewOverlay={onSetMapViewOverlay}
            onViewportAspectChange={onBattleMapViewportAspectChange}
            className="flex-1 min-h-0"
            renderPinnedCharacterPanel={renderPinnedCharacterPanel}
            renderAdversaryTargetAid={renderAdversaryTargetAid}
          />
        </div>
        {/* Action log footer — collapsed title bar; click to open overlay with roll/action history */}
        <ActionLog
          rolls={actionLog}
          rollBuilder={{ onRoll: (rollText, displayName) => postRoll(rollText, displayName, tableId).catch(err => handleRollTransportError(err, 'Action log roll failed:')), displayName: user?.displayName || user?.email || (isPlayer ? 'Player' : 'GM') }}
        />
      </div>

      {/* Encounter Panel — hidden for players */}
      {!isPlayer && <div className="w-56 bg-dh-canvas border-l border-dh-border flex min-h-0 shrink-0 flex-col overflow-hidden">
        <div className="px-2 py-2 bg-dh-canvas border-b border-dh-border sticky top-0 z-10 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-dh uppercase tracking-wider flex items-center gap-2 text-sm">
              <Swords size={15} className="text-red-400" /> Encounter
            </h2>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setCaptureOpen(true)}
                disabled={activeElements.length === 0}
                title="Save current table as a Scene"
                className="p-1 rounded text-dh-muted hover:text-dh disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              ><Camera size={13} /></button>
              <button
                onClick={() => {
                  if (!window.confirm('Clear all adversaries, environments, and notes from the table? This cannot be undone.')) return;
                  clearTable?.();
                }}
                disabled={activeElements.length === 0}
                title="Remove all items from the table"
                className="p-1 rounded text-dh-muted hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              ><Trash2 size={13} /></button>
            </div>
          </div>
          {/* Session / Rest cycle buttons */}
          <div className="flex items-center gap-1">
            {sessionPlayAllowed ? (
              <button
                type="button"
                title="End Session — pause play mechanics until you start again"
                onClick={() => { void handleEndSession(); }}
                className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-rose-800/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 hover:border-rose-600 transition-colors"
              >■ End</button>
            ) : sessionPaused ? (
              <button
                type="button"
                title="Resume Session — table was idle; click to continue play"
                onClick={() => { void handleResumeSession(); }}
                className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-emerald-800/60 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 hover:border-emerald-700 transition-colors"
              >▶ Resume</button>
            ) : (
              <button
                type="button"
                title="Start Session — acknowledge to reset session uses, modifiers, and session-start hooks"
                onClick={() => handleSessionCycle('session')}
                className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-emerald-800/60 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 hover:border-emerald-700 transition-colors"
              >▶ Session</button>
            )}
            <button
              title="Short Rest — refresh rest-use features for all characters"
              onClick={() => handleSessionCycle('rest')}
              className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-sky-800/60 bg-sky-950/30 text-sky-400 hover:bg-sky-900/40 hover:border-sky-700 transition-colors"
            >⏸ Short</button>
            <button
              title="Long Rest — refresh rest and long-rest features for all characters"
              onClick={() => handleSessionCycle('longRest')}
              className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-dh-strong bg-dh-hover text-dh hover:bg-dh-strong transition-colors"
            >⏹ Long</button>
          </div>
          {/* Fear tracker */}
          <div className="rounded-lg border border-dh-strong bg-dh-surface px-2.5 py-2">
            <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5">
              <Flame size={12} className="shrink-0 text-fuchsia-400" />
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-fuchsia-400/90">
                FEAR
              </span>
              <CheckboxTrack
                className="min-w-0"
                fillRow
                total={6}
                filled={Math.min(fearCount, 6)}
                onSetFilled={(v) => setFearCount && setFearCount(v)}
                trackKind="fear"
                label="Fear"
                verbs={['Gain', 'Spend']}
                currentAbsoluteValue={fearCount}
                targetToAbsolute={(v) => v}
              />
              <Flame size={12} className="invisible shrink-0" aria-hidden />
              <span className="invisible shrink-0 text-[10px] font-bold uppercase tracking-widest" aria-hidden>
                FEAR
              </span>
              <CheckboxTrack
                className="min-w-0"
                fillRow
                total={6}
                filled={Math.max(0, fearCount - 6)}
                onSetFilled={(v) => setFearCount && setFearCount(v + 6)}
                trackKind="fear"
                label="Fear"
                verbs={['Gain', 'Spend']}
                currentAbsoluteValue={fearCount}
                targetToAbsolute={(v) => v + 6}
              />
            </div>
          </div>
          {/* GM Moves hover trigger */}
          <div
            data-testid="gm-moves-trigger"
            className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 transition-colors cursor-pointer ${gmMovesOverlay.isOpen ? 'border-dh-hope/60 bg-dh-inset' : 'border-dh-strong bg-dh-surface hover:border-dh-hope/40'}`}
            {...gmMovesOverlay.triggerProps(true)}
          >
            <Zap size={14} className="text-dh-hope shrink-0" />
            <span className="text-xs font-semibold text-dh uppercase tracking-wider flex-1">GM Moves</span>
            {(() => {
              const count = Object.values(consolidatedMenu).reduce((sum, f) => sum + f.length, 0);
              return count > 0 ? <span className="text-[10px] text-dh-muted tabular-nums">{count}</span> : null;
            })()}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
          <div className="border-t border-dh-border" role="separator" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Notes</p>
            <button
              type="button"
              onClick={() => handleAddEmptyNote()}
              title="Add note"
              className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
            >
              + Add
            </button>
          </div>
          {consolidatedElements.filter(item => item.kind === 'note').map((item) => {
            const el = item.element;
            const noteBodyTrimmed = String(el.body || '').trim();
            const noteTitleOnly = !noteBodyTrimmed && !el.imageUrl;
            return (
              <div
                key={el.instanceId}
                className={`flex gap-1 rounded-lg border border-amber-900/50 bg-amber-950/25 px-2 transition-colors hover:border-amber-700/60 hover:bg-amber-950/40 ${noteTitleOnly ? 'py-1.5' : 'py-2'}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    updateActiveElement(el.instanceId, {
                      visibility: el.visibility === 'gm' ? 'players' : 'gm',
                    })
                  }
                  className="shrink-0 self-start rounded p-0.5 text-dh-muted hover:bg-dh-hover/60 hover:text-dh"
                  title={
                    el.visibility === 'gm'
                      ? 'GM only — click to show players'
                      : 'Visible to players — click for GM only'
                  }
                  aria-label={el.visibility === 'gm' ? 'Show to players' : 'GM only'}
                  aria-pressed={el.visibility === 'gm'}
                >
                  {el.visibility === 'gm' ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`${gameTableBasePath}/notes/${el.id}`);
                    setEditState({
                      step: 'note',
                      item: {
                        id: el.id,
                        name: el.name || 'Note',
                        body: el.body || '',
                        imageUrl: el.imageUrl || '',
                        visibility: el.visibility === 'gm' ? 'gm' : 'players',
                      },
                      baseElement: el,
                    });
                  }}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  {el.imageUrl ? (
                    <span className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded border border-amber-800/50 bg-dh-inset">
                      <img src={el.imageUrl} alt="" className="h-full w-full object-cover" />
                    </span>
                  ) : (
                    <StickyNote size={14} className="mt-0.5 shrink-0 text-amber-400/90" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-amber-100/90">{el.name || 'Note'}</div>
                    {noteBodyTrimmed ? (
                      <div className="mt-1 max-h-24 overflow-hidden text-left">
                        <MarkdownText text={noteBodyTrimmed} className="dh-md text-[11px] leading-snug text-dh-muted line-clamp-6" />
                      </div>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeActiveElement(el.instanceId)}
                  className="shrink-0 self-start text-dh-muted hover:text-red-400 transition-colors p-0.5"
                  title="Remove note"
                ><X size={12} /></button>
              </div>
            );
          })}

          <div className="border-t border-dh-border" role="separator" />
          <SessionCountdownsPanel
            variant="section"
            sectionTitle="Countdowns"
            sessionCountdowns={sessionCountdowns}
            isGm
            onTableOp={sendOp}
          />

          <div className="border-t border-dh-border" role="separator" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Environments</p>
            <button
              type="button"
              onClick={() => setModalOpen('environments')}
              title="Add environment"
              className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
            >
              + Add
            </button>
          </div>
          {consolidatedElements.filter(item => item.kind === 'environment').map((item) => {
            const el = item.element;
            return (
              <div
                key={el.instanceId}
                className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 overflow-hidden group/env"
                {...trackerOverlay.triggerProps(e => ({ kind: 'environment', element: item.element, top: e.currentTarget.getBoundingClientRect().top, bottom: e.currentTarget.getBoundingClientRect().bottom }))}
              >
                <div className="px-2.5 py-1.5 flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-emerald-300/80 truncate flex-1">{el.name}</span>
                  <button
                    onClick={() => { removeActiveElement(el.instanceId); trackerOverlay.close(); }}
                    className="hidden group-hover/env:block text-dh-muted hover:text-red-400 transition-colors shrink-0"
                    title="Remove from table"
                  ><X size={12} /></button>
                </div>
              </div>
            );
          })}

          <div className="border-t border-dh-border" role="separator" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Adversaries</p>
            <button
              type="button"
              onClick={() => setModalOpen('adversaries')}
              title="Add adversary"
              className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
            >
              + Add
            </button>
          </div>
          {/* Battle Budget card */}
          <div className="rounded-lg bg-dh-surface border border-dh-border overflow-hidden">
            <button
              onClick={() => setBudgetCardOpen(o => !o)}
              className="w-full px-2.5 py-2 flex items-center gap-1.5 text-left hover:bg-dh-raised/50 transition-colors"
            >
              {budgetCardOpen
                ? <ChevronDown size={11} className="text-dh-muted shrink-0" />
                : <ChevronRight size={11} className="text-dh-muted shrink-0" />
              }
              <span className="text-xs font-semibold text-dh-muted uppercase tracking-wider flex-1">BP Budget</span>
              <span className="text-xs tabular-nums text-dh-muted">
                <span className="font-bold text-dh">{tableBP}</span>
                <span className="text-dh-muted"> of </span>
                <span className="font-bold text-dh">{adjustedBudget}</span>
              </span>
              {tableBP > 0 && (
                <span className={`text-[10px] font-semibold tabular-nums ml-1 ${tableDiffColor}`}>
                  {tableDiff === 0 ? '=' : tableDiff > 0 ? `+${tableDiff}` : `${tableDiff}`}
                </span>
              )}
            </button>
            {budgetCardOpen && (
              <div className="border-t border-dh-border px-2.5 py-2.5 space-y-3">
                <div className="text-xs">
                  <span className="text-dh-muted">({partySize} PCs × 3) + 2 = </span>
                  <span className="font-bold text-dh tabular-nums">{tableBudget}</span>
                  {totalMod !== 0 && (
                    <>
                      <span className={`tabular-nums ${totalMod < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {' '}{totalMod > 0 ? `+${totalMod}` : totalMod}
                      </span>
                      <span className="text-dh-muted"> = </span>
                      <span className="font-bold text-dh tabular-nums">{adjustedBudget}</span>
                    </>
                  )}
                  <span className="text-dh-muted"> BP</span>
                </div>

                {activeAutoMods.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-dh-muted uppercase tracking-wide">Auto-detected</p>
                    {activeAutoMods.map(m => {
                      const isLowerTier = m === tableAutoMods.lowerTierAdversary;
                      const topTierChars = isLowerTier
                        ? tableCharacters.filter(c => (c.tier ?? 1) >= (m.partyTier ?? 1))
                        : [];
                      const lowerAdvs = isLowerTier
                        ? [...new Map((m.lowerTierItems || []).map(a => [a.name || a.role, a])).values()]
                        : [];
                      return (
                        <div key={m.label} className="flex items-start justify-between text-xs gap-2">
                          <div className="flex flex-col gap-0.5 leading-tight min-w-0">
                            <span className="text-dh">{m.label}</span>
                            {isLowerTier && (
                              <>
                                <span className="text-[10px] text-sky-400/80 leading-snug">
                                  Party T{m.partyTier ?? 1}{topTierChars.length > 0 ? `: ${topTierChars.map(c => c.name).join(', ')}` : ''}
                                </span>
                                {lowerAdvs.length > 0 && (
                                  <span className="text-[10px] text-emerald-400/70 leading-snug">
                                    Lower: {lowerAdvs.map(a => `${a.name || a.role} T${a.tier ?? 1}`).join(', ')}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <span className={`font-mono font-semibold shrink-0 mt-0.5 ${m.value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {m.value > 0 ? `+${m.value}` : m.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-[10px] text-dh-muted uppercase tracking-wide">Difficulty / Length</p>
                  <select
                    value={difficultyValue}
                    onChange={e => setDifficulty(e.target.value)}
                    className="w-full bg-dh-raised border border-dh-strong rounded px-2 py-1 text-xs text-dh outline-none focus:border-dh-strong cursor-pointer"
                  >
                    <option value="lessDifficult">Less difficult / shorter fight  −1</option>
                    <option value="">Standard</option>
                    <option value="slightlyMoreDangerous">Slightly more dangerous / slightly longer fight  +1</option>
                    <option value="moreDangerous">More dangerous / longer fight  +2</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-dh-muted uppercase tracking-wide">Damage Boost</p>
                  <select
                    value={damageBoostValue}
                    onChange={e => setDamageBoost(e.target.value)}
                    className="w-full bg-dh-raised border border-dh-strong rounded px-2 py-1 text-xs text-dh outline-none focus:border-dh-strong cursor-pointer"
                  >
                    <option value="">None</option>
                    <option value="plusOne">+1 damage to all adversaries  −1</option>
                    <option value="static">+2 damage to all adversaries  −2</option>
                    <option value="d4">+1d4 damage to all adversaries  −2</option>
                  </select>
                </div>

                {tableDamageBoost && (
                  <p className="text-[10px] text-dh-hope-soft flex items-center gap-1">
                    <Zap size={10} /> {tableDamageBoost === 'plusOne' ? '+1' : tableDamageBoost === 'static' ? '+2' : '+1d4'} damage boost active on all adversaries
                  </p>
                )}
              </div>
            )}
          </div>

          {consolidatedElements.filter(item => item.kind === 'adversary-group').map((item) => {
            const { baseElement: el, instances } = item;
            const count = instances.length;
            const displayEl = el._scaledFromTier != null && !(scaledToggleState[el.id] ?? true) ? getUnscaledAdversary(el) : el;
            return (
              <div
                key={el.id}
                className="rounded-lg bg-dh-surface border border-dh-border overflow-hidden group/adv"
                {...trackerOverlay.triggerProps(e => ({ kind: 'adversary', baseElement: item.baseElement, instances: item.instances, top: e.currentTarget.getBoundingClientRect().top, bottom: e.currentTarget.getBoundingClientRect().bottom }))}
              >
                <div className="px-2.5 py-1.5 border-b border-dh-border flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-dh truncate flex-1">{displayEl.name}</span>
                  {count > 1 && <span className="text-[10px] text-dh-muted shrink-0 group-hover/adv:hidden tabular-nums">×{count}</span>}
                  <div className="hidden group-hover/adv:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => addToTable(getItemData(el), 'adversaries')}
                      className="w-4 h-4 rounded bg-dh-raised hover:bg-green-900 text-dh-muted hover:text-green-300 flex items-center justify-center text-[10px] font-bold transition-colors leading-none"
                      title="Add one more"
                    >+</button>
                    <span className="min-w-[1rem] text-center text-[10px] text-dh-muted font-semibold tabular-nums">{count}</span>
                    <button
                      onClick={() => {
                        if (count === 1) {
                          if (window.confirm(`Remove ${displayEl.name} from the table?`)) {
                            removeGroup(instances);
                            trackerOverlay.close();
                          }
                        } else {
                          removeActiveElement(instances[instances.length - 1].instanceId);
                        }
                      }}
                      className="w-4 h-4 rounded bg-dh-raised hover:bg-red-900 text-dh-muted hover:text-red-300 flex items-center justify-center transition-colors leading-none"
                      title={count === 1 ? 'Remove from table' : 'Remove one'}
                    >{count === 1 ? <X size={9} /> : <span className="text-[10px] font-bold">−</span>}</button>
                  </div>
                </div>
                {/* Difficulty + Damage Thresholds */}
                {(displayEl.difficulty != null || (displayEl.hp_thresholds && (displayEl.hp_thresholds.major != null || displayEl.hp_thresholds.severe != null))) && (
                  <div className="flex items-center gap-1.5 flex-wrap px-2.5 pt-1.5">
                    {displayEl.difficulty != null && (
                      <span className="text-[10px] font-bold text-cyan-400/70 bg-cyan-900/50 border border-cyan-800/50 rounded px-1">
                        Diff {displayEl.difficulty}
                      </span>
                    )}
                    {displayEl.hp_thresholds && (displayEl.hp_thresholds.major != null || displayEl.hp_thresholds.severe != null) && (
                      <span className="text-[10px] text-dh-muted">
                        Thresholds <span className="font-bold text-dh">{displayEl.hp_thresholds.major}</span>
                        <span className="text-dh-muted"> / </span>
                        <span className="font-bold text-red-300">{displayEl.hp_thresholds.severe}</span>
                      </span>
                    )}
                  </div>
                )}
                <div className="p-2 space-y-2">
                  {instances.map((inst, idx) => {
                    const hpDamage = (displayEl.hp_max || 0) - (inst.currentHp ?? displayEl.hp_max ?? 0);
                    return (
                      <div
                        key={inst.instanceId}
                        className="space-y-1 rounded"
                      >
                        {(count > 1 || budgetCardOpen) && (
                          <div className="flex items-center gap-1.5 text-[10px] text-dh-muted">
                            {count > 1 && <span className="text-dh-muted font-medium">#{idx + 1}</span>}
                            {budgetCardOpen && (
                              <>
                                {count > 1 && <span className="text-dh-muted">·</span>}
                                <span className="capitalize">{displayEl.role || 'Standard'}</span>
                                <span className="text-dh-muted">·</span>
                                {displayEl.role === 'minion'
                                  ? <span>1/group BP</span>
                                  : <span className="text-dh-muted tabular-nums">{ROLE_BP_COST[displayEl.role || 'standard'] ?? ROLE_BP_COST.standard} BP</span>
                                }
                              </>
                            )}
                          </div>
                        )}
                        {inst.vulnerable && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-950/50 border border-orange-700/60 text-orange-200">Vulnerable</span>
                            <button
                              onClick={() => updateActiveElement(inst.instanceId, { vulnerable: false })}
                              className="p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors"
                              title="Clear Vulnerable"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        {inst.focusedBy && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-600/60 text-emerald-200">Focused by {inst.focusedBy}</span>
                            <button
                              onClick={() => updateActiveElement(inst.instanceId, { focusedBy: null })}
                              className="p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors"
                              title="Clear Focus"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        {inst.difficultyMod != null && inst.difficultyMod !== 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/60 border border-red-600/70 text-red-200" title="Difficulty modifier">
                              {inst.difficultyMod > 0 ? '+' : ''}{inst.difficultyMod} Difficulty
                            </span>
                            <button
                              onClick={() => updateActiveElement(inst.instanceId, { difficultyMod: 0 })}
                              className="p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors"
                              title="Clear difficulty modifier"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        {isAdversaryDefeated({ hp_max: displayEl.hp_max, currentHp: inst.currentHp }) && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-dh-hover/80 border border-dh-strong text-dh">Defeated</span>
                        )}
                        {(displayEl.hp_max || 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <CheckboxTrack
                              total={displayEl.hp_max || 0}
                              filled={hpDamage}
                              onSetFilled={gmResourceTrackCheckboxEditsAllowed(isPlayer)
                                ? (dmg) => void applyAdversaryManualTrackDirect(inst.instanceId, { currentHp: (displayEl.hp_max || 0) - dmg })
                                : undefined}
                              trackKind="hp"
                              label="HP"
                              verbs={['Mark', 'Clear']}
                            />
                            {(displayEl.stress_max || 0) === 0 && !inst.conditions && !openConditions.has(inst.instanceId) && (
                              <button
                                onClick={() => setOpenConditions(prev => new Set([...prev, inst.instanceId]))}
                                className="ml-1 text-dh-muted hover:text-dh transition-colors shrink-0"
                                title="Add conditions"
                              ><Tag size={10} /></button>
                            )}
                          </div>
                        )}
                        {(displayEl.stress_max || 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <CheckboxTrack
                              total={displayEl.stress_max || 0}
                              filled={inst.currentStress || 0}
                              onSetFilled={gmResourceTrackCheckboxEditsAllowed(isPlayer)
                                ? (s) => void applyAdversaryManualTrackDirect(inst.instanceId, { currentStress: s })
                                : undefined}
                              trackKind="stress"
                              label="Stress"
                              verbs={['Mark', 'Clear']}
                            />
                            {!inst.conditions && !openConditions.has(inst.instanceId) && (
                              <button
                                onClick={() => setOpenConditions(prev => new Set([...prev, inst.instanceId]))}
                                className="ml-1 text-dh-muted hover:text-dh transition-colors shrink-0"
                                title="Add conditions"
                              ><Tag size={10} /></button>
                            )}
                          </div>
                        )}
                        {(inst.conditions || openConditions.has(inst.instanceId)) && (
                          <ConditionsTextInput
                            instanceId={inst.instanceId}
                            placeholder="Conditions..."
                            autoFocus={openConditions.has(inst.instanceId) && !inst.conditions}
                            value={inst.conditions || ''}
                            onCommit={(v) => updateActiveElement(inst.instanceId, { conditions: v })}
                            onBlur={() => {
                              if (!inst.conditions) {
                                setOpenConditions(prev => { const s = new Set(prev); s.delete(inst.instanceId); return s; });
                              }
                            }}
                            className="w-full bg-dh-raised/50 border border-dh-strong rounded px-1.5 py-0.5 text-xs text-dh outline-none focus:border-blue-500 placeholder-dh-muted"
                          />
                        )}
                        {idx < instances.length - 1 && (
                          <div className="border-t border-dh-border mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {showConceptAiUi && (
            <div className="rounded-lg border border-violet-800/45 bg-violet-950/20 p-2 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Encounter builder</p>
              <div className="space-y-1.5">
                  <div>
                    <span className="text-[10px] text-dh-muted block mb-0.5">BP budget (target)</span>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={encounterAiTargetBudget}
                        onChange={(e) => setEncounterAiBudgetUser(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="flex-1 min-w-0 bg-dh-raised border border-dh-border rounded px-2 py-1 text-xs text-dh"
                      />
                      <button
                        type="button"
                        onClick={() => setEncounterAiBudgetUser(null)}
                        className="shrink-0 text-[10px] text-violet-300/90 hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-dh-muted leading-snug">
                    Base {computeBudget(partySize)} + table modifiers → target {adjustedBudget}. Remaining to spend:{' '}
                    <span className="text-violet-200 font-medium">{encounterAiRemainingBattlePoints}</span> BP
                  </div>
                  <label className="flex items-center gap-2 text-[10px] text-dh cursor-pointer">
                    <input
                      type="checkbox"
                      checked={encounterAiCountCurrent}
                      onChange={(e) => setEncounterAiCountCurrent(e.target.checked)}
                      className="rounded border-dh-border"
                    />
                    Count current toward budget
                  </label>
                  <label className="flex items-center gap-2 text-[10px] text-dh cursor-pointer">
                    <input
                      type="checkbox"
                      checked={encounterAiIncludePublic}
                      onChange={(e) => setEncounterAiIncludePublic(e.target.checked)}
                      className="rounded border-dh-border"
                    />
                    Include public Library entries
                  </label>
                  <label
                    className={`flex items-center gap-2 text-[10px] cursor-pointer ${imageGenEnabled ? 'text-dh' : 'text-dh-muted cursor-not-allowed'}`}
                    title={!imageGenEnabled ? 'Image generation is not configured on the server.' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={encounterAiGenerateMap}
                      disabled={!imageGenEnabled}
                      onChange={(e) => setEncounterAiGenerateMap(e.target.checked)}
                      className="rounded border-dh-border"
                    />
                    Generate a new battle map
                  </label>
                  <textarea
                    value={encounterAiConcept}
                    onChange={(e) => setEncounterAiConcept(e.target.value)}
                    onKeyDown={(e) =>
                      handleAiConceptTextareaKeyDown(e, {
                        canSubmit: !!encounterAiConcept.trim() && !encounterAiBuilding,
                        onSubmit: () => void runEncounterAiBuild(),
                      })
                    }
                    rows={3}
                    className="w-full min-h-[4.5rem] bg-dh-raised border border-dh-border rounded px-2 py-1 text-xs text-dh focus:border-violet-500 focus:outline-none resize-y"
                    placeholder="Describe the encounter you want (foes, tone, terrain)…"
                  />
                  <button
                    type="button"
                    onClick={() => void runEncounterAiBuild()}
                    disabled={!encounterAiConcept.trim() || encounterAiBuilding || !sendDoAddToTable}
                    className="w-full py-1.5 rounded-md text-xs font-medium border border-violet-700/60 bg-violet-900/50 text-violet-100 hover:bg-violet-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {encounterAiBuilding
                      ? encounterAiBuildPhase === 'resolving'
                        ? 'Building homebrew…'
                        : encounterAiBuildPhase === 'applying'
                          ? 'Adding to table…'
                          : 'Planning encounter…'
                      : 'Build with AI'}
                  </button>
                  {encounterAiBuilding && encounterAiBuildPhase ? (
                    <p className="text-[10px] text-violet-300/90 leading-snug">
                      {encounterAiBuildPhase === 'resolving'
                        ? 'Resolving catalog matches and running internal AI builders…'
                        : encounterAiBuildPhase === 'applying'
                          ? 'Resolving library items and applying the encounter…'
                          : 'Planning encounter with AI…'}
                    </p>
                  ) : null}
                  {encounterAiBuildFeedback ? (
                    <div className="space-y-1">
                      {encounterAiBuildFeedback.summary ? (
                        <p className="text-[10px] text-dh leading-snug">{encounterAiBuildFeedback.summary}</p>
                      ) : null}
                      {encounterAiBuildFeedback.notes ? (
                        <p className="text-[10px] text-dh-muted leading-snug">{encounterAiBuildFeedback.notes}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <AiDismissBuildWithAiLink />
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* Player Encounter Panel — read-only Fear + damaged adversaries */}
      {isPlayer && (
        <div className="w-56 bg-dh-canvas border-l border-dh-border flex flex-col overflow-y-auto shrink-0">
          <div className="px-2 py-2 bg-dh-canvas border-b border-dh-border sticky top-0 z-10 space-y-2">
            <h2 className="font-bold text-dh uppercase tracking-wider flex items-center gap-2 text-sm">
              <Swords size={15} className="text-red-400" /> Encounter
            </h2>
            {/* Fear tracker — read-only */}
            <div className="rounded-lg border border-dh-strong bg-dh-surface px-2.5 py-2">
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5">
                <Flame size={12} className="shrink-0 text-fuchsia-400" />
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-fuchsia-400/90">
                  FEAR
                </span>
                <CheckboxTrack
                  className="min-w-0"
                  fillRow
                  total={6}
                  filled={Math.min(fearCount, 6)}
                  trackKind="fear"
                  label="Fear"
                />
                {fearCount > 6 && (
                  <>
                    <Flame size={12} className="invisible shrink-0" aria-hidden />
                    <span className="invisible shrink-0 text-[10px] font-bold uppercase tracking-widest" aria-hidden>
                      FEAR
                    </span>
                    <CheckboxTrack
                      className="min-w-0"
                      fillRow
                      total={6}
                      filled={Math.max(0, fearCount - 6)}
                      trackKind="fear"
                      label="Fear"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {consolidatedElements.some(item => item.kind === 'note' && item.element.visibility !== 'gm') && (
            <div className="space-y-2 border-b border-dh-border px-2 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Notes</p>
              {consolidatedElements.filter(item => item.kind === 'note' && item.element.visibility !== 'gm').map((item) => {
                const el = item.element;
                const noteBodyTrimmed = String(el.body || '').trim();
                return (
                  <div
                    key={el.instanceId}
                    className={`rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 ${noteBodyTrimmed ? 'py-2' : 'py-1.5'}`}
                  >
                    <div className="text-xs font-semibold text-amber-100/90 truncate">{el.name || 'Note'}</div>
                    {noteBodyTrimmed ? (
                      <MarkdownText text={noteBodyTrimmed} className="dh-md mt-1 text-[11px] leading-snug text-dh-muted" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {Array.isArray(sessionCountdowns) && sessionCountdowns.length > 0 && (
            <div className="border-t border-dh-border px-2 pb-2">
              <SessionCountdownsPanel
                variant="section"
                sectionTitle="Countdowns"
                sessionCountdowns={sessionCountdowns}
                isGm={false}
              />
            </div>
          )}

          {/* Adversaries with damage or conditions (read-only for players) */}
          <div className="p-2 space-y-2">
            {(() => {
              const damagedGroups = consolidatedElements
                .filter(item => item.kind === 'adversary-group')
                .map(item => {
                  const { baseElement: el, instances } = item;
                  const displayEl = el._scaledFromTier != null && !(scaledToggleState[el.id] ?? true) ? getUnscaledAdversary(el) : el;
                  const damagedInstances = instances.filter((inst) =>
                    playerEncounterInstanceRowVisible(displayEl, inst),
                  );
                  return { displayEl, instances, damagedInstances };
                })
                .filter(g => g.damagedInstances.length > 0);

              if (damagedGroups.length === 0) return null;

              return damagedGroups.map(({ displayEl, instances, damagedInstances }) => (
                <div
                  key={displayEl.id || displayEl.instanceId}
                  className="rounded-lg bg-dh-surface border border-dh-border overflow-hidden"
                >
                  <div className="px-2.5 py-1.5 border-b border-dh-border">
                    <span className="text-xs font-semibold text-dh truncate block">{displayEl.name}</span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {damagedInstances.map((inst, idx) => (
                      <div key={inst.instanceId} className="space-y-1">
                        <EncounterAdversaryInstancePlayerSummary
                          displayEl={displayEl}
                          inst={inst}
                          showInstanceNum={instances.length > 1}
                          instanceNum={instances.indexOf(inst) + 1}
                        />
                        {idx < damagedInstances.length - 1 && (
                          <div className="border-t border-dh-border mt-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

    {modalOpen && (
      <ItemPickerModal
        collection={modalOpen}
        data={data}
        showDaggerstackImport={false}
        onClose={() => setModalOpen(null)}
        onSelect={(item) => {
          void (async () => {
            if (modalOpen === 'characters' && isPlayer && onPlayerAddCharacter) {
              const { is_public, _source, ...charData } = item;
              const res = await onPlayerAddCharacter({ ...charData, elementType: 'character' });
              const newEl = res?.character;
              if (newEl) {
                const rect = getAddCharacterAnchorRect();
                characterOverlay.show({ element: newEl, top: rect.top, bottom: rect.bottom });
              }
            } else if (modalOpen === 'characters' && !isPlayer) {
              const newEls = await addToTable(item, modalOpen);
              const el = newEls?.[0];
              if (el) {
                const rect = getAddCharacterAnchorRect();
                characterOverlay.show({ element: el, top: rect.top, bottom: rect.bottom });
              }
            } else {
              await addToTable(item, modalOpen);
            }
          })();
          setModalOpen(null);
        }}
        onCreateNew={modalOpen === 'characters' ? () => {
          setModalOpen(null);
          void openNewCharacterEditor();
        } : modalOpen === 'adversaries' ? () => {
          setModalOpen(null);
          void openNewAdversaryEditor({});
        } : modalOpen === 'environments' ? () => {
          setModalOpen(null);
          void openNewEnvironmentEditor({});
        } : undefined}
        onCharacterAiConceptSubmit={modalOpen === 'characters' ? (concept) => {
          setModalOpen(null);
          void openNewCharacterEditor({ pendingAiConcept: concept });
        } : undefined}
        onAdversaryAiConceptSubmit={modalOpen === 'adversaries' ? (concept, tier, role) => {
          setModalOpen(null);
          void openNewAdversaryEditor({ pendingAiConcept: concept, tier, role });
        } : undefined}
        onEnvironmentAiConceptSubmit={modalOpen === 'environments' ? (concept, tier, type) => {
          setModalOpen(null);
          void openNewEnvironmentEditor({ pendingAiConcept: concept, tier, type });
        } : undefined}
        isLoading={['scenes', 'adventures', 'characters'].includes(modalOpen) ? pickerLoading : undefined}
        excludeIds={modalOpen === 'characters' ? activeElements.filter(el => el.elementType === 'character').map(el => el.id) : undefined}
      />
    )}

    {captureOpen && (
      <CaptureTableModal
        activeElements={activeElements}
        saveItem={saveItem}
        navigate={navigate}
        onClose={() => setCaptureOpen(false)}
      />
    )}

    {/* Character sheet overlay — right of Characters panel; sheet + editor share one rounded card (editor slides from behind). Mounts before ItemDetailModal so the editor portal target exists. */}
    {characterOverlay.isOpen && (() => {
      const liveEl = activeElements.find(e => e.instanceId === characterOverlay.data.element.instanceId) || characterOverlay.data.element;
      const isMyCharacter = playerEmail != null && liveEl.assignedPlayerEmail === playerEmail;
      const editDrawerOpen = editState?.step === 'form' && editState?.presentation === 'rightDrawer';
      const effectiveEditDrawerOpen = editDrawerOpen && !characterDrawerEditMismatch;
      const titleBarEl =
        effectiveEditDrawerOpen && characterDrawerChromeSync?.formData
          ? { ...liveEl, ...characterDrawerChromeSync.formData }
          : liveEl;
      const libraryCharacterRow = data?.characters?.find(c => c.id === liveEl?.id);
      const itemForTitleBadge =
        effectiveEditDrawerOpen && editState?.collection === 'characters' && editState?.item
          ? editState.item
          : libraryCharacterRow || liveEl;
      const v2TitlePath =
        itemForTitleBadge?._source === 'srd'
          ? resolveV2LibraryItemSourcePath('characters', itemForTitleBadge)
          : null;
      const sync = characterDrawerChromeSync;
      return (
        <div
          ref={characterOverlay.overlayRef}
          className="fixed z-[55] flex flex-row gap-2 items-start max-w-[calc(100vw-14rem-8px)] min-w-0 overflow-x-auto"
          style={{
            left: 'calc(14rem + 8px)',
            top: 90,
            height: 'calc(100dvh - 98px)',
          }}
        >
          <CharacterSheetSourceHighlightProvider>
          <CharacterSheetHighlightSurface
            className="flex flex-col rounded-xl border border-dh-strong bg-dh-surface shadow-2xl overflow-hidden max-h-full h-full min-h-0 shrink-0 min-w-0"
            style={{ width: characterTableUnifiedCardWidth(effectiveEditDrawerOpen) }}
          >
            <GameTableCharacterSheetTitleBar
              el={titleBarEl}
              item={itemForTitleBadge}
              editDrawerOpen={effectiveEditDrawerOpen}
              onEdit={(!isPlayer || isMyCharacter) ? () => openTableCharacterEditor(liveEl) : undefined}
              onDone={closeEditModal}
              doneDisabled={!!characterDrawerChromeSync?.aiConceptBusy}
              onUndo={() => characterTableDetailModalRef.current?.undo()}
              onRedo={() => characterTableDetailModalRef.current?.redo()}
              canUndo={!!sync?.canUndo}
              canRedo={!!sync?.canRedo}
              isSaving={sync?.isSaving}
              showUnsavedDirtyHint={sync?.showUnsavedDirtyHint}
              userHasInteractedWithEditor={sync?.userHasInteractedWithEditor}
              savedFlash={sync?.savedFlash}
              v2LibrarySourcePath={v2TitlePath}
              showIncomplete
              sheetColumnWidth={
                effectiveEditDrawerOpen
                  ? CHARACTER_TABLE_SHEET_COLUMN_WIDTH_WITH_EDITOR
                  : CHARACTER_TABLE_SHEET_COLUMN_WIDTH
              }
              editorColumnWidth={
                effectiveEditDrawerOpen
                  ? CHARACTER_TABLE_EDITOR_DRAWER_WIDTH_WITH_EDITOR
                  : CHARACTER_TABLE_EDITOR_DRAWER_WIDTH
              }
            />
            <div className="flex flex-row items-stretch flex-1 min-h-0 overflow-hidden">
            <div
              ref={characterSheetColumnRef}
              className="relative z-10 flex flex-col overflow-hidden min-w-0 shrink-0"
              style={{
                width: effectiveEditDrawerOpen
                  ? CHARACTER_TABLE_SHEET_COLUMN_WIDTH_WITH_EDITOR
                  : CHARACTER_TABLE_SHEET_COLUMN_WIDTH,
              }}
            >
              {(() => {
                const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(
                  sessionPlayAllowed,
                  isPlayer,
                  isMyCharacter,
                );
                return (
                  <CharacterHoverCard
                    el={titleBarEl}
                    surfaceVariant="panelEmbedded"
                    omitHeader
                    fearCount={fearCount}
                    updateFn={sheetOwner ? updateActiveElement : undefined}
                    expandedKeys={featureExpanded[liveEl.instanceId] ?? []}
                    onToggleFeature={(key) => toggleFeatureExpanded(liveEl.instanceId, key)}
                    onSetFeatureExpandedKeys={(keys) => setFeatureExpandedKeys(liveEl.instanceId, keys)}
                    onResync={(isMyCharacter || !isPlayer) && liveEl.daggerstackUrl ? () => handleResyncCharacter(liveEl) : null}
                    isSyncing={resyncingCharId === liveEl.instanceId}
                    onRoll={allowPlayMechanics ? handlePlayerOwnRoll : undefined}
                    onSpendHope={allowPlayMechanics ? handleSpendHope : undefined}
                    onUseHopeAbility={allowPlayMechanics ? handleUseHopeAbility : undefined}
                    onEdit={!isPlayer || isMyCharacter ? () => openTableCharacterEditor(liveEl) : undefined}
                    onActionNotification={allowPlayMechanics ? (isPlayer ? handlePlayerActionNotification : handleActionNotification) : undefined}
                    activeElements={activeElements}
                    mapConfig={mapConfig}
                    pendingBanners={pendingBanners}
                    lifeSupportSelections={lifeSupportSelections}
                    queueManualTrackEdit={allowPlayMechanics ? queueManualTrackEdit : undefined}
                    pendingResourceCosts={pendingResourceCosts}
                    consumePendingStressForManualMark={consumePendingStressForManualMark}
                    isPlayer={isPlayer}
                    getValidTargets={allowPlayMechanics ? getValidTargets : undefined}
                    system={system}
                    characters={wrappedPartyCharacters}
                    tableFeatureState={tableFeatureState}
                    tableId={tableId}
                  />
                );
              })()}
            </div>
            <div
              className="relative z-0 overflow-hidden shrink-0 h-full min-h-0 border-l border-dh-border transition-[width] duration-300 ease-out"
              style={{
                width: effectiveEditDrawerOpen
                  ? CHARACTER_TABLE_EDITOR_DRAWER_WIDTH_WITH_EDITOR
                  : 0,
              }}
              aria-hidden={!effectiveEditDrawerOpen}
            >
              <div
                ref={setCharacterEditorPortalEl}
                className={`h-full min-h-0 flex flex-col transition-transform duration-300 ease-out will-change-transform ${effectiveEditDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ width: CHARACTER_TABLE_EDITOR_DRAWER_WIDTH_WITH_EDITOR }}
              />
            </div>
            </div>
          </CharacterSheetHighlightSurface>
          </CharacterSheetSourceHighlightProvider>
        </div>
      );
    })()}

    {editState?.step === 'note' && editState.baseElement && (
      <EncounterNoteEditorModal
        open
        name={editState.item.name}
        body={editState.item.body}
        imageUrl={editState.item.imageUrl || editState.baseElement.imageUrl}
        visibility={editState.item.visibility}
        onClose={closeEditModal}
        onSave={({ name, body, visibility }) => {
          const img = editState.item.imageUrl ?? editState.baseElement.imageUrl;
          updateActiveElement(editState.baseElement.instanceId, {
            name,
            body,
            visibility,
            ...(img ? { imageUrl: img } : {}),
          });
          closeEditModal();
        }}
      />
    )}

    {editState?.step === 'choice' && (
      <EditChoiceDialog
        itemName={editState.baseElement.name}
        contextLabel="Table"
        canEditOriginal={isOwnItem(editState.baseElement)}
        onEditCopy={handleChoiceEditCopy}
        onEditOriginal={handleChoiceEditOriginal}
        onClose={closeEditModal}
      />
    )}
    {editState?.step === 'form' && !characterDrawerEditMismatch && (
      <ItemDetailModal
        ref={characterTableDetailModalRef}
        item={editState.item}
        collection={editState.collection}
        data={data}
        editable={true}
        presentation={editState.presentation ?? 'center'}
        onCharacterDrawerChromeSync={setCharacterDrawerChromeSync}
        rightDrawerPortalTo={
          editState.presentation === 'rightDrawer'
            ? (characterOverlay.isOpen ? characterEditorPortalEl : null)
            : undefined
        }
        saveImage={saveImage}
        onSave={async (editedData) => {
          if (editState.mode === 'new') {
            const itemWithId = editedData;
            await saveItem(editState.collection, itemWithId);
            if (saveImage && (editedData.imageUrl != null || editedData._additionalImages != null)) {
              await saveImage(editState.collection, itemWithId.id, editedData.imageUrl ?? '', { _additionalImages: editedData._additionalImages });
            }
            return;
          }
          const itemWithId = { ...editedData, id: editState.baseElement.id };
          if (editState.mode === 'copy') {
            updateActiveElementsBaseData(
              el => el.id === editState.baseElement.id,
              itemWithId
            );
          } else {
            const saved = await saveItem(editState.collection, itemWithId);
            if (saveImage && (editedData.imageUrl != null || editedData._additionalImages != null)) {
              await saveImage(editState.collection, itemWithId.id, editedData.imageUrl ?? '', { _additionalImages: editedData._additionalImages });
            }
            if (editState.collection !== 'characters' && saved) {
              updateActiveElementsBaseData(el => el.id === saved.id, saved);
            }
          }
        }}
        onClose={closeEditModal}
        partySize={partySize}
        partyTier={partyTier}
        characters={characters}
        onMergeAdversary={onMergeAdversary}
        pendingCharacterAiConcept={editState?.pendingCharacterAiConcept}
        onPendingCharacterAiConceptConsumed={() =>
          setEditState((s) => (s ? { ...s, pendingCharacterAiConcept: undefined } : s))
        }
        pendingAdversaryAiConcept={editState?.pendingAdversaryAiConcept}
        onPendingAdversaryAiConceptConsumed={() =>
          setEditState((s) => (s ? { ...s, pendingAdversaryAiConcept: undefined } : s))
        }
        pendingEnvironmentAiConcept={editState?.pendingEnvironmentAiConcept}
        onPendingEnvironmentAiConceptConsumed={() =>
          setEditState((s) => (s ? { ...s, pendingEnvironmentAiConcept: undefined } : s))
        }
      />
    )}

    {/* Hover overlay for tracker panel (adversary or environment) */}
    {trackerOverlay.isOpen && (
      <div
        ref={trackerOverlay.overlayRef}
        className="fixed z-[55]"
        style={{ right: 'calc(14rem)', paddingRight: '12px', top: (trackerOverlay.data.top + trackerOverlay.data.bottom) / 2 + trackerAdjust, transform: 'translateY(-50%)', width: 'calc(26rem + 12px)', maxHeight: 'calc(100dvh - 110px)' }}
        {...trackerOverlay.overlayHandlers}
      >
        <div className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 110px)' }}>
          <div className="p-5 relative">
            {trackerOverlay.data.kind === 'environment' ? (() => {
              const el = trackerOverlay.data.element;
              return (
                <>
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                    <button
                      onClick={() => { trackerOverlay.close(); handleEditClick([el], el, 'environments'); }}
                      className="p-1.5 rounded-lg bg-dh-raised/90 text-dh-muted hover:text-blue-400 hover:bg-dh-hover transition-colors"
                      title="Edit"
                    ><Edit size={14} /></button>
                    <button
                      onClick={() => { removeActiveElement(el.instanceId); trackerOverlay.close(); }}
                      className="p-1.5 rounded-lg bg-dh-raised/90 text-dh-muted hover:text-red-400 hover:bg-dh-hover transition-colors"
                      title="Remove from table"
                    ><Trash2 size={14} /></button>
                  </div>
                  {el.imageUrl && (
                    <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
                      <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" />
                    </div>
                  )}
                  <h3 className={`text-xl font-bold text-dh mb-1 pr-20`}>
                    {el.name}
                  </h3>
                  <EnvironmentCardContent
                    element={el}
                    hoveredFeature={null}
                    cardKey={el.instanceId}
                    featureCountdowns={featureCountdowns}
                    updateCountdown={null}
                    onAddAdversary={handleAddPotentialAdversary}
                    onPotentialAdversaryHover={handlePotentialAdversaryHover}
                    onPotentialAdversaryLeave={potAdvOverlay.scheduleClose}
                  />
                </>
              );
            })(            ) : (() => {
              // Derive live instances from consolidatedElements so the overlay
              // re-renders when HP/stress is updated from the Encounters panel.
              const liveGroup = consolidatedElements.find(
                g => g.kind === 'adversary-group' && g.baseElement.id === trackerOverlay.data.baseElement.id
              );
              const liveInstances = liveGroup?.instances ?? trackerOverlay.data.instances;
              const liveBaseElement = liveGroup?.baseElement ?? trackerOverlay.data.baseElement;
              return (
                <>
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                    <button
                      onClick={() => { trackerOverlay.close(); handleEditClick(liveInstances, liveBaseElement, 'adversaries'); }}
                      className="p-1.5 rounded-lg bg-dh-raised/90 text-dh-muted hover:text-blue-400 hover:bg-dh-hover transition-colors"
                      title="Edit"
                    ><Edit size={14} /></button>
                    <button
                      onClick={() => { removeGroup(liveInstances); trackerOverlay.close(); }}
                      className="p-1.5 rounded-lg bg-dh-raised/90 text-dh-muted hover:text-red-400 hover:bg-dh-hover transition-colors"
                      title="Remove from table"
                    ><Trash2 size={14} /></button>
                  </div>
                  {liveBaseElement.imageUrl && (
                    <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
                      <img src={liveBaseElement.imageUrl} alt={liveBaseElement.name} className="w-full h-full object-cover opacity-80" />
                    </div>
                  )}
                  <h3 className={`text-xl font-bold text-dh mb-1 pr-20`}>
                    {liveBaseElement.name}
                    {liveInstances.length > 1 && (
                      <span className="text-dh-muted font-normal ml-1.5">×{liveInstances.length}</span>
                    )}
                  </h3>
                  <AdversaryCardContent
                    element={liveBaseElement}
                    hoveredFeature={null}
                    cardKey={liveBaseElement.id}
                    count={liveInstances.length}
                    instances={liveInstances}
                    updateFn={updateActiveElement}
                    allowResourceTrackEdits={gmResourceTrackCheckboxEditsAllowed(isPlayer)}
                    showInstanceRemove={false}
                    featureCountdowns={featureCountdowns}
                    updateCountdown={null}
                    onRollAttack={(data, e) => handleCardRoll(data, liveBaseElement.name, liveInstances, e)}
                    damageBoost={tableDamageBoost || liveBaseElement._damageBoost || null}
                    scaledMeta={null}
                    onScaledToggle={null}
                  />
                </>
              );
            })()}
          </div>
        </div>
      </div>
    )}

    {/* Potential adversary hover card — shown to the left of the environment hover card */}
    {potAdvOverlay.isOpen && (
      <div
        ref={potAdvOverlay.overlayRef}
        className="fixed z-[56]"
        style={{ right: 'calc(40rem + 12px)', paddingRight: '8px', top: (potAdvOverlay.data.top + potAdvOverlay.data.bottom) / 2 + potAdvAdjust, transform: 'translateY(-50%)', width: 'calc(24rem + 8px)', maxHeight: 'calc(100dvh - 110px)' }}
        {...potAdvOverlay.overlayHandlers}
      >
        <div className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 110px)' }}>
          <div className="p-5 relative">
            {potAdvOverlay.data.element.imageUrl && (
              <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
                <img src={potAdvOverlay.data.element.imageUrl} alt={potAdvOverlay.data.element.name} className="w-full h-full object-cover opacity-80" />
              </div>
            )}
            <h3 className="text-xl font-bold text-dh mb-1 pr-16">{potAdvOverlay.data.element.name}</h3>
            <AdversaryCardContent
              element={potAdvOverlay.data.element}
              hoveredFeature={null}
              cardKey={potAdvOverlay.data.element.id}
              count={1}
              instances={[]}
              updateFn={null}
              showInstanceRemove={false}
              featureCountdowns={featureCountdowns}
              updateCountdown={null}
              onRollAttack={(data, e) => handleCardRoll(data, potAdvOverlay.data.element.name, [], e)}
              damageBoost={null}
              scaledMeta={null}
              onScaledToggle={null}
            />
          </div>
        </div>
      </div>
    )}

    <PortalHoverTooltipLayer
      tooltip={gmMovesPortalTooltip.tooltip}
      tooltipRef={gmMovesPortalTooltip.tooltipRef}
      scheduleClose={gmMovesPortalTooltip.scheduleClose}
      clearLeaveTimer={gmMovesPortalTooltip.clearLeaveTimer}
    />

    {/* Hover overlay: Actions / Fear rows — full sheet (not passives/reactions chips) */}
    {(hoveredElement || gmHoverOverlayActive) && !hoveredFeature?.fromChip && (() => {
      const displayElement = hoveredElement || lastHoveredElementRef.current;
      if (!displayElement) return null;
      if (displayElement.kind === 'character') return null;
      return (
      <div
        ref={gmFeatureOverlayRef}
        className="fixed z-50"
        style={{ right: 'calc(34rem + 20px)', top: '50%', transform: 'translateY(-50%)', width: '26rem', maxHeight: '80vh' }}
        onMouseEnter={() => { if (isTouch) return; if (gmHoverHideTimer.current) { clearTimeout(gmHoverHideTimer.current); gmHoverHideTimer.current = null; } setGmHoverOverlayActive(true); }}
        onMouseLeave={() => { if (!isTouch) setGmHoverOverlayActive(false); }}
      >
        <div ref={overlayScrollRef} className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl overflow-y-auto max-h-[80vh]">
          {displayElement.kind === 'environment' ? (
            <div className="p-5 relative">
              {displayElement.element.imageUrl && (
                <div
                  className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl cursor-pointer"
                  onClick={() => setLightboxUrl(displayElement.element.imageUrl)}
                >
                  <img src={displayElement.element.imageUrl} alt={displayElement.element.name} className="w-full h-full object-cover opacity-80" />
                </div>
              )}
              <div>
                <h3 className={`text-xl font-bold text-dh mb-1 ${displayElement.element.imageUrl ? 'pr-20' : ''}`}>{displayElement.element.name}</h3>
                <EnvironmentCardContent
                  element={displayElement.element}
                  hoveredFeature={hoveredFeature}
                  cardKey={displayElement.element.instanceId}
                  featureCountdowns={featureCountdowns}
                  updateCountdown={null}
                  onAddAdversary={handleAddPotentialAdversary}
                />
              </div>
            </div>
          ) : (() => {
            const el = displayElement.baseElement;
            const showScaled = scaledToggleState[el.id] ?? true;
            const displayEl = el._scaledFromTier != null && !showScaled ? getUnscaledAdversary(el) : el;
            const scaledMeta = el._scaledFromTier != null ? { fromTier: el._scaledFromTier, showScaled } : null;
            return (
            <div className="p-5 relative">
              {el.imageUrl && (
                <div
                  className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl cursor-pointer"
                  onClick={() => setLightboxUrl(el.imageUrl)}
                >
                  <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" />
                </div>
              )}
              <div>
                <h3 className={`text-xl font-bold text-dh mb-1 ${el.imageUrl ? 'pr-20' : ''}`}>
                  {displayEl.name}
                  {displayElement.instances.length > 1 && (
                    <span className="text-dh-muted font-normal ml-1.5">×{displayElement.instances.length}</span>
                  )}
                </h3>
                <AdversaryCardContent
                  element={displayEl}
                  hoveredFeature={hoveredFeature}
                  cardKey={el.id}
                  count={displayElement.instances.length}
                  instances={displayElement.instances}
                  updateFn={updateActiveElement}
                  allowResourceTrackEdits={gmResourceTrackCheckboxEditsAllowed(isPlayer)}
                  showInstanceRemove={false}
                  featureCountdowns={featureCountdowns}
                  updateCountdown={null}
                  onRollAttack={(data, e) => handleCardRoll(data, el.name, displayElement.instances, e)}
                  scaledMeta={scaledMeta}
                  onScaledToggle={() => setScaledToggleState(prev => ({ ...prev, [el.id]: !(prev[el.id] ?? true) }))}
                />
              </div>
            </div>
            );
          })()}
        </div>
      </div>
      );
    })()}
    {/* Adversary attack in-place target picker — shown before rolling when attacker(s) are on the map */}
    {adversaryTargetMenu && createPortal(
      <>
        <div className="fixed inset-0 z-[200]" onClick={() => setAdversaryTargetMenu(null)} />
        <div
          className="fixed z-[201] rounded-lg border border-dh-strong bg-dh-surface shadow-2xl p-2 space-y-2"
          style={{
            top: adversaryTargetMenu.anchorRect
              ? Math.min(adversaryTargetMenu.anchorRect.bottom + 4, window.innerHeight - 200)
              : window.innerHeight / 2 - 80,
            left: adversaryTargetMenu.anchorRect
              ? Math.min(adversaryTargetMenu.anchorRect.left, window.innerWidth - 220)
              : window.innerWidth / 2 - 80,
            minWidth: '160px',
            maxWidth: '240px',
          }}
        >
          <div className="text-[11px] font-semibold text-dh uppercase tracking-wide">
            {adversaryTargetMenu.validTargets.length > 0 ? 'Choose target' : 'No targets in range'}
          </div>
          <div className="space-y-1">
            {adversaryTargetMenu.validTargets.length === 0 ? (
              <p className="text-[11px] text-dh-muted italic px-1 py-1">No characters are in range of this attack.</p>
            ) : adversaryTargetMenu.validTargets.map((t) => {
              const disadvantageForTarget = t.type === 'character' ? getDisadvantageForTarget(adversaryTargetMenu.rollText, t.instanceId) : [];
              return (
              <button
                key={t.instanceId}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const { rollText, displayName, rollMeta, rolledKey: rk } = adversaryTargetMenu;
                  let finalRollText = rollText;
                  if (t.type === 'character') {
                    const targetEl = activeElements.find(el => el.instanceId === t.instanceId) || t;
                    const wrappedChar = wrapEntity(targetEl, updateActiveElement);
                    if (Array.isArray(targetEl.activeFeatures)) {
                      for (const feature of targetEl.activeFeatures) {
                        if (typeof feature.onTargeted !== 'function') continue;
                        const pendingRoll = {
                          get rollText() { return finalRollText; },
                          set rollText(v) { finalRollText = v; },
                          addDisadvantage(name) { finalRollText = insertDisadvantageD6(finalRollText, name ?? feature.name); },
                        };
                        feature.onTargeted({ roll: pendingRoll, character: wrappedChar, characters: wrappedPartyCharacters, system });
                      }
                    }
                  }
                  postRoll(finalRollText, displayName, tableId, { ...rollMeta, _selectedTargetInstanceId: t.instanceId })
                    .then(() => {
                      if (rk) {
                        setRolledKey(rk);
                        setTimeout(() => setRolledKey(prev => prev === rk ? null : prev), 1500);
                      }
                    })
                    .catch(err => handleRollTransportError(err, 'Roll failed:'));
                  setAdversaryTargetMenu(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-dh-strong bg-dh-raised/80 text-dh hover:bg-dh-hover hover:border-sky-500/50 transition-colors"
              >
                <div>{t.name}</div>
                <div className="text-[10px] text-dh-muted mt-0.5">
                  {[
                    t.maxHp > 0 ? `HP ${t.currentHp ?? t.maxHp}/${t.maxHp}` : null,
                    t.maxStress > 0 ? `Stress ${t.currentStress ?? 0}/${t.maxStress}` : null,
                  ].filter(Boolean).join(' · ')}
                  {t.conditions ? ` · ${t.conditions}` : ''}
                  {disadvantageForTarget.length ? (
                    <span className="text-orange-400/95 font-medium">
                      {' · '}{disadvantageForTarget.map(f => `${f} (−1d6)`).join(', ')}
                    </span>
                  ) : null}
                </div>
              </button>
              );
            })}
          </div>
          <button
            type="button"
            tabIndex={0}
            onClick={() => setAdversaryTargetMenu(null)}
            className="text-[11px] text-dh-muted hover:text-dh transition-colors w-full text-center"
          >
            Cancel (roll without target)
          </button>
        </div>
      </>,
      document.body
    )}

    {lightboxUrl && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setLightboxUrl(null)}
      >
        <button
          type="button"
          tabIndex={0}
          className="absolute top-4 right-4 p-2 rounded-full bg-dh-raised/80 text-dh hover:text-dh hover:bg-dh-hover transition-colors"
          onClick={() => setLightboxUrl(null)}
        >
          <X size={20} />
        </button>
        <img
          src={lightboxUrl}
          alt="Enlarged image"
          className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
          onClick={e => e.stopPropagation()}
        />
      </div>
    )}

      </div>{/* end flex-1 flex overflow-hidden */}
    </div>
  );
}
