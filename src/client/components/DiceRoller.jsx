import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Info, Check, CheckCircle, AlertTriangle, RotateCcw, Shield, ChevronDown, CheckSquare, Loader2 } from 'lucide-react';
import DiceBox from '@3d-dice/dice-box-threejs';
import { Tooltip } from './Tooltip.jsx';
import { CustomSelect } from './forms/CustomSelect.jsx';
import { SHORT_REST_MOVES, LONG_REST_MOVES, getRestMoveDefinition } from '../lib/rest-moves.js';
import { postRollSilent } from '../lib/api.js';
import { parseSubDetails as _parseSubDetails, extractDetailsValues } from '../lib/dice-utils.js';
import { rangeFtToLabel } from '../lib/map-range.js';
import { rollShouldUseMapFilteredTargets, rollIsHitMissEligibleAttack } from '../lib/banner-target-roll.js';
import { formatTargetSummary, computeHpLoss } from '../lib/helpers.js';
import {
  wrapRoll,
  getWeaponTagAutomatedForBanner,
  getConditionalWeaponTagStatus,
  getWeaponTagInteractive,
  resolveWeaponTagDescriptor,
} from '../lib/game-table-mechanics.js';
import { MarkdownText } from '../lib/markdown.js';
import { mergeOptionAndFeatureTooltipMarkdown } from '../lib/guide-feature-card-tip-text.js';
import { usePortalHoverTooltip, PortalHoverTooltipLayer } from '../lib/portal-hover-tooltip.jsx';
import { FeatureResourceCostIcons } from './FeatureResourceCostIcons.jsx';
import { ACTION_LOOP_PHASE_UI } from '../lib/action-loop-phase-ui-icons.js';
import { shouldClearDiceCanvasOnBannerDismiss } from '../lib/dice-roller-clear-canvas.js';
import { BannerSheetDisplayNameLine } from '../lib/sheet-display-label-inline.jsx';
import { getGmHelperBannerSuffix, getGmHelperBannerTooltip } from '../lib/v2-chip-session-view.js';
import { sumPendingEvasionBonusFromFeatureState } from '../lib/v2-action-loop-bridge.js';
import { computeActionAckTouchesTableState } from '../lib/action-notification-banner.js';
import {
  V2_REVIEW_CHIP_INLINE_OPTION_MAX,
  V2_INLINE_GROUP_OUTER,
  V2_INLINE_GROUP_OUTER_SCROLL,
  V2_INLINE_GROUP_TITLE_ROW,
  V2_INLINE_SEG_BTN_BASE,
  V2_INLINE_SEG_TARGET_BTN,
  V2_INLINE_SEG_OFF,
  V2_INLINE_SEG_ON,
} from '../lib/v2-inline-select-ui.js';
import { V2SegmentedRowWrap } from './V2SegmentedRowWrap.jsx';
import {
  getInitialV2ReviewTargetSelection,
  primaryDamageTargetIsInPickList,
} from '../lib/v2-review-chip-target-selection.js';

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

