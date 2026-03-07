import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Zap, Trash2, Monitor, Dices, ChevronDown, ChevronRight, X, Plus, Camera, SlidersHorizontal, Swords, Heart, AlertCircle, Tag, Flame, Edit } from 'lucide-react';
import { RolzRoomLog } from './RolzRoomLog.jsx';
import { parseFeatureCategory, parseAllCountdownValues, generateId } from '../lib/helpers.js';
import { FeatureDescription } from './FeatureDescription.jsx';
import { EnvironmentCardContent, AdversaryCardContent, CheckboxTrack } from './DetailCardContent.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { ItemPickerModal } from './modals/ItemPickerModal.jsx';
import { postRolzRoll } from '../lib/api.js';
import { isOwnItem } from '../lib/constants.js';
import { computeBattlePoints, computeAutoModifiers, computeTotalBudgetMod } from '../lib/battle-points.js';
import { getUnscaledAdversary } from '../lib/adversary-defaults.js';

const USER_MOD_OPTIONS = [
  { key: 'lessDifficult',     label: 'Less difficult / shorter fight',  value: -1 },
  { key: 'damageBoostD4',     label: '+1d4 damage to all adversaries',  value: -2, exclusive: 'damageBoost' },
  { key: 'damageBoostStatic', label: '+2 damage to all adversaries',    value: -2, exclusive: 'damageBoost' },
  { key: 'moreDangerous',     label: 'More dangerous / longer fight',   value: +2 },
];

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
  return `${sourceName} ${name} [d20${modStr}] damage [${damage} ${(trait || 'phy').toLowerCase()}] ${range}`;
}

function extractIframeSrc(embedCode) {
  try {
    const match = embedCode.match(/\bsrc=["']([^"']+)["']/i);
    if (match && match[1].startsWith('https://')) return match[1];
  } catch (_) {}
  return null;
}

