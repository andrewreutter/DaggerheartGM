import {
  User, Shield, Heart, AlertCircle, AlertTriangle, Sparkles, Swords, Package,
  ChevronDown, ChevronRight, Dices, Zap, Megaphone, X,
} from 'lucide-react';
import { useState } from 'react';
import { MarkdownText } from '../lib/markdown.js';
import { effectiveThresholds } from '../lib/helpers.js';
import { isCharacterComplete, detectPairedWeapons, parsePairedBonus, applyDamageBonus, detectVersatileWeapons, detectOtherworldlyWeapons, detectChargedWeapons } from '../lib/character-calc.js';
import { parseFeatureAction, parseSubFeatures, parsePassiveStats, buildCostBadges } from '../lib/feature-actions.js';

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
  const hasWeaponMod = mod != null && mod !== 0;
  const verbs = TRAIT_VERBS[trait] || [];
  const clickable = !!onClick;
  const handleClick = clickable ? (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
    setJustRolled(true);
    setTimeout(() => setJustRolled(false), 1200);
  } : undefined;
  const title = hasWeaponMod && modSource
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
          hasWeaponMod ? 'border-amber-600/70 bg-amber-950/30' :
          positive ? 'border-sky-700/60 bg-sky-900/40' : negative ? 'border-slate-600 bg-slate-800/40' : 'border-slate-700 bg-slate-800/20'}
        ${clickable ? 'cursor-pointer hover:brightness-125 hover:border-sky-500/70 group transition-all' : ''}`}
    >
      <span className="text-[9px] uppercase tracking-widest text-slate-400 flex items-center gap-0.5">
        {label}
        {clickable && <Dices size={7} className={`transition-colors ${justRolled ? 'text-green-400' : 'text-slate-600 group-hover:text-sky-400'}`} />}
      </span>
      <span className={`text-sm font-bold tabular-nums leading-tight ${hasWeaponMod ? 'text-amber-200' : positive ? 'text-sky-300' : negative ? 'text-slate-400' : 'text-slate-200'}`}>{display}</span>
      {hasWeaponMod && (
        <span className={`text-[9px] font-semibold tabular-nums leading-none ${mod > 0 ? 'text-amber-400' : 'text-amber-500'}`}>
          {mod > 0 ? `+${mod}` : String(mod)}
        </span>
      )}
      {!hasWeaponMod && verbs.length > 0 && (
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

function WeaponCard({ weapon, traitScore, onClick, isVirtual, purple, devastating, onDevastatingToggle, pompousWarning }) {
  const [justRolled, setJustRolled] = useState(false);
  const clickable = !!onClick && !pompousWarning;
  const traitKey = (weapon.trait || '').toLowerCase();
  const traitLabel = TRAIT_LABELS[traitKey];
  const traitScore_ = traitScore ?? 0;
  const traitDisplay = traitScore_ > 0 ? `+${traitScore_}` : String(traitScore_);

  const handleClick = clickable ? (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
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
  } else if (pompousWarning) {
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

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={pompousWarning ? 'Requires Presence ≤ 0' : clickable && traitLabel ? `Roll ${weapon.name} (${TRAIT_FULL[traitKey]})` : undefined}
      className={`rounded border px-2 py-1.5 select-none text-[11px] transition-all
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
        {weapon.range && (
          <span className="text-slate-500 shrink-0">{weapon.range}</span>
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
      {pompousWarning && (
        <div className="text-[9px] mt-1 ml-5 text-amber-400 flex items-center gap-1">
          <AlertCircle size={9} className="shrink-0" />
          Requires Presence ≤ 0
        </div>
      )}
    </div>
  );
}

// ─── Cost badge strip ─────────────────────────────────────────────────────────