/** Sub-items that are not preset (for 3D animation we only animate newly rolled dice). */
function subItemsForAnimation(subItems) {
  return (subItems || []).filter(s => !s._preset);
}

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
// Sub-items with "disadvantage" in pre are subtracted (e.g. Orc Sturdy).
function computeActionTotal(subItems) {
  let total = 0;
  for (const sub of (subItems || [])) {
    if (/damage/i.test(sub.pre || '')) continue;
    if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
    const v = parseInt(sub.result, 10);
    if (isNaN(v)) continue;
    if (/disadvantage/i.test(sub.pre || '')) { total -= v; continue; }
    total += v;
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

// Extract trailing " + N" from rollText (matches server rollFromText). Used so the dice string display shows the bonus (e.g. Know the Tide).
function getStaticModifierFromRollText(rollText) {
  if (!rollText || typeof rollText !== 'string') return 0;
  const m = rollText.match(/\s*\+\s*(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

// Extract " — disadvantage removed: label1, label2" from rollText (e.g. Goblin Surefooted). Returns the labels string or null.
function getDisadvantageRemovedFromRollText(rollText) {
  if (!rollText || typeof rollText !== 'string') return null;
  const m = rollText.match(/\s*—\s*disadvantage\s+removed:\s*(.+)$/i);
  return m ? m[1].trim() : null;
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
 * Compute conditional banner status for a tag using the merged weapon descriptor's
 * `bannerStatus(tag, roll)` hook.
 */
function getConditionalTagStatus(tag, roll, attackerEl) {
  return getConditionalWeaponTagStatus(tag, roll, attackerEl);
}

function RestBanner({
  roll,
  characters = [],
  restMovesForRoll = {},
  movesPerCharacter = {},
  restBannerChipsByInstanceId = {},
  restRefreshPreviewByInstanceId = {},
  onRestBannerV2Chip,
  onRestMoveSelect,
  canEditColumn,
  isPlayer,
  onAcknowledge,
  onCancel,
  disableDismiss,
  gmUid = null,
}) {
  const visible = useBannerVisible();
  const duration = roll._restDuration === 'long' ? 'Long' : 'Short';
  const defaultMoves = roll._restDuration === 'long' ? LONG_REST_MOVES : SHORT_REST_MOVES;
  const total = typeof roll.total === 'number' ? roll.total : 0;
  const fearN = roll._restDuration === 'long' ? total + characters.length : total;
  const rollDbId = roll._rollDbId;
  const [rollingKey, setRollingKey] = useState(null); // 'instanceId-slot' when rolling for that slot

  const allFilled = characters.length === 0 || characters.every(char => {
    const data = movesPerCharacter[char.instanceId];
    const slotCount = data && typeof data.shortSlots === 'number' && typeof data.longSlots === 'number'
      ? (roll._restDuration === 'long' ? data.longSlots : data.shortSlots)
      : 2;
    const sel = restMovesForRoll[char.instanceId] || {};
    for (let s = 1; s <= slotCount; s++) {
      if (sel['move' + s] == null) return false;
      const def = getRestMoveDefinition(sel['move' + s]);
      if (def?.rollDice && !sel['move' + s + 'RollResult']) return false;
    }
    return true;
  });

  const handleRestAcknowledge = () => {
    if (!allFilled) {
      if (!window.confirm('Not all rest moves are filled in. Acknowledge this rest anyway?')) return;
    }
    onAcknowledge?.();
  };

  const handleSelect = (instanceId, slot, moveId, options = {}) => {
    if (rollDbId == null || !onRestMoveSelect) return;
    const def = moveId ? getRestMoveDefinition(moveId) : null;
    if (def?.rollDice) {
      onRestMoveSelect(rollDbId, instanceId, slot, moveId, options);
      const key = `${instanceId}-${slot}`;
      setRollingKey(key);
      const rollText = ` [${def.rollDice}]`;
      postRollSilent(rollText, '', isPlayer ? gmUid : null)
        .then(res => {
          onRestMoveSelect(rollDbId, instanceId, slot, moveId, { ...options, rollResult: { dice: def.rollDice, value: res.value } });
        })
        .catch(() => {})
        .finally(() => setRollingKey(k => (k === key ? null : k)));
    } else {
      onRestMoveSelect(rollDbId, instanceId, slot, moveId, options);
    }
  };

  return (
    <div
      className="dice-result-banner select-none flex-shrink-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: 'auto',
        maxWidth: '95vw',
        minWidth: '560px',
      }}
    >
      <div className="px-4 py-3 rounded-xl shadow-2xl bg-dh-surface/90 border-2 border-dh-strong text-dh">
        <div className="text-base font-bold text-dh mb-2">{duration} Rest - Choose Your Moves</div>
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          {(roll.subItems || []).length > 0 && (
            <div className="flex items-center gap-1">
              {(roll.subItems || []).map((sub, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-dh-raised text-dh text-xs font-mono">
                  {sub.pre && <span className="text-dh-muted">{sub.pre} </span>}
                  {sub.result}
                </span>
              ))}
            </div>
          )}
          <span className="text-sm font-semibold text-dh-hope-soft">+{fearN} Fear</span>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[40vh] pb-1">
          {characters.map(char => {
            const data = movesPerCharacter[char.instanceId];
            const moves = data && Array.isArray(data.moves) ? data.moves : defaultMoves;
            const slotCount = data && typeof data.shortSlots === 'number' && typeof data.longSlots === 'number'
              ? (roll._restDuration === 'long' ? data.longSlots : data.shortSlots)
              : 2;
            const slotLabels = data && roll._restDuration === 'long'
              ? (Array.isArray(data.longSlotLabels) ? data.longSlotLabels : null)
              : (data && Array.isArray(data.shortSlotLabels) ? data.shortSlotLabels : null);
            const sel = restMovesForRoll[char.instanceId] || {};
            const baseCanEdit = canEditColumn ? canEditColumn(char.instanceId) : true;
            const otherChars = characters.filter(c => c.instanceId !== char.instanceId);
            // Flatten options so canTargetAlly moves appear as separate rows: "Tend to Wounds (Self)", "Tend to Wounds (Alice)", etc.
            const flattenOptions = (list) => list.flatMap(m => {
              const def = getRestMoveDefinition(m.id);
              if (def?.canTargetAlly) {
                return [
                  { ...m, _targetInstanceId: null, _targetName: 'Self' },
                  ...otherChars.map(c => ({ ...m, _targetInstanceId: c.instanceId, _targetName: c.name })),
                ];
              }
              return [m];
            });
            const findSelectedOption = (opts, slotNum) => opts.find(o => {
              if (o.id !== sel['move' + slotNum]) return false;
              const def = getRestMoveDefinition(o.id);
              if (!def?.canTargetAlly) return true;
              return (o._targetInstanceId ?? null) === (sel['move' + slotNum + 'TargetInstanceId'] ?? null);
            }) ?? null;
            const restChips = restBannerChipsByInstanceId[char.instanceId] || [];
            const refreshPreview = restRefreshPreviewByInstanceId[char.instanceId];
            const hasRefreshPreview =
              refreshPreview &&
              (refreshPreview.resetting.usageLabels.length > 0 ||
                refreshPreview.resetting.modifierLabels.length > 0 ||
                refreshPreview.resetting.notes.length > 0 ||
                refreshPreview.unusedQualifiedLabels.length > 0);
            return (
              <div key={char.instanceId} className="flex flex-col gap-1.5 border border-dh-strong rounded-lg px-2 py-1.5 bg-dh-raised/50">
                <div className="flex flex-row items-center gap-2 flex-wrap">
                  <div className="text-[11px] font-semibold text-dh truncate w-24 shrink-0" title={char.name}>{char.name}</div>
                  {restChips.length > 0 && onRestBannerV2Chip && (
                    <div className="flex flex-row flex-wrap gap-1 items-center flex-1 min-w-0">
                      {restChips.map((chip) => {
                        const chipDisabled = chip.disabled === true || chip.resourceUnaffordable === true;
                        const hint =
                          typeof chip.disableHint === 'string'
                            ? chip.disableHint
                            : chipDisabled && typeof chip.disabled === 'string'
                              ? chip.disabled
                              : undefined;
                        return (
                          <button
                            key={chip._chipKey || `${chip._featureName}-${chip.name}`}
                            type="button"
                            disabled={chipDisabled || !baseCanEdit}
                            title={hint}
                            onClick={() => {
                              if (chipDisabled || !baseCanEdit) return;
                              onRestBannerV2Chip(chip, char, isPlayer);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border max-w-[min(100%,14rem)] truncate ${
                              chipDisabled || !baseCanEdit
                                ? 'border-dh-muted/40 bg-dh-surface/40 text-dh-muted cursor-not-allowed'
                                : 'border-dh-hope/30 bg-dh-raised text-dh hover:bg-dh-strong'
                            }`}
                          >
                            {chip.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {hasRefreshPreview && (
                  <div className="text-[10px] text-dh-muted leading-snug space-y-0.5 border-t border-dh-border/50 pt-1.5">
                    {(refreshPreview.resetting.usageLabels.length > 0 ||
                      refreshPreview.resetting.modifierLabels.length > 0 ||
                      refreshPreview.resetting.notes.length > 0) && (
                      <div>
                        <span className="text-dh-hope-soft/90 font-semibold">Refreshes on acknowledge: </span>
                        <span className="text-dh/90">
                          {[
                            ...refreshPreview.resetting.usageLabels,
                            ...refreshPreview.resetting.modifierLabels.map((n) => `${n} (modifier)`),
                            ...refreshPreview.resetting.notes,
                          ].join(' · ')}
                        </span>
                      </div>
                    )}
                    {refreshPreview.unusedQualifiedLabels.length > 0 && (
                      <div>
                        <span className="font-semibold text-dh-muted">Qualified but unused (no refresh needed): </span>
                        <span>{refreshPreview.unusedQualifiedLabels.join(' · ')}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-row items-center gap-2 flex-wrap">
                {Array.from({ length: slotCount }, (_, i) => i + 1).map(slot => {
                  const options = flattenOptions(moves);
                  const moveVal = findSelectedOption(options, slot);
                  const def = moveVal ? getRestMoveDefinition(moveVal.id) : null;
                  const rollResult = sel['move' + slot + 'RollResult'];
                  const slotLocked = isPlayer && def?.rollDice && rollResult != null;
                  const canEditSlot = baseCanEdit && !slotLocked;
                  const isRolling = rollingKey === `${char.instanceId}-${slot}`;
                  const slotTitle = (slotLabels && slotLabels[slot - 1]) ?? `Move ${slot}`;
                  return (
                    <CustomSelect
                      key={slot}
                      value={moveVal}
                      onChange={(opt) => handleSelect(char.instanceId, slot, opt?.id ?? null, opt?._targetInstanceId !== undefined ? { targetInstanceId: opt._targetInstanceId } : {})}
                      options={options}
                      getOptionLabel={(m) => m._targetName != null ? `${m.name} (${m._targetName})` : m.name}
                      getOptionDescription={(m) => m.description}
                      getOptionKey={(m) => m._targetInstanceId !== undefined ? `${m.id}-${m._targetInstanceId ?? 'self'}` : m.id}
                      placeholder={slotTitle}
                      disabled={!canEditSlot}
                      className="text-xs flex-1 min-w-[220px] [&_button]:min-h-[3.5rem] [&_button_span]:whitespace-nowrap"
                      dropdownClassName="[&_button_span]:whitespace-nowrap"
                      renderValue={(m) => {
                        const tier = char?.tier ?? 1;
                        const rollVal = rollResult?.value ?? 0;
                        const hasDice = def?.rollDice;
                        const formulaLine = hasDice && rollResult != null
                          ? `${rollResult.dice} (${rollResult.value}) + Tier (${tier}) = ${rollVal + tier}`
                          : hasDice ? '\u00a0' : null;
                        return (
                          <span className="flex flex-col gap-0.5 justify-center">
                            <span className="flex items-center gap-1">
                              {m?._targetName != null ? `${m?.name} (${m._targetName})` : (m?.name ?? slotTitle)}
                              {isRolling && <Loader2 className="w-3 h-3 animate-spin text-sky-400 shrink-0" />}
                              {!isRolling && rollResult && <span className="text-sky-300 text-[10px]">({rollResult.dice} → {rollResult.value})</span>}
                            </span>
                            {formulaLine != null && (
                              <span className="text-[10px] text-dh-muted leading-tight">{formulaLine}</span>
                            )}
                          </span>
                        );
                      }}
                    />
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
        {(!disableDismiss || onCancel != null) && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {!disableDismiss && (
              <button
                type="button"
                onClick={handleRestAcknowledge}
                title={!allFilled ? 'Not all moves are chosen — click to confirm and acknowledge anyway' : undefined}
                className={`flex-1 min-w-0 px-3 py-1 rounded text-[11px] font-semibold border border-dh-strong bg-dh-hover text-dh hover:bg-dh-strong transition-colors ${!allFilled ? 'ring-1 ring-dh-hope/35' : ''}`}
              >
                Acknowledge
              </button>
            )}
            {onCancel != null && (
              <button
                onClick={onCancel}
                className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors"
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

function ActionBanner({ roll, onAcknowledge, onCancel, disableDismiss, lifeSupportSelectedId, onLifeSupportSelect, actionAdversarySelectedId, onActionAdversarySelect, actionAdversaryTargets = [], targets = [] }) {
  const visible = useBannerVisible();
  const displayName = roll.rollUser || roll.characterName || '';
  const lifeSupportTargets = roll._lifeSupportTargets;
  const isLifeSupport = lifeSupportTargets != null;
  const selectedLifeSupportInstanceId = lifeSupportSelectedId ?? null;

  // Action banner with adversary target: use the always-current actionAdversaryTargets prop (safe for GM + player).
  const isActionAdversary = roll._action && roll._targetType === 'adversary';
  const actionAdversaryTargetsList = isActionAdversary ? actionAdversaryTargets : null;
  const selectedActionAdversaryInstanceId = actionAdversarySelectedId ?? null;
  const selectedActionAdversaryName = actionAdversaryTargetsList?.find(t => t.instanceId === selectedActionAdversaryInstanceId)?.name ?? null;
  const [actionAdversaryMenuRect, setActionAdversaryMenuRect] = useState(null);

  const needsLifeSupportSelection = isLifeSupport && (lifeSupportTargets?.length ?? 0) > 0;
  const needsActionAdversarySelection = isActionAdversary && (actionAdversaryTargetsList?.length ?? 0) > 0;
  const canAcknowledge =
    (!needsLifeSupportSelection || selectedLifeSupportInstanceId != null) &&
    (!needsActionAdversarySelection || selectedActionAdversaryInstanceId != null);

  // Hide Cancel when Ack would not change table state (mirrors GMTableView handleBannerAcknowledge for _action).
  // V2 actionLoop notices (mutations already applied) and other informational actions only need Acknowledge.
  // Start Session: show Cancel so the GM can dismiss without starting the session (suppression stays off in shouldSuppressActionBanner).
  const actionAckTouchesTableState = computeActionAckTouchesTableState(roll, { actionAdversaryTargets });
  const showActionBannerCancel = onCancel != null && (roll._sessionStart || actionAckTouchesTableState);

  const handleAcknowledge = () => {
    const extra = {};
    if (isLifeSupport && selectedLifeSupportInstanceId) extra.selectedLifeSupportTargetInstanceId = selectedLifeSupportInstanceId;
    if (isActionAdversary && selectedActionAdversaryInstanceId) extra.selectedActionAdversaryTargetInstanceId = selectedActionAdversaryInstanceId;
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
        className="px-5 py-3 rounded-xl shadow-2xl text-center bg-dh-surface/90 border-2 border-dh-strong text-dh"
      >
        {displayName && (
          <div className="text-[11px] uppercase tracking-widest text-dh-muted mb-1">{displayName}</div>
        )}
        <div className="text-base font-bold text-dh mb-1">{actionTitle}</div>
        {roll.actionText && (
          <MarkdownText text={roll.actionText} className="text-[12px] text-dh mb-2 text-left dh-md" />
        )}
        {(roll.tags || []).length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {(roll.tags || []).map((tag, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded px-2 py-1 text-left border bg-dh-inset border-dh-strong">
                <Info size={10} className="text-sky-400 shrink-0 mt-0.5" />
                <div className="text-[10px] leading-snug min-w-0 flex-1">
                  <span className="font-bold text-dh">{tag.name}:</span>{' '}
                  <MarkdownText text={tag.text || ''} className="text-dh-muted dh-md text-[10px] leading-snug" />
                </div>
              </div>
            ))}
          </div>
        )}
        {(roll._rousingSpeechTargets != null) && (
          <div className="mb-2">
            <div className="text-[10px] text-dh-muted mb-1 uppercase tracking-wider">
              Clear 2 Stress each:
            </div>
            {roll._rousingSpeechTargets.length === 0 ? (
              <div className="text-[10px] text-dh-muted italic">No other characters within Far range</div>
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
        {isActionAdversary && (
          <div className="mb-2">
            <div className="text-[10px] text-dh-muted mb-1 uppercase tracking-wider">
              −2 Difficulty on:
            </div>
            {(actionAdversaryTargetsList?.length ?? 0) === 0 ? (
              <div className="text-[10px] text-dh-muted italic">No adversaries on the table</div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => setActionAdversaryMenuRect(e.currentTarget.getBoundingClientRect())}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                    selectedActionAdversaryInstanceId
                      ? 'ring-1 ring-sky-500/50 bg-sky-950/45 border-sky-500 text-dh'
                      : 'bg-dh-raised/80 border-dh-strong text-dh hover:bg-dh-hover hover:border-dh-muted'
                  }`}
                >
                  <ChevronDown size={10} />
                  {selectedActionAdversaryName ?? 'Choose adversary'}
                </button>
                {actionAdversaryMenuRect != null && createPortal(
                  <>
                    <div className="fixed inset-0 z-[400]" onClick={() => setActionAdversaryMenuRect(null)} />
                    <div
                      className="fixed z-[401] rounded-lg border border-dh-strong bg-dh-surface shadow-2xl p-2 space-y-1"
                      style={{
                        top: Math.min(actionAdversaryMenuRect.bottom + 4, window.innerHeight - 200),
                        left: Math.min(actionAdversaryMenuRect.left, window.innerWidth - 200),
                        minWidth: '160px',
                        maxWidth: '240px',
                      }}
                    >
                      {actionAdversaryTargetsList.map(t => {
                        const sum = formatTargetSummary(t, { hideMax: false });
                        const isSelected = t.instanceId === selectedActionAdversaryInstanceId;
                        return (
                          <button
                            key={t.instanceId}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onActionAdversarySelect?.(t.instanceId); setActionAdversaryMenuRect(null); }}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium border transition-colors ${
                              isSelected
                                ? 'border-sky-500 bg-sky-950/45 text-dh'
                                : 'border-dh-strong bg-dh-raised/80 text-dh hover:bg-dh-hover hover:border-sky-500/60'
                            }`}
                          >
                            <div>{t.name}</div>
                            <div className="text-[10px] text-dh-muted mt-0.5">
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
            <div className="text-[10px] text-dh-muted mb-1 uppercase tracking-wider">
              Clear 1 HP on (choose one):
            </div>
            {(lifeSupportTargets?.length ?? 0) === 0 ? (
              <div className="text-[10px] text-dh-muted italic">No other characters within Close range with marked HP</div>
            ) : (
              <div
                className={V2_INLINE_GROUP_OUTER_SCROLL}
                role="group"
                aria-label="Life Support ally"
              >
                {lifeSupportTargets.map((t) => {
                  const selected = t.instanceId === selectedLifeSupportInstanceId;
                  return (
                    <button
                      key={t.instanceId}
                      type="button"
                      onClick={() => onLifeSupportSelect?.(t.instanceId)}
                      className={`${V2_INLINE_SEG_TARGET_BTN} ${selected ? V2_INLINE_SEG_ON : V2_INLINE_SEG_OFF} ${!disableDismiss ? '' : 'cursor-default'}`}
                    >
                      <span className="break-words font-semibold">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {(!disableDismiss || showActionBannerCancel) && (
          <div className="flex items-center justify-center gap-1.5">
            {!disableDismiss && (
              <button
                onClick={handleAcknowledge}
                disabled={!canAcknowledge}
                className="flex-1 min-w-0 px-3 py-1 rounded text-[11px] font-semibold border border-dh-strong bg-dh-hover text-dh hover:bg-dh-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-dh-hover"
              >
                Acknowledge
              </button>
            )}
            {showActionBannerCancel && (
              <button
                onClick={onCancel}
                className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors"
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

/**
 * V2 engine review chip: optional `isSelect` / `selectTargets` pickers + Confirm (Phase B).
 */
function V2ReviewChipRow({
  chip,
  roll,
  phaseKey,
  rowIndex,
  resolveV2ReviewChipPicker,
  onV2ReviewChip,
  isPlayer,
  primaryDamageTargetId,
  getV2ReviewChipDisableHint,
  /** When true, assigned players may use V2 review chips (same as GM). */
  canUseV2ReviewChips,
}) {
  const needsIsSelect = typeof chip.isSelect === 'function';
  const needsTargets = typeof chip.selectTargets === 'function';
  const picker = resolveV2ReviewChipPicker?.(chip, roll);
  const label = chip.description || chip.name || chip._featureName || 'Feature';
  const featureDescRaw = typeof chip.description === 'string' ? chip.description.trim() : '';
  /** Feature tooltip for whole isSelect / selectTargets chip shells (not per-button). */
  const chipFeatureTooltipMd = featureDescRaw || label;
  const stableKey = chip._chipKey || `${phaseKey}-${chip._featureName}-${rowIndex}`;
  const consumed = chip._v2BannerOnUseConsumed === true;

  const segHover = usePortalHoverTooltip();
  const inlineMultiBankRef = useRef(null);
  const inlineSingleBankRef = useRef(null);
  const selectTargetsBankRef = useRef(null);
  const reviewPickerRowTipMd = (row) => {
    const d = typeof row?.description === 'string' ? row.description.trim() : '';
    if (!d) return '';
    return mergeOptionAndFeatureTooltipMarkdown(d, featureDescRaw);
  };

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);

  // Reset picker state only when this banner row identity changes — not on every `roll` object
  // reference from SSE (that was clearing multi-target picks, e.g. Hold Them Off extras).
  useEffect(() => {
    setSelectedIds([]);
    const p = resolveV2ReviewChipPicker?.(chip, roll);
    const pickTargets = Array.isArray(p?.selectTargets) ? p.selectTargets : [];
    setSelectedTargetIds(
      getInitialV2ReviewTargetSelection(pickTargets, { needsTargets, primaryDamageTargetId })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only stableKey+_rollDbId (omit roll ref, picker fn, primary — avoids SSE/table churn resetting picks)
  }, [stableKey, roll._rollDbId]);

  // When the primary damage target becomes available and it is one of this chip's pickable targets,
  // seed selection (chips that exclude the primary, e.g. Hold Them Off, skip via validIds check).
  useEffect(() => {
    if (!needsTargets || !primaryDamageTargetId) return;
    const p = resolveV2ReviewChipPicker?.(chip, roll);
    const pickTargets = Array.isArray(p?.selectTargets) ? p.selectTargets : [];
    if (!primaryDamageTargetIsInPickList(pickTargets, primaryDamageTargetId)) return;
    setSelectedTargetIds((prev) => {
      if (prev.length > 0) return prev;
      return [primaryDamageTargetId];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrow deps; picker must stay fresh via closure without resetting on activeElements churn
  }, [primaryDamageTargetId, stableKey, roll._rollDbId]);

  const maxSel = Math.max(1, Math.min(99, picker?.maxSelections ?? 1));
  const options = Array.isArray(picker?.isSelectOptions) ? picker.isSelectOptions : [];
  const pickTargets = Array.isArray(picker?.selectTargets) ? picker.selectTargets : [];

  const optionId = (o) => (o && (o.id != null ? o.id : o.value));
  const optionLabel = (o) => (o && (o.name ?? o.label ?? String(optionId(o) ?? ''))) || '';

  const actorInstanceId = (t) => (t && (t.instanceId != null ? t.instanceId : t.id));

  const toggleId = (id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      if (!chip.multiSelect) return [sid];
      const has = prev.some((x) => String(x) === sid);
      if (has) return prev.filter((x) => String(x) !== sid);
      if (prev.length >= maxSel) return [...prev.slice(1), sid];
      return [...prev, sid];
    });
  };

  const toggleTarget = (tid) => {
    setSelectedTargetIds((prev) => {
      if (!chip.multiSelect) return [tid];
      const has = prev.includes(tid);
      if (has) return prev.filter((x) => x !== tid);
      if (prev.length >= maxSel) return [...prev.slice(1), tid];
      return [...prev, tid];
    });
  };

  const needsPrimaryFirst = needsTargets && !primaryDamageTargetId;

  const canConfirm = () => {
    if (needsPrimaryFirst) return false;
    if (needsIsSelect) {
      if (chip.multiSelect) return selectedIds.length > 0 && selectedIds.length <= maxSel;
      return selectedIds.length === 1 && selectedIds[0] != null && selectedIds[0] !== '';
    }
    if (needsTargets) return selectedTargetIds.length > 0;
    return true;
  };

  const doConfirm = () => {
    const selectOpts = {};
    if (needsIsSelect) {
      if (chip.multiSelect) selectOpts.selectedIds = selectedIds.map((x) => String(x));
      else if (selectedIds[0] != null && selectedIds[0] !== '') selectOpts.selectedId = String(selectedIds[0]);
    }
    if (needsTargets) selectOpts.selectedTargetIds = [...selectedTargetIds];
    onV2ReviewChip?.(chip, roll, selectOpts);
  };

  const playerMayUse =
    canUseV2ReviewChips !== undefined ? canUseV2ReviewChips : !isPlayer;
  const blockedBase = chip.disabled || chip.resourceUnaffordable || !playerMayUse;
  const needsPickerUi = needsIsSelect || needsTargets;
  /** Single `isSelect` only (e.g. Prayer Die — Action): apply on pick — same UX as GuideFeatureCard. */
  const singleSelectImmediate =
    needsIsSelect && !needsTargets && !chip.multiSelect && options.length > 0;
  const showApply = needsPickerUi && !singleSelectImmediate;
  const pickerMissing = needsPickerUi && !picker;
  const blocked = blockedBase || pickerMissing || (needsPickerUi && needsPrimaryFirst);

  const useInlineIsSelect =
    needsIsSelect &&
    options.length > 0 &&
    options.length <= V2_REVIEW_CHIP_INLINE_OPTION_MAX;
  /** Hide panel title when the chip name row is already inside an inline isSelect or selectTargets group. */
  const hideOuterChipTitleRow =
    (needsIsSelect && options.length > 0 && (useInlineIsSelect || !chip.multiSelect)) ||
    (needsTargets && pickTargets.length > 0);
  const blockHint =
    isPlayer && !playerMayUse
      ? 'Assign a character to you to use V2 review chips.'
      : [chip.disableHint, getV2ReviewChipDisableHint?.(chip, roll)].find(Boolean) ||
        (chip.resourceUnaffordable ? 'Cannot afford resource costs.' : null) ||
        (chip.disabled ? 'Unavailable right now.' : null);

  if (consumed) {
    return (
      <Tooltip key={stableKey} label="Applied" placement="bottom-left" className="relative flex w-full min-w-0">
        <div
          role="status"
          className="w-full flex items-center gap-2 text-left px-2 py-1 rounded text-[11px] border border-dh-strong/50 bg-dh-surface/50 text-dh-muted"
        >
          <CheckSquare className="shrink-0 text-emerald-500/90" size={14} strokeWidth={2.5} aria-hidden />
          <span className="min-w-0">
            <span className="font-semibold text-dh">{chip._featureName}</span>
            {chip.name && chip.name !== chip._featureName ? (
              <span className="text-dh-muted"> — {chip.name}</span>
            ) : null}
          </span>
        </div>
      </Tooltip>
    );
  }

  if (!needsPickerUi) {
    const tip = blockedBase ? blockHint || 'Unavailable' : label;
    return (
      <Tooltip key={stableKey} label={tip} placement="bottom-left" className="relative flex w-full min-w-0">
        <button
          type="button"
          disabled={blockedBase}
          onClick={() => onV2ReviewChip?.(chip, roll)}
          className={`w-full text-left px-2 py-1 rounded text-[11px] border transition-colors ${
            blockedBase
              ? 'border-dh-strong/50 bg-dh-surface/40 text-dh-muted cursor-not-allowed'
              : 'border-dh-strong bg-dh-raised text-dh hover:bg-dh-hover'
          }`}
        >
          <span className="font-semibold text-dh">{chip._featureName}</span>
          {chip.name && chip.name !== chip._featureName ? (
            <span className="text-dh-muted"> — {chip.name}</span>
          ) : null}
          <FeatureResourceCostIcons action={chip} iconSize={9} className="ml-0.5" />
        </button>
      </Tooltip>
    );
  }

  const panel = (
    <div
      key={stableKey}
      className="rounded border border-dh-border bg-dh-inset px-2 py-2 space-y-1.5"
    >
      {!hideOuterChipTitleRow ? (
        <div className="text-[11px] text-dh flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <span className="font-semibold text-dh">{chip._featureName}</span>
          {chip.name && chip.name !== chip._featureName ? (
            <span className="text-dh-muted"> — {chip.name}</span>
          ) : null}
          <FeatureResourceCostIcons action={chip} iconSize={9} className="ml-0.5" />
        </div>
      ) : null}
      {needsIsSelect && options.length === 0 ? (
        <p className="text-[9px] text-dh-muted">No options available for this chip.</p>
      ) : null}
      {needsIsSelect && options.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {chip.multiSelect && !useInlineIsSelect ? (
            <Tooltip
              content={<MarkdownText text={chipFeatureTooltipMd} className="text-[11px] leading-relaxed dh-md" />}
              placement="bottom-left"
              className="relative block w-full min-w-0"
            >
              <div className="w-full min-w-0 flex flex-col gap-1">
                {options.map((o) => {
                  const id = optionId(o);
                  const idStr = id != null ? String(id) : '';
                  const checked = id != null && selectedIds.some((x) => String(x) === idStr);
                  return (
                    <label
                      key={String(id)}
                      className="flex items-center gap-2 text-[10px] text-dh cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-dh-strong"
                        checked={checked}
                        onChange={() => id != null && toggleId(idStr)}
                        disabled={blockedBase}
                      />
                      <span>{optionLabel(o)}</span>
                    </label>
                  );
                })}
              </div>
            </Tooltip>
          ) : null}
          {chip.multiSelect && useInlineIsSelect ? (
            <div className="w-full min-w-0">
              <div className={V2_INLINE_GROUP_OUTER} role="group" aria-label={label}>
                <Tooltip
                  content={<MarkdownText text={chipFeatureTooltipMd} className="text-[11px] leading-relaxed dh-md" />}
                  placement="bottom-left"
                  className="relative block w-full min-w-0"
                >
                  <div className={V2_INLINE_GROUP_TITLE_ROW}>
                    <span className="font-semibold text-[11px] min-w-0 shrink break-words">{chip._featureName}</span>
                    {chip.name && chip.name !== chip._featureName ? (
                      <span className="text-dh-muted text-[10px] min-w-0 shrink break-words"> — {chip.name}</span>
                    ) : null}
                    <FeatureResourceCostIcons action={chip} iconSize={9} className="shrink-0" />
                  </div>
                </Tooltip>
                <div ref={inlineMultiBankRef} className="w-full min-w-0">
                <V2SegmentedRowWrap key={`${stableKey}-${roll._rollDbId}-msel`}>
                  {options.map((o) => {
                    const id = optionId(o);
                    const idStr = id != null ? String(id) : '';
                    const on = id != null && selectedIds.some((x) => String(x) === idStr);
                    const optMd = reviewPickerRowTipMd(o);
                    return (
                      <button
                        key={String(id)}
                        type="button"
                        disabled={blockedBase}
                        onMouseEnter={(e) => {
                          if (blockedBase || !optMd) return;
                          segHover.showFromPointerEvent(e, {
                            anchorRef: inlineMultiBankRef,
                            label: optionLabel(o),
                            description: optMd,
                            wide: false,
                          });
                        }}
                        onMouseLeave={segHover.scheduleClose}
                        onClick={() => id != null && toggleId(idStr)}
                        className={`${V2_INLINE_SEG_BTN_BASE} ${on ? V2_INLINE_SEG_ON : V2_INLINE_SEG_OFF}`}
                      >
                        <span className="break-words">{optionLabel(o)}</span>
                      </button>
                    );
                  })}
                </V2SegmentedRowWrap>
                </div>
              </div>
            </div>
          ) : null}
          {!chip.multiSelect && useInlineIsSelect ? (
            <div className="w-full min-w-0">
              <div className={V2_INLINE_GROUP_OUTER} role="group" aria-label={label}>
                <Tooltip
                  content={<MarkdownText text={chipFeatureTooltipMd} className="text-[11px] leading-relaxed dh-md" />}
                  placement="bottom-left"
                  className="relative block w-full min-w-0"
                >
                  <div className={V2_INLINE_GROUP_TITLE_ROW}>
                    <span className="font-semibold text-[11px] min-w-0 shrink break-words">{chip._featureName}</span>
                    {chip.name && chip.name !== chip._featureName ? (
                      <span className="text-dh-muted text-[10px] min-w-0 shrink break-words"> — {chip.name}</span>
                    ) : null}
                    <FeatureResourceCostIcons action={chip} iconSize={9} className="shrink-0" />
                  </div>
                </Tooltip>
                <div ref={inlineSingleBankRef} className="w-full min-w-0">
                <V2SegmentedRowWrap key={`${stableKey}-${roll._rollDbId}-ssel`}>
                  {options.map((o) => {
                    const id = optionId(o);
                    const idStr = id != null ? String(id) : '';
                    const selected =
                      selectedIds.length === 1 && id != null && String(selectedIds[0]) === idStr;
                    const optMd = reviewPickerRowTipMd(o);
                    return (
                      <button
                        key={String(id)}
                        type="button"
                        disabled={blockedBase}
                        onMouseEnter={(e) => {
                          if (blockedBase || !optMd) return;
                          segHover.showFromPointerEvent(e, {
                            anchorRef: inlineSingleBankRef,
                            label: optionLabel(o),
                            description: optMd,
                            wide: false,
                          });
                        }}
                        onMouseLeave={segHover.scheduleClose}
                        onClick={() => {
                          if (id == null || blockedBase) return;
                          if (singleSelectImmediate) {
                            onV2ReviewChip?.(chip, roll, { selectedId: idStr });
                          } else {
                            setSelectedIds([idStr]);
                          }
                        }}
                        className={`${V2_INLINE_SEG_BTN_BASE} ${selected ? V2_INLINE_SEG_ON : V2_INLINE_SEG_OFF}`}
                      >
                        <span className="break-words">{optionLabel(o)}</span>
                      </button>
                    );
                  })}
                </V2SegmentedRowWrap>
                </div>
              </div>
            </div>
          ) : null}
          {!chip.multiSelect && !useInlineIsSelect ? (
            <Tooltip
              content={<MarkdownText text={chipFeatureTooltipMd} className="text-[11px] leading-relaxed dh-md" />}
              placement="bottom-left"
              className="relative block w-full min-w-0"
            >
              <div className="w-full min-w-0">
                <CustomSelect
                  className="text-[10px] [&_button]:py-1.5 [&_button]:px-2 [&_button]:min-h-0 [&_button]:text-[10px]"
                  value={
                    needsTargets
                      ? options.find((o) => String(optionId(o)) === String(selectedIds[0] ?? '')) ?? null
                      : null
                  }
                  placeholder="Choose…"
                  renderPlaceholder={() => (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <span className="font-semibold text-[11px] truncate">{chip._featureName}</span>
                      {chip.name && chip.name !== chip._featureName ? (
                        <span className="text-dh-muted text-[10px] truncate"> — {chip.name}</span>
                      ) : null}
                      <FeatureResourceCostIcons action={chip} iconSize={9} className="shrink-0" />
                    </span>
                  )}
                  options={options}
                  getOptionKey={(o) => String(optionId(o) ?? '')}
                  getOptionLabel={(o) => optionLabel(o)}
                  getOptionDescription={(o) => (typeof o?.description === 'string' ? o.description : undefined)}
                  disabled={blockedBase}
                  disabledReason={blockedBase ? blockHint : undefined}
                  onChange={(opt) => {
                    if (opt == null || blockedBase) return;
                    const id = optionId(opt);
                    if (id == null) return;
                    const sid = String(id);
                    if (singleSelectImmediate) {
                      onV2ReviewChip?.(chip, roll, { selectedId: sid });
                    } else {
                      setSelectedIds([sid]);
                    }
                  }}
                />
              </div>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
      {needsTargets && pickTargets.length > 0 ? (
        <div className="w-full min-w-0">
          <div className={V2_INLINE_GROUP_OUTER} role="group" aria-label={`${chip._featureName || 'Feature'} targets`}>
            <Tooltip
              content={<MarkdownText text={chipFeatureTooltipMd} className="text-[11px] leading-relaxed dh-md" />}
              placement="bottom-left"
              className="relative block w-full min-w-0"
            >
              <div className={V2_INLINE_GROUP_TITLE_ROW}>
                <span className="font-semibold text-[11px] min-w-0 shrink break-words">{chip._featureName}</span>
                {chip.name && chip.name !== chip._featureName ? (
                  <span className="text-dh-muted text-[10px] min-w-0 shrink break-words"> — {chip.name}</span>
                ) : null}
                <FeatureResourceCostIcons action={chip} iconSize={9} className="shrink-0" />
              </div>
            </Tooltip>
            <div ref={selectTargetsBankRef} className="w-full min-w-0">
            <V2SegmentedRowWrap key={`${stableKey}-${roll._rollDbId}-tgt`}>
              {pickTargets.map((t) => {
                const tid = actorInstanceId(t);
                if (!tid) return null;
                const name = t.name || t.label || tid;
                const on = selectedTargetIds.includes(tid);
                const tgtMd = reviewPickerRowTipMd(t);
                return (
                  <button
                    key={tid}
                    type="button"
                    disabled={blockedBase || needsPrimaryFirst}
                    onMouseEnter={(e) => {
                      if (blockedBase || needsPrimaryFirst || !tgtMd) return;
                      segHover.showFromPointerEvent(e, {
                        anchorRef: selectTargetsBankRef,
                        label: String(name),
                        description: tgtMd,
                        wide: false,
                      });
                    }}
                    onMouseLeave={segHover.scheduleClose}
                    onClick={() => toggleTarget(tid)}
                    className={`${V2_INLINE_SEG_TARGET_BTN} ${on ? V2_INLINE_SEG_ON : V2_INLINE_SEG_OFF}`}
                  >
                    <span className="break-words">{name}</span>
                  </button>
                );
              })}
            </V2SegmentedRowWrap>
            </div>
          </div>
        </div>
      ) : null}
      {needsPrimaryFirst ? (
        <p className="text-[9px] text-dh-muted">Select a damage target above first.</p>
      ) : null}
      {pickerMissing ? (
        <p className="text-[9px] text-dh-muted">Could not load chip options.</p>
      ) : null}
      {showApply ? (
        <button
          type="button"
          disabled={blocked || !canConfirm()}
          onClick={doConfirm}
          aria-label={label}
          className="w-full px-2 py-1 rounded text-[10px] font-medium border border-dh-strong bg-dh-hover text-dh hover:bg-dh-strong disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      ) : null}
      <PortalHoverTooltipLayer
        tooltip={segHover.tooltip}
        tooltipRef={segHover.tooltipRef}
        scheduleClose={segHover.scheduleClose}
        clearLeaveTimer={segHover.clearLeaveTimer}
      />
    </div>
  );

  if (blockedBase) {
    return (
      <Tooltip key={stableKey} label={blockHint || 'Unavailable'} placement="bottom-left" className="relative flex w-full min-w-0">
        {panel}
      </Tooltip>
    );
  }
  return panel;
}

function ResultBanner({ roll, resolved, onAcknowledge, onCancel, targets, getTargetsForRoll, getTargetDisadvantageLabels, onApplyDamage, onApplyVulnerable, onConcussiveKnock, disableDismiss, canApplyDamage = true, onQuickTarget, onDoubledUpTarget, onBouncingTarget, wizardsWithHope = [], onNotThisTime, displayOverridesByRollId, tableCharacters = [], rangerFocusRerollChars = [], onRangerFocusReroll, onRangerFocusRerollRequest, rangerFocusRequestedBannerIds, holdThemOffChars = [], onHoldThemOffToggle, onBannerTargetsChange, lockedOnAutoSuccessRollDbIds = new Set(), wingsOfLightFlyingInstanceIds, onWingsD8Toggle, onWingsD8ToggleRequest, onGetWingsD8Extra, getV2DamageBannerAckNotices, sessionRole, isPlayer = false, currentUserUid = null, onResolveInstantly, onReplayDice, v2ReviewChips = [], onV2ReviewChip, resolveV2ReviewChipPicker, getV2ReviewChipDisableHint, canUseV2ReviewChips, v2PendingMoveInfo = { blocked: false, desiredCondition: '', description: '', featureName: '' } }) {
  const visible = useBannerVisible();
  const effectiveSessionRole = sessionRole ?? (isPlayer ? 'player' : 'gm');
  const attackerEl = roll._attackerInstanceId
    ? tableCharacters.find((c) => c.instanceId === roll._attackerInstanceId)
    : null;
  const gmHelperSuffix = getGmHelperBannerSuffix({ sessionRole: effectiveSessionRole, roll, attackerElement: attackerEl });
  const gmHelperTooltip = getGmHelperBannerTooltip({ sessionRole: effectiveSessionRole, roll, attackerElement: attackerEl });
  const { dominant, total, characterName, rollUser } = roll;
  const displayName = roll.displayName || characterName || rollUser || '';
  const v2MoveBlocksAck = !isPlayer && v2PendingMoveInfo?.blocked === true;
  const v2MoveFeatureName = (v2PendingMoveInfo?.featureName || '').trim() || 'Feature';
  const v2MoveDesiredCond = (v2PendingMoveInfo?.desiredCondition || v2PendingMoveInfo?.description || '').trim();
  const v2MoveAckLabel = v2MoveBlocksAck ? `Apply ${v2MoveFeatureName} to acknowledge` : 'Acknowledge';
  const v2MoveAckTooltip = v2MoveBlocksAck
    ? v2MoveDesiredCond
      ? `Drop the token so the map satisfies: ${v2MoveDesiredCond}. Then acknowledge.`
      : `Drop the token so the map matches ${v2MoveFeatureName}, then acknowledge`
    : null;
  // Active post-apply interaction: the name of the tag whose interaction phase is running.
  // Replaces the three separate quickPhase / doubledUpPhase / bouncingPhase states.
  const [activeInteractionTag, setActiveInteractionTag] = useState(null);
  // Virtual weapon features (e.g. Retracting Claws, Long Tongue): one target must be selected before Acknowledge.
  // Pre-selected target (from in-place "Choose target" menu) is stored on roll._selectedTargetInstanceId.
  const [featureTargetSelectedId, setFeatureTargetSelectedId] = useState(
    () => (roll._featureNeedsTarget && roll._selectedTargetInstanceId) ? roll._selectedTargetInstanceId : null
  );
  // Damage banners: target chips are selectors only; selection is applied when Acknowledge is pressed.
  const [selectedDamageTargetId, setSelectedDamageTargetId] = useState(() => roll._selectedTargetInstanceId ?? null);
  const [useArmorForSelected, setUseArmorForSelected] = useState(false);
  // Hold Them Off / Focus reroll UI: Phase 1 banner tools removed; V2 review chips handle Ranger flows.
  const usePhase1RangerBannerTools = false;
  const holdThemOffActive = usePhase1RangerBannerTools && !!roll._holdThemOffActive;
  const [selectedDamageTargetIds, setSelectedDamageTargetIds] = useState(() =>
    Array.isArray(roll._selectedTargetInstanceIds)
      ? roll._selectedTargetInstanceIds
      : (holdThemOffActive
          ? [roll._selectedTargetInstanceId].filter(Boolean)
          : (roll._multiTarget ? (roll._selectedTargetInstanceId ? [roll._selectedTargetInstanceId] : []) : []))
  );
  const [useArmorByTargetId, setUseArmorByTargetId] = useState(() => (roll._useArmorByTargetId && typeof roll._useArmorByTargetId === 'object' ? roll._useArmorByTargetId : {}));
  const [useImpenetrableByTargetId, setUseImpenetrableByTargetId] = useState(() =>
    (roll._useImpenetrableByTargetId && typeof roll._useImpenetrableByTargetId === 'object' ? { ...roll._useImpenetrableByTargetId } : {})
  );
  const useImpenetrableForSelected = selectedDamageTargetId ? !!useImpenetrableByTargetId[selectedDamageTargetId] : false;
  const [useHopefulArmorByInstanceId, setUseHopefulArmorByInstanceId] = useState(() =>
    (roll._hopefulArmorInsteadByInstanceId && typeof roll._hopefulArmorInsteadByInstanceId === 'object' ? { ...roll._hopefulArmorInsteadByInstanceId } : {})
  );
  const [concussiveKnockActive, setConcussiveKnockActive] = useState(false);
  // Popup menu for target selection (same UX as initiating player's "Choose target" menu).
  const [targetMenuAnchorRect, setTargetMenuAnchorRect] = useState(null);
  const targetsSyncDebounceRef = useRef(null);

  // Sync from roll when server-backed selection/armor updates (e.g. from another client).
  useEffect(() => {
    if (Array.isArray(roll._selectedTargetInstanceIds)) setSelectedDamageTargetIds(roll._selectedTargetInstanceIds);
  }, [roll._rollDbId, roll._selectedTargetInstanceIds]);
  useEffect(() => {
    if (roll._featureNeedsTarget && roll._selectedTargetInstanceId) setFeatureTargetSelectedId(roll._selectedTargetInstanceId);
  }, [roll._rollDbId, roll._featureNeedsTarget, roll._selectedTargetInstanceId]);
  useEffect(() => {
    if (roll._useArmorByTargetId != null && typeof roll._useArmorByTargetId === 'object') setUseArmorByTargetId(roll._useArmorByTargetId);
  }, [roll._rollDbId, roll._useArmorByTargetId]);
  useEffect(() => {
    if (roll._useImpenetrableByTargetId != null && typeof roll._useImpenetrableByTargetId === 'object') {
      setUseImpenetrableByTargetId(prev => ({ ...roll._useImpenetrableByTargetId }));
    }
  }, [roll._rollDbId, roll._useImpenetrableByTargetId]);
  useEffect(() => {
    if (roll._hopefulArmorInsteadByInstanceId != null && typeof roll._hopefulArmorInsteadByInstanceId === 'object') {
      setUseHopefulArmorByInstanceId(prev => ({ ...roll._hopefulArmorInsteadByInstanceId }));
    }
  }, [roll._rollDbId, roll._hopefulArmorInsteadByInstanceId]);

  // When Hold Them Off is toggled on, seed multi-select from current single selection if empty.
  useEffect(() => {
    if (holdThemOffActive && selectedDamageTargetIds.length === 0 && (selectedDamageTargetId || roll._selectedTargetInstanceId)) {
      const id = selectedDamageTargetId || roll._selectedTargetInstanceId;
      setSelectedDamageTargetIds([id]);
    }
  }, [holdThemOffActive, selectedDamageTargetIds.length, selectedDamageTargetId, roll._selectedTargetInstanceId]);

  // Sync single-target selection to server so all clients share the same target chips / ack state.
  useEffect(() => {
    if (holdThemOffActive || roll._multiTarget || !onBannerTargetsChange || roll._rollDbId == null) return;
    if (targetsSyncDebounceRef.current) clearTimeout(targetsSyncDebounceRef.current);
    targetsSyncDebounceRef.current = setTimeout(() => {
      targetsSyncDebounceRef.current = null;
      onBannerTargetsChange(roll._rollDbId, { selectedTargetInstanceIds: selectedDamageTargetId ? [selectedDamageTargetId] : [] });
    }, 200);
    return () => { if (targetsSyncDebounceRef.current) clearTimeout(targetsSyncDebounceRef.current); };
  }, [selectedDamageTargetId, roll._rollDbId, holdThemOffActive, roll._multiTarget, onBannerTargetsChange]);

  useEffect(() => {
    if (!targetMenuAnchorRect) return;
    const onKey = (e) => { if (e.key === 'Escape') setTargetMenuAnchorRect(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [targetMenuAnchorRect]);

  // Legacy roll fields (may remain on old pending banners): prayer die add / damage reduction.
  const selectedAddRollDie = roll._prayerAddRollDie ?? null;
  const selectedDmgReduceDie = roll._prayerDmgReduceDie ?? null;

  // Pre-ack display: features can set dominantForDisplay via chip.render (e.g. Fearless setWithHope()).
  const effectiveDominant = (displayOverridesByRollId && roll._rollDbId != null && displayOverridesByRollId[roll._rollDbId]?.dominantForDisplay) ?? dominant;

  const hasDHLabels   = (roll.subItems || []).some(s => /hope/i.test(s.pre || ''))
                     && (roll.subItems || []).some(s => /fear/i.test(s.pre || ''));
  const hasDuality = effectiveDominant != null || hasDHLabels;
  const isCritical    = effectiveDominant === 'critical';
  const isHope        = effectiveDominant === 'hope' || isCritical;

  // Hope/Fear coloration only while rolling if the duality dice were preset (e.g. augmented Kick roll).
  const dualitySubItems = (roll.subItems || []).filter(s => /hope|fear/i.test(s.pre || ''));
  const dominantFromPreset = hasDuality && dualitySubItems.length > 0 && dualitySubItems.every(s => s._preset === true);

  const isPrayerDiceRoll = !!roll._isPrayerDiceRoll;
  const actionItems = (roll.subItems || []).filter(s => !/damage/i.test(s.pre || '') && !EXTRA_PRE_RE.test(s.pre || ''));
  const extraItems   = (roll.subItems || []).filter(s => EXTRA_PRE_RE.test(s.pre || ''));
  const damageSubs  = (roll.subItems || []).filter(s => /damage/i.test(s.pre || '') && s.input);
  const damageTotal = damageSubs.reduce((sum, s) => sum + (parseInt(s.result, 10) || 0), 0);
  /** Base damage used for thresholds and application. */
  const baseDamage  = (roll._damageTotalOverride != null ? roll._damageTotalOverride : damageTotal);
  const damageSub   = damageSubs[0];
  const dmg         = parseDiceSub(damageSub);
  const hasDamage   = (dmg != null || damageSubs.length > 0);
  const multiDamage = damageSubs.length > 1;

  // Unified multi-target mode: Hold Them Off toggle or roll._multiTarget (e.g. Elemental Breath).
  const isMultiTargetMode = holdThemOffActive || (!!roll._multiTarget && (hasDamage || !!roll._featureNeedsTarget));
  const multiTargetCap = holdThemOffActive ? 3 : (roll._multiTargetMax ?? 10);
  // One damage sub-item string: breakdown for generic "damage" rows or "Name (result)" for labeled extras (Kick, Tusks, …).
  const formatDamageSubDisplay = (sub) => {
    const parsed = parseDiceSub(sub);
    const damageLabel = (sub.pre || '').replace(/\s+damage$/i, '').trim();
    if (damageLabel && damageLabel.toLowerCase() !== 'damage') return `${damageLabel}(${sub.result})`;
    if (parsed) {
      const modStr = parsed.modifier !== 0 ? ` + ${parsed.modifier}` : '';
      return `${parsed.notation} ${parsed.dieValue}${modStr}`;
    }
    return sub.result;
  };

  // Determine if this banner has any interactive actions that require user input before dismissal.
  const tags = roll.tags || [];
  const hasInteractiveTags = tags.some((t) => getWeaponTagInteractive(t.name, attackerEl));
  // Show target row for GM or for the initiating player (attacker) so they can select targets.
  const isInitiator = currentUserUid != null && roll._initiatorUid === currentUserUid;
  const canShowTargetRow = canApplyDamage || (isPlayer && isInitiator);
  const needsPcWeaponRangeTarget = roll._attackerInstanceId && roll._weaponRangeFt != null && roll._attackerType !== 'adversary' && !hasDamage;
  const needsInteraction = (canShowTargetRow || roll._featureNeedsTarget) && (hasDamage || hasInteractiveTags || roll._featureNeedsTarget || needsPcWeaponRangeTarget);

  // Whether to show action buttons (Acknowledge / Apply damage)
  const showActions = !disableDismiss;
  // Show action row (target selection, toggles) to GM or to the initiating player; only GM sees Acknowledge/Skip.
  const showActionRow = showActions || (isPlayer && isInitiator);

  // DH rolls: label + numeric value for each non-damage sub-item. Include input to detect static parts.
  // Use dice expression (e.g. "1d8") as label when pre is blank so builder extra dice show in banner.
  // Disadvantage sub-items (e.g. Galapa Retract) are subtracted; carry isDisadvantage for display (minus, short label).
  // `_preset` marks sub-items carried over when augmenting a banner (add damage, partial reroll) — show values while new dice animate.
  const dhParts = hasDuality
    ? actionItems
        .map(s => {
          const isDisadvantage = /disadvantage/i.test(s.pre || '');
          const rawLabel = extractBannerLabel(s.pre) || (s.input && s.input.trim()) || 'Dice';
          const label = isDisadvantage ? (rawLabel.replace(/\s*disadvantage\s*/i, '').trim() || 'disadvantage') : rawLabel;
          return { label, value: parseInt(s.result, 10), input: s.input, isDisadvantage, preset: !!s._preset };
        })
        .filter(p => p.label && (resolved ? (!isNaN(p.value) && p.value !== 0) : true))
    : [];
  const dualityActionTotalKnown = resolved
    || (actionItems.length > 0 && actionItems.every(s => s._preset || isStaticDiceInput(s.input)));

  // Generic rolls: parsed dice detail for the first action expression.
  const genericActionSub = !hasDuality
    ? actionItems.find(s => /d\d/i.test(s.input || ''))
    : null;
  const genericAction = parseDiceSub(genericActionSub);
  const genericTotal  = total ?? computeActionTotal(roll.subItems);
  const genericDiceSubs = !hasDuality ? actionItems.filter(s => /d\d/i.test(s.input || '')) : [];
  const genericDiceTotalKnown = resolved
    || (genericDiceSubs.length > 0 && genericDiceSubs.every(s => s._preset || isStaticDiceInput(s.input)));
  // Trailing " + N" from rollText (e.g. Know the Tide) — show in dice string; total already includes it.
  const staticModFromRollText = getStaticModifierFromRollText(roll.rollText);
  // " — disadvantage removed: label1, label2" from rollText (e.g. Goblin Surefooted).
  const disadvantageRemovedNote = getDisadvantageRemovedFromRollText(roll.rollText);
  // When unresolved, use sum of static-only action parts if every part is static (no dice).
  const staticGenericTotal = !resolved && !genericAction && actionItems.length > 0
    && actionItems.every(s => isStaticDiceInput(s.input))
    ? actionItems.reduce((sum, s) => sum + (parseStaticValue(s.input) ?? 0), 0)
    : null;

  // Color schemes for DH (hope/fear) vs generic rolls. Use hope/fear only when resolved or when Hope/Fear dice were preset (e.g. augmented roll).
  const neutralScheme = { card: 'bg-dh-surface/90 border-2 border-sky-500/60 text-sky-100', detail: 'text-sky-200/60' };
  const scheme = (!hasDuality || (!resolved && !dominantFromPreset))
    ? neutralScheme
    : isHope
      ? { card: 'bg-dh-raised/95 border-2 border-dh-hope text-dh', detail: 'text-dh-hope-soft' }
      : { card: 'bg-dh-raised/95 border-2 border-purple-500/70 text-dh', detail: 'text-dh-muted' };

  // Character rolls target adversaries; adversary/other rolls target characters.
  // Use getTargetsForRoll for virtual weapon features, character attacks with weapon range, or adversary attacks with range.
  const useGetTargetsForRoll = !!(getTargetsForRoll && rollShouldUseMapFilteredTargets(roll, hasDamage));
  const allTargets = useGetTargetsForRoll ? (getTargetsForRoll(roll) || []) : (targets || []);
  const rollSrc = (rollUser || characterName || '').toLowerCase().trim();
  // Character rolls target adversaries. Treat as character roll when the attacker is a character (not adversary).
  const isCharacterRoll = (roll._attackerInstanceId != null && roll._attackerType !== 'adversary') || (rollSrc
    ? allTargets.some(t => t.type === 'character' && (
        t.name.toLowerCase() === rollSrc ||
        rollSrc.startsWith(t.name.toLowerCase())
      ))
    : false);
  const filteredTargets = isCharacterRoll
    ? allTargets.filter(t => t.type === 'adversary')
    : allTargets.filter(t => t.type === 'character');

  // Selected target(s) for banner title.
  const selectedTargetIdForTitle = roll._featureNeedsTarget ? featureTargetSelectedId : (isMultiTargetMode ? null : selectedDamageTargetId);
  const selectedTargetsForTitle = isMultiTargetMode && selectedDamageTargetIds.length > 0
    ? selectedDamageTargetIds.map(id => filteredTargets.find(t => t.instanceId === id)).filter(Boolean)
    : [];
  const selectedTargetForTitle = selectedTargetIdForTitle
    ? filteredTargets.find(t => t.instanceId === selectedTargetIdForTitle)
    : null;
  const bannerTitleTargetSuffix = isMultiTargetMode && selectedTargetsForTitle.length > 0
    ? ` → ${selectedTargetsForTitle.map(t => t.name).join(', ')}`
    : selectedTargetForTitle
      ? ` → ${selectedTargetForTitle.name}`
      : '';
  const bannerTitlePlain =
    displayName + bannerTitleTargetSuffix;

  const canReplayBannerTitle = resolved && onReplayDice && (roll.subItems || []).some(s => s.input && /d\d/i.test(s.input));
  const bannerTitleTooltip = [canReplayBannerTitle ? 'Replay dice animation' : '', gmHelperTooltip].filter(Boolean).join(' — ') || undefined;

  // Ranger's Focus: Fear result, attack vs Focus target — can end Focus to reroll Duality dice.
  // Use roll._selectedTargetInstanceId as fallback for players who pre-select before rolling
  // (players have empty filteredTargets so selectedDamageTargetId stays null).
  const effectiveFocusTargetId = selectedDamageTargetId || roll._selectedTargetInstanceId || null;
  // rangerFocusRerollChars carries focusedAdversaryInstanceId derived from adversary focusedBy field.
  const attackerRanger = rangerFocusRerollChars?.find(c => c.instanceId === roll._attackerInstanceId);
  const rangerFocusRerollChar = attackerRanger && attackerRanger.focusedAdversaryInstanceId === effectiveFocusTargetId ? attackerRanger : null;
  const phase1RangerFocusReroll = usePhase1RangerBannerTools && rangerFocusRerollChar;
  // Stress note: visible to everyone — show whenever the attacker is focused on the target being attacked.
  const focusedByStressNote = !!rangerFocusRerollChar;

  // Hold Them Off (Ranger): character attack with damage, attacker has feature and ≥3 Hope.
  const holdThemOffChar = usePhase1RangerBannerTools && hasDamage && roll._attackerInstanceId
    ? holdThemOffChars.find(c => c.instanceId === roll._attackerInstanceId)
    : null;

  // Hide GM banner "Cancel" when Ack would not apply meaningful mechanical effects (Ack is the only dismissal that matters).
  const isAdversaryNotThisTimeRoll = !isCharacterRoll && wizardsWithHope.length > 0 && (hasDuality || hasDamage);
  const selectedTargetForLockedOn = selectedDamageTargetId || roll._selectedTargetInstanceId || selectedDamageTargetIds[0];
  const ackClearsLockedOn =
    !!(attackerEl?.lockedOnTargetInstanceId && selectedTargetForLockedOn && attackerEl.lockedOnTargetInstanceId === selectedTargetForLockedOn);
  const ackWouldApplyMechanicalEffectsWhenResolved =
    needsInteraction ||
    v2MoveBlocksAck ||
    ((roll.tags || []).length > 0 && roll._attackerInstanceId) ||
    (Number(roll._stressCost) > 0 ||
      Number(roll._hopeCost) > 0 ||
      Number(roll._armorMark) > 0 ||
      Number(roll._armorClear) > 0) ||
    roll._featureUse ||
    Number(roll._experienceHopeCost) > 0 ||
    Number(roll._notThisTimeHopeCost) > 0 ||
    roll._prayerDieGainHope ||
    roll._isPrayerDiceRoll ||
    roll._usedModifierId ||
    roll._prayerAddRollDie ||
    roll._prayerDmgReduceDie ||
    (hasDuality &&
      (effectiveDominant === 'fear' || effectiveDominant === 'hope' || effectiveDominant === 'critical')) ||
    (hasDHLabels && effectiveDominant == null) ||
    isAdversaryNotThisTimeRoll ||
    (Array.isArray(v2ReviewChips) && v2ReviewChips.length > 0) ||
    !!roll._holdThemOffActive ||
    !!roll._multiTarget ||
    (Number(roll._rangerFocusAttempt) > 0 && Number(roll._hopeCost) > 0) ||
    !!roll._wingsOfLightAddD8 ||
    ackClearsLockedOn;

  // Attack success/failure: total >= target Difficulty (adversary) or Evasion (character).
  const selectedTargetIds = isMultiTargetMode
    ? selectedDamageTargetIds
    : (selectedDamageTargetId || roll._selectedTargetInstanceId ? [selectedDamageTargetId || roll._selectedTargetInstanceId] : []);
  const hasPendingEvasionBonusCleanup = selectedTargetIds.some((id) => {
    const c = tableCharacters.find((t) => t.instanceId === id);
    return c != null && sumPendingEvasionBonusFromFeatureState(c) > 0;
  });
  const ackWouldApplyMechanicalEffectsWhenResolvedOrPending =
    ackWouldApplyMechanicalEffectsWhenResolved || hasPendingEvasionBonusCleanup;

  const showBannerDismissCancel =
    onCancel != null && (!resolved || ackWouldApplyMechanicalEffectsWhenResolvedOrPending);
  const effectiveAttackTotal = hasDuality
    ? (total + (selectedAddRollDie?.value ?? 0))
    : genericTotal;
  let hitCount = 0;
  let missCount = 0;
  for (const id of selectedTargetIds) {
    const target = filteredTargets.find(t => t.instanceId === id);
    if (!target) continue;
    let defense = target.type === 'adversary' ? target.difficulty : target.evasion;
    if (defense == null) continue;
    if (target.type === 'character') {
      const full = tableCharacters.find((c) => c.instanceId === id) || target;
      const pending = sumPendingEvasionBonusFromFeatureState(full);
      if (pending > 0) defense += pending;
    }
    if (effectiveAttackTotal >= defense) hitCount++;
    else missCount++;
  }
  const showHitMiss =
    resolved &&
    (hitCount + missCount) > 0 &&
    rollIsHitMissEligibleAttack(roll, hasDamage);
  const hitMissLabel = showHitMiss
    ? (hitCount + missCount === 1
        ? (hitCount === 1 ? 'Hit' : 'Miss')
        : [hitCount > 0 && `${hitCount} hit${hitCount > 1 ? 's' : ''}`, missCount > 0 && `${missCount} miss${missCount > 1 ? 'es' : ''}`].filter(Boolean).join(', '))
    : null;
  // Non-attack duality rolls with a difficulty: show Success/Failure (like Hit/Miss for attacks).
  // Critical (Hope/Fear doubles) is always a success per Daggerheart rules.
  const showSuccessFailure = hasDuality && resolved && roll._difficulty != null && !showHitMiss;
  const difficultySuccess = showSuccessFailure && (isCritical || effectiveAttackTotal >= roll._difficulty);
  const successFailureLabel = showSuccessFailure ? (difficultySuccess ? 'Success' : 'Failure') : null;
  const resultLabel = hitMissLabel || successFailureLabel;
  const resultSuccess = showHitMiss ? (hitCount > 0 && missCount === 0) : (showSuccessFailure && difficultySuccess);
  const resultFailure = showHitMiss ? (hitCount === 0 && missCount > 0) : (showSuccessFailure && !difficultySuccess);
  const resultMixed = showHitMiss && hitCount > 0 && missCount > 0;
  const resultLabelClass = resultSuccess ? 'text-emerald-400' : resultFailure ? 'text-red-400' : resultMixed ? 'text-orange-400' : '';
  const isLockedOnAutoSuccess = roll._rollDbId != null && lockedOnAutoSuccessRollDbIds instanceof Set && lockedOnAutoSuccessRollDbIds.has(roll._rollDbId);

  const handleResolveClick = !resolved && onResolveInstantly
    ? (e) => { e.stopPropagation(); onResolveInstantly(); }
    : undefined;

  return (
    <Tooltip label={handleResolveClick ? 'Click to show result immediately' : ''}>
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
    >
      <div style={{ pointerEvents: resolved ? undefined : 'none' }}>
      <div
        className={`px-5 py-3 rounded-xl shadow-2xl text-center ${scheme.card}`}
      >
        {bannerTitlePlain && (
          <div
            className={`text-[11px] uppercase tracking-widest opacity-70 mb-1.5 ${canReplayBannerTitle ? 'cursor-pointer hover:opacity-90' : ''}`}
            style={canReplayBannerTitle ? { pointerEvents: 'auto' } : undefined}
            onClick={canReplayBannerTitle ? (e) => { e.stopPropagation(); onReplayDice(); } : undefined}
            title={bannerTitleTooltip}
            role={canReplayBannerTitle ? 'button' : undefined}
          >
            <BannerSheetDisplayNameLine
              displayName={displayName}
              attackerName={attackerEl?.name}
              targetSuffix={bannerTitleTargetSuffix}
            />
            {gmHelperSuffix}
          </div>
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
          ) : hasDuality ? (
            <>
              {dhParts.length > 0 && (
                <span className={`text-[11px] ${scheme.detail}`}>
                  {dhParts.map((p, i) => {
                    const partKnown = resolved || p.preset || isStaticDiceInput(p.input);
                    const displayVal = (resolved || p.preset) ? p.value : (isStaticDiceInput(p.input) ? parseStaticValue(p.input) : undefined);
                    const sep = i > 0 ? (p.isDisadvantage ? ' \u2212 ' : (isNaN(p.value) || p.value >= 0 ? ' + ' : ' \u2212 ')) : '';
                    return (
                      <span key={i}>
                        {sep}
                        {p.isDisadvantage ? (
                          partKnown ? (
                            <span className="text-orange-400/95">{p.label} (−{Math.abs(displayVal ?? 0)})</span>
                          ) : (
                            <span className="text-orange-400/80">{p.label} <Spinner /></span>
                          )
                        ) : (
                          <>{p.label} {displayVal !== undefined && displayVal !== null ? Math.abs(displayVal) : <Spinner />}</>
                        )}
                      </span>
                    );
                  })}
                  {staticModFromRollText > 0 && (
                    <span> + {roll._staticModifierLabel ? `${roll._staticModifierLabel} ` : ''}{staticModFromRollText}</span>
                  )}
                  {' ='}
                </span>
              )}
              <span className="text-2xl font-black tabular-nums ml-1">
                {dualityActionTotalKnown ? (total + (selectedAddRollDie?.value ?? 0)) : <Spinner lg />}
              </span>
              {selectedAddRollDie && resolved && (
                <span className="text-[10px] text-teal-400/80 ml-0.5">+{selectedAddRollDie.value} Prayer Die</span>
              )}
              <span className="text-sm font-semibold opacity-80 ml-0.5">
                {(resolved || dominantFromPreset)
                  ? (isCritical ? '✦ Critical!' : isHope ? 'with Hope' : 'with Fear')
                  : <Spinner lg />}
              </span>
              {resultLabel && (
                <span className={`text-xs font-semibold ml-1 ${resultLabelClass}`}>
                  {resultLabel}
                </span>
              )}
            </>
          ) : genericAction ? (
            <>
              <span className={`text-[11px] ${scheme.detail}`}>
                {genericAction.notation} {(resolved || genericActionSub?._preset) ? genericAction.dieValue : <Spinner />}
                {genericAction.modifier !== 0 && (
                  <> {genericAction.modifier > 0 ? '+' : '-'} {Math.abs(genericAction.modifier)}</>
                )}
                {actionItems.some(s => /disadvantage/i.test(s.pre || '')) && (
                  <> {actionItems.filter(s => /disadvantage/i.test(s.pre || '')).map((s, i) => {
                    const val = parseInt(s.result, 10) || 0;
                    const notation = (s.input || '1d6').trim();
                    const label = (s.pre || '').replace(/\s*disadvantage\s*/i, '').trim() || 'disadvantage';
                    return (
                      <span key={i}> - {notation} ({(resolved || s._preset) ? val : <Spinner />}) {label}</span>
                    );
                  })}</>
                )}
                {staticModFromRollText > 0 && (
                  <span> + {roll._staticModifierLabel ? `${roll._staticModifierLabel} ` : ''}{staticModFromRollText}</span>
                )}
                {' ='}
              </span>
              <span className="text-2xl font-black tabular-nums ml-1">
                {genericDiceTotalKnown ? genericTotal : <Spinner lg />}
              </span>
              {resultLabel && (
                <span className={`text-xs font-semibold ml-1 ${resultLabelClass}`}>
                  {resultLabel}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-2xl font-black tabular-nums">
                {resolved ? genericTotal : (staticGenericTotal !== null ? staticGenericTotal : <Spinner lg />)}
              </span>
              {resultLabel && (
                <span className={`text-xs font-semibold ml-1 ${resultLabelClass}`}>
                  {resultLabel}
                </span>
              )}
            </>
          )}
        </div>
        {disadvantageRemovedNote && (
          <div className="text-[10px] text-dh-muted italic mt-0.5">
            Disadvantage ignored: {disadvantageRemovedNote}
          </div>
        )}
        {isLockedOnAutoSuccess && hasDamage && (
          <div className="text-[10px] text-sky-400/95 font-medium mt-1">
            Locked On: this attack automatically succeeds
          </div>
        )}

        {/* ── Damage line (single or combined when augmented e.g. Kick) ── */}
        {(dmg || multiDamage) && (() => {
          const dmgReduction = selectedDmgReduceDie?.value ?? 0;
          const wingsBonus = roll._wingsOfLightD8Result ?? 0;
          const baseDmg = baseDamage + wingsBonus;
          const displayDmg = Math.max(0, baseDmg - dmgReduction);
          const firstDmgType = dmg?.type ?? (damageSubs[0] && parseDiceSub(damageSubs[0])?.type);
          const selectedTarget = selectedDamageTargetId ? filteredTargets.find(t => t.instanceId === selectedDamageTargetId) : null;
          const isPhysicalDmg = firstDmgType === 'phy' || firstDmgType === 'Physical';
          const hasPhysicalResistance = selectedTarget?.type === 'character' && (selectedTarget.retractedActive || (Array.isArray(selectedTarget.resistance) && selectedTarget.resistance.some(r => (r.type === 'physical' || r.type === 'Physical'))));
          const effectiveDisplayDmg = (hasPhysicalResistance && isPhysicalDmg) ? Math.floor(displayDmg / 2) : displayDmg;
          return (
            <div className="flex items-baseline justify-center flex-wrap gap-x-1 mt-1.5 leading-snug">
              <span className="text-[11px] text-red-300/60">
                {multiDamage ? (
                  <>
                    {damageSubs.map((sub, i) => (
                      <span key={i}>
                        {i > 0 && ' + '}
                        {(resolved || sub._preset) ? formatDamageSubDisplay(sub) : <Spinner />}
                      </span>
                    ))}
                  </>
                ) : (
                  <>
                    {dmg.notation}{' '}
                    {(resolved || damageSubs[0]?._preset) ? (
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
                  </>
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
                {(resolved || (damageSubs.length > 0 && damageSubs.every((s) => s._preset)))
                  ? (roll._damageTotalOverride != null
                      ? <><span>{damageTotal}</span> <span className="text-red-300/80 font-semibold">({effectiveDisplayDmg})</span></>
                      : hasPhysicalResistance && isPhysicalDmg
                        ? <><span className="line-through">{displayDmg}</span> <span className="text-orange-400/95">{effectiveDisplayDmg}</span></>
                        : effectiveDisplayDmg)
                  : <Spinner />}
              </span>
              {firstDmgType && (
                <span className="text-sm font-semibold text-red-300/80 ml-0.5">{firstDmgType}</span>
              )}
              <span className="text-sm font-semibold text-red-300/80">damage</span>
              {hasPhysicalResistance && isPhysicalDmg && (
                <span className="text-[10px] font-medium text-orange-400/90 ml-1">(Resistance)</span>
              )}
            </div>
          );
        })()}

        {/* ── Extra dice sub-items: Reload / Invigorate / Lifesteal ── */}
        {extraItems.map((sub, i) => {
          const label = (sub.pre || '').trim();
          const result = parseInt(sub.result, 10);
          let statusText = null;
          let statusCls = 'text-dh-muted';
          if (resolved) {
            if (label === 'Reload') {
              if (result === 1) { statusText = 'Must reload!'; statusCls = 'text-red-400 font-semibold'; }
              else { statusText = 'Loaded'; statusCls = 'text-green-400'; }
            } else if (label === 'Invigorate') {
              if (result === 4) { statusText = 'Clear 1 Stress!'; statusCls = 'text-green-400 font-semibold'; }
              else { statusText = 'No effect'; statusCls = 'text-dh-muted'; }
            } else if (label === 'Lifesteal') {
              if (result === 6) { statusText = 'Clear 1 HP!'; statusCls = 'text-green-400 font-semibold'; }
              else { statusText = 'No effect'; statusCls = 'text-dh-muted'; }
            }
          }
          return (
            <div key={i} className="flex items-baseline justify-center gap-x-1 mt-1 leading-snug">
              <span className="text-[11px] text-dh-muted/70">
                {label} {sub.input}{' '}
                <span className="text-dh">{resolved ? result : <Spinner />}</span>
                {statusText && <span className={`ml-1 ${statusCls}`}>{statusText}</span>}
              </span>
            </div>
          );
        })}

        {/* ── Feature tags (showTag: true); automated tags use green styling; banner narrations also merge automated descriptions via buildRollBaseBannerNarrationParts ── */}
        {(roll.tags || []).filter((t) => resolveWeaponTagDescriptor(t.name, attackerEl)?.showTag === true).length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {(roll.tags || []).filter((t) => resolveWeaponTagDescriptor(t.name, attackerEl)?.showTag === true).map((tag, i) => {
              const isAuto = getWeaponTagAutomatedForBanner(tag.name, attackerEl);
              const conditional = getConditionalTagStatus(tag, roll, attackerEl);
              const effectiveStyle = isAuto ? 'green'
                : conditional ? conditional.style
                : 'info';
              const Icon = effectiveStyle === 'green' ? CheckCircle
                : effectiveStyle === 'red' ? AlertTriangle
                : Info;
              const cardCls = effectiveStyle === 'green' ? 'bg-green-950/50 border-green-700/50'
                : effectiveStyle === 'red' ? 'bg-red-950/50 border-red-700/50'
                : effectiveStyle === 'muted' ? 'bg-dh-raised/40 border-dh-strong/50'
                : 'bg-dh-raised/60 border-dh-strong/60';
              const iconCls = effectiveStyle === 'green' ? 'text-green-400'
                : effectiveStyle === 'red' ? 'text-red-400'
                : 'text-dh-muted';
              const nameCls = effectiveStyle === 'green' ? 'text-green-200'
                : effectiveStyle === 'red' ? 'text-red-200'
                : 'text-dh';
              const textCls = effectiveStyle === 'green' ? 'text-green-400/80'
                : effectiveStyle === 'red' ? 'text-red-400/80'
                : effectiveStyle === 'muted' ? 'text-dh-muted'
                : 'text-dh-muted';
              const displayText = conditional ? conditional.text : tag.text;
              return (
                <div key={i} className={`flex items-start gap-1.5 rounded px-2 py-1 text-left border ${cardCls}`}>
                  <Icon size={10} className={`${iconCls} shrink-0 mt-0.5`} />
                  <div className="text-[10px] leading-snug min-w-0 flex-1">
                    <span className={`font-bold ${nameCls}`}>{tag.name}:</span>{' '}
                    <MarkdownText text={String(displayText ?? '')} className={`${textCls} dh-md text-[10px] leading-snug`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* V2 engine: pre-roll intent choices are logged on the roll (`_v2IntentUsedLog`); banner shows reviewAction + reviewOutcome only — v2-action-loop-bridge.js */}
        {(() => {
          const v2NonIntent = Array.isArray(v2ReviewChips)
            ? v2ReviewChips.filter((c) => c._v2Phase !== 'intent')
            : [];
          const intentUsedLines = Array.isArray(roll._v2IntentUsedLog) ? roll._v2IntentUsedLog : [];
          if (v2NonIntent.length === 0 && intentUsedLines.length === 0) return null;
          const byPhase = { reviewAction: [], reviewOutcome: [] };
          for (const c of v2NonIntent) {
            const p = c._v2Phase === 'reviewOutcome' ? 'reviewOutcome' : 'reviewAction';
            byPhase[p].push(c);
          }
          const phaseLabel = {
            reviewAction: ACTION_LOOP_PHASE_UI.reviewAction.sectionHeader,
            reviewOutcome: ACTION_LOOP_PHASE_UI.reviewOutcome.sectionHeader,
          };
          const primaryDamageTargetId =
            selectedDamageTargetId ||
            (roll._featureNeedsTarget ? featureTargetSelectedId : null) ||
            roll._selectedTargetInstanceId ||
            (Array.isArray(selectedDamageTargetIds) && selectedDamageTargetIds[0]) ||
            null;
          return (
            <div className="mt-2 rounded-lg border border-dh-border bg-dh-inset px-2 py-1.5 space-y-2">
              {intentUsedLines.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1 text-[9px] font-semibold uppercase tracking-wider text-dh-muted">
                    <ACTION_LOOP_PHASE_UI.intent.Icon size={10} className="shrink-0 text-sky-400" aria-hidden />
                    <span>
                      {ACTION_LOOP_PHASE_UI.intent.sectionHeader} (used)
                    </span>
                  </div>
                  <ul className="text-[10px] text-dh space-y-0.5 list-disc list-inside pl-0.5">
                    {intentUsedLines.map((line, li) => (
                      <li key={li}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(['reviewAction', 'reviewOutcome']).map((pk) => {
                if (byPhase[pk].length === 0) return null;
                const PhaseIcon = ACTION_LOOP_PHASE_UI[pk].Icon;
                return (
                  <div key={pk}>
                    <div className="flex items-center gap-1 mb-1 text-[9px] font-semibold uppercase tracking-wider text-dh-muted">
                      <PhaseIcon size={10} className="shrink-0 text-sky-400" aria-hidden />
                      <span>{phaseLabel[pk]}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {byPhase[pk].map((chip, i) => (
                        <V2ReviewChipRow
                          key={chip._chipKey || `${pk}-${chip._featureName}-${i}`}
                          chip={chip}
                          roll={roll}
                          phaseKey={pk}
                          rowIndex={i}
                          resolveV2ReviewChipPicker={resolveV2ReviewChipPicker}
                          onV2ReviewChip={onV2ReviewChip}
                          isPlayer={isPlayer}
                          primaryDamageTargetId={primaryDamageTargetId}
                          getV2ReviewChipDisableHint={getV2ReviewChipDisableHint}
                          canUseV2ReviewChips={canUseV2ReviewChips}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Focused-by Stress note: visible to everyone when the attack targets the Ranger's Focus adversary */}
        {focusedByStressNote && (
          <div className="text-[10px] text-emerald-300/90 mt-1.5">
            Target will mark 1 Stress (Focused).
          </div>
        )}

        {/* ── Action row: target badges or Acknowledge ── */}
        {showActionRow && (() => {
          // ── Post-apply interaction phase (Quick, Doubled Up, Bouncing) ──
          if (activeInteractionTag) {
            const interactionFeature = resolveWeaponTagDescriptor(activeInteractionTag, attackerEl);
            const interaction = interactionFeature?.bannerInteraction;
            const prompt = typeof interaction?.getPrompt === 'function'
              ? interaction.getPrompt(tags, dmg)
              : interaction?.prompt ?? `${activeInteractionTag}: mark Stress?`;
            const skipLabel = interaction?.skipLabel ?? 'Done';
            const isLoop = interaction?.loop ?? false;

            // Per-tag callback dispatch
            const handleInteractiveTarget = (t) => {
              if (v2MoveBlocksAck) return;
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
                <div className="text-[10px] text-dh-muted mb-1.5 uppercase tracking-wider">{prompt}</div>
                <div className="flex flex-wrap justify-center gap-1">
                  {filteredTargets.map(t => (
                    <button
                      key={t.instanceId}
                      onClick={() => handleInteractiveTarget(t)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                        t.type === 'character'
                          ? 'bg-sky-900/60 border-sky-700 text-sky-200 hover:bg-sky-800 hover:border-sky-500'
                          : 'bg-dh-raised/80 border-dh-strong text-dh hover:bg-dh-hover hover:border-dh-muted'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                  <button
                    onClick={() => { setActiveInteractionTag(null); onAcknowledge?.(); }}
                    disabled={v2MoveBlocksAck}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {skipLabel}
                  </button>
                </div>
              </div>
            );
          }

          // ── Primary action row ──
          const isAdversaryRoll = !isCharacterRoll && wizardsWithHope.length > 0 && (hasDuality || hasDamage);

          // After applying damage, check if any tag needs a post-apply interaction phase.
          const enterPostApplyPhase = () => {
            if (v2MoveBlocksAck) return;
            const firstPostApply = tags.find((t) => {
              const f = resolveWeaponTagDescriptor(t.name, attackerEl);
              return f?.bannerInteraction?.phase === 'post-apply';
            });
            if (firstPostApply) setActiveInteractionTag(firstPostApply.name);
            else onAcknowledge?.();
          };

          return (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              {/* Not This Time buttons — one per eligible Wizard */}
              {isAdversaryRoll && onNotThisTime && wizardsWithHope.map(wizard => (
                <button
                  key={wizard.instanceId}
                  onClick={() => { onNotThisTime(wizard, roll); }}
                  className="w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border border-dh-strong bg-dh-hover text-dh hover:bg-dh-strong transition-colors flex items-center justify-center gap-1"
                >
                  <Tooltip label={`${wizard.name} spends 3 Hope to force a reroll (Not This Time)`}>
                    <span><RotateCcw size={10} /> {wizard.name}: Not This Time (3 Hope)</span>
                  </Tooltip>
                </button>
              ))}
              {/* Ancestry banner reactions inside showActions (GM-visible) are handled by the generic block below */}
              {/* Ranger's Focus: End Focus to reroll Duality dice — Fear result, attack vs Focus target (GM only in showActions block) */}
              {dominant === 'fear' && hasDamage && phase1RangerFocusReroll && onRangerFocusReroll && (() => {
                const rangerRequested = !!(roll._rangerFocusRerollRequestedBy || (rangerFocusRequestedBannerIds && rangerFocusRequestedBannerIds.has(roll._rollDbId)));
                return (
                  <Tooltip label={rangerRequested ? 'Reroll requested — waiting for GM' : "End Ranger's Focus to reroll Duality dice"}>
                    <button
                      onClick={() => onRangerFocusReroll(roll)}
                      className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${rangerRequested ? 'border-emerald-500 bg-emerald-800/80 text-emerald-100' : 'border-emerald-700 bg-emerald-900/50 text-emerald-200 hover:bg-emerald-800 hover:text-emerald-100'}`}
                    >
                      {rangerRequested ? <Check size={12} className="shrink-0" /> : <RotateCcw size={10} />}
                      End Ranger's Focus to reroll Duality dice
                    </button>
                  </Tooltip>
                );
              })()}
              {/* Hold Them Off (Ranger): Spend 3 Hope to select two more targets — visible to GM and initiating player */}
              {holdThemOffChar && onHoldThemOffToggle && roll._rollDbId && (
                <Tooltip label={holdThemOffActive ? 'On — select up to 3 targets (3 Hope when 2–3 targets)' : 'Spend 3 Hope to select two more targets'}>
                  <button
                    onClick={() => onHoldThemOffToggle(roll._rollDbId, !holdThemOffActive)}
                    className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${holdThemOffActive ? 'border-dh-hope bg-dh-hover text-dh ring-1 ring-dh-hope/35' : 'border-dh-strong bg-dh-raised text-dh hover:bg-dh-hover'}`}
                  >
                    {holdThemOffActive ? <Check size={12} className="shrink-0" /> : null}
                    Spend 3 Hope to select two more targets
                  </button>
                </Tooltip>
              )}
              {/* Concussive (weapon): on success, spend 1 Hope to knock target to Far range */}
              {tags.some(t => t.name === 'Concussive') && (isHope || isCritical) && hasDamage && selectedDamageTargetId && onConcussiveKnock && (
                <Tooltip label={concussiveKnockActive ? 'On — spend 1 Hope on Acknowledge to knock target to Far' : 'Spend 1 Hope to knock target to Far range (on Acknowledge)'}>
                  <button
                    type="button"
                    onClick={() => setConcussiveKnockActive(prev => !prev)}
                    className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${concussiveKnockActive ? 'border-dh-hope bg-dh-hover text-dh ring-1 ring-dh-hope/35' : 'border-dh-strong bg-dh-raised text-dh hover:bg-dh-hover'}`}
                  >
                    {concussiveKnockActive ? <Check size={12} className="shrink-0" /> : null}
                    Concussive: knock target to Far (1 Hope)
                  </button>
                </Tooltip>
              )}
              {(hasDamage || roll._featureNeedsTarget || (roll._attackerInstanceId && roll._weaponRangeFt != null && roll._attackerType !== 'adversary')) && canShowTargetRow && (filteredTargets.length > 0 || roll._featureNeedsTarget || (roll._attackerType === 'adversary' && roll._attackRangeFt != null) || (roll._attackerInstanceId && roll._weaponRangeFt != null && roll._attackerType !== 'adversary')) ? (
                <>
                  <div className="text-[10px] text-dh-muted mb-1.5 uppercase tracking-wider">
                    {(() => {
                      const rangeLabel = roll._weaponRangeFt != null ? rangeFtToLabel(roll._weaponRangeFt) : (roll._attackerType === 'adversary' && roll._attackRangeFt != null ? rangeFtToLabel(roll._attackRangeFt) : null);
                      return rangeLabel ? `Apply within ${rangeLabel}` : 'Apply to';
                    })()}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap justify-center items-center gap-1">
                      {roll._attackerType === 'adversary' && roll._attackRangeFt != null && filteredTargets.length === 0 ? (
                        <span className="text-[10px] text-dh-muted italic">No characters in range</span>
                      ) : roll._featureNeedsTarget ? (
                        filteredTargets.length === 0 ? (
                          <span className="text-[10px] text-dh-muted italic">No valid targets in range</span>
                        ) : (
                          <>
                            <Tooltip label="Choose target">
                              <button
                                type="button"
                                onClick={(e) => setTargetMenuAnchorRect(e.currentTarget.getBoundingClientRect())}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                  featureTargetSelectedId
                                    ? 'bg-sky-950/50 border-sky-500 text-dh ring-1 ring-sky-500/40'
                                    : 'bg-dh-raised/80 border-dh-strong text-dh hover:bg-dh-hover hover:border-dh-muted'
                                }`}
                              >
                                {featureTargetSelectedId
                                  ? (filteredTargets.find(t => t.instanceId === featureTargetSelectedId)?.name ?? 'Select target')
                                  : 'Select target'}
                                <ChevronDown size={10} className="opacity-70" />
                              </button>
                            </Tooltip>
                            {targetMenuAnchorRect != null && createPortal(
                              <>
                                <div className="fixed inset-0 z-[200]" onClick={() => setTargetMenuAnchorRect(null)} aria-hidden />
                                <div
                                  className="fixed z-[201] rounded-lg border border-dh-strong bg-dh-surface shadow-2xl p-2 space-y-2"
                                  style={{
                                    bottom: typeof window !== 'undefined' ? window.innerHeight - targetMenuAnchorRect.top + 4 : 8,
                                    left: Math.min(targetMenuAnchorRect.left, typeof window !== 'undefined' ? window.innerWidth - 220 : 0),
                                    minWidth: '140px',
                                  }}
                                >
                                  <div className="text-[11px] font-semibold text-dh uppercase tracking-wide">Choose target</div>
                                  <div className="space-y-1 max-w-[220px]">
                                    {filteredTargets.map((t) => {
                                      const sum = formatTargetSummary(t, { hideMax: isPlayer });
                                      return (
                                        <button
                                          key={t.instanceId}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setFeatureTargetSelectedId(t.instanceId);
                                            setTargetMenuAnchorRect(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-dh-strong bg-dh-raised/80 text-dh hover:bg-dh-hover hover:border-sky-500/50 transition-colors"
                                        >
                                          <div>{t.name}</div>
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
                                    onClick={(e) => { e.stopPropagation(); setTargetMenuAnchorRect(null); }}
                                    className="text-[11px] text-dh-muted hover:text-dh transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>,
                              document.body
                            )}
                          </>
                        )
                      ) : isMultiTargetMode ? (
                        filteredTargets.length === 0 ? (
                          <span className="text-[10px] text-dh-muted italic">No valid targets</span>
                        ) : (
                          <>
                            <Tooltip label={`Select up to ${multiTargetCap} targets`}>
                              <button
                                type="button"
                                onClick={(e) => setTargetMenuAnchorRect(e.currentTarget.getBoundingClientRect())}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                  selectedDamageTargetIds.length > 0
                                    ? 'ring-1 ring-sky-500/50 bg-sky-950/50 border-sky-500 text-dh'
                                    : 'bg-dh-raised/80 border-dh-strong text-dh hover:bg-dh-hover hover:border-dh-muted'
                                }`}
                              >
                                {selectedDamageTargetIds.length > 0
                                  ? (selectedDamageTargetIds.length === 1
                                    ? (filteredTargets.find(t => t.instanceId === selectedDamageTargetIds[0])?.name ?? '1 target')
                                    : `${selectedDamageTargetIds.length} targets`)
                                  : `Select targets (1–${multiTargetCap})`}
                                <ChevronDown size={10} className="opacity-70" />
                              </button>
                            </Tooltip>
                            {selectedDamageTargetIds.length > 0 && (() => {
                              const dmgReduction = selectedDmgReduceDie?.value ?? 0;
                              const wingsBonus = roll._wingsOfLightD8Result ?? 0;
                              const baseDmg = baseDamage + wingsBonus;
                              const displayDmg = Math.max(0, baseDmg - dmgReduction);
                              return (
                                <div className="mt-1 space-y-0.5 w-full">
                                  {selectedDamageTargetIds.map((id) => {
                                    const t = filteredTargets.find(x => x.instanceId === id);
                                    if (!t) return null;
                                    const dmgType = dmg?.type || '';
                                    const armorBlockedByType = (t.armorFeatureName === 'Physical' && dmgType === 'mag') || (t.armorFeatureName === 'Magic' && dmgType === 'phy');
                                    const hasArmor = t.type === 'character' && (t.maxArmor ?? 0) > 0 && (t.currentArmor ?? 0) < (t.maxArmor ?? 0) && !armorBlockedByType;
                                    const hpLoss = resolved && t.thresholds != null ? computeHpLoss(displayDmg, t.thresholds) : null;
                                    return (
                                      <div key={id} className="flex items-center justify-between gap-2 text-[11px] w-full">
                                        <span className="font-medium text-dh truncate min-w-0">{t.name}</span>
                                        <span className="flex items-center gap-1.5 shrink-0">
                                          {hasDamage && (resolved && hpLoss != null ? <span className="text-red-400 font-semibold tabular-nums">{hpLoss} HP</span> : hasDamage && resolved ? <span className="text-dh-muted">—</span> : hasDamage ? <Spinner /> : null)}
                                          {hasArmor ? (
                                            <label className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-cyan-700 bg-cyan-900/40 text-cyan-200 cursor-pointer hover:bg-cyan-800/50">
                                              <input
                                                type="checkbox"
                                                checked={!!useArmorByTargetId[id]}
                                                onChange={(e) => {
                                                  const next = { ...useArmorByTargetId, [id]: e.target.checked };
                                                  setUseArmorByTargetId(next);
                                                  if (onBannerTargetsChange && roll._rollDbId != null) {
                                                    clearTimeout(targetsSyncDebounceRef.current);
                                                    targetsSyncDebounceRef.current = setTimeout(() => onBannerTargetsChange(roll._rollDbId, { useArmorByTargetId: next }), 200);
                                                  }
                                                }}
                                                className="rounded border-cyan-600"
                                              />
                                              <Shield size={9} />
                                              Armor
                                            </label>
                                          ) : null}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            {targetMenuAnchorRect != null && createPortal(
                              <>
                                <div className="fixed inset-0 z-[200]" onClick={() => setTargetMenuAnchorRect(null)} aria-hidden />
                                <div
                                  className="fixed z-[201] rounded-lg border border-dh-strong bg-dh-surface shadow-2xl p-2 space-y-2"
                                  style={{
                                    bottom: typeof window !== 'undefined' ? window.innerHeight - targetMenuAnchorRect.top + 4 : 8,
                                    left: Math.min(targetMenuAnchorRect.left, typeof window !== 'undefined' ? window.innerWidth - 220 : 0),
                                    minWidth: '140px',
                                  }}
                                >
                                  <div className="text-[11px] font-semibold text-dh uppercase tracking-wide">Select targets (1–{multiTargetCap})</div>
                                  <div className="space-y-1 max-w-[220px]">
                                    {(() => {
                                      const dmgReduction = selectedDmgReduceDie?.value ?? 0;
                                      const wingsBonus = roll._wingsOfLightD8Result ?? 0;
                                      const baseDmg = baseDamage + wingsBonus;
                                      const displayDmg = Math.max(0, baseDmg - dmgReduction);
                                      return filteredTargets.map((t) => {
                                        const sum = formatTargetSummary(t, { hideMax: isPlayer });
                                        const isSelected = selectedDamageTargetIds.includes(t.instanceId);
                                        const hpLoss = hasDamage && resolved && t.thresholds != null ? computeHpLoss(displayDmg, t.thresholds) : null;
                                        return (
                                          <button
                                            key={t.instanceId}
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDamageTargetIds(prev => {
                                                const next = prev.includes(t.instanceId) ? prev.filter(x => x !== t.instanceId) : (prev.length >= multiTargetCap ? prev : [...prev, t.instanceId]);
                                                if (onBannerTargetsChange && roll._rollDbId != null) {
                                                  clearTimeout(targetsSyncDebounceRef.current);
                                                  targetsSyncDebounceRef.current = setTimeout(() => onBannerTargetsChange(roll._rollDbId, { selectedTargetInstanceIds: next }), 200);
                                                }
                                                return next;
                                              });
                                            }}
                                            className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium border transition-colors ${isSelected ? 'border-sky-500 bg-sky-950/45 text-dh' : 'border-dh-strong bg-dh-raised/80 text-dh hover:bg-dh-hover hover:border-sky-500/50'}`}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span>{isSelected ? <Check size={10} className="inline mr-1 shrink-0" /> : null}{t.name}</span>
                                              {hpLoss != null ? <span className="text-red-400 font-semibold tabular-nums shrink-0">{hpLoss} HP</span> : null}
                                            </div>
                                            <div className="text-[10px] text-dh-muted mt-0.5">
                                              {[sum.hp, sum.stress].filter(Boolean).join(' · ')}
                                              {sum.conditions ? ` · ${sum.conditions}` : ''}
                                            </div>
                                          </button>
                                        );
                                      });
                                    })()}
                                  </div>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setTargetMenuAnchorRect(null); }} className="text-[11px] text-dh-muted hover:text-dh transition-colors">Cancel</button>
                                </div>
                              </>,
                              document.body
                            )}
                          </>
                        )
                      ) : (
                        filteredTargets.length === 0 ? (
                          <span className="text-[10px] text-dh-muted italic">No valid targets</span>
                        ) : (
                          <>
                            <Tooltip label="Choose target">
                              <button
                                type="button"
                                onClick={(e) => setTargetMenuAnchorRect(e.currentTarget.getBoundingClientRect())}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                  selectedDamageTargetId
                                    ? 'ring-1 ring-sky-500/50 bg-sky-950/50 border-sky-500 text-dh'
                                    : 'bg-dh-raised/80 border-dh-strong text-dh hover:bg-dh-hover hover:border-dh-muted'
                                }`}
                              >
                                {selectedDamageTargetId
                                  ? (filteredTargets.find(t => t.instanceId === selectedDamageTargetId)?.name ?? 'Select target')
                                  : 'Select target'}
                                <ChevronDown size={10} className="opacity-70" />
                              </button>
                            </Tooltip>
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
                                  {(() => {
                                    if (!selectedTarget || selectedTarget.type !== 'character' || !hasDamage || !resolved) return null;
                                    const currentHp = selectedTarget.currentHp ?? selectedTarget.maxHp ?? 0;
                                    const dmgReduction = selectedDmgReduceDie?.value ?? 0;
                                    const wingsBonus = roll._wingsOfLightD8Result ?? 0;
                                    const displayDmg = Math.max(0, baseDamage + wingsBonus - dmgReduction);
                                    const hpLoss = selectedTarget.thresholds != null ? computeHpLoss(displayDmg, selectedTarget.thresholds) : 0;
                                    const wouldBeZero = currentHp - hpLoss <= 0;
                                    const hasImpenetrable = selectedTarget.armorFeatureName === 'Impenetrable';
                                    const hasStressSpace = (selectedTarget.currentStress ?? 0) < (selectedTarget.maxStress ?? 6);
                                    const usedThisRest = selectedTarget.featureUsage?.Impenetrable?.cycle === 'rest';
                                    const showImpenetrable = wouldBeZero && hasImpenetrable && hasStressSpace && !usedThisRest;
                                    if (!showImpenetrable) return null;
                                    return (
                                      <label className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-dh-strong bg-dh-inset text-dh cursor-pointer hover:bg-dh-hover transition-colors">
                                        <input
                                          type="checkbox"
                                          checked={useImpenetrableForSelected}
                                          onChange={(e) => {
                                            const next = e.target.checked;
                                            setUseImpenetrableByTargetId(prev => {
                                              const nextMap = { ...prev, [selectedDamageTargetId]: next };
                                              if (onBannerTargetsChange && roll._rollDbId != null) {
                                                targetsSyncDebounceRef.current = setTimeout(() => {
                                                  targetsSyncDebounceRef.current = null;
                                                  onBannerTargetsChange(roll._rollDbId, { useImpenetrableByTargetId: nextMap });
                                                }, 200);
                                              }
                                              return nextMap;
                                            });
                                          }}
                                          className="rounded border-dh-strong"
                                        />
                                        <span>Use Impenetrable (1/rest)</span>
                                      </label>
                                    );
                                  })()}
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
                                          ? 'border-dh-hope bg-dh-hover text-dh ring-1 ring-dh-hope/30'
                                          : 'border-dh-strong text-dh-muted hover:bg-dh-raised'
                                      } disabled:opacity-60 disabled:cursor-default`}
                                    >
                                      <Tooltip label={wingsActive ? (wingsD8Result != null ? `+d8: ${wingsD8Result}` : 'Spend 1 Hope to add d8 to damage (applied on Acknowledge)') : 'Spend a Hope to add a d8 to damage'}>
                                        <span>{wingsD8Result != null ? `+d8: ${wingsD8Result}` : "+1 Hope → d8"}</span>
                                      </Tooltip>
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                            {selectedDamageTargetId && hasDamage && (() => {
                              const t = filteredTargets.find(x => x.instanceId === selectedDamageTargetId);
                              if (!t) return null;
                              const dmgReduction = selectedDmgReduceDie?.value ?? 0;
                              const wingsBonus = roll._wingsOfLightD8Result ?? 0;
                              const baseDmg = baseDamage + wingsBonus;
                              const displayDmg = Math.max(0, baseDmg - dmgReduction);
                              const hpLoss = resolved && t.thresholds != null ? computeHpLoss(displayDmg, t.thresholds) : null;
                              return (
                                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] w-full">
                                  <span className="font-medium text-dh truncate min-w-0">{t.name}</span>
                                  <span className="shrink-0">
                                    {resolved && hpLoss != null ? <span className="text-red-400 font-semibold tabular-nums">{hpLoss} HP</span> : resolved ? <span className="text-dh-muted">—</span> : <Spinner />}
                                  </span>
                                </div>
                              );
                            })()}
                            {targetMenuAnchorRect != null && (() => {
                              return createPortal(
                              <>
                                <div className="fixed inset-0 z-[200]" onClick={() => setTargetMenuAnchorRect(null)} aria-hidden />
                                <div
                                  className="fixed z-[201] rounded-lg border border-dh-strong bg-dh-surface shadow-2xl p-2 space-y-2"
                                  style={{
                                    bottom: typeof window !== 'undefined' ? window.innerHeight - targetMenuAnchorRect.top + 4 : 8,
                                    left: Math.min(targetMenuAnchorRect.left, typeof window !== 'undefined' ? window.innerWidth - 220 : 0),
                                    minWidth: '140px',
                                  }}
                                >
                                  <div className="text-[11px] font-semibold text-dh uppercase tracking-wide">Choose target</div>
                                  <div className="space-y-1 max-w-[220px]">
                                    {filteredTargets.map((t) => {
                                      const sum = formatTargetSummary(t, { hideMax: isPlayer });
                                      const disadvantageFeatures = getTargetDisadvantageLabels?.(roll)?.[t.instanceId];
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
                                          className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-dh-strong bg-dh-raised/80 text-dh hover:bg-dh-hover hover:border-sky-500/50 transition-colors"
                                        >
                                          <div>{t.name}</div>
                                          <div className="text-[10px] text-dh-muted mt-0.5">
                                            {[sum.hp, sum.stress].filter(Boolean).join(' · ')}
                                            {sum.conditions ? ` · ${sum.conditions}` : ''}
                                            {disadvantageFeatures?.length ? ` · ${disadvantageFeatures.map(f => `${f} (−1d6)`).join(', ')}` : ''}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setTargetMenuAnchorRect(null); }}
                                    className="text-[11px] text-dh-muted hover:text-dh transition-colors"
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
                    {typeof getV2DamageBannerAckNotices === 'function' ? (() => {
                      const lines = getV2DamageBannerAckNotices(roll, selectedDamageTargetId) || [];
                      if (!lines.length) return null;
                      return (
                        <div className="mt-1 space-y-0.5">
                          {lines.map((text, i) => (
                            <div key={i} className="text-[10px] text-dh/90">{text}</div>
                          ))}
                        </div>
                      );
                    })() : null}
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {roll._featureNeedsTarget ? (
                        <>
                          {!isPlayer && onAcknowledge != null && (
                            <Tooltip label={v2MoveBlocksAck ? (v2MoveAckTooltip || '') : featureTargetSelectedId ? 'Acknowledge' : filteredTargets.length === 0 ? 'Acknowledge' : 'Select a target first'}>
                              <button
                                onClick={() => onAcknowledge(featureTargetSelectedId ? { selectedFeatureTargetInstanceId: featureTargetSelectedId } : undefined)}
                                disabled={(filteredTargets.length > 0 && !featureTargetSelectedId) || v2MoveBlocksAck}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-raised/60 text-dh hover:bg-dh-hover hover:text-dh transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-dh-raised/60"
                              >
                                {v2MoveAckLabel}
                              </button>
                            </Tooltip>
                          )}
                          {!isPlayer && showBannerDismissCancel && (
                            <button
                              onClick={onCancel}
                              className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      ) : isMultiTargetMode ? (
                        <>
                          {!isPlayer && (
                            <>
                              <Tooltip label={v2MoveBlocksAck ? (v2MoveAckTooltip || '') : selectedDamageTargetIds.length === 0 ? 'Select at least one target' : holdThemOffActive && selectedDamageTargetIds.length >= 2 ? 'Acknowledge and apply damage (3 Hope)' : 'Acknowledge and apply damage'}>
                                <button
                                  onClick={async () => {
                                    const dmgType = dmg?.type || '';
                                    if (selectedDamageTargetIds.length > 0 && hasDamage && onApplyDamage) {
                                      for (const id of selectedDamageTargetIds) {
                                        const target = filteredTargets.find(t => t.instanceId === id);
                                        if (target) {
                                          const damageModifiers = [];
                                          await onApplyDamage({ ...target, useArmor: !!useArmorByTargetId[id], damageModifiers, useImpenetrable: !!useImpenetrableByTargetId[id] }, baseDamage, tags, roll, dmgType);
                                        }
                                      }
                                    }
                                    if (holdThemOffActive && selectedDamageTargetIds.length >= 2 && roll._attackerInstanceId) {
                                      onAcknowledge?.({ holdThemOffHopeCost: 3, attackerInstanceId: roll._attackerInstanceId });
                                    } else {
                                      onAcknowledge?.();
                                    }
                                  }}
                                  disabled={selectedDamageTargetIds.length === 0 || v2MoveBlocksAck}
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-raised/60 text-dh hover:bg-dh-hover hover:text-dh transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-dh-raised/60"
                                >
                                  {v2MoveAckLabel}
                                </button>
                              </Tooltip>
                              <Tooltip label={v2MoveBlocksAck ? (v2MoveAckTooltip || '') : 'Acknowledge without applying damage'}>
                                <button
                                  onClick={() => onAcknowledge?.()}
                                  disabled={v2MoveBlocksAck}
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-raised/60 text-dh hover:bg-dh-hover hover:text-dh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Skip
                                </button>
                              </Tooltip>
                              {showBannerDismissCancel && (
                                <button
                                  onClick={onCancel}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {!isPlayer && (
                            <>
                              <Tooltip label={v2MoveBlocksAck ? (v2MoveAckTooltip || '') : filteredTargets.length > 0 && !selectedDamageTargetId ? 'Select a target first' : 'Acknowledge and apply damage to selected target'}>
                                <button
                                  onClick={async () => {
                                    let d8Extra = 0;
                                    let alreadyAcked = false;
                                    if (hasDamage && roll._wingsOfLightAddD8 && onGetWingsD8Extra) {
                                      d8Extra = roll._wingsOfLightD8Result ?? (await onGetWingsD8Extra(roll)) ?? 0;
                                      if (roll._wingsOfLightD8Result == null && d8Extra > 0) alreadyAcked = true;
                                    }
                                    const dmgReduction = selectedDmgReduceDie?.value ?? 0;
                                    const totalDamage = Math.max(0, (hasDamage ? baseDamage : 0) + d8Extra - dmgReduction);
                                    if (selectedDamageTargetId && hasDamage && onApplyDamage) {
                                      const selectedTarget = filteredTargets.find(t => t.instanceId === selectedDamageTargetId);
                                      if (selectedTarget) {
                                        const dmgType = dmg?.type || '';
                                        const effectiveTargetId = selectedDamageTargetId || roll._selectedTargetInstanceId;
                                        const damageModifiers = [];
                                        await onApplyDamage({ ...selectedTarget, useArmor: useArmorForSelected, damageModifiers, useImpenetrable: useImpenetrableForSelected }, totalDamage, tags, roll, dmgType);
                                      }
                                    }
                                    // Katari Retracting Claws: no damage line; V2 virtual weapon has no Phase-1 onAcknowledge — `_featureNeedsTarget` is false, so GMTableView virtual-weapon ack never runs. Apply Vulnerable on successful hit here.
                                    if (
                                      !hasDamage &&
                                      onApplyVulnerable &&
                                      selectedDamageTargetId &&
                                      roll._featureName === 'Retracting Claws' &&
                                      hitCount > 0 &&
                                      missCount === 0
                                    ) {
                                      const vulnTarget = filteredTargets.find(t => t.instanceId === selectedDamageTargetId);
                                      if (vulnTarget?.type === 'adversary') {
                                        onApplyVulnerable(vulnTarget);
                                      }
                                    }
                                    if (concussiveKnockActive && onConcussiveKnock && selectedDamageTargetId) onConcussiveKnock(roll, selectedDamageTargetId);
                                    const ackOpts = {};
                                    if (alreadyAcked) ackOpts.alreadyAcked = true;
                                    onAcknowledge?.(Object.keys(ackOpts).length > 0 ? ackOpts : undefined);
                                  }}
                                  disabled={(filteredTargets.length > 0 && !selectedDamageTargetId) || v2MoveBlocksAck}
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-raised/60 text-dh hover:bg-dh-hover hover:text-dh transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-dh-raised/60"
                                >
                                  {v2MoveAckLabel}
                                </button>
                              </Tooltip>
                              <Tooltip label={v2MoveBlocksAck ? (v2MoveAckTooltip || '') : 'Acknowledge without applying damage'}>
                                <button
                                  onClick={() => onAcknowledge?.()}
                                  disabled={v2MoveBlocksAck}
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-raised/60 text-dh hover:bg-dh-hover hover:text-dh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Skip
                                </button>
                              </Tooltip>
                              {showBannerDismissCancel && (
                                <button
                                  onClick={onCancel}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {!isPlayer && (
                    <div className="flex items-center justify-center gap-1.5">
                      <Tooltip label={v2MoveAckTooltip || 'Acknowledge'}>
                        <button
                          onClick={() => onAcknowledge?.()}
                          disabled={v2MoveBlocksAck}
                          className="flex-1 min-w-0 px-3 py-1 rounded text-[11px] font-semibold border border-dh-strong bg-dh-raised/60 text-dh hover:bg-dh-hover hover:text-dh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {v2MoveAckLabel}
                        </button>
                      </Tooltip>
                      {showBannerDismissCancel && (
                        <button
                          onClick={onCancel}
                          className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        {/* Player self-cancel: shown outside showActions when the player is the initiator */}
        {!showActions && onCancel != null && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-center">
            <button
              onClick={onCancel}
              className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {/* Feline Instincts and other ancestry reactions are handled by the generic banner reaction buttons above */}
        {/* Ranger's Focus: "End Focus to reroll Duality" — visible to player when not showActions so they can request GM */}
        {!showActions && dominant === 'fear' && hasDamage && phase1RangerFocusReroll && onRangerFocusRerollRequest && (() => {
          const rangerRequested = !!(roll._rangerFocusRerollRequestedBy || (rangerFocusRequestedBannerIds && rangerFocusRequestedBannerIds.has(roll._rollDbId)));
          return (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              <Tooltip label={rangerRequested ? 'Reroll requested — click to cancel' : "End Ranger's Focus to reroll Duality dice — request GM to perform"}>
                <button
                  onClick={() => { if (roll._rollDbId) onRangerFocusRerollRequest(roll._rollDbId); }}
                  className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${rangerRequested ? 'border-emerald-500 bg-emerald-800/80 text-emerald-100' : 'border-emerald-700 bg-emerald-900/50 text-emerald-200 hover:bg-emerald-800 hover:text-emerald-100'}`}
                >
                  {rangerRequested ? <Check size={12} className="shrink-0" /> : <RotateCcw size={10} />}
                  End Ranger's Focus to reroll Duality dice
                </button>
              </Tooltip>
            </div>
          );
        })()}
        {/* Hold Them Off (Ranger): toggle — visible to player when not showActions so they can toggle before GM acknowledges */}
        {!showActions && holdThemOffChar && onHoldThemOffToggle && roll._rollDbId && (
          <div className="mt-2.5 pt-2 border-t border-white/10">
            <Tooltip label={holdThemOffActive ? 'On — select up to 3 targets (3 Hope when 2–3 targets)' : 'Spend 3 Hope to select two more targets'}>
              <button
                onClick={() => onHoldThemOffToggle(roll._rollDbId, !holdThemOffActive)}
                className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${holdThemOffActive ? 'border-dh-hope bg-dh-hover text-dh ring-1 ring-dh-hope/35' : 'border-dh-strong bg-dh-raised text-dh hover:bg-dh-hover'}`}
              >
                {holdThemOffActive ? <Check size={12} className="shrink-0" /> : null}
                Spend 3 Hope to select two more targets
              </button>
            </Tooltip>
          </div>
        )}
        {!showActions && tags.some(t => t.name === 'Concussive') && (isHope || isCritical) && hasDamage && selectedDamageTargetId && onConcussiveKnock && (
          <div className="mt-2.5 pt-2 border-t border-white/10">
            <Tooltip label={concussiveKnockActive ? 'On — spend 1 Hope on Acknowledge to knock target to Far' : 'Spend 1 Hope to knock target to Far range (on Acknowledge)'}>
              <button
                type="button"
                onClick={() => setConcussiveKnockActive(prev => !prev)}
                className={`w-full mb-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center gap-1.5 ${concussiveKnockActive ? 'border-dh-hope bg-dh-hover text-dh ring-1 ring-dh-hope/35' : 'border-dh-strong bg-dh-raised text-dh hover:bg-dh-hover'}`}
              >
                {concussiveKnockActive ? <Check size={12} className="shrink-0" /> : null}
                Concussive: knock target to Far (1 Hope)
              </button>
            </Tooltip>
          </div>
        )}
        {/* Wings of Light (Winged Sentinel): d8 toggle — visible to player so they can signal intent before GM acknowledges */}
        {!showActions && hasDamage && wingsOfLightFlyingInstanceIds?.has(roll._attackerInstanceId) && onWingsD8ToggleRequest && roll._rollDbId && (
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
                      ? 'border-dh-hope bg-dh-hover text-dh ring-1 ring-dh-hope/30'
                      : 'border-dh-strong bg-dh-raised text-dh-muted hover:bg-dh-hover'
                  } disabled:opacity-60 disabled:cursor-default`}
                >
                  <Tooltip label={wingsActive ? (wingsD8Result != null ? `+d8: ${wingsD8Result} — already applied` : 'Spend 1 Hope to add d8 to damage (applied on GM Acknowledge)') : 'Spend a Hope to add a d8 to damage'}>
                    <span>{wingsActive ? <Check size={12} className="shrink-0" /> : null}{wingsD8Result != null ? `+d8: ${wingsD8Result} (Spend 1 Hope)` : 'Spend 1 Hope to add d8 to damage'}</span>
                  </Tooltip>
                </button>
              );
            })()}
          </div>
        )}
        {/* Narration (e.g. Faun Kick knockback, Burning automated) */}
        {((roll._narrations?.length) ? roll._narrations : (roll._narration ? [{ text: roll._narration }] : [])).map((item, i) => {
          const isAutomated = item.style === 'automated';
          const cls = isAutomated ? 'text-[10px] text-green-400/90 italic text-center mt-1 dh-md' : 'text-[10px] text-dh-muted italic text-center mt-1 dh-md';
          return <MarkdownText key={i} text={item.text || ''} className={cls} />;
        })}
      </div>
      </div>
    </div>
    </Tooltip>
  );
}

// ── DiceRoller ──────────────────────────────────────────────────────────────
// Imperative API (via ref): addRoll(roll), updateRoll(optId, realData), dismiss(), dismissBannerId(bannerId), dismissBannerByDbId(dbId), replaceBannerByDbId(oldDbId, newRoll)
// Props: isPlayer, onBannerAcknowledge, onBannerCancel, lifeSupportSelections, onLifeSupportSelect, onLifeSupportClear,
//        targets, onApplyDamage, canApplyDamage,
//        onQuickTarget, onDoubledUpTarget, onBouncingTarget,
//        wizardsWithHope, onNotThisTime

export const DiceRoller = forwardRef(function DiceRoller({
  isPlayer = false,
  currentUserUid = null,
  onBannerAcknowledge,
  onBannerCancel,
  lifeSupportSelections = {},
  onLifeSupportSelect,
  onLifeSupportClear,
  actionAdversarySelections = {},
  onActionAdversarySelect,
  actionAdversaryTargets = [],
  targets,
  getTargetsForRoll,
  getTargetDisadvantageLabels,
  onApplyDamage,
  onApplyVulnerable,
  onConcussiveKnock,
  canApplyDamage = true,
  onQuickTarget,
  onDoubledUpTarget,
  onBouncingTarget,
  wizardsWithHope = [],
  onNotThisTime,
  displayOverridesByRollId = {},
  tableCharacters = [],
  rangerFocusRerollChars = [],
  onRangerFocusReroll,
  onRangerFocusRerollRequest,
  rangerFocusRequestedBannerIds,
  holdThemOffChars = [],
  onHoldThemOffToggle,
  onBannerTargetsChange,
  lockedOnAutoSuccessRollDbIds = new Set(),
  wingsOfLightFlyingInstanceIds,
  onWingsD8Toggle,
  onWingsD8ToggleRequest,
  onGetWingsD8Extra,
  getV2DamageBannerAckNotices,
  v2ReviewChipsByRollDbId = new Map(),
  onV2ReviewChip,
  resolveV2ReviewChipPicker,
  getV2ReviewChipDisableHint,
  canUseV2ReviewChips,
  restMovesSelections = {},
  onRestMoveSelect,
  onRestMoveClear,
  restTableCharacters = [],
  restMovesPerCharacter = {},
  restBannerChipsByInstanceId = {},
  restRefreshPreviewByInstanceId = {},
  onRestBannerV2Chip,
  restCanEditColumn = () => true,
  restGmUid = null,
  bannerStripLeftOffset = 0,
  diceCanvasHidden = false,
  getV2PendingMoveBlockInfo,
  sessionRole,
}, ref) {
  const diceCanvasHiddenRef = useRef(diceCanvasHidden);
  useEffect(() => {
    diceCanvasHiddenRef.current = diceCanvasHidden;
  }, [diceCanvasHidden]);

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
  const replayBannerIdsRef = useRef(new Set()); // bannerIds that should replay all dice (including preset)

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

      if (!entry) {
        diceQueueRef.current.shift();
        continue;
      }
      const isReplay = replayBannerIdsRef.current.has(nextId);
      if (isReplay) replayBannerIdsRef.current.delete(nextId);
      if (!isReplay && entry.resolved) {
        // Banner was dismissed or already resolved — skip (replay allows resolved)
        diceQueueRef.current.shift();
        continue;
      }

      // Optimistic banner: set as animating and wait for updateRoll to provide real data
      if (!isReplay && entry.roll._optimistic) {
        animatingIdRef.current = nextId;
        return;
      }

      const groups = isReplay
        ? parseRollDice(entry.roll.subItems || [])
        : parseRollDice(subItemsForAnimation(entry.roll.subItems));
      if (!groups.length || diceCanvasHiddenRef.current) {
        // No dice groups, or 3D canvas hidden — resolve immediately without animation
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
    if (
      shouldClearDiceCanvasOnBannerDismiss({
        animatingBannerId: animatingIdRef.current,
        dismissedBannerId: bannerId,
        dismissedResolved: !!entry.resolved,
      })
    ) {
      diceBoxRef.current?.clearDice();
      if (animatingIdRef.current === bannerId) animatingIdRef.current = null;
    }
    diceQueueRef.current = diceQueueRef.current.filter(id => id !== bannerId);
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

  /** Replay dice animation for a resolved banner (all dice including preset, with result values). Interrupts any current animation. */
  function replayDiceForBanner(bannerId) {
    const entry = activeBannersRef.current.find(b => b._bannerId === bannerId);
    if (!entry?.roll?.subItems?.length) return;
    const hasDice = (entry.roll.subItems || []).some(s => s.input && /d\d/i.test(s.input));
    if (!hasDice) return;
    resolveCurrentAndQueueInstantly();
    replayBannerIdsRef.current.add(bannerId);
    diceQueueRef.current.unshift(bannerId);
    processNextDice();
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

  // Hiding the 3D canvas: show numeric results immediately (no banner spinners).
  useEffect(() => {
    if (!diceCanvasHidden) return;
    resolveCurrentAndQueueInstantly();
    processNextDice();
  }, [diceCanvasHidden]);

  // ── Public API (imperative) ────────────────────────────────────────────────

  function addRoll(roll) {
    const isAction = !!roll._action;
    const hasAnimatableDice =
      Array.isArray(roll.subItems) &&
      roll.subItems.some((s) => s && typeof s.input === 'string' && /\d*d\d+/i.test(s.input));
    /** V2 engine-backed die (e.g. Rally clear stress): same action banner, but run 3D dice. */
    const v2ActionDiceAnim = !!(isAction && roll._v2AnimateDice && hasAnimatableDice);

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
    // Default: non-action rolls animate; pure action rolls do not unless V2 opt-in + subItems.
    // In player mode: only animate the player's own roll (_playerInitiated).
    //   Others' rolls skip dice if our own roll is animating or queued.
    // In GM mode: always animate when animateDice is true.
    let animateDice = !isAction || v2ActionDiceAnim;
    if (animateDice && isPlayer) {
      if (roll._playerInitiated) {
        animateDice = true;
      } else {
        // Another player's roll arriving via banners subscription: skip dice if busy
        animateDice = animatingIdRef.current === null && diceQueueRef.current.length === 0;
      }
    }
    if (diceCanvasHiddenRef.current) animateDice = false;

    // If this roll will animate and something is already rolling or queued, resolve those instantly
    // so only this roll gets the dice animation.
    if (animateDice && (animatingIdRef.current != null || diceQueueRef.current.length > 0)) {
      resolveCurrentAndQueueInstantly();
    }

    const bannerId = `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resolved = !animateDice;
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

  /** In-place replacement when a chip uses addDamage (e.g. Faun Kick). Updates the banner and animates only new (non-_preset) dice. */
  function replaceBannerByDbId(oldDbId, newRoll) {
    if (oldDbId == null) return;
    const current = activeBannersRef.current;
    const idx = current.findIndex(b => b.roll._rollDbId === oldDbId);
    if (idx < 0) {
      addRoll(newRoll);
      return;
    }
    const entry = current[idx];
    const mergedRoll = { ...newRoll, _bannerId: entry._bannerId };
    const groups = parseRollDice(subItemsForAnimation(newRoll.subItems || []));
    const shouldAnimateDice = groups.length > 0 && !diceCanvasHiddenRef.current;
    const resolved = !shouldAnimateDice;
    const updatedEntry = { ...entry, roll: mergedRoll, resolved };
    syncBanners(current.map((b, i) => i === idx ? updatedEntry : b));
    if (shouldAnimateDice) {
      diceQueueRef.current.push(entry._bannerId);
      processNextDice();
    }
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
        const groups = parseRollDice(subItemsForAnimation(realData.subItems));
        if (groups.length && !diceCanvasHiddenRef.current) {
          // Remove from diceQueue (it wasn't shifted yet since it was optimistic)
          diceQueueRef.current = diceQueueRef.current.filter(id => id !== bannerId);
          startAnimation(groups, bannerId);
        } else {
          // No dice groups or 3D hidden — resolve immediately
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

  function clearDice() {
    diceBoxRef.current?.clearDice();
  }

  useImperativeHandle(ref, () => ({ addRoll, updateRoll, dismiss, dismissFirst, dismissBannerId: dismissBannerById, dismissBannerByDbId, stampBannerDbId, updateBannerRollByDbId, replaceBannerByDbId, replayDiceForBanner, clearDice }), [isPlayer]);

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
            const groups = parseRollDice(subItemsForAnimation(entry.roll.subItems));
            if (groups.length && !diceCanvasHiddenRef.current) {
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
    <>
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: DICE_BOTTOM_RESERVE,
          visibility: diceCanvasHidden ? 'hidden' : 'visible',
        }}
      />
      {/* Banner strip — left edge offset by character tokens shelf width */}
      {activeBanners.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '2.5rem',
            left: bannerStripLeftOffset,
            right: 0,
            marginLeft: '16px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.5rem',
            padding: '0 0.75rem',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          {activeBanners.map(entry => (
            entry.roll._rest ? (
              <RestBanner
                key={entry._bannerId}
                roll={entry.roll}
                characters={restTableCharacters}
                restMovesForRoll={entry.roll._rollDbId != null ? (restMovesSelections[entry.roll._rollDbId] || {}) : {}}
                movesPerCharacter={restMovesPerCharacter}
                restBannerChipsByInstanceId={restBannerChipsByInstanceId}
                restRefreshPreviewByInstanceId={restRefreshPreviewByInstanceId}
                onRestBannerV2Chip={onRestBannerV2Chip}
                onRestMoveSelect={onRestMoveSelect}
                canEditColumn={restCanEditColumn}
                isPlayer={isPlayer}
                gmUid={restGmUid}
                onAcknowledge={!isPlayer ? () => {
                  onBannerAcknowledgeRef.current?.(entry._bannerId, entry.roll);
                  dismissBannerById(entry._bannerId);
                } : undefined}
                onCancel={!isPlayer ? () => {
                  onBannerCancelRef.current?.(entry._bannerId, entry.roll);
                  dismissBannerById(entry._bannerId);
                } : undefined}
                disableDismiss={isPlayer}
              />
            ) : entry.roll._action ? (
              <ActionBanner
                key={entry._bannerId}
                roll={entry.roll}
                lifeSupportSelectedId={entry.roll._rollDbId != null ? lifeSupportSelections[entry.roll._rollDbId] : undefined}
                onLifeSupportSelect={onLifeSupportSelect && entry.roll._rollDbId != null ? (instanceId) => onLifeSupportSelect(entry.roll._rollDbId, instanceId) : undefined}
                actionAdversarySelectedId={entry.roll._rollDbId != null ? actionAdversarySelections[entry.roll._rollDbId] : undefined}
                onActionAdversarySelect={onActionAdversarySelect && entry.roll._rollDbId != null ? (instanceId) => onActionAdversarySelect(entry.roll._rollDbId, instanceId) : undefined}
                actionAdversaryTargets={actionAdversaryTargets}
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
                getTargetDisadvantageLabels={getTargetDisadvantageLabels}
                onApplyDamage={onApplyDamage}
                onApplyVulnerable={onApplyVulnerable}
                onConcussiveKnock={onConcussiveKnock}
                disableDismiss={isPlayer}
                canApplyDamage={canApplyDamage}
                onQuickTarget={onQuickTarget}
                onDoubledUpTarget={onDoubledUpTarget}
                onBouncingTarget={onBouncingTarget}
                wizardsWithHope={wizardsWithHope}
                onNotThisTime={onNotThisTime}
                displayOverridesByRollId={displayOverridesByRollId}
                tableCharacters={tableCharacters}
                rangerFocusRerollChars={rangerFocusRerollChars}
                onRangerFocusReroll={onRangerFocusReroll}
                onRangerFocusRerollRequest={onRangerFocusRerollRequest}
                rangerFocusRequestedBannerIds={rangerFocusRequestedBannerIds}
                holdThemOffChars={holdThemOffChars}
                onHoldThemOffToggle={onHoldThemOffToggle}
                onBannerTargetsChange={onBannerTargetsChange}
                lockedOnAutoSuccessRollDbIds={lockedOnAutoSuccessRollDbIds}
                wingsOfLightFlyingInstanceIds={wingsOfLightFlyingInstanceIds}
                onWingsD8Toggle={onWingsD8Toggle}
                onWingsD8ToggleRequest={onWingsD8ToggleRequest}
                onGetWingsD8Extra={onGetWingsD8Extra}
                getV2DamageBannerAckNotices={getV2DamageBannerAckNotices}
                sessionRole={sessionRole}
                isPlayer={isPlayer}
                currentUserUid={currentUserUid}
                onResolveInstantly={!entry.resolved ? () => resolveBannerInstantly(entry._bannerId) : undefined}
                onReplayDice={entry.resolved ? () => replayDiceForBanner(entry._bannerId) : undefined}
                v2ReviewChips={v2ReviewChipsByRollDbId?.get(entry.roll._rollDbId) ?? []}
                onV2ReviewChip={onV2ReviewChip}
                resolveV2ReviewChipPicker={resolveV2ReviewChipPicker}
                getV2ReviewChipDisableHint={getV2ReviewChipDisableHint}
                canUseV2ReviewChips={canUseV2ReviewChips}
                v2PendingMoveInfo={getV2PendingMoveBlockInfo?.(entry.roll) ?? { blocked: false, desiredCondition: '', description: '', featureName: '' }}
              />
            )
          ))}
        </div>
      )}
    </div>
    </>
  );
});
