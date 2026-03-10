import { useState } from 'react';
import {
  User, Shield, Heart, AlertCircle, Sparkles, Swords, Package,
  Star, ChevronDown, ChevronRight, ExternalLink, RefreshCw, Bug, Dices
} from 'lucide-react';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { effectiveThresholds } from '../lib/helpers.js';

// ─── Gold helpers ─────────────────────────────────────────────────────────────

/** Convert raw gold integer to handfuls / bags / chests using base-9 math. */
export function formatGold(gold) {
  const g = Math.max(0, Math.floor(gold || 0));
  const chests = Math.floor(g / 81);      // 9 bags × 9 handfuls = 81
  const bags = Math.floor((g % 81) / 9);
  const handfuls = g % 9;
  const parts = [];
  if (chests) parts.push(`${chests} chest${chests !== 1 ? 's' : ''}`);
  if (bags) parts.push(`${bags} bag${bags !== 1 ? 's' : ''}`);
  if (handfuls || !parts.length) parts.push(`${handfuls} handful${handfuls !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

// ─── Trait display ────────────────────────────────────────────────────────────

const TRAIT_LABELS = {
  agility:   'AGI',
  strength:  'STR',
  finesse:   'FIN',
  instinct:  'INS',
  presence:  'PRE',
  knowledge: 'KNO',
};

const TRAIT_VERBS = {
  agility:   ['Sprint', 'Leap', 'Maneuver'],
  strength:  ['Lift', 'Smash', 'Grapple'],
  finesse:   ['Control', 'Hide', 'Tinker'],
  instinct:  ['Perceive', 'Sense', 'Navigate'],
  presence:  ['Charm', 'Perform', 'Deceive'],
  knowledge: ['Recall', 'Analyze', 'Comprehend'],
};

const TRAIT_FULL = {
  agility:   'Agility',
  strength:  'Strength',
  finesse:   'Finesse',
  instinct:  'Instinct',
  presence:  'Presence',
  knowledge: 'Knowledge',
};

/**
 * Build a Rolz roll string for a Daggerheart action roll.
 * Uses separate Hope [d12] / Fear [d12] expressions so parseDaggerheartRoll
 * in RolzRoomLog can detect Hope vs Fear and render the enhanced display.
 * Trait modifier and experience bonus are added as labeled constant expressions
 * so they contribute to the total without affecting the Hope/Fear comparison.
 */
function buildTraitRollText(charName, traitKey, traitScore, expName) {
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${traitName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    const expr = traitScore > 0 ? `${traitScore}` : `0${traitScore}`;
    parts.push(`${traitName} [${expr}]`);
  }
  if (expName) {
    parts.push(`${expName} [2]`);
  }
  return parts.join(' ');
}

/**
 * Build a Rolz roll string for a weapon attack roll.
 * The weapon defines a trait; we look up the character's score for that trait.
 * Damage string like "d8+1 phy" is appended as "damage [d8+1] phy".
 */
function buildWeaponRollText(charName, weaponName, traitKey, traitScore, expName, damageStr) {
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${weaponName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    const expr = traitScore > 0 ? `${traitScore}` : `0${traitScore}`;
    parts.push(`${traitName} [${expr}]`);
  }
  if (expName) {
    parts.push(`${expName} [2]`);
  }
  if (damageStr) {
    // "d8+1 phy" → dice="d8+1", type="phy"
    const m = damageStr.trim().match(/^([^\s]+)(?:\s+(.+))?$/);
    if (m) {
      parts.push(`damage [${m[1]}]`);
      if (m[2]) parts.push(m[2].toLowerCase());
    }
  }
  return parts.join(' ');
}

function TraitChip({ trait, label, score, onClick }) {
  const [justRolled, setJustRolled] = useState(false);
  const positive = score > 0;
  const negative = score < 0;
  const display = positive ? `+${score}` : String(score);
  const verbs = TRAIT_VERBS[trait] || [];
  const clickable = !!onClick;
  const handleClick = clickable ? (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
    setJustRolled(true);
    setTimeout(() => setJustRolled(false), 1200);
  } : undefined;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={clickable ? `Roll ${TRAIT_FULL[trait]}` : undefined}
      className={`flex flex-col items-center rounded px-1 py-1 border select-none
        ${justRolled ? 'border-green-500/70 bg-green-900/40' :
          positive ? 'border-sky-700/60 bg-sky-900/40' : negative ? 'border-slate-600 bg-slate-800/40' : 'border-slate-700 bg-slate-800/20'}
        ${clickable ? 'cursor-pointer hover:brightness-125 hover:border-sky-500/70 group transition-all' : ''}`}
    >
      <span className="text-[9px] uppercase tracking-widest text-slate-400 flex items-center gap-0.5">
        {label}
        {clickable && <Dices size={7} className={`transition-colors ${justRolled ? 'text-green-400' : 'text-slate-600 group-hover:text-sky-400'}`} />}
      </span>
      <span className={`text-sm font-bold tabular-nums leading-tight ${positive ? 'text-sky-300' : negative ? 'text-slate-400' : 'text-slate-200'}`}>{display}</span>
      {verbs.length > 0 && (
        <div className="flex flex-col items-center mt-0.5 gap-px">
          {verbs.map(v => (
            <span key={v} className="text-[8px] text-slate-500 leading-tight">{v}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weapon tag descriptions (from SRD) ──────────────────────────────────────
// Fallback lookup when w.feature.text is not present in Daggerstack sync data.

const WEAPON_TAG_DESCRIPTIONS = {
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

// ─── Paired weapon helpers ────────────────────────────────────────────────────

/** Extract the numeric bonus from a Paired feature description, e.g. "+2 to primary weapon damage…" → 2. */
function parsePairedBonus(featText) {
  if (!featText) return 2;
  const m = featText.match(/\+(\d+)/);
  return m ? parseInt(m[1], 10) : 2;
}

/**
 * Apply a flat numeric bonus to a damage string.
 * "d8" → "d8+2", "d8+1" → "d8+3", "2d6-1" → "2d6+1"
 */
function applyDamageBonus(damageStr, bonus) {
  if (!damageStr || bonus === 0) return damageStr;
  const m = damageStr.trim().match(/^([^\s+\-]+)([+-]\d+)?(\s+.*)?$/);
  if (!m) return `${damageStr}+${bonus}`;
  const dice = m[1];
  const existing = m[2] ? parseInt(m[2], 10) : 0;
  const suffix = m[3] || '';
  const total = existing + bonus;
  const mod = total > 0 ? `+${total}` : total < 0 ? String(total) : '';
  return `${dice}${mod}${suffix}`;
}

/**
 * Given a weapons array, find the first weapon with feature name "Paired"
 * and the weapon that is its primary partner.
 * Returns { primaryWeapon, pairedWeapon } or null if no pairing found.
 */
function detectPairedWeapons(weapons) {
  if (!weapons || weapons.length < 2) return null;
  const pairedIdx = weapons.findIndex(w => w.feature?.name?.toLowerCase() === 'paired');
  if (pairedIdx === -1) return null;
  const pairedWeapon = weapons[pairedIdx];
  // Primary = first weapon that isn't the paired one
  const primaryWeapon = weapons.find((w, i) => i !== pairedIdx);
  if (!primaryWeapon) return null;
  return { primaryWeapon, pairedWeapon };
}

// ─── Weapon card ──────────────────────────────────────────────────────────────

function WeaponCard({ weapon, traitScore, onClick, isVirtual }) {
  const [justRolled, setJustRolled] = useState(false);
  const clickable = !!onClick;
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

  const baseBorder = isVirtual
    ? (justRolled ? 'border-green-500/70 bg-green-900/40' : 'border-amber-700/50 bg-amber-950/30')
    : (justRolled ? 'border-green-500/70 bg-green-900/40' : 'border-slate-700 bg-slate-800/60');

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={clickable && traitLabel ? `Roll ${weapon.name} (${TRAIT_FULL[traitKey]})` : undefined}
      className={`rounded border px-2 py-1.5 select-none text-[11px] transition-all
        ${baseBorder}
        ${clickable ? 'cursor-pointer hover:brightness-125 hover:border-sky-500/50 group' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Swords size={10} className={`shrink-0 transition-colors ${justRolled ? 'text-green-400' : isVirtual ? 'text-amber-500/70' : clickable ? 'text-slate-500 group-hover:text-sky-400' : 'text-slate-500'}`} />
        <span className={`font-semibold flex-1 truncate ${isVirtual ? 'text-amber-100' : 'text-slate-200'}`}>{weapon.name}</span>
        {weapon.damage && (
          <span className="text-yellow-300 font-semibold tabular-nums shrink-0">{weapon.damage}</span>
        )}
        {weapon.damageType && (
          <span className="text-slate-500 shrink-0">{weapon.damageType}</span>
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
        <div className={`text-[10px] mt-0.5 pl-5 ${isVirtual ? 'text-amber-400/80' : 'text-amber-400/70'}`}>
          {feat.name}: {featDesc}
        </div>
      )}
    </div>
  );
}

// ─── Feature card (collapsible) ───────────────────────────────────────────────

function FeatureChip({ feature, open: openProp, onToggle }) {
  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp !== undefined ? openProp : openLocal;
  const toggle = onToggle ?? (() => setOpenLocal(o => !o));
  return (
    <div className="rounded border border-slate-700 bg-slate-800/60 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full px-2 py-1 flex items-center gap-1 text-left hover:bg-slate-700/40 transition-colors"
      >
        {open ? <ChevronDown size={9} className="text-slate-500 shrink-0" /> : <ChevronRight size={9} className="text-slate-500 shrink-0" />}
        <span className="text-[11px] font-semibold text-slate-200 leading-tight truncate">{feature.name}</span>
        {feature.sourceType && (
          <span className={`ml-auto text-[9px] rounded px-1 shrink-0 ${
            feature.sourceType === 'class' ? 'bg-violet-900/60 text-violet-300' :
            feature.sourceType === 'subclass' ? 'bg-sky-900/60 text-sky-300' :
            feature.sourceType === 'ancestry' ? 'bg-amber-900/60 text-amber-300' :
            'bg-emerald-900/60 text-emerald-300'
          }`}>{feature.source}</span>
        )}
      </button>
      {open && feature.description && (
        <div className="px-2 pb-1.5 text-[11px] text-slate-300 leading-relaxed border-t border-slate-700 pt-1">
          <MarkdownText text={feature.description} className="dh-md" />
          {feature.charge && (
            <span className="block mt-0.5 text-[10px] text-slate-500 italic">
              {feature.charge.max} charge{feature.charge.max !== 1 ? 's' : ''} · recharges on {feature.charge.recharge?.on || 'rest'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible JSON tree (for debug panels) ────────────────────────────────

function JsonTree({ data, label, depth = 0, defaultOpen }) {
  const isOpen = defaultOpen ?? depth < 1;
  const [open, setOpen] = useState(isOpen);

  if (data === null || data === undefined) {
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className="text-slate-500 italic">null</span>
      </span>
    );
  }

  if (typeof data !== 'object') {
    const color = typeof data === 'string' ? 'text-emerald-400'
      : typeof data === 'number' ? 'text-amber-300'
      : typeof data === 'boolean' ? 'text-sky-400'
      : 'text-slate-300';
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
        <span className="text-slate-600">{brackets[0]}{brackets[1]}</span>
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-0.5 hover:bg-slate-800/60 rounded px-0.5 -ml-0.5 transition-colors text-left"
      >
        {open
          ? <ChevronDown size={9} className="text-slate-500 shrink-0" />
          : <ChevronRight size={9} className="text-slate-500 shrink-0" />}
        {label != null && <span className="text-violet-300">{label}: </span>}
        {!open && (
          <span className="text-slate-600">
            {brackets[0]}<span className="text-slate-500 mx-0.5">{entries.length} item{entries.length !== 1 ? 's' : ''}</span>{brackets[1]}
          </span>
        )}
        {open && <span className="text-slate-600">{brackets[0]}</span>}
      </button>
      {open && (
        <div className="pl-3 border-l border-slate-800 ml-1">
          {entries.map(([key, val]) => (
            <div key={key} className="leading-relaxed">
              <JsonTree data={val} label={isArray ? String(key) : key} depth={depth + 1} />
            </div>
          ))}
          <span className="text-slate-600">{brackets[1]}</span>
        </div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ label, children, labelUppercase = true }) {
  return (
    <div className="space-y-1">
      <p className={`text-[9px] tracking-widest text-slate-500 font-semibold ${labelUppercase ? 'uppercase' : ''}`}>{label}</p>
      {children}
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
 */
export function CharacterHoverCard({ el, updateFn, onResync, isSyncing, onRoll, onSpendHope, onUseHopeAbility, showResources = false, onDebugMouseEnter, onDebugMouseLeave }) {
  const [showDebug, setShowDebug] = useState(false);
  const traits = el.traits || {};
  const traitOrder = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

  const allFeatures = [
    ...(el.classFeatures || []),
    ...(el.subclassFeatures || []),
    ...(el.ancestryFeatures || []),
    ...(el.communityFeatures || []),
  ];

  const hasDaggerstack = !!el.daggerstackUrl;

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
    <div className="w-[22rem] bg-slate-900 border border-sky-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0">
      {/* ── Header ── */}
      <div className="px-3 py-2.5 bg-sky-950/40 border-b border-sky-900/30 shrink-0">
        <div className="flex items-start gap-2">
          <User size={14} className="text-sky-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-sky-100 leading-tight">{el.name}</span>
              <span className="text-[10px] font-bold text-sky-400/70 bg-sky-900/50 border border-sky-800/50 rounded px-1.5">
                T{el.tier ?? 1}
              </span>
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
              {el.pronouns && (
                <span className="text-[10px] text-slate-500">{el.pronouns}</span>
              )}
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
          <div className="flex items-center gap-1 shrink-0">
            {(el._daggerstackDebug || el._daggerstackLookupTables) && (
              <button
                onClick={() => setShowDebug(d => !d)}
                title="Debug: view raw Daggerstack payloads"
                className={`p-1 rounded transition-colors ${showDebug ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
              >
                <Bug size={11} />
              </button>
            )}
            {hasDaggerstack && onResync && (
              <button
                onClick={onResync}
                disabled={isSyncing}
                title="Re-sync from Daggerstack"
                className="p-1 rounded text-slate-500 hover:text-sky-400 disabled:opacity-40 transition-colors"
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
                className="p-1 rounded text-slate-500 hover:text-sky-400 transition-colors"
              >
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
        {el.playerName && (
          <div className="text-[10px] text-slate-500 mt-0.5 ml-6">Player: {el.playerName}</div>
        )}
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">

        {/* ── Traits ── */}
        {traitOrder.some(t => traits[t] != null) && (
          <Section label={onRoll ? 'Traits — click to roll' : 'Traits'}>
            <div className="grid grid-cols-6 gap-1">
              {traitOrder.map(t => {
                const activeExp = el.selectedExperienceIndex != null
                  ? (el.experiences || [])[el.selectedExperienceIndex]
                  : null;
                const handleClick = onRoll
                  ? () => {
                      const rollText = buildTraitRollText(el.name, t, traits[t] ?? 0, activeExp?.name);
                      const displayName = `${el.name} ${TRAIT_FULL[t]}`;
                      onRoll(rollText, displayName);
                      if (activeExp) {
                        if (onSpendHope) onSpendHope(el.instanceId);
                        else updateFn(el.instanceId, { selectedExperienceIndex: null });
                      }
                    }
                  : undefined;
                return (
                  <TraitChip key={t} trait={t} label={TRAIT_LABELS[t]} score={traits[t] ?? 0} onClick={handleClick} />
                );
              })}
            </div>
            {onRoll && (
              <p className="text-[9px] text-slate-600 mt-0.5">
                {el.selectedExperienceIndex != null
                  ? `+2 from "${(el.experiences || [])[el.selectedExperienceIndex]?.name}" included`
                  : 'Select an experience above to add +2'}
              </p>
            )}
          </Section>
        )}

        {/* ── Experiences ── */}
        {(el.experiences || []).length > 0 && (
          <Section label="EXPERIENCES (Spend a Hope to add to an action roll)" labelUppercase={false}>
            <div className="flex flex-wrap gap-1">
              {el.experiences.map((exp, i) => {
                const selected = el.selectedExperienceIndex === i;
                const currentHope = el.hope ?? (el.maxHope ?? 6);
                const noHope = currentHope === 0;
                const disabled = noHope && !selected;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => updateFn(el.instanceId, {
                      selectedExperienceIndex: selected ? null : i,
                    })}
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
            {(el.hope ?? (el.maxHope ?? 6)) === 0 && (
              <p className="text-[9px] text-red-500/70 mt-0.5">No Hope — cannot use Experiences</p>
            )}
          </Section>
        )}

        {/* ── Defense ── */}
        {(el.evasion != null || el.armorScore) && (
          <Section label="Defense">
            <div className="flex items-center gap-3 text-xs flex-wrap">
              {el.evasion != null && (
                <div className="flex items-center gap-1">
                  <Shield size={11} className="text-cyan-500" />
                  <span className="text-slate-400">Evasion</span>
                  <span className="font-bold text-cyan-200 tabular-nums">{el.evasion}</span>
                </div>
              )}
              {el.armorScore > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Armor</span>
                  <span className="font-bold text-cyan-200 tabular-nums">{el.armorScore}</span>
                  {el.armorName && <span className="text-slate-500">({el.armorName})</span>}
                </div>
              )}
              {(() => { const t = effectiveThresholds(el); return t && (
                <div className="text-slate-400">
                  Thresholds: <span className="text-yellow-300 font-semibold">{t.major}</span>
                  <span className="text-slate-500"> / </span>
                  <span className="text-red-300 font-semibold">{t.severe}</span>
                </div>
              ); })()}
            </div>
          </Section>
        )}

        {/* ── Resource tracks ── */}
        {showResources && <Section label="Resources">
          <div className="space-y-1.5">
            {/* Hope */}
            {(() => { const maxHope = el.maxHope ?? 6; return maxHope > 0 && (
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-amber-400 shrink-0" />
                <span className="text-[11px] text-slate-400 w-10 shrink-0">Hope</span>
                <CheckboxTrack
                  total={maxHope}
                  filled={el.hope ?? maxHope}
                  onSetFilled={(h) => updateFn(el.instanceId, { hope: h })}
                  fillColor="bg-amber-400"
                  label="Hope"
                  verbs={['Gain', 'Spend']}
                />
                <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.hope ?? maxHope}/{maxHope}</span>
              </div>
            ); })()}
            {/* Armor slots */}
            {(el.maxArmor || 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <Shield size={11} className="text-cyan-500 shrink-0" />
                <span className="text-[11px] text-slate-400 w-10 shrink-0">Armor</span>
                <CheckboxTrack
                  total={el.maxArmor}
                  filled={el.currentArmor || 0}
                  onSetFilled={(v) => updateFn(el.instanceId, { currentArmor: v })}
                  fillColor="bg-cyan-500"
                  label="Armor"
                  verbs={['Mark', 'Clear']}
                />
                <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentArmor || 0}/{el.maxArmor}</span>
              </div>
            )}
            {/* HP */}
            {(el.maxHp || 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <Heart size={11} className="text-red-500 shrink-0" />
                <span className="text-[11px] text-slate-400 w-10 shrink-0">HP</span>
                <CheckboxTrack
                  total={el.maxHp}
                  filled={(el.maxHp || 0) - (el.currentHp ?? el.maxHp ?? 0)}
                  onSetFilled={(dmg) => updateFn(el.instanceId, { currentHp: (el.maxHp || 0) - dmg })}
                  fillColor="bg-red-500"
                  label="HP"
                  verbs={['Mark', 'Clear']}
                />
                <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentHp ?? el.maxHp}/{el.maxHp}</span>
              </div>
            )}
            {/* Stress */}
            {(el.maxStress || 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={11} className="text-orange-500 shrink-0" />
                <span className="text-[11px] text-slate-400 w-10 shrink-0">Stress</span>
                <CheckboxTrack
                  total={el.maxStress}
                  filled={el.currentStress || 0}
                  onSetFilled={(s) => updateFn(el.instanceId, { currentStress: s })}
                  fillColor="bg-orange-500"
                  label="Stress"
                  verbs={['Mark', 'Clear']}
                />
                <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentStress || 0}/{el.maxStress}</span>
              </div>
            )}
          </div>
        </Section>}

        {/* ── Weapons ── */}
        {(el.weapons || []).length > 0 && (() => {
          const pairing = detectPairedWeapons(el.weapons);
          let virtualWeapon = null;
          if (pairing) {
            const { primaryWeapon, pairedWeapon } = pairing;
            const featText = pairedWeapon.feature.text || pairedWeapon.feature.description || WEAPON_TAG_DESCRIPTIONS['Paired'];
            const bonus = parsePairedBonus(featText);
            virtualWeapon = {
              name: 'Paired Weapons',
              damage: applyDamageBonus(primaryWeapon.damage, bonus),
              damageType: primaryWeapon.damageType,
              range: primaryWeapon.range,
              trait: primaryWeapon.trait,
            };
          }

          const makeWeaponClick = (w) => {
            if (!onRoll) return undefined;
            const traitKey = (w.trait || '').toLowerCase();
            const traitScore = traits[traitKey] ?? 0;
            const activeExp = el.selectedExperienceIndex != null
              ? (el.experiences || [])[el.selectedExperienceIndex]
              : null;
            return () => {
              const rollText = buildWeaponRollText(el.name, w.name, traitKey, traitScore, activeExp?.name, w.damage);
              const displayName = `${el.name} ${w.name}`;
              onRoll(rollText, displayName);
              if (activeExp) {
                if (onSpendHope) onSpendHope(el.instanceId);
                else updateFn(el.instanceId, { selectedExperienceIndex: null });
              }
            };
          };

          return (
            <Section label={onRoll ? 'Weapons — click to roll' : 'Weapons'}>
              <div className="space-y-1">
                {virtualWeapon && (
                  <WeaponCard
                    weapon={virtualWeapon}
                    traitScore={traits[(virtualWeapon.trait || '').toLowerCase()] ?? 0}
                    onClick={makeWeaponClick(virtualWeapon)}
                    isVirtual
                  />
                )}
                {el.weapons.map((w, i) => (
                  <WeaponCard
                    key={i}
                    weapon={w}
                    traitScore={traits[(w.trait || '').toLowerCase()] ?? 0}
                    onClick={makeWeaponClick(w)}
                  />
                ))}
              </div>
              {onRoll && el.selectedExperienceIndex != null && (
                <p className="text-[9px] text-slate-600 mt-0.5">
                  +2 from &ldquo;{(el.experiences || [])[el.selectedExperienceIndex]?.name}&rdquo; included
                </p>
              )}
            </Section>
          );
        })()}

        {/* ── Inventory ── */}
        {((el.inventory || []).length > 0 || el.gold != null) && (
          <Section label="Inventory">
            {el.gold != null && (
              <div className="flex items-center gap-1 text-[11px] mb-1">
                <Package size={10} className="text-yellow-500 shrink-0" />
                <span className="text-slate-400">Gold:</span>
                <span className="text-yellow-300 font-semibold">{el.gold}</span>
                <span className="text-slate-500">({formatGold(el.gold)})</span>
              </div>
            )}
            {(el.inventory || []).length > 0 && (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {el.inventory.map((item, i) => (
                  <span key={i}>
                    {item.quantity > 1 && <span className="text-slate-300 font-semibold">{item.quantity}× </span>}
                    <span className="text-slate-300">{item.name}</span>
                    {i < el.inventory.length - 1 && <span className="text-slate-600">, </span>}
                  </span>
                ))}
              </p>
            )}
          </Section>
        )}

        {/* ── Features ── */}
        {(allFeatures.length > 0 || el.hopeAbility) && (
          <Section label="Features">
            <div className="space-y-1">
              {el.hopeAbility && (() => {
                const ability = el.hopeAbility;
                let abilityName = null;
                let abilityDesc = '';
                // hopeAbilityName is populated server-side from SRD lookup during Daggerstack sync
                abilityName = el.hopeAbilityName || null;
                if (typeof ability === 'object') {
                  if (!abilityName) abilityName = ability.name || null;
                  abilityDesc = ability.description || ability.text || '';
                } else {
                  const str = String(ability);
                  if (!abilityName) {
                    const colonIdx = str.indexOf(': ');
                    if (colonIdx > 0) {
                      abilityName = str.slice(0, colonIdx);
                      abilityDesc = str.slice(colonIdx + 2);
                    } else {
                      abilityDesc = str;
                    }
                  } else {
                    abilityDesc = str;
                  }
                }
                const currentHope = el.hope ?? (el.maxHope ?? 6);
                const canUse = currentHope >= 3;
                return (
                  <button
                    key="hope-ability"
                    onClick={() => canUse && onUseHopeAbility && onUseHopeAbility(el.instanceId)}
                    disabled={!canUse || !onUseHopeAbility}
                    title={canUse ? 'Spend 3 Hope to use' : 'Not enough Hope (need 3)'}
                    className={`w-full rounded border text-left px-2 py-1.5 transition-colors ${
                      canUse && onUseHopeAbility
                        ? 'border-amber-700/60 bg-amber-950/40 hover:bg-amber-900/50 hover:border-amber-600/70 cursor-pointer'
                        : 'border-slate-700/40 bg-slate-800/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Sparkles size={10} className={canUse && onUseHopeAbility ? 'text-amber-400' : 'text-slate-500'} />
                      {abilityName && (
                        <span className="text-[11px] font-semibold text-amber-200 leading-tight">{abilityName}</span>
                      )}
                      <span className="ml-auto text-[9px] font-semibold text-amber-400/80 shrink-0">3 Hope</span>
                    </div>
                    {abilityDesc && <MarkdownText text={abilityDesc} className="text-[11px] text-slate-300 leading-relaxed dh-md" />}
                  </button>
                );
              })()}
              {allFeatures.map((f, i) => {
                const key = `${f.name}-${i}`;
                const isOpen = (el.expandedFeatures || []).includes(key);
                return (
                  <FeatureChip
                    key={key}
                    feature={f}
                    open={isOpen}
                    onToggle={() => {
                      const current = el.expandedFeatures || [];
                      const next = isOpen ? current.filter(k => k !== key) : [...current, key];
                      updateFn(el.instanceId, { expandedFeatures: next });
                    }}
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Companion ── */}
        {el.companion && (
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
        )}

        {/* ── Description ── */}
        {el.description && (
          <Section label="Description">
            <p className="text-[11px] text-slate-400 leading-relaxed italic">{el.description}</p>
          </Section>
        )}

      </div>
    </div>

    {showDebug && (el._daggerstackDebug || el._daggerstackLookupTables) && (
      <div
        className="absolute top-0 flex gap-2 pl-2"
        style={{ left: '22rem' }}
        onMouseEnter={onDebugMouseEnter}
        onMouseLeave={onDebugMouseLeave}
      >
        {[
          ['Supabase Row', el._daggerstackDebug?.supabaseRow],
          ['Resolved Lookups', el._daggerstackDebug?.resolved],
          ['Lookup Tables', el._daggerstackLookupTables],
        ].filter(([, data]) => data).map(([label, data]) => (
          <div key={label} className="w-80 h-[80vh] bg-slate-900 border border-amber-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
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

    </div>
  );
}
