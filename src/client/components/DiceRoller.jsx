import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Info, CheckCircle, AlertTriangle, RotateCcw, Shield } from 'lucide-react';
import DiceBox from '@3d-dice/dice-box-threejs';
import { parseSubDetails as _parseSubDetails, extractDetailsValues } from '../lib/dice-utils.js';
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

function ActionBanner({ roll, onDismiss, disableDismiss }) {
  const visible = useBannerVisible();
  const displayName = roll.rollUser || roll.characterName || '';

  // Action notifications require explicit acknowledgement — no auto-dismiss.

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
        <div className="text-base font-bold text-amber-200 mb-1">{roll.actionName}</div>
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
        {!disableDismiss && (
          <button
            onClick={onDismiss}
            className="w-full px-3 py-1 rounded text-[11px] font-semibold border border-amber-700 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100 transition-colors"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}

/** Returns true when a feature tag requires explicit user interaction before dismissal. */
function isTagInteractive(tagName) {
  return weaponFeatures[tagName]?.interactive ?? false;
}

function ResultBanner({ roll, resolved, onDismiss, targets, onApplyDamage, disableDismiss, canApplyDamage = true, onLuckyReroll, onQuickTarget, onDoubledUpTarget, onBouncingTarget, wizardsWithHope = [], onNotThisTime }) {
  const visible = useBannerVisible();
  const { dominant, total, characterName, rollUser } = roll;
  const displayName = characterName || rollUser || '';
  // Active post-apply interaction: the name of the tag whose interaction phase is running.
  // Replaces the three separate quickPhase / doubledUpPhase / bouncingPhase states.
  const [activeInteractionTag, setActiveInteractionTag] = useState(null);

  const hasDHLabels   = (roll.subItems || []).some(s => /hope/i.test(s.pre || ''))
                     && (roll.subItems || []).some(s => /fear/i.test(s.pre || ''));
  const isDaggerheart = dominant != null || hasDHLabels;
  const isCritical    = dominant === 'critical';
  const isHope        = dominant === 'hope' || isCritical;

  const actionItems = (roll.subItems || []).filter(s => !/damage/i.test(s.pre || '') && !EXTRA_PRE_RE.test(s.pre || ''));
  const damageSub   = (roll.subItems || []).find(s => /damage/i.test(s.pre || '') && s.input);
  const extraItems  = (roll.subItems || []).filter(s => EXTRA_PRE_RE.test(s.pre || ''));
  const dmg         = parseDiceSub(damageSub);
  const hasDamage   = resolved && dmg != null;

  // Determine if this banner has any interactive actions that require user input before dismissal.
  const tags = roll.tags || [];
  const hasInteractiveTags = tags.some(t => isTagInteractive(t.name));
  const hasLucky = tags.some(t => t.name === 'Lucky') && dominant === 'fear';
  const needsInteraction = resolved && canApplyDamage && (hasDamage || hasInteractiveTags);

  // Whether to show action buttons (Acknowledge / Apply damage)
  const showActions = resolved && !disableDismiss;

  // DH rolls: label + numeric value for each non-damage sub-item.
  const dhParts = isDaggerheart
    ? actionItems
        .map(s => ({ label: extractBannerLabel(s.pre), value: parseInt(s.result, 10) }))
        .filter(p => p.label && (resolved ? (!isNaN(p.value) && p.value !== 0) : true))
    : [];

  // Generic rolls: parsed dice detail for the first action expression.
  const genericActionSub = !isDaggerheart
    ? actionItems.find(s => /d\d/i.test(s.input || ''))
    : null;
  const genericAction = parseDiceSub(genericActionSub);
  const genericTotal  = total ?? computeActionTotal(roll.subItems);

  // Color schemes for DH (hope/fear) vs generic rolls.
  const neutralScheme = { card: 'bg-slate-900/90 border-2 border-sky-500/60 text-sky-100', detail: 'text-sky-200/60' };
  const scheme = (!resolved || !isDaggerheart)
    ? neutralScheme
    : isHope
      ? { card: 'bg-amber-900/90 border-2 border-amber-400 text-amber-50', detail: 'text-amber-400/80' }
      : { card: 'bg-purple-950/90 border-2 border-purple-500/60 text-purple-100', detail: 'text-purple-200/60' };

  // Character rolls target adversaries; adversary/other rolls target characters.
  const allTargets = targets || [];
  const rollSrc = (rollUser || characterName || '').toLowerCase().trim();
  const isCharacterRoll = rollSrc
    ? allTargets.some(t => t.type === 'character' && (
        t.name.toLowerCase() === rollSrc ||
        rollSrc.startsWith(t.name.toLowerCase())
      ))
    : false;
  const filteredTargets = isCharacterRoll
    ? allTargets.filter(t => t.type === 'adversary')
    : allTargets.filter(t => t.type === 'character');

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
        className={`px-5 py-3 rounded-xl shadow-2xl text-center ${scheme.card}`}
      >
        {displayName && (
          <div className="text-[11px] uppercase tracking-widest opacity-70 mb-1.5">{displayName}</div>
        )}

        {/* ── Action line ── */}
        <div className="flex items-baseline justify-center flex-wrap gap-x-1 leading-snug">
          {isDaggerheart ? (
            <>
              {dhParts.length > 0 && (
                <span className={`text-[11px] ${scheme.detail}`}>
                  {dhParts.map((p, i) => (
                    <span key={i}>
                      {i > 0 && (isNaN(p.value) || p.value >= 0 ? ' + ' : ' \u2212 ')}
                      {p.label} {resolved ? Math.abs(p.value) : <Spinner />}
                    </span>
                  ))}
                  {' ='}
                </span>
              )}
              <span className="text-2xl font-black tabular-nums ml-1">
                {resolved ? total : <Spinner lg />}
              </span>
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
              {resolved ? genericTotal : <Spinner lg />}
            </span>
          )}
        </div>

        {/* ── Damage line ── */}
        {dmg && (
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
              {' ='}
            </span>
            <span className="text-lg font-black tabular-nums text-red-300 ml-1">
              {resolved ? dmg.total : <Spinner />}
            </span>
            {dmg.type && (
              <span className="text-sm font-semibold text-red-300/80 ml-0.5">{dmg.type}</span>
            )}
            <span className="text-sm font-semibold text-red-300/80">damage</span>
          </div>
        )}

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
              if (!isLoop) { setActiveInteractionTag(null); onDismiss?.(); }
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
                    onClick={() => { setActiveInteractionTag(null); onDismiss?.(); }}
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
            else onDismiss?.();
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
              {hasDamage && canApplyDamage ? (
                <>
                  <div className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Apply to</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {filteredTargets.map(t => {
                      const dmgType = dmg?.type || '';
                      const armorBlockedByType =
                        (t.armorFeatureName === 'Physical' && dmgType === 'mag') ||
                        (t.armorFeatureName === 'Magic'    && dmgType === 'phy');
                      const hasArmor = t.type === 'character' && (t.maxArmor ?? 0) > 0 && (t.currentArmor ?? 0) < (t.maxArmor ?? 0) && !armorBlockedByType;
                      return (
                        <div key={t.instanceId} className="flex gap-0.5">
                          <button
                            onClick={() => { onApplyDamage?.(t, dmg.total, tags, roll, dmgType); enterPostApplyPhase(); }}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                              t.type === 'character'
                                ? 'bg-sky-900/60 border-sky-700 text-sky-200 hover:bg-sky-800 hover:border-sky-500'
                                : 'bg-slate-800/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-400'
                            }`}
                          >
                            {t.name}
                          </button>
                          {hasArmor && (
                            <button
                              onClick={() => { onApplyDamage?.({ ...t, useArmor: true }, dmg.total, tags, roll, dmgType); enterPostApplyPhase(); }}
                              title={`Use Armor (${t.armorFeatureName || 'armor slot'}): mark 1 slot, reduce damage severity by 1`}
                              className="px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-colors bg-cyan-900/60 border-cyan-700 text-cyan-200 hover:bg-cyan-800 hover:border-cyan-500 flex items-center gap-0.5"
                            >
                              <Shield size={9} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={onDismiss}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={onDismiss}
                  className="w-full px-3 py-1 rounded text-[11px] font-semibold border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Acknowledge
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── DiceRoller ──────────────────────────────────────────────────────────────
// Imperative API (via ref): addRoll(roll), updateRoll(optId, realData), dismiss(), dismissBannerId(bannerId)
// Props: isPlayer, onComplete, targets, onApplyDamage, canApplyDamage,
//        onLuckyReroll, onQuickTarget, onDoubledUpTarget, onBouncingTarget,
//        wizardsWithHope, onNotThisTime

export const DiceRoller = forwardRef(function DiceRoller({
  isPlayer = false,
  onComplete,
  targets,
  onApplyDamage,
  canApplyDamage = true,
  onLuckyReroll,
  onQuickTarget,
  onDoubledUpTarget,
  onBouncingTarget,
  wizardsWithHope = [],
  onNotThisTime,
}, ref) {
  const containerRef   = useRef(null);
  const containerIdRef = useRef(`dice-canvas-container-${Date.now()}`);
  const diceBoxRef     = useRef(null);
  const initDoneRef    = useRef(false);
  const onCompleteRef  = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // activeBannersRef is the source of truth; activeBanners state is the rendering mirror.
  // All mutations update the ref synchronously first, then trigger re-render via setActiveBanners.
  const activeBannersRef = useRef([]); // [{ _bannerId, roll, resolved }]
  const [activeBanners, setActiveBanners] = useState([]);

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

  function dismissBannerById(bannerId) {
    const entry = activeBannersRef.current.find(b => b._bannerId === bannerId);
    if (!entry) return;
    // If this banner was animating, clear dice and reset
    if (animatingIdRef.current === bannerId) {
      diceBoxRef.current?.clearDice();
      animatingIdRef.current = null;
    }

    // Remove from banner list
    syncBanners(activeBannersRef.current.filter(b => b._bannerId !== bannerId));

    // Fire side-effect callback
    onCompleteRef.current?.(entry.roll);

    // Process next dice animation
    processNextDice();
  }

  function dismiss() {
    // Dismiss all banners — used by GM multi-window dice-ack sync
    const all = [...activeBannersRef.current];
    diceBoxRef.current?.clearDice();
    animatingIdRef.current = null;
    diceQueueRef.current = [];
    syncBanners([]);
    for (const entry of all) {
      onCompleteRef.current?.(entry.roll);
    }
  }

  /** Dismiss only the oldest (first) banner. Used by player when receiving one dice-ack so we don't clear all banners. */
  function dismissFirst() {
    const current = activeBannersRef.current;
    if (current.length === 0) return;
    const first = current[0];
    dismissBannerById(first._bannerId);
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
        if (oldest) {
          current = current.filter(b => b._bannerId !== oldest._bannerId);
          onCompleteRef.current?.(oldest.roll);
        }
      }
      syncBanners([...current, entry]);
      return;
    }

    // Decide whether to animate dice for this roll.
    // In player mode: only animate the player's own roll (_playerInitiated).
    //   SSE rolls from others skip dice if own roll is animating or queued.
    // In GM mode: always animate.
    let animateDice = !isAction;
    if (animateDice && isPlayer) {
      if (roll._playerInitiated) {
        animateDice = true;
      } else {
        // Another player's SSE roll on the player's screen: skip dice if busy
        animateDice = animatingIdRef.current === null && diceQueueRef.current.length === 0;
      }
    }

    const bannerId = `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resolved = isAction || !animateDice;
    const entry = { _bannerId: bannerId, roll: { ...roll, _bannerId: bannerId }, resolved };

    // If at cap, evict oldest resolved banner to make room
    let current = activeBannersRef.current;
    if (current.length >= 8) {
      const oldest = current.find(b => b.resolved);
      if (oldest) {
        current = current.filter(b => b._bannerId !== oldest._bannerId);
        onCompleteRef.current?.(oldest.roll);
      }
    }

    syncBanners([...current, entry]);

    if (animateDice) {
      diceQueueRef.current.push(bannerId);
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

  useImperativeHandle(ref, () => ({ addRoll, updateRoll, dismiss, dismissFirst, dismissBannerId: dismissBannerById }), [isPlayer]);

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
            pointerEvents: 'none',
          }}
        >
          {activeBanners.map(entry => (
            entry.roll._action ? (
              <ActionBanner
                key={entry._bannerId}
                roll={entry.roll}
                onDismiss={() => dismissBannerById(entry._bannerId)}
                disableDismiss={false}
              />
            ) : (
              <ResultBanner
                key={entry._bannerId}
                roll={{ ...entry.roll, _bannerId: entry._bannerId }}
                resolved={entry.resolved}
                onDismiss={() => dismissBannerById(entry._bannerId)}
                targets={targets}
                onApplyDamage={onApplyDamage}
                disableDismiss={false}
                canApplyDamage={canApplyDamage}
                onLuckyReroll={onLuckyReroll}
                onQuickTarget={onQuickTarget}
                onDoubledUpTarget={onDoubledUpTarget}
                onBouncingTarget={onBouncingTarget}
                wizardsWithHope={wizardsWithHope}
                onNotThisTime={onNotThisTime}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
});
