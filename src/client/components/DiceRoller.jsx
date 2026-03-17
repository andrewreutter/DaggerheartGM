import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Info, Check, CheckCircle, AlertTriangle, RotateCcw, Shield, ChevronDown } from 'lucide-react';
import DiceBox from '@3d-dice/dice-box-threejs';
import { parseSubDetails as _parseSubDetails, extractDetailsValues } from '../lib/dice-utils.js';
import { rangeFtToLabel, RANGE_BANDS_FT } from '../lib/map-range.js';
import { formatTargetSummary } from '../lib/helpers.js';
import { weaponFeatures } from '../../features/registry.js';
import { wrapRoll } from '../../features/roll.js';

const SUPPORTED_SIDES = new Set([4, 6, 8, 10, 12, 20]);

// ── Daggerheart die color themes ────────────────────────────────────────────

const HOPE_COLORSET = {
  name: 'dh_hope',
  foreground: '#451a03',
  background: '#f59e0b',
  outline: '#b45309',
  texture: 'none',
  material: 'glass',
};

const FEAR_COLORSET = {
  name: 'dh_fear',
  foreground: '#ffffff',
  background: '#9333ea',
  outline: '#6b21a8',
  texture: 'none',
  material: 'glass',
};

const DAMAGE_COLORSET = {
  name: 'dh_damage',
  foreground: '#ffffff',
  background: '#dc2626',
  outline: '#991b1b',
  texture: 'none',
  material: 'glass',
};

const DEFAULT_COLORSET = {
  name: 'dh_default',
  foreground: '#1e293b',
  background: '#e2e8f0',
  outline: '#94a3b8',
  texture: 'none',
  material: 'glass',
};

function getColorsetForLabel(label) {
  const l = (label || '').toLowerCase();
  if (/hope/i.test(l))       return HOPE_COLORSET;
  if (/fear/i.test(l))       return FEAR_COLORSET;
  if (/damage|dmg/i.test(l)) return DAMAGE_COLORSET;
  return DEFAULT_COLORSET;
}

// ── Notation parsing helpers ────────────────────────────────────────────────

// Extended regex: NdS[kh|kl][!][mN][+/-M]
function parseDiceExpr(input) {
  if (!input) return null;
  const m = /^(\d*)d(\d+)(kh|kl)?(!)?(?:m(\d+))?([+-]\d+)?$/i.exec((input || '').trim());
  if (!m) return null;
  return {
    qty:      parseInt(m[1] || '1', 10),
    sides:    parseInt(m[2], 10),
    keep:     (m[3] || '').toLowerCase() || null, // 'kh', 'kl', or null
    exploding: !!m[4],
    minimum:  m[5] ? parseInt(m[5], 10) : null,
    modifier: m[6] ? parseInt(m[6], 10) : 0,
  };
}

// Parse the details string from a subItem. Returns { all, discarded }.
// kh/kl format: "(3->7)" or "(3,5->7)" → all=[3,7], discarded=[3]
// Normal/exploding: "(7)" or "(3+4)" → all=[7], discarded=[]
// Re-alias imported utility under the local name so existing call sites are unchanged.
const parseSubDetails = _parseSubDetails;

export function parseRollDice(subItems) {
  const groups = [];
  for (const sub of (subItems || [])) {
    const parsed = parseDiceExpr(sub.input);
    if (!parsed || !SUPPORTED_SIDES.has(parsed.sides)) continue;

    const total = parseInt(sub.result, 10) || 0;
    const { all: detailValues, discarded } = parseSubDetails(sub.details);

    let values = detailValues;
    if (!values && parsed.qty === 1) {
      const faceValue = total - parsed.modifier;
      if (faceValue >= 1 && faceValue <= parsed.sides) values = [faceValue];
    }

    groups.push({
      qty:      values ? values.length : parsed.qty, // actual dice for 3D animation
      sides:    parsed.sides,
      modifier: parsed.modifier,
      values,
      result:   total,
      label:    (sub.pre || '').trim(),
      keep:     parsed.keep,
      discarded,
    });
  }
  return groups;
}

// Build notation for a single group: "2d6@3,5" or "1d12@7"
function groupNotation(g) {
  const dice = `${g.qty}d${g.sides}`;
  if (g.values) return `${dice}@${g.values.join(',')}`;
  return dice;
}

const EXTRA_PRE_RE = /^\s*(Reload|Invigorate|Lifesteal)\s*$/i;

// Sum all non-damage sub-item results (fallback for generic rolls without a top-level total).
function computeActionTotal(subItems) {
  let total = 0;
  for (const sub of (subItems || [])) {
    if (/damage/i.test(sub.pre || '')) continue;
    if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
    const v = parseInt(sub.result, 10);
    if (!isNaN(v)) total += v;
  }
  return total;
}

// Extract a clean label for the banner from a sub-item's pre text.
// Hope/Fear dice get simplified to just "Hope" / "Fear".
function extractBannerLabel(pre) {
  const t = (pre || '').trim();
  if (/\bhope\b/i.test(t)) return 'Hope';
  if (/\bfear\b/i.test(t)) return 'Fear';
  return t;
}

// True when the roll input has no dice (e.g. "+3", "5", "-1"). Used to show static values without a spinner.
function isStaticDiceInput(input) {
  if (!input || typeof input !== 'string') return false;
  return !/\d*d\d+/i.test(input.trim());
}

// Parse a static numeric value from input. Returns number or null.
function parseStaticValue(input) {
  if (!input || typeof input !== 'string') return null;
  const t = input.trim();
  const m = /^([+-]?\d+)$/.exec(t);
  return m ? parseInt(m[1], 10) : null;
}

// Parse a dice sub-item into display parts: { notation, dieValue, discarded, modifier, total, type, keep }.
// Returns null if the input isn't a recognisable dice expression.
function parseDiceSub(sub) {
  if (!sub || !sub.input) return null;
  const parsed = parseDiceExpr(sub.input);
  if (!parsed) return null;
  const { modifier, keep } = parsed;
  const total = parseInt(sub.result, 10);

  const { all: detailValues, discarded } = parseSubDetails(sub.details);

  let dieValue = total - modifier;
  if (detailValues) {
    if (keep === 'kh') dieValue = Math.max(...detailValues);
    else if (keep === 'kl') dieValue = Math.min(...detailValues);
    else dieValue = detailValues.reduce((a, b) => a + b, 0);
  }

  // Notation: strip modifier for the notation label, keep kh/kl/!/mN suffixes.
  const notation = (sub.input || '').replace(/[+-]\d+$/, '');

  // Take first lowercase-only word from post as the damage type (e.g. "phy", "mag").
  const postWords = (sub.post || '').trim().split(/\s+/);
  const type = (postWords[0] && /^[a-z]+$/.test(postWords[0])) ? postWords[0] : '';

  return { notation, dieValue, discarded, modifier, total, type, keep };
}

// ── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ lg = false }) {
  const sz = lg ? 'w-5 h-5 border-2' : 'w-3 h-3 border-2';
  return (
    <span
      className={`inline-block ${sz} rounded-full border-current border-t-transparent animate-spin`}
      style={{ verticalAlign: lg ? '-4px' : '-2px' }}
    />
  );
}

// ── Banner slide-in hook ─────────────────────────────────────────────────────

function useBannerVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

// ── Result Banner ───────────────────────────────────────────────────────────

/**
 * Returns true when a feature tag is auto-applied (green style) based on the
 * feature registry. Replaces the old AUTOMATED_TAGS hardcoded set.
 */
function isTagAutomated(tagName) {
  return weaponFeatures[tagName]?.automated ?? false;
}

/**
 * Compute conditional banner status for a tag using the feature registry's
 * `bannerStatus(tag, roll)` hook. Replaces the old getConditionalTagStatus
 * switch-statement.
 */
function getConditionalTagStatus(tag, roll) {
  const feature = weaponFeatures[tag.name];
  if (feature?.bannerStatus) return feature.bannerStatus(tag, wrapRoll(roll));
  return null;
}

