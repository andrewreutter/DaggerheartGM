import {
  User, Shield, Heart, AlertCircle, AlertTriangle, Swords, Package,
  ChevronDown, ChevronRight, Dices, Zap, X, Flame, Mountain, Droplets, Wind,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { MarkdownText } from '../lib/markdown.js';
import { effectiveThresholds, parseBeastformBonus, getEvasionModifierTotal, formatEvasionModifierTooltip } from '../lib/helpers.js';

export { parseBeastformBonus, getEvasionModifierTotal, formatEvasionModifierTooltip } from '../lib/helpers.js';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { isCharacterComplete, recomputeCharacter, detectPairedWeapons, parsePairedBonus, applyDamageBonus, detectVersatileWeapons, detectOtherworldlyWeapons, detectChargedWeapons, getEffectiveWeaponRange, runCharacterRender } from '../lib/character-calc.js';
import { mergeV2DeclarativeSheetOverlay } from '../lib/v2-declarative-sheet.js';
import { FeatureResourceCostIcons } from './FeatureResourceCostIcons.jsx';
import { GuideFeatureCard, GuideFeatureCardChips } from './features/GuideFeatureCard.jsx';
import { buildFeatureCardModelForCharacter } from '../lib/build-feature-card-model.js';
import { rangeBandNameToFt } from '../lib/map-range.js';
import { Tooltip } from './Tooltip.jsx';

const FEATURES_PANEL_TAB_STORAGE = 'dh_featuresPanelTab';

function readFeaturesPanelTab(storageKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(FEATURES_PANEL_TAB_STORAGE) ?? 'null') ?? {};
    const v = raw[storageKey];
    if (v === 'actions' || v === 'details') return v;
  } catch {}
  return 'actions';
}

function persistFeaturesPanelTab(storageKey, tab) {
  try {
    const raw = JSON.parse(localStorage.getItem(FEATURES_PANEL_TAB_STORAGE) ?? 'null') ?? {};
    raw[storageKey] = tab;
    localStorage.setItem(FEATURES_PANEL_TAB_STORAGE, JSON.stringify(raw));
  } catch {}
}

// ─── Gold helpers ─────────────────────────────────────────────────────────────

/** Convert raw gold integer to handfuls / bags / chests using base-9 math. */
export function formatGold(gold) {
  const g = Math.max(0, Math.floor(gold || 0));
  const chests = Math.floor(g / 81);
  const bags = Math.floor((g % 81) / 9);
  const handfuls = g % 9;
  const parts = [];
  if (chests) parts.push(`${chests} chest${chests !== 1 ? 's' : ''}`);
  if (bags) parts.push(`${bags} bag${bags !== 1 ? 's' : ''}`);
  if (handfuls || !parts.length) parts.push(`${handfuls} handful${handfuls !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

import { resolveHopeFeatureName, getOrderedGuideFeatureEntries } from '../lib/guide-feature-entries.js';

export { resolveHopeFeatureName, getOrderedGuideFeatureEntries };

// ─── Trait display ─────────────────────────────────────────────────────────────

export const TRAIT_LABELS = {
  agility: 'AGI', strength: 'STR', finesse: 'FIN',
  instinct: 'INS', presence: 'PRE', knowledge: 'KNO',
};

export const TRAIT_FULL = {
  agility: 'Agility', strength: 'Strength', finesse: 'Finesse',
  instinct: 'Instinct', presence: 'Presence', knowledge: 'Knowledge',
};

export const TRAIT_VERBS = {
  agility:   ['Sprint', 'Leap', 'Maneuver'],
  strength:  ['Lift', 'Smash', 'Grapple'],
  finesse:   ['Control', 'Hide', 'Tinker'],
  instinct:  ['Perceive', 'Sense', 'Navigate'],
  presence:  ['Charm', 'Perform', 'Deceive'],
  knowledge: ['Recall', 'Analyze', 'Comprehend'],
};

const TRAIT_ORDER = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

// ─── Weapon tag descriptions (from SRD) ──────────────────────────────────────
// Fallback lookup when w.feature.text is not present in Daggerstack sync data.

export const WEAPON_TAG_DESCRIPTIONS = {
  Reliable: '+1 to attack rolls',
  Massive: '-1 to Evasion; on a successful attack, roll an additional damage die and discard the lowest result.',
  Heavy: '-1 to Evasion',
  Quick: 'When you make an attack, you can mark a Stress to target another creature within range.',
  Cumbersome: '-1 to Finesse',
  Returning: 'When this weapon is thrown within its range, it appears in your hand immediately after the attack.',
  Versatile: 'This weapon can also be used with alternate statistics (see weapon description).',
  Powerful: 'On a successful attack, roll an additional damage die and discard the lowest result.',
  Paired: 'Bonus to primary weapon damage to targets within Melee range.',
  Brutal: 'When you roll the maximum value on a damage die, roll an additional damage die.',
  Deadly: 'When you deal Severe damage, the target must mark an additional HP.',
  Scary: 'On a successful attack, the target must mark a Stress.',
  Reloading: 'After you make an attack, roll a d6. On a 1, you must mark a Stress to reload before firing again.',
  Protective: 'Bonus to Armor Score.',
  Barrier: 'Bonus to Armor Score; -1 to Evasion.',
  Startling: 'Mark a Stress to force all adversaries within Melee range back to Close range.',
  Hooked: 'On a successful attack, you can pull the target into Melee range.',
  'Double Duty': '+1 to Armor Score; +1 to primary weapon damage within Melee range.',
  Parry: "When attacked, roll this weapon's damage dice. Matching results are discarded from the attacker's damage.",
  Pompous: 'You must have a Presence of 0 or lower to use this weapon.',
  Eruptive: 'On a successful Melee attack, other adversaries within Very Close range must succeed on a reaction roll (14) or take half damage.',
  Invigorating: 'On a successful attack, roll a d4. On a 4, clear a Stress.',
  Persuasive: 'Before a Presence Roll, mark a Stress to gain +2 to the result.',
  Sharpwing: 'Gain a bonus to your damage rolls equal to your Agility.',
  Brave: '-1 to Evasion; +3 to Severe damage threshold.',
  Devastating: 'Before an attack roll, mark a Stress to use a d20 as your damage die.',
  Dueling: 'When no other creatures are within Close range of the target, gain advantage on your attack roll.',
  Retractable: 'The blade can be hidden in the hilt to avoid detection.',
  'Self-Correcting': 'When you roll a 1 on a damage die, it deals 6 damage instead.',
  Burning: 'When you roll a 6 on a damage die, the target must mark a Stress.',
  Painful: 'Each time you make a successful attack, you must mark a Stress.',
  Timebending: 'You choose the target of your attack after making your attack roll.',
  Lucky: 'On a failed attack, mark a Stress to reroll your attack.',
  Healing: 'During downtime, automatically clear a Hit Point.',
  Otherworldly: 'On a successful attack, you can deal physical or magic damage.',
  Deflecting: 'When attacked, mark an Armor Slot to gain a bonus to Evasion equal to your available Armor Score.',
  Charged: 'Mark a Stress to gain +1 to your Proficiency on a primary weapon attack.',
  Hot: 'This weapon cuts through solid material.',
  Lifestealing: 'On a successful attack, roll a d6. On a 6, clear a Hit Point or a Stress.',
  Greedy: 'Spend a handful of gold to gain +1 to your Proficiency on a damage roll.',
  Concussive: 'On a successful attack, spend a Hope to knock the target back to Far range.',
  Destructive: '-1 to Agility; on a successful attack, all adversaries within Very Close range must mark a Stress.',
  Serrated: 'When you roll a 1 on a damage die, it deals 8 damage instead.',
  Long: "This weapon's attack targets all adversaries in a line within range.",
  Grappling: 'On a successful attack, spend a Hope to Restrain the target or pull them into Melee range.',
  Bouncing: 'Mark 1 or more Stress to hit that many targets in range.',
  Sheltering: 'When you mark an Armor Slot, it reduces damage for you and all allies within Melee range who took the same damage.',
  'Doubled Up': 'When you attack with your primary weapon, you can deal damage to another target within Melee range.',
  'Locked On': 'On a successful attack, your next primary weapon attack against the same target automatically succeeds.',
  Bonded: 'Gain a bonus to your damage rolls equal to your level.',
};

// ─── Beastform helpers ─────────────────────────────────────────────────────────

// ─── Section header ───────────────────────────────────────────────────────────

export function Section({ label, children, labelUppercase = true }) {
  return (
    <div className="space-y-1">
      <p className={`text-[9px] tracking-widest text-slate-500 font-semibold ${labelUppercase ? 'uppercase' : ''}`}>{label}</p>
      {children}
    </div>
  );
}

// ─── Trait chip ───────────────────────────────────────────────────────────────

function TraitChip({ trait, label, score, onClick, mod, modSource }) {
  const [justRolled, setJustRolled] = useState(false);
  const positive = score > 0;
  const negative = score < 0;
  const display = positive ? `+${score}` : String(score);
  const hasModifier = (mod != null && mod !== 0) || !!modSource;
  const showModLine = mod != null && mod !== 0;
  const verbs = TRAIT_VERBS[trait] || [];
  const clickable = !!onClick;
  const handleClick = clickable ? (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
    setJustRolled(true);
    setTimeout(() => setJustRolled(false), 1200);
  } : undefined;
  const title = (hasModifier && modSource)
    ? modSource
    : clickable ? `Roll ${TRAIT_FULL[trait]}` : undefined;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={title}
      className={`flex flex-col items-center rounded px-1 py-1 border select-none
        ${justRolled ? 'border-green-500/70 bg-green-900/40' :
          hasModifier ? 'border-amber-600/70 bg-amber-950/30' :
          positive ? 'border-sky-700/60 bg-sky-900/40' : negative ? 'border-slate-600 bg-slate-800/40' : 'border-slate-700 bg-slate-800/20'}
        ${clickable ? 'cursor-pointer hover:brightness-125 hover:border-sky-500/70 group transition-all' : ''}`}
    >
      <span className="text-[9px] uppercase tracking-widest text-slate-400 flex items-center gap-0.5">
        {label}
        {clickable && <Dices size={7} className={`transition-colors ${justRolled ? 'text-green-400' : 'text-slate-600 group-hover:text-sky-400'}`} />}
      </span>
      <span className={`text-sm font-bold tabular-nums leading-tight ${hasModifier ? 'text-amber-200' : positive ? 'text-sky-300' : negative ? 'text-slate-400' : 'text-slate-200'}`}>{display}</span>
      {showModLine && (
        <span className={`text-[9px] font-semibold tabular-nums leading-none ${mod > 0 ? 'text-amber-400' : 'text-amber-500'}`}>
          {mod > 0 ? `+${mod}` : String(mod)}
        </span>
      )}
      {!showModLine && verbs.length > 0 && (
        <div className="flex flex-col items-center mt-0.5 gap-px">
          {verbs.map(v => (
            <span key={v} className="text-[8px] text-slate-500 leading-tight">{v}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Spellcast chip ───────────────────────────────────────────────────────────

function SpellcastChip({ onClick }) {
  const [justRolled, setJustRolled] = useState(false);
  const interactive = !!onClick;
  const handleClick = interactive ? (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
    setJustRolled(true);
    setTimeout(() => setJustRolled(false), 1200);
  } : undefined;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={interactive ? 'Roll Spellcast' : 'Spellcast trait'}
      className={`inline-flex items-center justify-center rounded px-1 py-0.5 border whitespace-nowrap transition-all
        ${interactive
          ? `select-none cursor-pointer hover:brightness-125 hover:border-violet-500/70 group
             ${justRolled ? 'border-green-500/70 bg-green-900/40' : 'border-violet-700/50 bg-violet-950/30'}`
          : 'border-violet-800/40 bg-violet-950/20 cursor-default'
        }`}
    >
      <span className="text-[9px] uppercase tracking-widest font-semibold flex items-center gap-0.5">
        <span className={justRolled ? 'text-green-300' : interactive ? 'text-violet-300' : 'text-violet-400/70'}>Spellcast</span>
        {interactive && <Dices size={7} className={`transition-colors ${justRolled ? 'text-green-400' : 'text-violet-600 group-hover:text-violet-400'}`} />}
      </span>
    </div>
  );
}

// ─── Weapon card ──────────────────────────────────────────────────────────────

/** Game Table only: disable when no adversaries are in this weapon's range on the map. */
function outOfRangeDisableReason(weapon, getValidTargets, instanceId, ancestryFeatures) {
  if (!getValidTargets || !instanceId) return null;
  const rangeStr = getEffectiveWeaponRange(weapon, ancestryFeatures) || weapon.effectiveRange || weapon.range;
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const ft = rangeBandNameToFt(rangeStr);
  if (ft == null) return null;
  const targets = getValidTargets(instanceId, { weaponRangeFt: ft }) ?? [];
  return targets.length === 0 ? 'No targets in range' : null;
}

function WeaponCard({ weapon, traitScore, onClick, isVirtual, purple, devastating, onDevastatingToggle, pompousWarning, v2DisableReason, outOfRangeReason }) {
  const [justRolled, setJustRolled] = useState(false);
  const disableMsg = v2DisableReason || (pompousWarning ? 'Requires Presence ≤ 0' : null) || outOfRangeReason || null;
  const clickable = !!onClick && !disableMsg;
  const traitKey = (weapon.trait || '').toLowerCase();
  const traitLabel = TRAIT_LABELS[traitKey];
  const traitScore_ = traitScore ?? 0;
  const traitDisplay = traitScore_ > 0 ? `+${traitScore_}` : String(traitScore_);

  const handleClick = clickable ? (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick(e);
    setJustRolled(true);
    setTimeout(() => setJustRolled(false), 1200);
  } : undefined;

  const feat = weapon.feature;
  const featDesc = feat && (feat.text || feat.description || WEAPON_TAG_DESCRIPTIONS[feat.name]);

  let baseBorder;
  if (purple) {
    baseBorder = justRolled ? 'border-green-500/70 bg-green-900/40' : 'border-purple-700/50 bg-purple-950/30';
  } else if (isVirtual) {
    baseBorder = justRolled ? 'border-green-500/70 bg-green-900/40' : 'border-amber-700/50 bg-amber-950/30';
  } else if (disableMsg) {
    baseBorder = 'border-amber-600/60 bg-amber-950/20 opacity-60';
  } else {
    baseBorder = justRolled ? 'border-green-500/70 bg-green-900/40' : 'border-slate-700 bg-slate-800/60';
  }

  const iconColor = justRolled ? 'text-green-400'
    : purple ? 'text-purple-500/70'
    : isVirtual ? 'text-amber-500/70'
    : clickable ? 'text-slate-500 group-hover:text-sky-400'
    : 'text-slate-500';
  const nameColor = purple ? 'text-purple-100' : isVirtual ? 'text-amber-100' : 'text-slate-200';
  const featDescColor = purple ? 'text-purple-400/80' : isVirtual ? 'text-amber-400/80' : 'text-amber-400/70';
  const damageTypeColor = purple ? 'text-purple-400/70' : 'text-slate-500';

  const card = (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={!disableMsg && clickable && traitLabel ? `Roll ${weapon.name} (${TRAIT_FULL[traitKey]})` : undefined}
      className={`w-full min-w-0 rounded border px-2 py-1.5 select-none text-[11px] transition-all
        ${baseBorder}
        ${clickable ? 'cursor-pointer hover:brightness-125 hover:border-sky-500/50 group' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Swords size={10} className={`shrink-0 transition-colors ${iconColor}`} />
        <span className={`font-semibold flex-1 truncate ${nameColor}`}>{weapon.name}</span>
        {weapon.damage && (
          <span className="text-yellow-300 font-semibold tabular-nums shrink-0">
            {devastating ? 'd20' + ((weapon.damage.match(/[+-]\d+/) || [''])[0]) : weapon.damage}
          </span>
        )}
        {weapon.damageType && (
          <span className={`shrink-0 ${damageTypeColor}`}>{weapon.damageType}</span>
        )}
        {(weapon.effectiveRange ?? weapon.range) && (
          <span className="text-slate-500 shrink-0">{weapon.effectiveRange ?? weapon.range}</span>
        )}
        {traitLabel && (
          <span className={`text-[9px] rounded px-1 py-0.5 border shrink-0 tabular-nums font-bold
            ${traitScore_ > 0 ? 'bg-sky-900/50 border-sky-700/50 text-sky-300' : traitScore_ < 0 ? 'bg-slate-800 border-slate-600 text-slate-400' : 'bg-slate-800/60 border-slate-700 text-slate-400'}`}
          >
            {traitLabel} {traitDisplay}
          </span>
        )}
        {clickable && (
          <Dices size={9} className={`shrink-0 transition-colors ${justRolled ? 'text-green-400' : 'text-slate-600 group-hover:text-sky-400'}`} />
        )}
      </div>
      {feat && featDesc && (
        <div className={`text-[10px] mt-0.5 pl-5 ${featDescColor}`}>
          {feat.name}: {featDesc}
        </div>
      )}
      {onDevastatingToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onDevastatingToggle(); }}
          className={`text-[9px] mt-1 ml-5 px-1.5 py-0.5 rounded border transition-colors ${
            devastating
              ? 'bg-red-900/50 border-red-700/60 text-red-200'
              : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
          }`}
        >
          {devastating ? 'd20 damage ON (1 Stress)' : 'd20 damage (1 Stress)'}
        </button>
      )}
      {disableMsg && (
        <div className="text-[9px] mt-1 ml-5 text-amber-400 flex items-center gap-1">
          <AlertCircle size={9} className="shrink-0" />
          {disableMsg}
        </div>
      )}
    </div>
  );

  if (disableMsg) {
    return (
      <Tooltip label={disableMsg} className="relative block w-full min-w-0">
        {card}
      </Tooltip>
    );
  }
  return card;
}