function ConfigSummary({ iframeSrc, rolzRoomName, rolzUsername }) {
  const parts = [];
  if (iframeSrc) parts.push('Zoom');
  if (rolzRoomName) parts.push(rolzUsername ? `Rolz: ${rolzRoomName} (${rolzUsername})` : `Rolz: ${rolzRoomName}`);
  return parts.length > 0
    ? <span className="text-slate-500 text-xs ml-2">{parts.join(' · ')}</span>
    : <span className="text-slate-600 text-xs ml-2 italic">Not configured</span>;
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


// Strip runtime tracking fields to get the base item data for form editing.
function getItemData(element) {
  const { instanceId, elementType, currentHp, currentStress, conditions, ...rest } = element;
  return rest;
}

const COLLECTION_TO_ELEMENT_TYPE = { adversaries: 'adversary', environments: 'environment' };

export function GMTableView({ activeElements, updateActiveElement, removeActiveElement, updateActiveElementsBaseData, data, saveItem, saveImage, addToTable, onMergeAdversary, whiteboardEmbed, setWhiteboardEmbed, rolzRoomName, setRolzRoomName, rolzUsername, setRolzUsername, rolzPassword, setRolzPassword, route, navigate, featureCountdowns = {}, updateCountdown, partySize = 4, setPartySize, tableBattleMods, setTableBattleMods, fearCount = 0, setFearCount, ensureScenesLoaded, ensureAdventuresLoaded, clearTable }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [modalOpen, setModalOpen] = useState(null); // null | 'adversaries' | 'environments' | 'scenes'

  // Embed config state (was WhiteboardTab)
  const [embedDraft, setEmbedDraft] = useState(whiteboardEmbed);
  const [roomNameDraft, setRoomNameDraft] = useState(rolzRoomName);
  const [usernameDraft, setUsernameDraft] = useState(rolzUsername);
  const [passwordDraft, setPasswordDraft] = useState(rolzPassword);
  const [configOpen, setConfigOpen] = useState(!whiteboardEmbed && !rolzRoomName);
  const [nudgeHint, setNudgeHint] = useState(false);

  useEffect(() => {
    setEmbedDraft(whiteboardEmbed);
    setRoomNameDraft(rolzRoomName);
    setUsernameDraft(rolzUsername);
    setPasswordDraft(rolzPassword);
    setConfigOpen(prev => (whiteboardEmbed || rolzRoomName) ? false : prev);
  }, [whiteboardEmbed, rolzRoomName, rolzUsername, rolzPassword]);

  const iframeSrc = extractIframeSrc(whiteboardEmbed);

  const handleSaveConfig = () => {
    setWhiteboardEmbed(embedDraft.trim());
    setRolzRoomName(roomNameDraft.trim());
    setRolzUsername(usernameDraft.trim());
    setRolzPassword(passwordDraft);
    if (embedDraft.trim() || roomNameDraft.trim()) setConfigOpen(false);
  };

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
  const [showStripLegend, setShowStripLegend] = useState(false);
  const [rolledKey, setRolledKey] = useState(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [factorsOpen, setFactorsOpen] = useState(false);
  const factorsPanelRef = useRef(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef(null);
  const overlayScrollRef = useRef(null);
  // editState: null | { step: 'choice', baseElement, instances, collection }
  //                  | { step: 'form', item, collection, mode, baseElement, instances }
  const [editState, setEditState] = useState(null);
  const [scaledToggleState, setScaledToggleState] = useState({});
  const [hoveredTrackerGroup, setHoveredTrackerGroup] = useState(null); // { baseElement, instances, top, bottom }
  const trackerOverlayRef = useRef(null);
  const trackerGroupIdRef = useRef(null);
  const [trackerAdjust, setTrackerAdjust] = useState(0); // px to shift overlay so it stays in viewport
  const trackerHideTimerRef = useRef(null);
  const showTrackerGroup = (item, e) => {
    if (trackerHideTimerRef.current) { clearTimeout(trackerHideTimerRef.current); trackerHideTimerRef.current = null; }
    const rect = e.currentTarget.getBoundingClientRect();
    if (item.kind === 'environment') {
      setHoveredTrackerGroup({ kind: 'environment', element: item.element, top: rect.top, bottom: rect.bottom });
    } else {
      setHoveredTrackerGroup({ kind: 'adversary', baseElement: item.baseElement, instances: item.instances, top: rect.top, bottom: rect.bottom });
    }
  };
  const scheduleHideTracker = () => {
    trackerHideTimerRef.current = setTimeout(() => { setHoveredTrackerGroup(null); trackerHideTimerRef.current = null; }, 120);
  };
  const cancelHideTracker = () => {
    if (trackerHideTimerRef.current) { clearTimeout(trackerHideTimerRef.current); trackerHideTimerRef.current = null; }
  };
  const [showGmMovesOverlay, setShowGmMovesOverlay] = useState(false);
  const gmMovesHideTimerRef = useRef(null);
  const showGmMoves = () => {
    if (gmMovesHideTimerRef.current) { clearTimeout(gmMovesHideTimerRef.current); gmMovesHideTimerRef.current = null; }
    setShowGmMovesOverlay(true);
  };
  const scheduleHideGmMoves = () => {
    gmMovesHideTimerRef.current = setTimeout(() => { setShowGmMovesOverlay(false); gmMovesHideTimerRef.current = null; }, 150);
  };
  const cancelHideGmMoves = () => {
    if (gmMovesHideTimerRef.current) { clearTimeout(gmMovesHideTimerRef.current); gmMovesHideTimerRef.current = null; }
  };
  const [openConditions, setOpenConditions] = useState(() => new Set()); // instanceIds with conditions input open
  const [fearPulsing, setFearPulsing] = useState(false);
  const fearPulseTimerRef = useRef(null);
  const triggerFearPulse = () => {
    if (fearPulseTimerRef.current) clearTimeout(fearPulseTimerRef.current);
    setFearPulsing(false);
    requestAnimationFrame(() => {
      setFearPulsing(true);
      fearPulseTimerRef.current = setTimeout(() => setFearPulsing(false), 700);
    });
  };
  const [collapsedSections, setCollapsedSections] = useState(() =>
    new Set(activeElements.length > 0 ? ['Defaults'] : [])
  );
  const toggleSection = (name) => setCollapsedSections(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  // Close factors panel on outside click
  useEffect(() => {
    if (!factorsOpen) return;
    const handler = (e) => {
      if (factorsPanelRef.current && !factorsPanelRef.current.contains(e.target)) {
        setFactorsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [factorsOpen]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addMenuOpen]);

  // Clamp tracker hover overlay to stay within the viewport.
  useLayoutEffect(() => {
    if (!hoveredTrackerGroup || !trackerOverlayRef.current) {
      trackerGroupIdRef.current = null;
      if (trackerAdjust !== 0) setTrackerAdjust(0);
      return;
    }
    const groupId = hoveredTrackerGroup.kind === 'environment' ? hoveredTrackerGroup.element.instanceId : hoveredTrackerGroup.baseElement.id;
    if (trackerGroupIdRef.current !== groupId) {
      // New group: record it and reset adjustment so we measure from scratch.
      trackerGroupIdRef.current = groupId;
      if (trackerAdjust !== 0) { setTrackerAdjust(0); return; }
      // adj already 0 — fall through to measure immediately
    } else if (trackerAdjust !== 0) {
      // Already clamped for this group; don't re-measure.
      return;
    }
    const rect = trackerOverlayRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.top < 8) setTrackerAdjust(8 - rect.top);
    else if (rect.bottom > vh - 8) setTrackerAdjust(vh - 8 - rect.bottom);
  }, [hoveredTrackerGroup, trackerAdjust]);

  useEffect(() => {
    if (!showGmMovesOverlay) {
      setHoveredFeature(null);
      setHoveredDefaultMove(null);
      setHoveredCompactTooltip(null);
    }
  }, [showGmMovesOverlay]);

  const DEFAULT_BATTLE_MODS = { lessDifficult: false, damageBoostD4: false, damageBoostStatic: false, moreDangerous: false };
  const effectiveMods = tableBattleMods || DEFAULT_BATTLE_MODS;

  const updateTableMod = (key) => {
    if (!setTableBattleMods) return;
    const opt = USER_MOD_OPTIONS.find(o => o.key === key);
    setTableBattleMods(prev => {
      const next = { ...(prev || DEFAULT_BATTLE_MODS), [key]: !(prev?.[key]) };
      // Mutually exclusive damage boosts
      if (opt?.exclusive === 'damageBoost' && next[key]) {
        if (key === 'damageBoostD4') next.damageBoostStatic = false;
        if (key === 'damageBoostStatic') next.damageBoostD4 = false;
      }
      return next;
    });
  };

  const tableDamageBoost = effectiveMods.damageBoostD4 ? 'd4' : effectiveMods.damageBoostStatic ? 'static' : null;

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
      navigate('/gm-table', { replace: true });
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
    navigate('/gm-table', { replace: true });
  };

  const handleEditClick = (instances, baseElement, collection) => {
    navigate(`/gm-table/${collection}/${baseElement.id}`);
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
      updateActiveElementsBaseData(el => el.id === itemWithId.id, itemWithId);
    }
  };

  const [pendingRolls, setPendingRolls] = useState([]);

  const rolzConfigured = !!(rolzRoomName && rolzUsername && rolzPassword);

  const addPendingRoll = (displayName, rollText) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const addedAt = Date.now();
    setPendingRolls(prev => [...prev, { id, displayName, rollText, addedAt }]);
    // Auto-expire after eager window + buffer
    const t = setTimeout(() => {
      setPendingRolls(prev => prev.filter(p => p.id !== id));
    }, 17000);
    return { id, cleanup: () => clearTimeout(t) };
  };

  const removePendingRoll = (id) => {
    setPendingRolls(prev => prev.filter(p => p.id !== id));
  };

  const handleRoll = async (feature) => {
    if (!feature._rollData && !feature._diceRoll) return;
    if (!rolzConfigured) {
      setConfigOpen(true);
      setNudgeHint(true);
      setTimeout(() => setNudgeHint(false), 6000);
      return;
    }
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
        parts.push(`damage [${attackDamage} ${(attackTrait || '').toLowerCase()}]`);
        if (attackRange) parts.push(attackRange);
      }
      patterns.forEach(p => parts.push(`[${p}]`));
      rollText = parts.join(' ');
    }
    const displayName = `${feature.sourceName} ${feature.name}`;
    const key = `${feature.cardKey}|${feature.featureKey}`;
    const { id: pendingId, cleanup } = addPendingRoll(displayName, rollText);
    try {
      await postRolzRoll(rolzRoomName, rollText, rolzUsername, rolzPassword);
      setRolledKey(key);
      setTimeout(() => setRolledKey(prev => prev === key ? null : prev), 1500);
    } catch (err) {
      cleanup();
      removePendingRoll(pendingId);
      console.error('Rolz roll failed:', err);
    }
  };

  const handleCardRoll = async (attackData, sourceName) => {
    if (!rolzConfigured) return;
    const { name, modifier, range, damage, trait } = attackData;
    const rollText = buildAttackRollText(name, modifier, range, damage, trait, sourceName);
    const displayName = `${sourceName} ${name}`;
    const { id: pendingId, cleanup } = addPendingRoll(displayName, rollText);
    try {
      await postRolzRoll(rolzRoomName, rollText, rolzUsername, rolzPassword);
    } catch (err) {
      cleanup();
      removePendingRoll(pendingId);
      console.error('Rolz roll failed:', err);
    }
  };

  // Group adversaries of the same type (same id) into consolidated entries.
  // Environments remain as individual entries.
  const consolidatedElements = useMemo(() => {
    const result = [];
    const seenAdvKeys = {}; // key -> index in result

    activeElements.forEach(el => {
      if (el.elementType !== 'adversary') {
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
        if (key === hoveredFeature.cardKey) return item;
      } else {
        if (item.element.instanceId === hoveredFeature.cardKey) return item;
      }
    }
    return null;
  }, [hoveredFeature, consolidatedElements]);

  useEffect(() => {
    if (!hoveredFeature || !overlayScrollRef.current) return;
    const el = overlayScrollRef.current.querySelector(`[data-feature-key="${hoveredFeature.featureKey}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [hoveredFeature]);

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
        const includeAttack = /\bmakes?\b.*?\battack\b/i.test(feature.description || '');
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
    roleAndTierById[e.id] = { role: e.role || 'standard', tier: e.tier ?? 1 };
  });
  const tableAdvSummary = Object.entries(countById).map(([id, count]) => ({
    ...roleAndTierById[id], count,
  }));
  const tableBP = computeBattlePoints(tableAdvSummary, partySize);
  const tableBudget = 3 * partySize + 2;
  const tableAutoMods = computeAutoModifiers(tableAdvSummary, tableAdvSummary.length > 0 ? Math.max(...tableAdvSummary.map(a => a.tier ?? 1)) : null);
  const totalMod = computeTotalBudgetMod(tableAutoMods, effectiveMods);
  const adjustedBudget = tableBudget + totalMod;
  const tableDiff = tableBP - adjustedBudget;
  const tableDiffColor = tableDiff > 0 ? 'text-red-400' : tableDiff < 0 ? 'text-emerald-400' : 'text-slate-400';
  const activeAutoMods = Object.values(tableAutoMods).filter(m => m.active);
  const hasAnyActiveMods = activeAutoMods.length > 0 || USER_MOD_OPTIONS.some(o => effectiveMods[o.key]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Adversary Tracker Panel */}
      <div className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col overflow-y-auto shrink-0">
        <div className="p-3 bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
          <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2 text-sm">
            <Swords size={15} className="text-red-400" /> Tracker
          </h2>
        </div>

        {/* Fear tracker */}
        <div className="px-2 pt-2 pb-1 sticky top-[41px] z-10 bg-slate-950 border-b border-slate-800">
          <div
            className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 transition-colors ${fearPulsing ? 'border-amber-500 bg-amber-950/60' : 'border-slate-700 bg-slate-900'} ${fearPulsing ? 'fear-pulse-anim' : ''}`}
          >
            <Flame size={14} className={`shrink-0 transition-colors ${fearPulsing ? 'text-amber-300' : 'text-amber-500'}`} />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex-1">Fear</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFearCount && setFearCount(prev => Math.max(0, prev - 1))}
                className="w-5 h-5 rounded bg-slate-700 hover:bg-red-900 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
              >−</button>
              <span className={`min-w-[1.5rem] text-center font-bold text-base tabular-nums transition-colors ${fearPulsing ? 'text-amber-200' : fearCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                {fearCount}
              </span>
              <button
                onClick={() => setFearCount && setFearCount(prev => Math.min(12, prev + 1))}
                className="w-5 h-5 rounded bg-slate-700 hover:bg-green-900 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
              >+</button>
            </div>
          </div>
        </div>

        {/* GM Moves hover trigger */}
        <div className="px-2 pb-1 sticky top-[85px] z-10 bg-slate-950 border-b border-slate-800">
          <div
            className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 transition-colors cursor-default ${showGmMovesOverlay ? 'border-yellow-600/60 bg-yellow-950/30' : 'border-slate-700 bg-slate-900 hover:border-yellow-600/40'}`}
            onMouseEnter={showGmMoves}
            onMouseLeave={scheduleHideGmMoves}
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
          {/* + Add menu */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen(p => !p)}
              className={`w-full rounded-lg border border-dashed px-2.5 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${addMenuOpen ? 'border-slate-500 bg-slate-800/60' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'}`}
            >
              <Plus size={12} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-400">Add</span>
            </button>
            {addMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
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

          {consolidatedElements.filter(item => item.kind === 'environment').map((item) => {
            const el = item.element;
            return (
              <div
                key={el.instanceId}
                className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 overflow-hidden group/env"
                onMouseEnter={(e) => showTrackerGroup(item, e)}
                onMouseLeave={scheduleHideTracker}
              >
                <div className="px-2.5 py-1.5 flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-emerald-300/80 truncate flex-1">{el.name}</span>
                  <button
                    onClick={() => { removeActiveElement(el.instanceId); setHoveredTrackerGroup(null); }}
                    className="hidden group-hover/env:block text-slate-600 hover:text-red-400 transition-colors shrink-0"
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
                onMouseEnter={(e) => showTrackerGroup(item, e)}
                onMouseLeave={scheduleHideTracker}
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
                            setHoveredTrackerGroup(null);
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
                <div className="p-2 space-y-2">
                  {instances.map((inst, idx) => {
                    const hpDamage = (displayEl.hp_max || 0) - (inst.currentHp ?? displayEl.hp_max ?? 0);
                    return (
                      <div key={inst.instanceId} className="space-y-1">
                        {count > 1 && (
                          <span className="text-[10px] text-slate-600 font-medium">#{idx + 1}</span>
                        )}
                        {(displayEl.hp_max || 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <Heart size={10} className="text-red-500 shrink-0" />
                            <CheckboxTrack
                              total={displayEl.hp_max || 0}
                              filled={hpDamage}
                              onSetFilled={(dmg) => updateActiveElement(inst.instanceId, { currentHp: (displayEl.hp_max || 0) - dmg })}
                              fillColor="bg-red-500"
                            />
                            {(displayEl.stress_max || 0) === 0 && !inst.conditions && !openConditions.has(inst.instanceId) && (
                              <button
                                onClick={() => setOpenConditions(prev => new Set([...prev, inst.instanceId]))}
                                className="ml-1 text-slate-700 hover:text-slate-400 transition-colors shrink-0"
                                title="Add conditions"
                              ><Tag size={10} /></button>
                            )}
                          </div>
                        )}
                        {(displayEl.stress_max || 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertCircle size={10} className="text-purple-500 shrink-0" />
                            <CheckboxTrack
                              total={displayEl.stress_max || 0}
                              filled={inst.currentStress || 0}
                              onSetFilled={(s) => updateActiveElement(inst.instanceId, { currentStress: s })}
                              fillColor="bg-purple-500"
                            />
                            {!inst.conditions && !openConditions.has(inst.instanceId) && (
                              <button
                                onClick={() => setOpenConditions(prev => new Set([...prev, inst.instanceId]))}
                                className="ml-1 text-slate-700 hover:text-slate-400 transition-colors shrink-0"
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
      </div>

      {/* GM Moves hover overlay */}
      {showGmMovesOverlay && (
      <div
        className="fixed z-[55] bg-slate-900 border border-slate-600 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ left: 'calc(14rem + 8px)', top: '8px', width: '20rem', maxHeight: 'calc(100vh - 16px)' }}
        onMouseEnter={cancelHideGmMoves}
        onMouseLeave={() => { setShowGmMovesOverlay(false); if (gmMovesHideTimerRef.current) { clearTimeout(gmMovesHideTimerRef.current); gmMovesHideTimerRef.current = null; } }}
      >
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
                          setHoveredFeature({ cardKey: feature.cardKey, featureKey: feature.featureKey });
                          if (feature._isRoleMove || feature.featureKey === 'attack') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCompactTooltip({ description: feature.description, top: rect.top, bottom: rect.bottom });
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredFeature(null);
                          if (feature._isRoleMove || feature.featureKey === 'attack') setHoveredCompactTooltip(null);
                        }}
                        onClick={(category === 'Fear Actions' || canRoll) ? () => {
                          if (category === 'Fear Actions') {
                            if (setFearCount) setFearCount(prev => Math.max(0, prev - parseFearCost(feature.description)));
                            triggerFearPulse();
                          }
                          if (canRoll) handleRoll(feature);
                        } : undefined}
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
                                <Dices size={11} className={`shrink-0 ${justRolled ? 'text-green-400' : rolzConfigured ? 'text-slate-500 group-hover:text-red-400 transition-colors' : 'text-slate-600 group-hover:text-amber-400 transition-colors'}`} />
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
                  onMouseEnter={() => setShowStripLegend(true)}
                  onMouseLeave={() => setShowStripLegend(false)}
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
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDefaultMove({ ...move, top: rect.top, bottom: rect.bottom });
                      }}
                      onMouseLeave={() => setHoveredDefaultMove(null)}
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
      )}

      {/* Center Column: combined toolbar + player view content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-950">
        {/* Combined toolbar */}
        <div className="bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center px-4 py-2 gap-3">
            {/* BP display (left) */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {tableBP > 0 && (
                <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <span className="text-slate-300">
                    <span className="font-bold text-white tabular-nums">{tableBP}</span>
                    <span className="text-slate-500"> BP</span>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-300 flex items-baseline gap-1">
                    Budget{' '}
                    <span className="font-bold text-white tabular-nums">{adjustedBudget}</span>
                    <span className={`text-xs tabular-nums ${totalMod === 0 ? 'invisible' : totalMod < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      ({totalMod > 0 ? `+${totalMod}` : totalMod})
                    </span>
                  </span>
                  <span className={`text-xs font-semibold ${tableDiffColor}`}>
                    {tableDiff === 0 ? 'On budget' : tableDiff > 0 ? `+${tableDiff} over` : `${Math.abs(tableDiff)} under`}
                  </span>
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-[10px] text-slate-500">PCs</span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={partySize}
                      onChange={e => setPartySize && setPartySize(Math.max(1, Math.min(8, parseInt(e.target.value) || 4)))}
                      className="w-10 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white text-xs text-center"
                    />
                  </div>
                  <div className="relative" ref={factorsPanelRef}>
                    <button
                      onClick={() => setFactorsOpen(p => !p)}
                      title="Budget Factors"
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${hasAnyActiveMods ? 'bg-amber-900/60 text-amber-300 hover:bg-amber-900' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <SlidersHorizontal size={12} />
                      {hasAnyActiveMods && <span>Factors</span>}
                    </button>
                    {factorsOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 w-72 space-y-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Budget Factors</p>
                        {activeAutoMods.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Auto-detected</p>
                            {activeAutoMods.map(m => (
                              <div key={m.label} className="flex items-center justify-between text-xs">
                                <span className="text-slate-300">{m.label}</span>
                                <span className={`font-mono font-semibold ${m.value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {m.value > 0 ? `+${m.value}` : m.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Your choices</p>
                          {USER_MOD_OPTIONS.map(opt => (
                            <label key={opt.key} className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={!!effectiveMods[opt.key]}
                                onChange={() => updateTableMod(opt.key)}
                                className="rounded border-slate-500 bg-slate-700 accent-amber-500"
                              />
                              <span className="flex-1 text-xs text-slate-300 group-hover:text-white transition-colors">{opt.label}</span>
                              <span className={`font-mono text-xs font-semibold ${opt.value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {opt.value > 0 ? `+${opt.value}` : opt.value}
                              </span>
                            </label>
                          ))}
                        </div>
                        {tableDamageBoost && (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1">
                            <Zap size={10} /> Damage boost active on all adversaries
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions (right) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCaptureOpen(true)}
                disabled={activeElements.length === 0}
                title="Save current table as a Scene"
                className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs rounded px-2.5 py-1.5 text-slate-300 hover:text-white outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Camera size={13} /> Capture
              </button>
              <button
                onClick={() => {
                  if (!window.confirm('Clear all adversaries and environments from the table? This cannot be undone.')) return;
                  clearTable?.();
                }}
                disabled={activeElements.length === 0}
                title="Remove all items from the table"
                className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 hover:border-red-600 text-xs rounded px-2.5 py-1.5 text-slate-300 hover:text-red-400 outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={13} /> Clear
              </button>
              <div className="w-px h-5 bg-slate-700 mx-1" />
              <button
                onClick={() => setConfigOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                {configOpen
                  ? <ChevronDown size={13} className="text-slate-500" />
                  : <ChevronRight size={13} className="text-slate-500" />
                }
                <span className="font-semibold uppercase tracking-wider text-[11px]">Embeds</span>
                {!configOpen && <ConfigSummary iframeSrc={iframeSrc} rolzRoomName={rolzRoomName} rolzUsername={rolzUsername} />}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible embed config panel */}
        {configOpen && (
          <div className="shrink-0 border-b border-slate-800 px-5 pb-4 pt-3 grid grid-cols-[1fr,auto] gap-x-6 gap-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Monitor size={12} /> Zoom Whiteboard
              </label>
              <textarea
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-blue-500 resize-none h-16"
                placeholder='Paste your <iframe ...> embed code here'
                value={embedDraft}
                onChange={(e) => setEmbedDraft(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-[20rem]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Dices size={12} className="text-red-400" /> Rolz Dice Room
              </label>
              <input
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                placeholder="Room name"
                value={roomNameDraft}
                onChange={(e) => setRoomNameDraft(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  placeholder="Rolz username"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  autoComplete="username"
                />
                <input
                  type="password"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  placeholder="Rolz password"
                  value={passwordDraft}
                  onChange={(e) => setPasswordDraft(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Enter your <a href="https://rolz.org/table/login" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Rolz.org</a> credentials. In your dice room, type <code className="text-slate-400 bg-slate-800 px-1 rounded">/room api=on</code> to enable posting.
              </p>
            </div>
            {nudgeHint && (
              <div className="col-span-2 flex items-start gap-2 bg-amber-900/30 border border-amber-600/50 rounded-lg px-3 py-2 text-amber-300 text-xs">
                <Dices size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>Enter your <strong>Rolz username and password</strong> and click <strong>Save</strong> to enable dice rolling from the GM Moves. Make sure to type <code className="bg-amber-900/50 px-1 rounded">/room api=on</code> in your Rolz room first.</span>
              </div>
            )}
            <div className="col-span-2 flex justify-end">
              <button
                onClick={handleSaveConfig}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Whiteboard content */}
        <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
          {iframeSrc ? (
            <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <iframe
                src={iframeSrc}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                allowFullScreen
                title="Zoom Whiteboard"
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
              <Monitor size={32} className="opacity-40" />
              <p className="text-sm">Configure a Zoom whiteboard embed above.</p>
            </div>
          )}
        </div>
      </div>

      {/* Persistent Dice Room Log — always visible when configured */}
      {rolzRoomName && (
        <div className="w-80 border-l border-slate-800 flex flex-col overflow-hidden shrink-0">
          <RolzRoomLog roomName={rolzRoomName} pendingRolls={pendingRolls} />
        </div>
      )}

    {modalOpen && (
      <ItemPickerModal
        collection={modalOpen}
        data={data}
        onClose={() => setModalOpen(null)}
        onSelect={(item) => {
          addToTable(item, modalOpen);
        }}
        isLoading={['scenes', 'adventures'].includes(modalOpen) ? pickerLoading : undefined}
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
            updateActiveElementsBaseData(el => el.id === itemWithId.id, itemWithId);
          }
        }}
        onClose={closeEditModal}
        partySize={partySize}
        onPartySizeChange={setPartySize}
        onMergeAdversary={onMergeAdversary}
      />
    )}

    {/* Hover overlay for tracker panel (adversary or environment) */}
    {hoveredTrackerGroup && (
      <div
        ref={trackerOverlayRef}
        className="fixed z-[55]"
        style={{ left: 'calc(14rem + 12px)', top: (hoveredTrackerGroup.top + hoveredTrackerGroup.bottom) / 2 + trackerAdjust, transform: 'translateY(-50%)', width: '26rem', maxHeight: 'calc(100vh - 16px)' }}
        onMouseEnter={cancelHideTracker}
        onMouseLeave={() => setHoveredTrackerGroup(null)}
      >
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16px)' }}>
          <div className="p-5 relative">
            {hoveredTrackerGroup.kind === 'environment' ? (() => {
              const el = hoveredTrackerGroup.element;
              return (
                <>
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                    <button
                      onClick={() => { setHoveredTrackerGroup(null); handleEditClick([el], el, 'environments'); }}
                      className="p-1.5 rounded-lg bg-slate-800/90 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                      title="Edit"
                    ><Edit size={14} /></button>
                    <button
                      onClick={() => { removeActiveElement(el.instanceId); setHoveredTrackerGroup(null); }}
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
                  />
                </>
              );
            })() : (
              <>
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                  <button
                    onClick={() => { setHoveredTrackerGroup(null); handleEditClick(hoveredTrackerGroup.instances, hoveredTrackerGroup.baseElement, 'adversaries'); }}
                    className="p-1.5 rounded-lg bg-slate-800/90 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                    title="Edit"
                  ><Edit size={14} /></button>
                  <button
                    onClick={() => { removeGroup(hoveredTrackerGroup.instances); setHoveredTrackerGroup(null); }}
                    className="p-1.5 rounded-lg bg-slate-800/90 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                    title="Remove from table"
                  ><Trash2 size={14} /></button>
                </div>
                {hoveredTrackerGroup.baseElement.imageUrl && (
                  <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
                    <img src={hoveredTrackerGroup.baseElement.imageUrl} alt={hoveredTrackerGroup.baseElement.name} className="w-full h-full object-cover opacity-80" />
                  </div>
                )}
                <h3 className={`text-xl font-bold text-white mb-1 pr-20`}>
                  {hoveredTrackerGroup.baseElement.name}
                  {hoveredTrackerGroup.instances.length > 1 && (
                    <span className="text-slate-400 font-normal ml-1.5">×{hoveredTrackerGroup.instances.length}</span>
                  )}
                </h3>
                <AdversaryCardContent
                  element={hoveredTrackerGroup.baseElement}
                  hoveredFeature={null}
                  cardKey={hoveredTrackerGroup.baseElement.id}
                  count={hoveredTrackerGroup.instances.length}
                  instances={hoveredTrackerGroup.instances}
                  updateFn={() => {}}
                  showInstanceRemove={false}
                  featureCountdowns={featureCountdowns}
                  updateCountdown={null}
                  onRollAttack={null}
                  damageBoost={tableDamageBoost || hoveredTrackerGroup.baseElement._damageBoost || null}
                  scaledMeta={null}
                  onScaledToggle={null}
                />
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Hover overlay for default GM Moves — shown regardless of tab */}

    {hoveredDefaultMove && (
      <div
        className="fixed z-50 pointer-events-none"
        style={{ left: 'calc(34rem + 20px)', top: (hoveredDefaultMove.top + hoveredDefaultMove.bottom) / 2, transform: 'translateY(-50%)', width: '22rem' }}
      >
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-5">
          <p className="text-sm text-slate-300 italic leading-relaxed">{hoveredDefaultMove.example}</p>
        </div>
      </div>
    )}

    {/* Hover overlay for role moves and basic attacks — description shown on hover */}
    {hoveredCompactTooltip && (
      <div
        className="fixed z-[60] pointer-events-none"
        style={{ left: 'calc(34rem + 20px)', top: (hoveredCompactTooltip.top + hoveredCompactTooltip.bottom) / 2, transform: 'translateY(-50%)', width: '22rem' }}
      >
        <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-5">
          <p className="text-sm text-slate-300 leading-relaxed"><FeatureDescription description={hoveredCompactTooltip.description} /></p>
        </div>
      </div>
    )}

    {/* Hover overlay: shown when a GM Moves item is hovered */}
    {hoveredElement && (
      <div
        className="fixed z-50 pointer-events-none"
        style={{ left: 'calc(34rem + 20px)', top: '50%', transform: 'translateY(-50%)', width: '26rem', maxHeight: '80vh' }}
      >
        <div ref={overlayScrollRef} className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh]">
          {hoveredElement.kind === 'environment' ? (
            <div className="p-5 relative">
              {hoveredElement.element.imageUrl && (
                <div
                  className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl cursor-pointer"
                  onClick={() => setLightboxUrl(hoveredElement.element.imageUrl)}
                >
                  <img src={hoveredElement.element.imageUrl} alt={hoveredElement.element.name} className="w-full h-full object-cover opacity-80" />
                </div>
              )}
              <div>
                <h3 className={`text-xl font-bold text-white mb-1 ${hoveredElement.element.imageUrl ? 'pr-20' : ''}`}>{hoveredElement.element.name}</h3>
                <EnvironmentCardContent
                  element={hoveredElement.element}
                  hoveredFeature={hoveredFeature}
                  cardKey={hoveredElement.element.instanceId}
                  featureCountdowns={featureCountdowns}
                  updateCountdown={null}
                />
              </div>
            </div>
          ) : (() => {
            const el = hoveredElement.baseElement;
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
                  {hoveredElement.instances.length > 1 && (
                    <span className="text-slate-400 font-normal ml-1.5">×{hoveredElement.instances.length}</span>
                  )}
                </h3>
                <AdversaryCardContent
                  element={displayEl}
                  hoveredFeature={hoveredFeature}
                  cardKey={el.id}
                  count={hoveredElement.instances.length}
                  instances={hoveredElement.instances}
                  updateFn={() => {}}
                  showInstanceRemove={false}
                  featureCountdowns={featureCountdowns}
                  updateCountdown={null}
                  onRollAttack={null}
                  scaledMeta={scaledMeta}
                  onScaledToggle={() => setScaledToggleState(prev => ({ ...prev, [el.id]: !(prev[el.id] ?? true) }))}
                />
              </div>
            </div>
            );
          })()}
        </div>
      </div>
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
    </div>
  );
}