function ActionBanner({ roll, onAcknowledge, onCancel, disableDismiss, lifeSupportSelectedId, onLifeSupportSelect, makeASceneSelectedId, onMakeASceneSelect, makeASceneAdversaries = [], targets = [] }) {
  const visible = useBannerVisible();
  const displayName = roll.rollUser || roll.characterName || '';
  const lifeSupportTargets = roll._lifeSupportTargets;
  const isLifeSupport = lifeSupportTargets != null;
  const selectedLifeSupportInstanceId = lifeSupportSelectedId ?? null;

  // Make a Scene: use the always-current makeASceneAdversaries prop (safe for GM + player).
  const isMakeAScene = roll._featureName === 'Make a Scene' && roll._action;
  const makeASceneTargets = isMakeAScene ? makeASceneAdversaries : null;
  const selectedMakeASceneInstanceId = makeASceneSelectedId ?? null;
  const selectedMakeASceneName = makeASceneTargets?.find(t => t.instanceId === selectedMakeASceneInstanceId)?.name ?? null;
  const [makeASceneMenuRect, setMakeASceneMenuRect] = useState(null);

  const needsLifeSupportSelection = isLifeSupport && (lifeSupportTargets?.length ?? 0) > 0;
  const needsMakeASceneSelection = isMakeAScene && (makeASceneTargets?.length ?? 0) > 0;
  const canAcknowledge =
    (!needsLifeSupportSelection || selectedLifeSupportInstanceId != null) &&
    (!needsMakeASceneSelection || selectedMakeASceneInstanceId != null);

  const handleAcknowledge = () => {
    const extra = {};
    if (isLifeSupport && selectedLifeSupportInstanceId) extra.selectedLifeSupportTargetInstanceId = selectedLifeSupportInstanceId;
    if (isMakeAScene && selectedMakeASceneInstanceId) extra.selectedMakeASceneTargetInstanceId = selectedMakeASceneInstanceId;
    onAcknowledge?.(Object.keys(extra).length ? extra : undefined);
  };

  // Action-only banner title: avoid showing "0" when actionName is missing or numeric zero (e.g. Rally)
  const actionTitle = roll._action && (roll.actionName == null || roll.actionName === '' || roll.actionName === 0)
    ? (roll._featureName || 'Hope ability')
    : (roll.actionName || 'Action');

  return (
    <div
      className="dice-result-banner select-none flex-shrink-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: 'auto',
        maxWidth: '280px',
        minWidth: '200px',
      }}
    >
      <div
        className="px-5 py-3 rounded-xl shadow-2xl text-center bg-slate-900/90 border-2 border-amber-500/60 text-amber-50"
      >
        {displayName && (
          <div className="text-[11px] uppercase tracking-widest opacity-70 mb-1">{displayName}</div>
        )}
        <div className="text-base font-bold text-amber-200 mb-1">{actionTitle}</div>
        {roll.actionText && (
          <div className="text-[12px] text-slate-300 mb-2">{roll.actionText}</div>
        )}
        {(roll.tags || []).length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {(roll.tags || []).map((tag, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded px-2 py-1 text-left border bg-amber-950/50 border-amber-700/50">
                <Info size={10} className="text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[10px] leading-snug">
                  <span className="font-bold text-amber-200">{tag.name}:</span>{' '}
                  <span className="text-amber-400/80">{tag.text}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {(roll._rousingSpeechTargets != null) && (
          <div className="mb-2">
            <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              Clear 2 Stress each:
            </div>
            {roll._rousingSpeechTargets.length === 0 ? (
              <div className="text-[10px] text-slate-500 italic">No other characters within Far range</div>
            ) : (
              <div className="flex flex-wrap gap-1 justify-center">
                {roll._rousingSpeechTargets.map(t => (
                  <span
                    key={t.instanceId}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-sky-900/60 border-sky-700 text-sky-200"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {isMakeAScene && (
          <div className="mb-2">
            <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              −2 Difficulty on:
            </div>
            {(makeASceneTargets?.length ?? 0) === 0 ? (
              <div className="text-[10px] text-slate-500 italic">No adversaries on the table</div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => setMakeASceneMenuRect(e.currentTarget.getBoundingClientRect())}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                    selectedMakeASceneInstanceId
                      ? 'ring-1 ring-amber-400 bg-amber-800/80 border-amber-500 text-amber-100'
                      : 'bg-slate-800/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-400'
                  }`}
                >
                  <ChevronDown size={10} />
                  {selectedMakeASceneName ?? 'Choose adversary'}
                </button>
                {makeASceneMenuRect != null && createPortal(
                  <>
                    <div className="fixed inset-0 z-[400]" onClick={() => setMakeASceneMenuRect(null)} />
                    <div
                      className="fixed z-[401] rounded-lg border border-amber-600/70 bg-slate-900 shadow-2xl p-2 space-y-1"
                      style={{
                        top: Math.min(makeASceneMenuRect.bottom + 4, window.innerHeight - 200),
                        left: Math.min(makeASceneMenuRect.left, window.innerWidth - 200),
                        minWidth: '160px',
                        maxWidth: '240px',
                      }}
                    >
                      {makeASceneTargets.map(t => {
                        const sum = formatTargetSummary(t, { hideMax: false });
                        const isSelected = t.instanceId === selectedMakeASceneInstanceId;
                        return (
                          <button
                            key={t.instanceId}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onMakeASceneSelect?.(t.instanceId); setMakeASceneMenuRect(null); }}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium border transition-colors ${
                              isSelected
                                ? 'border-amber-500 bg-amber-800/60 text-amber-100'
                                : 'border-amber-600/60 bg-slate-800/80 text-slate-200 hover:bg-amber-800/60 hover:border-amber-500'
                            }`}
                          >
                            <div>{t.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {[sum.hp, sum.stress].filter(Boolean).join(' · ')}
                              {sum.conditions ? ` · ${sum.conditions}` : ''}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>,
                  document.body
                )}
              </>
            )}
          </div>
        )}
        {isLifeSupport && (
          <div className="mb-2">
            <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              Clear 1 HP on (choose one):
            </div>
            {(lifeSupportTargets?.length ?? 0) === 0 ? (
              <div className="text-[10px] text-slate-500 italic">No other characters within Close range with marked HP</div>
            ) : (
              <div className="flex flex-wrap gap-1 justify-center">
                {lifeSupportTargets.map(t => {
                  const selected = t.instanceId === selectedLifeSupportInstanceId;
                  return (
                    <button
                      key={t.instanceId}
                      type="button"
                      onClick={() => onLifeSupportSelect?.(t.instanceId)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${!disableDismiss
                        ? 'cursor-pointer bg-sky-900/60 border-sky-700 text-sky-200 hover:bg-sky-800 hover:border-sky-600'
                        : 'cursor-default bg-sky-900/40 border-sky-800 text-sky-300'} ${selected ? 'ring-2 ring-amber-400 border-amber-500 bg-sky-800' : ''}`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {(!disableDismiss || onCancel != null) && (
          <div className="flex items-center justify-center gap-1.5">
            {!disableDismiss && (
              <button
                onClick={handleAcknowledge}
                disabled={!canAcknowledge}
                className="flex-1 min-w-0 px-3 py-1 rounded text-[11px] font-semibold border border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-900/50 disabled:hover:text-amber-200"
              >
                Acknowledge
              </button>
            )}
            {onCancel != null && (
              <button
                onClick={onCancel}
                className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Returns true when a feature tag requires explicit user interaction before dismissal. */
function isTagInteractive(tagName) {
  return weaponFeatures[tagName]?.interactive ?? false;
}

function ResultBanner({ roll, resolved, onAcknowledge, onCancel, targets, getTargetsForRoll, onApplyDamage, onApplyVulnerable, disableDismiss, canApplyDamage = true, onLuckyReroll, onQuickTarget, onDoubledUpTarget, onBouncingTarget, wizardsWithHope = [], onNotThisTime, fearlessChars = [], fearlessConvertedBannerIds, onFearlessConvert, felineInstinctsChars = [], onFelineInstinctsReroll, onFelineInstinctsRequest, felineRequestedBannerIds, tableCharacters = [], rangerFocusRerollChars = [], onRangerFocusReroll, onRangerFocusRerollRequest, rangerFocusRequestedBannerIds, holdThemOffChars = [], onHoldThemOffToggle, wingsOfLightFlyingInstanceIds, onWingsD8Toggle, onWingsD8ToggleRequest, onGetWingsD8Extra, getWaterRetaliationNames, isPlayer = false, onResolveInstantly, prayerDiceChars = [], onPrayerDieSelect }) {
  const visible = useBannerVisible();
  const { dominant, total, characterName, rollUser } = roll;
  const displayName = roll.displayName || characterName || rollUser || '';
  // Active post-apply interaction: the name of the tag whose interaction phase is running.
  // Replaces the three separate quickPhase / doubledUpPhase / bouncingPhase states.
  const [activeInteractionTag, setActiveInteractionTag] = useState(null);
  // Retracting Claws (Katari): one target must be selected before Acknowledge.
  const [retractingClawsSelectedId, setRetractingClawsSelectedId] = useState(null);
  // Damage banners: target chips are selectors only; selection is applied when Acknowledge is pressed.
  const [selectedDamageTargetId, setSelectedDamageTargetId] = useState(() => roll._selectedTargetInstanceId ?? null);
  const [useArmorForSelected, setUseArmorForSelected] = useState(false);
  // Hold Them Off (Ranger): multi-select up to 3 targets; per-target armor.
  const holdThemOffActive = !!roll._holdThemOffActive;
  const [selectedDamageTargetIds, setSelectedDamageTargetIds] = useState(() =>
    roll._holdThemOffActive ? [roll._selectedTargetInstanceId].filter(Boolean) : []
  );
  const [useArmorByTargetId, setUseArmorByTargetId] = useState(() => ({}));
  // Popup menu for target selection (same UX as initiating player's "Choose target" menu).
  const [targetMenuAnchorRect, setTargetMenuAnchorRect] = useState(null);

  // When Hold Them Off is toggled on, seed multi-select from current single selection if empty.
  useEffect(() => {
    if (holdThemOffActive && selectedDamageTargetIds.length === 0 && (selectedDamageTargetId || roll._selectedTargetInstanceId)) {
      const id = selectedDamageTargetId || roll._selectedTargetInstanceId;
      setSelectedDamageTargetIds([id]);
    }
  }, [holdThemOffActive, selectedDamageTargetIds.length, selectedDamageTargetId, roll._selectedTargetInstanceId]);

  useEffect(() => {
    if (!targetMenuAnchorRect) return;
    const onKey = (e) => { if (e.key === 'Escape') setTargetMenuAnchorRect(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [targetMenuAnchorRect]);

  // Prayer Dice: selection state for this banner.
  // selectedAddRollDie: die whose value is added to the DH action total before ack.
  // selectedDmgReduceDie: die whose value is subtracted from damage before threshold comparison.
  // Prayer die selections live on the roll object (server-authoritative shared state).
  const selectedAddRollDie = roll._prayerAddRollDie ?? null;
  const selectedDmgReduceDie = roll._prayerDmgReduceDie ?? null;
  const selectAddRollDie = (die) => onPrayerDieSelect?.(roll._rollDbId, { addRollDie: die });
  const selectDmgReduceDie = (die) => onPrayerDieSelect?.(roll._rollDbId, { dmgReduceDie: die });

  // Fearless (Infernis): if this banner was converted from Fear to Hope, use 'hope' for display.
  const isConverted = !!(roll._rollDbId != null && fearlessConvertedBannerIds?.has(roll._rollDbId));
  const effectiveDominant = isConverted ? 'hope' : dominant;

  const hasDHLabels   = (roll.subItems || []).some(s => /hope/i.test(s.pre || ''))
                     && (roll.subItems || []).some(s => /fear/i.test(s.pre || ''));
  const isDaggerheart = effectiveDominant != null || hasDHLabels;
  const isCritical    = effectiveDominant === 'critical';
  const isHope        = effectiveDominant === 'hope' || isCritical;

  const isPrayerDiceRoll = !!roll._isPrayerDiceRoll;
  const actionItems = (roll.subItems || []).filter(s => !/damage/i.test(s.pre || '') && !EXTRA_PRE_RE.test(s.pre || ''));
  const damageSub   = (roll.subItems || []).find(s => /damage/i.test(s.pre || '') && s.input);
  const extraItems  = (roll.subItems || []).filter(s => EXTRA_PRE_RE.test(s.pre || ''));
  const dmg         = parseDiceSub(damageSub);
  const hasDamage   = resolved && dmg != null;

  // Determine if this banner has any interactive actions that require user input before dismissal.
  const tags = roll.tags || [];
  const hasInteractiveTags = tags.some(t => isTagInteractive(t.name));
  const hasLucky = tags.some(t => t.name === 'Lucky') && dominant === 'fear';
  // Show target row for damage (GM only) or for Retracting Claws (GM and player see chips; only GM can acknowledge).
  const needsInteraction = resolved && (canApplyDamage || roll._retractingClaws) && (hasDamage || hasInteractiveTags || roll._retractingClaws);

  // Whether to show action buttons (Acknowledge / Apply damage)
  const showActions = resolved && !disableDismiss;

  // DH rolls: label + numeric value for each non-damage sub-item. Include input to detect static parts.
  // Use dice expression (e.g. "1d8") as label when pre is blank so builder extra dice show in banner.
  const dhParts = isDaggerheart
    ? actionItems
        .map(s => ({ label: extractBannerLabel(s.pre) || (s.input && s.input.trim()) || 'Dice', value: parseInt(s.result, 10), input: s.input }))
        .filter(p => p.label && (resolved ? (!isNaN(p.value) && p.value !== 0) : true))
    : [];

  // Generic rolls: parsed dice detail for the first action expression.
  const genericActionSub = !isDaggerheart
    ? actionItems.find(s => /d\d/i.test(s.input || ''))
    : null;
  const genericAction = parseDiceSub(genericActionSub);
  const genericTotal  = total ?? computeActionTotal(roll.subItems);
  // When unresolved, use sum of static-only action parts if every part is static (no dice).
  const staticGenericTotal = !resolved && !genericAction && actionItems.length > 0
    && actionItems.every(s => isStaticDiceInput(s.input))
    ? actionItems.reduce((sum, s) => sum + (parseStaticValue(s.input) ?? 0), 0)
    : null;

  // Color schemes for DH (hope/fear) vs generic rolls.
  const neutralScheme = { card: 'bg-slate-900/90 border-2 border-sky-500/60 text-sky-100', detail: 'text-sky-200/60' };
  const scheme = (!resolved || !isDaggerheart)
    ? neutralScheme
    : isHope
      ? { card: 'bg-amber-900/90 border-2 border-amber-400 text-amber-50', detail: 'text-amber-400/80' }
      : { card: 'bg-purple-950/90 border-2 border-purple-500/60 text-purple-100', detail: 'text-purple-200/60' };

  // Character rolls target adversaries; adversary/other rolls target characters.
  // Use getTargetsForRoll when Retracting Claws, character attack with weapon range, or adversary attack with range.
  const useGetTargetsForRoll = !!(getTargetsForRoll && (
    roll._retractingClaws ||
    (hasDamage && roll._attackerInstanceId && (roll._weaponRangeFt != null || roll._retractingClaws || (roll._attackerType === 'adversary' && roll._attackRangeFt != null)))
  ));
  const allTargets = useGetTargetsForRoll ? (getTargetsForRoll(roll) || []) : (targets || []);
  const rollSrc = (rollUser || characterName || '').toLowerCase().trim();
  // Character rolls target adversaries. Treat as character roll when the attacker is a character (not adversary).
  const isCharacterRoll = (roll._attackerInstanceId != null && roll._attackerType !== 'adversary') || (rollSrc
    ? allTargets.some(t => t.type === 'character' && (
        t.name.toLowerCase() === rollSrc ||
        rollSrc.startsWith(t.name.toLowerCase())
      ))
    : false);
  // Retracting Claws: allTargets is already melee adversaries only; don't re-filter by type or we get [] (no characters in list).
  const filteredTargets = roll._retractingClaws
    ? allTargets
    : isCharacterRoll
      ? allTargets.filter(t => t.type === 'adversary')
      : allTargets.filter(t => t.type === 'character');

  // Selected target(s) for banner title (damage or Retracting Claws). Hold Them Off: up to 3 targets.
  const selectedTargetIdForTitle = roll._retractingClaws ? retractingClawsSelectedId : (holdThemOffActive ? null : selectedDamageTargetId);
  const selectedTargetsForTitle = holdThemOffActive && selectedDamageTargetIds.length > 0
    ? selectedDamageTargetIds.map(id => filteredTargets.find(t => t.instanceId === id)).filter(Boolean)
    : [];
  const selectedTargetForTitle = selectedTargetIdForTitle
    ? filteredTargets.find(t => t.instanceId === selectedTargetIdForTitle)
    : null;
  const bannerTitle = holdThemOffActive && selectedTargetsForTitle.length > 0
    ? `${displayName} → ${selectedTargetsForTitle.map(t => t.name).join(', ')}`
    : selectedTargetForTitle ? `${displayName} → ${selectedTargetForTitle.name}` : displayName;

  // Fearless character lookup — done in component body so it's accessible outside showActions IIFE.
  // Does NOT require isCharacterRoll so it works for players (who receive targets=[]).
  // fearlessChars is already pre-filtered (player mode: own character only), so adversary rolls
  // won't match unless an adversary happens to share the character's name.
  // Feline Instincts (Katari): Agility roll + character has feature and ≥2 Hope.
  const felineChar = roll._traitKey === 'agility' && roll._attackerInstanceId && isDaggerheart
    ? felineInstinctsChars.find(c => c.instanceId === roll._attackerInstanceId)
    : null;

  // Ranger's Focus: Fear result, attack vs Focus target — can end Focus to reroll Duality dice.
  // Use roll._selectedTargetInstanceId as fallback for players who pre-select before rolling
  // (players have empty filteredTargets so selectedDamageTargetId stays null).
  const effectiveFocusTargetId = selectedDamageTargetId || roll._selectedTargetInstanceId || null;
  // rangerFocusRerollChars carries focusedAdversaryInstanceId derived from adversary focusedBy field.
  const attackerRanger = rangerFocusRerollChars?.find(c => c.instanceId === roll._attackerInstanceId);
  const rangerFocusRerollChar = attackerRanger && attackerRanger.focusedAdversaryInstanceId === effectiveFocusTargetId ? attackerRanger : null;
  // Stress note: visible to everyone — show whenever the attacker is focused on the target being attacked.
  const focusedByStressNote = !!rangerFocusRerollChar;

  // Hold Them Off (Ranger): character attack with damage, attacker has feature and ≥3 Hope.
  const holdThemOffChar = hasDamage && roll._attackerInstanceId
    ? holdThemOffChars.find(c => c.instanceId === roll._attackerInstanceId)
    : null;

  const fearlessChar = dominant === 'fear' && roll._rollDbId != null
    ? fearlessChars.find(c =>
        (roll._attackerInstanceId && c.instanceId === roll._attackerInstanceId) ||
        (!roll._attackerInstanceId && (
          c.name?.toLowerCase() === rollSrc ||
          rollSrc.startsWith(c.name?.toLowerCase())
        ))
      )
    : null;

  const handleResolveClick = !resolved && onResolveInstantly
    ? (e) => { e.stopPropagation(); onResolveInstantly(); }
    : undefined;

  return (
    <div
      className="dice-result-banner select-none flex-shrink-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: 'auto',
        maxWidth: '280px',
        minWidth: '200px',
        cursor: handleResolveClick ? 'pointer' : undefined,
      }}
      onClick={handleResolveClick}
      title={handleResolveClick ? 'Click to show result immediately' : undefined}
    >
      <div
        className={`px-5 py-3 rounded-xl shadow-2xl text-center ${scheme.card}`}
      >
        {bannerTitle && (
          <div className="text-[11px] uppercase tracking-widest opacity-70 mb-1.5">{bannerTitle}</div>
        )}

        {/* ── Action line ── */}
        <div className="flex items-baseline justify-center flex-wrap gap-x-1 leading-snug">
          {isPrayerDiceRoll ? (
            /* Prayer Dice: show each d4 result individually — each becomes its own chip */
            <>
              {actionItems.filter(s => /d\d/i.test(s.input || '')).map((s, i) => {
                const val = parseInt(s.result, 10);
                return (
                  <span key={i} className="flex items-baseline gap-1">
                    {i > 0 && <span className={`text-[11px] ${scheme.detail}`}>·</span>}
                    <span className={`text-[11px] ${scheme.detail}`}>{s.input}</span>
                    <span className="text-2xl font-black tabular-nums ml-0.5">
                      {resolved ? (isNaN(val) ? s.result : val) : <Spinner lg />}
                    </span>
                  </span>
                );
              })}
            </>
          ) : isDaggerheart ? (
            <>
              {dhParts.length > 0 && (
                <span className={`text-[11px] ${scheme.detail}`}>
                  {dhParts.map((p, i) => {
                    const displayVal = resolved ? p.value : (isStaticDiceInput(p.input) ? parseStaticValue(p.input) : undefined);
                    return (
                      <span key={i}>
                        {i > 0 && (isNaN(p.value) || p.value >= 0 ? ' + ' : ' \u2212 ')}
                        {p.label} {displayVal !== undefined && displayVal !== null ? Math.abs(displayVal) : <Spinner />}
                      </span>
                    );
                  })}
                  {' ='}
                </span>
              )}
              <span className="text-2xl font-black tabular-nums ml-1">
                {resolved ? (total + (selectedAddRollDie?.value ?? 0)) : <Spinner lg />}
              </span>
              {selectedAddRollDie && resolved && (
                <span className="text-[10px] text-teal-400/80 ml-0.5">+{selectedAddRollDie.value} Prayer Die</span>
              )}
              <span className="text-sm font-semibold opacity-80 ml-0.5">
                {resolved
                  ? (isCritical ? '✦ Critical!' : isHope ? 'with Hope' : 'with Fear')
                  : <Spinner lg />}
              </span>
            </>
          ) : genericAction ? (
            <>
              <span className={`text-[11px] ${scheme.detail}`}>
                {genericAction.notation} {resolved ? genericAction.dieValue : <Spinner />}
                {genericAction.modifier !== 0 && (
                  <> {genericAction.modifier > 0 ? '+' : '\u2212'} {Math.abs(genericAction.modifier)}</>
                )}
                {' ='}
              </span>
              <span className="text-2xl font-black tabular-nums ml-1">
                {resolved ? genericAction.total : <Spinner lg />}
              </span>
            </>
          ) : (
            <span className="text-2xl font-black tabular-nums">
              {resolved ? genericTotal : (staticGenericTotal !== null ? staticGenericTotal : <Spinner lg />)}
            </span>
          )}
        </div>

        {/* ── Prayer Die: add-to-roll buttons (DH rolls only, visible to all) ── */}
        {isDaggerheart && resolved && prayerDiceChars.length > 0 && (
          <div className="flex items-center justify-center flex-wrap gap-1 mt-1">
            {prayerDiceChars.map(die => {
              const isSelected = selectedAddRollDie?.id === die.id;
              const usedForReduce = selectedDmgReduceDie?.id === die.id;
              return (
                <button
                  key={die.id}
                  type="button"
                  disabled={usedForReduce}
                    onClick={() => selectAddRollDie(isSelected ? null : die)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    isSelected
                      ? 'border-teal-500 bg-teal-900/50 text-teal-200'
                      : 'border-teal-700/60 text-teal-300/90 hover:bg-teal-950/40'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={isSelected ? 'Remove Prayer Die from roll' : `Add ${die.ownerName}'s Prayer Die (${die.value}) to this roll`}
                >
                  {die.ownerName}: +{die.value} Prayer Die
                </button>
              );
            })}
          </div>
        )}

        {/* ── Damage line ── */}
        {dmg && (() => {
          const dmgReduction = selectedDmgReduceDie?.value ?? 0;
          const wingsBonus = roll._wingsOfLightD8Result ?? 0;
          const baseDmg = dmg.total + wingsBonus;
          const displayDmg = Math.max(0, baseDmg - dmgReduction);
          return (
            <div className="flex items-baseline justify-center flex-wrap gap-x-1 mt-1.5 leading-snug">
              <span className="text-[11px] text-red-300/60">
                {dmg.notation}{' '}
                {resolved ? (
                  <>
                    {(dmg.discarded || []).map((v, i) => (
                      <span key={i} className="line-through text-red-300/30 mr-0.5">{v}</span>
                    ))}
                    {dmg.dieValue}
                  </>
                ) : <Spinner />}
                {dmg.modifier !== 0 && (
                  <> {dmg.modifier > 0 ? '+' : '\u2212'} {Math.abs(dmg.modifier)}</>
                )}
                {roll._wingsOfLightD8Result != null && (
                  <> + d8({roll._wingsOfLightD8Result})</>
                )}
                {dmgReduction > 0 && (
                  <> <span className="text-teal-400/80">− Prayer Die({dmgReduction})</span></>
                )}
                {' ='}
              </span>
              <span className="text-lg font-black tabular-nums text-red-300 ml-1">
                {resolved ? displayDmg : <Spinner />}
              </span>
              {dmg.type && (
                <span className="text-sm font-semibold text-red-300/80 ml-0.5">{dmg.type}</span>
              )}
              <span className="text-sm font-semibold text-red-300/80">damage</span>
            </div>
          );
        })()}

        {/* ── Extra dice sub-items: Reload / Invigorate / Lifesteal ── */}
        {extraItems.map((sub, i) => {
          const label = (sub.pre || '').trim();
          const result = parseInt(sub.result, 10);
          let statusText = null;
          let statusCls = 'text-slate-400';
          if (resolved) {
            if (label === 'Reload') {
              if (result === 1) { statusText = 'Must reload!'; statusCls = 'text-red-400 font-semibold'; }
              else { statusText = 'Loaded'; statusCls = 'text-green-400'; }
            } else if (label === 'Invigorate') {
              if (result === 4) { statusText = 'Clear 1 Stress!'; statusCls = 'text-green-400 font-semibold'; }
              else { statusText = 'No effect'; statusCls = 'text-slate-500'; }
            } else if (label === 'Lifesteal') {
              if (result === 6) { statusText = 'Clear 1 HP!'; statusCls = 'text-green-400 font-semibold'; }
              else { statusText = 'No effect'; statusCls = 'text-slate-500'; }
            }
          }
          return (
            <div key={i} className="flex items-baseline justify-center gap-x-1 mt-1 leading-snug">
              <span className="text-[11px] text-slate-400/70">
                {label} {sub.input}{' '}
                <span className="text-slate-200">{resolved ? result : <Spinner />}</span>
                {statusText && <span className={`ml-1 ${statusCls}`}>{statusText}</span>}
              </span>
            </div>
          );
        })}

        {/* ── Feature tags ── */}
        {resolved && (roll.tags || []).length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {(roll.tags || []).map((tag, i) => {
              const isAuto = isTagAutomated(tag.name);
              const conditional = getConditionalTagStatus(tag, roll);
              const effectiveStyle = isAuto ? 'green'
                : conditional ? conditional.style
                : 'info';
              const Icon = effectiveStyle === 'green' ? CheckCircle
                : effectiveStyle === 'red' ? AlertTriangle
                : Info;
              const cardCls = effectiveStyle === 'green' ? 'bg-green-950/50 border-green-700/50'
                : effectiveStyle === 'red' ? 'bg-red-950/50 border-red-700/50'
                : effectiveStyle === 'muted' ? 'bg-slate-800/40 border-slate-700/50'
                : 'bg-slate-800/60 border-slate-600/60';
              const iconCls = effectiveStyle === 'green' ? 'text-green-400'
                : effectiveStyle === 'red' ? 'text-red-400'
                : 'text-slate-400';
              const nameCls = effectiveStyle === 'green' ? 'text-green-200'
                : effectiveStyle === 'red' ? 'text-red-200'
                : 'text-slate-200';
              const textCls = effectiveStyle === 'green' ? 'text-green-400/80'
                : effectiveStyle === 'red' ? 'text-red-400/80'
                : effectiveStyle === 'muted' ? 'text-slate-500'
                : 'text-slate-400';
              const displayText = conditional ? conditional.text : tag.text;
              return (
                <div key={i} className={`flex items-start gap-1.5 rounded px-2 py-1 text-left border ${cardCls}`}>
                  <Icon size={10} className={`${iconCls} shrink-0 mt-0.5`} />
                  <span className="text-[10px] leading-snug">
                    <span className={`font-bold ${nameCls}`}>{tag.name}:</span>{' '}
                    <span className={textCls}>{displayText}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Focused-by Stress note: visible to everyone when the attack targets the Ranger's Focus adversary */}
        {resolved && focusedByStressNote && (
          <div className="text-[10px] text-emerald-300/90 mt-1.5">
            Target will mark 1 Stress (Focused).
          </div>
        )}

        {/* ── Action row: target badges or Acknowledge ── */}
        {showActions && (() => {
          // ── Post-apply interaction phase (Quick, Doubled Up, Bouncing) ──
          if (activeInteractionTag) {
            const interactionFeature = weaponFeatures[activeInteractionTag];
            const interaction = interactionFeature?.bannerInteraction;
            const prompt = typeof interaction?.getPrompt === 'function'
              ? interaction.getPrompt(tags, dmg)
              : interaction?.prompt ?? `${activeInteractionTag}: mark Stress?`;
            const skipLabel = interaction?.skipLabel ?? 'Done';
            const isLoop = interaction?.loop ?? false;

            // Per-tag callback dispatch
            const handleInteractiveTarget = (t) => {
              if (activeInteractionTag === 'Quick') {
                onQuickTarget?.(t, dmg?.total, tags, roll, dmg?.type || '');
              } else if (activeInteractionTag === 'Doubled Up') {
                onDoubledUpTarget?.(t, tags, roll);
              } else if (activeInteractionTag === 'Bouncing') {
                onBouncingTarget?.(t, dmg?.total, tags, roll, dmg?.type || '');
              }
              if (!isLoop) { setActiveInteractionTag(null); onAcknowledge?.(); }
            };

            return (
              <div className="mt-2.5 pt-2 border-t border-white/10">
                <div className="text-[10px] text-amber-300 mb-1.5 uppercase tracking-wider">{prompt}</div>
                <div className="flex flex-wrap justify-center gap-1">
                  {filteredTargets.map(t => (
                    <button
                      key={t.instanceId}
                      onClick={() => handleInteractiveTarget(t)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                        t.type === 'character'
                          ? 'bg-sky-900/60 border-sky-700 text-sky-200 hover:bg-sky-800 hover:border-sky-500'
                          : 'bg-slate-800/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                  <button
                    onClick={() => { setActiveInteractionTag(null); onAcknowledge?.(); }}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  >
                    {skipLabel}
                  </button>
                </div>
              </div>
            );
          }

          // ── Primary action row ──
          const isAdversaryRoll = !isCharacterRoll && wizardsWithHope.length > 0 && (isDaggerheart || hasDamage);

          // After applying damage, check if any tag needs a post-apply interaction phase.
          const enterPostApplyPhase = () => {
            const firstPostApply = tags.find(t => {
              const f = weaponFeatures[t.name];
              return f?.bannerInteraction?.phase === 'post-apply';
            });
            if (firstPostApply) setActiveInteractionTag(firstPostApply.name);
            else onAcknowledge?.();
          };

          return (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              {/* Lucky reroll button */}
              {hasLucky && (
                <button
                  onClick={() => { onLuckyReroll?.(roll); }}
                  className="w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100 transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw size={10} /> Lucky: Reroll? (mark 1 Stress)
                </button>
              )}
              {/* Not This Time buttons — one per eligible Wizard */}
              {isAdversaryRoll && onNotThisTime && wizardsWithHope.map(wizard => (
                <button
                  key={wizard.instanceId}
                  onClick={() => { onNotThisTime(wizard, roll); }}
                  className="w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border border-violet-700 bg-violet-900/50 text-violet-200 hover:bg-violet-800 hover:text-violet-100 transition-colors flex items-center justify-center gap-1"
                  title={`${wizard.name} spends 3 Hope to force a reroll (Not This Time)`}
                >
                  <RotateCcw size={10} /> {wizard.name}: Not This Time (3 Hope)
                </button>
              ))}
              {/* Feline Instincts (Katari): Spend 2 Hope to reroll Hope die — Agility roll, char has feature and ≥2 Hope */}
              {felineChar && (onFelineInstinctsReroll || onFelineInstinctsRequest) && (() => {
                const felineRequested = !!roll._felineRerollRequestedBy;
                return (
                  <button
                    onClick={() => {
                      if (onFelineInstinctsReroll) onFelineInstinctsReroll(roll);
                      else if (onFelineInstinctsRequest && roll._rollDbId) onFelineInstinctsRequest(roll._rollDbId);
                    }}
                    className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${felineRequested ? 'border-amber-500 bg-amber-800/80 text-amber-100' : 'border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100'}`}
                    title={felineRequested ? 'Reroll requested — waiting for GM' : 'Spend 2 Hope to reroll Hope Die (Feline Instincts)'}
                  >
                    {felineRequested ? <Check size={12} className="shrink-0" /> : <RotateCcw size={10} />}
                    Spend 2 Hope to reroll Hope Die
                  </button>
                );
              })()}
              {/* Ranger's Focus: End Focus to reroll Duality dice — Fear result, attack vs Focus target (GM only in showActions block) */}
              {dominant === 'fear' && hasDamage && rangerFocusRerollChar && onRangerFocusReroll && (() => {
                const rangerRequested = !!(roll._rangerFocusRerollRequestedBy || (rangerFocusRequestedBannerIds && rangerFocusRequestedBannerIds.has(roll._rollDbId)));
                return (
                  <button
                    onClick={() => onRangerFocusReroll(roll)}
                    className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${rangerRequested ? 'border-emerald-500 bg-emerald-800/80 text-emerald-100' : 'border-emerald-700 bg-emerald-900/50 text-emerald-200 hover:bg-emerald-800 hover:text-emerald-100'}`}
                    title={rangerRequested ? 'Reroll requested — waiting for GM' : "End Ranger's Focus to reroll Duality dice"}
                  >
                    {rangerRequested ? <Check size={12} className="shrink-0" /> : <RotateCcw size={10} />}
                    End Ranger's Focus to reroll Duality dice
                  </button>
                );
              })()}
              {/* Hold Them Off (Ranger): Spend 3 Hope to select two more targets — visible to GM and initiating player */}
              {holdThemOffChar && onHoldThemOffToggle && roll._rollDbId && (
                <button
                  onClick={() => onHoldThemOffToggle(roll._rollDbId, !holdThemOffActive)}
                  className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${holdThemOffActive ? 'border-amber-500 bg-amber-800/80 text-amber-100' : 'border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100'}`}
                  title={holdThemOffActive ? 'On — select up to 3 targets (3 Hope when 2–3 targets)' : 'Spend 3 Hope to select two more targets'}
                >
                  {holdThemOffActive ? <Check size={12} className="shrink-0" /> : null}
                  Spend 3 Hope to select two more targets
                </button>
              )}
              {(hasDamage || roll._retractingClaws) && canApplyDamage && (filteredTargets.length > 0 || roll._retractingClaws || (roll._attackerType === 'adversary' && roll._attackRangeFt != null)) ? (
                <>
                  <div className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">
                    {(() => {
                      const rangeLabel = roll._retractingClaws ? 'Melee' : (roll._weaponRangeFt != null ? rangeFtToLabel(roll._weaponRangeFt) : (roll._attackerType === 'adversary' && roll._attackRangeFt != null ? rangeFtToLabel(roll._attackRangeFt) : null));
                      return rangeLabel ? `Apply within ${rangeLabel}` : 'Apply to';
                    })()}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap justify-center items-center gap-1">
                      {roll._attackerType === 'adversary' && roll._attackRangeFt != null && filteredTargets.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic">No characters in range</span>
                      ) : roll._retractingClaws ? (
                        filteredTargets.length === 0 ? (
                          <span className="text-[10px] text-slate-500 italic">No adversaries in Melee range</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => setTargetMenuAnchorRect(e.currentTarget.getBoundingClientRect())}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                retractingClawsSelectedId
                                  ? 'bg-amber-800/80 border-amber-500 text-amber-100 ring-1 ring-amber-400'
                                  : 'bg-slate-800/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-400'
                              }`}
                              title="Choose target"
                            >
                              {retractingClawsSelectedId
                                ? (filteredTargets.find(t => t.instanceId === retractingClawsSelectedId)?.name ?? 'Select target')
                                : 'Select target'}
                              <ChevronDown size={10} className="opacity-70" />
                            </button>
                            {targetMenuAnchorRect != null && createPortal(
                              <>
                                <div className="fixed inset-0 z-[200]" onClick={() => setTargetMenuAnchorRect(null)} aria-hidden />
                                <div
                                  className="fixed z-[201] rounded-lg border border-amber-600/70 bg-slate-900 shadow-2xl p-2 space-y-2"
                                  style={{
                                    bottom: typeof window !== 'undefined' ? window.innerHeight - targetMenuAnchorRect.top + 4 : 8,
                                    left: Math.min(targetMenuAnchorRect.left, typeof window !== 'undefined' ? window.innerWidth - 220 : 0),
                                    minWidth: '140px',
                                  }}
                                >
                                  <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide">Choose target</div>
                                  <div className="space-y-1 max-w-[220px]">
                                    {filteredTargets.map((t) => {
                                      const sum = formatTargetSummary(t, { hideMax: isPlayer });
                                      return (
                                        <button
                                          key={t.instanceId}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRetractingClawsSelectedId(t.instanceId);
                                            setTargetMenuAnchorRect(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-amber-600/60 bg-slate-800/80 text-slate-200 hover:bg-amber-800/60 hover:border-amber-500 transition-colors"
                                        >
                                          <div>{t.name}</div>
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
                                    onClick={(e) => { e.stopPropagation(); setTargetMenuAnchorRect(null); }}
                                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>,
                              document.body
                            )}
                          </>
                        )
                      ) : holdThemOffActive ? (
                        filteredTargets.length === 0 ? (
                          <span className="text-[10px] text-slate-500 italic">No valid targets</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => setTargetMenuAnchorRect(e.currentTarget.getBoundingClientRect())}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                selectedDamageTargetIds.length > 0
                                  ? 'ring-1 ring-amber-400 bg-amber-800/80 border-amber-500 text-amber-100'
                                  : 'bg-slate-800/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-400'
                              }`}
                              title="Select up to 3 targets"
                            >
                              {selectedDamageTargetIds.length > 0
                                ? (selectedDamageTargetIds.length === 1
                                  ? (filteredTargets.find(t => t.instanceId === selectedDamageTargetIds[0])?.name ?? '1 target')
                                  : `${selectedDamageTargetIds.length} targets`)
                                : 'Select targets (1–3)'}
                              <ChevronDown size={10} className="opacity-70" />
                            </button>
                            {selectedDamageTargetIds.map((id) => {
                              const t = filteredTargets.find(x => x.instanceId === id);
                              if (!t) return null;
                              const dmgType = dmg?.type || '';
                              const armorBlockedByType = (t.armorFeatureName === 'Physical' && dmgType === 'mag') || (t.armorFeatureName === 'Magic' && dmgType === 'phy');
                              const hasArmor = t.type === 'character' && (t.maxArmor ?? 0) > 0 && (t.currentArmor ?? 0) < (t.maxArmor ?? 0) && !armorBlockedByType;
                              return hasArmor ? (
                                <label key={id} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-cyan-700 bg-cyan-900/40 text-cyan-200 cursor-pointer hover:bg-cyan-800/50 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={!!useArmorByTargetId[id]}
                                    onChange={(e) => setUseArmorByTargetId(prev => ({ ...prev, [id]: e.target.checked }))}
                                    className="rounded border-cyan-600"
                                  />
                                  <Shield size={9} />
                                  {t.name}
                                </label>
                              ) : null;
                            })}
                            {targetMenuAnchorRect != null && createPortal(
                              <>
                                <div className="fixed inset-0 z-[200]" onClick={() => setTargetMenuAnchorRect(null)} aria-hidden />
                                <div
                                  className="fixed z-[201] rounded-lg border border-amber-600/70 bg-slate-900 shadow-2xl p-2 space-y-2"
                                  style={{
                                    bottom: typeof window !== 'undefined' ? window.innerHeight - targetMenuAnchorRect.top + 4 : 8,
                                    left: Math.min(targetMenuAnchorRect.left, typeof window !== 'undefined' ? window.innerWidth - 220 : 0),
                                    minWidth: '140px',
                                  }}
                                >
                                  <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide">Select targets (1–3)</div>
                                  <div className="space-y-1 max-w-[220px]">
                                    {filteredTargets.map((t) => {
                                      const sum = formatTargetSummary(t, { hideMax: isPlayer });
                                      const isSelected = selectedDamageTargetIds.includes(t.instanceId);
                                      return (
                                        <button
                                          key={t.instanceId}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDamageTargetIds(prev => {
                                              if (prev.includes(t.instanceId)) return prev.filter(x => x !== t.instanceId);
                                              if (prev.length >= 3) return prev;
                                              return [...prev, t.instanceId];
                                            });
                                            setTargetMenuAnchorRect(null);
                                          }}
                                          className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium border transition-colors ${isSelected ? 'border-amber-500 bg-amber-800/60 text-amber-100' : 'border-amber-600/60 bg-slate-800/80 text-slate-200 hover:bg-amber-800/60 hover:border-amber-500'}`}
                                        >
                                          <div>{isSelected ? <Check size={10} className="inline mr-1" /> : null}{t.name}</div>
                                          <div className="text-[10px] text-slate-400 mt-0.5">
                                            {[sum.hp, sum.stress].filter(Boolean).join(' · ')}
                                            {sum.conditions ? ` · ${sum.conditions}` : ''}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setTargetMenuAnchorRect(null); }} className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                                </div>
                              </>,
                              document.body
                            )}
                          </>
                        )
                      ) : (
                        filteredTargets.length === 0 ? (
                          <span className="text-[10px] text-slate-500 italic">No valid targets</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => setTargetMenuAnchorRect(e.currentTarget.getBoundingClientRect())}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                selectedDamageTargetId
                                  ? 'ring-1 ring-amber-400 bg-amber-800/80 border-amber-500 text-amber-100'
                                  : 'bg-slate-800/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-400'
                              }`}
                              title="Choose target"
                            >
                              {selectedDamageTargetId
                                ? (filteredTargets.find(t => t.instanceId === selectedDamageTargetId)?.name ?? 'Select target')
                                : 'Select target'}
                              <ChevronDown size={10} className="opacity-70" />
                            </button>
                            {(() => {
                              const dmgType = dmg?.type || '';
                              const selectedTarget = selectedDamageTargetId ? filteredTargets.find(t => t.instanceId === selectedDamageTargetId) : null;
                              const armorBlockedByType = selectedTarget && (
                                (selectedTarget.armorFeatureName === 'Physical' && dmgType === 'mag') ||
                                (selectedTarget.armorFeatureName === 'Magic' && dmgType === 'phy')
                              );
                              const selectedHasArmor = selectedTarget && selectedTarget.type === 'character' && (selectedTarget.maxArmor ?? 0) > 0 && (selectedTarget.currentArmor ?? 0) < (selectedTarget.maxArmor ?? 0) && !armorBlockedByType;
                              const showWingsD8 = wingsOfLightFlyingInstanceIds?.has(roll._attackerInstanceId);
                              const wingsActive = !!roll._wingsOfLightAddD8;
                              const wingsD8Result = roll._wingsOfLightD8Result;
                              return (
                                <>
                                  {selectedHasArmor ? (
                                    <label className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-cyan-700 bg-cyan-900/40 text-cyan-200 cursor-pointer hover:bg-cyan-800/50 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={useArmorForSelected}
                                        onChange={(e) => setUseArmorForSelected(e.target.checked)}
                                        className="rounded border-cyan-600"
                                      />
                                      <Shield size={9} />
                                      Use armor
                                    </label>
                                  ) : null}
                                  {showWingsD8 && (onWingsD8Toggle || onWingsD8ToggleRequest) && roll._rollDbId && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onWingsD8Toggle) {
                                          if (!(wingsActive && wingsD8Result != null)) onWingsD8Toggle(roll._rollDbId);
                                        } else if (onWingsD8ToggleRequest) {
                                          onWingsD8ToggleRequest(roll._rollDbId, !wingsActive);
                                        }
                                      }}
                                      disabled={!!onWingsD8Toggle && wingsActive && wingsD8Result != null}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                        wingsActive
                                          ? 'border-amber-500 bg-amber-900/50 text-amber-200'
                                          : 'border-amber-700/60 text-amber-300/90 hover:bg-amber-950/40'
                                      } disabled:opacity-60 disabled:cursor-default`}
                                      title={wingsActive ? (wingsD8Result != null ? `+d8: ${wingsD8Result}` : 'Spend 1 Hope to add d8 to damage (applied on Acknowledge)') : 'Spend a Hope to add a d8 to damage'}
                                    >
                                      {wingsD8Result != null ? `+d8: ${wingsD8Result}` : '+1 Hope → d8'}
                                    </button>
                                  )}
                                  {/* Prayer Die: damage reduction toggles */}
                                  {prayerDiceChars.map(die => {
                                    const isSelected = selectedDmgReduceDie?.id === die.id;
                                    const usedForRoll = selectedAddRollDie?.id === die.id;
                                    return (
                                      <button
                                        key={die.id}
                                        type="button"
                                        disabled={usedForRoll}
                                        onClick={() => selectDmgReduceDie(isSelected ? null : die)}
                                        className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                          isSelected
                                            ? 'border-teal-500 bg-teal-900/50 text-teal-200'
                                            : 'border-teal-700/60 text-teal-300/90 hover:bg-teal-950/40'
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                        title={isSelected ? 'Remove Prayer Die damage reduction' : `Use ${die.ownerName}'s Prayer Die (${die.value}) to reduce damage`}
                                      >
                                        {isSelected ? `−${die.value} Prayer Die` : `${die.ownerName}: −${die.value} Prayer Die`}
                                      </button>
                                    );
                                  })}
                                </>
                              );
                            })()}
                            {targetMenuAnchorRect != null && (() => {
                              return createPortal(
                              <>
                                <div className="fixed inset-0 z-[200]" onClick={() => setTargetMenuAnchorRect(null)} aria-hidden />
                                <div
                                  className="fixed z-[201] rounded-lg border border-amber-600/70 bg-slate-900 shadow-2xl p-2 space-y-2"
                                  style={{
                                    bottom: typeof window !== 'undefined' ? window.innerHeight - targetMenuAnchorRect.top + 4 : 8,
                                    left: Math.min(targetMenuAnchorRect.left, typeof window !== 'undefined' ? window.innerWidth - 220 : 0),
                                    minWidth: '140px',
                                  }}
                                >
                                  <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide">Choose target</div>
                                  <div className="space-y-1 max-w-[220px]">
                                    {filteredTargets.map((t) => {
                                      const sum = formatTargetSummary(t, { hideMax: isPlayer });
                                      return (
                                        <button
                                          key={t.instanceId}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDamageTargetId(t.instanceId);
                                            setUseArmorForSelected(false);
                                            setTargetMenuAnchorRect(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-amber-600/60 bg-slate-800/80 text-slate-200 hover:bg-amber-800/60 hover:border-amber-500 transition-colors"
                                        >
                                          <div>{t.name}</div>
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
                                    onClick={(e) => { e.stopPropagation(); setTargetMenuAnchorRect(null); }}
                                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>,
                              document.body
                              );
                            })()}
                          </>
                        )
                      )}
                    </div>
                    {/* Elemental Incarnation notices — shown before Acknowledge so GM can anticipate side effects */}
                    {(() => {
                      const notes = [];
                      // Fire: adversary Melee attack on a Fire-channeling character → retaliation 1d10
                      if (roll._attackerType === 'adversary' && roll._attackRangeFt != null && roll._attackRangeFt <= RANGE_BANDS_FT.MELEE) {
                        const fireTarget = selectedDamageTargetId ? filteredTargets.find(t => t.instanceId === selectedDamageTargetId) : null;
                        if (fireTarget?.activeChanneledElement === 'fire') {
                          notes.push(<div key="fire" className="text-[10px] text-orange-300/90 mt-1">🔥 Fire: {fireTarget.name} retaliates 1d10 magic damage.</div>);
                        }
                      }
                      // Water: character Melee attack on adversary → other nearby adversaries mark Stress
                      if (hasDamage && isCharacterRoll && roll._attackerInstanceId && getWaterRetaliationNames) {
                        const waterTargetId = selectedDamageTargetId;
                        if (waterTargetId) {
                          const waterNames = getWaterRetaliationNames(roll._attackerInstanceId, waterTargetId);
                          if (waterNames.length > 0) {
                            notes.push(<div key="water" className="text-[10px] text-cyan-300/90 mt-1">💧 Water: {waterNames.join(', ')} will mark Stress.</div>);
                          }
                        }
                      }
                      return notes.length > 0 ? <div className="mt-1">{notes}</div> : null;
                    })()}
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {roll._retractingClaws ? (
                        <>
                          {onAcknowledge != null && (
                            <button
                              onClick={() => onAcknowledge(retractingClawsSelectedId ? { selectedRetractingClawsTargetInstanceId: retractingClawsSelectedId } : undefined)}
                              disabled={filteredTargets.length > 0 && !retractingClawsSelectedId}
                              className="px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800/60"
                              title={retractingClawsSelectedId ? 'Acknowledge and apply Vulnerable to selected target' : filteredTargets.length === 0 ? 'Acknowledge' : 'Select a target first'}
                            >
                              Acknowledge
                            </button>
                          )}
                          {onCancel != null && (
                            <button
                              onClick={onCancel}
                              className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      ) : holdThemOffActive ? (
                        <>
                          <button
                            onClick={async () => {
                              const dmgType = dmg?.type || '';
                              if (selectedDamageTargetIds.length > 0 && hasDamage && onApplyDamage) {
                                for (const id of selectedDamageTargetIds) {
                                  const target = filteredTargets.find(t => t.instanceId === id);
                                  if (target) await onApplyDamage({ ...target, useArmor: !!useArmorByTargetId[id] }, dmg.total, tags, roll, dmgType);
                                }
                              }
                              if (selectedDamageTargetIds.length >= 2 && roll._attackerInstanceId) {
                                onAcknowledge?.({ holdThemOffHopeCost: 3, attackerInstanceId: roll._attackerInstanceId });
                              } else {
                                onAcknowledge?.();
                              }
                            }}
                            disabled={selectedDamageTargetIds.length === 0}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800/60"
                            title={selectedDamageTargetIds.length === 0 ? 'Select at least one target' : selectedDamageTargetIds.length >= 2 ? 'Acknowledge and apply damage (3 Hope)' : 'Acknowledge and apply damage'}
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => onAcknowledge?.()}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                            title="Acknowledge without applying damage"
                          >
                            Skip
                          </button>
                          {onCancel != null && (
                            <button
                              onClick={onCancel}
                              className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            onClick={async () => {
                              let d8Extra = 0;
                              let alreadyAcked = false;
                              if (hasDamage && roll._wingsOfLightAddD8 && onGetWingsD8Extra) {
                                d8Extra = roll._wingsOfLightD8Result ?? (await onGetWingsD8Extra(roll)) ?? 0;
                                if (roll._wingsOfLightD8Result == null && d8Extra > 0) alreadyAcked = true;
                              }
                              const dmgReduction = selectedDmgReduceDie?.value ?? 0;
                              const totalDamage = Math.max(0, (hasDamage ? dmg.total : 0) + d8Extra - dmgReduction);
                              if (selectedDamageTargetId && hasDamage && onApplyDamage) {
                                const selectedTarget = filteredTargets.find(t => t.instanceId === selectedDamageTargetId);
                                if (selectedTarget) {
                                  const dmgType = dmg?.type || '';
                                  await onApplyDamage({ ...selectedTarget, useArmor: useArmorForSelected }, totalDamage, tags, roll, dmgType);
                                }
                              }
                              const ackOpts = {};
                              if (alreadyAcked) ackOpts.alreadyAcked = true;
                              onAcknowledge?.(Object.keys(ackOpts).length > 0 ? ackOpts : undefined);
                            }}
                            disabled={filteredTargets.length > 0 && !selectedDamageTargetId}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800/60"
                            title={filteredTargets.length > 0 && !selectedDamageTargetId ? 'Select a target first' : 'Acknowledge and apply damage to selected target'}
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => onAcknowledge?.()}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                            title="Acknowledge without applying damage"
                          >
                            Skip
                          </button>
                          {onCancel != null && (
                            <button
                              onClick={onCancel}
                              className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => onAcknowledge?.()}
                    className="flex-1 min-w-0 px-3 py-1 rounded text-[11px] font-semibold border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    Acknowledge
                  </button>
                  {onCancel != null && (
                    <button
                      onClick={onCancel}
                      className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        {/* Player self-cancel: shown outside showActions when the player is the initiator */}
        {!showActions && resolved && onCancel != null && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-center">
            <button
              onClick={onCancel}
              className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {/* Feline Instincts (Katari): "Spend 2 Hope to reroll Hope Die" — visible to player when not showActions so they can request GM attention */}
        {!showActions && resolved && felineChar && onFelineInstinctsRequest && (() => {
          const felineRequested = !!(roll._felineRerollRequestedBy || (felineRequestedBannerIds && felineRequestedBannerIds.has(roll._rollDbId)));
          return (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              <button
                onClick={() => { if (roll._rollDbId) onFelineInstinctsRequest(roll._rollDbId); }}
                className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${felineRequested ? 'border-amber-500 bg-amber-800/80 text-amber-100' : 'border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100'}`}
                title={felineRequested ? 'Reroll requested — click to cancel' : 'Spend 2 Hope to reroll Hope Die (Feline Instincts) — request GM to perform'}
              >
                {felineRequested ? <Check size={12} className="shrink-0" /> : <RotateCcw size={10} />}
                Spend 2 Hope to reroll Hope Die
              </button>
            </div>
          );
        })()}
        {/* Ranger's Focus: "End Focus to reroll Duality" — visible to player when not showActions so they can request GM */}
        {!showActions && resolved && dominant === 'fear' && hasDamage && rangerFocusRerollChar && onRangerFocusRerollRequest && (() => {
          const rangerRequested = !!(roll._rangerFocusRerollRequestedBy || (rangerFocusRequestedBannerIds && rangerFocusRequestedBannerIds.has(roll._rollDbId)));
          return (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              <button
                onClick={() => { if (roll._rollDbId) onRangerFocusRerollRequest(roll._rollDbId); }}
                className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${rangerRequested ? 'border-emerald-500 bg-emerald-800/80 text-emerald-100' : 'border-emerald-700 bg-emerald-900/50 text-emerald-200 hover:bg-emerald-800 hover:text-emerald-100'}`}
                title={rangerRequested ? 'Reroll requested — click to cancel' : "End Ranger's Focus to reroll Duality dice — request GM to perform"}
              >
                {rangerRequested ? <Check size={12} className="shrink-0" /> : <RotateCcw size={10} />}
                End Ranger's Focus to reroll Duality dice
              </button>
            </div>
          );
        })()}
        {/* Hold Them Off (Ranger): toggle — visible to player when not showActions so they can toggle before GM acknowledges */}
        {!showActions && resolved && holdThemOffChar && onHoldThemOffToggle && roll._rollDbId && (
          <div className="mt-2.5 pt-2 border-t border-white/10">
            <button
              onClick={() => onHoldThemOffToggle(roll._rollDbId, !holdThemOffActive)}
              className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${holdThemOffActive ? 'border-amber-500 bg-amber-800/80 text-amber-100' : 'border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100'}`}
              title={holdThemOffActive ? 'On — select up to 3 targets (3 Hope when 2–3 targets)' : 'Spend 3 Hope to select two more targets'}
            >
              {holdThemOffActive ? <Check size={12} className="shrink-0" /> : null}
              Spend 3 Hope to select two more targets
            </button>
          </div>
        )}
        {/* Wings of Light (Winged Sentinel): d8 toggle — visible to player so they can signal intent before GM acknowledges */}
        {!showActions && resolved && hasDamage && wingsOfLightFlyingInstanceIds?.has(roll._attackerInstanceId) && onWingsD8ToggleRequest && roll._rollDbId && (
          <div className="mt-2.5 pt-2 border-t border-white/10">
            {(() => {
              const wingsActive = !!roll._wingsOfLightAddD8;
              const wingsD8Result = roll._wingsOfLightD8Result;
              return (
                <button
                  type="button"
                  onClick={() => onWingsD8ToggleRequest(roll._rollDbId, !wingsActive)}
                  disabled={wingsActive && wingsD8Result != null}
                  className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                    wingsActive
                      ? 'border-amber-500 bg-amber-800/80 text-amber-100'
                      : 'border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100'
                  } disabled:opacity-60 disabled:cursor-default`}
                  title={wingsActive ? (wingsD8Result != null ? `+d8: ${wingsD8Result} — already applied` : 'Spend 1 Hope to add d8 to damage (applied on GM Acknowledge)') : 'Spend a Hope to add a d8 to damage'}
                >
                  {wingsActive ? <Check size={12} className="shrink-0" /> : null}
                  {wingsD8Result != null ? `+d8: ${wingsD8Result} (Spend 1 Hope)` : 'Spend 1 Hope to add d8 to damage'}
                </button>
              );
            })()}
          </div>
        )}
        {/* Prayer Die: damage-reduction display for players (GM sees it in the target area above) */}
        {!showActions && resolved && hasDamage && prayerDiceChars.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-white/10">
            <div className="flex flex-wrap justify-center gap-1">
              {prayerDiceChars.map(die => {
                const isSelected = selectedDmgReduceDie?.id === die.id;
                return (
                  <button
                    key={die.id}
                    type="button"
                    onClick={() => selectDmgReduceDie(isSelected ? null : die)}
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                      isSelected
                        ? 'border-teal-500 bg-teal-900/50 text-teal-200'
                        : 'border-teal-700/60 text-teal-300/90 hover:bg-teal-950/40'
                    }`}
                    title={isSelected ? 'Remove Prayer Die damage reduction' : `Use ${die.ownerName}'s Prayer Die (${die.value}) to reduce damage`}
                  >
                    {isSelected ? <Check size={10} /> : null}
                    {die.ownerName}: −{die.value} Prayer Die
                  </button>
                );
              })}
            </div>
            {selectedDmgReduceDie && (
              <p className="text-[10px] text-teal-400/70 text-center mt-0.5">Prayer Die reduces damage — ask GM to apply</p>
            )}
          </div>
        )}
        {/* Fearless (Infernis): toggle button — visible to both GM and character's own player */}
        {resolved && fearlessChar && onFearlessConvert && (
          <div className={showActions ? '' : 'mt-2.5 pt-2 border-t border-white/10'}>
            <button
              onClick={isConverted || fearlessChar.canConvert ? () => onFearlessConvert(roll, fearlessChar.instanceId) : undefined}
              disabled={!isConverted && !fearlessChar.canConvert}
              className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1 ${
                isConverted
                  ? 'border-amber-500 bg-amber-800/60 text-amber-100 hover:bg-amber-700/70 cursor-pointer'
                  : fearlessChar.canConvert
                    ? 'border-amber-600 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100 cursor-pointer'
                    : 'border-slate-600 bg-slate-800/40 text-slate-500 cursor-not-allowed'
              }`}
              title={
                isConverted
                  ? `${fearlessChar.name}: click to revert to Fear (Fearless)`
                  : fearlessChar.canConvert
                    ? `${fearlessChar.name} marks 2 Stress (on Acknowledge) to change Fear to Hope (Fearless)`
                    : `${fearlessChar.name} needs 2 empty Stress boxes to use Fearless`
              }
            >
              {isConverted ? 'Changed to Hope — click to revert' : 'Mark 2 stress to change Fear to Hope'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DiceRoller ──────────────────────────────────────────────────────────────
// Imperative API (via ref): addRoll(roll), updateRoll(optId, realData), dismiss(), dismissBannerId(bannerId), dismissBannerByDbId(dbId)
// Props: isPlayer, onBannerAcknowledge, onBannerCancel, lifeSupportSelections, onLifeSupportSelect, onLifeSupportClear,
//        targets, onApplyDamage, canApplyDamage,
//        onLuckyReroll, onQuickTarget, onDoubledUpTarget, onBouncingTarget,
//        wizardsWithHope, onNotThisTime

export const DiceRoller = forwardRef(function DiceRoller({
  isPlayer = false,
  currentUserUid = null,
  onBannerAcknowledge,
  onBannerCancel,
  lifeSupportSelections = {},
  onLifeSupportSelect,
  onLifeSupportClear,
  makeASceneSelections = {},
  onMakeASceneSelect,
  makeASceneAdversaries = [],
  targets,
  getTargetsForRoll,
  onApplyDamage,
  onApplyVulnerable,
  canApplyDamage = true,
  onLuckyReroll,
  onQuickTarget,
  onDoubledUpTarget,
  onBouncingTarget,
  wizardsWithHope = [],
  onNotThisTime,
  fearlessChars = [],
  fearlessConvertedBannerIds,
  onFearlessConvert,
  felineInstinctsChars = [],
  onFelineInstinctsReroll,
  onFelineInstinctsRequest,
  felineRequestedBannerIds,
  tableCharacters = [],
  rangerFocusRerollChars = [],
  onRangerFocusReroll,
  onRangerFocusRerollRequest,
  rangerFocusRequestedBannerIds,
  holdThemOffChars = [],
  onHoldThemOffToggle,
  wingsOfLightFlyingInstanceIds,
  onWingsD8Toggle,
  onWingsD8ToggleRequest,
  onGetWingsD8Extra,
  getWaterRetaliationNames,
  prayerDiceChars = [],
  onPrayerDieSelect,
}, ref) {
  const containerRef   = useRef(null);
  const containerIdRef = useRef(`dice-canvas-container-${Date.now()}`);
  const diceBoxRef     = useRef(null);
  const initDoneRef    = useRef(false);
  const onBannerAcknowledgeRef = useRef(onBannerAcknowledge);
  const onBannerCancelRef      = useRef(onBannerCancel);
  useEffect(() => { onBannerAcknowledgeRef.current = onBannerAcknowledge; }, [onBannerAcknowledge]);
  useEffect(() => { onBannerCancelRef.current = onBannerCancel; }, [onBannerCancel]);
  // onCompleteRef removed — effects are now triggered via onBannerAcknowledge/onBannerCancel props

  // activeBannersRef is the source of truth; activeBanners state is the rendering mirror.
  // All mutations update the ref synchronously first, then trigger re-render via setActiveBanners.
  const activeBannersRef = useRef([]); // [{ _bannerId, roll, resolved }]
  const [activeBanners, setActiveBanners] = useState([]);

  // dbIds for which a dismiss was triggered before updateRoll stamped _rollDbId (race condition).
  // updateRoll checks this set and auto-dismisses if the newly-stamped id is pending.
  const pendingDismissalsRef = useRef(new Set());

  // Serial dice animation state
  const diceQueueRef    = useRef([]); // _bannerIds waiting for dice animation
  const animatingIdRef  = useRef(null); // _bannerId currently animating

  function syncBanners(newBanners) {
    activeBannersRef.current = newBanners;
    setActiveBanners(newBanners);
  }

  // ── Dice animation ─────────────────────────────────────────────────────────

  async function animateGroups(groups) {
    const db = diceBoxRef.current;
    if (!db) return;

    const colorSets = await Promise.all(
      groups.map(g => db.DiceColors.makeColorSet(getColorsetForLabel(g.label)))
    );

    db.clearDice();

    const allVectors = [];
    const groupRanges = [];

    for (let i = 0; i < groups.length; i++) {
      db.DiceFactory.applyColorSet(colorSets[i]);
      db.colorData = colorSets[i];

      const startPos = {
        x: (Math.random() * 2 - 0.5) * db.display.currentWidth,
        y: -(Math.random() * 2 - 0.5) * db.display.currentHeight,
      };
      const dist = Math.sqrt(startPos.x ** 2 + startPos.y ** 2) + 100;
      const force = (Math.random() + 3) * dist * db.strength;
      const nv = db.getNotationVectors(groupNotation(groups[i]), startPos, force, dist);
      if (!nv?.vectors?.length) continue;

      const startIdx = db.diceList.length;
      for (const vec of nv.vectors) {
        db.spawnDice(vec);
        allVectors.push(vec);
      }
      groupRanges.push({ nv, startIdx, count: nv.vectors.length });
    }

    if (!db.diceList.length) return;

    db.simulateThrow();
    db.steps = 0;
    db.iteration = 0;

    for (let i = 0; i < db.diceList.length; i++) {
      if (db.diceList[i]) db.spawnDice(allVectors[i], db.diceList[i]);
    }

    for (const { nv, startIdx } of groupRanges) {
      if (nv.result?.length) {
        for (let j = 0; j < nv.result.length; j++) {
          const die = db.diceList[startIdx + j];
          if (die && die.getLastValue().value !== nv.result[j]) {
            db.swapDiceFace(die, nv.result[j]);
          }
        }
      }
    }

    return new Promise((resolve) => {
      db.rolling = true;
      db.running = Date.now();
      db.last_time = 0;
      db.animateThrow(db.running, () => resolve());
    });
  }

  function startAnimation(groups, bannerId) {
    animateGroups(groups)
      .then(() => {
        // Only resolve if this banner is still the animating one and hasn't been dismissed
        if (animatingIdRef.current !== bannerId) return;
        animatingIdRef.current = null;
        syncBanners(activeBannersRef.current.map(b =>
          b._bannerId === bannerId ? { ...b, resolved: true } : b
        ));
        processNextDice();
      })
      .catch(() => {
        if (animatingIdRef.current !== bannerId) return;
        animatingIdRef.current = null;
        dismissBannerById(bannerId);
      });
  }

  function processNextDice() {
    if (animatingIdRef.current !== null) return;

    while (diceQueueRef.current.length > 0) {
      const nextId = diceQueueRef.current[0];
      const entry = activeBannersRef.current.find(b => b._bannerId === nextId);

      if (!entry || entry.resolved) {
        // Banner was dismissed or already resolved — skip
        diceQueueRef.current.shift();
        continue;
      }

      // Optimistic banner: set as animating and wait for updateRoll to provide real data
      if (entry.roll._optimistic) {
        animatingIdRef.current = nextId;
        return;
      }

      const groups = parseRollDice(entry.roll.subItems);
      if (!groups.length) {
        // No dice groups — resolve immediately without animation
        diceQueueRef.current.shift();
        syncBanners(activeBannersRef.current.map(b =>
          b._bannerId === nextId ? { ...b, resolved: true } : b
        ));
        processNextDice();
        return;
      }

      if (!initDoneRef.current) {
        // DiceBox not ready yet — set animating ID so init callback can resume
        animatingIdRef.current = nextId;
        return;
      }

      // Start animation
      animatingIdRef.current = nextId;
      diceQueueRef.current.shift();
      startAnimation(groups, nextId);
      return;
    }
  }

  // ── Banner management ──────────────────────────────────────────────────────

  /** Purely visual dismissal — no callbacks fired. */
  function dismissBannerById(bannerId) {
    const entry = activeBannersRef.current.find(b => b._bannerId === bannerId);
    if (!entry) return;
    if (animatingIdRef.current === bannerId) {
      diceBoxRef.current?.clearDice();
      animatingIdRef.current = null;
    }
    syncBanners(activeBannersRef.current.filter(b => b._bannerId !== bannerId));
    processNextDice();
  }

  /** Find a banner by its DB id (_rollDbId) and dismiss it visually. Called by the pendingBanners sync effect. */
  function dismissBannerByDbId(dbId) {
    const current = activeBannersRef.current;
    const entry = current.find(b => b.roll._rollDbId === dbId);
    if (!entry) {
      // Banner not yet stamped with _rollDbId (race: cancel arrived before HTTP response).
      // Park the id; updateRoll will dismiss the banner when it stamps _rollDbId.
      if (dbId != null) pendingDismissalsRef.current.add(dbId);
      return;
    }
    dismissBannerById(entry._bannerId);
  }

  /**
   * Stamp a DB id onto a banner identified by optId (used for action notifications which have no
   * updateRoll call). Also resolves any pending dismissal that arrived before the id was known.
   */
  function stampBannerDbId(optId, dbId) {
    if (dbId == null) return;
    const entry = activeBannersRef.current.find(b => b.roll._optId === optId);
    if (!entry) return;
    const bannerId = entry._bannerId;
    // Update _rollDbId without touching resolved state (banner is already visible)
    syncBanners(activeBannersRef.current.map(b =>
      b._bannerId === bannerId ? { ...b, roll: { ...b.roll, _rollDbId: dbId } } : b
    ));
    // If cancel arrived before this stamp, dismiss now
    if (pendingDismissalsRef.current.has(dbId)) {
      pendingDismissalsRef.current.delete(dbId);
      dismissBannerById(bannerId);
    }
  }

  /** Visual-only dismiss of all banners. */
  function dismiss() {
    diceBoxRef.current?.clearDice();
    animatingIdRef.current = null;
    diceQueueRef.current = [];
    syncBanners([]);
  }

  /** Visual-only dismiss of the first banner. */
  function dismissFirst() {
    const current = activeBannersRef.current;
    if (current.length === 0) return;
    dismissBannerById(current[0]._bannerId);
  }

  /** Resolve the currently rolling banner and any queued banners instantly (show result, no animation). */
  function resolveCurrentAndQueueInstantly() {
    const idsToResolve = new Set();
    if (animatingIdRef.current != null) idsToResolve.add(animatingIdRef.current);
    for (const id of diceQueueRef.current) idsToResolve.add(id);
    if (idsToResolve.size === 0) return;

    diceBoxRef.current?.clearDice();
    animatingIdRef.current = null;
    diceQueueRef.current = [];

    syncBanners(activeBannersRef.current.map(b =>
      idsToResolve.has(b._bannerId) ? { ...b, resolved: true } : b
    ));
  }

  /** Resolve a single banner instantly when clicked while its dice are rolling (show result, stop animation). */
  function resolveBannerInstantly(bannerId) {
    if (animatingIdRef.current !== bannerId) return;
    diceBoxRef.current?.clearDice();
    animatingIdRef.current = null;
    syncBanners(activeBannersRef.current.map(b =>
      b._bannerId === bannerId ? { ...b, resolved: true } : b
    ));
    processNextDice();
  }

  // ── Public API (imperative) ────────────────────────────────────────────────

  function addRoll(roll) {
    // Action notifications are always banner-only and immediately resolved.
    const isAction = !!roll._action;

    // History rolls restored on reconnect are already resolved — show as interactive banners
    // without dice animation so the GM can acknowledge them immediately.
    if (roll._fromHistory) {
      const bannerId = `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const entry = { _bannerId: bannerId, roll: { ...roll, _bannerId: bannerId }, resolved: true };
      let current = activeBannersRef.current;
      if (current.length >= 8) {
        const oldest = current.find(b => b.resolved);
        if (oldest) current = current.filter(b => b._bannerId !== oldest._bannerId);
      }
      syncBanners([...current, entry]);
      return;
    }

    // Decide whether to animate dice for this roll.
    // In player mode: only animate the player's own roll (_playerInitiated).
    //   Others' rolls skip dice if our own roll is animating or queued.
    // In GM mode: always animate.
    let animateDice = !isAction;
    if (animateDice && isPlayer) {
      if (roll._playerInitiated) {
        animateDice = true;
      } else {
        // Another player's roll arriving via banners subscription: skip dice if busy
        animateDice = animatingIdRef.current === null && diceQueueRef.current.length === 0;
      }
    }

    // If this roll will animate and something is already rolling or queued, resolve those instantly
    // so only this roll gets the dice animation.
    if (animateDice && (animatingIdRef.current != null || diceQueueRef.current.length > 0)) {
      resolveCurrentAndQueueInstantly();
    }

    const bannerId = `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resolved = isAction || !animateDice;
    const entry = { _bannerId: bannerId, roll: { ...roll, _bannerId: bannerId }, resolved };

    // If at cap, evict oldest resolved banner to make room
    let current = activeBannersRef.current;
    if (current.length >= 8) {
      const oldest = current.find(b => b.resolved);
      if (oldest) current = current.filter(b => b._bannerId !== oldest._bannerId);
    }

    syncBanners([...current, entry]);

    if (animateDice) {
      diceQueueRef.current.push(bannerId);
      processNextDice();
    }
  }

  /** Merge server snapshot fields (e.g. _felineRerollRequestedBy) into an existing banner by DB id. */
  function updateBannerRollByDbId(dbId, patch) {
    if (dbId == null) return;
    const current = activeBannersRef.current;
    const idx = current.findIndex(b => b.roll._rollDbId === dbId);
    if (idx < 0) return;
    const entry = current[idx];
    const mergedRoll = { ...entry.roll, ...patch };
    syncBanners(current.map((b, i) => i === idx ? { ...b, roll: mergedRoll } : b));
  }

  function updateRoll(optId, realData) {
    // Find the matching optimistic banner
    const entry = activeBannersRef.current.find(b => b.roll._optId === optId);
    if (!entry) {
      // No optimistic placeholder — add as new banner
      addRoll(realData);
      return;
    }

    const bannerId = entry._bannerId;
    const updatedRoll = { ...realData, _bannerId: bannerId, _optId: optId };

    // Update the banner's roll data and mark unresolved
    syncBanners(activeBannersRef.current.map(b =>
      b._bannerId === bannerId ? { ...b, roll: updatedRoll, resolved: false } : b
    ));

    // Race condition: dismiss arrived before this updateRoll call stamped _rollDbId.
    // The id was parked in pendingDismissals; now that we have the real id, dismiss the banner.
    if (updatedRoll._rollDbId != null && pendingDismissalsRef.current.has(updatedRoll._rollDbId)) {
      pendingDismissalsRef.current.delete(updatedRoll._rollDbId);
      dismissBannerById(bannerId);
      return;
    }

    // If this banner is the current animating one, start animation now
    if (animatingIdRef.current === bannerId) {
      if (initDoneRef.current) {
        const groups = parseRollDice(realData.subItems);
        if (groups.length) {
          // Remove from diceQueue (it wasn't shifted yet since it was optimistic)
          diceQueueRef.current = diceQueueRef.current.filter(id => id !== bannerId);
          startAnimation(groups, bannerId);
        } else {
          // No dice groups — resolve immediately
          animatingIdRef.current = null;
          syncBanners(activeBannersRef.current.map(b =>
            b._bannerId === bannerId ? { ...b, roll: updatedRoll, resolved: true } : b
          ));
          processNextDice();
        }
      }
      // If initDoneRef is false, the DiceBox init callback will handle this
    }
  }

  useImperativeHandle(ref, () => ({ addRoll, updateRoll, dismiss, dismissFirst, dismissBannerId: dismissBannerById, dismissBannerByDbId, stampBannerDbId, updateBannerRollByDbId }), [isPlayer]);

  // ── DiceBox initialization ─────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.id = containerIdRef.current;

    const db = new DiceBox(`#${containerIdRef.current}`, {
      assetPath:          '/dice-threejs/',
      gravity_multiplier: 400,
      light_intensity:    0.8,
      baseScale:          100,
      strength:           1,
      sounds:             false,
      shadows:            false,
      theme_surface:      'green-felt',
      theme_colorset:     'white',
      theme_material:     'glass',
      onRollComplete:     () => {},
      onAddDiceComplete:  () => {},
    });

    db.initialize()
      .then(() => {
        if (db.desk) db.desk.visible = false;
        initDoneRef.current = true;
        diceBoxRef.current  = db;

        // If there's a pending animation, kick it off now
        if (animatingIdRef.current !== null) {
          const entry = activeBannersRef.current.find(b => b._bannerId === animatingIdRef.current);
          if (entry && !entry.roll._optimistic && !entry.resolved) {
            const groups = parseRollDice(entry.roll.subItems);
            if (groups.length) {
              startAnimation(groups, animatingIdRef.current);
            } else {
              animatingIdRef.current = null;
              syncBanners(activeBannersRef.current.map(b =>
                b._bannerId === entry._bannerId ? { ...b, resolved: true } : b
              ));
              processNextDice();
            }
          }
        } else {
          processNextDice();
        }
      })
      .catch(err => console.error('[DiceRoller] init failed:', err));

    return () => {
      diceBoxRef.current = null;
      initDoneRef.current = false;
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Reserve bottom space so dice tumble above the banner strip and don't land under it
  const DICE_BOTTOM_RESERVE = '10rem';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: DICE_BOTTOM_RESERVE,
        }}
      />
      {/* Banner strip — left-aligned, no scroll; overflow hidden is fine */}
      {activeBanners.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '2.5rem',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.5rem',
            padding: '0 0.75rem',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          {activeBanners.map(entry => (
            entry.roll._action ? (
              <ActionBanner
                key={entry._bannerId}
                roll={entry.roll}
                lifeSupportSelectedId={entry.roll._rollDbId != null ? lifeSupportSelections[entry.roll._rollDbId] : undefined}
                onLifeSupportSelect={onLifeSupportSelect && entry.roll._rollDbId != null ? (instanceId) => onLifeSupportSelect(entry.roll._rollDbId, instanceId) : undefined}
                makeASceneSelectedId={entry.roll._rollDbId != null ? makeASceneSelections[entry.roll._rollDbId] : undefined}
                onMakeASceneSelect={onMakeASceneSelect && entry.roll._rollDbId != null ? (instanceId) => onMakeASceneSelect(entry.roll._rollDbId, instanceId) : undefined}
                makeASceneAdversaries={makeASceneAdversaries}
                targets={targets}
                onAcknowledge={!isPlayer ? (extra) => {
                  onBannerAcknowledgeRef.current?.(entry._bannerId, entry.roll, extra);
                  dismissBannerById(entry._bannerId);
                } : undefined}
                onCancel={(!isPlayer || (entry.roll._initiatorUid != null && entry.roll._initiatorUid === currentUserUid && entry.roll._action === true)) ? () => {
                  onBannerCancelRef.current?.(entry._bannerId, entry.roll);
                  dismissBannerById(entry._bannerId);
                } : undefined}
                disableDismiss={isPlayer}
              />
            ) : (
              <ResultBanner
                key={entry._bannerId}
                roll={{ ...entry.roll, _bannerId: entry._bannerId }}
                resolved={entry.resolved}
                onAcknowledge={!isPlayer ? (opts) => {
                  onBannerAcknowledgeRef.current?.(entry._bannerId, entry.roll, opts);
                  dismissBannerById(entry._bannerId);
                } : undefined}
                onCancel={!isPlayer ? () => {
                  onBannerCancelRef.current?.(entry._bannerId, entry.roll);
                  dismissBannerById(entry._bannerId);
                } : undefined}
                targets={targets}
                getTargetsForRoll={getTargetsForRoll}
                onApplyDamage={onApplyDamage}
                onApplyVulnerable={onApplyVulnerable}
                disableDismiss={isPlayer}
                canApplyDamage={canApplyDamage}
                onLuckyReroll={onLuckyReroll}
                onQuickTarget={onQuickTarget}
                onDoubledUpTarget={onDoubledUpTarget}
                onBouncingTarget={onBouncingTarget}
                wizardsWithHope={wizardsWithHope}
                onNotThisTime={onNotThisTime}
                fearlessChars={fearlessChars}
                fearlessConvertedBannerIds={fearlessConvertedBannerIds}
                onFearlessConvert={onFearlessConvert}
                felineInstinctsChars={felineInstinctsChars}
                onFelineInstinctsReroll={onFelineInstinctsReroll}
                onFelineInstinctsRequest={onFelineInstinctsRequest}
                felineRequestedBannerIds={felineRequestedBannerIds}
                tableCharacters={tableCharacters}
                rangerFocusRerollChars={rangerFocusRerollChars}
                onRangerFocusReroll={onRangerFocusReroll}
                onRangerFocusRerollRequest={onRangerFocusRerollRequest}
                rangerFocusRequestedBannerIds={rangerFocusRequestedBannerIds}
                holdThemOffChars={holdThemOffChars}
                onHoldThemOffToggle={onHoldThemOffToggle}
                wingsOfLightFlyingInstanceIds={wingsOfLightFlyingInstanceIds}
                onWingsD8Toggle={onWingsD8Toggle}
                onWingsD8ToggleRequest={onWingsD8ToggleRequest}
                onGetWingsD8Extra={onGetWingsD8Extra}
                prayerDiceChars={prayerDiceChars}
                onPrayerDieSelect={onPrayerDieSelect}
                getWaterRetaliationNames={getWaterRetaliationNames}
                isPlayer={isPlayer}
                onResolveInstantly={!entry.resolved ? () => resolveBannerInstantly(entry._bannerId) : undefined}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
});