// ─── Feature state display ────────────────────────────────────────────────────

/**
 * Collect numeric feature state from el._originFeatureState for stat-block display.
 * Returns [{ featureName, key, label, value }] where label is the key capitalized.
 */
export function getNumericFeatureStateEntries(el) {
  const bag = el?._originFeatureState;
  if (!bag || typeof bag !== 'object') return [];
  const entries = [];
  for (const featureName of Object.keys(bag)) {
    const state = bag[featureName];
    if (!state || typeof state !== 'object') continue;
    for (const key of Object.keys(state)) {
      const value = state[key];
      if (typeof value === 'number' && !Number.isNaN(value)) {
        const label = key.length ? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase() : key;
        entries.push({ featureName, key, label, value });
      }
    }
  }
  return entries;
}

// ─── Exported components ──────────────────────────────────────────────────────

export function CharacterIdentityHeader({ el, showIncomplete = false, actions }) {
  const charCheck = showIncomplete ? isCharacterComplete(el) : null;
  return (
    <div className="px-3 py-2.5 bg-sky-950/40 border-b border-sky-900/30">
      <div className="flex items-start gap-2">
        <User size={14} className="text-sky-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-sky-100 leading-tight">{el.name || 'Unnamed Character'}</span>
            <span className="text-[10px] font-bold text-sky-400/70 bg-sky-900/50 border border-sky-800/50 rounded px-1.5">
              T{el.tier ?? 1}
            </span>
            {charCheck && !charCheck.complete && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/60" title={`Missing: ${charCheck.missing.join(', ')}`}>
                <AlertTriangle size={9} />
                Incomplete
              </span>
            )}
            {el.level != null && (
              <span className="text-[10px] text-slate-400">Lvl {el.level}</span>
            )}
          </div>
          {(el.class || el.subclass) && (
            <div className="text-[11px] text-sky-300/70 leading-tight mt-0.5">
              {[el.class, el.subclass].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {el.pronouns && <span className="text-[10px] text-slate-500">{el.pronouns}</span>}
            {(el.ancestry || []).map(a => (
              <span key={a} className="text-[9px] bg-amber-900/40 border border-amber-800/40 text-amber-300 rounded px-1">{a}</span>
            ))}
            {el.community && (
              <span className="text-[9px] bg-emerald-900/40 border border-emerald-800/40 text-emerald-300 rounded px-1">{el.community}</span>
            )}
            {(el.domains || []).map(d => (
              <span key={d} className="text-[9px] bg-violet-900/40 border border-violet-800/40 text-violet-300 rounded px-1">{d}</span>
            ))}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-1 shrink-0">{actions}</div>
        )}
      </div>
      {el.playerName && (
        <div className="text-[10px] text-slate-500 mt-0.5 ml-6">Player: {el.playerName}</div>
      )}
    </div>
  );
}

/**
 * 6-trait grid.
 *
 * Props:
 *   onTraitClick(traitKey, opts?) — when provided, chips become clickable. opts may include { isReaction: true }.
 */
