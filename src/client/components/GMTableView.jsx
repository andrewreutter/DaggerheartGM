import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTouchDevice } from '../lib/useTouchDevice.js';
import { useHoverOverlay } from '../lib/useHoverOverlay.js';
import { Zap, Trash2, Dices, ChevronDown, ChevronRight, X, Plus, Camera, Swords, Heart, AlertCircle, Tag, Flame, Edit, Sparkles, Pencil, User, Users, Shield, RefreshCw, ExternalLink, Eye, EyeOff, Circle, Square, CheckSquare } from 'lucide-react';
import { BattleMap, CHARACTER_TRAY_WIDTH_PX } from './BattleMap.jsx';
import { ActionLog } from './ActionLog.jsx';
import { parseFeatureCategory, parseAllCountdownValues, generateId, effectiveThresholds, computeHpLoss, isAdversaryDefeated, getDifficultyLabel } from '../lib/helpers.js';
import { FeatureDescription } from './FeatureDescription.jsx';
import { EnvironmentCardContent, AdversaryCardContent, CheckboxTrack } from './DetailCardContent.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { ItemPickerModal } from './modals/ItemPickerModal.jsx';
import { postRoll, postRollSilent, postTableOp, postActionNotification, postBannerAck, postBannerCancel, postRerollHopeDie, postBannerFelineRerollRequest, postRerollDualityDice, postBannerRangerFocusRerollRequest, postBannerHoldThemOff, postBannerTargets, postBannerWingsD8, postBannerWingsD8Toggle, postBannerPrayerDieSelect, postBannerMakeASceneTarget, postBannerRallyToggle, postBannerRallyAck, postBannerHeartD4Ack, postBannerHeartD4Toggle, postBannerChipResolve, postBannerAddDamage, postBannerRerollDie, postCharacterUpdate, postHopeDieUpgrade, syncDaggerstackCharacter, resolveItems, requestGoogleContactsAccess, searchGoogleContacts } from '../lib/api.js';
import { isOwnItem, ROLE_BP_COST } from '../lib/constants.js';
import { computeBattlePoints, computeAutoModifiers, computeTotalBudgetMod } from '../lib/battle-points.js';
import { getUnscaledAdversary } from '../lib/adversary-defaults.js';
import { CharacterHoverCard } from './CharacterHoverCard.jsx';
import { CompanionSheet, getNumericFeatureStateEntries } from './CharacterDisplay.jsx';
import { DiceRoller } from './DiceRoller.jsx';
import { Tooltip } from './Tooltip.jsx';
import { wrapEntity } from '../../features/entity.js';
import { wrapRoll } from '../../features/roll.js';
import { runHook, runPipelineHook } from '../../features/hooks.js';
import { weaponFeatures, armorFeatures, classFeatures, ancestryFeatures, virtualWeaponBehaviors } from '../../features/registry.js';
import { extractDetailsValues, insertDisadvantageD6, stripDisadvantageFromRollText } from '../lib/dice-utils.js';
import { getCharactersWithinFarRange, getCharactersWithinCloseRangeWithMarkedHp, getAdversariesWithinMeleeRange, getAdversariesWithinRangeFt, getCharactersWithinRangeFt, getCharactersWithinRangeOfAny, rangeBandNameToFt, RANGE_BANDS_FT, tokenDistanceFt, distanceFtToRangeBandName } from '../lib/map-range.js';
import { getRestMovesForCharacter, getRestMoveDefinition } from '../lib/rest-moves.js';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { recomputeCharacter } from '../lib/character-calc.js';
import { runBeforeMarkStress, runBeforeMarkHP, runBeforeMarkArmor } from '../lib/origin-lifecycle.js';


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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Camera size={18} /> Capture Table as Scene</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <p className="text-sm text-slate-400 mb-5">Save the current table contents as a reusable Scene, including all adversaries and environments.</p>

        <label className="block text-sm font-medium text-slate-300 mb-1">Scene Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder="e.g. Bandit Ambush"
          autoFocus
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500 mb-5"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors">Cancel</button>
          <button
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


/** Renders N filled (marked) boxes with an icon — used in the player Encounter panel. */
function MarkedBoxes({ count, fillColor, icon: Icon, iconColor }) {
  if (!count || count <= 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      <Icon size={10} className={`${iconColor} shrink-0`} />
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`w-3 h-3 rounded-sm ${fillColor} flex-shrink-0`} />
      ))}
    </div>
  );
}

// Strip runtime tracking fields to get the base item data for form editing.
function getItemData(element) {
  const { instanceId, elementType, currentHp, currentStress, conditions, ...rest } = element;
  return rest;
}

const COLLECTION_TO_ELEMENT_TYPE = { adversaries: 'adversary', environments: 'environment' };

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