function CostBadgeStrip({ action }) {
  const badges = buildCostBadges(action);
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-1.5">
      {badges.map((b, i) => (
        <span
          key={i}
          className={`text-[9px] rounded px-1.5 py-0.5 border font-semibold ${
            b.style === 'hope'      ? 'bg-amber-950/50 border-amber-700/50 text-amber-300' :
            b.style === 'stress'    ? 'bg-orange-950/50 border-orange-700/50 text-orange-300' :
            b.style === 'armor'     ? 'bg-cyan-950/50 border-cyan-700/50 text-cyan-300' :
            'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

// ─── Sub-feature card ─────────────────────────────────────────────────────────

function SubFeatureCard({ sub, onUse, disabled }) {
  const badges = buildCostBadges(sub);
  const hasDice = sub.dice?.length > 0 || sub.spellcastDC != null;
  return (
    <div
      role={onUse && !disabled ? 'button' : undefined}
      tabIndex={onUse && !disabled ? 0 : undefined}
      onClick={onUse && !disabled ? onUse : undefined}
      onKeyDown={onUse && !disabled ? (e) => { if (e.key === 'Enter' || e.key === ' ') onUse(); } : undefined}
      className={`rounded border px-2 py-1.5 text-[11px] select-none transition-all ${
        disabled
          ? 'border-slate-700/40 bg-slate-800/20 opacity-40 cursor-not-allowed'
          : onUse
            ? 'border-amber-700/50 bg-amber-950/20 cursor-pointer hover:brightness-125 hover:border-amber-500/70'
            : 'border-slate-700/50 bg-slate-800/40'
      }`}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {hasDice && <Dices size={9} className="text-amber-500/70 shrink-0" />}
        <span className="font-semibold text-slate-200 flex-1">{sub.name}</span>
        {badges.map((b, i) => (
          <span
            key={i}
            className={`text-[9px] rounded px-1 py-0.5 border font-semibold shrink-0 ${
              b.style === 'hope'   ? 'bg-amber-950/50 border-amber-700/50 text-amber-300' :
              b.style === 'stress' ? 'bg-orange-950/50 border-orange-700/50 text-orange-300' :
              b.style === 'armor'  ? 'bg-cyan-950/50 border-cyan-700/50 text-cyan-300' :
              'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
      {sub.description && (
        <div className="mt-0.5 text-[10px] text-slate-400 leading-snug line-clamp-2">{sub.description}</div>
      )}
    </div>
  );
}

// ─── Feature chip (collapsible) ───────────────────────────────────────────────

/**
 * Props:
 *   feature        — feature object (name, description, sourceType, source, charge)
 *   open / onToggle — controlled or uncontrolled open state
 *   onFeatureUse(feature, subFeature?)  — when provided, renders interactive controls
 *   featureUsage   — { [key]: { used, cycle } } map from element state
 *   featureKey     — unique key for usage tracking (default: feature.name)
 */
function FeatureChip({ feature, open: openProp, onToggle, onFeatureUse, featureUsage, featureKey }) {
  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp !== undefined ? openProp : openLocal;
  const toggle = onToggle ?? (() => setOpenLocal(o => !o));

  const action = parseFeatureAction(feature.description || '');
  const subFeatures = parseSubFeatures(feature.description || '');
  const passiveStats = (!action.isActive && subFeatures.length === 0)
    ? parsePassiveStats(feature.description || '')
    : [];

  const effectiveKey = featureKey || feature.name;
  const isUsed = !!(featureUsage?.[effectiveKey]?.used);
  const hasDice = action.dice.length > 0 || action.spellcastDC != null;

  return (
    <div className="rounded border border-slate-700 bg-slate-800/60 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full px-2 py-1 flex items-center gap-1 text-left hover:bg-slate-700/40 transition-colors"
      >
        {open ? <ChevronDown size={9} className="text-slate-500 shrink-0" /> : <ChevronRight size={9} className="text-slate-500 shrink-0" />}
        <span className="text-[11px] font-semibold text-slate-200 leading-tight truncate">{feature.name}</span>
        {/* Active feature indicator in header */}
        {action.isActive && !open && (
          <span className={`ml-1 text-[9px] rounded px-1 border shrink-0 ${
            action.frequency
              ? isUsed
                ? 'bg-slate-800 border-slate-600 text-slate-500'
                : 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400'
              : isUsed
                ? 'bg-slate-800 border-slate-700 text-slate-500'
                : hasDice ? 'bg-amber-950/50 border-amber-700/50 text-amber-400'
                : action.hopeCost > 0 ? 'bg-amber-950/50 border-amber-700/50 text-amber-400'
                : 'bg-amber-950/30 border-amber-700/30 text-amber-500/70'
          }`}>
            {action.frequency
              ? isUsed
                ? `Used until ${action.frequency === 'session' ? 'next session' : action.frequency === 'longRest' ? 'long rest' : 'short rest'}`
                : 'Unused'
              : isUsed
                ? `✓ used/${action.frequency === 'session' ? 'session' : action.frequency === 'longRest' ? 'long rest' : 'rest'}`
                : hasDice ? '⚄ active' : 'active'}
          </span>
        )}
        {feature.sourceType && (
          <span className={`ml-auto text-[9px] rounded px-1 shrink-0 ${
            feature.sourceType === 'class'     ? 'bg-violet-900/60 text-violet-300' :
            feature.sourceType === 'subclass'  ? 'bg-sky-900/60 text-sky-300' :
            feature.sourceType === 'ancestry'  ? 'bg-amber-900/60 text-amber-300' :
            'bg-emerald-900/60 text-emerald-300'
          }`}>{feature.source}</span>
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 text-[11px] text-slate-300 leading-relaxed border-t border-slate-700 pt-1">
          {feature.description && (
            <MarkdownText text={feature.description} className="dh-md" />
          )}
          {feature.charge && (
            <span className="block mt-0.5 text-[10px] text-slate-500 italic">
              {feature.charge.max} charge{feature.charge.max !== 1 ? 's' : ''} · recharges on {feature.charge.recharge?.on || 'rest'}
            </span>
          )}

          {/* ── Sub-feature cards (choose-one / multiple options) ── */}
          {subFeatures.length >= 2 && (
            <div className="mt-2 space-y-1">
              {subFeatures.map((sub, i) => (
                <SubFeatureCard
                  key={i}
                  sub={sub}
                  onUse={onFeatureUse && !isUsed ? () => onFeatureUse(feature, sub) : undefined}
                  disabled={isUsed}
                />
              ))}
              {action.frequency && isUsed && (
                <p className="text-[10px] text-slate-500 italic mt-0.5">
                  Used this {action.frequency === 'session' ? 'session' : action.frequency === 'longRest' ? 'long rest' : 'rest'}
                </p>
              )}
            </div>
          )}

          {/* ── Single active feature: cost badges + Use button ── */}
          {action.isActive && subFeatures.length < 2 && (
            <div className="mt-2 pt-1.5 border-t border-slate-700/60">
              <CostBadgeStrip action={action} />
              {onFeatureUse ? (
                isUsed ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Used this {action.frequency === 'session' ? 'session' : action.frequency === 'longRest' ? 'long rest' : 'rest'}
                  </p>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onFeatureUse(feature); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border bg-amber-900/40 border-amber-700/60 text-amber-200 hover:bg-amber-800/60 hover:border-amber-600 transition-colors"
                  >
                    {hasDice ? <Dices size={10} /> : <Zap size={10} />}
                    Use
                  </button>
                )
              ) : null}
            </div>
          )}

          {/* ── Passive stat badges ── */}
          {passiveStats.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {passiveStats.map((ps, i) => (
                <span key={i} className="text-[9px] rounded px-1.5 py-0.5 bg-slate-800/80 border border-slate-700 text-slate-400">
                  {ps.label}
                </span>
              ))}
            </div>
          )}

          {/* ── Comms-only / narrative feature: Announce button ── */}
          {!action.isActive && passiveStats.length === 0 && onFeatureUse && (
            <div className="mt-1.5 pt-1 border-t border-slate-700/40">
              <button
                onClick={(e) => { e.stopPropagation(); onFeatureUse(feature); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border border-slate-600/60 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
              >
                <Megaphone size={9} />
                Announce
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
 *   onTraitClick(traitKey)    — when provided, chips become clickable (HoverCard passes a roll callback)
 *   selectedExperienceHint    — hint string shown below grid (e.g. '+2 from "Explorer" included')
 */
export function CharacterTraitGrid({ el, onTraitClick, onSpellcastRoll, selectedExperienceHint }) {
  const traits = el.traits || {};
  if (!TRAIT_ORDER.some(t => traits[t] != null)) return null;
  const weaponMods = el.weaponMods || {};
  const armorMods = el.armorMods || {};
  return (
    <Section label={onTraitClick ? 'Traits — click to roll' : 'Traits'}>
      <div className="grid grid-cols-6 gap-1">
        {TRAIT_ORDER.map(t => {
          const score = traits[t] ?? 0;
          const wMod = weaponMods.traits?.[t] ?? 0;
          const aMod = armorMods.traits?.[t] ?? 0;
          const mod = wMod + aMod;
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
          const modSource = sources.length ? sources.join('; ') : null;
          return (
            <TraitChip
              key={t}
              trait={t}
              label={TRAIT_LABELS[t]}
              score={score}
              onClick={onTraitClick ? () => onTraitClick(t) : undefined}
              mod={mod || undefined}
              modSource={modSource || undefined}
            />
          );
        })}
      </div>
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
      {onTraitClick && (
        <p className="text-[9px] text-slate-600 mt-0.5">
          {selectedExperienceHint || 'Select an experience above to add +2'}
        </p>
      )}
    </Section>
  );
}

export function CharacterDefenseRow({ el }) {
  if (el.evasion == null && !el.armorScore) return null;
  const thresholds = effectiveThresholds(el);
  const wm = el.weaponMods || {};
  const am = el.armorMods || {};
  const totalEvasionMod = (wm.evasion || 0) + (am.evasion || 0);
  const evasionSources = [];
  if (wm.evasion) evasionSources.push(...(wm.sources || []).filter(s => s.stat === 'evasion').map(s => `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to Evasion`));
  if (am.evasion) evasionSources.push(...(am.sources || []).filter(s => s.stat === 'evasion').map(s => `${s.feature} (${s.armor}): ${s.value > 0 ? '+' : ''}${s.value} to Evasion`));
  const evasionModTooltip = evasionSources.length ? evasionSources.join('; ') : null;
  const armorModTooltip = wm.armorScore
    ? (wm.sources || []).filter(s => s.stat === 'armor score').map(s => `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to Armor Score`).join('; ')
    : null;
  const severeModTooltip = wm.severeThreshold
    ? (wm.sources || []).filter(s => s.stat === 'severe damage threshold').map(s => `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to Severe threshold`).join('; ')
    : null;
  const armorFeature = am.feature;
  const isStatModFeature = armorFeature && /^(Flexible|Heavy|Very Heavy|Gilded|Difficult)$/.test(armorFeature.name);
  return (
    <Section label="Defense">
      <div className="flex items-center gap-3 text-xs flex-wrap">
        {el.evasion != null && (
          <div className="flex items-center gap-1" title={evasionModTooltip || undefined}>
            <Shield size={11} className="text-cyan-500" />
            <span className="text-slate-400">Evasion</span>
            <span className={`font-bold tabular-nums ${totalEvasionMod ? 'text-amber-200' : 'text-cyan-200'}`}>{el.evasion}</span>
            {totalEvasionMod ? <span className={`text-[10px] font-semibold tabular-nums ${totalEvasionMod > 0 ? 'text-amber-400' : 'text-amber-500'}`}>({totalEvasionMod > 0 ? '+' : ''}{totalEvasionMod})</span> : null}
          </div>
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
          <div className="text-slate-400">
            Thresholds: <span className="text-yellow-300 font-semibold">{thresholds.major}</span>
            <span className="text-slate-500"> / </span>
            <span className={`font-semibold ${wm.severeThreshold ? 'text-amber-300' : 'text-red-300'}`} title={severeModTooltip || undefined}>
              {thresholds.severe}{wm.severeThreshold ? <span className="text-[10px] text-amber-400"> ({wm.severeThreshold > 0 ? '+' : ''}{wm.severeThreshold})</span> : null}
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}

/**
 * Experiences list — static chips or interactive Hope-gated buttons.
 *
 * Props:
 *   selectedIndex             — currently selected experience index (interactive mode)
 *   onSelect(i)               — selection callback; when absent, renders static chips
 *   hope / maxHope            — current Hope values for gating
 */
export function CharacterExperiences({ el, selectedIndex, onSelect, hope, maxHope, rollModifiers, selectedRollModIndex, onSelectRollMod, selectedModId, onSelectMod, onUseMod }) {
  const experiences = el.experiences || [];
  const hasRollMods = rollModifiers?.length > 0;
  const activeModifiers = el.activeModifiers || [];
  if (!experiences.length && !hasRollMods && !activeModifiers.length) return null;

  if (!onSelect) {
    return (
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
          {activeModifiers.map((mod, i) => (
            <ModifierChip key={mod.id || i} mod={mod} />
          ))}
        </div>
      </Section>
    );
  }

  const currentHope = hope ?? (maxHope ?? 6);
  return (
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
        {activeModifiers.map((mod, i) => (
          <ModifierChip
            key={mod.id || i}
            mod={mod}
            selected={selectedModId === mod.id}
            onSelect={onSelectMod ? () => onSelectMod(selectedModId === mod.id ? null : mod.id) : undefined}
            onUse={onUseMod && mod.mode === 'clearStress' ? () => onUseMod(mod) : undefined}
            onRemove={onSelectMod ? () => onSelectMod(null) : undefined}
          />
        ))}
      </div>
      {currentHope === 0 && !activeModifiers.length && (
        <p className="text-[9px] text-red-500/70 mt-0.5">No Hope — cannot use Experiences</p>
      )}
    </Section>
  );
}

// ─── Modifier chip ─────────────────────────────────────────────────────────────

function ModifierChip({ mod, selected, onSelect, onUse, onRemove }) {
  const isRollMod = mod.mode === 'roll' || (mod.bonus != null && !mod.mode);
  const isClearStress = mod.mode === 'clearStress';
  const isPersistent = mod.type === 'persistent';

  const baseLabel = mod.name + (mod.dice ? ` (${mod.dice})` : mod.value != null ? ` (${mod.value})` : mod.bonus != null ? ` +${mod.bonus}` : '');

  let colorCls;
  if (mod.name === 'Rally Die') colorCls = selected ? 'bg-green-800/70 border-green-500 text-green-100 ring-1 ring-green-500/50' : 'bg-green-950/40 border-green-700/60 text-green-300 hover:bg-green-900/40';
  else if (mod.name === 'Prayer Die') colorCls = selected ? 'bg-teal-800/70 border-teal-500 text-teal-100 ring-1 ring-teal-500/50' : 'bg-teal-950/40 border-teal-700/60 text-teal-300 hover:bg-teal-900/40';
  else if (mod.name === 'Sneak Attack') colorCls = selected ? 'bg-red-800/70 border-red-500 text-red-100 ring-1 ring-red-500/50' : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/40';
  else if (mod.name === 'No Mercy') colorCls = selected ? 'bg-amber-800/70 border-amber-500 text-amber-100 ring-1 ring-amber-500/50' : 'bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/40';
  else if (mod.name === "Rogue's Dodge") colorCls = selected ? 'bg-cyan-800/70 border-cyan-500 text-cyan-100 ring-1 ring-cyan-500/50' : 'bg-cyan-950/40 border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/40';
  else if (mod.name === 'Evolution') colorCls = selected ? 'bg-violet-800/70 border-violet-500 text-violet-100 ring-1 ring-violet-500/50' : 'bg-violet-950/40 border-violet-700/60 text-violet-300 hover:bg-violet-900/40';
  else if (mod.name === 'Dread Visage') colorCls = selected ? 'bg-red-800/70 border-red-500 text-red-100 ring-1 ring-red-500/50' : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/40';
  else colorCls = selected ? 'bg-sky-800/70 border-sky-500 text-sky-100 ring-1 ring-sky-500/50' : 'bg-sky-950/40 border-sky-700/60 text-sky-300 hover:bg-sky-900/40';

  const clickable = !!(onSelect || onUse);

  return (
    <button
      type="button"
      title={isPersistent ? `${mod.name} (active until ${mod.refreshOn === 'session' ? 'session end' : mod.refreshOn === 'longRest' ? 'long rest' : 'rest'})` : `${mod.name} — click to ${isRollMod ? 'include in next roll' : isClearStress ? 'roll to clear Stress' : 'use'}`}
      onClick={clickable ? (onUse || onSelect) : undefined}
      className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors flex items-center gap-1 ${clickable ? 'cursor-pointer' : 'cursor-default'} ${colorCls}`}
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
 *   selectedExperienceHint           — string shown below weapons when interactive
 */
export function CharacterWeaponList({
  el,
  onWeaponClick,
  devastatingActive,
  onDevastatingToggle,
  stressMaxed: stressMaxedProp,
  onActionNotification,
  selectedExperienceHint,
}) {
  const weapons = el.weapons || [];
  if (!weapons.length) return null;

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
      range: primaryWeapon.range,
      trait: primaryWeapon.trait,
    };
  }

  const versatilePairs = detectVersatileWeapons(weapons);
  const otherworldlyPairs = detectOtherworldlyWeapons(weapons);
  const chargedPairs = detectChargedWeapons(weapons);
  const otherworldlyOriginals = new Set(otherworldlyPairs.map(o => o.original));
  const startlingWeapons = weapons.filter(w => w.feature?.name === 'Startling');

  // For Doubled Up: find the secondary weapon's damage string
  const primaryWeapon_ = weapons.find(w => w.isPrimary !== false && !w.feature?.name?.includes('Paired'));
  const secondaryWeapon_ = weapons.find(w => w !== primaryWeapon_);
  const secondaryDamageStr = secondaryWeapon_
    ? `${secondaryWeapon_.damage || ''} ${secondaryWeapon_.damageType || ''}`.trim()
    : null;

  const makeClick = (w, extraMeta = {}) => {
    if (!onWeaponClick) return undefined;
    if (w.feature?.name === 'Pompous' && (traits.presence ?? 0) > 0) return undefined;
    if (w._charged && isStressMaxed) return undefined;
    const rollMeta = { ...extraMeta };
    if (w.feature?.name === 'Devastating' && devastatingActive) rollMeta.devastating = true;
    if (w.feature?.name === 'Doubled Up' && secondaryDamageStr) rollMeta.secondaryDamage = secondaryDamageStr;
    return () => onWeaponClick(w, rollMeta);
  };

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
          />
        )}

        {/* Versatile alternate cards */}
        {versatilePairs.map(({ alternate }, i) => (
          <WeaponCard
            key={`versatile-${i}`}
            weapon={alternate}
            traitScore={traits[(alternate.trait || '').toLowerCase()] ?? 0}
            onClick={makeClick(alternate)}
            isVirtual
          />
        ))}

        {/* Otherworldly Physical + Magical variant pairs */}
        {otherworldlyPairs.map(({ physicalVariant, magicalVariant }, i) => (
          <div key={`otherworldly-${i}`} className="space-y-1">
            <WeaponCard
              weapon={physicalVariant}
              traitScore={traits[(physicalVariant.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(physicalVariant)}
              isVirtual
            />
            <WeaponCard
              weapon={magicalVariant}
              traitScore={traits[(magicalVariant.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(magicalVariant)}
              purple
            />
          </div>
        ))}

        {/* Charged variant cards */}
        {chargedPairs.map(({ chargedVariant }, i) => (
          <div key={`charged-${i}`}>
            <WeaponCard
              weapon={chargedVariant}
              traitScore={traits[(chargedVariant.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(chargedVariant, { _attackerInstanceId: el.instanceId })}
              isVirtual
            />
            {isStressMaxed && (
              <div className="text-[9px] text-slate-500 pl-5 mt-0.5">Stress maxed — cannot use Charged</div>
            )}
          </div>
        ))}

        {/* Normal weapon cards (skip Otherworldly originals) */}
        {weapons.filter(w => !otherworldlyOriginals.has(w)).map((w, i) => (
          <WeaponCard
            key={i}
            weapon={w}
            traitScore={traits[(w.trait || '').toLowerCase()] ?? 0}
            onClick={makeClick(w)}
            devastating={w.feature?.name === 'Devastating' ? devastatingActive : undefined}
            onDevastatingToggle={w.feature?.name === 'Devastating' && onWeaponClick ? onDevastatingToggle : undefined}
            pompousWarning={w.feature?.name === 'Pompous' && (traits.presence ?? 0) > 0}
          />
        ))}

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
                <span className="font-semibold text-amber-200/80 flex-1">Startling: Force Back</span>
                <span className="text-[9px] text-amber-400/70 shrink-0">1 Stress</span>
              </div>
              <div className="text-[10px] mt-0.5 pl-5 text-amber-400/60">
                Mark a Stress to force all adversaries in Melee back to Close range
              </div>
            </div>
          );
        })}
      </div>
      {onWeaponClick && selectedExperienceHint && (
        <p className="text-[9px] text-slate-600 mt-0.5">{selectedExperienceHint}</p>
      )}
    </Section>
  );
}

/**
 * Feature list — static display or interactive.
 *
 * Props:
 *   expandedKeys              — string[] controlled from outside (persisted)
 *   onToggleFeature(key)      — when absent, falls back to local useState
 *   onUseHopeAbility(id)      — makes the Hope ability into an interactive button
 *   onFeatureUse(feature, subFeature?) — makes all features interactive (Use/Announce)
 *   featureUsage              — { [key]: { used, cycle } } usage state map
 *   currentHope               — for gating the Hope ability button
 */
export function CharacterFeatureList({ el, expandedKeys, onToggleFeature, onUseHopeAbility, onFeatureUse, featureUsage, currentHope }) {
  const [localExpanded, setLocalExpanded] = useState({});

  const allFeatures = [
    ...(el.classFeatures || []),
    ...(el.subclassFeatures || []),
    ...(el.ancestryFeatures || []),
    ...(el.communityFeatures || []),
  ];

  // Prefer hopeFeature (CharacterDisplay path) with fallback to hopeAbility (Daggerstack path)
  const hopeFeature = el.hopeFeature || el.hopeAbility;
  if (!allFeatures.length && !hopeFeature) return null;

  const isOpen = (key) => {
    if (expandedKeys !== undefined) return expandedKeys.includes(key);
    return localExpanded[key] ?? false;
  };
  const toggle = (key) => {
    if (onToggleFeature) {
      onToggleFeature(key);
    } else {
      setLocalExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const resolveHopeFeature = () => {
    let name, desc;
    if (typeof hopeFeature === 'object') {
      name = hopeFeature.name || el.hopeAbilityName;
      desc = hopeFeature.description || hopeFeature.text || '';
    } else {
      const str = String(hopeFeature);
      const colonIdx = str.indexOf(': ');
      if (colonIdx > 0) { name = str.slice(0, colonIdx); desc = str.slice(colonIdx + 2); }
      else { name = el.hopeAbilityName || null; desc = str; }
    }
    return { name, desc };
  };

  return (
    <Section label="Features">
      <div className="space-y-1">
        {hopeFeature && (() => {
          const { name, desc } = resolveHopeFeature();
          const hope = currentHope ?? (el.hope ?? (el.maxHope ?? 6));
          const canUse = hope >= 3;
          const interactive = !!onUseHopeAbility;

          if (interactive) {
            // Route through onFeatureUse if available (applies cost on GM ack, broadcasts notification).
            // Fall back to direct onUseHopeAbility for legacy callers that don't provide onFeatureUse.
            const hopeFeat = { name: name || 'Hope Ability', description: desc || '' };
            const handleClick = onFeatureUse
              ? () => canUse && onFeatureUse(hopeFeat)
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
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles size={10} className={canUse ? 'text-amber-400' : 'text-slate-500'} />
                  {name && <span className="text-[11px] font-semibold text-amber-200 leading-tight">{name}</span>}
                  <span className="ml-auto text-[9px] font-semibold text-amber-400/80 shrink-0">3 Hope</span>
                </div>
                {desc && <MarkdownText text={desc} className="text-[11px] text-slate-300 leading-relaxed dh-md" />}
              </button>
            );
          }

          return (
            <div className="rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Sparkles size={10} className="text-amber-400" />
                {name && <span className="text-[11px] font-semibold text-amber-200">{name}</span>}
                <span className="ml-auto text-[9px] font-semibold text-amber-400/80 shrink-0">3 Hope</span>
              </div>
              {desc && <MarkdownText text={desc} className="text-[11px] text-slate-300 leading-relaxed dh-md" />}
            </div>
          );
        })()}
        {allFeatures.map((f, i) => {
          const key = `${f.name}-${i}`;
          return (
            <FeatureChip
              key={key}
              feature={f}
              open={isOpen(key)}
              onToggle={() => toggle(key)}
              onFeatureUse={onFeatureUse}
              featureUsage={featureUsage}
              featureKey={key}
            />
          );
        })}
      </div>
    </Section>
  );
}

export function CharacterAbilityList({ el }) {
  const abilities = el.abilities || [];
  if (!abilities.length) return null;
  return (
    <Section label="Domain Cards">
      <div className="space-y-1">
        {abilities.map((a, i) => (
          <div key={a.id || i} className="rounded border border-violet-700/50 bg-violet-950/30 px-2 py-1.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-violet-200">{a.name}</span>
              <span className="text-[9px] text-violet-400/70">{a.domain} · Lvl {a.level}</span>
              {a.type && <span className="text-[9px] text-slate-500 ml-auto">{a.type}</span>}
            </div>
            {a.description && (
              <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                <MarkdownText text={a.description} className="dh-md" />
              </div>
            )}
          </div>
        ))}
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
 * Full character detail pane for use in ItemDetailModal display side.
 */
export function CharacterDetailPane({ item }) {
  const el = item || {};
  const { complete, missing } = isCharacterComplete(el);
  return (
    <div className="bg-slate-900 border border-sky-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
      <CharacterIdentityHeader el={el} />
      {!complete && (
        <div className="mx-3 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded border border-amber-700/60 bg-amber-950/40 text-amber-300 text-[11px]">
          <AlertTriangle size={12} className="shrink-0" />
          <span>Incomplete — missing: {missing.join(', ')}</span>
        </div>
      )}
      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
        <CharacterTraitGrid el={el} />
        <CharacterExperiences el={el} />
        <CharacterDefenseRow el={el} />
        <CharacterWeaponList el={el} />
        <CharacterFeatureList el={el} />
        <CharacterAbilityList el={el} />
        <CharacterInventory el={el} />
        <CharacterCompanion el={el} />
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
  );
}