export function CharacterTraitGrid({ el, onTraitClick, onSpellcastRoll }) {
  const traits = el.traits || {};
  if (!TRAIT_ORDER.some(t => traits[t] != null)) return null;
  const weaponMods = el.weaponMods || {};
  const armorMods = el.armorMods || {};
  const beastformTraitBonus = parseBeastformBonus(el.activeBeastform?.trait_bonus);
  return (
    <Section label={onTraitClick ? 'Traits — click to roll' : 'Traits'}>
      <div className="grid grid-cols-6 gap-1">
        {TRAIT_ORDER.map(t => {
          const score = traits[t] ?? 0;
          const wMod = weaponMods.traits?.[t] ?? 0;
          const aMod = armorMods.traits?.[t] ?? 0;
          const bfMod = beastformTraitBonus?.stat === t ? beastformTraitBonus.bonus : 0;
          const mod = wMod + aMod + bfMod;
          const sources = [];
          if (wMod !== 0) {
            sources.push(...(weaponMods.sources || [])
              .filter(s => s.stat === t)
              .map(s => `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to ${TRAIT_FULL[t]}`));
          }
          if (aMod !== 0) {
            sources.push(...(armorMods.sources || [])
              .filter(s => s.stat === t)
              .map(s => `${s.feature} (${s.armor}): ${s.value > 0 ? '+' : ''}${s.value} to ${TRAIT_FULL[t]}`));
          }
          if (bfMod !== 0) {
            sources.push(`Beastform (${el.activeBeastform.name}): ${bfMod > 0 ? '+' : ''}${bfMod} to ${TRAIT_FULL[t]}`);
          }
          const modSource = sources.length ? sources.join('; ') : null;
          // Show effective trait (base + all mods) as the main number so e.g. beastform "+1" reads as the trait being +3, not "+2 with +1 under it"
          const effectiveScore = score + mod;
          return (
            <TraitChip
              key={t}
              trait={t}
              label={TRAIT_LABELS[t]}
              score={effectiveScore}
              onClick={onTraitClick ? () => onTraitClick(t) : undefined}
              mod={undefined}
              modSource={modSource || undefined}
            />
          );
        })}
      </div>
      {onTraitClick && (
        <div className="grid grid-cols-6 gap-1 mt-1">
          {TRAIT_ORDER.map(t => (
            <button
              key={t}
              type="button"
              onClick={(e) => { e.stopPropagation(); onTraitClick(t, { isReaction: true }); }}
              title={`Roll ${TRAIT_FULL[t]} as a reaction`}
              className="rounded px-1 py-0.5 border border-slate-600/60 bg-slate-800/40 text-[9px] font-medium text-slate-400 hover:bg-slate-700/50 hover:border-slate-500 hover:text-slate-300 transition-colors"
            >
              Reaction
            </button>
          ))}
        </div>
      )}
      {el.spellcastTrait && (() => {
        const traitKey = el.spellcastTrait.toLowerCase();
        const colIndex = TRAIT_ORDER.indexOf(traitKey);
        if (colIndex === -1) return null;
        return (
          <div className="relative mt-1" style={{ height: '22px' }}>
            <div className="grid grid-cols-6 gap-1 h-full pointer-events-none absolute inset-0">
              {TRAIT_ORDER.map((_, i) => (
                <div key={i} className={`flex justify-center ${i === colIndex ? 'overflow-visible pointer-events-auto' : ''}`}>
                  {i === colIndex && <SpellcastChip onClick={onSpellcastRoll || undefined} />}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </Section>
  );
}

export function CharacterDefenseRow({ el }) {
  if (el.evasion == null && !el.armorScore) return null;
  const thresholds = effectiveThresholds(el);
  const wm = el.weaponMods || {};
  const am = el.armorMods || {};
  const totalEvasionMod = getEvasionModifierTotal(el);
  const evasionTooltipContent = formatEvasionModifierTooltip(el);
  const earthBonus = el._v2MajorThresholdBonus ?? 0;
  const ancestryMajorBonus = el.ancestryThresholdMajorBonus ?? el.ancestryThresholdBonus ?? 0;
  const ancestrySevereBonus = el.ancestryThresholdSevereBonus ?? el.ancestryThresholdBonus ?? 0;
  const ancestryBonusSource = el.ancestryThresholdBonusSource || null;
  const armorModTooltip = wm.armorScore
    ? (wm.sources || []).filter(s => s.stat === 'armor score').map(s => `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to Armor Score`).join('; ')
    : null;
  const severeModTooltip = wm.severeThreshold
    ? (wm.sources || []).filter(s => s.stat === 'severe damage threshold').map(s => `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to Severe threshold`).join('; ')
    : null;
  const thresholdTooltipParts = [];
  if ((ancestryMajorBonus > 0 || ancestrySevereBonus > 0) && ancestryBonusSource) {
    if (ancestryMajorBonus === ancestrySevereBonus) {
      thresholdTooltipParts.push(`${ancestryBonusSource}: +${ancestryMajorBonus} to Major and Severe`);
    } else {
      if (ancestryMajorBonus > 0) thresholdTooltipParts.push(`${ancestryBonusSource}: +${ancestryMajorBonus} to Major`);
      if (ancestrySevereBonus > 0) thresholdTooltipParts.push(`${ancestryBonusSource}: +${ancestrySevereBonus} to Severe`);
    }
  }
  if (earthBonus > 0) thresholdTooltipParts.push(`Elemental channel (Earth): +${earthBonus} to Major and Severe`);
  const thresholdModTooltip = thresholdTooltipParts.length ? thresholdTooltipParts.join('; ') : null;
  const armorFeature = am.feature;
  const isStatModFeature = armorFeature && /^(Flexible|Heavy|Very Heavy|Gilded|Difficult)$/.test(armorFeature.name);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 text-xs flex-wrap">
        {el.evasion != null && (
          <Tooltip
            content={evasionTooltipContent || undefined}
            className="inline-flex items-center gap-1"
            placement="bottom-right"
          >
            <Shield size={11} className="text-cyan-500 shrink-0" />
            <span className="text-slate-400">Evasion</span>
            <span className={`font-bold tabular-nums ${totalEvasionMod ? 'text-amber-200' : 'text-cyan-200'}`}>{el.evasion}</span>
            {totalEvasionMod ? <span className={`text-[10px] font-semibold tabular-nums ${totalEvasionMod > 0 ? 'text-amber-400' : 'text-amber-500'}`}>({totalEvasionMod > 0 ? '+' : ''}{totalEvasionMod})</span> : null}
          </Tooltip>
        )}
        {el.armorScore > 0 && (
          <div className="flex items-center gap-1" title={armorModTooltip || undefined}>
            <span className="text-slate-400">Armor</span>
            <span className={`font-bold tabular-nums ${wm.armorScore ? 'text-amber-200' : 'text-cyan-200'}`}>{el.armorScore}</span>
            {wm.armorScore ? <span className={`text-[10px] font-semibold tabular-nums ${wm.armorScore > 0 ? 'text-amber-400' : 'text-amber-500'}`}>({wm.armorScore > 0 ? '+' : ''}{wm.armorScore})</span> : null}
            {el.armorName && <span className="text-slate-500">({el.armorName})</span>}
            {armorFeature && (
              <span
                title={armorFeature.description}
                className={`text-[9px] rounded px-1 py-0.5 border ${
                  isStatModFeature
                    ? 'bg-slate-800/60 border-slate-700 text-slate-400'
                    : 'bg-teal-900/40 border-teal-700/50 text-teal-300'
                }`}
              >{armorFeature.name}</span>
            )}
          </div>
        )}
        {thresholds && (
          <div className="text-slate-400" title={thresholdModTooltip || severeModTooltip || undefined}>
            Thresholds:{' '}
            {(earthBonus > 0 || ancestryMajorBonus > 0) ? (
              <>
                <span className="text-yellow-300/50 font-semibold">{thresholds.major - earthBonus - ancestryMajorBonus}</span>
                {ancestryMajorBonus > 0 && <span className="text-slate-500"> +{ancestryMajorBonus}{ancestryBonusSource ? ` (${ancestryBonusSource})` : ''}</span>}
                {earthBonus > 0 && <span className="text-slate-500"> +{earthBonus} (Earth)</span>}
                <span className="text-slate-500"> = </span>
              </>
            ) : null}
            <span className="text-yellow-300 font-semibold">{thresholds.major}</span>
            <span className="text-slate-500"> / </span>
            <span className={`font-semibold ${wm.severeThreshold ? 'text-amber-300' : 'text-red-300'}`} title={severeModTooltip || undefined}>
              {(earthBonus > 0 || ancestrySevereBonus > 0) ? (
                <>
                  <span className="opacity-50">{thresholds.severe - earthBonus - ancestrySevereBonus}</span>
                  {ancestrySevereBonus > 0 && <span className="text-slate-500 font-normal"> +{ancestrySevereBonus}{ancestryBonusSource ? ` (${ancestryBonusSource})` : ''}</span>}
                  {earthBonus > 0 && <span className="text-slate-500 font-normal"> +{earthBonus} (Earth)</span>}
                  <span className="text-slate-500 font-normal"> = </span>
                </>
              ) : null}
              {thresholds.severe}{wm.severeThreshold ? <span className="text-[10px] text-amber-400"> ({wm.severeThreshold > 0 ? '+' : ''}{wm.severeThreshold})</span> : null}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Cross-sheet V2 chip: instant tooltip when blocked by resources or `isDisabled`. */
function CrossSheetChipButton({ c, onCrossSheetChipClick }) {
  const title = c.description || c.name;
  const blocked = !!(c.disabled || c.resourceUnaffordable);
  const hint = c.disableHint;
  if (!onCrossSheetChipClick) {
    return (
      <span title={title} className="text-[11px] rounded px-1.5 py-0.5 border bg-violet-950/40 border-violet-700/50 text-violet-200">
        {c.name}
      </span>
    );
  }
  const btn = (
    <button
      type="button"
      title={title}
      disabled={blocked}
      onClick={() => onCrossSheetChipClick(c)}
      className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors ${
        blocked
          ? 'opacity-40 cursor-not-allowed bg-violet-950/20 border-violet-800/40 text-violet-400/80'
          : 'bg-violet-950/40 border-violet-700/50 text-violet-200 hover:bg-violet-900/50 hover:border-violet-600'
      }`}
    >
      {c.name}
    </button>
  );
  if (blocked && hint) {
    return (
      <Tooltip label={hint} placement="top">
        <span className="inline-flex">{btn}</span>
      </Tooltip>
    );
  }
  return <span className="inline-flex">{btn}</span>;
}

/**
 * Experiences list — static chips or interactive Hope-gated buttons.
 *
 * Props:
 *   selectedIndex             — currently selected experience index (interactive mode)
 *   onSelect(i)               — selection callback; when absent, renders static chips
 *   experiencesAsBadges     — when true, experiences are non-clickable badges (selection moves to intent panel); modifiers can still be interactive
 *   hope / maxHope            — current Hope values for gating
 *   crossSheetChips           — optional V2 engine chips from `showOnOtherSheets` features (own or other PCs), rendered in Modifiers (host builds via `collectChipsForOtherCharacterSheets`)
 *   onCrossSheetChipClick     — when set, cross-sheet chips render as buttons (GM / V2 integration)
 */
export function CharacterExperiences({ el, selectedIndex, onSelect, experiencesAsBadges = false, hope, maxHope, rollModifiers, selectedRollModIndex, onSelectRollMod, selectedModId, onSelectMod, onUseMod, onUseMode, modifierEligibility, beastformAdvantages, selectedBeastformAdvantage, onSelectBeastformAdvantage, crossSheetChips, onCrossSheetChipClick }) {
  const experiences = el.experiences || [];
  const hasRollMods = rollModifiers?.length > 0;
  const activeModifiers = el.activeModifiers || [];
  const hasBeastformAdvantages = beastformAdvantages?.length > 0;
  const hasCrossSheet = (crossSheetChips?.length ?? 0) > 0;
  const hasModifiers = hasRollMods || activeModifiers.length > 0 || hasBeastformAdvantages || hasCrossSheet;
  if (!experiences.length && !hasModifiers) return null;

  const experienceButtons = onSelect && !experiencesAsBadges;
  const hasInteractiveModifiers = !!(onSelectRollMod || onSelectMod || onSelectBeastformAdvantage || onCrossSheetChipClick
    || (hasRollMods && rollModifiers.some(rm => !rm.autoApply)));

  if (!experienceButtons && !hasInteractiveModifiers) {
    return (
      <>
        {experiences.length > 0 && (
          <Section label="Experiences">
            <div className="flex flex-wrap gap-1">
              {experiences.map((exp, i) => (
                <span
                  key={i}
                  className="text-[11px] rounded px-1.5 py-0.5 border bg-slate-800 border-slate-700 text-slate-300"
                >
                  {exp.name}
                  {exp.score != null && <span className="font-bold ml-1 text-sky-400">+{exp.score}</span>}
                </span>
              ))}
            </div>
          </Section>
        )}
        {hasModifiers && (
          <Section label="Modifiers">
            <div className="flex flex-wrap gap-1">
              {hasRollMods && rollModifiers.map((rm, i) => (
                <span
                  key={`rm-${i}`}
                  title={rm.autoApply ? `Always applied to ${rm.rollType} rolls` : rm.description}
                  className={`text-[11px] rounded px-1.5 py-0.5 border ${
                    rm.autoApply
                      ? 'bg-teal-950/40 border-teal-700/50 text-teal-300'
                      : 'bg-amber-950/30 border-amber-700/50 text-amber-300'
                  }`}
                >
                  {rm.name}
                  <span className={`font-bold ml-1 ${rm.autoApply ? 'text-teal-400' : 'text-amber-400'}`}>+{rm.score}</span>
                </span>
              ))}
              {activeModifiers.filter(mod => mod.name !== 'Prayer Die').map((mod, i) => (
                <ModifierChip key={mod.id || i} mod={mod} />
              ))}
              {hasBeastformAdvantages && beastformAdvantages.map((adv) => (
                <span
                  key={adv}
                  title="Beastform advantage"
                  className={`text-[11px] rounded px-1.5 py-0.5 border ${
                    selectedBeastformAdvantage === adv
                      ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {adv}
                  {selectedBeastformAdvantage === adv && <span className="ml-1 text-emerald-400">+d6</span>}
                </span>
              ))}
              {hasCrossSheet &&
                crossSheetChips.map((c) => (
                  <CrossSheetChipButton
                    key={c._chipKey || `${c._featureName}::${c.name}`}
                    c={c}
                    onCrossSheetChipClick={onCrossSheetChipClick}
                  />
                ))}
            </div>
          </Section>
        )}
      </>
    );
  }

  if (!experienceButtons && hasInteractiveModifiers) {
    return (
      <>
        {experiences.length > 0 && (
          <Section label="Experiences">
            <div className="flex flex-wrap gap-1">
              {experiences.map((exp, i) => (
                <span
                  key={i}
                  className="text-[11px] rounded px-1.5 py-0.5 border bg-slate-800 border-slate-700 text-slate-300"
                >
                  {exp.name}
                  {exp.score != null && <span className="font-bold ml-1 text-sky-400">+{exp.score}</span>}
                </span>
              ))}
            </div>
          </Section>
        )}
        {hasModifiers && (
          <Section label="Modifiers">
            <div className="flex flex-wrap gap-1">
              {hasRollMods && rollModifiers.map((rm, i) => {
                if (rm.autoApply) {
                  return (
                    <span
                      key={`rm-${i}`}
                      title={`Always applied to ${rm.rollType} rolls`}
                      className="text-[11px] rounded px-1.5 py-0.5 border bg-teal-950/40 border-teal-700/50 text-teal-300"
                    >
                      {rm.name}
                      <span className="font-bold ml-1 text-teal-400">+{rm.score}</span>
                    </span>
                  );
                }
                if (!onSelectRollMod) return null;
                const selected = selectedRollModIndex === i;
                return (
                  <button
                    key={`rm-${i}`}
                    type="button"
                    title={rm.description}
                    onClick={() => onSelectRollMod(selected ? null : i)}
                    className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors cursor-pointer
                      ${selected
                        ? 'bg-amber-900/60 border-amber-600 text-amber-200 ring-1 ring-amber-500/50'
                        : 'bg-amber-950/30 border-amber-700/50 text-amber-300 hover:bg-amber-900/40 hover:border-amber-600'}`}
                  >
                    <span>{rm.name}</span>
                    <span className="font-bold ml-1 text-amber-400">+{rm.score}</span>
                  </button>
                );
              })}
              {activeModifiers.filter(mod => mod.name !== 'Prayer Die').map((mod, i) => (
                <ModifierChip
                  key={mod.id || i}
                  mod={mod}
                  selected={selectedModId === mod.id}
                  onSelect={onSelectMod ? () => onSelectMod(selectedModId === mod.id ? null : mod.id) : undefined}
                  onUse={onUseMod && mod.mode === 'clearStress' ? () => onUseMod(mod) : undefined}
                  onUseMode={onUseMode && mod.usageModes?.length ? (mode) => onUseMode(mod, mode) : undefined}
                  onRemove={onSelectMod ? () => onSelectMod(null) : undefined}
                  eligible={modifierEligibility ? (modifierEligibility[mod.id] ?? true) : true}
                />
              ))}
              {hasBeastformAdvantages && beastformAdvantages.map((adv) => {
                const isSelected = selectedBeastformAdvantage === adv;
                return (
                  <button
                    key={adv}
                    type="button"
                    title={isSelected ? 'Advantage active — +d6 to next beastform attack' : 'Click to activate this beastform advantage'}
                    onClick={onSelectBeastformAdvantage ? () => onSelectBeastformAdvantage(isSelected ? null : adv) : undefined}
                    className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-800/70 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/50'
                        : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-600'
                    }`}
                  >
                    {adv}{isSelected && <span className="ml-1 text-emerald-300">+d6</span>}
                  </button>
                );
              })}
              {hasCrossSheet &&
                crossSheetChips.map((c) => (
                  <CrossSheetChipButton
                    key={c._chipKey || `${c._featureName}::${c.name}`}
                    c={c}
                    onCrossSheetChipClick={onCrossSheetChipClick}
                  />
                ))}
            </div>
          </Section>
        )}
      </>
    );
  }

  const currentHope = hope ?? (maxHope ?? 6);
  return (
    <>
      {experiences.length > 0 && (
        <Section label="EXPERIENCES (Spend a Hope to add to an action roll)" labelUppercase={false}>
          <div className="flex flex-wrap gap-1">
            {experiences.map((exp, i) => {
              const selected = selectedIndex === i;
              const noHope = currentHope === 0;
              const disabled = noHope && !selected;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(selected ? null : i)}
                  className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors
                    ${disabled
                      ? 'opacity-35 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500'
                      : selected
                        ? 'bg-sky-900/60 border-sky-600 text-sky-200 ring-1 ring-sky-500/50 cursor-pointer'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/60 hover:border-slate-600 cursor-pointer'}`}
                >
                  <span>{exp.name}</span>
                  {exp.score != null && (
                    <span className={`font-bold ml-1 ${disabled ? 'text-slate-500' : 'text-sky-400'}`}>+{exp.score}</span>
                  )}
                </button>
              );
            })}
          </div>
          {currentHope === 0 && (
            <p className="text-[9px] text-red-500/70 mt-0.5">No Hope — cannot use Experiences</p>
          )}
        </Section>
      )}
      {hasModifiers && (
        <Section label="Modifiers">
          <div className="flex flex-wrap gap-1">
            {hasRollMods && rollModifiers.map((rm, i) => {
              if (rm.autoApply) {
                return (
                  <span
                    key={`rm-${i}`}
                    title={`Always applied to ${rm.rollType} rolls`}
                    className="text-[11px] rounded px-1.5 py-0.5 border bg-teal-950/40 border-teal-700/50 text-teal-300"
                  >
                    {rm.name}
                    <span className="font-bold ml-1 text-teal-400">+{rm.score}</span>
                  </span>
                );
              }
              if (!onSelectRollMod) return null;
              const selected = selectedRollModIndex === i;
              return (
                <button
                  key={`rm-${i}`}
                  type="button"
                  title={rm.description}
                  onClick={() => onSelectRollMod(selected ? null : i)}
                  className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors cursor-pointer
                    ${selected
                      ? 'bg-amber-900/60 border-amber-600 text-amber-200 ring-1 ring-amber-500/50'
                      : 'bg-amber-950/30 border-amber-700/50 text-amber-300 hover:bg-amber-900/40 hover:border-amber-600'}`}
                >
                  <span>{rm.name}</span>
                  <span className="font-bold ml-1 text-amber-400">+{rm.score}</span>
                </button>
              );
            })}
            {activeModifiers.filter(mod => mod.name !== 'Prayer Die').map((mod, i) => (
              <ModifierChip
                key={mod.id || i}
                mod={mod}
                selected={selectedModId === mod.id}
                onSelect={onSelectMod ? () => onSelectMod(selectedModId === mod.id ? null : mod.id) : undefined}
                onUse={onUseMod && mod.mode === 'clearStress' ? () => onUseMod(mod) : undefined}
                onUseMode={onUseMode && mod.usageModes?.length ? (mode) => onUseMode(mod, mode) : undefined}
                onRemove={onSelectMod ? () => onSelectMod(null) : undefined}
                eligible={modifierEligibility ? (modifierEligibility[mod.id] ?? true) : true}
              />
            ))}
            {hasBeastformAdvantages && beastformAdvantages.map((adv) => {
              const isSelected = selectedBeastformAdvantage === adv;
              return (
                <button
                  key={adv}
                  type="button"
                  title={isSelected ? 'Advantage active — +d6 to next beastform attack' : 'Click to activate this beastform advantage'}
                  onClick={onSelectBeastformAdvantage ? () => onSelectBeastformAdvantage(isSelected ? null : adv) : undefined}
                  className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-800/70 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/50'
                      : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-600'
                  }`}
                >
                  {adv}{isSelected && <span className="ml-1 text-emerald-300">+d6</span>}
                </button>
              );
            })}
            {hasCrossSheet &&
              crossSheetChips.map((c) => (
                <CrossSheetChipButton
                  key={c._chipKey || `${c._featureName}::${c.name}`}
                  c={c}
                  onCrossSheetChipClick={onCrossSheetChipClick}
                />
              ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ─── Modifier chip ─────────────────────────────────────────────────────────────

/**
 * Modifier chip — renders a single active modifier from the character's modifier bin.
 *
 * Props:
 *   mod         — modifier object { id, name, dice?, value?, bonus?, mode, usageModes?, type, refreshOn }
 *   selected    — whether the chip is selected for inclusion in the next roll
 *   onSelect    — toggle selection
 *   onUse       — called for clearStress mode chips
 *   onUseMode   — (mode) called when a usageModes button is clicked
 *   onRemove    — deselect / remove hover
 *   eligible    — whether the chip is eligible (e.g. Sneak Attack auto-detect); defaults true
 *   tooltip     — optional override for title (e.g. advantage condition text)
 */
function ModifierChip({ mod, selected, onSelect, onUse, onUseMode, onRemove, eligible = true, tooltip }) {
  const isRollMod = mod.mode === 'roll' || (mod.bonus != null && !mod.mode);
  const isClearStress = mod.mode === 'clearStress';
  const isPersistent = mod.type === 'persistent';
  const hasUsageModes = Array.isArray(mod.usageModes) && mod.usageModes.length >= 1;

  const baseLabel = mod.name + (mod.dice ? ` (${mod.dice})` : mod.value != null ? ` (${mod.value})` : mod.bonus != null ? ` +${mod.bonus}` : '');

  let colorCls;
  if (mod.name === 'Prayer Die') colorCls = selected ? 'bg-teal-800/70 border-teal-500 text-teal-100 ring-1 ring-teal-500/50' : 'bg-teal-950/40 border-teal-700/60 text-teal-300 hover:bg-teal-900/40';
  else if (mod.name === 'Sneak Attack') colorCls = selected ? 'bg-red-800/70 border-red-500 text-red-100 ring-1 ring-red-500/50' : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/40';
  else if (mod.name === 'No Mercy') colorCls = selected ? 'bg-amber-800/70 border-amber-500 text-amber-100 ring-1 ring-amber-500/50' : 'bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/40';
  else if (mod.name === "Rogue's Dodge") colorCls = selected ? 'bg-cyan-800/70 border-cyan-500 text-cyan-100 ring-1 ring-cyan-500/50' : 'bg-cyan-950/40 border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/40';
  else if (mod.name === 'Evolution') colorCls = selected ? 'bg-violet-800/70 border-violet-500 text-violet-100 ring-1 ring-violet-500/50' : 'bg-violet-950/40 border-violet-700/60 text-violet-300 hover:bg-violet-900/40';
  else if (mod.name === 'Dread Visage') colorCls = selected ? 'bg-red-800/70 border-red-500 text-red-100 ring-1 ring-red-500/50' : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/40';
  else colorCls = selected ? 'bg-sky-800/70 border-sky-500 text-sky-100 ring-1 ring-sky-500/50' : 'bg-sky-950/40 border-sky-700/60 text-sky-300 hover:bg-sky-900/40';

  const ineligibleCls = !eligible ? 'opacity-40 cursor-not-allowed' : '';
  const clickable = !!(onSelect || onUse) && eligible;

  if (hasUsageModes && onUseMode) {
    const modeLabels = { roll: 'Roll', gainHope: '+Hope', reduceDamage: '-Dmg' };
    return (
      <div className={`flex items-center rounded border text-[11px] overflow-hidden ${colorCls.split(' ').filter(c => c.startsWith('border') || c.startsWith('bg')).join(' ')} ${ineligibleCls}`}>
        <span className="px-1.5 py-0.5 shrink-0">{baseLabel}</span>
        {mod.usageModes.filter(m => m !== 'roll').map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => onUseMode(mode)}
            className="px-1.5 py-0.5 border-l border-current/30 text-[9px] font-semibold hover:bg-white/10 transition-colors"
            title={`Use as: ${modeLabels[mode] ?? mode}`}
          >
            {modeLabels[mode] ?? mode}
          </button>
        ))}
        {onSelect && mod.name !== 'Prayer Die' && (
          <button
            type="button"
            onClick={() => onSelect()}
            className="px-1.5 py-0.5 border-l border-current/30 text-[9px] hover:bg-white/10 transition-colors"
            title="Include in next roll"
          >Roll</button>
        )}
      </div>
    );
  }

  const defaultTitle = !eligible ? `${mod.name} — not eligible right now` : isPersistent ? `${mod.name} (active until ${mod.refreshOn === 'session' ? 'session end' : mod.refreshOn === 'longRest' ? 'long rest' : 'rest'})` : `${mod.name} — click to ${isRollMod ? 'include in next roll' : isClearStress ? 'roll to clear Stress' : 'use'}`;
  const title = tooltip != null && tooltip !== '' ? tooltip : defaultTitle;

  return (
    <button
      type="button"
      title={title}
      onClick={clickable ? (onUse || onSelect) : undefined}
      className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors flex items-center gap-1 ${clickable ? 'cursor-pointer' : 'cursor-default'} ${colorCls} ${ineligibleCls}`}
    >
      <span>{baseLabel}</span>
      {isClearStress && <span className="text-[9px] opacity-70">→ clr Stress</span>}
      {isPersistent && <span className="text-[9px] opacity-60">●</span>}
    </button>
  );
}

/**
 * Weapon list — display-only or interactive.
 *
 * Props:
 *   onWeaponClick(weapon, rollMeta)  — when provided, weapon cards become clickable
 *   devastatingActive                — boolean controlled by HoverCard
 *   onDevastatingToggle              — () => void controlled by HoverCard
 *   stressMaxed                      — boolean; defaults to derived from el
 *   onActionNotification(data)       — for Startling action card
 */
export function CharacterWeaponList({
  el,
  onWeaponClick,
  devastatingActive,
  onDevastatingToggle,
  stressMaxed: stressMaxedProp,
  onActionNotification,
  onBeastformAttack,
  /** When set (Game Table), weapons with a map range are disabled if no adversaries are in range. */
  getValidTargets,
}) {
  const ancestryFeatures = el.ancestryFeatures || [];
  // Enrich weapons with effectiveRange at render time (Giant Reach: Melee → Very Close).
  // `recomputeCharacter` seeds `effectiveRange` from `range`, so we must not treat that
  // as final — always derive from ancestry via getEffectiveWeaponRange first.
  const weapons = (el.weapons || []).map(w => ({
    ...w,
    effectiveRange:
      getEffectiveWeaponRange(w, ancestryFeatures) || w.effectiveRange || w.range || '',
  }));
  const activeBeastform = el.activeBeastform;

  // Always run detection so disabled weapons can be shown in beastform mode
  const traits = el.traits || {};
  const isStressMaxed = stressMaxedProp !== undefined
    ? stressMaxedProp
    : (el.currentStress ?? 0) >= (el.maxStress ?? 6);

  const pairing = detectPairedWeapons(weapons);
  let virtualWeapon = null;
  if (pairing) {
    const { primaryWeapon, pairedWeapon } = pairing;
    const featText = pairedWeapon.feature?.text || pairedWeapon.feature?.description || WEAPON_TAG_DESCRIPTIONS['Paired'];
    const bonus = parsePairedBonus(featText);
    virtualWeapon = {
      name: 'Paired Weapons',
      damage: applyDamageBonus(primaryWeapon.damage, bonus),
      damageType: primaryWeapon.damageType,
      range: primaryWeapon.effectiveRange || primaryWeapon.range,
      trait: primaryWeapon.trait,
    };
  }

  // Use pre-computed virtual weapons (from recomputeCharacter in builder mode)
  // or compute on-the-fly for Daggerstack-synced characters.
  const ancestryVirtualWeapons = el._virtualWeapons || runCharacterRender(el).virtualWeapons;
  const versatilePairs = detectVersatileWeapons(weapons);
  const otherworldlyPairs = detectOtherworldlyWeapons(weapons);
  const chargedPairs = detectChargedWeapons(weapons);
  const otherworldlyOriginals = new Set(otherworldlyPairs.map(o => o.original));
  const startlingWeapons = weapons.filter(w => w.feature?.name === 'Startling');

  const weaponRenderHints = el.weaponRenderHints;

  const weaponSlotSrdId = (weapon) => {
    if (weapon.id === 'wep_0') return el.primaryWeaponId ?? null;
    if (weapon.id === 'wep_1') return el.secondaryWeaponId ?? null;
    return null;
  };
  const v2HintForWeapon = (weapon) => {
    const id = weaponSlotSrdId(weapon);
    return id && weaponRenderHints && typeof weaponRenderHints === 'object'
      ? weaponRenderHints[id]
      : undefined;
  };

  const outOfRangeReasonForWeapon = (weapon) => {
    const v2Hint = v2HintForWeapon(weapon);
    if (v2Hint?.isDisabled === true) return null;
    if (!v2Hint && weapon.feature?.name === 'Pompous' && (traits.presence ?? 0) > 0) return null;
    if (weapon._charged && isStressMaxed) return null;
    return outOfRangeDisableReason(weapon, getValidTargets, el.instanceId, ancestryFeatures);
  };

  // For Doubled Up: find the secondary weapon's damage string
  const primaryWeapon_ = weapons.find(w => w.isPrimary !== false && !w.feature?.name?.includes('Paired'));
  const secondaryWeapon_ = weapons.find(w => w !== primaryWeapon_);
  const secondaryDamageStr = secondaryWeapon_
    ? `${secondaryWeapon_.damage || ''} ${secondaryWeapon_.damageType || ''}`.trim()
    : null;

  const makeClick = (w, extraMeta = {}) => {
    if (!onWeaponClick) return undefined;
    const v2Hint = v2HintForWeapon(w);
    if (v2Hint?.isDisabled === true) return undefined;
    if (!v2Hint && w.feature?.name === 'Pompous' && (traits.presence ?? 0) > 0) return undefined;
    if (w._charged && isStressMaxed) return undefined;
    const merged = { ...w, ...extraMeta };
    if (outOfRangeReasonForWeapon(merged)) return undefined;
    const rollMeta = { ...extraMeta };
    if (w.feature?.name === 'Devastating' && devastatingActive) rollMeta.devastating = true;
    if (w.feature?.name === 'Doubled Up' && secondaryDamageStr) rollMeta.secondaryDamage = secondaryDamageStr;
    return (e) => onWeaponClick(w, rollMeta, e);
  };

  // ── Beastform mode: show beastform attack then disabled weapons ──────────────
  if (activeBeastform) {
    const beastformRangeWord = (activeBeastform.attack || '').trim().split(/\s+/)[0];
    const beastformFt = beastformRangeWord ? rangeBandNameToFt(beastformRangeWord) : null;
    const beastformNoTargets =
      getValidTargets &&
      beastformFt != null &&
      el.instanceId &&
      (getValidTargets(el.instanceId, { weaponRangeFt: beastformFt }) ?? []).length === 0;
    const beastformDisabledReason = beastformNoTargets ? 'No targets in range' : null;
    const beastformClickable = onBeastformAttack && !beastformDisabledReason;

    const beastformCard = (
      <div
        role={beastformClickable ? 'button' : undefined}
        tabIndex={beastformClickable ? 0 : undefined}
        onClick={beastformClickable ? onBeastformAttack : undefined}
        onKeyDown={beastformClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onBeastformAttack(); } : undefined}
        className={`w-full min-w-0 rounded border px-2 py-1.5 text-[11px] transition-all ${
          beastformClickable
            ? 'border-emerald-700/60 bg-emerald-950/30 cursor-pointer hover:brightness-125 hover:border-emerald-500/70'
            : 'border-emerald-700/40 bg-emerald-950/20 opacity-60'
        }`}
      >
        <div className="flex items-center gap-2">
          <Swords size={10} className="text-emerald-500/70 shrink-0" />
          <span className="font-semibold text-emerald-200 flex-1">{activeBeastform.name}</span>
          <span className="text-[9px] text-emerald-400/70">{activeBeastform.attack}</span>
        </div>
        {beastformDisabledReason && (
          <div className="text-[9px] mt-1 text-amber-400 flex items-center gap-1">
            <AlertCircle size={9} className="shrink-0" />
            {beastformDisabledReason}
          </div>
        )}
      </div>
    );

    return (
      <Section label={onBeastformAttack ? 'Attacks — click to roll' : 'Attacks'}>
        <div className="space-y-1.5">
          {/* Beastform attack card */}
          {beastformDisabledReason ? (
            <Tooltip label={beastformDisabledReason} className="relative block w-full min-w-0">
              {beastformCard}
            </Tooltip>
          ) : (
            beastformCard
          )}

          {/* Disabled normal weapons */}
          {weapons.length > 0 && (
            <div className="opacity-35 pointer-events-none select-none space-y-1">
              <div className="text-[9px] text-slate-600 uppercase tracking-wide pl-0.5">Normal attacks (disabled)</div>
              {weapons.filter(w => !otherworldlyOriginals.has(w)).map((w, i) => (
                <WeaponCard
                  key={i}
                  weapon={w}
                  traitScore={traits[(w.trait || '').toLowerCase()] ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </Section>
    );
  }

  if (!weapons.length && !ancestryVirtualWeapons.length) return null;

  return (
    <Section label={onWeaponClick ? 'Weapons — click to roll' : 'Weapons'}>
      <div className="space-y-1">
        {/* Paired virtual weapon */}
        {virtualWeapon && (
          <WeaponCard
            weapon={virtualWeapon}
            traitScore={traits[(virtualWeapon.trait || '').toLowerCase()] ?? 0}
            onClick={makeClick(virtualWeapon)}
            isVirtual
            outOfRangeReason={outOfRangeReasonForWeapon(virtualWeapon)}
          />
        )}

        {/* Ancestry virtual weapons (Retracting Claws, Kick, etc.) */}
        {ancestryVirtualWeapons.map((vw, i) => {
          const vwWeapon = { ...vw, effectiveRange: vw.effectiveRange || vw.range || '' };
          return (
            <WeaponCard
              key={`ancestry-vw-${i}`}
              weapon={vwWeapon}
              traitScore={traits[(vw.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(vw)}
              isVirtual
              outOfRangeReason={outOfRangeReasonForWeapon(vwWeapon)}
            />
          );
        })}

        {/* Versatile alternate cards */}
        {versatilePairs.map(({ alternate }, i) => {
          const altW = { ...alternate, effectiveRange: getEffectiveWeaponRange(alternate, el.ancestryFeatures) };
          return (
            <WeaponCard
              key={`versatile-${i}`}
              weapon={altW}
              traitScore={traits[(alternate.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(alternate)}
              isVirtual
              outOfRangeReason={outOfRangeReasonForWeapon(altW)}
            />
          );
        })}

        {/* Otherworldly Physical + Magical variant pairs */}
        {otherworldlyPairs.map(({ physicalVariant, magicalVariant }, i) => {
          const phyW = { ...physicalVariant, effectiveRange: getEffectiveWeaponRange(physicalVariant, el.ancestryFeatures) };
          const magW = { ...magicalVariant, effectiveRange: getEffectiveWeaponRange(magicalVariant, el.ancestryFeatures) };
          return (
            <div key={`otherworldly-${i}`} className="space-y-1">
              <WeaponCard
                weapon={phyW}
                traitScore={traits[(physicalVariant.trait || '').toLowerCase()] ?? 0}
                onClick={makeClick(physicalVariant)}
                isVirtual
                outOfRangeReason={outOfRangeReasonForWeapon(phyW)}
              />
              <WeaponCard
                weapon={magW}
                traitScore={traits[(magicalVariant.trait || '').toLowerCase()] ?? 0}
                onClick={makeClick(magicalVariant)}
                purple
                outOfRangeReason={outOfRangeReasonForWeapon(magW)}
              />
            </div>
          );
        })}

        {/* Charged variant cards */}
        {chargedPairs.map(({ chargedVariant }, i) => {
          const chW = { ...chargedVariant, effectiveRange: getEffectiveWeaponRange(chargedVariant, el.ancestryFeatures) };
          return (
          <div key={`charged-${i}`}>
            <WeaponCard
              weapon={chW}
              traitScore={traits[(chargedVariant.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(chargedVariant, { _attackerInstanceId: el.instanceId })}
              isVirtual
              outOfRangeReason={outOfRangeReasonForWeapon(chW)}
            />
            {isStressMaxed && (
              <div className="text-[9px] text-slate-500 pl-5 mt-0.5">Stress maxed — cannot use Charged</div>
            )}
          </div>
          );
        })}

        {/* Normal weapon cards (skip Otherworldly originals) */}
        {weapons.filter(w => !otherworldlyOriginals.has(w)).map((w, i) => {
          const v2Hint = v2HintForWeapon(w);
          const legacyPompous =
            !v2Hint && w.feature?.name === 'Pompous' && (traits.presence ?? 0) > 0;
          const v2DisableReason =
            v2Hint?.isDisabled === true ? (v2Hint.disabledReason || 'Cannot use this weapon') : undefined;
          return (
            <WeaponCard
              key={w.name ? `${w.name}-${i}` : i}
              weapon={w}
              traitScore={traits[(w.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(w)}
              devastating={w.feature?.name === 'Devastating' ? devastatingActive : undefined}
              onDevastatingToggle={w.feature?.name === 'Devastating' && onWeaponClick ? onDevastatingToggle : undefined}
              pompousWarning={legacyPompous}
              v2DisableReason={v2DisableReason}
              outOfRangeReason={outOfRangeReasonForWeapon(w)}
            />
          );
        })}

        {/* Startling action cards */}
        {startlingWeapons.map((w, i) => {
          const disabled = isStressMaxed;
          return (
            <div
              key={`startling-${i}`}
              role={onActionNotification && !disabled ? 'button' : undefined}
              tabIndex={onActionNotification && !disabled ? 0 : undefined}
              onClick={onActionNotification && !disabled ? () => onActionNotification({
                _action: true,
                rollUser: el.name,
                actionName: 'Startling: Force Back',
                actionText: 'Forced all adversaries in Melee range back to Close range',
                _attackerInstanceId: el.instanceId,
                tags: [{ name: 'Startling', text: 'Mark 1 Stress on attacker' }],
              }) : undefined}
              onKeyDown={onActionNotification && !disabled ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') onActionNotification({
                  _action: true,
                  rollUser: el.name,
                  actionName: 'Startling: Force Back',
                  actionText: 'Forced all adversaries in Melee range back to Close range',
                  _attackerInstanceId: el.instanceId,
                  tags: [{ name: 'Startling', text: 'Mark 1 Stress on attacker' }],
                });
              } : undefined}
              title={disabled ? 'Stress maxed' : onActionNotification ? 'Mark 1 Stress to force adversaries back' : undefined}
              className={`rounded border px-2 py-1.5 text-[11px] select-none transition-all
                ${disabled
                  ? 'border-slate-700/50 bg-slate-800/30 opacity-40 cursor-not-allowed'
                  : onActionNotification
                    ? 'border-amber-700/50 bg-amber-950/20 cursor-pointer hover:brightness-125 hover:border-amber-500/70 group'
                    : 'border-amber-700/30 bg-amber-950/10'
                }`}
            >
              <div className="flex items-center gap-2">
                <Swords size={10} className="text-amber-500/60 shrink-0" />
                <span className="font-semibold text-amber-200/80">Startling: Force Back</span>
                <FeatureResourceCostIcons action={{ stressCost: 1 }} iconSize={9} className="ml-0.5" />
              </div>
              <div className="text-[10px] mt-0.5 pl-5 text-amber-400/60">
                Mark a Stress to force all adversaries in Melee back to Close range
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * Feature list — guide-driven cards shared with Game Table hover + Library preview.
 *
 * @param {'interactive'|'preview'} [interactionMode] — defaults from presence of handlers
 */
function CharacterFeatureActionsRow({
  entry,
  el,
  v2TableContext,
  interactionMode,
  onV2CardChip,
  onShareFeature,
  activeChanneledElement,
  pendingBanners,
}) {
  const { model, table: tableForChips } = useMemo(
    () => buildFeatureCardModelForCharacter(entry.row, el, v2TableContext),
    [entry.row, el, v2TableContext],
  );
  if (!model.cardChips?.length) return null;
  const stressMaxed =
    entry.row.name === 'Elemental Incarnation'
      ? (el.currentStress ?? 0) >= (el.maxStress ?? 6)
      : undefined;
  const channel = entry.row.name === 'Elemental Incarnation' ? activeChanneledElement : undefined;

  return (
    <GuideFeatureCardChips
      model={model}
      tableForChips={tableForChips}
      featRow={entry.row}
      el={el}
      featureKey={entry.key}
      v2TableContext={v2TableContext}
      interactionMode={interactionMode}
      onV2CardChip={onV2CardChip}
      onShareFeature={onShareFeature}
      activeChanneledElement={channel}
      stressMaxed={stressMaxed}
      actionsStripLayout
      pendingBanners={pendingBanners}
    />
  );
}

/** @returns {boolean} whether any guide feature exposes V2 card chips (Actions tab). */
export function characterHasFeatureCardActions(el, onV2CardChip, v2TableContext) {
  const orderedEntries = getOrderedGuideFeatureEntries(el, onV2CardChip);
  for (const e of orderedEntries) {
    if (e.kind !== 'guide') continue;
    const { model } = buildFeatureCardModelForCharacter(e.row, el, v2TableContext);
    if (model.cardChips?.length) return true;
  }
  return false;
}

function CharacterFeatureActionsBody({
  el,
  onV2CardChip,
  onShareFeature,
  v2TableContext,
  interactionMode,
  activeChanneledElement,
  pendingBanners,
}) {
  const orderedEntries = useMemo(() => getOrderedGuideFeatureEntries(el, onV2CardChip), [el, onV2CardChip]);
  const mode = interactionMode ?? (onV2CardChip || onShareFeature ? 'interactive' : 'preview');

  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-center content-start">
      {orderedEntries
        .filter((e) => e.kind === 'guide')
        .map((entry) => (
          <CharacterFeatureActionsRow
            key={entry.key}
            entry={entry}
            el={el}
            v2TableContext={v2TableContext}
            interactionMode={mode}
            onV2CardChip={onV2CardChip}
            onShareFeature={onShareFeature}
            activeChanneledElement={activeChanneledElement}
            pendingBanners={pendingBanners}
          />
        ))}
    </div>
  );
}

/**
 * Sheet-level strip of V2 card chips only (standalone “Actions” section — prefer `CharacterFeaturesPanel`).
 */
export function CharacterFeatureActions({
  el,
  onV2CardChip,
  onShareFeature,
  v2TableContext,
  interactionMode,
  activeChanneledElement,
  pendingBanners,
}) {
  const hasAny = useMemo(
    () => characterHasFeatureCardActions(el, onV2CardChip, v2TableContext),
    [el, onV2CardChip, v2TableContext],
  );
  if (!hasAny) return null;
  const mode = interactionMode ?? (onV2CardChip || onShareFeature ? 'interactive' : 'preview');
  return (
    <Section label="Actions">
      <CharacterFeatureActionsBody
        el={el}
        onV2CardChip={onV2CardChip}
        onShareFeature={onShareFeature}
        v2TableContext={v2TableContext}
        interactionMode={mode}
        activeChanneledElement={activeChanneledElement}
        pendingBanners={pendingBanners}
      />
    </Section>
  );
}

/**
 * Features region with optional Actions / Details tabs (when any feature has V2 card chips).
 */
export function CharacterFeaturesPanel({
  el,
  expandedKeys,
  onToggleFeature,
  onSetFeatureExpandedKeys,
  onUseHopeAbility,
  onFeatureUse,
  featureUsage,
  currentHope,
  updateFn,
  activeChanneledElement,
  prayerDice,
  onPrayerDieGainHope,
  onShareFeature,
  onV2CardChip,
  interactionMode,
  v2TableContext,
  pendingBanners,
}) {
  const orderedEntries = useMemo(() => getOrderedGuideFeatureEntries(el, onV2CardChip), [el, onV2CardChip]);
  const hopeFeature = el.hopeFeature || el.hopeAbility;
  /** Must run every render — do not place after an early return (React #310). */
  const hasActions = useMemo(
    () => characterHasFeatureCardActions(el, onV2CardChip, v2TableContext),
    [el, onV2CardChip, v2TableContext],
  );
  const featuresTabStorageKey = el.instanceId ?? el.id ?? '__sheet';
  const [featuresTab, setFeaturesTab] = useState(() => readFeaturesPanelTab(featuresTabStorageKey));
  useEffect(() => {
    setFeaturesTab(readFeaturesPanelTab(featuresTabStorageKey));
  }, [featuresTabStorageKey]);
  const setFeaturesTabPersist = useCallback(
    (tab) => {
      setFeaturesTab(tab);
      persistFeaturesPanelTab(featuresTabStorageKey, tab);
    },
    [featuresTabStorageKey],
  );
  const willEarlyReturn = !orderedEntries.length && !hopeFeature;
  if (willEarlyReturn) return null;
  const mode = interactionMode ?? (onV2CardChip || onShareFeature ? 'interactive' : 'preview');

  const tabClass = (id) =>
    `text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded transition-colors ${
      featuresTab === id
        ? 'text-sky-200 bg-sky-950/40 border border-sky-700/50'
        : 'text-slate-500 hover:text-slate-300 border border-transparent'
    }`;

  if (!hasActions) {
    return (
      <Section label="Features">
        <CharacterFeatureListContent
          el={el}
          expandedKeys={expandedKeys}
          onToggleFeature={onToggleFeature}
          onSetFeatureExpandedKeys={onSetFeatureExpandedKeys}
          onUseHopeAbility={onUseHopeAbility}
          onFeatureUse={onFeatureUse}
          featureUsage={featureUsage}
          currentHope={currentHope}
          updateFn={updateFn}
          activeChanneledElement={activeChanneledElement}
          prayerDice={prayerDice}
          onPrayerDieGainHope={onPrayerDieGainHope}
          onShareFeature={onShareFeature}
          onV2CardChip={onV2CardChip}
          interactionMode={interactionMode}
          v2TableContext={v2TableContext}
          pendingBanners={pendingBanners}
        />
      </Section>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-[9px] tracking-widest text-slate-500 font-semibold uppercase shrink-0">Features</p>
        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          <button type="button" className={tabClass('actions')} onClick={() => setFeaturesTabPersist('actions')}>
            Actions
          </button>
          <button type="button" className={tabClass('details')} onClick={() => setFeaturesTabPersist('details')}>
            Details
          </button>
        </div>
      </div>
      {featuresTab === 'actions' ? (
        <CharacterFeatureActionsBody
          el={el}
          onV2CardChip={onV2CardChip}
          onShareFeature={onShareFeature}
          v2TableContext={v2TableContext}
          interactionMode={mode}
          activeChanneledElement={activeChanneledElement}
          pendingBanners={pendingBanners}
        />
      ) : (
        <CharacterFeatureListContent
          el={el}
          expandedKeys={expandedKeys}
          onToggleFeature={onToggleFeature}
          onSetFeatureExpandedKeys={onSetFeatureExpandedKeys}
          onUseHopeAbility={onUseHopeAbility}
          onFeatureUse={onFeatureUse}
          featureUsage={featureUsage}
          currentHope={currentHope}
          updateFn={updateFn}
          activeChanneledElement={activeChanneledElement}
          prayerDice={prayerDice}
          onPrayerDieGainHope={onPrayerDieGainHope}
          onShareFeature={onShareFeature}
          onV2CardChip={onV2CardChip}
          interactionMode={interactionMode}
          v2TableContext={v2TableContext}
          pendingBanners={pendingBanners}
        />
      )}
    </div>
  );
}

function CharacterFeatureListContent({
  el,
  expandedKeys,
  onToggleFeature,
  onSetFeatureExpandedKeys,
  onUseHopeAbility,
  onFeatureUse,
  featureUsage,
  currentHope,
  updateFn,
  activeChanneledElement,
  prayerDice,
  onPrayerDieGainHope,
  onShareFeature,
  onV2CardChip,
  interactionMode,
  v2TableContext,
  pendingBanners,
}) {
  const [localExpanded, setLocalExpanded] = useState({});

  const orderedEntries = useMemo(() => getOrderedGuideFeatureEntries(el, onV2CardChip), [el, onV2CardChip]);
  const allCardKeys = useMemo(() => orderedEntries.map((e) => e.key), [orderedEntries]);

  const hopeFeature = el.hopeFeature || el.hopeAbility;

  const hopeAbilityRenderedByV2Guide = (() => {
    if (!onV2CardChip) return false;
    const hn = resolveHopeFeatureName(el);
    if (!hn) return false;
    const row = (el.activeFeatures || []).find((a) => a.name === hn);
    return !!(row && Array.isArray(row.chips) && row.chips.length > 0);
  })();

  const mode =
    interactionMode ??
    (onFeatureUse || onV2CardChip || onUseHopeAbility || onShareFeature ? 'interactive' : 'preview');
  const preview = mode === 'preview';
  const v2Handler = typeof onV2CardChip === 'function' ? onV2CardChip : undefined;

  const isOpen = (key) => {
    if (expandedKeys !== undefined) return expandedKeys.includes(key);
    return localExpanded[key] ?? false;
  };
  const toggle = (key) => {
    if (onToggleFeature) onToggleFeature(key);
    else setLocalExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllFeatures = useCallback(() => {
    if (onSetFeatureExpandedKeys) onSetFeatureExpandedKeys(allCardKeys);
    else
      setLocalExpanded((prev) => {
        const next = { ...prev };
        for (const k of allCardKeys) next[k] = true;
        return next;
      });
  }, [allCardKeys, onSetFeatureExpandedKeys]);

  const collapseAllFeatures = useCallback(() => {
    if (onSetFeatureExpandedKeys) onSetFeatureExpandedKeys([]);
    else
      setLocalExpanded((prev) => {
        const next = { ...prev };
        for (const k of allCardKeys) next[k] = false;
        return next;
      });
  }, [allCardKeys, onSetFeatureExpandedKeys]);

  const resolveHopeFeature = () => {
    let name;
    let desc;
    if (typeof hopeFeature === 'object') {
      name = hopeFeature.name || el.hopeAbilityName;
      desc = hopeFeature.description || hopeFeature.text || '';
    } else {
      const str = String(hopeFeature);
      const colonIdx = str.indexOf(': ');
      if (colonIdx > 0) {
        name = str.slice(0, colonIdx);
        desc = str.slice(colonIdx + 2);
      } else {
        name = el.hopeAbilityName || null;
        desc = str;
      }
    }
    return { name, desc };
  };

  return (
    <div className="space-y-2">
        {hopeFeature && !hopeAbilityRenderedByV2Guide && (() => {
          const { name, desc } = resolveHopeFeature();
          const hope = currentHope ?? (el.hope ?? (el.maxHope ?? 6));
          const canUse = hope >= 3;
          const hopeInteractive = !preview && !!onUseHopeAbility;

          if (hopeInteractive) {
            const hopeFeat = { name: name || 'Hope Ability', description: desc || '' };
            const handleClick = onFeatureUse
              ? (e) => canUse && onFeatureUse(hopeFeat, null, e)
              : () => canUse && onUseHopeAbility(el.instanceId);
            return (
              <button
                key="hope-ability"
                onClick={handleClick}
                disabled={!canUse}
                title={canUse ? 'Spend 3 Hope to use' : 'Not enough Hope (need 3)'}
                className={`w-full rounded border text-left px-2 py-1.5 transition-colors ${
                  canUse
                    ? 'border-amber-700/60 bg-amber-950/40 hover:bg-amber-900/50 hover:border-amber-600/70 cursor-pointer'
                    : 'border-slate-700/40 bg-slate-800/30 opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  {name && <span className="text-[11px] font-semibold text-amber-200 leading-tight">{name}</span>}
                  <FeatureResourceCostIcons action={{ hopeCost: 3 }} iconSize={10} className="ml-0.5" />
                </div>
                {desc && <MarkdownText text={desc} className="text-[11px] text-slate-300 leading-relaxed dh-md" />}
              </button>
            );
          }

          return (
            <div className="rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1.5">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                {name && <span className="text-[11px] font-semibold text-amber-200">{name}</span>}
                <FeatureResourceCostIcons action={{ hopeCost: 3 }} iconSize={10} className="ml-0.5" />
              </div>
              {desc && <MarkdownText text={desc} className="text-[11px] text-slate-300 leading-relaxed dh-md" />}
            </div>
          );
        })()}
        {allCardKeys.length > 0 && (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={expandAllFeatures}
              className="text-[10px] font-medium text-sky-400/90 hover:text-sky-300 hover:underline"
            >
              Expand all
            </button>
            <span className="text-[10px] text-slate-600 select-none" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={collapseAllFeatures}
              className="text-[10px] font-medium text-sky-400/90 hover:text-sky-300 hover:underline"
            >
              Collapse all
            </button>
          </div>
        )}
        {orderedEntries.map((entry) => {
          const { row } = entry;

          const v2Active = !!v2Handler;
          const rangerFocusToggle =
            !v2Active && row.name === "Ranger's Focus" && el.class === 'Ranger' && updateFn
              ? {
                  value: !!el.rangerFocusOnNextAttack,
                  onChange: (v) => updateFn(el.instanceId, { rangerFocusOnNextAttack: v }),
                }
              : undefined;
          const faerieWingsProps =
            !v2Active &&
            row.name === 'Wings' &&
            (row.source === 'Faerie' || el.ancestry === 'Faerie' || (el.ancestry || []).includes('Faerie')) &&
            updateFn
              ? {
                  flying: !!el.faerieWingsFlying,
                  onFlyingChange: (v) => updateFn(el.instanceId, { faerieWingsFlying: v }),
                }
              : undefined;
          const prayerDiceProps =
            row.name === 'Prayer Dice' && prayerDice?.length > 0
              ? { dice: prayerDice, onGainHope: preview ? undefined : onPrayerDieGainHope }
              : undefined;

          return (
            <GuideFeatureCard
              key={entry.key}
              featRow={row}
              featureKey={entry.key}
              el={el}
              open={isOpen(entry.key)}
              onToggle={() => toggle(entry.key)}
              interactionMode={mode}
              onFeatureUse={preview ? undefined : onFeatureUse}
              onV2CardChip={v2Handler}
              onShareFeature={preview ? undefined : onShareFeature}
              activeChanneledElement={
                row.name === 'Elemental Incarnation' ? (activeChanneledElement ?? null) : undefined
              }
              stressMaxed={
                row.name === 'Elemental Incarnation'
                  ? (el.currentStress ?? 0) >= (el.maxStress ?? 6)
                  : undefined
              }
              prayerDiceProps={prayerDiceProps}
              rangerFocusToggle={rangerFocusToggle}
              faerieWingsProps={faerieWingsProps}
              v2TableContext={v2TableContext}
              pendingBanners={pendingBanners}
            />
          );
        })}
    </div>
  );
}

export function CharacterFeatureList({
  el,
  expandedKeys,
  onToggleFeature,
  onSetFeatureExpandedKeys,
  onUseHopeAbility,
  onFeatureUse,
  featureUsage,
  currentHope,
  updateFn,
  activeChanneledElement,
  prayerDice,
  onPrayerDieGainHope,
  onShareFeature,
  onV2CardChip,
  interactionMode,
  v2TableContext,
  pendingBanners,
}) {
  const orderedEntries = useMemo(() => getOrderedGuideFeatureEntries(el, onV2CardChip), [el, onV2CardChip]);
  const hopeFeature = el.hopeFeature || el.hopeAbility;
  if (!orderedEntries.length && !hopeFeature) return null;
  return (
    <Section label="Features">
      <CharacterFeatureListContent
        el={el}
        expandedKeys={expandedKeys}
        onToggleFeature={onToggleFeature}
        onSetFeatureExpandedKeys={onSetFeatureExpandedKeys}
        onUseHopeAbility={onUseHopeAbility}
        onFeatureUse={onFeatureUse}
        featureUsage={featureUsage}
        currentHope={currentHope}
        updateFn={updateFn}
        activeChanneledElement={activeChanneledElement}
        prayerDice={prayerDice}
        onPrayerDieGainHope={onPrayerDieGainHope}
        onShareFeature={onShareFeature}
        onV2CardChip={onV2CardChip}
        interactionMode={interactionMode}
        v2TableContext={v2TableContext}
        pendingBanners={pendingBanners}
      />
    </Section>
  );
}

/**
 * Domain cards — guide-driven (same card component as Features).
 */
export function CharacterAbilityList({
  el,
  expandedKeys,
  onToggleFeature,
  onFeatureUse,
  featureUsage,
  onV2DomainChip,
  v2TableContext,
}) {
  const [localExpanded, setLocalExpanded] = useState({});
  const abilities = el.abilities || [];
  if (!abilities.length) return null;
  const inBeastform = !!el.activeBeastform;

  const isOpen = (key) => {
    if (expandedKeys !== undefined) return expandedKeys.includes(key);
    return localExpanded[key] ?? false;
  };
  const toggle = (key) => {
    if (onToggleFeature) onToggleFeature(key);
    else setLocalExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const mode = onV2DomainChip || onFeatureUse ? 'interactive' : 'preview';

  return (
    <Section label="Domain Cards">
      {inBeastform && (
        <div className="flex items-center gap-1 text-[10px] text-amber-500/80 bg-amber-950/30 border border-amber-700/40 rounded px-2 py-1 mb-1">
          <X size={9} className="shrink-0" />
          <span>Domain cards disabled while in Beastform</span>
        </div>
      )}
      <div className={`space-y-2 ${inBeastform ? 'opacity-30 pointer-events-none select-none' : ''}`}>
        {abilities.map((a, i) => {
          const key = `ability-${a.id ?? i}`;
          const featRow =
            el.activeFeatures?.find((f) => f.type === 'ability' && f.name === a.name) || {
              name: a.name,
              description: a.description || '',
              type: 'ability',
              sourceType: 'domain',
              source: [a.domain, a.type, `Lvl ${a.level}`].filter(Boolean).join(' · '),
            };
          return (
            <div
              key={a.id || key}
              className="rounded-lg overflow-hidden bg-violet-950/25 border-t border-violet-400/35"
            >
              <GuideFeatureCard
                featRow={featRow}
                featureKey={key}
                el={el}
                open={isOpen(key)}
                onToggle={() => toggle(key)}
                interactionMode={mode}
                onFeatureUse={onFeatureUse}
                featureUsage={featureUsage}
                onV2CardChip={onV2DomainChip}
                v2TableContext={v2TableContext}
                tone="domain"
              />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function CharacterInventory({ el }) {
  const inventory = el.inventory || [];
  if (!inventory.length && el.gold == null) return null;
  return (
    <Section label="Inventory">
      {el.gold != null && (
        <div className="flex items-center gap-1 text-[11px] mb-1">
          <Package size={10} className="text-yellow-500 shrink-0" />
          <span className="text-slate-400">Gold:</span>
          <span className="text-yellow-300 font-semibold">{el.gold}</span>
          <span className="text-slate-500">({formatGold(el.gold)})</span>
        </div>
      )}
      {inventory.length > 0 && (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {inventory.map((item, i) => (
            <span key={i}>
              {item.quantity > 1 && <span className="text-slate-300 font-semibold">{item.quantity}× </span>}
              <span className="text-slate-300">{item.name}</span>
              {i < inventory.length - 1 && <span className="text-slate-600">, </span>}
            </span>
          ))}
        </p>
      )}
    </Section>
  );
}

export function CharacterCompanion({ el }) {
  if (!el.companion) return null;
  return (
    <Section label="Companion">
      <div className="text-[11px] text-slate-300 space-y-0.5">
        <div className="font-semibold">{el.companion.name}</div>
        {el.companion.species && <div className="text-slate-500">{el.companion.species}</div>}
        <div className="flex gap-2 text-slate-400">
          <span>EVA {el.companion.evasion}</span>
          <span>Stress {el.companion.currentStress}/{el.companion.maxStress}</span>
        </div>
      </div>
    </Section>
  );
}

/**
 * Card-style companion sheet for hover second card and stacked Library display.
 * Props: companion (object), onStressChange (optional), onAttackRoll (optional), onActRoll (optional — Spellcast roll, no damage),
 */
export function CompanionSheet({ companion, onStressChange, onAttackRoll, onActRoll }) {
  if (!companion) return null;
  const maxStress = companion.maxStress ?? 3;
  const currentStress = companion.currentStress ?? 0;
  const experiences = companion.experiences || [];
  const hasAttack = !!(companion.attackName?.trim());
  return (
    <div className="bg-slate-900 border border-sky-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col min-w-[14rem]">
      <div className="px-3 py-2 border-b border-sky-900/30 bg-sky-950/30 shrink-0">
        <p className="text-[10px] uppercase tracking-widest text-sky-400/80 font-semibold">Companion</p>
        <div className="font-semibold text-slate-200 truncate">{companion.name || '—'}</div>
        {companion.species && <div className="text-[11px] text-slate-500">{companion.species}</div>}
      </div>
      <div className="p-3 space-y-2 flex-1 min-h-0">
        <div className="flex gap-2 text-[11px] text-slate-400">
          <span className="font-bold text-cyan-400/80">EVA {companion.evasion ?? 10}</span>
        </div>
        {(hasAttack || companion.attackName != null) && (
          <Section label="Attack">
            {onAttackRoll && hasAttack ? (
              <button
                type="button"
                onClick={onAttackRoll}
                className="text-[11px] rounded px-1.5 py-0.5 border bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/60 hover:border-sky-600 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Swords size={10} className="text-sky-400 shrink-0" />
                <span>{companion.attackName}</span>
                <span className="text-slate-500">— d6 Melee</span>
              </button>
            ) : (
              <div className="text-[11px] text-slate-300">
                {hasAttack ? `${companion.attackName} — d6 Melee` : '—'}
              </div>
            )}
          </Section>
        )}
        <Section label="Act">
          {onActRoll ? (
            <button
              type="button"
              onClick={onActRoll}
              className="text-[11px] rounded px-1.5 py-0.5 border bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/60 hover:border-sky-600 cursor-pointer flex items-center gap-1 transition-colors"
            >
              <Swords size={10} className="text-sky-400 shrink-0" />
              Take an action
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">Take an action — Spellcast roll</span>
          )}
        </Section>
        {experiences.length > 0 && (
          <Section label="Experiences">
            <div className="flex flex-wrap gap-1">
              {experiences.map((exp, i) => (
                <span
                  key={exp.id || i}
                  className="text-[11px] rounded px-1.5 py-0.5 border bg-slate-800 border-slate-700 text-slate-300"
                >
                  {exp.name}
                  {exp.score != null && <span className="font-bold ml-1 text-sky-400">+{exp.score}</span>}
                </span>
              ))}
            </div>
          </Section>
        )}
        {maxStress > 0 && (
          <div className="flex items-center gap-1">
            <AlertCircle size={10} className="text-orange-500 shrink-0" />
            {onStressChange ? (
              <CheckboxTrack
                total={maxStress}
                filled={currentStress}
                onSetFilled={onStressChange}
                fillColor="bg-orange-500"
                label="Stress"
                verbs={['Mark', 'Clear']}
              />
            ) : (
              <span className="text-[11px] text-slate-400">Stress {currentStress}/{maxStress}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Full character detail pane for use in ItemDetailModal display side.
 */
export function CharacterDetailPane({ item, srdData }) {
  const el = useMemo(() => {
    const raw = item || {};
    if (!srdData) return raw;
    const base = recomputeCharacter(raw, srdData);
    return mergeV2DeclarativeSheetOverlay(base, raw, srdData, {});
  }, [item, srdData]);
  const { complete, missing } = isCharacterComplete(el, srdData ? { srdData } : undefined);
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-slate-900 border border-sky-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <CharacterIdentityHeader el={el} />
        {!complete && (
          <div className="mx-3 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded border border-amber-700/60 bg-amber-950/40 text-amber-300 text-[11px]">
            <AlertTriangle size={12} className="shrink-0" />
            <span>Incomplete — missing: {missing.join(', ')}</span>
          </div>
        )}
        <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
          <CharacterDefenseRow el={el} />
          <CharacterTraitGrid el={el} />
          <CharacterExperiences el={el} />
          <CharacterWeaponList el={el} />
          <CharacterFeaturesPanel el={el} />
          <CharacterAbilityList el={el} />
          <CharacterInventory el={el} />
          {el.background && (
            <Section label="Background">
              <p className="text-[11px] text-slate-400 leading-relaxed">{el.background}</p>
            </Section>
          )}
          {el.connectionText && (
            <Section label="Connections">
              <p className="text-[11px] text-slate-400 leading-relaxed">{el.connectionText}</p>
            </Section>
          )}
          {el.description && (
            <Section label="Description">
              <p className="text-[11px] text-slate-400 leading-relaxed italic">{el.description}</p>
            </Section>
          )}
        </div>
      </div>
      {el.companion && <CompanionSheet companion={el.companion} />}
    </div>
  );
}
