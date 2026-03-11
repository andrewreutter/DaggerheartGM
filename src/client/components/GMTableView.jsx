import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useTouchDevice } from '../lib/useTouchDevice.js';
import { useHoverOverlay } from '../lib/useHoverOverlay.js';
import { Zap, Trash2, Dices, ChevronDown, ChevronRight, X, Plus, Camera, Swords, Heart, AlertCircle, Tag, Flame, Edit, Sparkles, Pencil, User, Users, Shield, RefreshCw, ExternalLink, Eye, EyeOff, Circle } from 'lucide-react';
import { BattleMap } from './BattleMap.jsx';
import { DiceLog } from './DiceLog.jsx';
import { parseFeatureCategory, parseAllCountdownValues, generateId, effectiveThresholds } from '../lib/helpers.js';
import { FeatureDescription } from './FeatureDescription.jsx';
import { EnvironmentCardContent, AdversaryCardContent, CheckboxTrack } from './DetailCardContent.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { ItemPickerModal } from './modals/ItemPickerModal.jsx';
import { postRoll, postActionNotification, syncDaggerstackCharacter, resolveItems, requestGoogleContactsAccess, searchGoogleContacts } from '../lib/api.js';
import { isOwnItem, ROLE_BP_COST } from '../lib/constants.js';
import { computeBattlePoints, computeAutoModifiers, computeTotalBudgetMod } from '../lib/battle-points.js';
import { getUnscaledAdversary } from '../lib/adversary-defaults.js';
import { CharacterHoverCard } from './CharacterHoverCard.jsx';
import { DiceRoller } from './DiceRoller.jsx';
import { wrapEntity } from '../../features/entity.js';
import { wrapRoll } from '../../features/roll.js';
import { runHook, runPipelineHook } from '../../features/hooks.js';
import { weaponFeatures, armorFeatures } from '../../features/registry.js';
import { extractDetailsValues } from '../lib/dice-utils.js';


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

// Parse ALL bracket-enclosed expressions from a Rolz roll string into synthetic subItems
// that mirror the structure Rolz returns — full pre text between brackets, trailing post
// text on the last item, and both dice and flat-number expressions included. Results and
// details are left empty; DiceRoller shows spinners for unknown values.
function rollTextToSyntheticSubItems(rollText) {
  // Extract {Name: text} feature tags and strip them before parsing [expr] sub-items.
  const tags = [];
  const tagRe = /\{([^}:]+):\s*([^}]+)\}/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(rollText)) !== null) {
    tags.push({ name: tagMatch[1].trim(), text: tagMatch[2].trim() });
  }
  const cleanedText = rollText.replace(/\{[^}]+\}/g, '').trim();

  const items = [];
  const re = /\[([^\]]+)\]/g;
  let lastEnd = 0;
  let m;
  while ((m = re.exec(cleanedText)) !== null) {
    const pre = cleanedText.slice(lastEnd, m.index);
    const expr = m[1].trim();
    items.push({ pre, input: expr, result: '', details: '', post: '' });
    lastEnd = m.index + m[0].length;
  }
  if (items.length > 0 && lastEnd < cleanedText.length) {
    items[items.length - 1].post = cleanedText.slice(lastEnd);
  }
  return { items, tags };
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

/**
 * Daggerheart damage threshold resolution.
 * Returns the number of HP boxes to mark given a raw damage total and thresholds.
 *   < major             → 1 (Minor)
 *   >= major < severe   → 2 (Major)
 *   >= severe           → 3 (Severe), +1 for each doubling beyond severe
 */
function computeHpLoss(damage, thresholds) {
  const major = thresholds?.major;
  const severe = thresholds?.severe;
  if (severe != null && damage >= severe) {
    let hp = 3;
    let threshold = severe * 2;
    while (damage >= threshold) {
      hp++;
      threshold *= 2;
    }
    return hp;
  }
  if (major != null && damage >= major) return 2;
  return 1;
}