export function GMTableView({ activeElements, updateActiveElement, removeActiveElement, updateActiveElementsBaseData, data, saveItem, saveImage, addToTable, onMergeAdversary, user, route, navigate, featureCountdowns = {}, updateCountdown, partySize = 1, partyTier = 1, characters = [], tableBattleMods, setTableBattleMods, fearCount = 0, setFearCount, ensureScenesLoaded, ensureAdventuresLoaded, ensureCharactersLoaded, clearTable, isPlayer = false, playerEmail, connectedPlayers = [], playerEmails = [], setPlayerEmails, gmUid, onPlayerAddCharacter, pendingBanners = [], onFelineRerollRequestSuccess, onFelineRerollRequestCancel, rangerFocusRequestedBannerIds, onRangerFocusRerollRequestSuccess, onRangerFocusRerollRequestCancel, previewAsPlayerEmail = null, onPreviewAsPlayer, onExitPreview, actionLog = [], setActionLog, mapConfig, onMapConfigChange, lifeSupportSelections = {}, onLifeSupportSelect, onLifeSupportClear, restMovesSelections = {}, onRestMoveSelect, onRestMoveClear }) {
  const isTouch = useTouchDevice();
  const { srdData } = useCharacterSrdData();

  // ── Hover overlay hooks (desktop: mouseenter/leave; touch: tap-to-toggle) ──
  const trackerOverlay    = useHoverOverlay({ hideDelay: 120, isTouch });
  const characterOverlay  = useHoverOverlay({ hideDelay: 120, isTouch });
  const potAdvOverlay     = useHoverOverlay({ hideDelay: 120, isTouch });
  const gmMovesOverlay    = useHoverOverlay({ hideDelay: 150, isTouch });

  // GM Feature hover (multi-trigger within GM Moves panel — managed separately)
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [gmHoverOverlayActive, setGmHoverOverlayActive] = useState(false);
  const gmHoverHideTimer = useRef(null);
  const lastHoveredElementRef = useRef(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [modalOpen, setModalOpen] = useState(null); // null | 'adversaries' | 'environments' | 'scenes'

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

  const [hoveredDefaultMove, setHoveredDefaultMove] = useState(null);
  const [hoveredCompactTooltip, setHoveredCompactTooltip] = useState(null);
  const [hoveredTrackTooltip, setHoveredTrackTooltip] = useState(null); // { label, top, bottom, side: 'left'|'right' }
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef(null);
  // Make a Scene (Bard): { [rollDbId]: selectedAdversaryInstanceId } — pre-populated from player's in-place pick, cleared on ack
  const [makeASceneSelections, setMakeASceneSelections] = useState({});
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
  // editState: null | { step: 'choice', baseElement, instances, collection }
  //                  | { step: 'form', item, collection, mode, baseElement, instances }
  const [editState, setEditState] = useState(null);
  const [scaledToggleState, setScaledToggleState] = useState({});
  const trackerKey = trackerOverlay.data
    ? (trackerOverlay.data.kind === 'environment' ? trackerOverlay.data.element.instanceId : trackerOverlay.data.baseElement.id)
    : null;
  const trackerAdjust = useViewportClamp(trackerOverlay.overlayRef, trackerOverlay.isOpen, trackerKey);

  const [resyncingCharId, setResyncingCharId] = useState(null);
  const [preRollBanner, setPreRollBanner] = useState(null); // { rollWrapper, chips, characterEl, onProceed } when player has onAct chips
  const [selectedPreRollChips, setSelectedPreRollChips] = useState([]); // one boolean per chip when preRollBanner is set
  const [preRollDifficulty, setPreRollDifficulty] = useState(15); // DC 5–30 when GM shows difficulty chip
  const [preRollAdvantages, setPreRollAdvantages] = useState([]); // string[]: optional name per advantage ('' = default "Advantage")
  const [preRollDisadvantages, setPreRollDisadvantages] = useState([]); // string[]: optional name per disadvantage ('' = default "Disadvantage")

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
  // Prune chipHopeConvertedIds when the corresponding banner is no longer pending.
  useEffect(() => {
    if (chipHopeConvertedIds.size === 0) return;
    const pendingIds = new Set((pendingBanners || []).map(r => r._rollDbId).filter(id => id != null));
    setChipHopeConvertedIds(prev => {
      const next = new Set([...prev].filter(id => pendingIds.has(id)));
      return next.size !== prev.size ? next : prev;
    });
  }, [pendingBanners]); // eslint-disable-line react-hooks/exhaustive-deps
  // ── Damage application state ─────────────────────────────────────────────
  const diceRollerRef = useRef(null);
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

  // Apply HP/Stress changes to a target after optional Parry reduction.
  // armorOpts: { applyReduction?, markSlot?, feature? }
  //   applyReduction: reduce hpLoss by 1 (or 2 for Fortified) — set by armor button
  //   markSlot: actually consume an armor slot — false when Resilient saves it
  //   feature: armor feature name ('Fortified', 'Painful', 'Reinforced', etc.)
  // dmgType: 'phy' | 'mag' | '' — damage type from the roll's post tag (Phase 3)
  const applyDamageToTarget = async (target, effectiveDmgTotal, tagNames, roll, armorOpts = {}, dmgType = '') => {
    const { applyReduction = false, markSlot = false, feature = null } = armorOpts;

    // Wrap target and roll so feature hooks receive clean semantic APIs.
    const entityTarget = wrapEntity(target, updateActiveElement);
    const ctx = { target: entityTarget, tagNames, roll: wrapRoll(roll), dmgType };

    // Pre-threshold damage modification (e.g. Warded subtracts armor score from magic damage)
    let dmgTotalForCalc = runPipelineHook(
      armorFeatures,
      target.armorFeatureName ? [target.armorFeatureName] : [],
      'modifyPreThresholdDamage',
      effectiveDmgTotal,
      ctx,
    );

    // Character resistance to physical damage (e.g. Galapa Retract, or resistance array)
    if (target.elementType === 'character' && (dmgType === 'phy' || dmgType === 'Physical')) {
      const resistance = Array.isArray(target.resistance) ? target.resistance : [];
      const hasResistance = target.retractedActive
        || resistance.some(r => (r.type === 'physical' || r.type === 'Physical'));
      if (hasResistance) dmgTotalForCalc = Math.floor(dmgTotalForCalc / 2);
    }

    let hpLoss = computeHpLoss(dmgTotalForCalc, target.thresholds);

    // HP loss modification (e.g. Deadly adds +1 on Severe)
    hpLoss = runPipelineHook(weaponFeatures, tagNames, 'modifyHpLoss', hpLoss, ctx);

    // Armor reduction when a slot is used
    if (applyReduction) {
      const reduction = armorFeatures[feature]?.armorReduction ?? 1;
      hpLoss = Math.max(0, hpLoss - reduction);
    }

    // Ancestry/feature HP reduction (e.g. Dwarf Thick Skin from onChipAck reduceHpLoss(1))
    const hpLossReduction = Math.max(0, Math.floor(roll?._hpLossReduction ?? 0));
    hpLoss = Math.max(0, hpLoss - hpLossReduction);

    // Origin lifecycle: onMarkHP can cancel (character only)
    if (target.elementType === 'character' && hpLoss > 0) {
      const hpCancel = runBeforeMarkHP(target, hpLoss, 'damage', updateActiveElement);
      if (hpCancel.cancel) hpLoss = 0;
    }
    if (hpLoss > 0) entityTarget.markHp(hpLoss);

    // Post-damage effects (Scary, Burning, etc.)
    runHook(weaponFeatures, tagNames, 'onDamageApplied', ctx);

    // Armor slot marking and triggered effects (Painful, Reinforced, etc.)
    // markArmor() runs first so hooks see the post-mark count via target.currentArmor.
    if (markSlot) {
      if (target.elementType === 'character') {
        const armorCancel = runBeforeMarkArmor(target, 1, feature ?? 'armor', updateActiveElement);
        if (!armorCancel.cancel) entityTarget.markArmor();
      } else {
        entityTarget.markArmor();
      }
      runHook(armorFeatures, feature ? [feature] : [], 'onArmorSlotMarked', ctx);
    }

    // Beastform auto-drop: character has an active beastform and either hit 0 HP,
    // or took Major-or-greater damage (hpLoss >= 2) while the beastform has Fragile.
    if (target.elementType === 'character' && entityTarget.activeBeastform) {
      const bf = entityTarget.activeBeastform;
      const isFragile = (bf.features || []).some(f => /fragile/i.test(f.name || ''));
      const dropped = entityTarget.currentHp === 0 || (hpLoss >= 2 && isFragile);
      if (dropped) {
        updateActiveElement(target.instanceId, { activeBeastform: null, selectedBeastformAdvantage: null });
        const reason = entityTarget.currentHp === 0 ? '(last HP)' : '(Fragile — Major or greater damage)';
        handleActionNotification({
          _action: true,
          rollUser: target.name || '',
          actionName: 'Dropped out of Beastform',
          actionText: `${target.name} drops out of Beastform ${reason}.`,
        });
      }
    }

    // Dispatch onDamageReceived for class features (e.g. Elemental Incarnation Severe drop)
    if (target.elementType === 'character' && hpLoss >= 1) {
      const targetClassFeat = classFeatures[target.class];
      if (targetClassFeat?.onDamageReceived) {
        targetClassFeat.onDamageReceived({ character: entityTarget, dmgTotal: dmgTotalForCalc, hpLoss, updateActiveElement });
      }
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

    // Parry: if target is a character with a Parry weapon, invoke the Parry hook
    if (target.type === 'character') {
      const charEl = activeElements.find(el => el.instanceId === target.instanceId);
      const parryWeapon = (charEl?.weapons || []).find(w => w.feature?.name === 'Parry');
      if (parryWeapon && roll?.subItems) {
        const parryFeature = weaponFeatures['Parry'];
        if (parryFeature?.onBeforeDamageApplied) {
          effectiveDmgTotal = await parryFeature.onBeforeDamageApplied(effectiveDmgTotal, {
            target: { ...target, name: charEl?.name || target.name },
            roll,
            parryWeapon,
            postRoll,
            addActionBanner: (n) => diceRollerRef.current?.addRoll(n),
          }) ?? effectiveDmgTotal;
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
        const resilientFeature = armorFeatures['Resilient'];
        if (resilientFeature?.onLastArmorSlot) {
          const charEl = activeElements.find(el => el.instanceId === target.instanceId);
          const charName = charEl?.name || target.name;
          const result = await resilientFeature.onLastArmorSlot({
            target,
            charName,
            postRoll,
            addActionBanner: (n) => diceRollerRef.current?.addRoll(n),
          });
          if (result?.saveSlot) markSlot = false;
        }
      }

      armorOpts = { applyReduction: true, markSlot, feature };
    }

    // Dwarf Increased Fortitude: spend 3 Hope to halve physical damage (toggle path; chip path uses setDamageTotal)
    if (target.useIncreasedFortitude && roll?._damageTotalOverride == null && dmgType === 'phy' && target.type === 'character') {
      const charEl = activeElements.find(el => el.instanceId === target.instanceId);
      if (charEl && (charEl.hope ?? 0) >= 3) {
        updateActiveElement(target.instanceId, { hope: Math.max(0, (charEl.hope ?? 0) - 3) });
        effectiveDmgTotal = Math.floor(effectiveDmgTotal / 2);
      }
    }

    const newHp = await applyDamageToTarget(target, effectiveDmgTotal, tagNames, roll, armorOpts, dmgType);
    const hpApplied = (target.currentHp ?? target.maxHp ?? 0) - newHp;

    // Fire: retaliation when adversary within Melee range deals HP damage to channeling Druid
    const charEl = target.type === 'character'
      ? activeElements.find(e => e.instanceId === target.instanceId) : null;
    if (hpApplied >= 1 && charEl?.activeChanneledElement === 'fire'
        && roll?._attackerType === 'adversary') {
      const attackerIds = roll._attackerInstanceIds ?? (roll._attackerInstanceId ? [roll._attackerInstanceId] : []);
      const isMelee = charEl.tokenX != null
        ? getAdversariesWithinMeleeRange(activeElements, charEl.instanceId).some(a => attackerIds.includes(a.instanceId))
        : (roll._attackRangeFt != null && roll._attackRangeFt <= RANGE_BANDS_FT.MELEE);
      if (isMelee && attackerIds.length > 0) {
        const fireTargetId = attackerIds[0];
        postRoll(`${charEl.name} Fire Retaliation damage [1d10]`, charEl.name, null, {
          attackerId: charEl.instanceId,
          targetId: fireTargetId,
        }).catch(() => {});
      }
    }

    // Water: adversaries in Very Close range of the target mark Stress
    if (hpApplied >= 1 && target.type === 'adversary' && roll?._attackerInstanceId) {
      const waterChar = activeElements.find(e => e.instanceId === roll._attackerInstanceId
        && e.elementType === 'character' && e.activeChanneledElement === 'water');
      if (waterChar) {
        const isMeleeHit = (() => {
          const adv = activeElements.find(e => e.instanceId === target.instanceId);
          // If both tokens are on the map, use actual distance
          if (waterChar.tokenX != null && adv?.tokenX != null) {
            return tokenDistanceFt(waterChar.tokenX, waterChar.tokenY, adv.tokenX, adv.tokenY) <= RANGE_BANDS_FT.MELEE;
          }
          // Either token off-map: assume melee-range is possible (matches preview behavior)
          return true;
        })();
        if (isMeleeHit) {
          const veryCloseAdvs = getAdversariesWithinRangeFt(activeElements, waterChar.instanceId, RANGE_BANDS_FT.VERY_CLOSE)
            .filter(a => a.instanceId !== target.instanceId);
          for (const adv of veryCloseAdvs) {
            const advEl = activeElements.find(e => e.instanceId === adv.instanceId);
            if (advEl) {
              updateActiveElement(adv.instanceId, { currentStress: Math.min((advEl.currentStress ?? 0) + 1, advEl.maxStress ?? 6) });
            }
          }
          if (veryCloseAdvs.length > 0) {
            handleActionNotification({ _action: true, rollUser: waterChar.name,
              actionName: 'Water Retaliation', actionText: `Water: ${veryCloseAdvs.length} nearby adversary/adversaries marked Stress.` });
          }
        }
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
    pendingDamageRef.current = { instanceId: target.instanceId, newHp };
  };


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


  // Full reroll: cancel current banner and post the same roll again (shared by Lucky and Human Adaptability).
  // extraMeta is merged into the new roll (e.g. _luckyStressCost for Lucky; Adaptability applies stress on chip ack so passes {}).
  const performFullReroll = useCallback((roll, extraMeta = {}) => {
    if (roll._rollDbId) postBannerAck(roll._rollDbId, 'cancel').catch(() => {});
    if (!roll.rollText) return;
    const attacker = roll._attackerInstanceId
      ? activeElements.find(e => e.instanceId === roll._attackerInstanceId)
      : findAttacker(roll.rollUser);
    postRoll(roll.rollText, roll.rollUser ?? roll.displayName, isPlayer ? gmUid : null, {
      _attackerInstanceId: attacker?.instanceId,
      ...extraMeta,
    }).catch(err => console.error('Full reroll failed:', err));
  }, [isPlayer, gmUid, activeElements, postBannerAck, postRoll]);

  // Lucky: Mark 1 Stress to reroll on Fear. Stress is applied on Acknowledge of the new roll.
  const handleLuckyReroll = (roll) => performFullReroll(roll, { _luckyStressCost: 1 });

  // Quick: apply the same damage to a second target, marking 1 Stress on the attacker.
  const handleQuickTarget = async (target, dmgTotal, tags, roll, dmgType = '') => {
    await handleApplyDamage(target, dmgTotal, tags, roll, dmgType);
    const attacker = findAttacker(roll.rollUser);
    if (attacker?.elementType === 'character') {
      const stressCancel = await runBeforeMarkStress(attacker, 1, 'Quick', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
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
      const stressCancel = await runBeforeMarkStress(attacker, 1, 'Bouncing', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
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

    if (roll._rollDbId) postBannerAck(roll._rollDbId, 'cancel').catch(() => {});

    const rollText = roll.rollText;
    if (!rollText) return;

    postRoll(rollText, roll.rollUser, null, {
      _notThisTime: true, _wizardName: wizard.name,
      _notThisTimeHopeCost: 3,
      _wizardInstanceId: wizard.instanceId,
    }).catch(err => console.error('Not This Time reroll failed:', err));
  };

  // Generic ancestry banner reaction handler.
  // For features with toggleKey: the system manages the toggle state automatically.
  // chip.activate (if present) is called as a veto hook — return { cancel: true } to abort.
  // For features without toggleKey: delegates entirely to chip.activate.
  const handleBannerReactionActivate = (reaction, roll) => {
    const chip = reaction.chip;
    const charEl = activeElements.find(e => e.instanceId === reaction.character.instanceId);
    if (!charEl) return;
    const character = wrapEntity(charEl, updateActiveElement);

    const stateKey = reaction.stateKey;
    const rollWithMine = wrapRoll(roll);
    rollWithMine.isMine = roll._attackerInstanceId != null ? roll._attackerInstanceId === charEl.instanceId : !!(roll.rollUser && charEl.name && (roll.rollUser.toLowerCase() === charEl.name.toLowerCase() || roll.rollUser.toLowerCase().startsWith(charEl.name.toLowerCase())));
    if (stateKey && roll._rollDbId != null) {
      // isCurrentlyActive: true when the toggle is already ON for this roll (click would turn it off).
      const isCurrentlyActive = charEl[stateKey] === roll._rollDbId;
      const hopeCost = chip?.hopeCost ?? 0;
      const stressCost = chip?.stressCost ?? 0;
      // When toggling on, check declared costs first, then getDisabledMessage.
      if (!isCurrentlyActive) {
        if (hopeCost > 0 && character.hope < hopeCost) return;
        if (stressCost > 0 && !character.hasStress(stressCost)) return;
        if (chip?.getDisabledMessage && chip.getDisabledMessage(rollWithMine, character)) return;
      }
      // Optional veto hook for features that need logic beyond getDisabledMessage.
      if (chip?.activate) {
        const result = chip.activate(rollWithMine, character, { characterRaw: charEl, isCurrentlyActive });
        if (result?.cancel) return;
      }
      const newValue = isCurrentlyActive ? null : roll._rollDbId;
      if (isPlayer && postCharacterUpdate) {
        postCharacterUpdate(gmUid, charEl.instanceId, { [stateKey]: newValue }).catch(() => {});
      } else {
        character.setFlag(stateKey, newValue);
      }
    } else {
      // Non-toggle feature (e.g. Feline Instincts): delegate entirely to chip.activate.
      if (!chip?.activate) return;
      chip.activate(rollWithMine, character, {
        characterRaw: charEl,
        isPlayer,
        gmUid,
        postCharacterUpdate,
        postBannerAck,
        postRerollHopeDie,
        postBannerFeatureRequest: postBannerFelineRerollRequest,
        updateActiveElement,
        activeElements,
        onFeatureRequestSuccess: reaction.featureName === 'Feline Instincts' ? onFelineRerollRequestSuccess : undefined,
        onFeatureRequestCancel: reaction.featureName === 'Feline Instincts' ? onFelineRerollRequestCancel : undefined,
      });
    }
  };

  // Chip Ack/Reject (onChipAck/onChipReject): persist resolved state, apply costs, run handler; if addDamage used, replace banner with augmented roll.
  // System guarantees character.name and roll.target.name for addNarration().
  const handleChipResolve = useCallback(async (reaction, roll, action) => {
    const chip = reaction.chip;
    const stateKey = reaction.stateKey;
    if (!stateKey || roll._rollDbId == null || !gmUid) return;
    if (roll._chipResolved?.[stateKey]) return; // already resolved
    const charEl = activeElements.find(e => e.instanceId === reaction.character.instanceId);
    if (!charEl) return;
    enrichRollWithDamage(roll, activeElements);
    const wrappedChar = wrapEntity(charEl, updateActiveElement);
    const characterName = wrappedChar.name ?? roll.rollUser ?? roll.displayName ?? 'Character';
    const characterForChip = { ...wrappedChar, name: characterName };
    // Use a display store so setWithHope() is available; check it after onChipAck runs.
    const chipDisplayStore = {};
    const rollWithTarget = wrapRoll(roll, chipDisplayStore, reaction.character.instanceId);
    const featureName = reaction.featureName ?? 'Feature';
    const ctx = {
      _extraDamage: null,
      _narration: null,
      addDamage(expr) { this._extraDamage = String(expr).trim(); },
      addNarration(text) { this._narration = `${featureName}: ${text}`; },
      /** Request that the selected damage target take no HP/Stress from this roll (e.g. Faerie Wings). */
      setTreatAsMissForTarget(instanceId) { roll._treatAsMissForTarget = instanceId; },
      characterRaw: charEl,
    };
    // Feature-level state: get/set backed by character._originFeatureState[featureName]. Preserved via _ prefix.
    const feature = {
      get(key, defaultVal) {
        const bag = charEl._originFeatureState?.[featureName];
        return bag != null && key in bag ? bag[key] : defaultVal;
      },
      set(key, value) {
        const current = charEl._originFeatureState ?? {};
        const featureBag = current[featureName] ?? {};
        const next = { ...current, [featureName]: { ...featureBag, [key]: value } };
        charEl._originFeatureState = next; // so same-tick get() sees the update
        updateActiveElement(charEl.instanceId, { _originFeatureState: next });
      },
    };
    // Run costs + onChipAck BEFORE the server call so we can capture override values to persist.
    if (action === 'ack') {
      if (chip?.hopeCost > 0) wrappedChar.spendHope(chip.hopeCost);
      if (chip?.stressCost > 0) {
        const stressCancel = await runBeforeMarkStress(charEl, chip.stressCost, 'chip', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
        if (!stressCancel.cancel) {
          const effective = chip.stressCost - (stressCancel.reduceBy ?? 0);
          if (effective > 0) wrappedChar.markStress(effective);
        }
      }
      if (chip?.onChipAck) chip.onChipAck(rollWithTarget, characterForChip, ctx, feature);
      if (chip?.resetsOn && (reaction._featureKey ?? chip._featureKey)) wrappedChar.setFeatureUsed(reaction._featureKey ?? chip._featureKey, chip.resetsOn);
    } else {
      if (chip?.onChipReject) chip.onChipReject(rollWithTarget, characterForChip, ctx, feature);
    }
    // Capture any override values set by onChipAck and persist them to the server so they
    // survive the SSE snapshot refresh that immediately follows chip resolution.
    const extraPatch = {};
    if (roll._damageTotalOverride != null) extraPatch._damageTotalOverride = roll._damageTotalOverride;
    if (roll._hpLossReduction != null) extraPatch._hpLossReduction = roll._hpLossReduction;
    if (roll._treatAsMissForTarget != null) extraPatch._treatAsMissForTarget = roll._treatAsMissForTarget;
    try {
      await postBannerChipResolve(gmUid, {
        bannerId: roll._rollDbId, stateKey, action,
        ...(Object.keys(extraPatch).length > 0 ? { extraPatch } : {}),
      });
    } catch (err) {
      console.error('Chip resolve failed:', err);
      return;
    }
    // If onChipAck called roll.setWithHope(), record that for display color and ack behavior.
    if (action === 'ack' && roll._rollDbId != null && chipDisplayStore[roll._rollDbId]?.dominantForDisplay === 'hope') {
      setChipHopeConvertedIds(prev => new Set([...prev, roll._rollDbId]));
    }
    if (ctx._extraDamage) {
      try {
        const newRoll = await postBannerAddDamage(roll._rollDbId, {
          extraDamage: ctx._extraDamage,
          extraDamageLabel: reaction.featureName ?? undefined,
          narration: ctx._narration ?? undefined,
          suppressAncestryFeature: reaction.featureName,
        });
        diceRollerRef.current?.dismissBannerByDbId?.(roll._rollDbId);
        if (newRoll) {
          diceRollerRef.current?.addRoll?.(newRoll);
          // Keep sync with subscription: treat old as gone and new as seen so effect doesn't re-add or re-dismiss
          pendingBannerDbIdsRef.current.delete(roll._rollDbId);
          if (newRoll._rollDbId) pendingBannerDbIdsRef.current.add(newRoll._rollDbId);
        }
      } catch (err) {
        console.error('Banner add-damage failed:', err);
      }
    } else if (roll._rerollDuality) {
      try {
        const newRoll = await postBannerRerollDie(roll._rollDbId, {
          dieType: 'Duality',
          suppressAncestryFeature: reaction.featureName,
        });
        diceRollerRef.current?.dismissBannerByDbId?.(roll._rollDbId);
        if (newRoll) {
          diceRollerRef.current?.addRoll?.(newRoll);
          pendingBannerDbIdsRef.current.delete(roll._rollDbId);
          if (newRoll._rollDbId) pendingBannerDbIdsRef.current.add(newRoll._rollDbId);
        }
      } catch (err) {
        console.error('Banner reroll-duality failed:', err);
      }
    } else if (roll._rerollDie) {
      try {
        const newRoll = await postBannerRerollDie(roll._rollDbId, {
          dieType: roll._rerollDie,
          suppressAncestryFeature: reaction.featureName,
        });
        diceRollerRef.current?.dismissBannerByDbId?.(roll._rollDbId);
        if (newRoll) {
          diceRollerRef.current?.addRoll?.(newRoll);
          pendingBannerDbIdsRef.current.delete(roll._rollDbId);
          if (newRoll._rollDbId) pendingBannerDbIdsRef.current.add(newRoll._rollDbId);
        }
      } catch (err) {
        console.error('Banner reroll-die failed:', err);
      }
    } else if (roll._fullReroll && roll.rollText) {
      diceRollerRef.current?.dismissBannerByDbId?.(roll._rollDbId);
      performFullReroll(roll, {});
    }
  }, [gmUid, isPlayer, activeElements, updateActiveElement, performFullReroll]);

  // Action notification (e.g. Startling, session-cycle banners): fire-and-forget broadcast.
  const handleActionNotification = (notification) => {
    dismissAllHoverCards();
    postActionNotification(notification).catch(() => {});
  };

  // Player action notification — fire-and-forget broadcast to GM room.
  const handlePlayerActionNotification = (notification) => {
    dismissAllHoverCards();
    postActionNotification(notification, gmUid).catch(() => {});
  };

  // Origin lifecycle (e.g. Unshakable): post action banner with character name.
  const postActionForStress = (charEl, actionName, actionText) => {
    const notifier = isPlayer ? handlePlayerActionNotification : handleActionNotification;
    notifier({ _action: true, rollUser: charEl?.name ?? 'Character', actionName, actionText });
  };

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
    if (roll._rollDbId) postBannerAck(roll._rollDbId, 'cancel').catch(() => {});
    if (!roll.rollText || !roll.subItems) return;
    postRerollDualityDice(roll).catch(err => console.error('Ranger Focus reroll failed:', err));
  };

  // Ranger's Focus: player toggles reroll request — sets or clears _rangerFocusRerollRequestedBy.
  const handleRangerFocusRerollRequest = (bannerId) => {
    if (gmUid) {
      postBannerRangerFocusRerollRequest(gmUid, bannerId)
        .then((res) => {
          if (res?.requested) onRangerFocusRerollRequestSuccess?.(bannerId);
          else onRangerFocusRerollRequestCancel?.(bannerId);
        })
        .catch(() => {});
    }
  };

  // Hold Them Off (Ranger): GM or player toggles "Spend 3 Hope to select two more targets" on the banner.
  const handleHoldThemOffToggle = (bannerId, active) => {
    if (gmUid) {
      postBannerHoldThemOff(gmUid, bannerId, active).catch(() => {});
    }
  };

  // Multi-target selection: GM or player changes selected targets or armor toggles (synced across clients).
  const handleBannerTargetsChange = (bannerId, patch) => {
    if (gmUid) postBannerTargets(gmUid, bannerId, patch).catch(() => {});
  };

  // Rally Die: GM or player toggles "Add Rally Die to roll/damage" on the banner (shared state).
  const handleRallyDieToggle = (bannerId, field, value) => {
    if (gmUid) {
      postBannerRallyToggle(gmUid, bannerId, field, value).catch(() => {});
    }
  };

  // Heart of a Poet (Wordsmith): toggle intent to add d4 — both GM and player use the same toggle endpoint.
  // On Ack with toggle enabled, handleBannerAcknowledge intercepts and calls postBannerHeartD4Ack.
  const handleHeartD4Toggle = (bannerId, value) => {
    const roomUid = gmUid || user?.uid;
    if (roomUid) postBannerHeartD4Toggle(roomUid, bannerId, value).catch(() => {});
  };

  // Kept for backward compat — player path still uses gmUid (the room owner's UID).
  const handleHeartD4ToggleRequest = (bannerId, value) => {
    if (gmUid) postBannerHeartD4Toggle(gmUid, bannerId, value).catch(() => {});
  };

  // Wings of Light (Winged Sentinel): GM clicks toggle — spend 1 Hope and roll 1d8, patch banner.
  const handleWingsD8Toggle = (bannerId) => {
    postBannerWingsD8(bannerId).catch(() => {});
  };

  // Wings of Light: Player toggles _wingsOfLightAddD8 on banner (shared state).
  const handleWingsD8ToggleRequest = (bannerId, value) => {
    if (gmUid) postBannerWingsD8Toggle(gmUid, bannerId, value).catch(() => {});
  };

  // Wings of Light: When applying damage and roll had _wingsOfLightAddD8 but no _wingsOfLightD8Result (player toggled), ack with wingsOfLightD8 to get d8 and return it.
  const getWingsD8Extra = async (roll) => {
    if (roll._wingsOfLightD8Result != null) return roll._wingsOfLightD8Result;
    const res = await postBannerAck(roll._rollDbId, 'acknowledge', { wingsOfLightD8: true });
    return res?.wingsOfLightD8Result ?? 0;
  };

  // Prayer Dice: GM or player selects/deselects a prayer die for add-to-roll or damage-reduction.
  // Uses the GM's uid (gmUid) as room identifier for both parties.
  const handlePrayerDieSelect = (bannerId, opts) => {
    if (!gmUid) return;
    postBannerPrayerDieSelect(gmUid, bannerId, opts).catch(() => {});
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
    postRoll(secRollText, `${roll.rollUser} (Doubled Up)`).then(secRollData => {
      const secDamageSub = (secRollData.subItems || []).find(s => /damage/i.test(s.pre || '') && s.input);
      const secDmgTotal = secDamageSub ? parseInt(secDamageSub.result, 10) : 0;
      if (secDmgTotal > 0) {
        handleApplyDamage(target, secDmgTotal, [], secRollData);
      }
    }).catch(err => console.error('Doubled Up roll failed:', err));
  };


  // GM acknowledges a banner: apply all game side-effects, broadcast to other clients via banner-ack.
  // This is the unified replacement for handleDiceRollComplete + handlePlayerRollComplete.
  // options: { selectedLifeSupportTargetInstanceId?: string, selectedRetractingClawsTargetInstanceId?: string } for single-target selection.
  const handleBannerAcknowledge = async (bannerId, roll, options = {}) => {
    removePendingCosts(roll);

    // Rest banner: server already applied fear on ack; run move onApply hooks, then clear rest-move state and run feature/rest cycle clear.
    if (roll._rest && roll._rollDbId) {
      postBannerAck(roll._rollDbId, 'acknowledge').catch(() => {});
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

    // Start Session banner: acknowledge then run session clear + onSessionStart hooks.
    if (roll._sessionStart && roll._rollDbId) {
      postBannerAck(roll._rollDbId, 'acknowledge').catch(() => {});
      runSessionStartClear();
      return;
    }

    // Rally Die banner toggle: cancel original, remove modifier, create copy banner with die added.
    // Skip all other processing — the copy banner goes through normal ack.
    if ((roll._rallyDieAddToRoll || roll._rallyDieAddToDamage) && roll._rollDbId) {
      postBannerRallyAck(roll._rollDbId, {
        addToRoll: !!roll._rallyDieAddToRoll,
        addToDamage: !!roll._rallyDieAddToDamage,
      }).catch(err => console.error('Rally Die ack failed:', err));
      return;
    }

    // Heart of a Poet banner toggle: cancel original, decrement 1 Hope, create copy banner with d4 added.
    // Skip all other processing — the copy banner goes through normal ack.
    if (roll._heartOfAPoetAddD4 && roll._rollDbId) {
      postBannerHeartD4Ack(roll._rollDbId).catch(err => console.error('Heart of a Poet ack failed:', err));
      return;
    }

    // Virtual weapon feature: apply stressCost/hopeCost then delegate to onAcknowledge if present.
    if (roll._featureNeedsTarget && options.selectedFeatureTargetInstanceId && roll._featureName) {
      const behavior = virtualWeaponBehaviors[roll._featureName];
      if (behavior) {
        const targetEl = activeElements.find(e => e.instanceId === options.selectedFeatureTargetInstanceId);
        const selfEl = roll._attackerInstanceId ? activeElements.find(e => e.instanceId === roll._attackerInstanceId) : null;
        const self = selfEl ? wrapEntity(selfEl, updateActiveElement) : null;
        if (targetEl) {
          if (self) {
            const n = Number(behavior.stressCost) || 0;
            if (n > 0) self.markStress(n);
            const h = Number(behavior.hopeCost) || 0;
            if (h > 0) self.spendHope(h);
          }
          if (typeof behavior.onAcknowledge === 'function') {
            behavior.onAcknowledge({
              target: wrapEntity(targetEl, updateActiveElement),
              ...(selfEl && { self: wrapEntity(selfEl, updateActiveElement) }),
            });
          }
        }
      }
    }

    if (roll._action) {
      // Card toggle chips (e.g. Galapa Retract): state applies only on GM ack; banner was already posted on click.
      if (roll._cardToggle) {
        const ct = roll._cardToggle;
        const el = activeElements.find(e => e.instanceId === ct.instanceId);
        const descriptor = ancestryFeatures[ct.featureName];
        const toggleChip = descriptor?.cardChips?.find(c => typeof c.onToggle === 'function');
        if (el && toggleChip) {
          // Batch toggle key + onToggle effects (moveDisabledSources, resistance, disadvantageSources) into one op
          const batch = { [ct.derivedToggleKey]: ct.nextActive };
          const batchUpdate = (instanceId, updates) => { if (instanceId === ct.instanceId) Object.assign(batch, updates); };
          const character = wrapEntity(el, batchUpdate);
          const featureObj = { name: ct.featureName, source: ct.featureSource, description: descriptor.description };
          toggleChip.onToggle(ct.nextActive, character, { character, feature: featureObj });
          updateActiveElement(ct.instanceId, batch);
        } else {
          updateActiveElement(ct.instanceId, { [ct.derivedToggleKey]: ct.nextActive });
        }
      }

      // Wings of Light (Winged Sentinel): Pick up and carry — mark 1 Stress on the character when GM acks.
      if (roll._featureName === 'Wings of Light' && roll._wingsOfLightPickUpCarry && roll._attackerInstanceId) {
        const charEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
        if (charEl) {
          const stressCancel = await runBeforeMarkStress(charEl, 1, 'Wings of Light', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
          if (!stressCancel.cancel) {
            const effective = 1 - (stressCancel.reduceBy ?? 0);
            if (effective > 0) {
              const maxStress = charEl.maxStress ?? 6;
              const newStress = Math.min((charEl.currentStress ?? 0) + effective, maxStress);
              updateActiveElement(roll._attackerInstanceId, { currentStress: newStress });
            }
          }
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

        // Dispatch class feature activation hook (e.g. Druid Beastform / Evolution, Bard Make a Scene)
        if (attackerEl) {
          const classFeat = classFeatures[attackerEl.class];
          if (classFeat?.onFeatureActivated) {
            const selfEl = wrapEntity(attackerEl, batchCollect);
            // Make a Scene (Bard): pass selected adversary so difficultyMod is applied
            const makeASceneTargetId = options?.selectedMakeASceneTargetInstanceId ?? roll._selectedTargetInstanceId ?? null;
            const targetEl = makeASceneTargetId
              ? activeElements.find(e => e.instanceId === makeASceneTargetId) ?? null
              : null;
            classFeat.onFeatureActivated({
              featureName: roll._featureName ?? null,
              subFeatureName: roll._subFeatureName ?? null,
              inputValue: roll._inputValue ?? null,
              targetEl,
              selfEl,
              updateActiveElement: batchCollect,
              roll,
            });
            if (roll._featureName === 'Make a Scene' && roll._rollDbId != null) {
              setMakeASceneSelections(prev => {
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
          postTableOp({ op: 'update-elements', updates: batchEntries.map(([id, upd]) => ({ instanceId: id, updates: upd })) });
        }
      }
      if (roll._attackerInstanceId) {
        const actionTagNames = new Set((roll.tags || []).map(t => t.name));
        const actionAttackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
        const actionAttacker = actionAttackerEl ? wrapEntity(actionAttackerEl, updateActiveElement) : null;
        runHook(weaponFeatures, actionTagNames, 'onRollComplete', { attacker: actionAttacker, roll });
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

      postBannerAck(roll._rollDbId, 'acknowledge').catch(() => {});
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
    // Rally Die clear-stress: roll total clears that many stress from the character, then remove the die.
    if (roll._rallyClearStress && roll._attackerInstanceId) {
      const rallyEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      if (rallyEl) {
        const rollTotal = roll.total ?? parseInt(roll.subItems?.[0]?.result, 10) ?? 0;
        const newStress = Math.max(0, (rallyEl.currentStress ?? 0) - rollTotal);
        const newMods = (rallyEl.activeModifiers || []).filter(m => m.id !== roll._rallyDieModId);
        updateActiveElement(roll._attackerInstanceId, { currentStress: newStress, activeModifiers: newMods });
      }
    }
    // Apply deferred costs from Lucky reroll (1 Stress) and Not This Time (3 Hope)
    if (roll._luckyStressCost > 0 && roll._attackerInstanceId) {
      const attackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
      if (attackerEl) {
        const stressCancel = await runBeforeMarkStress(attackerEl, roll._luckyStressCost, 'Lucky', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
        if (!stressCancel.cancel) {
          const effective = roll._luckyStressCost - (stressCancel.reduceBy ?? 0);
          if (effective > 0) {
            const maxStress = attackerEl.maxStress ?? 6;
            updateActiveElement(roll._attackerInstanceId, { currentStress: Math.min((attackerEl.currentStress ?? 0) + effective, maxStress) });
          }
        }
      }
    }
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
    // Dispatch onRollComplete hook for all weapon feature tags
    {
      const rollTagNames = new Set((roll.tags || []).map(t => t.name));
      const attackerEl = roll._attackerInstanceId
        ? activeElements.find(e => e.instanceId === roll._attackerInstanceId)
        : findAttacker(roll.rollUser);
      const attacker = attackerEl ? wrapEntity(attackerEl, updateActiveElement) : null;
      runHook(weaponFeatures, rollTagNames, 'onRollComplete', { attacker, roll });
    }
    // Generic ancestry banner reaction acknowledge: run chip.onBannerAck (or legacy acknowledge) for each active reaction.
    // Features request "convert to Hope" by calling roll.setWithHope() in acknowledge; system applies skip-fear + grant hope after the loop.
    // Also check chipHopeConvertedIds: if onChipAck already called setWithHope() for this roll, honor it here.
    let hopeConversionRequested = !!(roll._rollDbId != null && chipHopeConvertedIds.has(roll._rollDbId));
    if (hopeConversionRequested && roll._rollDbId != null) {
      setChipHopeConvertedIds(prev => { const next = new Set(prev); next.delete(roll._rollDbId); return next; });
    }
    const rollForAck = Object.assign(wrapRoll(roll), {
      setWithHope() { hopeConversionRequested = true; },
    });
    for (const reaction of ancestryBannerReactions) {
      if (!reaction.matchesRoll(roll)) continue;
      const charEl = activeElements.find(e => e.instanceId === reaction.character.instanceId);
      if (!charEl) continue;
      const chip = reaction.chip;
      const acknowledge = chip?.onBannerAck ?? chip?.acknowledge;
      if (!acknowledge) continue;
      const stateKey = reaction.stateKey;
      const isToggledOn = !!(stateKey && roll._rollDbId != null && charEl[stateKey] === roll._rollDbId);
      const wrappedChar = wrapEntity(charEl, updateActiveElement);
      const featureName = reaction.featureName ?? 'Feature';
      const feature = {
        get(key, defaultVal) {
          const bag = charEl._originFeatureState?.[featureName];
          return bag != null && key in bag ? bag[key] : defaultVal;
        },
        set(key, value) {
          const current = charEl._originFeatureState ?? {};
          const next = { ...current, [featureName]: { ...(current[featureName] ?? {}), [key]: value } };
          charEl._originFeatureState = next;
          updateActiveElement(charEl.instanceId, { _originFeatureState: next });
        },
      };
      const ctx = { postRoll, characterRaw: charEl, feature };
      if (isToggledOn) {
        if (chip?.hopeCost > 0) wrappedChar.spendHope(chip.hopeCost);
        if (chip?.stressCost > 0) {
          const stressCancel = await runBeforeMarkStress(charEl, chip.stressCost, 'banner-ack', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
          if (!stressCancel.cancel) {
            const effective = chip.stressCost - (stressCancel.reduceBy ?? 0);
            if (effective > 0) wrappedChar.markStress(effective);
          }
        }
        if (acknowledge) acknowledge.call(chip, rollForAck, wrappedChar, ctx, feature);
        if (chip?.resetsOn && (reaction._featureKey ?? chip._featureKey)) wrappedChar.setFeatureUsed(reaction._featureKey ?? chip._featureKey, chip.resetsOn);
      } else if (acknowledge) {
        acknowledge.call(chip, rollForAck, wrappedChar, ctx, feature);
      }
    }
    // Clear any toggle state for this roll (system-owned: features don't clear it).
    for (const reaction of ancestryBannerReactions) {
      const stateKey = reaction.stateKey;
      if (!stateKey) continue;
      for (const el of activeElements) {
        if (el[stateKey] === roll._rollDbId) {
          updateActiveElement(el.instanceId, { [stateKey]: null });
        }
      }
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
    if (!options?.alreadyAcked) postBannerAck(roll._rollDbId, 'acknowledge').catch(() => {});
  };

  // GM cancels a banner: dismiss without any effects.
  const handleBannerCancel = (bannerId, roll) => {
    if (roll._lifeSupportTargets != null && onLifeSupportClear) onLifeSupportClear(roll._rollDbId);
    if (roll._rest && roll._rollDbId != null && onRestMoveClear) onRestMoveClear(roll._rollDbId);
    removePendingCosts(roll);
    pendingDamageRef.current = null;
    // Generic ancestry banner reaction cancel: run chip.onBannerReject (or legacy cancel)
    for (const reaction of ancestryBannerReactions) {
      const chip = reaction.chip;
      const cancel = chip?.onBannerReject ?? chip?.cancel;
      if (!cancel) continue;
      if (!reaction.matchesRoll(roll)) continue;
      const charEl = activeElements.find(e => e.instanceId === reaction.character.instanceId);
      if (!charEl) continue;
      const stateKey = reaction.stateKey;
      const isToggledOn = !!(stateKey && roll._rollDbId != null && charEl[stateKey] === roll._rollDbId);
      const wrappedChar = wrapEntity(charEl, updateActiveElement);
      cancel.call(chip, roll, wrappedChar, { isToggledOn, characterRaw: charEl });
    }
    // Clear any toggle state for this roll (system-owned: features don't clear it).
    for (const reaction of ancestryBannerReactions) {
      const stateKey = reaction.stateKey;
      if (!stateKey) continue;
      for (const el of activeElements) {
        if (el[stateKey] === roll._rollDbId) {
          updateActiveElement(el.instanceId, { [stateKey]: null });
        }
      }
    }
    postBannerAck(roll._rollDbId, 'cancel').catch(() => {});
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
      const maxHope = el.maxHope ?? 6;
      const current = el.hope ?? maxHope;
      updates.hope = Math.max(0, current - roll._hopeCost);
    }
    if (roll._stressCost > 0) {
      const stressCancel = await runBeforeMarkStress(el, roll._stressCost, 'feature-use', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
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
    // Feature-specific modifier additions — attacker only
    if (roll._addModifiers?.length > 0 && !roll._distributeModifiersToAll) {
      updates.activeModifiers = [...(el.activeModifiers || []), ...roll._addModifiers];
    }
    if (Object.keys(updates).length > 0) {
      updateFn(instanceId, updates);
    }
    // Distribute modifiers to ALL characters (e.g. Rally Die distributes to whole party)
    if (roll._distributeModifiersToAll && roll._addModifiers?.length > 0) {
      const allChars = activeElements.filter(e => e.elementType === 'character');
      for (const char of allChars) {
        // Give each character a uniquely-ID'd copy of the modifier
        const mods = roll._addModifiers.map(m => ({ ...m, id: `${m.id || m.name}-${char.instanceId}` }));
        updateFn(char.instanceId, {
          activeModifiers: [...(char.activeModifiers || []), ...mods],
        });
      }
    }
    return Object.keys(updates).length > 0 ? { instanceId, updates } : null;
  };

  // Run session-start clear and ancestry hooks (used when GM acknowledges Start Session banner).
  const runSessionStartClear = () => {
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
      if (Object.keys(updates).length > 0) {
        updateActiveElement(char.instanceId, updates);
      }
    }
    const featuresWithSessionStart = Object.entries(ancestryFeatures).filter(([, d]) => typeof d.onSessionStart === 'function').map(([name]) => name);
    const getFeatureForCharacter = (el, featureName) => {
      const get = (key, defaultVal) => { const bag = el._originFeatureState?.[featureName]; return bag != null && key in bag ? bag[key] : defaultVal; };
      const set = (key, value) => {
        const current = el._originFeatureState ?? {};
        const next = { ...current, [featureName]: { ...(current[featureName] ?? {}), [key]: value } };
        updateActiveElement(el.instanceId, { _originFeatureState: next });
      };
      return { get, set };
    };
    const wrappedCharacters = charactersList.map(el => wrapEntity(el, updateActiveElement));
    for (const name of featuresWithSessionStart) {
      const charsWithFeature = charactersList.filter(el =>
        [...(el.ancestryFeatures || []), ...(el.communityFeatures || [])].some(f => f.name === name)
      );
      if (charsWithFeature.length === 0) continue;
      const hook = ancestryFeatures[name].onSessionStart;
      if (hook.length === 1) {
        for (const el of charsWithFeature) hook(getFeatureForCharacter(el, name));
      } else {
        hook(null, wrappedCharacters);
      }
    }
  };

  // ── Session / Rest cycle handlers ────────────────────────────────────────────
  // Start Session: post action banner; clear + onSessionStart run when GM acknowledges.
  // Short/Long Rest: post 1d4 roll → RestBanner; clear runs on ack.
  const handleSessionCycle = (cycle) => {
    const label = cycle === 'session' ? 'Start Session'
      : cycle === 'rest' ? 'Short Rest'
      : 'Long Rest';

    if (cycle === 'rest' || cycle === 'longRest') {
      const displayName = user?.displayName || user?.email || 'GM';
      const actionText = cycle === 'rest'
        ? 'Short rest — choose your moves per character (some ancestries grant extra slots), then acknowledge to add Fear and refresh rest-use features.'
        : 'Long rest — choose your moves per character (some ancestries grant extra slots), then acknowledge to add Fear and refresh rest and long-rest features.';
      postRoll(' [1d4]', displayName, isPlayer ? gmUid : null, {
        _action: true,
        _rest: true,
        _restDuration: cycle === 'rest' ? 'short' : 'long',
        actionName: label,
        actionText,
      }).catch(err => console.error('Rest roll failed:', err));
      return;
    }

    // Start Session: post banner only; session reset runs on GM acknowledge.
    const cycleNotification = {
      _action: true,
      _sessionStart: true,
      rollUser: 'GM',
      actionName: label,
      actionText: 'Start Session — acknowledge to refresh session-use features for all characters.',
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
      if (char.activeChanneledElement && cyclesToClear.includes('rest')) {
        updates.activeChanneledElement = null;
      }
      if (Object.keys(updates).length > 0) batchMap[char.instanceId] = updates;
    }
    if (Object.keys(batchMap).length > 0) {
      postTableOp({ op: 'update-elements', updates: Object.entries(batchMap).map(([instanceId, updates]) => ({ instanceId, updates })) });
    }
  };

  // Track previous pendingBanners so removePendingCosts fires for non-initiating clients
  // when a banner disappears from the subscription snapshot (acknowledged or cancelled elsewhere).
  const prevPendingRef = useRef([]);
  useEffect(() => {
    const prev = prevPendingRef.current;
    const current = pendingBanners;
    prev.forEach(roll => {
      if (!current.some(r => r._rollDbId === roll._rollDbId)) {
        removePendingCosts(roll);
      }
    });
    prevPendingRef.current = current;
  }, [pendingBanners]);

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
    if (!addMenuOpen) return;
    const handler = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    if (!gmMovesOverlay.isOpen) {
      setHoveredFeature(null);
      setHoveredDefaultMove(null);
      setHoveredCompactTooltip(null);
    }
  }, [gmMovesOverlay.isOpen]);

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

  // Deep-link: open modal when URL has /gm-table/:collection/:id (e.g. refresh, back/forward, shared link)
  const { modalCollection, modalItemId } = route || {};
  useEffect(() => {
    if (!modalCollection || !modalItemId) return;
    // Don't overwrite if user already opened via handleEditClick (choice or form)
    if (editState?.collection === modalCollection && editState?.baseElement?.id === modalItemId) return;
    const elType = COLLECTION_TO_ELEMENT_TYPE[modalCollection];
    if (!elType) return;
    const instances = activeElements.filter(e => e.elementType === elType && e.id === modalItemId);
    const baseElement = instances[0];
    if (!baseElement) {
      navigate(gmUid ? `/gm-table/${gmUid}` : '/gm-table', { replace: true });
      return;
    }
    const canEditOriginal = isOwnItem(baseElement);
    const mode = canEditOriginal ? 'original' : 'copy';
    const item = canEditOriginal
      ? (data[modalCollection]?.find(i => i.id === baseElement.id) || getItemData(baseElement))
      : getItemData(baseElement);
    setEditState({ step: 'form', item, collection: modalCollection, mode, instances, baseElement });
  }, [modalCollection, modalItemId, activeElements, data, editState?.collection, editState?.baseElement?.id, navigate]);

  // Close modal when URL no longer has item (e.g. user pressed back).
  useEffect(() => {
    if (!modalCollection && !modalItemId && editState) {
      setEditState(null);
    }
  }, [modalCollection, modalItemId, editState]);

  const closeEditModal = () => {
    setEditState(null);
    navigate(gmUid ? `/gm-table/${gmUid}` : '/gm-table', { replace: true });
  };

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
    navigate(gmUid ? `/gm-table/${gmUid}/${collection}/${baseElement.id}` : `/gm-table/${collection}/${baseElement.id}`);
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
      await saveItem(collection, itemWithId);
      // Characters are resolved at render-time from the library, so no manual
      // activeElements update is needed — saveItem already updated data.characters.
      if (collection !== 'characters') {
        updateActiveElementsBaseData(el => el.id === itemWithId.id, itemWithId);
      }
    }
  };

  const dismissAllHoverCards = () => {
    trackerOverlay.close();
    characterOverlay.close();
    potAdvOverlay.close();
    gmMovesOverlay.close();
    if (gmHoverHideTimer.current) { clearTimeout(gmHoverHideTimer.current); gmHoverHideTimer.current = null; }
    setHoveredDefaultMove(null);
    setHoveredCompactTooltip(null);
    setHoveredFeature(null);
    setGmHoverOverlayActive(false);
  };

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
    postRoll(rollText, displayName).then(() => {
      setRolledKey(key);
      setTimeout(() => setRolledKey(prev => prev === key ? null : prev), 1500);
    }).catch(err => console.error('Roll failed:', err));
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
    postRoll(rollText, displayName, null, Object.keys(rollMeta).length ? rollMeta : undefined).catch(err => console.error('Roll failed:', err));
  };

  const handleTraitRoll = (rollText, displayName, rollMeta = {}) => {
    dismissAllHoverCards();
    postRoll(rollText, displayName || rollText, null, rollMeta)
      .catch(err => console.error('Trait roll failed:', err));
  };

  // Roll handler for a player acting on their own character.
  // Routes through POST /api/room/:gmUid/roll (validated server-side, real dice).
  // When context.characterEl is provided, runs ancestry onAct hooks; if any chips are added,
  // shows a player-only pre-roll banner instead of posting immediately.
  const handlePlayerOwnRoll = (rollText, displayName, rollMeta = {}, context = null) => {
    dismissAllHoverCards();
    const targetGmUid = (isPlayer && !previewAsPlayerEmail) ? gmUid : null;
    const meta = { ...rollMeta, _playerInitiated: true };

    // Resolve character from activeElements so we have latest runtime (e.g. disadvantageSources from Galapa Retract).
    const contextChar = context?.characterEl;
    const characterEl = contextChar && contextChar.instanceId
      ? (activeElements.find(e => e.instanceId === contextChar.instanceId) || contextChar)
      : (rollMeta._attackerInstanceId
          ? activeElements.find(e => e.instanceId === rollMeta._attackerInstanceId && e.elementType === 'character')
          : null) || contextChar;

    if (!characterEl) {
      postRoll(rollText, displayName || rollText, targetGmUid, meta)
        .catch(err => console.error('Player roll failed:', err));
      return;
    }

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
      const featureName = canvas._currentFeatureName;
      const merged = { ...descriptor, _featureName: featureName };
      // #region agent log
      fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _debugUrl: 'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a', _debugSessionId: '443610', sessionId: '443610', location: 'GMTableView.jsx:addChip', message: 'canvas.addChip', data: { _featureName: featureName, label: descriptor?.label?.slice(0, 40) }, timestamp: Date.now(), hypothesisId: 'A' }) }).catch(() => {});
      // #endregion
      const hadCustomIsVisible = typeof descriptor.isVisible === 'function';
      if (merged.resetsOn) {
        const originFeatures = [...(characterEl.ancestryFeatures || []), ...(characterEl.communityFeatures || [])];
        merged._featureKey = `${featureName}-${Math.max(0, originFeatures.findIndex(f => f.name === featureName))}`;
        if (!hadCustomIsVisible) {
          merged.isVisible = (r) => r.isMine && merged._featureKey != null && !canvas.isUsed(merged._featureKey);
        }
        merged._used = !!(merged._featureKey && canvas.isUsed(merged._featureKey));
      }
      const featureReader = { get(key, d) { const bag = characterEl._originFeatureState?.[featureName]; return bag != null && key in bag ? bag[key] : d; } };
      const isVisibleResult = typeof merged.isVisible === 'function' ? merged.isVisible(rollWrapper, featureReader) : true;
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

    const featureNames = [
      ...(characterEl.ancestryFeatures || []).map(f => f.name),
      ...(characterEl.communityFeatures || []).map(f => f.name),
    ];
    const wrappedChar = wrapEntity(characterEl, updateActiveElement);
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
    runHook(ancestryFeatures, featureNames, 'onAct', {
      canvas,
      roll: rollWrapper,
      char: wrappedChar,
      options: { isReaction: !!rollMeta._isReaction },
      getFeatureStateFor: (name) => getFeatureStateFor(characterEl, name),
    });

    // #region agent log
    fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _debugUrl: 'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a', _debugSessionId: '443610', sessionId: '443610', location: 'GMTableView.jsx:afterOnAct', message: 'after onAct', data: { chipsLength: canvas.chips.length, isPlayer: !!isPlayer, hasKnowTheTide: canvas.chips.some(c => (c._featureName || c.label || '').includes('Know the Tide')) }, timestamp: Date.now(), hypothesisId: 'B' }) }).catch(() => {});
    // #endregion
    if (canvas.chips.length === 0) {
      runHook(ancestryFeatures, featureNames, 'onRoll', { roll: rollWrapper });
      const metaWithLabel = { ...pending.meta, ...(pending.rollBonusLabel ? { _staticModifierLabel: pending.rollBonusLabel } : {}) };
      postRoll(rollWrapper.getFinalRollText(), pending.displayName || rollText, targetGmUid, metaWithLabel)
        .catch(err => console.error('Player roll failed:', err));
      return;
    }

    const onProceed = () => {
      const finalText = rollWrapper.getFinalRollText();
      const metaWithLabel = { ...pending.meta, ...(pending.rollBonusLabel ? { _staticModifierLabel: pending.rollBonusLabel } : {}) };
      postRoll(finalText, pending.displayName || pending.rollText, targetGmUid, metaWithLabel)
        .catch(err => console.error('Player roll failed:', err));
      setPreRollBanner(null);
      setSelectedPreRollChips([]);
    };
    setPreRollBanner({ rollWrapper, chips: canvas.chips, characterEl, onProceed, getFeatureStateFor, pending });
    setSelectedPreRollChips(canvas.chips.map(() => false));
  };

  const clearPreRollBanner = () => {
    setPreRollBanner(null);
    setSelectedPreRollChips([]);
    setPreRollAdvantages([]);
    setPreRollDisadvantages([]);
  };

  const handlePreRollProceed = () => {
    if (!preRollBanner) return;
    const { rollWrapper, chips, characterEl, onProceed, getFeatureStateFor, pending } = preRollBanner;
    const charEl = activeElements.find(e => e.instanceId === characterEl.instanceId) || characterEl;
    const hasDifficultyChip = chips.some(c => c._difficultyChip);
    if (hasDifficultyChip) {
      rollWrapper.meta._difficulty = preRollDifficulty;
      for (const name of preRollAdvantages) rollWrapper.addAdvantageDie((name && name.trim()) || 'Advantage');
      for (const name of preRollDisadvantages) rollWrapper.addDisadvantage((name && name.trim()) || 'Disadvantage');
    }
                    const proceedFeatureNames = [...(charEl.ancestryFeatures || []).map(f => f.name), ...(charEl.communityFeatures || []).map(f => f.name)];
                    runHook(ancestryFeatures, proceedFeatureNames, 'onRoll', { roll: rollWrapper });
    // #region agent log
    fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _debugUrl: 'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a', _debugSessionId: '443610', sessionId: '443610', location: 'GMTableView.jsx:ProceedBefore', message: 'Proceed before loop', data: { selectedCount: selectedPreRollChips.filter(Boolean).length, chipLabels: chips.map(c => c._featureName || c.label?.slice(0, 30)) }, timestamp: Date.now(), hypothesisId: 'C' }) }).catch(() => {});
    // #endregion
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      if (chip._difficultyChip) continue;
      if (chip._used) continue;
      if (!selectedPreRollChips[i]) continue;
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
      const feature = getFeatureStateFor && chip._featureName ? getFeatureStateFor(charEl, chip._featureName) : null;
      if (pending && chip._featureName && !pending.rollBonusLabel) pending.rollBonusLabel = chip._featureName;
      // #region agent log
      if (typeof chip.onUse === 'function') fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _debugUrl: 'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a', _debugSessionId: '443610', sessionId: '443610', location: 'GMTableView.jsx:chipOnUse', message: 'calling onUse', data: { _featureName: chip._featureName, hasFeature: !!feature }, timestamp: Date.now(), hypothesisId: 'A' }) }).catch(() => {});
      // #endregion
      if (typeof chip.onUse === 'function') chip.onUse(rollWrapper, feature);
    }
    // #region agent log
    const finalText = rollWrapper.getFinalRollText();
    fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _debugUrl: 'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a', _debugSessionId: '443610', sessionId: '443610', location: 'GMTableView.jsx:ProceedAfter', message: 'Proceed after loop', data: { finalText: finalText.slice(-50), hasPlus: finalText.includes(' + ') }, timestamp: Date.now(), hypothesisId: 'C' }) }).catch(() => {});
    // #endregion
    setPreRollAdvantages([]);
    setPreRollDisadvantages([]);
    onProceed();
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
  }, [preRollBanner]);

  // Group adversaries of the same type (same id) into consolidated entries.
  // Environments remain as individual entries.
  const consolidatedElements = useMemo(() => {
    const result = [];
    const seenAdvKeys = {}; // key -> index in result

    activeElements.forEach(el => {
      if (el.elementType === 'character') {
        result.push({ kind: 'character', element: el });
      } else if (el.elementType !== 'adversary') {
        result.push({ kind: 'environment', element: el });
      } else {
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
    if (!hoveredFeature || !overlayScrollRef.current) return;
    const el = overlayScrollRef.current.querySelector(`[data-feature-key="${hoveredFeature.featureKey}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [hoveredFeature]);

  // Minimal adversary list for Make a Scene banner picker — safe for both GM and player views.
  const makeASceneAdversaries = useMemo(() =>
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
          activeChanneledElement: el.activeChanneledElement ?? null,
          thresholds: effectiveThresholds(el),
          maxHp: el.maxHp ?? 0,
          currentHp: el.currentHp ?? el.maxHp ?? 0,
          currentStress: el.currentStress ?? 0,
          maxStress: el.maxStress ?? 6,
          currentArmor: el.currentArmor ?? 0,
          maxArmor: el.maxArmor ?? 0,
          armorFeatureName: el.armorMods?.feature?.name ?? null,
          armorScore: el.armorScore ?? 0,
          evasion: el.evasion ?? null,
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
  }, [consolidatedElements]);

  // Returns names of adversaries within Very Close of the Water Druid attacker that will mark Stress.
  const getWaterRetaliationNames = useCallback((attackerInstanceId, targetInstanceId) => {
    const attacker = activeElements.find(e => e.instanceId === attackerInstanceId && e.activeChanneledElement === 'water');
    if (!attacker) return [];
    const advTarget = activeElements.find(e => e.instanceId === targetInstanceId);
    if (attacker.tokenX != null && advTarget?.tokenX != null) {
      if (tokenDistanceFt(attacker.tokenX, attacker.tokenY, advTarget.tokenX, advTarget.tokenY) > RANGE_BANDS_FT.MELEE) return [];
    }
    return getAdversariesWithinRangeFt(activeElements, attacker.instanceId, RANGE_BANDS_FT.VERY_CLOSE)
      .filter(a => a.instanceId !== targetInstanceId)
      .map(a => activeElements.find(e => e.instanceId === a.instanceId)?.name || 'Unknown');
  }, [activeElements]);

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

  // For adversary-attack banners: which character targets add disadvantage (e.g. Orc Sturdy at 1 HP). Call onTargeted early and discard; return { [instanceId]: ['Sturdy', ...] }.
  const getTargetDisadvantageLabels = useCallback((roll) => {
    if (!roll?.rollText || roll._attackerType !== 'adversary') return {};
    const characterTargets = getTargetsForRoll(roll).filter(t => t.type === 'character');
    const out = {};
    for (const t of characterTargets) {
      const el = activeElements.find(e => e.instanceId === t.instanceId);
      if (!el?.ancestryFeatures?.length) continue;
      const disadvantageFeatures = [];
      const pendingRoll = {
        get rollText() { return roll.rollText; },
        set rollText(_v) {},
        addDisadvantage(featureName) { disadvantageFeatures.push(featureName ?? pendingRoll._currentFeatureName); },
      };
      const wrappedChar = wrapEntity(el, updateActiveElement);
      for (const af of el.ancestryFeatures) {
        const descriptor = ancestryFeatures[af?.name];
        if (descriptor?.onTargeted) {
          pendingRoll._currentFeatureName = af?.name;
          descriptor.onTargeted(pendingRoll, wrappedChar);
        }
      }
      if (disadvantageFeatures.length) out[t.instanceId] = disadvantageFeatures;
    }
    return out;
  }, [activeElements, getTargetsForRoll, updateActiveElement]);

  // For adversary target menu (pre-roll): get disadvantage feature names for one character target. Call onTargeted and discard; return ['Sturdy', ...].
  const getDisadvantageForTarget = useCallback((rollText, targetInstanceId) => {
    const el = activeElements.find(e => e.instanceId === targetInstanceId);
    if (!el?.ancestryFeatures?.length) return [];
    const disadvantageFeatures = [];
    const pendingRoll = {
      get rollText() { return rollText; },
      set rollText(_v) {},
      addDisadvantage(featureName) { disadvantageFeatures.push(featureName ?? pendingRoll._currentFeatureName); },
    };
    const wrappedChar = wrapEntity(el, updateActiveElement);
    for (const af of el.ancestryFeatures) {
      const descriptor = ancestryFeatures[af?.name];
      if (descriptor?.onTargeted) {
        pendingRoll._currentFeatureName = af?.name;
        descriptor.onTargeted(pendingRoll, wrappedChar);
      }
    }
    return disadvantageFeatures;
  }, [activeElements, updateActiveElement]);

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
  const tableDiff = tableBP - adjustedBudget;
  const tableDiffColor = tableDiff > 0 ? 'text-red-400' : tableDiff < 0 ? 'text-emerald-400' : 'text-slate-400';
  const activeAutoMods = Object.values(tableAutoMods).filter(m => m.active);
  const tableCharacters = activeElements.filter(e => e.elementType === 'character');
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
      map.set(el.instanceId, recomputeCharacter(el, srdData));
    }
    return map;
  }, [srdData, tableCharacters]);

  // Origin (ancestry + community) banner reactions: collect all characters with origin features
  // that define onBanner or bannerAction, pre-filtered by player mode.
  const ancestryBannerReactions = useMemo(() => {
    const enrichRollWithAttackRange = (roll, elements) => {
      if (!roll._attackerInstanceId || !roll._selectedTargetInstanceId) return;
      const attacker = elements?.find(e => e.instanceId === roll._attackerInstanceId);
      const target = elements?.find(e => e.instanceId === roll._selectedTargetInstanceId);
      if (attacker?.tokenX == null || attacker?.tokenY == null) return;
      if (target?.tokenX == null || target?.tokenY == null) return;
      const dist = tokenDistanceFt(attacker.tokenX, attacker.tokenY, target.tokenX, target.tokenY);
      roll.attackRange = distanceFtToRangeBandName(dist);
    };
    const enrichRollWithIsSuccess = (roll, elements) => {
      if (!roll._selectedTargetInstanceId) return;
      const target = elements?.find(e => e.instanceId === roll._selectedTargetInstanceId);
      if (!target) return;
      const isAdversary = target.elementType === 'adversary' || target.type === 'adversary';
      const defense = isAdversary ? target.difficulty : target.evasion;
      if (defense == null) return;
      let effectiveTotal = roll.total ?? 0;
      if (roll.dominant != null) {
        effectiveTotal += (roll._prayerAddRollDie?.value ?? 0) + (roll._heartOfAPoetD4Result ?? 0);
      }
      roll.isSuccess = effectiveTotal >= defense;
    };

    const reactions = [];
    for (const char of tableCharacters) {
      if (isPlayer && char.assignedPlayerEmail !== playerEmail) continue;
      const entity = wrapEntity(char, updateActiveElement);
      const getIsMyRoll = (roll) => roll._attackerInstanceId != null
        ? roll._attackerInstanceId === char.instanceId
        : !!(roll.rollUser && char.name && (roll.rollUser.toLowerCase() === char.name.toLowerCase() || roll.rollUser.toLowerCase().startsWith(char.name.toLowerCase())));
      const originFeaturesList = [...(char.ancestryFeatures || []), ...(char.communityFeatures || [])];
      for (let idx = 0; idx < originFeaturesList.length; idx++) {
        const af = originFeaturesList[idx];
        const feature = ancestryFeatures[af.name];
        if (!feature) continue;
        const chips = [];
        if (feature.onBanner) {
          const banner = { chips, addChip(descriptor) { this.chips.push(descriptor); } };
          feature.onBanner(banner);
        } else if (feature.bannerAction) {
          chips.push(feature.bannerAction);
        }
        const sourceName = feature.source ?? feature.ancestry ?? 'Unknown';
        chips.forEach((chip, chipIndex) => {
          // Only toggleable (stateKey) when the chip has Ack/Reject — otherwise it's display-only or activate-only.
          const hasChipAckReject = chip?.onChipAck != null || chip?.onChipReject != null;
          const stateKey = hasChipAckReject
            ? (chip.toggleKey ?? (chip.label != null ? `_toggle.${sourceName}.${feature.name}${chips.length > 1 ? `.${chipIndex}` : ''}` : null))
            : null;
          const button = chip.label != null
            ? { label: chip.label, toggleKey: chip.toggleKey }
            : null;
          const hopeCost = chip.hopeCost ?? 0;
          const stressCost = chip.stressCost ?? 0;
          const featureKeyForResetsOn = chip.resetsOn ? `${feature.name}-${idx}` : null;
          reactions.push({
            featureName: feature.name,
            feature,
            character: char,
            chip,
            stateKey,
            _featureKey: featureKeyForResetsOn,
            getDisabledState: (roll) => {
              enrichRollWithAttackRange(roll, activeElements);
              enrichRollWithIsSuccess(roll, activeElements);
              const wr = wrapRoll(roll, undefined, char.instanceId);
              wr.isMine = getIsMyRoll(roll);
              const name = entity.name ?? 'Character';
              const costMsg = hopeCost > 0 && entity.hope < hopeCost
                ? `${name} needs ${hopeCost} Hope`
                : stressCost > 0 && !entity.hasStress(stressCost)
                  ? `${name} needs ${stressCost} empty Stress boxes`
                  : '';
              const featureStateReader = { get(key, defaultVal) { const bag = char._originFeatureState?.[feature.name]; return bag != null && key in bag ? bag[key] : defaultVal; } };
              const customMsg = chip.getDisabledMessage ? chip.getDisabledMessage(wr, entity, featureStateReader) : '';
              const customLabel = customMsg ? (typeof customMsg === 'string' ? customMsg : String(customMsg)) : '';
              const usedByResetsOn = featureKeyForResetsOn && char.featureUsage?.[featureKeyForResetsOn]?.used && char.featureUsage?.[featureKeyForResetsOn]?.cycle === chip.resetsOn;
              const resetsOnMsg = usedByResetsOn ? (chip.resetsOn === 'rest' ? 'Already used this rest' : chip.resetsOn === 'session' ? 'Already used this session' : chip.resetsOn === 'longRest' ? 'Already used this long rest' : 'Already used') : '';
              const disabled = !!costMsg || !!customLabel || !!usedByResetsOn;
              const message = [costMsg, customLabel, resetsOnMsg].filter(Boolean).join('\n');
              return { disabled, message };
            },
            button,
            derivedIds: stateKey
              ? new Set(activeElements.filter(el => el[stateKey]).map(el => el[stateKey]))
              : (chip.derivedState ? chip.derivedState(activeElements) : null),
            matchesRoll: (roll) => {
              if (roll._suppressAncestryFeature === feature.name) return false; // only suppress the chip that triggered add-damage
              // So enrichers and wrapRoll see the selected target when it was synced via banner-targets (array).
              const effectiveTargetId = roll._selectedTargetInstanceId ?? (Array.isArray(roll._selectedTargetInstanceIds) && roll._selectedTargetInstanceIds[0]);
              if (effectiveTargetId && !roll._selectedTargetInstanceId) roll._selectedTargetInstanceId = effectiveTargetId;
              enrichRollWithDamage(roll, activeElements);
              enrichRollWithAttackRange(roll, activeElements);
              enrichRollWithIsSuccess(roll, activeElements);
              const hasDamage = (roll.subItems || []).some(s => /damage/i.test(s.pre || ''));
              // Enrich target.rangeFromMe for chips that use it (e.g. Goblin Danger Sense)
              if (effectiveTargetId && hasDamage) {
                const targetEl = activeElements.find(e => e.instanceId === effectiveTargetId);
                if (targetEl?.tokenX != null && targetEl?.tokenY != null && char.tokenX != null && char.tokenY != null) {
                  roll._targetRangeFromMe = tokenDistanceFt(char.tokenX, char.tokenY, targetEl.tokenX, targetEl.tokenY);
                }
              }
              const wr = wrapRoll(roll, undefined, char.instanceId);
              wr.isMine = getIsMyRoll(roll);
              const visible = chip.isVisible ? chip.isVisible(wr, entity) : wr.isMine;
              // #region agent log
              if (feature.name === 'Danger Sense') {
                fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_debugUrl:'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a',_debugSessionId:'e86e0f',sessionId:'e86e0f',location:'GMTableView.jsx:matchesRoll',message:'Danger Sense matchesRoll',data:{selectedTargetId:roll._selectedTargetInstanceId,hasDamage,charInstanceId:char.instanceId,targetIsMe:wr.target?.isMe,rangeFromMe:wr.target?.rangeFromMe,visible},timestamp:Date.now()})}).catch(()=>{});
              }
              // #endregion
              return visible;
            },
            isActive: stateKey
              ? (roll) => char[stateKey] === roll._rollDbId
              : (roll) => {
                const wr = wrapRoll(roll, undefined, char.instanceId);
                wr.isMine = getIsMyRoll(roll);
                return chip.isActive?.(wr, entity) ?? false;
              },
            isRequested: false,
          });
        });
      }
    }
    return reactions;
  }, [tableCharacters, activeElements, isPlayer, playerEmail]);

  // Sync DiceRoller with the authoritative pendingBanners subscription snapshot (must run after ancestryBannerReactions is defined).
  useEffect(() => {
    if (!pendingBanners) return;
    const isFirst = isFirstBannersSnapshotRef.current;
    isFirstBannersSnapshotRef.current = false;

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
        if (banner._action && banner._featureName === 'Make a Scene' && banner._selectedTargetInstanceId && dbId != null) {
          setMakeASceneSelections(prev => prev[dbId] ? prev : { ...prev, [dbId]: banner._selectedTargetInstanceId });
        }
        const augmentedBanner = {
          ...banner,
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
        if (banner._action && banner._featureName === 'Make a Scene' && banner._selectedTargetInstanceId != null) {
          setMakeASceneSelections(prev => ({ ...prev, [dbId]: banner._selectedTargetInstanceId }));
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
      if (banner._action && banner._featureName === 'Make a Scene' && banner._selectedTargetInstanceId && dbId != null) {
        setMakeASceneSelections(prev => prev[dbId] ? prev : { ...prev, [dbId]: banner._selectedTargetInstanceId });
      }
      diceRollerRef.current?.addRoll({
        ...banner,
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
    diceRollerRef.current?.setBannerReactionsFallback?.(ancestryBannerReactions);
  }, [pendingBanners, ancestryBannerReactions]);

  // Display overrides for banners: run chip.render for each pending roll and matching reaction.
  const displayOverridesByRollId = useMemo(() => {
    const store = {};
    if (!pendingBanners?.length) return store;
    for (const roll of pendingBanners) {
      for (const r of ancestryBannerReactions) {
        if (!r.matchesRoll(roll)) continue;
        const wrappedRoll = wrapRoll(roll, store, r.character.instanceId);
        const chip = r.chip;
        const render = chip?.render;
        const renderWhenOff = chip?.renderWhenOff;
        if (!render && !renderWhenOff) continue;
        const stateKey = r.stateKey;
        const isToggledOn = !!(stateKey && roll._rollDbId != null && r.character[stateKey] === roll._rollDbId);
        const wrappedChar = wrapEntity(r.character, updateActiveElement);
        if (isToggledOn && render) render.call(chip, wrappedRoll, wrappedChar);
        else if (!isToggledOn && renderWhenOff) renderWhenOff.call(chip, wrappedRoll, wrappedChar);
      }
      // If onChipAck called setWithHope() for this roll, override display to hope color.
      if (roll._rollDbId != null && chipHopeConvertedIds.has(roll._rollDbId)) {
        store[roll._rollDbId] = { ...(store[roll._rollDbId] || {}), dominantForDisplay: 'hope' };
      }
    }
    return store;
  }, [pendingBanners, ancestryBannerReactions, activeElements, updateActiveElement, chipHopeConvertedIds]);

  // Per-character rest move lists (ancestry onRest hooks, e.g. Clank Efficient).
  const restMovesPerCharacter = useMemo(() => {
    const restBanner = pendingBanners?.find(b => b._rest);
    if (!restBanner) return {};
    const duration = restBanner._restDuration || 'short';
    const chars = activeElements.filter(e => e.elementType === 'character');
    const out = {};
    for (const c of chars) {
      out[c.instanceId] = getRestMovesForCharacter(c, duration);
    }
    return out;
  }, [pendingBanners, activeElements]);

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

  // Wings of Light (Winged Sentinel): characters currently flying — show "Spend Hope for d8" on their attack banners.
  const wingsOfLightFlyingInstanceIds = useMemo(() => {
    const set = new Set();
    for (const c of tableCharacters) {
      if (!c.wingsOfLightFlying) continue;
      const hasWings = (c.subclass === 'Winged Sentinel') ||
        (c.subclassFeatures || []).some(f => f.name === 'Wings of Light');
      if (hasWings && (!isPlayer || c.assignedPlayerEmail === playerEmail)) set.add(c.instanceId);
    }
    return set;
  }, [tableCharacters, isPlayer, playerEmail]);

  // Prayer dice available for banner use (add-to-roll, reduce-damage).
  // Passed to both GM and player DiceRoller so prayer die options are visible to all.
  const prayerDiceChars = useMemo(() => (
    tableCharacters
      .flatMap(c => (c.activeModifiers || [])
        .filter(m => m.name === 'Prayer Die')
        .map(m => ({ ...m, ownerInstanceId: c.instanceId, ownerName: c.name }))
      )
  ), [tableCharacters]);

  // Rally Die: characters that currently have a Rally Die modifier — shown as banner toggles.
  const rallyDieInstanceIds = useMemo(() => {
    const set = new Set();
    for (const c of tableCharacters) {
      if ((c.activeModifiers || []).some(m => m.name === 'Rally Die')) set.add(c.instanceId);
    }
    return set;
  }, [tableCharacters]);

  // Heart of a Poet (Wordsmith subclass): characters eligible for "+1 Hope → d4 on non-attack action rolls".
  // In player mode: only the player's own assigned character(s).
  const heartOfAPoetChars = useMemo(() => (
    tableCharacters
      .filter(c =>
        (c.subclass || '').toLowerCase() === 'wordsmith' &&
        (c.subclassFeatures || []).some(f => f.name === 'Heart of a Poet') &&
        (!isPlayer || c.assignedPlayerEmail === playerEmail)
      )
      .map(c => ({ instanceId: c.instanceId, name: c.name, hope: c.hope ?? (c.maxHope ?? 6) }))
  ), [tableCharacters, isPlayer, playerEmail]);

  const difficultyValue = effectiveMods.lessDifficult ? 'lessDifficult' : effectiveMods.slightlyMoreDangerous ? 'slightlyMoreDangerous' : effectiveMods.moreDangerous ? 'moreDangerous' : '';
  const damageBoostValue = effectiveMods.damageBoostPlusOne ? 'plusOne' : effectiveMods.damageBoostD4 ? 'd4' : effectiveMods.damageBoostStatic ? 'static' : '';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Preview-as-player banner */}
      {previewAsPlayerEmail && (() => {
        const p = connectedPlayers.find(c => c.email === previewAsPlayerEmail);
        const name = p?.name || previewAsPlayerEmail;
        return (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-900/80 border-b border-amber-700 text-amber-200 text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="shrink-0" />
              <span>Previewing as <strong>{name}</strong></span>
            </div>
            <button
              onClick={onExitPreview}
              className="flex items-center gap-1 hover:text-white transition-colors"
              title="Exit preview"
            >
              <EyeOff size={12} />
              Exit preview
            </button>
          </div>
        );
      })()}
      <div className="flex-1 flex overflow-hidden">
      {/* Characters Panel */}
      <div className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col overflow-y-auto shrink-0">
        <div className="p-3 bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-sm">
              <Users size={15} className="text-sky-400" /> Characters
            </h2>
            {!isPlayer && (
              <button
                onClick={() => setShowPlayerEmailPanel(p => !p)}
                className="text-slate-500 hover:text-sky-400 transition-colors"
                title="Manage invited players"
              ><Users size={13} /></button>
            )}
          </div>
          {/* Player email management (GM only) */}
          {!isPlayer && showPlayerEmailPanel && (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Invited Players</p>
              {playerEmails.map(email => {
                const connected = connectedPlayers.find(p => p.email === email);
                const isPreviewing = previewAsPlayerEmail === email;
                return (
                  <div key={email} className="flex items-center gap-1.5">
                    {connected && (
                      <Circle size={6} className="text-green-400 fill-green-400 shrink-0" />
                    )}
                    <span className="flex-1 text-xs text-slate-300 truncate">{email}</span>
                    <button
                      onClick={() => onPreviewAsPlayer?.(isPreviewing ? null : email)}
                      title={isPreviewing ? 'Exit preview' : `Preview as ${connected?.name || email}`}
                      className={`shrink-0 transition-colors ${isPreviewing ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-sky-400'}`}
                    >
                      {isPreviewing ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    <button
                      onClick={() => setPlayerEmails?.(prev => prev.filter(e => e !== email))}
                      className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
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
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500 min-w-0"
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
                  <div className="absolute left-0 right-0 top-full mt-0.5 bg-slate-800 border border-slate-700 rounded shadow-lg z-30 overflow-hidden">
                    {contactSuggestions.map(({ name, email }) => (
                      <button
                        key={email}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setPlayerEmails?.(prev => prev.includes(email) ? prev : [...prev, email]);
                          setPlayerEmailInput('');
                          setContactSuggestions([]);
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-700 cursor-pointer"
                      >
                        {name && <span className="block text-xs text-white truncate">{name}</span>}
                        <span className="block text-[10px] text-slate-400 truncate">{email}</span>
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
                <div className="pt-1 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 mb-1">Online ({connectedPlayers.length})</p>
                  {connectedPlayers.map(p => (
                    <div key={p.uid} className="flex items-center gap-1.5 text-[10px] text-slate-300">
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
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Online ({connectedPlayers.length})</p>
              {connectedPlayers.map(p => (
                <div key={p.uid} className="flex items-center gap-1.5 text-[10px] text-slate-300">
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
            onClick={() => setModalOpen('characters')}
            className="w-full rounded-lg border border-dashed border-sky-900/50 bg-sky-950/20 hover:border-sky-700/60 hover:bg-sky-950/40 px-2.5 py-1.5 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus size={12} className="text-sky-500" />
            <span className="text-xs font-semibold text-sky-400">Add Character</span>
          </button>

          {consolidatedElements.filter(item => item.kind === 'character').map(({ element: el }) => {
            const isMyCharacter = isPlayer && playerEmail != null && el.assignedPlayerEmail === playerEmail;
            const isAssigned = !isPlayer || isMyCharacter;
            const displayChar = characterDisplayByInstanceId.get(el.instanceId) ?? el;
            return (
            <div
              key={el.instanceId}
              className={`rounded-lg border overflow-hidden group/char transition-colors ${isMyCharacter ? 'bg-green-950/30 border-green-700/50' : 'bg-sky-950/30 border-sky-900/40'}`}
              {...characterOverlay.triggerProps(e => ({ element: el, top: e.currentTarget.getBoundingClientRect().top, bottom: e.currentTarget.getBoundingClientRect().bottom }))}
            >
              <div className="px-2.5 py-1.5 border-b border-sky-900/30 flex items-center gap-1.5">
                <User size={10} className={isMyCharacter ? 'text-green-400 shrink-0' : 'text-sky-400 shrink-0'} />
                <span className="text-xs font-semibold text-sky-200 truncate flex-1">{el.name}</span>
                <span className="text-[10px] font-bold text-sky-400/70 bg-sky-900/50 border border-sky-800/50 rounded px-1 shrink-0 group-hover/char:hidden">T{el.tier ?? 1}</span>
                {el.playerName && (
                  <span className="text-[10px] text-sky-300/60 truncate max-w-[5rem] group-hover/char:hidden">{el.playerName}</span>
                )}
                {/* GM: edit/remove */}
                {!isPlayer && (
                  <div className="hidden group-hover/char:flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        if (el.id) {
                          // Characters are stored by reference — always edit the library original
                          // directly (no "edit copy" option) so changes propagate to the table.
                          const libraryItem = data.characters?.find(i => i.id === el.id) || el;
                          navigate(gmUid ? `/gm-table/${gmUid}/characters/${el.id}` : `/gm-table/characters/${el.id}`);
                          setEditState({ step: 'form', item: libraryItem, collection: 'characters', mode: 'original', instances: [el], baseElement: el });
                        } else {
                          navigate(gmUid ? `/gm-table/${gmUid}/characters/${el.instanceId}` : `/gm-table/characters/${el.instanceId}`);
                          setEditState({ step: 'form', item: el, collection: 'characters', mode: 'copy', instances: [el], baseElement: el });
                        }
                      }}
                      className="text-slate-500 hover:text-sky-400 transition-colors"
                      title="Edit character"
                    ><Pencil size={11} /></button>
                    <button
                      onClick={() => { if (window.confirm(`Remove ${el.name} from the table?`)) removeActiveElement(el.instanceId); }}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove from table"
                    ><X size={11} /></button>
                  </div>
                )}
              </div>
              {/* GM: player assignment dropdown */}
              {!isPlayer && playerEmails.length > 0 && (
                <div className="px-2 pt-1 pb-0.5 border-b border-sky-900/20">
                  <select
                    value={el.assignedPlayerEmail || ''}
                    onChange={e => updateActiveElement(el.instanceId, { assignedPlayerEmail: e.target.value || undefined })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300 outline-none focus:border-sky-500"
                  >
                    <option value="">Unassigned</option>
                    {playerEmails.map(email => {
                      const connected = connectedPlayers.find(p => p.email === email);
                      return <option key={email} value={email}>{connected?.name || email}</option>;
                    })}
                  </select>
                </div>
              )}

              {/* Stat block */}
              <div className="p-2 space-y-1.5 rounded-b-lg">
                {/* Hope track */}
                {(() => {
                  const maxHope = el.maxHope ?? 6;
                  const hopePending = pendingResourceCosts[el.instanceId]?.hope ?? 0;
                  const currentHope = el.hope ?? maxHope;
                  return maxHope > 0 && (
                    <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Hope', top: r.top, bottom: r.bottom, side: 'left' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                      <Sparkles size={10} className="text-amber-400 shrink-0" />
                      <CheckboxTrack
                        total={maxHope}
                        filled={Math.max(0, currentHope - hopePending)}
                        pendingFilled={hopePending}
                        onSetFilled={isAssigned ? (h) => updateActiveElement(el.instanceId, { hope: h }) : undefined}
                        fillColor="bg-amber-400"
                        label="Hope"
                        verbs={['Gain', 'Spend']}
                        pulseOnDecreaseOnly
                      />
                    </div>
                  );
                })()}
                {/* Evasion + Damage Thresholds (displayChar so ancestry mods e.g. Simiah Nimble show correctly) */}
                {(displayChar.evasion != null || displayChar.armorThresholds) && (
                  <div className="flex items-center gap-1.5 flex-wrap ml-[14px]">
                    {displayChar.evasion != null && (
                      <span className="text-[10px] font-bold text-cyan-400/70 bg-cyan-900/50 border border-cyan-800/50 rounded px-1">
                        EVA {displayChar.evasion}
                      </span>
                    )}
                    {(() => {
                      const t = effectiveThresholds(displayChar);
                      if (!t) return null;
                      const eb = el.activeChanneledElement === 'earth' ? (el.proficiency ?? 0) : 0;
                      return (
                        <span className="text-[10px] text-slate-400">
                          Thresholds{' '}
                          {eb > 0 ? <><span className="font-bold text-yellow-300/50">{t.major - eb}</span><span className="text-slate-600"> +{eb} =</span>{' '}</> : null}
                          <span className="font-bold text-yellow-300">{t.major}</span>
                          <span className="text-slate-600"> / </span>
                          {eb > 0 ? <><span className="font-bold text-red-300/50">{t.severe - eb}</span><span className="text-slate-600"> +{eb} =</span>{' '}</> : null}
                          <span className="font-bold text-red-300">{t.severe}</span>
                        </span>
                      );
                    })()}
                  </div>
                )}
                {/* Armor track */}
                {(el.maxArmor || 0) > 0 && (
                  <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Armor', top: r.top, bottom: r.bottom, side: 'left' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                    <Shield size={10} className="text-cyan-500 shrink-0" />
                    <CheckboxTrack
                      total={el.maxArmor || 0}
                      filled={el.currentArmor || 0}
                      pendingFilled={pendingResourceCosts[el.instanceId]?.armorMark ?? 0}
                      onSetFilled={isAssigned ? (v) => {
                        const upd = { currentArmor: v };
                        if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                        updateActiveElement(el.instanceId, upd);
                      } : undefined}
                      fillColor="bg-cyan-500"
                      label="Armor"
                      verbs={['Mark', 'Clear']}
                    />
                  </div>
                )}
                {/* HP track */}
                {(el.maxHp || 0) > 0 && (
                  <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'HP', top: r.top, bottom: r.bottom, side: 'left' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                    <Heart size={10} className="text-red-500 shrink-0" />
                    <CheckboxTrack
                      total={el.maxHp || 0}
                      filled={(el.maxHp || 0) - (el.currentHp ?? el.maxHp ?? 0)}
                      onSetFilled={isAssigned ? (dmg) => updateActiveElement(el.instanceId, { currentHp: (el.maxHp || 0) - dmg }) : undefined}
                      fillColor="bg-red-500"
                      label="HP"
                      verbs={['Mark', 'Clear']}
                    />
                  </div>
                )}
                {/* Stress track */}
                {(el.maxStress || 0) > 0 && (
                  <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Stress', top: r.top, bottom: r.bottom, side: 'left' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                    <AlertCircle size={10} className="text-orange-500 shrink-0" />
                    <CheckboxTrack
                      total={el.maxStress || 0}
                      filled={el.currentStress || 0}
                      pendingFilled={pendingResourceCosts[el.instanceId]?.stress ?? 0}
                      onSetFilled={isAssigned ? async (s) => {
                        // #region agent log
                        fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_debugUrl:'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a',_debugSessionId:'d37b42',sessionId:'d37b42',location:'GMTableView.jsx:3267',message:'Characters panel Stress onSetFilled',data:{instanceId:el.instanceId,newFilled:s,currentStress:el.currentStress},hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{});
                        // #endregion
                        const current = el.currentStress ?? 0;
                        const amount = s - current;
                        if (amount <= 0) {
                          updateActiveElement(el.instanceId, { currentStress: s });
                          return;
                        }
                        const stressCancel = await runBeforeMarkStress(el, amount, 'stat-block', updateActiveElement, { postRollSilent, gmUid: isPlayer ? gmUid : null, postAction: postActionForStress });
                        if (!stressCancel.cancel) {
                          const effective = amount - (stressCancel.reduceBy ?? 0);
                          if (effective > 0) {
                            const newFilled = (el.currentStress ?? 0) + effective;
                            updateActiveElement(el.instanceId, { currentStress: newFilled });
                          }
                        } else {
                          // #region agent log
                          fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_debugUrl:'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a',_debugSessionId:'d37b42',sessionId:'d37b42',location:'GMTableView.jsx:stressCancel',message:'Stress update skipped (cancel)',data:{instanceId:el.instanceId},hypothesisId:'F',timestamp:Date.now()})}).catch(()=>{});
                          // #endregion
                        }
                      } : undefined}
                      fillColor="bg-orange-500"
                      label="Stress"
                      verbs={['Mark', 'Clear']}
                    />
                    {isAssigned && !el.conditions && !openConditions.has(el.instanceId) && (
                      <button
                        onClick={() => setOpenConditions(prev => new Set([...prev, el.instanceId]))}
                        className="ml-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                        title="Add conditions"
                      ><Tag size={10} /></button>
                    )}
                  </div>
                )}
                {/* Numeric feature state (e.g. Seaborne Know the Tide tokens) — badge aligned with first track box */}
                {getNumericFeatureStateEntries(el).map(({ featureName, key, label, value }) => (
                  <div key={`${featureName}-${key}`} className="ml-[14px]">
                    <span className="text-[10px] font-bold text-sky-300/90 bg-sky-900/50 border border-sky-800/50 rounded px-1.5">
                      {featureName} — {label}: {value}
                    </span>
                  </div>
                ))}
                {/* Conditions */}
                {(el.conditions || openConditions.has(el.instanceId)) && (
                  <input
                    type="text"
                    placeholder="Conditions..."
                    autoFocus={openConditions.has(el.instanceId) && !el.conditions}
                    value={el.conditions || ''}
                    readOnly={!isAssigned}
                    onChange={isAssigned ? e => updateActiveElement(el.instanceId, { conditions: e.target.value }) : undefined}
                    onBlur={() => {
                      if (!el.conditions) {
                        setOpenConditions(prev => { const s = new Set(prev); s.delete(el.instanceId); return s; });
                      }
                    }}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-sky-500 placeholder-slate-600"
                  />
                )}
                {/* Card toggle chips (onCard + onToggle) — e.g. Galapa Retract */}
                {(() => {
                  const allFeatures = [...(el.ancestryFeatures || []), ...(el.communityFeatures || [])];
                  const toggleChips = [];
                  for (const f of allFeatures) {
                    const descriptor = ancestryFeatures[f?.name];
                    if (!descriptor?.cardChips) continue;
                    for (const chip of descriptor.cardChips) {
                      if (typeof chip.onToggle !== 'function') continue;
                      toggleChips.push({ feature: f, chip, descriptor });
                    }
                  }
                  if (toggleChips.length === 0) return null;
                  const postToggle = isAssigned ? (isPlayer ? handlePlayerActionNotification : handleActionNotification) : null;
                  return (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {toggleChips.map(({ feature, chip, descriptor }, idx) => {
                        const derivedToggleKey = `_toggle.${feature.source ?? ''}.${feature.name ?? ''}`;
                        const isGalapaRetract = feature.name === 'Retract' && feature.source === 'Galapa';
                        const active = isGalapaRetract ? (el.retractedActive ?? el[derivedToggleKey]) : !!el[derivedToggleKey];
                        const displayName = feature.name ?? 'Toggle';
                        const tooltipContent = chip.label ?? feature.name ?? '';
                        const nextActive = !active;
                        const payload = () => ({
                          _action: true,
                          rollUser: el.name,
                          actionName: [...[el.name, feature.source, feature.name].filter(Boolean), nextActive ? 'ACTIVATE' : 'DEACTIVATE'].join(' - '),
                          actionText: descriptor.description ?? feature.description ?? '',
                          _featureUse: true,
                          _attackerInstanceId: el.instanceId,
                          _stressCost: chip.stressCost ?? 0,
                          _hopeCost: chip.hopeCost ?? 0,
                          _cardToggle: {
                            instanceId: el.instanceId,
                            derivedToggleKey,
                            nextActive,
                            featureName: feature.name,
                            featureSource: feature.source,
                          },
                          tags: [
                            ...(chip.hopeCost > 0 ? [{ name: 'HopeCost', text: `Spend ${chip.hopeCost} Hope` }] : []),
                            ...(chip.stressCost > 0 ? [{ name: 'StressCost', text: `Mark ${chip.stressCost} Stress` }] : []),
                          ],
                        });
                        return (
                          <Tooltip key={idx} content={tooltipContent} placement="top">
                            <button
                              type="button"
                              onClick={postToggle ? () => postToggle(payload()) : undefined}
                              disabled={!postToggle}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                                active
                                  ? 'border-amber-500 bg-amber-800/60 text-amber-100 hover:bg-amber-700/70'
                                  : 'border-amber-600 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100'
                              } ${!postToggle ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                              aria-pressed={active}
                            >
                              {active ? <CheckSquare size={12} className="shrink-0" /> : <Square size={12} className="shrink-0" />}
                              <span className="truncate max-w-[120px]">{displayName}</span>
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
          })}

          {consolidatedElements.filter(item => item.kind === 'character').length === 0 && (
            <div className="text-center text-slate-600 text-xs py-6">
              No characters yet.
            </div>
          )}
        </div>
      </div>

      {/* GM Moves hover overlay */}
      {gmMovesOverlay.isOpen && (
      <div
        ref={gmMovesOverlay.overlayRef}
        className="fixed z-[55]"
        style={{ right: 'calc(14rem)', paddingRight: '8px', top: 90, width: 'calc(20rem + 8px)', maxHeight: 'calc(100dvh - 98px)' }}
        {...gmMovesOverlay.overlayHandlers}
      >
      <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100dvh - 98px)' }}>
        <div className="p-3 bg-slate-950 border-b border-slate-700 sticky top-0 z-10 rounded-t-xl shrink-0">
          <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-sm">
            <Zap size={16} className="text-yellow-500" /> GM Moves
          </h2>
        </div>

        <div className="p-3 space-y-5 overflow-y-auto flex-1 min-h-0">
          {Object.entries(consolidatedMenu).map(([category, features]) => {
            if (features.length === 0) return null;
            const catCollapsed = collapsedSections.has(category);
            return (
              <div key={category}>
                <button
                  onClick={() => toggleSection(category)}
                  className="w-full flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1 hover:text-slate-200 transition-colors"
                >
                  {catCollapsed
                    ? <ChevronRight size={12} className="shrink-0" />
                    : <ChevronDown size={12} className="shrink-0" />
                  }
                  <span className="flex-1 text-left">{category}</span>
                  <span className="text-[10px] font-normal text-slate-600 normal-case tracking-normal">{features.length}</span>
                </button>
                {!catCollapsed && <div className="space-y-1.5">
                  {features.map((feature, idx) => {
                    const allCds = parseAllCountdownValues(feature.description);
                    const cdKey = `${feature.cardKey}|${feature.featureKey}`;
                    const cdVals = allCds.map((cd, cdIdx) =>
                      featureCountdowns[`${cdKey}|${cdIdx}`] ?? cd.value
                    );
                    const canRoll = !!(feature._rollData || feature._diceRoll);
                    const justRolled = rolledKey === cdKey;
                    return (
                      <div
                        key={`${feature.id}-${idx}`}
                        onMouseEnter={(e) => {
                          if (isTouch) return;
                          if (gmHoverHideTimer.current) { clearTimeout(gmHoverHideTimer.current); gmHoverHideTimer.current = null; }
                          setHoveredFeature({ cardKey: feature.cardKey, featureKey: feature.featureKey });
                          if (feature._isRoleMove || feature.featureKey === 'attack') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCompactTooltip({ description: feature.description, top: rect.top, bottom: rect.bottom });
                          }
                        }}
                        onMouseLeave={() => {
                          if (isTouch) return;
                          setHoveredFeature(null);
                          if (feature._isRoleMove || feature.featureKey === 'attack') setHoveredCompactTooltip(null);
                          gmHoverHideTimer.current = setTimeout(() => { setGmHoverOverlayActive(false); gmHoverHideTimer.current = null; }, 120);
                        }}
                        onClick={(e) => {
                          if (category === 'Fear Actions') {
                            if (setFearCount) setFearCount(prev => Math.max(0, prev - parseFearCost(feature.description)));
                          }
                          if (canRoll) handleRoll(feature, e);
                        }}
                        className={`w-full text-left bg-slate-800/50 hover:bg-slate-800 rounded border transition-all group flex ${(category === 'Fear Actions' || canRoll) ? 'cursor-pointer' : 'cursor-default'} ${justRolled ? 'border-green-600 bg-green-900/20' : 'border-slate-700 hover:border-r-yellow-500'}`}
                      >
                        {feature._isRoleMove && (
                          <div className="flex shrink-0 gap-[3px] py-1.5 pl-1">
                            <div className="w-1 rounded-full bg-amber-500/90" />
                            <div className="w-1 rounded-full bg-violet-400/80" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 p-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium text-slate-200 group-hover:text-white text-sm flex items-center gap-1.5 min-w-0">
                              {feature.name}
                              {canRoll && (
                                <Dices size={11} className={`shrink-0 ${justRolled ? 'text-green-400' : 'text-slate-500 group-hover:text-red-400 transition-colors'}`} />
                              )}
                            </span>
                            <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 shrink-0">{feature.sourceName}</span>
                          </div>
                          {!feature._isRoleMove && feature.featureKey !== 'attack' && <p className="text-xs text-slate-400 line-clamp-2 leading-snug mt-0.5"><FeatureDescription description={feature.description} /></p>}
                          {allCds.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                              {allCds.map((cd, cdIdx) => (
                                <div key={cdIdx} className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">{allCds.length > 1 ? cd.label : 'Countdown'}</span>
                                  <div className="inline-flex items-center gap-0.5">
                                    <button
                                      onClick={() => updateCountdown(feature.cardKey, feature.featureKey, cdIdx, Math.max(0, cdVals[cdIdx] - 1))}
                                      className="w-4 h-4 rounded bg-slate-700 hover:bg-red-800 text-slate-200 flex items-center justify-center text-[10px] font-bold transition-colors leading-none"
                                    >−</button>
                                    <span className="min-w-[1.25rem] text-center font-bold text-yellow-400 text-xs tabular-nums">{cdVals[cdIdx]}</span>
                                    <button
                                      onClick={() => updateCountdown(feature.cardKey, feature.featureKey, cdIdx, cdVals[cdIdx] + 1)}
                                      className="w-4 h-4 rounded bg-slate-700 hover:bg-green-800 text-slate-200 flex items-center justify-center text-[10px] font-bold transition-colors leading-none"
                                    >+</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })}
          {activeElements.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              No active elements.<br />Add adversaries, environments, or scenes to populate the table.
            </div>
          )}

          {/* Default GM Moves — collapsible */}
          <div>
            <button
              onClick={() => toggleSection('Defaults')}
              className="w-full flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1 hover:text-slate-200 transition-colors"
            >
              {collapsedSections.has('Defaults')
                ? <ChevronRight size={12} className="shrink-0" />
                : <ChevronDown size={12} className="shrink-0" />
              }
              <span className="flex-1 text-left">Defaults</span>
              <span className="text-[10px] font-normal text-slate-600 normal-case tracking-normal">{DEFAULT_GM_MOVES.length}</span>
            </button>
            {!collapsedSections.has('Defaults') && (
              <div className="flex">
                {/* Three color strips indicating which dice results use each move */}
                <div
                  className="relative w-4 shrink-0 mr-2 cursor-default"
                  onMouseEnter={() => { if (!isTouch) setShowStripLegend(true); }}
                  onMouseLeave={() => { if (!isTouch) setShowStripLegend(false); }}
                  onClick={() => { if (isTouch) setShowStripLegend(v => !v); }}
                >
                  <div className="absolute left-0 w-1 rounded-full bg-amber-500/90" style={{ top: 0, height: `${(HOPE_END / DEFAULT_GM_MOVES.length) * 100}%` }} />
                  <div className="absolute left-[5px] w-1 rounded-full bg-violet-400/80" style={{ top: `${(FEAR_SUCCESS_START / DEFAULT_GM_MOVES.length) * 100}%`, height: `${((FEAR_SUCCESS_END - FEAR_SUCCESS_START) / DEFAULT_GM_MOVES.length) * 100}%` }} />
                  <div className="absolute left-[10px] w-1 rounded-full bg-blue-900" style={{ top: `${(FEAR_FAILURE_START / DEFAULT_GM_MOVES.length) * 100}%`, bottom: 0 }} />
                  {showStripLegend && (
                    <div className="absolute left-6 top-0 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3 w-48 pointer-events-none">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">When to use</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
                          <span className="text-xs text-slate-300">Failure with Hope</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm bg-violet-400 shrink-0" />
                          <span className="text-xs text-slate-300">Success with Fear</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm bg-blue-900 shrink-0" />
                          <span className="text-xs text-slate-300">Failure with Fear</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Compact move list */}
                <div className="flex-1">
                  {DEFAULT_GM_MOVES.map((move, idx) => (
                    <div
                      key={idx}
                      onMouseEnter={(e) => {
                        if (isTouch) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDefaultMove({ ...move, top: rect.top, bottom: rect.bottom });
                      }}
                      onMouseLeave={() => { if (!isTouch) setHoveredDefaultMove(null); }}
                      onClick={(e) => {
                        if (!isTouch) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDefaultMove(prev => prev?.name === move.name ? null : { ...move, top: rect.top, bottom: rect.bottom });
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-default"
                    >
                      <span className="text-slate-300 text-xs leading-snug">{move.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      )}

      {/* Center Column */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-950 relative">
        {/* Pre-roll banner (onAct chips, e.g. Quick Reactions) — popover overlay */}
        {preRollBanner && createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preroll-title"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={clearPreRollBanner}
              aria-hidden="true"
            />
            <div className="relative px-4 py-3 rounded-xl shadow-2xl bg-slate-900/95 border-2 border-amber-500/60 text-amber-50 max-w-md">
              <div id="preroll-title" className="text-sm font-bold text-amber-200 mb-2">Before you roll</div>
              <p className="text-xs text-slate-300 mb-2">Optional: toggle options below, then Proceed to roll.</p>
              <div className="flex flex-wrap gap-1.5 items-center mb-3">
                {preRollBanner.chips.map((chip, i) => {
                  if (chip._difficultyChip) {
                    return (
                      <div key={i} className="w-full flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-300" htmlFor="preroll-difficulty">
                          {chip.label}
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
                            className="flex-1 h-2 rounded-full appearance-none bg-gradient-to-r from-violet-400 to-violet-900 cursor-pointer accent-violet-600"
                            aria-label="Difficulty (DC 5–30)"
                          />
                          <span className="text-sm font-bold tabular-nums text-violet-200 shrink-0 w-8" aria-live="polite">
                            {preRollDifficulty}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">{getDifficultyLabel(preRollDifficulty)}</span>
                        <div className="flex flex-col gap-1.5 mt-1.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-slate-300">Advantage</span>
                            {preRollAdvantages.map((name, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={name}
                                  onChange={(e) => setPreRollAdvantages(prev => {
                                    const next = [...prev];
                                    next[idx] = e.target.value;
                                    return next;
                                  })}
                                  placeholder="Advantage"
                                  className="flex-1 min-w-0 rounded px-2 py-1 text-[11px] bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                                  aria-label="Advantage name"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreRollAdvantages(prev => prev.filter((_, i) => i !== idx))}
                                  className="shrink-0 p-1 rounded text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                  aria-label="Remove advantage"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setPreRollAdvantages(prev => [...prev, ''])}
                              className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-violet-300 hover:bg-slate-800/80 border border-slate-600 hover:border-slate-500"
                            >
                              <Plus size={12} /> Add advantage [d6]
                            </button>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-slate-300">Disadvantage</span>
                            {preRollDisadvantages.map((name, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={name}
                                  onChange={(e) => setPreRollDisadvantages(prev => {
                                    const next = [...prev];
                                    next[idx] = e.target.value;
                                    return next;
                                  })}
                                  placeholder="Disadvantage"
                                  className="flex-1 min-w-0 rounded px-2 py-1 text-[11px] bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                                  aria-label="Disadvantage name"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreRollDisadvantages(prev => prev.filter((_, i) => i !== idx))}
                                  className="shrink-0 p-1 rounded text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                  aria-label="Remove disadvantage"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setPreRollDisadvantages(prev => [...prev, ''])}
                              className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-violet-300 hover:bg-slate-800/80 border border-slate-600 hover:border-slate-500"
                            >
                              <Plus size={12} /> Add disadvantage [d6]
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const selected = selectedPreRollChips[i];
                  const used = chip._used;
                  const label = chip.label ?? '';
                  const costParts = [];
                  if (chip.stressCost) costParts.push(`${chip.stressCost} Stress`);
                  if (chip.hopeCost) costParts.push(`${chip.hopeCost} Hope`);
                  const costLabel = costParts.length ? ` (${costParts.join(', ')})` : '';
                  const resetsOnLabel = chip.resetsOn === 'session' ? 'Once per session' : chip.resetsOn === 'longRest' ? 'Once per long rest' : chip.resetsOn === 'rest' ? 'Once per rest' : null;
                  const tooltipLabel = used ? (resetsOnLabel ? `Already used (${resetsOnLabel})` : 'Already used') : label + costLabel;
                  return (
                    <Tooltip key={i} label={tooltipLabel} placement="bottom-left">
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={used}
                          onClick={used ? undefined : () => setSelectedPreRollChips(prev => {
                            const next = [...prev];
                            next[i] = !next[i];
                            return next;
                          })}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            used
                              ? 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed opacity-70'
                              : selected
                                ? 'border-amber-600 bg-amber-900/50 text-amber-200'
                                : 'border-slate-600 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Square size={12} className={`shrink-0 ${selected && !used ? 'hidden' : ''}`} />
                          <CheckSquare size={12} className={`shrink-0 ${selected && !used ? '' : 'hidden'}`} />
                          <span className="truncate max-w-[180px]">{label}</span>
                          {chip.stressCost > 0 && !used && <span className="text-[10px] opacity-80">1 Stress</span>}
                          {chip.hopeCost > 0 && !used && <span className="text-[10px] opacity-80">{chip.hopeCost} Hope</span>}
                        </button>
                        {resetsOnLabel && (
                          <span className={`text-[9px] rounded px-1.5 py-0.5 border shrink-0 ${used ? 'border-slate-700 bg-slate-800/50 text-slate-500' : 'border-slate-600 bg-slate-800/60 text-slate-400'}`}>
                            {resetsOnLabel}
                          </span>
                        )}
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreRollProceed}
                  className="px-3 py-1.5 rounded text-[11px] font-semibold border border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100"
                >
                  Proceed
                </button>
                <button
                  type="button"
                  onClick={clearPreRollBanner}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  Cancel
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
            currentUserUid={user?.uid}
            onBannerAcknowledge={!isPlayer ? handleBannerAcknowledge : undefined}
            onBannerCancel={!isPlayer ? handleBannerCancel : (gmUid ? (bannerId, roll) => postBannerCancel(gmUid, roll._rollDbId).catch(() => {}) : undefined)}
            lifeSupportSelections={lifeSupportSelections}
            onLifeSupportSelect={onLifeSupportSelect}
            onLifeSupportClear={onLifeSupportClear}
            restMovesSelections={restMovesSelections}
            onRestMoveSelect={onRestMoveSelect}
            onRestMoveClear={onRestMoveClear}
            restTableCharacters={activeElements.filter(e => e.elementType === 'character')}
            restMovesPerCharacter={restMovesPerCharacter}
            restCanEditColumn={isPlayer ? (instanceId) => {
              const el = activeElements.find(e => e.instanceId === instanceId);
              const byUid = el?.assignedPlayerUid === user?.uid;
              const byEmail = !!playerEmail && el?.assignedPlayerEmail === playerEmail;
              return byUid || byEmail;
            } : () => true}
            restGmUid={gmUid}
            makeASceneSelections={makeASceneSelections}
            onMakeASceneSelect={(rollDbId, instanceId) => {
              setMakeASceneSelections(prev => ({ ...prev, [rollDbId]: instanceId }));
              // Sync selection to server so all clients (GM + player) see the same choice
              postBannerMakeASceneTarget(gmUid, rollDbId, instanceId).catch(() => {});
            }}
            makeASceneAdversaries={makeASceneAdversaries}
            targets={isPlayer ? [] : damageTargets}
            getTargetsForRoll={getTargetsForRoll}
            getTargetDisadvantageLabels={!isPlayer ? getTargetDisadvantageLabels : undefined}
            onApplyDamage={isPlayer ? undefined : handleApplyDamage}
            onApplyVulnerable={!isPlayer ? handleApplyVulnerable : undefined}
            canApplyDamage={!isPlayer}
            onLuckyReroll={isPlayer ? undefined : handleLuckyReroll}
            onQuickTarget={isPlayer ? undefined : handleQuickTarget}
            onDoubledUpTarget={isPlayer ? undefined : handleDoubledUpTarget}
            onBouncingTarget={isPlayer ? undefined : handleBouncingTarget}
            wizardsWithHope={isPlayer ? [] : wizardsWithHope}
            onNotThisTime={isPlayer ? undefined : handleNotThisTime}
            bannerReactions={ancestryBannerReactions}
            displayOverridesByRollId={displayOverridesByRollId}
            onBannerReactionActivate={handleBannerReactionActivate}
            onChipResolve={gmUid ? handleChipResolve : undefined}
            tableCharacters={isPlayer ? [] : tableCharacters}
            rangerFocusRerollChars={rangerFocusRerollChars}
            onRangerFocusReroll={isPlayer ? undefined : handleRangerFocusReroll}
            onRangerFocusRerollRequest={isPlayer ? handleRangerFocusRerollRequest : undefined}
            rangerFocusRequestedBannerIds={rangerFocusRequestedBannerIds}
            holdThemOffChars={holdThemOffChars}
            onHoldThemOffToggle={gmUid ? handleHoldThemOffToggle : undefined}
            onBannerTargetsChange={gmUid ? handleBannerTargetsChange : undefined}
            wingsOfLightFlyingInstanceIds={wingsOfLightFlyingInstanceIds}
            onWingsD8Toggle={!isPlayer ? handleWingsD8Toggle : undefined}
            onWingsD8ToggleRequest={isPlayer && gmUid ? handleWingsD8ToggleRequest : undefined}
            onGetWingsD8Extra={!isPlayer ? getWingsD8Extra : undefined}
            getWaterRetaliationNames={!isPlayer ? getWaterRetaliationNames : undefined}
            prayerDiceChars={prayerDiceChars}
            onPrayerDieSelect={gmUid ? handlePrayerDieSelect : undefined}
            rallyDieInstanceIds={rallyDieInstanceIds}
            onRallyDieToggle={gmUid ? handleRallyDieToggle : undefined}
            heartOfAPoetChars={heartOfAPoetChars}
            onHeartD4Toggle={!isPlayer && gmUid ? handleHeartD4Toggle : undefined}
            onHeartD4ToggleRequest={isPlayer && gmUid ? handleHeartD4ToggleRequest : undefined}
            bannerStripLeftOffset={tableCharacters.length > 0 ? CHARACTER_TRAY_WIDTH_PX : 0}
          />
          <BattleMap
            gmUid={gmUid}
            user={user}
            isPlayer={isPlayer}
            activeElements={activeElements}
            updateActiveElement={updateActiveElement}
            mapConfig={mapConfig}
            onMapConfigChange={onMapConfigChange}
            onClearDice={() => diceRollerRef.current?.clearDice?.()}
            className="flex-1 min-h-0"
          />
        </div>
        {/* Action log footer — collapsed title bar; click to open overlay with roll/action history */}
        <ActionLog
          rolls={actionLog}
          rollBuilder={{ onRoll: (rollText, displayName) => postRoll(rollText, displayName, isPlayer ? gmUid : null), displayName: user?.displayName || user?.email || (isPlayer ? 'Player' : 'GM') }}
        />
      </div>

      {/* Encounter Panel — hidden for players */}
      {!isPlayer && <div className="w-56 bg-slate-950 border-l border-slate-800 flex flex-col overflow-y-auto shrink-0">
        <div className="px-2 py-2 bg-slate-950 border-b border-slate-800 sticky top-0 z-10 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-sm">
              <Swords size={15} className="text-red-400" /> Encounter
            </h2>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setCaptureOpen(true)}
                disabled={activeElements.length === 0}
                title="Save current table as a Scene"
                className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              ><Camera size={13} /></button>
              <button
                onClick={() => {
                  if (!window.confirm('Clear all adversaries and environments from the table? This cannot be undone.')) return;
                  clearTable?.();
                }}
                disabled={activeElements.length === 0}
                title="Remove all items from the table"
                className="p-1 rounded text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              ><Trash2 size={13} /></button>
            </div>
          </div>
          {/* + Add menu (Adversary, Environment, Scene) */}
          <div
            className="relative"
            ref={addMenuRef}
            onMouseLeave={() => { if (!isTouch) setAddMenuOpen(false); }}
          >
            <button
              onClick={() => setAddMenuOpen(p => !p)}
              className={`w-full rounded-lg border border-dashed px-2.5 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${addMenuOpen ? 'border-slate-500 bg-slate-800/60' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'}`}
            >
              <Plus size={12} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-400">Add...</span>
            </button>
            {addMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
                {[
                  { col: 'adversaries', label: 'Adversary' },
                  { col: 'environments', label: 'Environment' },
                  { col: 'scenes', label: 'Scene' },
                ].map(({ col, label }) => (
                  <button
                    key={col}
                    onClick={() => { setModalOpen(col); setAddMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Battle Budget card */}
          <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
            <button
              onClick={() => setBudgetCardOpen(o => !o)}
              className="w-full px-2.5 py-2 flex items-center gap-1.5 text-left hover:bg-slate-800/50 transition-colors"
            >
              {budgetCardOpen
                ? <ChevronDown size={11} className="text-slate-500 shrink-0" />
                : <ChevronRight size={11} className="text-slate-500 shrink-0" />
              }
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex-1">BP Budget</span>
              <span className="text-xs tabular-nums text-slate-400">
                <span className="font-bold text-white">{tableBP}</span>
                <span className="text-slate-500"> of </span>
                <span className="font-bold text-white">{adjustedBudget}</span>
              </span>
              {tableBP > 0 && (
                <span className={`text-[10px] font-semibold tabular-nums ml-1 ${tableDiffColor}`}>
                  {tableDiff === 0 ? '=' : tableDiff > 0 ? `+${tableDiff}` : `${tableDiff}`}
                </span>
              )}
            </button>
            {budgetCardOpen && (
              <div className="border-t border-slate-800 px-2.5 py-2.5 space-y-3">
                {/* Budget formula */}
                <div className="text-xs">
                  <span className="text-slate-400">({partySize} PCs × 3) + 2 = </span>
                  <span className="font-bold text-white tabular-nums">{tableBudget}</span>
                  {totalMod !== 0 && (
                    <>
                      <span className={`tabular-nums ${totalMod < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {' '}{totalMod > 0 ? `+${totalMod}` : totalMod}
                      </span>
                      <span className="text-slate-400"> = </span>
                      <span className="font-bold text-white tabular-nums">{adjustedBudget}</span>
                    </>
                  )}
                  <span className="text-slate-500"> BP</span>
                </div>

                {/* Auto-detected modifiers */}
                {activeAutoMods.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Auto-detected</p>
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
                            <span className="text-slate-300">{m.label}</span>
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

                {/* Difficulty / Length dropdown */}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Difficulty / Length</p>
                  <select
                    value={difficultyValue}
                    onChange={e => setDifficulty(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-slate-500 cursor-pointer"
                  >
                    <option value="lessDifficult">Less difficult / shorter fight  −1</option>
                    <option value="">Standard</option>
                    <option value="slightlyMoreDangerous">Slightly more dangerous / slightly longer fight  +1</option>
                    <option value="moreDangerous">More dangerous / longer fight  +2</option>
                  </select>
                </div>

                {/* Damage Boost dropdown */}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Damage Boost</p>
                  <select
                    value={damageBoostValue}
                    onChange={e => setDamageBoost(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-slate-500 cursor-pointer"
                  >
                    <option value="">None</option>
                    <option value="plusOne">+1 damage to all adversaries  −1</option>
                    <option value="static">+2 damage to all adversaries  −2</option>
                    <option value="d4">+1d4 damage to all adversaries  −2</option>
                  </select>
                </div>

                {tableDamageBoost && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <Zap size={10} /> {tableDamageBoost === 'plusOne' ? '+1' : tableDamageBoost === 'static' ? '+2' : '+1d4'} damage boost active on all adversaries
                  </p>
                )}
              </div>
            )}
          </div>
          {/* Session / Rest cycle buttons */}
          <div className="flex items-center gap-1">
            <button
              title="Start Session — acknowledge to refresh session-use features for all characters"
              onClick={() => handleSessionCycle('session')}
              className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-emerald-800/60 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 hover:border-emerald-700 transition-colors"
            >▶ Session</button>
            <button
              title="Short Rest — refresh rest-use features for all characters"
              onClick={() => handleSessionCycle('rest')}
              className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-sky-800/60 bg-sky-950/30 text-sky-400 hover:bg-sky-900/40 hover:border-sky-700 transition-colors"
            >⏸ Short</button>
            <button
              title="Long Rest — refresh rest and long-rest features for all characters"
              onClick={() => handleSessionCycle('longRest')}
              className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded border border-violet-800/60 bg-violet-950/30 text-violet-400 hover:bg-violet-900/40 hover:border-violet-700 transition-colors"
            >⏹ Long</button>
          </div>
          {/* Fear tracker */}
          <div className="rounded-lg border px-2.5 py-2 border-slate-700 bg-slate-900">
            <div className="flex items-center gap-1.5 mb-1.5" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Fear', top: r.top, bottom: r.bottom, side: 'right' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
              <Flame size={12} className="shrink-0 text-purple-500" />
              <CheckboxTrack
                total={6}
                filled={Math.min(fearCount, 6)}
                onSetFilled={(v) => setFearCount && setFearCount(v)}
                fillColor="bg-purple-500"
                label="Fear"
                verbs={['Gain', 'Spend']}
                currentAbsoluteValue={fearCount}
                targetToAbsolute={(v) => v}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Flame size={12} className="shrink-0 invisible" />
              <CheckboxTrack
                total={6}
                filled={Math.max(0, fearCount - 6)}
                onSetFilled={(v) => setFearCount && setFearCount(v + 6)}
                fillColor="bg-purple-500"
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
            className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 transition-colors cursor-default ${gmMovesOverlay.isOpen ? 'border-yellow-600/60 bg-yellow-950/30' : 'border-slate-700 bg-slate-900 hover:border-yellow-600/40'}`}
            {...gmMovesOverlay.triggerProps(true)}
          >
            <Zap size={14} className="text-yellow-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex-1">GM Moves</span>
            {(() => {
              const count = Object.values(consolidatedMenu).reduce((sum, f) => sum + f.length, 0);
              return count > 0 ? <span className="text-[10px] text-slate-500 tabular-nums">{count}</span> : null;
            })()}
          </div>
        </div>

        <div className="p-2 space-y-3">
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
                    className="hidden group-hover/env:block text-slate-500 hover:text-red-400 transition-colors shrink-0"
                    title="Remove from table"
                  ><X size={12} /></button>
                </div>
              </div>
            );
          })}
          {consolidatedElements.filter(item => item.kind === 'adversary-group').map((item) => {
            const { baseElement: el, instances } = item;
            const count = instances.length;
            const displayEl = el._scaledFromTier != null && !(scaledToggleState[el.id] ?? true) ? getUnscaledAdversary(el) : el;
            return (
              <div
                key={el.id}
                className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden group/adv"
                {...trackerOverlay.triggerProps(e => ({ kind: 'adversary', baseElement: item.baseElement, instances: item.instances, top: e.currentTarget.getBoundingClientRect().top, bottom: e.currentTarget.getBoundingClientRect().bottom }))}
              >
                <div className="px-2.5 py-1.5 border-b border-slate-800 flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200 truncate flex-1">{displayEl.name}</span>
                  {count > 1 && <span className="text-[10px] text-slate-500 shrink-0 group-hover/adv:hidden tabular-nums">×{count}</span>}
                  <div className="hidden group-hover/adv:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => addToTable(getItemData(el), 'adversaries')}
                      className="w-4 h-4 rounded bg-slate-800 hover:bg-green-900 text-slate-400 hover:text-green-300 flex items-center justify-center text-[10px] font-bold transition-colors leading-none"
                      title="Add one more"
                    >+</button>
                    <span className="min-w-[1rem] text-center text-[10px] text-slate-400 font-semibold tabular-nums">{count}</span>
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
                      className="w-4 h-4 rounded bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-300 flex items-center justify-center transition-colors leading-none"
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
                      <span className="text-[10px] text-slate-400">
                        Thresholds <span className="font-bold text-yellow-300">{displayEl.hp_thresholds.major}</span>
                        <span className="text-slate-600"> / </span>
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
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            {count > 1 && <span className="text-slate-600 font-medium">#{idx + 1}</span>}
                            {budgetCardOpen && (
                              <>
                                {count > 1 && <span className="text-slate-700">·</span>}
                                <span className="capitalize">{displayEl.role || 'Standard'}</span>
                                <span className="text-slate-700">·</span>
                                {displayEl.role === 'minion'
                                  ? <span>1/group BP</span>
                                  : <span className="text-slate-400 tabular-nums">{ROLE_BP_COST[displayEl.role || 'standard'] ?? ROLE_BP_COST.standard} BP</span>
                                }
                              </>
                            )}
                          </div>
                        )}
                        {inst.vulnerable && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-600/70 text-amber-200">Vulnerable</span>
                            <button
                              onClick={() => updateActiveElement(inst.instanceId, { vulnerable: false })}
                              className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
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
                              className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                              title="Clear Focus"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        {inst.difficultyMod != null && inst.difficultyMod !== 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/60 border border-red-600/70 text-red-200" title="Make a Scene: difficulty reduced">
                              {inst.difficultyMod > 0 ? '+' : ''}{inst.difficultyMod} Difficulty
                            </span>
                            <button
                              onClick={() => updateActiveElement(inst.instanceId, { difficultyMod: 0 })}
                              className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                              title="Clear difficulty modifier"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                        {isAdversaryDefeated({ hp_max: displayEl.hp_max, currentHp: inst.currentHp }) && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700/80 border border-slate-600 text-slate-300">Defeated</span>
                        )}
                        {(displayEl.hp_max || 0) > 0 && (
                          <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'HP', top: r.top, bottom: r.bottom, side: 'right' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                            <Heart size={10} className="text-red-500 shrink-0" />
                            <CheckboxTrack
                              total={displayEl.hp_max || 0}
                              filled={hpDamage}
                              onSetFilled={(dmg) => updateActiveElement(inst.instanceId, { currentHp: (displayEl.hp_max || 0) - dmg })}
                              fillColor="bg-red-500"
                              label="HP"
                              verbs={['Mark', 'Clear']}
                            />
                            {(displayEl.stress_max || 0) === 0 && !inst.conditions && !openConditions.has(inst.instanceId) && (
                              <button
                                onClick={() => setOpenConditions(prev => new Set([...prev, inst.instanceId]))}
                                className="ml-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                                title="Add conditions"
                              ><Tag size={10} /></button>
                            )}
                          </div>
                        )}
                        {(displayEl.stress_max || 0) > 0 && (
                          <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Stress', top: r.top, bottom: r.bottom, side: 'right' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                            <AlertCircle size={10} className="text-orange-500 shrink-0" />
                            <CheckboxTrack
                              total={displayEl.stress_max || 0}
                              filled={inst.currentStress || 0}
                              onSetFilled={(s) => updateActiveElement(inst.instanceId, { currentStress: s })}
                              fillColor="bg-orange-500"
                              label="Stress"
                              verbs={['Mark', 'Clear']}
                            />
                            {!inst.conditions && !openConditions.has(inst.instanceId) && (
                              <button
                                onClick={() => setOpenConditions(prev => new Set([...prev, inst.instanceId]))}
                                className="ml-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                                title="Add conditions"
                              ><Tag size={10} /></button>
                            )}
                          </div>
                        )}
                        {(inst.conditions || openConditions.has(inst.instanceId)) && (
                          <input
                            type="text"
                            placeholder="Conditions..."
                            autoFocus={openConditions.has(inst.instanceId) && !inst.conditions}
                            value={inst.conditions || ''}
                            onChange={e => updateActiveElement(inst.instanceId, { conditions: e.target.value })}
                            onBlur={() => {
                              if (!inst.conditions) {
                                setOpenConditions(prev => { const s = new Set(prev); s.delete(inst.instanceId); return s; });
                              }
                            }}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-blue-500 placeholder-slate-600"
                          />
                        )}
                        {idx < instances.length - 1 && (
                          <div className="border-t border-slate-800 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {consolidatedElements.filter(item => item.kind === 'adversary-group').length === 0 && (
            <div className="text-center text-slate-600 text-xs py-6">
              No adversaries on table.
            </div>
          )}
        </div>
      </div>}

      {/* Player Encounter Panel — read-only Fear + damaged adversaries */}
      {isPlayer && (
        <div className="w-56 bg-slate-950 border-l border-slate-800 flex flex-col overflow-y-auto shrink-0">
          <div className="px-2 py-2 bg-slate-950 border-b border-slate-800 sticky top-0 z-10 space-y-2">
            <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-sm">
              <Swords size={15} className="text-red-400" /> Encounter
            </h2>
            {/* Fear tracker — read-only */}
            <div className="rounded-lg border px-2.5 py-2 border-slate-700 bg-slate-900">
              <div className="flex items-center gap-1.5 mb-1.5" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Fear', top: r.top, bottom: r.bottom, side: 'right' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                <Flame size={12} className="shrink-0 text-purple-500" />
                <CheckboxTrack
                  total={6}
                  filled={Math.min(fearCount, 6)}
                  fillColor="bg-purple-500"
                  label="Fear"
                />
              </div>
              {fearCount > 6 && (
                <div className="flex items-center gap-1.5">
                  <Flame size={12} className="shrink-0 invisible" />
                  <CheckboxTrack
                    total={6}
                    filled={Math.max(0, fearCount - 6)}
                    fillColor="bg-purple-500"
                    label="Fear"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Adversaries with damage or conditions (read-only for players) */}
          <div className="p-2 space-y-2">
            {(() => {
              const damagedGroups = consolidatedElements
                .filter(item => item.kind === 'adversary-group')
                .map(item => {
                  const { baseElement: el, instances } = item;
                  const displayEl = el._scaledFromTier != null && !(scaledToggleState[el.id] ?? true) ? getUnscaledAdversary(el) : el;
                  const damagedInstances = instances.filter(inst => {
                    const hpDamage = (displayEl.hp_max || 0) - (inst.currentHp ?? displayEl.hp_max ?? 0);
                    const stressDamage = inst.currentStress || 0;
                    const hasConditions = inst.vulnerable || (inst.conditions && String(inst.conditions).trim() !== '');
                    return hpDamage > 0 || stressDamage > 0 || hasConditions;
                  });
                  return { displayEl, instances, damagedInstances };
                })
                .filter(g => g.damagedInstances.length > 0);

              if (damagedGroups.length === 0) return null;

              return damagedGroups.map(({ displayEl, instances, damagedInstances }) => (
                <div
                  key={displayEl.id || displayEl.instanceId}
                  className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden"
                >
                  <div className="px-2.5 py-1.5 border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-200 truncate block">{displayEl.name}</span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {damagedInstances.map((inst, idx) => {
                      const hpDamage = (displayEl.hp_max || 0) - (inst.currentHp ?? displayEl.hp_max ?? 0);
                      const stressDamage = inst.currentStress || 0;
                      return (
                        <div key={inst.instanceId} className="space-y-1">
                          {instances.length > 1 && (
                            <span className="text-[10px] text-slate-600 font-medium">
                              #{instances.indexOf(inst) + 1}
                            </span>
                          )}
                          {hpDamage > 0 && (
                            <MarkedBoxes
                              count={hpDamage}
                              fillColor="bg-red-500"
                              icon={Heart}
                              iconColor="text-red-500"
                            />
                          )}
                          {stressDamage > 0 && (
                            <MarkedBoxes
                              count={stressDamage}
                              fillColor="bg-orange-500"
                              icon={AlertCircle}
                              iconColor="text-orange-500"
                            />
                          )}
                          {inst.vulnerable && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-600/70 text-amber-200">Vulnerable</span>
                          )}
                          {inst.focusedBy && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-600/60 text-emerald-200">Focused by {inst.focusedBy}</span>
                          )}
                          {inst.difficultyMod != null && inst.difficultyMod !== 0 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/60 border border-red-600/70 text-red-200" title="Make a Scene: difficulty reduced">
                              {inst.difficultyMod > 0 ? '+' : ''}{inst.difficultyMod} Difficulty
                            </span>
                          )}
                          {isAdversaryDefeated({ hp_max: displayEl.hp_max, currentHp: inst.currentHp }) && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700/80 border border-slate-600 text-slate-300">Defeated</span>
                          )}
                          {inst.conditions && (
                            <p className="text-[10px] text-slate-400 italic ml-3.5">{inst.conditions}</p>
                          )}
                          {idx < damagedInstances.length - 1 && (
                            <div className="border-t border-slate-800 mt-1" />
                          )}
                        </div>
                      );
                    })}
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
        onClose={() => setModalOpen(null)}
        onSelect={(item) => {
          if (modalOpen === 'characters' && isPlayer && onPlayerAddCharacter) {
            const { is_public, _source, ...charData } = item;
            onPlayerAddCharacter({ ...charData, elementType: 'character' });
          } else {
            addToTable(item, modalOpen);
          }
          setModalOpen(null);
        }}
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
    {editState?.step === 'form' && (
      <ItemDetailModal
        item={editState.item}
        collection={editState.collection}
        data={data}
        editable={true}
        saveImage={saveImage}
        onSave={async (editedData) => {
          const itemWithId = { ...editedData, id: editState.baseElement.id };
          if (editState.mode === 'copy') {
            updateActiveElementsBaseData(
              el => el.id === editState.baseElement.id,
              itemWithId
            );
          } else {
            await saveItem(editState.collection, itemWithId);
            if (saveImage && (editedData.imageUrl != null || editedData._additionalImages != null)) {
              await saveImage(editState.collection, itemWithId.id, editedData.imageUrl ?? '', { _additionalImages: editedData._additionalImages });
            }
            // Characters are resolved at render-time from the library; no manual
            // activeElements update needed — saveItem already updated data.characters.
            if (editState.collection !== 'characters') {
              updateActiveElementsBaseData(el => el.id === itemWithId.id, itemWithId);
            }
          }
        }}
        onClose={closeEditModal}
        partySize={partySize}
        partyTier={partyTier}
        characters={characters}
        onMergeAdversary={onMergeAdversary}
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
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 110px)' }}>
          <div className="p-5 relative">
            {trackerOverlay.data.kind === 'environment' ? (() => {
              const el = trackerOverlay.data.element;
              return (
                <>
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                    <button
                      onClick={() => { trackerOverlay.close(); handleEditClick([el], el, 'environments'); }}
                      className="p-1.5 rounded-lg bg-slate-800/90 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                      title="Edit"
                    ><Edit size={14} /></button>
                    <button
                      onClick={() => { removeActiveElement(el.instanceId); trackerOverlay.close(); }}
                      className="p-1.5 rounded-lg bg-slate-800/90 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                      title="Remove from table"
                    ><Trash2 size={14} /></button>
                  </div>
                  {el.imageUrl && (
                    <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
                      <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" />
                    </div>
                  )}
                  <h3 className={`text-xl font-bold text-white mb-1 pr-20`}>
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
                      className="p-1.5 rounded-lg bg-slate-800/90 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                      title="Edit"
                    ><Edit size={14} /></button>
                    <button
                      onClick={() => { removeGroup(liveInstances); trackerOverlay.close(); }}
                      className="p-1.5 rounded-lg bg-slate-800/90 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                      title="Remove from table"
                    ><Trash2 size={14} /></button>
                  </div>
                  {liveBaseElement.imageUrl && (
                    <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
                      <img src={liveBaseElement.imageUrl} alt={liveBaseElement.name} className="w-full h-full object-cover opacity-80" />
                    </div>
                  )}
                  <h3 className={`text-xl font-bold text-white mb-1 pr-20`}>
                    {liveBaseElement.name}
                    {liveInstances.length > 1 && (
                      <span className="text-slate-400 font-normal ml-1.5">×{liveInstances.length}</span>
                    )}
                  </h3>
                  <AdversaryCardContent
                    element={liveBaseElement}
                    hoveredFeature={null}
                    cardKey={liveBaseElement.id}
                    count={liveInstances.length}
                    instances={liveInstances}
                    updateFn={updateActiveElement}
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
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 110px)' }}>
          <div className="p-5 relative">
            {potAdvOverlay.data.element.imageUrl && (
              <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
                <img src={potAdvOverlay.data.element.imageUrl} alt={potAdvOverlay.data.element.name} className="w-full h-full object-cover opacity-80" />
              </div>
            )}
            <h3 className="text-xl font-bold text-white mb-1 pr-16">{potAdvOverlay.data.element.name}</h3>
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

    {/* Hover overlay for default GM Moves — shown regardless of tab */}

    {hoveredDefaultMove && (
      <div
        className="fixed z-50 pointer-events-none"
        style={{ right: 'calc(34rem + 20px)', top: (hoveredDefaultMove.top + hoveredDefaultMove.bottom) / 2, transform: 'translateY(-50%)', width: '22rem' }}
      >
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-5">
          <p className="text-sm text-slate-300 italic leading-relaxed">{hoveredDefaultMove.example}</p>
        </div>
      </div>
    )}

    {/* Resource track label tooltips — shown on hover over Hope/Armor/HP/Stress/Fear rows */}
    {hoveredTrackTooltip && (
      <div
        className="fixed z-[65] pointer-events-none"
        style={
          hoveredTrackTooltip.side === 'left'
            ? { left: 'calc(14rem + 10px)', top: (hoveredTrackTooltip.top + hoveredTrackTooltip.bottom) / 2, transform: 'translateY(-50%)', width: '18rem' }
            : { right: 'calc(14rem + 10px)', top: (hoveredTrackTooltip.top + hoveredTrackTooltip.bottom) / 2, transform: 'translateY(-50%)', width: '18rem' }
        }
      >
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl px-4 py-3">
          <p className="text-sm font-semibold text-slate-200">{hoveredTrackTooltip.label}</p>
        </div>
      </div>
    )}

    {/* Hover overlay for role moves and basic attacks — description shown on hover */}
    {hoveredCompactTooltip && (
      <div
        className="fixed z-[60] pointer-events-none"
        style={{ right: 'calc(34rem + 20px)', top: (hoveredCompactTooltip.top + hoveredCompactTooltip.bottom) / 2, transform: 'translateY(-50%)', width: '22rem' }}
      >
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-5">
          <p className="text-sm text-slate-300 leading-relaxed"><FeatureDescription description={hoveredCompactTooltip.description} /></p>
        </div>
      </div>
    )}

    {/* Hover overlay: shown when a GM Moves item is hovered */}
    {(hoveredElement || gmHoverOverlayActive) && (() => {
      const displayElement = hoveredElement || lastHoveredElementRef.current;
      if (!displayElement) return null;
      return (
      <div
        ref={gmFeatureOverlayRef}
        className="fixed z-50"
        style={{ right: 'calc(34rem + 20px)', top: '50%', transform: 'translateY(-50%)', width: '26rem', maxHeight: '80vh' }}
        onMouseEnter={() => { if (isTouch) return; if (gmHoverHideTimer.current) { clearTimeout(gmHoverHideTimer.current); gmHoverHideTimer.current = null; } setGmHoverOverlayActive(true); }}
        onMouseLeave={() => { if (!isTouch) setGmHoverOverlayActive(false); }}
      >
        <div ref={overlayScrollRef} className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh]">
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
                <h3 className={`text-xl font-bold text-white mb-1 ${displayElement.element.imageUrl ? 'pr-20' : ''}`}>{displayElement.element.name}</h3>
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
                <h3 className={`text-xl font-bold text-white mb-1 ${el.imageUrl ? 'pr-20' : ''}`}>
                  {displayEl.name}
                  {displayElement.instances.length > 1 && (
                    <span className="text-slate-400 font-normal ml-1.5">×{displayElement.instances.length}</span>
                  )}
                </h3>
                <AdversaryCardContent
                  element={displayEl}
                  hoveredFeature={hoveredFeature}
                  cardKey={el.id}
                  count={displayElement.instances.length}
                  instances={displayElement.instances}
                  updateFn={updateActiveElement}
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
          className="fixed z-[201] rounded-lg border border-amber-600/70 bg-slate-900 shadow-2xl p-2 space-y-2"
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
          <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide">
            {adversaryTargetMenu.validTargets.length > 0 ? 'Choose target' : 'No targets in range'}
          </div>
          <div className="space-y-1">
            {adversaryTargetMenu.validTargets.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic px-1 py-1">No characters are in range of this attack.</p>
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
                    const pendingRoll = {
                      get rollText() { return finalRollText; },
                      set rollText(v) { finalRollText = v; },
                      addDisadvantage(featureName) { finalRollText = insertDisadvantageD6(finalRollText, featureName ?? pendingRoll._currentFeatureName); },
                    };
                    const wrappedChar = wrapEntity(targetEl, updateActiveElement);
                    const ancestryFeatureList = targetEl.ancestryFeatures || [];
                    for (const af of ancestryFeatureList) {
                      const descriptor = ancestryFeatures[af?.name];
                      if (descriptor?.onTargeted) {
                        pendingRoll._currentFeatureName = af?.name;
                        descriptor.onTargeted(pendingRoll, wrappedChar);
                      }
                    }
                  }
                  postRoll(finalRollText, displayName, null, { ...rollMeta, _selectedTargetInstanceId: t.instanceId })
                    .then(() => {
                      if (rk) {
                        setRolledKey(rk);
                        setTimeout(() => setRolledKey(prev => prev === rk ? null : prev), 1500);
                      }
                    })
                    .catch(err => console.error('Roll failed:', err));
                  setAdversaryTargetMenu(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-amber-600/60 bg-slate-800/80 text-slate-200 hover:bg-amber-800/60 hover:border-amber-500 transition-colors"
              >
                <div>{t.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {[
                    t.maxHp > 0 ? `HP ${t.currentHp ?? t.maxHp}/${t.maxHp}` : null,
                    t.maxStress > 0 ? `Stress ${t.currentStress ?? 0}/${t.maxStress}` : null,
                  ].filter(Boolean).join(' · ')}
                  {t.conditions ? ` · ${t.conditions}` : ''}
                  {disadvantageForTarget.length ? (
                    <span className="text-amber-300/95 font-medium">
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
            onClick={() => setAdversaryTargetMenu(null)}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors w-full text-center"
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
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
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

    {/* Character hover card overlay — appears to the RIGHT of the Characters panel */}
    {characterOverlay.isOpen && (() => {
      // Look up the live element so CheckboxTrack interactions reflect current state
      const liveEl = activeElements.find(e => e.instanceId === characterOverlay.data.element.instanceId) || characterOverlay.data.element;
      const hasCompanion = !!liveEl.companion;
      return (
        <div
          ref={characterOverlay.overlayRef}
          className="fixed z-[55] flex flex-row"
          style={{
            left: 'calc(14rem)',
            paddingLeft: '8px',
            top: 90,
            width: hasCompanion ? 'calc(36rem + 16px)' : 'calc(22rem + 8px)',
            height: 'calc(100dvh - 98px)',
          }}
          {...characterOverlay.overlayHandlers}
        >
          <div className="flex flex-col overflow-hidden shrink-0" style={{ width: '22rem' }}>
            {(() => {
              const isMyCharacter = playerEmail != null && liveEl.assignedPlayerEmail === playerEmail;
              const allowInteract = !isPlayer || isMyCharacter;
              return (
                <CharacterHoverCard
                  el={liveEl}
                  updateFn={allowInteract ? updateActiveElement : undefined}
                  expandedKeys={featureExpanded[liveEl.instanceId] ?? []}
                  onToggleFeature={(key) => toggleFeatureExpanded(liveEl.instanceId, key)}
                  onResync={(isMyCharacter || !isPlayer) && liveEl.daggerstackUrl ? () => handleResyncCharacter(liveEl) : null}
                  isSyncing={resyncingCharId === liveEl.instanceId}
                  onRoll={allowInteract ? handlePlayerOwnRoll : undefined}
                  onSpendHope={allowInteract ? handleSpendHope : undefined}
                  onUseHopeAbility={allowInteract ? handleUseHopeAbility : undefined}
                  onEdit={isMyCharacter && liveEl.id ? () => {
                    const libraryItem = data.characters?.find(i => i.id === liveEl.id) || liveEl;
                    navigate(gmUid ? `/gm-table/${gmUid}/characters/${liveEl.id}` : `/gm-table/characters/${liveEl.id}`);
                    setEditState({ step: 'form', item: libraryItem, collection: 'characters', mode: 'original', instances: [liveEl], baseElement: liveEl });
                  } : undefined}
                  onDebugMouseEnter={characterOverlay.cancelClose}
                  onDebugMouseLeave={characterOverlay.close}
                  onActionNotification={allowInteract ? (isPlayer ? handlePlayerActionNotification : handleActionNotification) : undefined}
                  activeElements={activeElements}
                  mapConfig={mapConfig}
                  pendingResourceCosts={pendingResourceCosts}
                  hideCompanionSection={hasCompanion}
                  isPlayer={isPlayer}
                  getValidTargets={allowInteract ? getValidTargets : undefined}
                />
              );
            })()}
          </div>
          {hasCompanion && (() => {
            const isMyCharacter = playerEmail != null && liveEl.assignedPlayerEmail === playerEmail;
            const allowInteract = !isPlayer || isMyCharacter;
            const comp = liveEl.companion;
            const selectedExp = comp.selectedExperienceIndex != null ? comp.experiences?.[comp.selectedExperienceIndex] : null;
            const handleCompanionRoll = allowInteract
              ? (rollText, displayName, meta) => handlePlayerOwnRoll(rollText, displayName, meta, { characterEl: liveEl })
              : undefined;
            const spellcastKey = (liveEl.spellcastTrait || 'presence').toLowerCase();
            const spellcastScore = liveEl.traits?.[spellcastKey] ?? 0;
            const buildCompanionAttackRollText = () => {
              const parts = [`${comp.name} ${comp.attackName} Hope [d12] Fear [d12]`];
              if (spellcastScore !== 0) parts.push(`${spellcastKey} [${spellcastScore}]`);
              if (selectedExp?.name) parts.push(`${selectedExp.name} [2]`);
              parts.push('damage [d6] melee');
              return parts.join(' ');
            };
            const buildCompanionActRollText = () => {
              const parts = [`${liveEl.name} Companion Act Hope [d12] Fear [d12]`];
              if (spellcastScore !== 0) parts.push(`${spellcastKey} [${spellcastScore}]`);
              if (selectedExp?.name) parts.push(`${selectedExp.name} [2]`);
              return parts.join(' ');
            };
            const buildCompanionRollMeta = () => {
              const meta = { _attackerInstanceId: liveEl.instanceId };
              if (selectedExp) meta._experienceHopeCost = 1;
              return meta;
            };
            return (
              <div className="flex flex-col overflow-hidden pl-2 shrink-0" style={{ width: '14rem' }}>
                <CompanionSheet
                  companion={liveEl.companion}
                  onStressChange={updateActiveElement ? (filled) => updateActiveElement(liveEl.instanceId, { companion: { ...liveEl.companion, currentStress: filled } }) : undefined}
                  onAttackRoll={handleCompanionRoll && comp.attackName?.trim() ? () => {
                    const rollText = buildCompanionAttackRollText();
                    handleCompanionRoll(rollText, `${liveEl.name} (${comp.name})`, buildCompanionRollMeta());
                    updateActiveElement(liveEl.instanceId, { companion: { ...liveEl.companion, selectedExperienceIndex: undefined } });
                  } : undefined}
                  onActRoll={handleCompanionRoll ? () => {
                    const rollText = buildCompanionActRollText();
                    handleCompanionRoll(rollText, `${liveEl.name} Companion Act`, buildCompanionRollMeta());
                    updateActiveElement(liveEl.instanceId, { companion: { ...liveEl.companion, selectedExperienceIndex: undefined } });
                  } : undefined}
                  selectedExperienceIndex={comp.selectedExperienceIndex}
                  onSelectExperience={updateActiveElement ? (i) => updateActiveElement(liveEl.instanceId, { companion: { ...liveEl.companion, selectedExperienceIndex: i ?? undefined } }) : undefined}
                  characterHope={liveEl.hope}
                />
              </div>
            );
          })()}
        </div>
      );
    })()}

      </div>{/* end flex-1 flex overflow-hidden */}
    </div>
  );
}