export function GMTableView({ activeElements, updateActiveElement, removeActiveElement, updateActiveElementsBaseData, data, saveItem, saveImage, addToTable, onMergeAdversary, user, route, navigate, featureCountdowns = {}, updateCountdown, partySize = 1, partyTier = 1, characters = [], tableBattleMods, setTableBattleMods, fearCount = 0, setFearCount, ensureScenesLoaded, ensureAdventuresLoaded, ensureCharactersLoaded, clearTable, isPlayer = false, playerEmail, connectedPlayers = [], playerEmails = [], setPlayerEmails, gmUid, onPlayerAddCharacter, playerDiceRollQueue = [], setPlayerDiceRollQueue, playerDiceAck, setPlayerDiceAck, onDiceAckBroadcast, previewAsPlayerEmail = null, onPreviewAsPlayer, onExitPreview, diceLog = [], setDiceLog, mapConfig, onMapConfigChange }) {
  const isTouch = useTouchDevice();

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

  // Dice roller ref — rolls are added imperatively via diceRollerRef.current?.addRoll()
  // and updated via updateRoll(). No external queue needed; DiceRoller manages its own banner list.

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
  const [captureOpen, setCaptureOpen] = useState(false);
  const [budgetCardOpen, setBudgetCardOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef(null);
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
  const [fearPulsing, setFearPulsing] = useState(false);
  const fearPulseTimerRef = useRef(null);
  const triggerFearPulse = () => {
    if (fearPulseTimerRef.current) clearTimeout(fearPulseTimerRef.current);
    setFearPulsing(false);
    requestAnimationFrame(() => {
      setFearPulsing(true);
      fearPulseTimerRef.current = setTimeout(() => setFearPulsing(false), 2500);
    });
  };
  const [hopePulsingId, setHopePulsingId] = useState(null);
  const hopePulseTimerRef = useRef(null);
  const triggerHopePulse = (instanceId) => {
    if (hopePulseTimerRef.current) clearTimeout(hopePulseTimerRef.current);
    setHopePulsingId(null);
    requestAnimationFrame(() => {
      setHopePulsingId(instanceId);
      hopePulseTimerRef.current = setTimeout(() => setHopePulsingId(null), 2500);
    });
  };

  // ── Damage application state ─────────────────────────────────────────────
  const diceRollerRef = useRef(null);
  const pendingDamageRef = useRef(null); // stash applied damage for ack broadcast

  const [damagePulsingId, setDamagePulsingId] = useState(null);
  const damagePulseTimerRef = useRef(null);
  const triggerDamagePulse = (instanceId) => {
    if (damagePulseTimerRef.current) clearTimeout(damagePulseTimerRef.current);
    setDamagePulsingId(null);
    requestAnimationFrame(() => {
      setDamagePulsingId(instanceId);
      damagePulseTimerRef.current = setTimeout(() => setDamagePulsingId(null), 1800);
    });
  };


  // Apply HP/Stress changes to a target after optional Parry reduction.
  // armorOpts: { applyReduction?, markSlot?, feature? }
  //   applyReduction: reduce hpLoss by 1 (or 2 for Fortified) — set by armor button
  //   markSlot: actually consume an armor slot — false when Resilient saves it
  //   feature: armor feature name ('Fortified', 'Painful', 'Reinforced', etc.)
  // dmgType: 'phy' | 'mag' | '' — damage type from the roll's post tag (Phase 3)
  const applyDamageToTarget = (target, effectiveDmgTotal, tagNames, roll, armorOpts = {}, dmgType = '') => {
    const { applyReduction = false, markSlot = false, feature = null } = armorOpts;

    // Wrap target and roll so feature hooks receive clean semantic APIs.
    const entityTarget = wrapEntity(target, updateActiveElement);
    const ctx = { target: entityTarget, tagNames, roll: wrapRoll(roll), dmgType };

    // Pre-threshold damage modification (e.g. Warded subtracts armor score from magic damage)
    const dmgTotalForCalc = runPipelineHook(
      armorFeatures,
      target.armorFeatureName ? [target.armorFeatureName] : [],
      'modifyPreThresholdDamage',
      effectiveDmgTotal,
      ctx,
    );

    let hpLoss = computeHpLoss(dmgTotalForCalc, target.thresholds);

    // HP loss modification (e.g. Deadly adds +1 on Severe)
    hpLoss = runPipelineHook(weaponFeatures, tagNames, 'modifyHpLoss', hpLoss, ctx);

    // Armor reduction when a slot is used
    if (applyReduction) {
      const reduction = armorFeatures[feature]?.armorReduction ?? 1;
      hpLoss = Math.max(0, hpLoss - reduction);
    }

    entityTarget.markHp(hpLoss);

    // Post-damage effects (Scary, Burning, etc.)
    runHook(weaponFeatures, tagNames, 'onDamageApplied', ctx);

    // Armor slot marking and triggered effects (Painful, Reinforced, etc.)
    // markArmor() runs first so hooks see the post-mark count via target.currentArmor.
    if (markSlot) {
      entityTarget.markArmor();
      runHook(armorFeatures, feature ? [feature] : [], 'onArmorSlotMarked', ctx);
    }

    triggerDamagePulse(target.instanceId);
    return entityTarget.currentHp;
  };

  // Called from the banner's "Apply to" target badge.
  // Async to support Parry (which requires a server roll before applying damage).
  // dmgType: 'phy' | 'mag' | '' — damage type extracted from the roll (Phase 3)
  const handleApplyDamage = async (target, dmgTotal, tags = [], roll = null, dmgType = '') => {
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

    const newHp = applyDamageToTarget(target, effectiveDmgTotal, tagNames, roll, armorOpts, dmgType);
    pendingDamageRef.current = { instanceId: target.instanceId, newHp };
  };


  // Apply Hope/Fear side effects after the dice animation completes.
  // Separated from handleDaggerheartRoll so effects fire when the banner dismisses.
  const applyRollSideEffects = (dominant, rollUser) => {
    if (dominant === 'fear') {
      setFearCount(prev => Math.min(prev + 1, 12));
      triggerFearPulse();
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
      triggerHopePulse(match.instanceId);
    }
  };

  // Receives confirmed roll data (from server HTTP response).
  // Adds to the dice log and resolves the matching optimistic banner (or adds a new one).
  // optId — the _optId of the optimistic placeholder, if one was created.
  const handleRollResult = (rollData, optId = null) => {
    const logEntry = { ...rollData, _logId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setDiceLog(prev => [...prev.slice(-49), logEntry]);
    diceRollerRef.current?.updateRoll(optId, rollData);
  };

  // Compute pulse/element-update ack payload for broadcasting to players.
  const computeRollAck = (dominant, rollUser) => {
    const pulses = [];
    const elementUpdates = [];
    if (dominant === 'fear') {
      pulses.push({ type: 'fear' });
      elementUpdates.push({ type: 'fearCount', newValue: Math.min(fearCount + 1, 12) });
    } else if (dominant === 'hope' || dominant === 'critical') {
      const chars = activeElements.filter(el => el.elementType === 'character');
      if (!chars.length) return { pulses, elementUpdates };
      const nameLower = (rollUser || '').toLowerCase().trim();
      let match = chars.find(el => el.name?.toLowerCase() === nameLower || el.playerName?.toLowerCase() === nameLower);
      if (!match) {
        match = chars.find(
          el => (el.name && nameLower.startsWith(el.name.toLowerCase())) ||
                (el.playerName && nameLower.startsWith(el.playerName.toLowerCase()))
        );
      }
      if (!match && chars.length === 1) match = chars[0];
      if (!match) return { pulses, elementUpdates };
      const maxHope = match.maxHope ?? 6;
      const currentHope = match.hope ?? maxHope;
      const newHope = Math.min(currentHope + 1, maxHope);
      pulses.push({ type: 'hope', instanceId: match.instanceId });
      elementUpdates.push({ instanceId: match.instanceId, updates: { hope: newHope } });
      if (dominant === 'critical') {
        elementUpdates.push({ instanceId: match.instanceId, updates: { currentStress: Math.max(0, (match.currentStress ?? 0) - 1) } });
      }
    }
    return { pulses, elementUpdates };
  };

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


  // Lucky: reroll the same attack, marking 1 Stress on the attacker.
  // Dismiss the current banner first, then fire a fresh roll.
  const handleLuckyReroll = async (roll) => {
    const attacker = findAttacker(roll.rollUser);
    if (attacker) {
      const maxStress = attacker.maxStress ?? 6;
      const newStress = Math.min((attacker.currentStress ?? 0) + 1, maxStress);
      updateActiveElement(attacker.instanceId, { currentStress: newStress });
    }
    const rollText = roll.rollText;
    if (!rollText) return;
    // Dismiss only the Lucky banner so the reroll gets its own animation
    if (roll._bannerId) diceRollerRef.current?.dismissBannerId?.(roll._bannerId);
    const { items: syntheticSubItems, tags: syntheticTags } = rollTextToSyntheticSubItems(rollText);
    const optId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (syntheticSubItems.length > 0) {
      diceRollerRef.current?.addRoll({ _optimistic: true, _optId: optId, subItems: syntheticSubItems, tags: syntheticTags, rollUser: roll.rollUser });
    }
    try {
      const rollData = await postRoll(rollText, roll.rollUser);
      handleRollResult(rollData, optId);
    } catch (err) {
      console.error('Lucky reroll failed:', err);
    }
  };

  // Quick: apply the same damage to a second target, marking 1 Stress on the attacker.
  const handleQuickTarget = (target, dmgTotal, tags, roll, dmgType = '') => {
    handleApplyDamage(target, dmgTotal, tags, roll, dmgType);
    const attacker = findAttacker(roll.rollUser);
    if (attacker) {
      const maxStress = attacker.maxStress ?? 6;
      const newStress = Math.min((attacker.currentStress ?? 0) + 1, maxStress);
      updateActiveElement(attacker.instanceId, { currentStress: newStress });
    }
  };

  // Bouncing: apply damage to an additional target and mark 1 Stress on the attacker.
  // Does NOT dismiss — banner stays in bouncingPhase for another target if desired.
  const handleBouncingTarget = (target, dmgTotal, tags, roll, dmgType = '') => {
    handleApplyDamage(target, dmgTotal, tags, roll, dmgType);
    const attacker = findAttacker(roll.rollUser);
    if (attacker) {
      const maxStress = attacker.maxStress ?? 6;
      const newStress = Math.min((attacker.currentStress ?? 0) + 1, maxStress);
      updateActiveElement(attacker.instanceId, { currentStress: newStress });
    }
  };

  // Not This Time (Wizard): deduct 3 Hope from a Wizard and reroll the adversary roll.
  const handleNotThisTime = async (wizard, roll) => {
    const el = activeElements.find(e => e.instanceId === wizard.instanceId);
    if (!el) return;
    const maxHope = el.maxHope ?? 6;
    const currentHope = el.hope ?? maxHope;
    if (currentHope < 3) return;
    updateActiveElement(wizard.instanceId, { hope: currentHope - 3 });
    triggerHopePulse(wizard.instanceId);
    const rollText = roll.rollText;
    if (!rollText) return;
    // Dismiss the original banner and issue a fresh reroll
    if (roll._bannerId) diceRollerRef.current?.dismissBannerId?.(roll._bannerId);
    const { items: syntheticSubItems, tags: syntheticTags } = rollTextToSyntheticSubItems(rollText);
    const optId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (syntheticSubItems.length > 0) {
      diceRollerRef.current?.addRoll({ _optimistic: true, _optId: optId, subItems: syntheticSubItems, tags: syntheticTags, rollUser: roll.rollUser, _notThisTime: true, _wizardName: wizard.name });
    }
    try {
      const rollData = await postRoll(rollText, roll.rollUser);
      handleRollResult(rollData, optId);
    } catch (err) {
      console.error('Not This Time reroll failed:', err);
    }
  };

  // Action notification (e.g. Startling): push a synthetic _action entry to the DiceRoller.
  const handleActionNotification = (notification) => {
    // Show optimistically on the GM's DiceRoller immediately
    diceRollerRef.current?.addRoll(notification);
    // Broadcast to all other room clients (players and other GM windows) via SSE.
    // Uses _clientId so the sender's own SSE echo is skipped.
    postActionNotification(notification);
  };

  // Player action notification — broadcast to GM room (shows on GM + other players).
  const handlePlayerActionNotification = (notification) => {
    playerDiceRollerRef.current?.addRoll(notification);
    postActionNotification(notification, gmUid);
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


  // Called by DiceRoller after a banner is dismissed. Apply game side-effects now.
  // Skip side effects if the roll was dismissed while still optimistic (real data not yet arrived).
  // Delegates to the player-roll path when roll._isPlayerRoll is true.
  const handleDiceRollComplete = (roll) => {
    if (roll._isPlayerRoll) {
      handlePlayerRollComplete(roll);
      return;
    }
    if (roll._action) {
      // Apply feature costs for _featureUse action notifications
      if (roll._featureUse && roll._attackerInstanceId) {
        applyFeatureResources(roll._attackerInstanceId, roll);
      }
      // Action notifications: dispatch onRollComplete hook for action tags (Startling, Charged, etc.)
      if (roll._attackerInstanceId) {
        const actionTagNames = new Set((roll.tags || []).map(t => t.name));
        const actionAttackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
        const actionAttacker = actionAttackerEl ? wrapEntity(actionAttackerEl, updateActiveElement) : null;
        runHook(weaponFeatures, actionTagNames, 'onRollComplete', { attacker: actionAttacker, roll });
      }
      return;
    }
    if (!roll._optimistic) {
      // Apply feature costs for _featureUse dice rolls
      if (roll._featureUse && roll._attackerInstanceId) {
        applyFeatureResources(roll._attackerInstanceId, roll);
      }
      // Remove consumed one-shot modifier (e.g. Rally Die) from the character's active modifier bin
      if (roll._usedModifierId && roll._attackerInstanceId) {
        const modEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
        if (modEl?.activeModifiers?.length > 0) {
          const kept = modEl.activeModifiers.filter(m => m.id !== roll._usedModifierId);
          if (kept.length !== modEl.activeModifiers.length) {
            updateActiveElement(roll._attackerInstanceId, { activeModifiers: kept });
          }
        }
      }
      // Dispatch onRollComplete hook for all weapon feature tags.
      // Attacker is resolved from _attackerInstanceId (precise) or rollUser name (fallback).
      {
        const rollTagNames = new Set((roll.tags || []).map(t => t.name));
        const attackerEl = roll._attackerInstanceId
          ? activeElements.find(e => e.instanceId === roll._attackerInstanceId)
          : findAttacker(roll.rollUser);
        const attacker = attackerEl ? wrapEntity(attackerEl, updateActiveElement) : null;
        runHook(weaponFeatures, rollTagNames, 'onRollComplete', { attacker, roll });
      }
      const ackData = computeRollAck(roll.dominant, roll.rollUser);
      if (roll._rollDbId) ackData._rollDbId = roll._rollDbId;
      applyRollSideEffects(roll.dominant, roll.rollUser);
      const dmgPending = pendingDamageRef.current;
      pendingDamageRef.current = null;
      if (dmgPending) {
        ackData.pulses.push({ type: 'damage', instanceId: dmgPending.instanceId });
        ackData.elementUpdates.push({ instanceId: dmgPending.instanceId, updates: { currentHp: dmgPending.newHp } });
      }
      onDiceAckBroadcast?.(ackData);
    }
  };

  // Called when a player's roll banner is dismissed on the GM screen.
  // Applies side effects and broadcasts ack to all players.
  // Also handles cleanup from playerDiceRollQueue for SSE-originated rolls.
  const handlePlayerRollComplete = (roll) => {
    if (roll._action) {
      // Apply feature costs for player action notifications (e.g. Hope ability with no dice)
      if (roll._featureUse && roll._attackerInstanceId) {
        applyFeatureResources(roll._attackerInstanceId, roll);
      }
      if (roll._attackerInstanceId) {
        const actionTagNames = new Set((roll.tags || []).map(t => t.name));
        const actionAttackerEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
        const actionAttacker = actionAttackerEl ? wrapEntity(actionAttackerEl, updateActiveElement) : null;
        runHook(weaponFeatures, actionTagNames, 'onRollComplete', { attacker: actionAttacker, roll });
      }
      if (roll._rollId) setPlayerDiceRollQueue?.(prev => prev.filter(r => r._rollId !== roll._rollId));
      return;
    }
    if (!roll._optimistic) {
      const logEntry = { ...roll, _logId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      setDiceLog(prev => [...prev.slice(-49), logEntry]);
      // Apply feature costs for player feature dice rolls
      if (roll._featureUse && roll._attackerInstanceId) {
        applyFeatureResources(roll._attackerInstanceId, roll);
      }
      // Remove consumed one-shot modifier (e.g. Rally Die) on ack
      if (roll._usedModifierId && roll._attackerInstanceId) {
        const modEl = activeElements.find(e => e.instanceId === roll._attackerInstanceId);
        if (modEl?.activeModifiers?.length > 0) {
          const kept = modEl.activeModifiers.filter(m => m.id !== roll._usedModifierId);
          if (kept.length !== modEl.activeModifiers.length) {
            updateActiveElement(roll._attackerInstanceId, { activeModifiers: kept });
          }
        }
      }
      // Dispatch onRollComplete hook for all weapon feature tags.
      {
        const rollTagNames = new Set((roll.tags || []).map(t => t.name));
        const attackerEl = roll._attackerInstanceId
          ? activeElements.find(e => e.instanceId === roll._attackerInstanceId)
          : findAttacker(roll.rollUser);
        const attacker = attackerEl ? wrapEntity(attackerEl, updateActiveElement) : null;
        runHook(weaponFeatures, rollTagNames, 'onRollComplete', { attacker, roll });
      }
      const ackData = computeRollAck(roll.dominant, roll.rollUser);
      if (roll._rollDbId) ackData._rollDbId = roll._rollDbId;
      applyRollSideEffects(roll.dominant, roll.rollUser);
      const dmgPending = pendingDamageRef.current;
      pendingDamageRef.current = null;
      if (dmgPending) {
        ackData.pulses.push({ type: 'damage', instanceId: dmgPending.instanceId });
        ackData.elementUpdates.push({ instanceId: dmgPending.instanceId, updates: { currentHp: dmgPending.newHp } });
      }
      onDiceAckBroadcast?.(ackData);
    }
    // Clean up SSE-originated rolls from the external queue
    if (roll._rollId) setPlayerDiceRollQueue?.(prev => prev.filter(r => r._rollId !== roll._rollId));
  };
  const handleSpendHope = (instanceId) => {
    const el = activeElements.find(e => e.instanceId === instanceId);
    if (!el) return;
    const maxHope = el.maxHope ?? 6;
    const currentHope = el.hope ?? maxHope;
    const newHope = Math.max(0, currentHope - 1);
    updateActiveElement(instanceId, { hope: newHope, selectedExperienceIndex: null });
    triggerHopePulse(instanceId);
  };

  const handleUseHopeAbility = (instanceId) => {
    const el = activeElements.find(e => e.instanceId === instanceId);
    if (!el) return;
    const maxHope = el.maxHope ?? 6;
    const currentHope = el.hope ?? maxHope;
    if (currentHope < 3) return;
    updateActiveElement(instanceId, { hope: currentHope - 3, selectedExperienceIndex: null });
    triggerHopePulse(instanceId);
  };

  // ── Feature resource application ─────────────────────────────────────────────
  // Called on banner dismiss when roll._featureUse is true.
  // Applies Hope/Stress/Armor costs and marks feature as used.
  const applyFeatureResources = (instanceId, roll) => {
    const el = activeElements.find(e => e.instanceId === instanceId);
    if (!el) return;
    const updates = {};

    if (roll._hopeCost > 0) {
      const maxHope = el.maxHope ?? 6;
      const current = el.hope ?? maxHope;
      updates.hope = Math.max(0, current - roll._hopeCost);
      triggerHopePulse(instanceId);
    }
    if (roll._stressCost > 0) {
      const maxStress = el.maxStress ?? 6;
      updates.currentStress = Math.min((el.currentStress ?? 0) + roll._stressCost, maxStress);
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
      updateActiveElement(instanceId, updates);
    }
    // Distribute modifiers to ALL characters (e.g. Rally Die distributes to whole party)
    if (roll._distributeModifiersToAll && roll._addModifiers?.length > 0) {
      const allChars = activeElements.filter(e => e.elementType === 'character');
      for (const char of allChars) {
        // Give each character a uniquely-ID'd copy of the modifier
        const mods = roll._addModifiers.map(m => ({ ...m, id: `${m.id || m.name}-${char.instanceId}` }));
        updateActiveElement(char.instanceId, {
          activeModifiers: [...(char.activeModifiers || []), ...mods],
        });
      }
    }
  };

  // ── Session / Rest cycle handlers ────────────────────────────────────────────
  // Broadcast an action banner and reset matching featureUsage / activeModifiers.
  const handleSessionCycle = (cycle) => {
    const label = cycle === 'session' ? 'Start Session'
      : cycle === 'rest' ? 'Short Rest'
      : 'Long Rest';
    const cyclesToClear = cycle === 'session' ? ['session']
      : cycle === 'rest' ? ['rest']
      : ['rest', 'longRest'];

    // Show locally AND broadcast to all room clients
    const cycleNotification = {
      _action: true,
      rollUser: 'GM',
      actionName: label,
      actionText: cycle === 'session'
        ? 'Session started — session-use features refreshed.'
        : cycle === 'rest'
          ? 'Short rest — rest-use features refreshed.'
          : 'Long rest — rest and long-rest features refreshed.',
    };
    diceRollerRef.current?.addRoll(cycleNotification);
    postActionNotification(cycleNotification);

    // Clear matching featureUsage and activeModifiers on all character elements
    const characters = activeElements.filter(e => e.elementType === 'character');
    for (const char of characters) {
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
  };

  // Forward SSE dice-roll items from playerDiceRollQueue to the right DiceRoller imperatively.
  // Player's own rolls are already sent via addRoll in handlePlayerOwnRoll; only SSE items
  // (marked _fromSSE: true) and history items (marked _fromHistory: true) arrive here.
  const playerDiceRollerRef = useRef(null);
  const forwardedRollIds = useRef(new Set());
  useEffect(() => {
    const diceRef = isPlayer ? playerDiceRollerRef : diceRollerRef;
    for (const roll of playerDiceRollQueue) {
      if (!roll._rollId || forwardedRollIds.current.has(roll._rollId)) continue;
      forwardedRollIds.current.add(roll._rollId);
      diceRef.current?.addRoll({
        ...roll,
        // History rolls carry _playerInitiated on their data; use it to route correctly.
        // SSE rolls from players also carry _playerInitiated: true; others do not.
        _isPlayerRoll: roll._playerInitiated === true,
      });
    }
    // Prune forwarded IDs that are no longer in the queue
    const currentIds = new Set(playerDiceRollQueue.map(r => r._rollId).filter(Boolean));
    for (const id of forwardedRollIds.current) {
      if (!currentIds.has(id)) forwardedRollIds.current.delete(id);
    }
  }, [playerDiceRollQueue]);

  // Player: handle dice-ack event — dismiss banner and apply element updates from GM
  useEffect(() => {
    if (!isPlayer || !playerDiceAck) return;
    // Dismiss only the oldest banner (one ack = one roll acknowledged), not all
    playerDiceRollerRef.current?.dismissFirst?.();
    // Apply element updates (hope, stress, hp changes)
    if (Array.isArray(playerDiceAck.elementUpdates)) {
      playerDiceAck.elementUpdates.forEach(({ instanceId, updates }) => {
        if (instanceId) updateActiveElement(instanceId, updates);
      });
    }
    // Trigger local pulse animations for visible elements
    if (Array.isArray(playerDiceAck.pulses)) {
      playerDiceAck.pulses.forEach(pulse => {
        if (pulse.type === 'hope' && pulse.instanceId) triggerHopePulse(pulse.instanceId);
        if (pulse.type === 'damage' && pulse.instanceId) triggerDamagePulse(pulse.instanceId);
      });
    }
    setPlayerDiceAck?.(null);
  }, [playerDiceAck, isPlayer]);

  // GM mode: dismiss the DiceRoller and trigger pulse animations when another
  // GM window broadcasts dice-ack (element values arrive via table_state SSE).
  useEffect(() => {
    if (isPlayer || !playerDiceAck) return;
    diceRollerRef.current?.dismiss();
    if (Array.isArray(playerDiceAck.pulses)) {
      playerDiceAck.pulses.forEach(pulse => {
        if (pulse.type === 'fear') triggerFearPulse();
        if (pulse.type === 'hope' && pulse.instanceId) triggerHopePulse(pulse.instanceId);
        if (pulse.type === 'damage' && pulse.instanceId) triggerDamagePulse(pulse.instanceId);
      });
    }
    setPlayerDiceAck?.(null);
  }, [playerDiceAck, isPlayer]);

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

  const handleRoll = async (feature) => {
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
    const key = `${feature.cardKey}|${feature.featureKey}`;
    const { items: syntheticSubItems, tags: syntheticTags } = rollTextToSyntheticSubItems(rollText);
    const optId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (syntheticSubItems.length > 0) {
      diceRollerRef.current?.addRoll({ _optimistic: true, _optId: optId, subItems: syntheticSubItems, tags: syntheticTags, rollUser: displayName });
    }
    try {
      const rollData = await postRoll(rollText, displayName);
      handleRollResult(rollData, optId);
      setRolledKey(key);
      setTimeout(() => setRolledKey(prev => prev === key ? null : prev), 1500);
    } catch (err) {
      console.error('Roll failed:', err);
    }
  };

  const handleCardRoll = async (attackData, sourceName) => {
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
    const { items: syntheticSubItems, tags: syntheticTags } = rollTextToSyntheticSubItems(rollText);
    const optId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (syntheticSubItems.length > 0) {
      diceRollerRef.current?.addRoll({ _optimistic: true, _optId: optId, subItems: syntheticSubItems, tags: syntheticTags, rollUser: displayName });
    }
    try {
      const rollData = await postRoll(rollText, displayName);
      handleRollResult(rollData, optId);
    } catch (err) {
      console.error('Roll failed:', err);
    }
  };

  const handleTraitRoll = async (rollText, displayName, rollMeta = {}) => {
    dismissAllHoverCards();
    const { items: syntheticSubItems, tags: syntheticTags } = rollTextToSyntheticSubItems(rollText);
    const optId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (syntheticSubItems.length > 0) {
      diceRollerRef.current?.addRoll({ _optimistic: true, _optId: optId, subItems: syntheticSubItems, tags: syntheticTags, rollUser: displayName || rollText, ...rollMeta });
    }
    try {
      const rollData = await postRoll(rollText, displayName || rollText);
      handleRollResult({ ...rollData, ...rollMeta }, optId);
    } catch (err) {
      console.error('Trait roll failed:', err);
    }
  };

  // Roll handler for a player acting on their own character.
  // Routes through POST /api/room/:gmUid/roll (validated server-side, real dice).
  // GM preview mode uses the GM roll route (null gmUid → /api/room/my/roll).
  const handlePlayerOwnRoll = async (rollText, displayName, rollMeta = {}) => {
    dismissAllHoverCards();
    const { items: syntheticSubItems, tags: syntheticTags } = rollTextToSyntheticSubItems(rollText);
    const optId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // In player mode use playerDiceRollerRef; in GM preview mode use diceRollerRef
    const diceRef = isPlayer ? playerDiceRollerRef : diceRollerRef;
    if (syntheticSubItems.length > 0) {
      const optimisticRoll = { _optimistic: true, _optId: optId, _playerInitiated: true, subItems: syntheticSubItems, tags: syntheticTags, rollUser: displayName || rollText, ...rollMeta };
      diceRef.current?.addRoll(optimisticRoll);
    }
    // Real player mode uses the player route; GM preview uses the GM route (null)
    const targetGmUid = (isPlayer && !previewAsPlayerEmail) ? gmUid : null;
    try {
      const rollData = await postRoll(rollText, displayName || rollText, targetGmUid, rollMeta);
      diceRef.current?.updateRoll(optId, { ...rollData, _playerInitiated: true, ...rollMeta });
      setDiceLog(prev => [...prev.slice(-49), { ...rollData, _logId: `${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
    } catch (err) {
      console.error('Player roll failed:', err);
    }
  };

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
        });
      } else if (item.kind === 'adversary-group') {
        const { baseElement, instances } = item;
        instances.forEach((inst, idx) => {
          targets.push({
            instanceId: inst.instanceId,
            name: instances.length > 1 ? `${baseElement.name} #${idx + 1}` : baseElement.name,
            type: 'adversary',
            thresholds: baseElement.hp_thresholds,
            maxHp: baseElement.hp_max ?? 0,
            currentHp: inst.currentHp ?? baseElement.hp_max ?? 0,
            currentStress: inst.currentStress ?? 0,
            maxStress: baseElement.stress_max ?? 0,
          });
        });
      }
    }
    return targets;
  }, [consolidatedElements]);

  // Deduplicate actions by adversary id — same type only appears once in the board.
  const consolidatedMenu = useMemo(() => {
    const menu = { 'Passives': [], 'Reactions': [], 'Fear Actions': [], 'Actions': [] };
    const seenAdvIds = new Set();

    activeElements.forEach(element => {
      if (element.elementType === 'adversary') {
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
            return (
            <div
              key={el.instanceId}
              className={`rounded-lg border overflow-hidden group/char transition-colors ${isMyCharacter ? 'bg-green-950/30 border-green-700/50' : 'bg-sky-950/30'} ${hopePulsingId === el.instanceId ? 'border-amber-400 hope-pulse-anim' : isMyCharacter ? '' : 'border-sky-900/40'}`}
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
              <div
                className={`p-2 space-y-1.5 rounded-b-lg transition-colors
                  ${damagePulsingId === el.instanceId ? 'damage-pulse-anim' : ''}`}
              >
                {/* Hope track */}
                {(() => { const maxHope = el.maxHope ?? 6; return maxHope > 0 && (
                  <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Hope', top: r.top, bottom: r.bottom, side: 'left' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                    <Sparkles size={10} className="text-amber-400 shrink-0" />
                    <CheckboxTrack
                      total={maxHope}
                      filled={el.hope ?? maxHope}
                      onSetFilled={isAssigned ? (h) => updateActiveElement(el.instanceId, { hope: h }) : undefined}
                      fillColor="bg-amber-400"
                      label="Hope"
                      verbs={['Gain', 'Spend']}
                    />
                  </div>
                ); })()}
                {/* Evasion + Damage Thresholds */}
                {(el.evasion != null || el.armorThresholds) && (
                  <div className="flex items-center gap-1.5 flex-wrap ml-[14px]">
                    {el.evasion != null && (
                      <span className="text-[10px] font-bold text-cyan-400/70 bg-cyan-900/50 border border-cyan-800/50 rounded px-1">
                        EVA {el.evasion}
                      </span>
                    )}
                    {(() => { const t = effectiveThresholds(el); return t && (
                      <span className="text-[10px] text-slate-400">
                        Thresholds <span className="font-bold text-yellow-300">{t.major}</span>
                        <span className="text-slate-600"> / </span>
                        <span className="font-bold text-red-300">{t.severe}</span>
                      </span>
                    ); })()}
                  </div>
                )}
                {/* Armor track */}
                {(el.maxArmor || 0) > 0 && (
                  <div className="flex items-center gap-1" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Armor', top: r.top, bottom: r.bottom, side: 'left' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                    <Shield size={10} className="text-cyan-500 shrink-0" />
                    <CheckboxTrack
                      total={el.maxArmor || 0}
                      filled={el.currentArmor || 0}
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
                      onSetFilled={isAssigned ? (s) => updateActiveElement(el.instanceId, { currentStress: s }) : undefined}
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
                            triggerFearPulse();
                          }
                          if (canRoll) handleRoll(feature);
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
        {/* Whiteboard — self-managing; relative so the DiceRoller overlay anchors here */}
        <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col relative">
          <DiceRoller
            ref={isPlayer ? playerDiceRollerRef : diceRollerRef}
            isPlayer={isPlayer}
            onComplete={isPlayer
              ? (roll) => {
                  // Clean up SSE rolls from the external queue; own rolls have no queue entry.
                  if (roll._rollId) setPlayerDiceRollQueue?.(prev => prev.filter(r => r._rollId !== roll._rollId));
                }
              : handleDiceRollComplete
            }
            targets={isPlayer ? [] : damageTargets}
            onApplyDamage={isPlayer ? undefined : handleApplyDamage}
            canApplyDamage={!isPlayer}
            onLuckyReroll={isPlayer ? undefined : handleLuckyReroll}
            onQuickTarget={isPlayer ? undefined : handleQuickTarget}
            onDoubledUpTarget={isPlayer ? undefined : handleDoubledUpTarget}
            onBouncingTarget={isPlayer ? undefined : handleBouncingTarget}
            wizardsWithHope={isPlayer ? [] : wizardsWithHope}
            onNotThisTime={isPlayer ? undefined : handleNotThisTime}
          />
          <BattleMap
            gmUid={gmUid}
            user={user}
            isPlayer={isPlayer}
            activeElements={activeElements}
            updateActiveElement={updateActiveElement}
            mapConfig={mapConfig}
            onMapConfigChange={onMapConfigChange}
            className="flex-1 min-h-0"
          />
        </div>
        {/* Dice log footer — collapsed title bar; click to open overlay with roll history */}
        <DiceLog rolls={diceLog} />
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
              title="Start Session — refresh session-use features for all characters"
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
          <div
            className={`rounded-lg border px-2.5 py-2 transition-colors ${fearPulsing ? 'border-purple-500 bg-purple-950/60' : 'border-slate-700 bg-slate-900'} ${fearPulsing ? 'fear-pulse-anim' : ''}`}
          >
            <div className="flex items-center gap-1.5 mb-1.5" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Fear', top: r.top, bottom: r.bottom, side: 'right' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
              <Flame size={12} className={`shrink-0 transition-colors ${fearPulsing ? 'text-purple-300' : 'text-purple-500'}`} />
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
                        className={`space-y-1 rounded transition-colors
                          ${damagePulsingId === inst.instanceId ? 'damage-pulse-anim' : ''}`}
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
            <div className={`rounded-lg border px-2.5 py-2 transition-colors ${fearPulsing ? 'border-purple-500 bg-purple-950/60 fear-pulse-anim' : 'border-slate-700 bg-slate-900'}`}>
              <div className="flex items-center gap-1.5 mb-1.5" onMouseEnter={(e) => { if (!isTouch) { const r = e.currentTarget.getBoundingClientRect(); setHoveredTrackTooltip({ label: 'Fear', top: r.top, bottom: r.bottom, side: 'right' }); } }} onMouseLeave={() => { if (!isTouch) setHoveredTrackTooltip(null); }}>
                <Flame size={12} className={`shrink-0 transition-colors ${fearPulsing ? 'text-purple-300' : 'text-purple-500'}`} />
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

          {/* Damaged adversaries */}
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
                    return hpDamage > 0 || stressDamage > 0;
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
                    onRollAttack={(data) => handleCardRoll(data, liveBaseElement.name)}
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
              onRollAttack={(data) => handleCardRoll(data, potAdvOverlay.data.element.name)}
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
                  onRollAttack={(data) => handleCardRoll(data, el.name)}
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
      return (
        <div
          ref={characterOverlay.overlayRef}
          className="fixed z-[55] flex flex-col"
          style={{
            left: 'calc(14rem)',
            paddingLeft: '8px',
            top: 90,
            width: 'calc(22rem + 8px)',
            height: 'calc(100dvh - 98px)',
          }}
          {...characterOverlay.overlayHandlers}
        >
          {(() => {
            const isMyCharacter = playerEmail != null && liveEl.assignedPlayerEmail === playerEmail;
            const allowInteract = !isPlayer || isMyCharacter;
            return (
              <CharacterHoverCard
                el={liveEl}
                updateFn={allowInteract ? updateActiveElement : undefined}
                onResync={(isMyCharacter || !isPlayer) && liveEl.daggerstackUrl ? () => handleResyncCharacter(liveEl) : null}
                isSyncing={resyncingCharId === liveEl.instanceId}
                onRoll={allowInteract ? (!isPlayer ? handleTraitRoll : handlePlayerOwnRoll) : undefined}
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
              />
            );
          })()}
        </div>
      );
    })()}

      </div>{/* end flex-1 flex overflow-hidden */}
    </div>
  );
}
