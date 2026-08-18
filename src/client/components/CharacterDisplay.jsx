import {
  User, Shield, AlertCircle, AlertTriangle, Swords, Package,
  ChevronDown, ChevronRight, Dices, X, Flame, Mountain, Droplets, Wind, Sparkles, Sticker,
  Minus, Plus,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MarkdownText } from '../lib/markdown.js';
import { effectiveThresholds, parseBeastformBonus, getEvasionModifierTotal, formatEvasionModifierTooltip } from '../lib/helpers.js';
import { buildModifierChipHoverTitle } from '../lib/modifier-chip-title.js';
import {
  traitScoreNumberColorClass,
  traitScoreNumberSizeClassTraitChip,
  traitScoreNumberSizeClassWeaponBadge,
} from '../lib/trait-score-display.js';

export { parseBeastformBonus, getEvasionModifierTotal, formatEvasionModifierTooltip } from '../lib/helpers.js';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { isCharacterComplete, recomputeCharacter, detectPairedWeapons, parsePairedBonus, applyDamageBonus, detectVersatileWeapons, detectOtherworldlyWeapons, detectChargedWeapons, getEffectiveWeaponRange, runCharacterRender } from '../lib/character-calc.js';
import { mergeV2DeclarativeSheetOverlay } from '../lib/v2-declarative-sheet.js';
import { FeatureResourceCostIcons } from './FeatureResourceCostIcons.jsx';
import { FrequencyCycleChipSuffix } from '../lib/frequency-cycle-ui.jsx';
import { GuideFeatureCard, GuideFeatureCardChips } from './features/GuideFeatureCard.jsx';
import { WidthSortedFlexWrap } from './WidthSortedFlexWrap.jsx';
import {
  buildFeatureCardModelForCharacter,
  buildGuideFeatureTableSnapshot,
  collectSheetCardsForCharacter,
  collectShapePlacementChipsForCharacter,
} from '../lib/build-feature-card-model.js';
import { getFeatureUsageKeyForGuideFeature } from '../lib/feature-usage-key.js';
import { getWeaponSheetLabel, getWeaponSheetLabelParts, getWeaponSheetDisplayKey } from '../lib/sheet-display-names.js';
import { SheetDisplayLabelInline } from '../lib/sheet-display-label-inline.jsx';
import {
  buildActionChipSlotsForSheet,
  shouldUseIntrinsicWidthForActionsStripSlot,
} from '../lib/v2-action-chip-strip.js';
import { omitShapeId } from '../lib/json-schema-dh.js';
import { RoguesDodge } from '../../features-v2/classes/Rogue.js';
import { DeclarativeSchemaSheetCard } from './DeclarativeSchemaCard.jsx';
import { rangeBandNameToFt, RANGE_BANDS_FT } from '../lib/map-range.js';
import { weaponMaxRangeFt } from '../lib/player-adversary-target-aid.js';
import { Tooltip } from './Tooltip.jsx';
import { TierShieldBadge } from './TierShieldBadge.jsx';
import { LevelBadge } from './LevelBadge.jsx';
import {
  CharacterStatBlockGraphic,
  CharacterSheetEmphasisCard,
  HopeHeroTrack,
} from './CharacterStatBlockGraphic.jsx';
import {
  resolveHopeFeatureName,
  getOrderedGuideFeatureEntries,
  getOrderedGuideLoadoutEntries,
  resolveLoadoutAbilityFeatRow,
} from '../lib/guide-feature-entries.js';
import {
  CharacterSheetSourceHighlightProvider,
  CharacterSheetHighlightSurface,
  useCharacterSheetSourceBadgeHover,
  useCharacterSheetSourceHighlightState,
} from './CharacterSheetSourceHighlight.jsx';
import {
  shouldDimGuideFeatRow,
  shouldDimFeatOrAbilityRow,
  SHEET_SOURCE_DIM_CLASS,
} from '../lib/source-badge-sheet-highlight.js';
import {
  characterHasFeatureCardActions,
  characterHasLoadoutCardActions,
} from '../lib/character-sheet-card-actions.js';
import {
  goldToSlots,
  isGoldOverSrdCap,
  formatGold,
  parseGoldInput,
} from '../lib/character-gold.js';
import {
  normalizeInventoryList,
  removeInventoryEntry,
  updateInventoryEntryQuantity,
  updateInventoryEntryName,
  isLibraryLinkedInventoryEntry,
} from '../lib/character-inventory.js';
import { DH_OUTSIDE_DISMISS_EXEMPT_ATTR } from '../lib/useHoverOverlay.js';

export {
  resolveHopeFeatureName,
  getOrderedGuideFeatureEntries,
  getOrderedGuideLoadoutEntries,
  resolveLoadoutAbilityFeatRow,
  characterHasFeatureCardActions,
  characterHasLoadoutCardActions,
};

export { goldToSlots, isGoldOverSrdCap, formatGold, parseGoldInput };

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
/** First row of the 3×2 trait grid (spellcast above aligns across these three columns). */
const TRAIT_GRID_TOP = TRAIT_ORDER.slice(0, 3);
/** Second row of the trait grid. */
const TRAIT_GRID_BOTTOM = TRAIT_ORDER.slice(3, 6);

/** Effective trait score including weapon/armor/beastform modifiers (matches TraitChip display). */
export function computeEffectiveTraitScore(el, t) {
  const traits = el.traits || {};
  const score = traits[t] ?? 0;
  const wMod = el.weaponMods?.traits?.[t] ?? 0;
  const aMod = el.armorMods?.traits?.[t] ?? 0;
  const beastformTraitBonus = parseBeastformBonus(el.activeBeastform?.trait_bonus);
  const bfMod = beastformTraitBonus?.stat === t ? beastformTraitBonus.bonus : 0;
  return score + wMod + aMod + bfMod;
}

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
      <p className={`text-[9px] tracking-widest text-dh-muted font-semibold ${labelUppercase ? 'uppercase' : ''}`}>{label}</p>
      {children}
    </div>
  );
}

// ─── Trait chip ───────────────────────────────────────────────────────────────

function TraitChip({ trait, label, score, onClick, mod, modSource }) {
  const [justRolled, setJustRolled] = useState(false);
  const positive = score > 0;
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
  const numSizeCls = traitScoreNumberSizeClassTraitChip(score);
  const numColorCls = traitScoreNumberColorClass(score);
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={title}
      className={`flex flex-col items-center justify-start gap-0 rounded px-1 py-0.5 border select-none
        ${justRolled ? 'dh-tint-roll-flash' :
          hasModifier ? 'border-amber-600/70 bg-amber-950/30' :
          score !== 0 ? 'border-dh-strong bg-dh-raised/50' : 'border-dh-strong bg-dh-raised/30'}
        ${clickable ? 'dh-sheet-clickable-chip cursor-pointer hover:brightness-125 hover:border-sky-500/70 group transition-all' : ''}`}
    >
      <span className="text-[13px] font-semibold uppercase tracking-wide text-dh-muted text-center leading-none">
        {label}
      </span>
      <div className="mt-0.5 flex min-h-[2rem] w-full items-center justify-center">
        <span className={`font-bold tabular-nums leading-none tracking-tight ${numSizeCls} ${numColorCls}`}>{display}</span>
      </div>
      {showModLine && (
        <span className={`text-[9px] font-semibold tabular-nums leading-none ${mod > 0 ? 'text-sky-400' : 'text-sky-500/90'}`}>
          {mod > 0 ? `+${mod}` : String(mod)}
        </span>
      )}
      {!showModLine && verbs.length > 0 && (
        <div className="flex flex-col items-center mt-1 gap-px w-full">
          <span className="text-[8px] text-dh-muted text-center leading-tight px-0.5">
            {verbs.slice(0, 2).join(' · ')}
          </span>
          {verbs[2] != null && (
            <span className="text-[8px] text-dh-muted text-center leading-tight px-0.5">{verbs[2]}</span>
          )}
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
      className={`inline-flex items-center justify-center gap-2 rounded border px-2.5 py-0.5 transition-all
        ${interactive
          ? `dh-sheet-clickable-chip select-none cursor-pointer hover:brightness-110
             ${justRolled ? 'dh-tint-roll-flash' : 'dh-tint-spellcast-label'}`
          : 'dh-tint-spellcast-label cursor-default opacity-95'
        }`}
    >
      <Sparkles
        className={`w-4 h-4 shrink-0 ${justRolled ? 'text-emerald-300' : 'text-current'}`}
        strokeWidth={2.25}
        aria-hidden
      />
      <span className="text-[13px] font-semibold uppercase tracking-wide leading-tight">Spellcast</span>
    </div>
  );
}

// ─── Weapon card ──────────────────────────────────────────────────────────────

/** Game Table only: disable when no adversaries are in this weapon's range on the map. */
export function outOfRangeDisableReason(weapon, getValidTargets, instanceId, ancestryFeatures) {
  if (!getValidTargets || !instanceId) return null;
  const rangeStr = getEffectiveWeaponRange(weapon, ancestryFeatures) || weapon.effectiveRange || weapon.range;
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const ft = rangeBandNameToFt(rangeStr);
  if (ft == null) return null;
  const targets = getValidTargets(instanceId, { weaponRangeFt: ft }) ?? [];
  return targets.length === 0 ? 'No targets in range' : null;
}

function WeaponCard({
  weapon,
  traitScore,
  onClick,
  isVirtual,
  purple,
  devastating,
  onDevastatingToggle,
  pompousWarning,
  v2DisableReason,
  outOfRangeReason,
  sheetDisplayLabel,
  sheetDisplayParts,
  hasSheetDisplayOverride,
  onSheetDisplayNameClick,
}) {
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
    baseBorder = justRolled ? 'dh-tint-roll-flash' : 'dh-tint-purple-row';
  } else if (isVirtual) {
    baseBorder = justRolled ? 'dh-tint-roll-flash' : 'dh-tint-amber-card';
  } else if (disableMsg) {
    baseBorder = 'border-amber-600/60 bg-amber-950/20 opacity-60';
  } else {
    baseBorder = justRolled ? 'dh-tint-roll-flash' : 'border-dh-border bg-dh-raised/55';
  }

  const iconColor = justRolled ? 'text-green-400'
    : purple ? 'text-purple-500/70'
    : isVirtual ? 'text-dh-hope-soft'
    : clickable ? 'text-dh-muted group-hover:text-sky-400'
    : 'text-dh-muted';
  const nameColor = purple ? 'text-purple-100' : isVirtual ? 'text-dh-hope-soft' : 'text-dh';
  const featDescColor = purple ? 'text-purple-400/80' : isVirtual ? 'text-dh-hope opacity-90' : 'text-dh-muted';

  const hasStatsRow =
    !!(weapon.damage || (weapon.effectiveRange ?? weapon.range));
  const damageTypeBadgeClass = purple
    ? 'border-purple-700/40 bg-purple-950/30 text-purple-300'
    : isVirtual
      ? 'border-amber-800/35 bg-amber-950/25 text-dh-hope-soft'
      : 'border-dh-border/60 bg-dh-raised/50 text-dh-muted';

  const nameLine = sheetDisplayLabel ?? weapon.name;
  const labelParts = sheetDisplayParts ?? null;
  const showCustomize = typeof onSheetDisplayNameClick === 'function';

  const card = (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
      title={!disableMsg && clickable && traitLabel ? `Roll ${weapon.name} (${TRAIT_FULL[traitKey]})` : undefined}
      className={`w-full min-w-0 rounded border px-2 py-1.5 select-none text-[11px] transition-all
        ${baseBorder}
        ${clickable || showCustomize ? 'dh-sheet-clickable-chip cursor-pointer hover:brightness-125 hover:border-sky-500/50 group' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Swords size={11} className={`shrink-0 transition-colors ${iconColor}`} />
        <div className="relative flex-1 min-w-0 flex items-center">
          {showCustomize && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSheetDisplayNameClick(e);
              }}
              title="Custom name"
              className={`absolute left-0 top-1/2 z-10 -translate-y-1/2 p-0.5 rounded text-dh-muted hover:text-sky-400 transition-opacity
                ${hasSheetDisplayOverride ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'}`}
            >
              <Sticker size={10} aria-hidden />
            </button>
          )}
          <span
            className={`text-sm font-semibold min-w-0 truncate w-full transition-[padding] duration-75 inline-flex items-baseline gap-0.5 ${nameColor}
              ${showCustomize ? (hasSheetDisplayOverride ? 'pl-5' : 'pl-0 group-hover:pl-5') : ''}`}
          >
            {labelParts?.parenthetical != null ? (
              <SheetDisplayLabelInline
                primary={labelParts.primary}
                parenthetical={labelParts.parenthetical}
                primaryClassName="min-w-0 truncate"
                parenClassName="text-[9px] font-normal text-dh-muted shrink-0"
              />
            ) : (
              nameLine
            )}
          </span>
        </div>
        {weapon.damageType && (
          <span className={`text-[9px] rounded px-1 py-0.5 border shrink-0 ${damageTypeBadgeClass}`}>
            {weapon.damageType}
          </span>
        )}
        {traitLabel && (
          <span
            className={`text-[9px] rounded px-1 py-0.5 border shrink-0 tabular-nums font-bold
            ${traitScore_ !== 0 ? 'bg-dh-raised border-dh-strong text-dh-muted' : 'bg-dh-raised/60 border-dh-strong text-dh-muted'}`}
          >
            <span className="text-dh-muted">{traitLabel}</span>{' '}
            <span
              className={`inline-flex min-h-[0.875rem] items-center ${traitScoreNumberColorClass(traitScore_)} ${traitScoreNumberSizeClassWeaponBadge(traitScore_)}`}
            >
              {traitDisplay}
            </span>
          </span>
        )}
        {clickable && (
          <Dices size={10} className={`shrink-0 transition-colors ${justRolled ? 'text-green-400' : 'text-dh-muted group-hover:text-sky-400'}`} />
        )}
      </div>
      {hasStatsRow && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-5 mt-0.5 text-[11px]">
          {weapon.damage && (
            <span className="text-dh font-semibold tabular-nums">
              {devastating ? 'd20' + ((weapon.damage.match(/[+-]\d+/) || [''])[0]) : weapon.damage}
            </span>
          )}
          {(weapon.effectiveRange ?? weapon.range) && (
            <span className="text-dh-muted">{weapon.effectiveRange ?? weapon.range}</span>
          )}
        </div>
      )}
      {feat && featDesc && (
        <div className={`text-[10px] mt-0.5 pl-5 ${featDescColor}`}>
          {feat.name}: {featDesc}
        </div>
      )}
      {onDevastatingToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onDevastatingToggle(); }}
          className={`dh-sheet-clickable-chip text-[9px] mt-1 ml-5 px-1.5 py-0.5 rounded border transition-colors ${
            devastating
              ? 'bg-red-900/50 border-red-700/60 text-red-200'
              : 'bg-dh-raised/60 border-dh-border text-dh-muted hover:text-dh hover:border-dh-strong'
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

// ─── Exported components ──────────────────────────────────────────────────────

/**
 * Class, subclass, ancestry, community, domains, pronouns — “feature source” chips (plus optional incomplete).
 * Used inside `CharacterIdentityTitleRow` and `GameTableCharacterSheetTitleBar`.
 */
export function CharacterIdentitySourceBadges({ el, showIncomplete = false, className = '', children }) {
  const charCheck = showIncomplete ? isCharacterComplete(el) : null;
  const badgeHover = useCharacterSheetSourceBadgeHover();
  return (
    <div className={`flex items-center gap-1.5 flex-wrap min-w-0 ${className}`}>
      {charCheck && !charCheck.complete && (
        <span
          className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/50 text-dh border border-amber-700/60 shrink-0"
          title={`Missing: ${charCheck.missing.join(', ')}`}
          {...badgeHover('incomplete')}
        >
          <AlertTriangle size={9} />
          Incomplete
        </span>
      )}
      {el?.class && (
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 bg-sky-950/55 border-sky-600/55 text-sky-100/95"
          title="Highlight class features"
          {...badgeHover('class')}
        >
          {el.class}
        </span>
      )}
      {el?.subclass && (
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 bg-indigo-950/50 border-indigo-600/50 text-indigo-200"
          title="Highlight subclass features"
          {...badgeHover('subclass')}
        >
          {el.subclass}
        </span>
      )}
      {el?.pronouns && (
        <span
          className="text-[10px] dh-text-spellcast-header-sub shrink-0 px-1.5 py-0.5 rounded bg-dh-hover/35 border border-dh-strong/25"
          {...badgeHover('pronouns')}
        >
          {el.pronouns}
        </span>
      )}
      {(el?.ancestry || []).map(a => (
        <span
          key={a}
          className="text-[9px] bg-amber-900/40 border border-amber-800/40 text-dh rounded px-1.5 py-0.5 shrink-0"
          title={`Highlight ${a} features`}
          {...badgeHover('ancestry', { name: a })}
        >
          {a}
        </span>
      ))}
      {el?.community && (
        <span
          className="text-[9px] bg-emerald-900/40 border border-emerald-800/40 text-emerald-300 rounded px-1.5 py-0.5 shrink-0"
          title="Highlight community features"
          {...badgeHover('community')}
        >
          {el.community}
        </span>
      )}
      {(el?.domains || []).map(d => (
        <span key={d} className="dh-magic-chip shrink-0" title={`Highlight ${d} domain cards`} {...badgeHover('domain', { name: d })}>
          {d}
        </span>
      ))}
      {children}
    </div>
  );
}

/**
 * One-row identity chrome: name, tier/level shields, class/subclass badges, pronouns, ancestry/community/domains.
 * Shared by `CharacterIdentityHeader` and `ItemDetailModal` (Game Table character editor) so the sheet and editor align.
 */
export function CharacterIdentityTitleRow({ el, showIncomplete = false, className = '', children }) {
  const nm = el?.name || 'Unnamed Character';
  return (
    <div className={`flex items-center gap-1.5 flex-wrap min-w-0 ${className}`}>
      <span className="text-sm font-bold dh-text-spellcast-header leading-tight min-w-0 max-w-[min(100%,24rem)] truncate" title={nm}>
        {nm}
      </span>
      <TierShieldBadge tier={el?.tier ?? 1} scaledFromTier={el?._scaledFromTier} />
      {el?.level != null && <LevelBadge level={el.level} />}
      <CharacterIdentitySourceBadges el={el} showIncomplete={showIncomplete}>
        {children}
      </CharacterIdentitySourceBadges>
    </div>
  );
}

export function CharacterIdentityHeader({ el, showIncomplete = false, actions, onOpenImageLightbox }) {
  const portrait = el?.imageUrl;
  return (
    <div className="px-3 py-2.5 border-b dh-tint-spellcast-strip">
      <div className="flex items-center gap-2 min-w-0">
        {portrait ? (
          <img
            src={portrait}
            alt=""
            className={`w-7 h-7 rounded-full object-cover shrink-0 border border-dh-border/60${onOpenImageLightbox ? ' cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            aria-hidden
            onClick={onOpenImageLightbox ? (e) => { e.stopPropagation(); onOpenImageLightbox(portrait); } : undefined}
          />
        ) : (
          <User size={14} className="dh-text-magic-icon shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <CharacterIdentityTitleRow el={el} showIncomplete={showIncomplete} />
        </div>
        {actions && (
          <div className="flex items-center gap-1 shrink-0 self-center">{actions}</div>
        )}
      </div>
      {el.playerName && (
        <div className="text-[10px] text-dh-muted mt-1 ml-6">Player: {el.playerName}</div>
      )}
    </div>
  );
}

/**
 * Six traits in a 3×2 grid (full trait names).
 *
 * Props:
 *   onTraitClick(traitKey) — when provided, chips become clickable action rolls.
 */
export function CharacterTraitGrid({ el, onTraitClick, onSpellcastRoll, omitOuterSection, sheetEmphasisTitle, sheetEmphasisSubtitle }) {
  const traits = el.traits || {};
  if (!TRAIT_ORDER.some(t => traits[t] != null)) return null;
  const weaponMods = el.weaponMods || {};
  const armorMods = el.armorMods || {};
  const beastformTraitBonus = parseBeastformBonus(el.activeBeastform?.trait_bonus);
  /** Resolved in `recomputeCharacter`: single trait for rolls; multiclass compares primary vs multiclass spellcast traits and picks the higher effective score. */
  const spellcastKey = el.spellcastTrait ? el.spellcastTrait.toLowerCase() : null;
  const spellcastInTopRow = !!(spellcastKey && TRAIT_GRID_TOP.includes(spellcastKey));
  const spellcastInBottomRow = !!(spellcastKey && TRAIT_GRID_BOTTOM.includes(spellcastKey));

  const renderTraitStack = (t) => {
    const wMod = weaponMods.traits?.[t] ?? 0;
    const aMod = armorMods.traits?.[t] ?? 0;
    const bfMod = beastformTraitBonus?.stat === t ? beastformTraitBonus.bonus : 0;
    const effectiveScore = computeEffectiveTraitScore(el, t);
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
    return (
      <div key={t} className="flex flex-col items-stretch gap-1 min-w-0">
        <TraitChip
          trait={t}
          label={TRAIT_FULL[t]}
          score={effectiveScore}
          onClick={onTraitClick ? () => onTraitClick(t) : undefined}
          mod={undefined}
          modSource={modSource || undefined}
        />
      </div>
    );
  };

  const spellcastRowCells = (rowTraits) =>
    rowTraits.map(t => (
      <div key={`spell-${t}`} className="flex justify-center items-center min-h-0 py-0">
        {spellcastKey === t ? <SpellcastChip onClick={onSpellcastRoll || undefined} /> : null}
      </div>
    ));

  const gridInner = (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        {spellcastInTopRow ? spellcastRowCells(TRAIT_GRID_TOP) : null}
        {TRAIT_GRID_TOP.map(t => renderTraitStack(t))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {TRAIT_GRID_BOTTOM.map(t => renderTraitStack(t))}
        {spellcastInBottomRow ? spellcastRowCells(TRAIT_GRID_BOTTOM) : null}
      </div>
    </div>
  );

  const labeled = omitOuterSection ? (
    gridInner
  ) : (
    <Section label={onTraitClick ? 'Traits — click to roll' : 'Traits'}>
      {gridInner}
    </Section>
  );

  if (sheetEmphasisTitle) {
    return (
      <CharacterSheetEmphasisCard title={sheetEmphasisTitle} subtitle={sheetEmphasisSubtitle}>
        {labeled}
      </CharacterSheetEmphasisCard>
    );
  }
  return labeled;
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
            <Shield size={11} className="text-cyan-400 shrink-0" />
            <span className="text-dh-muted">Evasion</span>
            <span className={`font-bold tabular-nums ${totalEvasionMod ? 'text-sky-300' : 'text-sky-200'}`}>{el.evasion}</span>
            {totalEvasionMod ? <span className={`text-[10px] font-semibold tabular-nums text-sky-400`}>({totalEvasionMod > 0 ? '+' : ''}{totalEvasionMod})</span> : null}
          </Tooltip>
        )}
        {el.armorScore > 0 && (
          <div className="flex items-center gap-1" title={armorModTooltip || undefined}>
            <span className="text-dh-muted">Armor</span>
            <span className={`font-bold tabular-nums ${wm.armorScore ? 'text-sky-300' : 'text-cyan-200'}`}>{el.armorScore}</span>
            {wm.armorScore ? <span className={`text-[10px] font-semibold tabular-nums text-sky-400`}>({wm.armorScore > 0 ? '+' : ''}{wm.armorScore})</span> : null}
            {el.armorName && <span className="text-dh-muted">({el.armorName})</span>}
            {armorFeature && (
              <span
                title={armorFeature.description}
                className={`text-[9px] rounded px-1 py-0.5 border ${
                  isStatModFeature
                    ? 'bg-dh-raised/60 border-dh-border text-dh-muted'
                    : 'bg-teal-900/40 border-teal-700/50 text-teal-300'
                }`}
              >{armorFeature.name}</span>
            )}
          </div>
        )}
        {thresholds && (
          <div className="text-dh-muted" title={thresholdModTooltip || severeModTooltip || undefined}>
            Thresholds:{' '}
            {(earthBonus > 0 || ancestryMajorBonus > 0) ? (
              <>
                <span className="text-dh-muted font-semibold">{thresholds.major - earthBonus - ancestryMajorBonus}</span>
                {ancestryMajorBonus > 0 && <span className="text-dh-muted"> +{ancestryMajorBonus}{ancestryBonusSource ? ` (${ancestryBonusSource})` : ''}</span>}
                {earthBonus > 0 && <span className="text-dh-muted"> +{earthBonus} (Earth)</span>}
                <span className="text-dh-muted"> = </span>
              </>
            ) : null}
            <span className="text-dh font-semibold">{thresholds.major}</span>
            <span className="text-dh-muted"> / </span>
            <span className={`font-semibold ${wm.severeThreshold ? 'text-orange-400' : 'text-red-400'}`} title={severeModTooltip || undefined}>
              {(earthBonus > 0 || ancestrySevereBonus > 0) ? (
                <>
                  <span className="opacity-50">{thresholds.severe - earthBonus - ancestrySevereBonus}</span>
                  {ancestrySevereBonus > 0 && <span className="text-dh-muted font-normal"> +{ancestrySevereBonus}{ancestryBonusSource ? ` (${ancestryBonusSource})` : ''}</span>}
                  {earthBonus > 0 && <span className="text-dh-muted font-normal"> +{earthBonus} (Earth)</span>}
                  <span className="text-dh-muted font-normal"> = </span>
                </>
              ) : null}
              {thresholds.severe}{wm.severeThreshold ? <span className="text-[10px] text-orange-400"> ({wm.severeThreshold > 0 ? '+' : ''}{wm.severeThreshold})</span> : null}
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
          : 'dh-sheet-clickable-chip bg-violet-950/40 border-violet-700/50 text-violet-200 hover:bg-violet-900/50 hover:border-violet-600'
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
 *   experiencesAsBadges     — when true, experiences are non-clickable badges (selection moves to intent panel)
 *   hope / maxHope            — current Hope values for gating
 *
 * Modifier chips (armor roll mods, active modifiers, beastform advantages, cross-sheet chips) render in
 * the Actions column via `CharacterSheetModifierChips` inside `CharacterFeatureActionsEmphasisCard`.
 */
export function CharacterExperiences({ el, selectedIndex, onSelect, experiencesAsBadges = false, hope, maxHope, omitOuterSection, sheetEmphasisTitle }) {
  const experiences = el.experiences || [];
  if (!experiences.length) return null;

  const wrapSheet = (node) =>
    sheetEmphasisTitle ? (
      <CharacterSheetEmphasisCard title={sheetEmphasisTitle}>{node}</CharacterSheetEmphasisCard>
    ) : node;

  function ExpBlock({ interactive, children }) {
    if (omitOuterSection) return <>{children}</>;
    if (interactive) {
      return (
        <Section label="EXPERIENCES (Spend a Hope to add to an action roll)" labelUppercase={false}>
          {children}
        </Section>
      );
    }
    return <Section label="Experiences">{children}</Section>;
  }

  const experienceButtons = onSelect && !experiencesAsBadges;

  if (!experienceButtons) {
    return wrapSheet(
      <ExpBlock interactive={false}>
        <div className="flex flex-wrap gap-1">
          {experiences.map((exp, i) => (
            <span
              key={i}
              className="text-[11px] rounded px-1.5 py-0.5 border bg-dh-raised border-dh-border text-dh"
            >
              {exp.name}
              {exp.score != null && <span className="font-bold ml-1 text-sky-400">+{exp.score}</span>}
            </span>
          ))}
        </div>
      </ExpBlock>,
    );
  }

  const currentHope = hope ?? (maxHope ?? 6);
  return wrapSheet(
    <ExpBlock interactive>
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
                  ? 'opacity-35 cursor-not-allowed bg-dh-raised border-dh-border text-dh-muted'
                  : selected
                    ? 'dh-sheet-clickable-chip dh-tint-sky-row border ring-1 ring-sky-500/50 cursor-pointer'
                    : 'dh-sheet-clickable-chip bg-dh-raised border-dh-border text-dh hover:bg-dh-hover/60 hover:border-dh-strong cursor-pointer'}`}
            >
              <span>{exp.name}</span>
              {exp.score != null && (
                <span className={`font-bold ml-1 ${disabled ? 'text-dh-muted' : 'text-sky-400'}`}>+{exp.score}</span>
              )}
            </button>
          );
        })}
      </div>
      {currentHope === 0 && (
        <p className="text-[9px] text-red-500/70 mt-0.5">No Hope — cannot use Experiences</p>
      )}
    </ExpBlock>,
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
  const isClearStress = mod.mode === 'clearStress';
  const isPersistent = mod.type === 'persistent';
  const hasUsageModes = Array.isArray(mod.usageModes) && mod.usageModes.length >= 1;

  const baseLabel = mod.name + (mod.dice ? ` (${mod.dice})` : mod.value != null ? ` (${mod.value})` : mod.bonus != null ? ` +${mod.bonus}` : '');

  let colorCls;
  if (mod.name === 'Prayer Die')
    colorCls = selected
      ? 'bg-violet-800/70 border-violet-500 text-violet-100 ring-1 ring-violet-500/50'
      : 'bg-violet-950/40 border-violet-700/60 text-violet-300 hover:bg-violet-900/40';
  else if (mod.name === 'Sneak Attack') colorCls = selected ? 'bg-red-800/70 border-red-500 text-red-100 ring-1 ring-red-500/50' : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/40';
  else if (mod.name === 'No Mercy') colorCls = selected ? 'bg-amber-800/70 border-amber-500 text-dh ring-1 ring-amber-500/50' : 'bg-amber-950/40 border-amber-700/60 text-dh hover:bg-amber-900/40';
  else if (mod.name === RoguesDodge.name) colorCls = selected ? 'bg-cyan-800/70 border-cyan-500 text-cyan-100 ring-1 ring-cyan-500/50' : 'bg-cyan-950/40 border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/40';
  else if (mod.name === 'Evolution') colorCls = selected ? 'bg-violet-800/70 border-violet-500 text-violet-100 ring-1 ring-violet-500/50' : 'bg-violet-950/40 border-violet-700/60 text-violet-300 hover:bg-violet-900/40';
  else if (mod.name === 'Dread Visage') colorCls = selected ? 'bg-red-800/70 border-red-500 text-red-100 ring-1 ring-red-500/50' : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/40';
  else colorCls = selected ? 'dh-tint-sky-row border ring-1 ring-sky-500/50' : 'dh-tint-trait-chip border hover:brightness-110';

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

  const title = buildModifierChipHoverTitle(mod, { tooltip, eligible });

  return (
    <button
      type="button"
      title={title}
      onClick={clickable ? (onUse || onSelect) : undefined}
      className={`text-[11px] rounded px-1.5 py-0.5 border transition-colors flex items-center gap-1 ${clickable ? 'dh-sheet-clickable-chip cursor-pointer' : 'cursor-default'} ${colorCls} ${ineligibleCls}`}
    >
      <span>{baseLabel}</span>
      {isClearStress && <span className="text-[9px] opacity-70">→ clr Stress</span>}
      {isPersistent && (
        <FrequencyCycleChipSuffix frequency={mod.refreshOn ?? 'rest'} iconSize={10} className="opacity-80" />
      )}
    </button>
  );
}

/**
 * Armor roll modifiers, active modifier bin, beastform advantage toggles, and cross-sheet V2 chips.
 * Rendered inside the Actions emphasis card below the V2 guide/loadout chip strip.
 */
export function CharacterSheetModifierChips({
  el,
  rollModifiers = [],
  selectedRollModIndex,
  onSelectRollMod,
  selectedModId,
  onSelectMod,
  onUseMod,
  onUseMode,
  modifierEligibility,
  beastformAdvantages,
  selectedBeastformAdvantage,
  onSelectBeastformAdvantage,
  crossSheetChips,
  onCrossSheetChipClick,
}) {
  const activeModifiers = el.activeModifiers || [];
  const hasRollMods = rollModifiers?.length > 0;
  const hasBeastformAdvantages = beastformAdvantages?.length > 0;
  const hasCrossSheet = (crossSheetChips?.length ?? 0) > 0;
  const nonPrayerMods = activeModifiers.filter((mod) => mod.name !== 'Prayer Die');
  const hasModifiers =
    hasRollMods || nonPrayerMods.length > 0 || hasBeastformAdvantages || hasCrossSheet;
  if (!hasModifiers) return null;

  const hasInteractiveModifiers = !!(
    onSelectRollMod ||
    onSelectMod ||
    onSelectBeastformAdvantage ||
    onCrossSheetChipClick ||
    (hasRollMods && rollModifiers.some((rm) => !rm.autoApply))
  );

  return (
    <Section label="Temporary actions">
      <div className="flex flex-wrap gap-1">
        {!hasInteractiveModifiers ? (
          <>
            {hasRollMods &&
              rollModifiers.map((rm, i) => (
                <span
                  key={`rm-${i}`}
                  title={rm.autoApply ? `Always applied to ${rm.rollType} rolls` : rm.description}
                  className={`text-[11px] rounded px-1.5 py-0.5 border ${
                    rm.autoApply
                      ? 'bg-teal-950/40 border-teal-700/50 text-teal-300'
                      : 'bg-amber-950/30 border-amber-700/50 text-dh'
                  }`}
                >
                  {rm.name}
                  <span className={`font-bold ml-1 ${rm.autoApply ? 'text-teal-400' : 'text-dh-hope'}`}>
                    +{rm.score}
                  </span>
                </span>
              ))}
            {nonPrayerMods.map((mod, i) => (
              <ModifierChip key={mod.id || i} mod={mod} />
            ))}
            {hasBeastformAdvantages &&
              beastformAdvantages.map((adv) => (
                <span
                  key={adv}
                  title="Beastform advantage"
                  className={`text-[11px] rounded px-1.5 py-0.5 border ${
                    selectedBeastformAdvantage === adv
                      ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                      : 'bg-dh-raised border-dh-border text-dh-muted'
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
          </>
        ) : (
          <>
            {hasRollMods &&
              rollModifiers.map((rm, i) => {
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
                    className={`dh-sheet-clickable-chip text-[11px] rounded px-1.5 py-0.5 border transition-colors cursor-pointer
                      ${
                        selected
                          ? 'bg-amber-900/60 border-amber-600 text-dh ring-1 ring-amber-500/50'
                          : 'bg-amber-950/30 border-amber-700/50 text-dh hover:bg-amber-900/40 hover:border-amber-600'
                      }`}
                  >
                    <span>{rm.name}</span>
                    <span className="font-bold ml-1 text-dh-hope">+{rm.score}</span>
                  </button>
                );
              })}
            {nonPrayerMods.map((mod, i) => (
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
            {hasBeastformAdvantages &&
              beastformAdvantages.map((adv) => {
                const isSelected = selectedBeastformAdvantage === adv;
                return (
                  <button
                    key={adv}
                    type="button"
                    title={
                      isSelected
                        ? 'Advantage active — +d6 to next beastform attack'
                        : 'Click to activate this beastform advantage'
                    }
                    onClick={
                      onSelectBeastformAdvantage
                        ? () => onSelectBeastformAdvantage(isSelected ? null : adv)
                        : undefined
                    }
                    className={`dh-sheet-clickable-chip text-[11px] rounded px-1.5 py-0.5 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-800/70 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/50'
                        : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-600'
                    }`}
                  >
                    {adv}
                    {isSelected && <span className="ml-1 text-emerald-300">+d6</span>}
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
          </>
        )}
      </div>
    </Section>
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
  omitOuterSection,
  sheetEmphasisTitle,
  /** When set (Game Table), only list weapons whose max range (ft) is ≥ this distance to the target. */
  weaponReachMinFt,
  /** Shown when {@link weaponReachMinFt} filters out all weapons. */
  emptyReachMessage,
  /** When true, omit weapons that would render disabled (V2 lock, Pompous, Charged at max Stress, no map targets in range). */
  filterOutDisabledWeapons = false,
  /** Adversary map pin: show this text to the right of the title when there are no weapon rows (instead of a paragraph below). */
  titleRowEmptyMessage,
  /** Game Table: open dialog to set a table-local display name (`{ bucket, key, originalName }`). */
  onSheetDisplayNameEdit,
}) {
  const weaponSheetProps = (w) => {
    const key = getWeaponSheetDisplayKey(w, el);
    if (!onSheetDisplayNameEdit || !key) return {};
    return {
      sheetDisplayLabel: getWeaponSheetLabel(el, w),
      sheetDisplayParts: getWeaponSheetLabelParts(el, w),
      hasSheetDisplayOverride: !!el.sheetDisplayNames?.weapons?.[key],
      onSheetDisplayNameClick: () => onSheetDisplayNameEdit({ bucket: 'weapons', key, originalName: w.name }),
    };
  };

  const wrapSheetCard = (node, titleRightSlot) =>
    sheetEmphasisTitle ? (
      <CharacterSheetEmphasisCard title={sheetEmphasisTitle} titleRight={titleRightSlot}>{node}</CharacterSheetEmphasisCard>
    ) : node;

  const ancestryFeatures = el.ancestryFeatures || [];
  // Enrich weapons with effectiveRange at render time (Giant Reach: Melee → Very Close).
  // `recomputeCharacter` seeds `effectiveRange` from `range`, so we must not treat that
  // as final — always derive from ancestry via getEffectiveWeaponRange first.
  const weaponsFull = (el.weapons || []).map(w => ({
    ...w,
    effectiveRange:
      getEffectiveWeaponRange(w, ancestryFeatures) || w.effectiveRange || w.range || '',
  }));
  const weaponsReachFiltered =
    weaponReachMinFt != null && typeof weaponReachMinFt === 'number'
      ? weaponsFull.filter((w) => {
          const ft = weaponMaxRangeFt(w, ancestryFeatures);
          return ft != null && ft >= weaponReachMinFt;
        })
      : weaponsFull;

  const traits = el.traits || {};
  const isStressMaxed = stressMaxedProp !== undefined
    ? stressMaxedProp
    : (el.currentStress ?? 0) >= (el.maxStress ?? 6);
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
  const weaponFailsDisabledFilter = (weapon) => {
    const v2Hint = v2HintForWeapon(weapon);
    if (v2Hint?.isDisabled === true) return true;
    if (!v2Hint && weapon.feature?.name === 'Pompous' && (traits.presence ?? 0) > 0) return true;
    if (weapon._charged && isStressMaxed) return true;
    return !!outOfRangeDisableReason(weapon, getValidTargets, el.instanceId, ancestryFeatures);
  };

  const weapons = filterOutDisabledWeapons
    ? weaponsReachFiltered.filter((w) => !weaponFailsDisabledFilter(w))
    : weaponsReachFiltered;

  const activeBeastform = el.activeBeastform;

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
    if (
      filterOutDisabledWeapons &&
      (weaponFailsDisabledFilter(primaryWeapon) || weaponFailsDisabledFilter(pairedWeapon))
    ) {
      virtualWeapon = null;
    }
  }

  // Use pre-computed virtual weapons (from recomputeCharacter in builder mode)
  // or compute on-the-fly for Daggerstack-synced characters.
  // Those same VWs are already merged into `weapons` — do not list them again here or Offense shows duplicates.
  const ancestryVirtualWeaponsRaw = el._virtualWeapons || runCharacterRender(el).virtualWeapons;
  const ancestryVirtualWeapons = (ancestryVirtualWeaponsRaw || [])
    .filter((vw) => vw?.name && !weaponsFull.some((w) => w.name === vw.name))
    .filter((vw) => {
      if (weaponReachMinFt == null || typeof weaponReachMinFt !== 'number') return true;
      const ft = weaponMaxRangeFt(vw, ancestryFeatures);
      return ft != null && ft >= weaponReachMinFt;
    })
    .filter((vw) => {
      if (!filterOutDisabledWeapons) return true;
      const vwWeapon = {
        ...vw,
        effectiveRange: getEffectiveWeaponRange(vw, ancestryFeatures) || vw.effectiveRange || vw.range || '',
      };
      return !weaponFailsDisabledFilter(vwWeapon);
    });
  const versatilePairs = detectVersatileWeapons(weapons);
  const otherworldlyPairs = detectOtherworldlyWeapons(weapons);
  const chargedPairs = detectChargedWeapons(weapons);
  const otherworldlyOriginals = new Set(otherworldlyPairs.map(o => o.original));
  const startlingOk =
    weaponReachMinFt == null || weaponReachMinFt <= RANGE_BANDS_FT.MELEE;
  const startlingWeapons = startlingOk
    ? weapons
        .filter((w) => w.feature?.name === 'Startling')
        .filter((w) => !(filterOutDisabledWeapons && isStressMaxed))
    : [];

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
    const hideDevToggle = v2Hint?.hideDevastatingCardToggle === true;
    if (!hideDevToggle && w.feature?.name === 'Devastating' && devastatingActive) rollMeta.devastating = true;
    if (w.feature?.name === 'Doubled Up' && secondaryDamageStr) rollMeta.secondaryDamage = secondaryDamageStr;
    return (e) => onWeaponClick(w, rollMeta, e);
  };

  // ── Beastform mode: show beastform attack then disabled weapons ──────────────
  if (activeBeastform) {
    const beastformRangeWord = (activeBeastform.attack || '').trim().split(/\s+/)[0];
    const beastformFt = beastformRangeWord ? rangeBandNameToFt(beastformRangeWord) : null;
    const beastformReachOk =
      weaponReachMinFt == null ||
      (typeof weaponReachMinFt === 'number' && beastformFt != null && beastformFt >= weaponReachMinFt);
    if (!beastformReachOk) {
      /* fall through — show normal weapons only when beastform is out of range for this distance filter */
    } else {
    const beastformNoTargets =
      getValidTargets &&
      beastformFt != null &&
      el.instanceId &&
      (getValidTargets(el.instanceId, { weaponRangeFt: beastformFt }) ?? []).length === 0;
    const beastformDisabledReason = beastformNoTargets ? 'No targets in range' : null;
    const skipBeastformPinUi = filterOutDisabledWeapons && beastformDisabledReason;
    if (skipBeastformPinUi) {
      /* fall through — map pin omits disabled beastform attack */
    } else {
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

    const beastInner = (
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
            <div className="text-[9px] text-dh-muted uppercase tracking-wide pl-0.5">Normal attacks (disabled)</div>
            {weapons.filter(w => !otherworldlyOriginals.has(w)).map((w, i) => (
              <WeaponCard
                key={i}
                weapon={w}
                traitScore={traits[(w.trait || '').toLowerCase()] ?? 0}
                {...weaponSheetProps(w)}
              />
            ))}
          </div>
        )}
      </div>
    );
    const beastLabeled = omitOuterSection ? (
      beastInner
    ) : (
      <Section label={onBeastformAttack ? 'Attacks — click to roll' : 'Attacks'}>
        {beastInner}
      </Section>
    );
    return wrapSheetCard(beastLabeled);
    }
    }
  }

  if (!weapons.length && !ancestryVirtualWeapons.length) {
    if (titleRowEmptyMessage && sheetEmphasisTitle) {
      return wrapSheetCard(null, titleRowEmptyMessage);
    }
    if (weaponReachMinFt != null) {
      return wrapSheetCard(
        <p className="text-[10px] text-dh-muted leading-snug px-0.5">
          {emptyReachMessage || 'No weapons in range.'}
        </p>,
      );
    }
    return null;
  }

  const weaponsInner = (
      <div className="space-y-1">
        {/* Paired virtual weapon */}
        {virtualWeapon && (
          <WeaponCard
            weapon={virtualWeapon}
            traitScore={traits[(virtualWeapon.trait || '').toLowerCase()] ?? 0}
            onClick={makeClick(virtualWeapon)}
            isVirtual
            outOfRangeReason={outOfRangeReasonForWeapon(virtualWeapon)}
            {...weaponSheetProps(virtualWeapon)}
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
              {...weaponSheetProps(vwWeapon)}
            />
          );
        })}

        {/* Versatile alternate cards */}
        {versatilePairs.map(({ alternate }, i) => {
          const altW = { ...alternate, effectiveRange: getEffectiveWeaponRange(alternate, el.ancestryFeatures) };
          if (filterOutDisabledWeapons && weaponFailsDisabledFilter(altW)) return null;
          return (
            <WeaponCard
              key={`versatile-${i}`}
              weapon={altW}
              traitScore={traits[(alternate.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(alternate)}
              isVirtual
              outOfRangeReason={outOfRangeReasonForWeapon(altW)}
              {...weaponSheetProps(altW)}
            />
          );
        })}

        {/* Otherworldly Physical + Magical variant pairs */}
        {otherworldlyPairs.map(({ physicalVariant, magicalVariant }, i) => {
          const phyW = { ...physicalVariant, effectiveRange: getEffectiveWeaponRange(physicalVariant, el.ancestryFeatures) };
          const magW = { ...magicalVariant, effectiveRange: getEffectiveWeaponRange(magicalVariant, el.ancestryFeatures) };
          const hidePhy = filterOutDisabledWeapons && weaponFailsDisabledFilter(phyW);
          const hideMag = filterOutDisabledWeapons && weaponFailsDisabledFilter(magW);
          if (hidePhy && hideMag) return null;
          return (
            <div key={`otherworldly-${i}`} className="space-y-1">
              {!hidePhy && (
              <WeaponCard
                weapon={phyW}
                traitScore={traits[(physicalVariant.trait || '').toLowerCase()] ?? 0}
                onClick={makeClick(physicalVariant)}
                isVirtual
                outOfRangeReason={outOfRangeReasonForWeapon(phyW)}
                {...weaponSheetProps(phyW)}
              />
              )}
              {!hideMag && (
              <WeaponCard
                weapon={magW}
                traitScore={traits[(magicalVariant.trait || '').toLowerCase()] ?? 0}
                onClick={makeClick(magicalVariant)}
                purple
                outOfRangeReason={outOfRangeReasonForWeapon(magW)}
                {...weaponSheetProps(magW)}
              />
              )}
            </div>
          );
        })}

        {/* Charged variant cards */}
        {chargedPairs.map(({ original, chargedVariant }, i) => {
          if (filterOutDisabledWeapons && isStressMaxed) return null;
          if (v2HintForWeapon(original)?.hideChargedVariantCard) return null;
          const chW = { ...chargedVariant, effectiveRange: getEffectiveWeaponRange(chargedVariant, el.ancestryFeatures) };
          return (
          <div key={`charged-${i}`}>
            <WeaponCard
              weapon={chW}
              traitScore={traits[(chargedVariant.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(chargedVariant, { _attackerInstanceId: el.instanceId })}
              isVirtual
              outOfRangeReason={outOfRangeReasonForWeapon(chW)}
              {...weaponSheetProps(chW)}
            />
            {isStressMaxed && (
              <div className="text-[9px] text-dh-muted pl-5 mt-0.5">Stress maxed — cannot use Charged</div>
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
          const hideDevToggle = v2Hint?.hideDevastatingCardToggle === true;
          return (
            <WeaponCard
              key={w.name ? `${w.name}-${i}` : i}
              weapon={w}
              traitScore={traits[(w.trait || '').toLowerCase()] ?? 0}
              onClick={makeClick(w)}
              devastating={!hideDevToggle && w.feature?.name === 'Devastating' ? devastatingActive : undefined}
              onDevastatingToggle={!hideDevToggle && w.feature?.name === 'Devastating' && onWeaponClick ? onDevastatingToggle : undefined}
              pompousWarning={legacyPompous}
              v2DisableReason={v2DisableReason}
              outOfRangeReason={outOfRangeReasonForWeapon(w)}
              {...weaponSheetProps(w)}
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
                  ? 'border-dh-border/50 bg-dh-raised/30 opacity-40 cursor-not-allowed'
                  : onActionNotification
                    ? 'dh-sheet-clickable-chip border-amber-700/50 bg-amber-950/20 cursor-pointer hover:brightness-125 hover:border-amber-500/70 group'
                    : 'border-amber-700/30 bg-amber-950/10'
                }`}
            >
              <div className="flex items-center gap-2">
                <Swords size={10} className="text-amber-500/60 shrink-0" />
                <span className="font-semibold text-dh-hope">Startling: Force Back</span>
                <FeatureResourceCostIcons action={{ stressCost: 1 }} iconSize={9} className="ml-0.5" />
              </div>
              <div className="text-[10px] mt-0.5 pl-5 text-amber-400/60">
                Mark a Stress to force all adversaries in Melee back to Close range
              </div>
            </div>
          );
        })}
      </div>
  );

  const weaponsLabeled = omitOuterSection ? (
    weaponsInner
  ) : (
    <Section label={onWeaponClick ? 'Weapons — click to roll' : 'Weapons'}>
      {weaponsInner}
    </Section>
  );
  return wrapSheetCard(weaponsLabeled);
}

/**
 * Feature list — guide-driven cards shared with Game Table hover + Library preview.
 *
 * @param {'interactive'|'preview'} [interactionMode] — defaults from presence of handlers
 * @param {object|null} [sheetHighlightAbility] — `el.abilities` row for LOADOUT; enables domain source dimming
 */
export function CharacterFeatureActionsRow({
  entry,
  el,
  v2TableContext,
  interactionMode,
  onV2CardChip,
  onShareFeature,
  activeChanneledElement,
  pendingBanners,
  sheetHighlightAbility = null,
  stripSlot = 'full',
  stripKeyPrefix,
  /** When set, render only this index from `model.cardChips` (master Actions strip; one flex item per chip). */
  chipIndex = null,
  /** When provided, skip rebuilding the feature card model (sheet Actions strip slot list). */
  prefetchedModel = null,
  prefetchedTable = null,
  /** Adversary map pin: implicit target for single-target `selectTargets` chips (see GuideFeatureCard). */
  pinSelectTargetInstanceId = null,
}) {
  const { model: builtModel, table: tableForChips } = useMemo(() => {
    if (prefetchedModel && prefetchedTable) return { model: prefetchedModel, table: prefetchedTable };
    return buildFeatureCardModelForCharacter(entry.row, el, v2TableContext);
  }, [prefetchedModel, prefetchedTable, entry.row, el, v2TableContext]);
  const model = useMemo(() => {
    if (chipIndex == null || chipIndex < 0) return builtModel;
    const chips = builtModel.cardChips;
    if (!chips?.[chipIndex]) return builtModel;
    return { ...builtModel, cardChips: [chips[chipIndex]] };
  }, [builtModel, chipIndex]);
  const highlightCtx = useCharacterSheetSourceHighlightState();
  const highlight = highlightCtx?.highlight ?? null;
  const dimmed = shouldDimFeatOrAbilityRow(sheetHighlightAbility, entry.row, el, highlight);
  if (!model.cardChips?.length) return null;
  const stressMaxed =
    entry.row.name === 'Elemental Incarnation'
      ? (el.currentStress ?? 0) >= (el.maxStress ?? 6)
      : undefined;
  const channel = entry.row.name === 'Elemental Incarnation' ? activeChanneledElement : undefined;

  const chips = (
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
      stripSlot={stripSlot}
      stripKeyPrefix={
        chipIndex != null ? `${stripKeyPrefix ?? entry.key}-${chipIndex}` : stripKeyPrefix ?? entry.key
      }
      dimmed={stripSlot === 'activeOnly' && dimmed}
      actionsStripIntrinsicWidth={shouldUseIntrinsicWidthForActionsStripSlot(stripSlot)}
      pinSelectTargetInstanceId={pinSelectTargetInstanceId}
    />
  );
  if (stripSlot === 'unusableOnly') return chips;
  if (stripSlot === 'activeOnly') return chips;
  if (!dimmed) return chips;
  return <div className={SHEET_SOURCE_DIM_CLASS}>{chips}</div>;
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
  const loadoutEntries = useMemo(() => getOrderedGuideLoadoutEntries(el), [el]);
  const mode = interactionMode ?? (onV2CardChip || onShareFeature ? 'interactive' : 'preview');

  /** Feature/loadout rows that expose at least one card chip (used for unusable subsection + slot expansion). */
  const guideEntriesWithChips = useMemo(() => {
    const out = [];
    for (const entry of orderedEntries) {
      if (entry.kind !== 'guide') continue;
      const { model } = buildFeatureCardModelForCharacter(entry.row, el, v2TableContext);
      if (model.cardChips?.length) out.push(entry);
    }
    return out;
  }, [orderedEntries, el, v2TableContext]);

  const loadoutEntriesWithChips = useMemo(() => {
    const out = [];
    for (const entry of loadoutEntries) {
      const { model } = buildFeatureCardModelForCharacter(entry.row, el, v2TableContext);
      if (model.cardChips?.length) out.push(entry);
    }
    return out;
  }, [loadoutEntries, el, v2TableContext]);

  const allWithChips = useMemo(
    () => [...guideEntriesWithChips, ...loadoutEntriesWithChips],
    [guideEntriesWithChips, loadoutEntriesWithChips],
  );

  const actionChipSlots = useMemo(
    () => buildActionChipSlotsForSheet(allWithChips, el, v2TableContext),
    [allWithChips, el, v2TableContext],
  );

  const activeActionChipSlots = useMemo(
    () => actionChipSlots.filter((s) => !s.moveToUnusable),
    [actionChipSlots],
  );
  const unusableActionChipSlots = useMemo(
    () => actionChipSlots.filter((s) => s.moveToUnusable),
    [actionChipSlots],
  );

  const renderActionsStrip = (slots, stripSlot) => (
    <WidthSortedFlexWrap className="flex flex-wrap gap-x-1.5 gap-y-1.5 items-center content-start">
      {slots.map((slot) => (
        <CharacterFeatureActionsRow
          key={`${slot.entry.key}-${slot.chipIndex}-${stripSlot}`}
          entry={slot.entry}
          chipIndex={slot.chipIndex}
          el={el}
          v2TableContext={v2TableContext}
          interactionMode={mode}
          onV2CardChip={onV2CardChip}
          onShareFeature={onShareFeature}
          activeChanneledElement={activeChanneledElement}
          pendingBanners={pendingBanners}
          sheetHighlightAbility={slot.entry.ability}
          stripSlot={stripSlot}
          stripKeyPrefix={slot.entry.key}
          prefetchedModel={slot.model}
          prefetchedTable={slot.table}
        />
      ))}
    </WidthSortedFlexWrap>
  );

  return (
    <div className="space-y-2 min-w-0 w-full">
      {renderActionsStrip(activeActionChipSlots, 'activeOnly')}
      {unusableActionChipSlots.length > 0 && (
        <div className="space-y-1 min-w-0 pt-1.5 border-t border-dh-border/50">
          <p className="text-[9px] tracking-widest text-dh-muted/90 font-semibold uppercase">
            Used, inapplicable, or too costly
          </p>
          {renderActionsStrip(unusableActionChipSlots, 'unusableOnly')}
        </div>
      )}
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

/** Same V2 chip strip as the split-sheet “Actions” card — use under Offense with `CharacterFeaturesPanel` `omitActions`. */
export function CharacterFeatureActionsEmphasisCard({
  el,
  onV2CardChip,
  onShareFeature,
  v2TableContext,
  interactionMode,
  activeChanneledElement,
  pendingBanners,
  rollModifiers: rollModifiersProp,
  selectedRollModIndex,
  onSelectRollMod,
  selectedModId,
  onSelectMod,
  onUseMod,
  onUseMode,
  modifierEligibility,
  beastformAdvantages,
  selectedBeastformAdvantage,
  onSelectBeastformAdvantage,
  crossSheetChips,
  onCrossSheetChipClick,
}) {
  const rollModifiers = rollModifiersProp ?? el.armorMods?.rollModifiers ?? [];
  const hasV2 = useMemo(
    () => characterHasFeatureCardActions(el, onV2CardChip, v2TableContext),
    [el, onV2CardChip, v2TableContext],
  );
  const hasModifierRow = useMemo(() => {
    const rm = rollModifiers?.length > 0;
    const nonPrayer = (el.activeModifiers || []).filter((m) => m.name !== 'Prayer Die').length > 0;
    const bf = (beastformAdvantages?.length ?? 0) > 0;
    const cs = (crossSheetChips?.length ?? 0) > 0;
    return rm || nonPrayer || bf || cs;
  }, [el.activeModifiers, rollModifiers, beastformAdvantages, crossSheetChips]);

  if (!hasV2 && !hasModifierRow) return null;
  const mode = interactionMode ?? (onV2CardChip || onShareFeature ? 'interactive' : 'preview');
  return (
    <CharacterSheetEmphasisCard title="Actions">
      <div className="space-y-3 min-w-0">
        {hasV2 && (
          <CharacterFeatureActionsBody
            el={el}
            onV2CardChip={onV2CardChip}
            onShareFeature={onShareFeature}
            v2TableContext={v2TableContext}
            interactionMode={mode}
            activeChanneledElement={activeChanneledElement}
            pendingBanners={pendingBanners}
          />
        )}
        <CharacterSheetModifierChips
          el={el}
          rollModifiers={rollModifiers}
          selectedRollModIndex={selectedRollModIndex}
          onSelectRollMod={onSelectRollMod}
          selectedModId={selectedModId}
          onSelectMod={onSelectMod}
          onUseMod={onUseMod}
          onUseMode={onUseMode}
          modifierEligibility={modifierEligibility}
          beastformAdvantages={beastformAdvantages}
          selectedBeastformAdvantage={selectedBeastformAdvantage}
          onSelectBeastformAdvantage={onSelectBeastformAdvantage}
          crossSheetChips={crossSheetChips}
          onCrossSheetChipClick={onCrossSheetChipClick}
        />
      </div>
    </CharacterSheetEmphasisCard>
  );
}

/**
 * V2 declarative `cards` (e.g. Beastbound companion) — after Actions (when inline) and before Features.
 */
/** Declarative `cards` (e.g. Beastbound companion) — use in column 2 after Actions when `CharacterFeaturesPanel` has `omitDeclarativeCards`. */
export function CharacterSheetDeclarativeCards({
  el,
  v2TableContext,
  queueManualTrackEdit,
  updateFn,
  onRoll,
  interactionMode,
  onV2CardChip,
  onOpenImageLightbox,
  /** Game Table: companion stress track is GM-only when false (default true: library / GM). */
  gmResourceTrackCheckboxEdits = true,
}) {
  const entries = useMemo(() => collectSheetCardsForCharacter(el, v2TableContext), [el, v2TableContext]);
  const preview = interactionMode === 'preview';
  const companion = el.companion;

  const companionHandlers = useMemo(() => {
    if (!companion || preview) return null;
    const spellcastKey = (el.spellcastTrait || 'presence').toLowerCase();
    const spellcastScore = el.traits?.[spellcastKey] ?? 0;
    const buildCompanionAttackRollText = () => {
      const parts = [`${companion.name} ${companion.attackName} Hope [d12] Fear [d12]`];
      if (spellcastScore !== 0) parts.push(`${spellcastKey} [${spellcastScore}]`);
      parts.push('damage [d6] melee');
      return parts.join(' ');
    };
    const buildCompanionRollMeta = () => ({
      _attackerInstanceId: el.instanceId ?? el.id,
      _traitKey: spellcastKey,
      _intentPanelForActionRoll: true,
      _deferExperienceToPreRoll: true,
      _companionExperienceForRoll: true,
      _isSpellcastRoll: true,
    });
    const onStress = !gmResourceTrackCheckboxEdits
      ? undefined
      : queueManualTrackEdit
        ? (filled) => queueManualTrackEdit(el, { companion: { ...companion, currentStress: filled } })
        : updateFn
          ? (filled) => updateFn(el.instanceId ?? el.id, { companion: { ...companion, currentStress: filled } })
          : undefined;
    return {
      onStressChange: onStress,
      onAttackRoll:
        onRoll && companion.attackName?.trim()
          ? () => onRoll(buildCompanionAttackRollText(), `${el.name} (${companion.name})`, buildCompanionRollMeta(), {
              characterEl: el,
            })
          : undefined,
    };
  }, [el, companion, preview, queueManualTrackEdit, updateFn, onRoll, gmResourceTrackCheckboxEdits]);

  if (!entries.length) return null;

  const highlightCtx = useCharacterSheetSourceHighlightState();
  const sheetHighlight = highlightCtx?.highlight ?? null;

  const nodes = [];
  for (let i = 0; i < entries.length; i++) {
    const { feature, card, shape } = entries[i];
    if (!shape?.jsonSchema || !companion) continue;
    const merged = { ...omitShapeId(card), ...companion };
    const onFieldRoll = (fieldKey) => {
      if (fieldKey === 'attackName') companionHandlers?.onAttackRoll?.();
    };
    const shapeChips = collectShapePlacementChipsForCharacter(el, shape, v2TableContext);
    const tableForShapeChips = buildGuideFeatureTableSnapshot(el, feature, v2TableContext);
    const featureKey = getFeatureUsageKeyForGuideFeature(el, feature.name) ?? feature.name;
    const cardDim = shouldDimGuideFeatRow(feature, el, sheetHighlight);
    nodes.push(
      <div
        key={`${feature.name}-${shape.id}-${i}`}
        className={`min-w-0 space-y-0 ${cardDim ? SHEET_SOURCE_DIM_CLASS : ''}`}
      >
        <DeclarativeSchemaSheetCard
          featureName={feature.name}
          jsonSchema={shape.jsonSchema}
          data={merged}
          preview={preview}
          onFieldRoll={companionHandlers ? onFieldRoll : undefined}
          onTrackedSetFilled={companionHandlers?.onStressChange}
          onOpenImageLightbox={onOpenImageLightbox}
          chipsSlot={
            shapeChips.length > 0 ? (
              <GuideFeatureCardChips
                model={{ name: feature.name, displayName: feature.name, cardChips: shapeChips }}
                tableForChips={tableForShapeChips}
                featRow={feature}
                el={el}
                featureKey={featureKey}
                v2TableContext={v2TableContext}
                interactionMode={preview ? 'preview' : 'interactive'}
                onV2CardChip={onV2CardChip}
                placementShape={shape}
                actionsStripLayout
              />
            ) : null
          }
        />
      </div>,
    );
  }
  if (!nodes.length) return null;
  return <div className="space-y-3 min-w-0">{nodes}</div>;
}

/**
 * Features region: when any feature exposes V2 card chips, Actions and Features are split into two emphasis cards
 * (chips live only in Actions; Features cards omit duplicate chip rows). Declarative `cards` (e.g. companion) render between Actions and Features when inline.
 * Pass `omitActions` when the Actions card is rendered elsewhere (e.g. directly under Offense in column 2).
 * Pass `omitDeclarativeCards` when companion/declarative inserts render in column 2 after Actions.
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
  queueManualTrackEdit,
  onRoll,
  omitActions = false,
  omitDeclarativeCards = false,
  onSheetDisplayNameEdit,
  onOpenImageLightbox,
}) {
  const orderedEntries = useMemo(() => getOrderedGuideFeatureEntries(el, onV2CardChip), [el, onV2CardChip]);
  const hopeFeature = el.hopeFeature || el.hopeAbility;
  /** Must run every render — do not place after an early return (React #310). */
  const hasActions = useMemo(
    () => characterHasFeatureCardActions(el, onV2CardChip, v2TableContext),
    [el, onV2CardChip, v2TableContext],
  );
  const hasDeclarativeSheetCards = useMemo(() => {
    const rows = collectSheetCardsForCharacter(el, v2TableContext);
    return rows.some(({ card }) => card && typeof card === 'object');
  }, [el, v2TableContext]);
  const willEarlyReturn =
    !orderedEntries.length &&
    !hopeFeature &&
    (!hasDeclarativeSheetCards || omitDeclarativeCards);
  if (willEarlyReturn) return null;
  const mode = interactionMode ?? (onV2CardChip || onShareFeature ? 'interactive' : 'preview');

  const listContentProps = {
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
    onSheetDisplayNameEdit,
  };

  const declarativeProps = {
    el,
    v2TableContext,
    queueManualTrackEdit,
    updateFn,
    onRoll,
    onV2CardChip,
    interactionMode: mode,
    onOpenImageLightbox,
  };

  return (
    <div className="space-y-3 min-w-0">
      {!omitActions && (
        <CharacterFeatureActionsEmphasisCard
          el={el}
          onV2CardChip={onV2CardChip}
          onShareFeature={onShareFeature}
          v2TableContext={v2TableContext}
          interactionMode={interactionMode}
          activeChanneledElement={activeChanneledElement}
          pendingBanners={pendingBanners}
        />
      )}
      {!omitDeclarativeCards && <CharacterSheetDeclarativeCards {...declarativeProps} />}
      {hasActions ? (
        <CharacterSheetEmphasisCard title="Features">
          <CharacterFeatureListContent {...listContentProps} hideV2CardChips />
        </CharacterSheetEmphasisCard>
      ) : (
        <Section label="Features">
          <CharacterFeatureListContent {...listContentProps} hideV2CardChips={false} />
        </Section>
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
  /** When true, V2 card chips are not rendered on each feature (shown in a separate Actions card). */
  hideV2CardChips = false,
  onSheetDisplayNameEdit,
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
    if (!row) return false;
    // Explicit chips, or root hopeCost/onUse (Default Card Action — e.g. Frontline Tank).
    if (Array.isArray(row.chips) && row.chips.length > 0) return true;
    return (
      typeof row.onUse === 'function' ||
      row.hopeCost != null ||
      row.stressCost != null ||
      row.frequency != null
    );
  })();

  const hnForHopeSheet = resolveHopeFeatureName(el);
  const hopeRowForSheet = useMemo(
    () => (hnForHopeSheet ? (el.activeFeatures || []).find((a) => a.name === hnForHopeSheet) : null),
    [el, hnForHopeSheet],
  );
  const highlightCtx = useCharacterSheetSourceHighlightState();

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
          const hopeDimWrap = !!(
            hopeRowForSheet &&
            highlightCtx?.highlight &&
            shouldDimGuideFeatRow(hopeRowForSheet, el, highlightCtx.highlight)
          );

          if (hopeInteractive) {
            // Prefer the merged V2 `activeFeatures` hope row so engine flags
            // (`hostRollMetaFeatureStateActivate`, `_sourceScopeKey`, costs, …) reach
            // `onFeatureUse` / banner ack — a bare `{ name, description }` drops them.
            const hopeFeat = {
              ...(hopeRowForSheet && typeof hopeRowForSheet === 'object' ? hopeRowForSheet : {}),
              name: name || hopeRowForSheet?.name || 'Hope Ability',
              description: desc || hopeRowForSheet?.description || '',
            };
            const handleClick = onFeatureUse
              ? (e) => canUse && onFeatureUse(hopeFeat, null, e)
              : () => canUse && onUseHopeAbility(el.instanceId);
            return (
              <div key="hope-ability" className={hopeDimWrap ? SHEET_SOURCE_DIM_CLASS : undefined}>
                <button
                  onClick={handleClick}
                  disabled={!canUse}
                  title={canUse ? 'Spend 3 Hope to use' : 'Not enough Hope (need 3)'}
                  className={`w-full rounded border text-left px-2 py-1.5 transition-colors ${
                    canUse
                      ? 'dh-sheet-clickable-chip border-amber-700/60 bg-amber-950/40 hover:bg-amber-900/50 hover:border-amber-600/70 cursor-pointer'
                      : 'border-dh-border/40 bg-dh-raised/30 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0 flex-wrap">
                    {name && (
                      <span className="text-sm font-semibold text-dh-hope leading-snug min-w-0 flex-1">{name}</span>
                    )}
                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                      <FeatureResourceCostIcons action={{ hopeCost: 3 }} iconSize={10} className="shrink-0" />
                    </div>
                  </div>
                  {desc && <MarkdownText text={desc} className="text-[11px] text-dh leading-relaxed dh-md mt-0.5" />}
                </button>
              </div>
            );
          }

          return (
            <div key="hope-ability-readonly" className={hopeDimWrap ? SHEET_SOURCE_DIM_CLASS : undefined}>
              <div className="rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1.5">
                <div className="flex items-start gap-2 min-w-0 flex-wrap mb-0.5">
                  {name && (
                    <span className="text-sm font-semibold text-dh-hope leading-snug min-w-0 flex-1">{name}</span>
                  )}
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <FeatureResourceCostIcons action={{ hopeCost: 3 }} iconSize={10} className="shrink-0" />
                  </div>
                </div>
                {desc && <MarkdownText text={desc} className="text-[11px] text-dh leading-relaxed dh-md" />}
              </div>
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
            <span className="text-[10px] text-dh-muted select-none" aria-hidden>
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
              hideV2CardChips={hideV2CardChips}
              onSheetDisplayNameEdit={onSheetDisplayNameEdit}
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
  onSheetDisplayNameEdit,
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
        onSheetDisplayNameEdit={onSheetDisplayNameEdit}
      />
    </Section>
  );
}

/**
 * LOADOUT — domain cards (same guide card + Actions split as Features).
 */
export function CharacterAbilityList({
  el,
  expandedKeys,
  onToggleFeature,
  onFeatureUse,
  featureUsage,
  onV2DomainChip,
  v2TableContext,
  onSheetDisplayNameEdit,
}) {
  const [localExpanded, setLocalExpanded] = useState({});
  const abilities = el.abilities || [];
  const inBeastform = !!el.activeBeastform;

  const hasLoadoutActions = useMemo(
    () => characterHasLoadoutCardActions(el, v2TableContext),
    [el, v2TableContext],
  );

  if (!abilities.length) return null;

  const isOpen = (key) => {
    if (expandedKeys !== undefined) return expandedKeys.includes(key);
    return localExpanded[key] ?? false;
  };
  const toggle = (key) => {
    if (onToggleFeature) onToggleFeature(key);
    else setLocalExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const mode = onV2DomainChip || onFeatureUse ? 'interactive' : 'preview';

  const inner = (
    <>
      {inBeastform && (
        <div className="flex items-center gap-1 text-[10px] text-amber-500/80 bg-amber-950/30 border border-amber-700/40 rounded px-2 py-1 mb-1">
          <X size={9} className="shrink-0" />
          <span>Domain cards disabled while in Beastform</span>
        </div>
      )}
      <div className={`space-y-2 ${inBeastform ? 'opacity-30 pointer-events-none select-none' : ''}`}>
        {abilities.map((a, i) => {
          const key = `ability-${a.id ?? i}`;
          const featRow = resolveLoadoutAbilityFeatRow(el, a);
          return (
            <GuideFeatureCard
              key={a.id || key}
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
              sheetHighlightAbility={a}
              hideV2CardChips={hasLoadoutActions}
              onSheetDisplayNameEdit={onSheetDisplayNameEdit}
            />
          );
        })}
      </div>
    </>
  );

  if (hasLoadoutActions) {
    return (
      <CharacterSheetEmphasisCard title="LOADOUT">
        {inner}
      </CharacterSheetEmphasisCard>
    );
  }
  return <Section label="LOADOUT">{inner}</Section>;
}

/**
 * VAULT — domain cards known but not in the active loadout (same card chrome as LOADOUT, read-only).
 */
export function CharacterVaultAbilityList({
  el,
  expandedKeys,
  onToggleFeature,
  v2TableContext,
  onSheetDisplayNameEdit,
}) {
  const vaultAbilities = el.domainVaultAbilities || [];
  const [localExpanded, setLocalExpanded] = useState({});
  const inBeastform = !!el.activeBeastform;

  const hasLoadoutActions = useMemo(
    () => characterHasLoadoutCardActions(el, v2TableContext),
    [el, v2TableContext],
  );

  if (!vaultAbilities.length) return null;

  const isOpen = (key) => {
    if (expandedKeys !== undefined) return expandedKeys.includes(key);
    return localExpanded[key] ?? false;
  };
  const toggle = (key) => {
    if (onToggleFeature) onToggleFeature(key);
    else setLocalExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const inner = (
    <>
      <p className="text-[11px] text-dh-muted leading-snug mb-1.5">
        Inactive until swapped into your loadout. Recall costs apply when you bring a card back.
      </p>
      <div className={`space-y-2 ${inBeastform ? 'opacity-30 pointer-events-none select-none' : ''}`}>
        {vaultAbilities.map((a, i) => {
          const abilityKey = `ability-${a.id ?? i}`;
          const key = `vault-ability-${a.id ?? i}`;
          const featRow = resolveLoadoutAbilityFeatRow(el, a);
          return (
            <GuideFeatureCard
              key={a.id || key}
              featRow={featRow}
              featureKey={abilityKey}
              el={el}
              open={isOpen(key)}
              onToggle={() => toggle(key)}
              interactionMode="preview"
              onFeatureUse={undefined}
              onV2CardChip={undefined}
              v2TableContext={v2TableContext}
              sheetHighlightAbility={a}
              hideV2CardChips
              onSheetDisplayNameEdit={onSheetDisplayNameEdit}
            />
          );
        })}
      </div>
    </>
  );

  if (hasLoadoutActions) {
    return (
      <CharacterSheetEmphasisCard title="VAULT">
        {inner}
      </CharacterSheetEmphasisCard>
    );
  }
  return <Section label="VAULT">{inner}</Section>;
}

const INVENTORY_COLLECTION_LABEL = {
  weapons: 'Weapon',
  armor: 'Armor',
  items: 'Item',
  consumables: 'Consumable',
};

const GOLD_DIGIT_CLASS = 'text-[1.75rem] leading-none font-semibold tabular-nums text-amber-200';
const GOLD_LABEL_CLASS = 'text-[9px] uppercase tracking-wide text-dh-muted whitespace-nowrap';
const GOLD_RULE_H = 'h-px w-4 bg-dh-muted/50';
const GOLD_RULE_V = 'w-px h-3.5 bg-dh-muted/50';

function GoldSrdCapWarning() {
  return (
    <Tooltip label="Over the SRD's 1-chest limit" placement="top">
      <span className="inline-flex items-center text-amber-400" aria-label="Over the SRD's 1-chest limit">
        <AlertTriangle size={10} />
      </span>
    </Tooltip>
  );
}

function GoldAnnotatedDigits({ chests, bags, handfuls, overCap, editable, onEdit, ariaLabel }) {
  const DigitWrap = editable ? 'button' : 'div';
  const wrapProps = editable
    ? { type: 'button', onClick: onEdit, 'aria-label': `${ariaLabel}. Click to edit`, title: 'Click to edit gold' }
    : { 'aria-label': ariaLabel };
  return (
    <DigitWrap
      {...wrapProps}
      className={`inline-grid grid-cols-[auto_auto_auto_auto_auto] grid-rows-[auto_auto_auto] items-end justify-items-center max-w-full ${
        editable ? 'bg-transparent border-0 p-0.5 rounded hover:bg-dh-inset/50 cursor-text' : ''
      }`}
    >
      <span className={`col-start-3 row-start-1 ${GOLD_LABEL_CLASS}`}>Bags</span>
      <span className={`col-start-3 row-start-2 ${GOLD_RULE_V}`} aria-hidden />
      <span className="col-start-1 row-start-3 flex items-center gap-1 justify-self-end self-center pr-0.5">
        <span className={GOLD_LABEL_CLASS}>Chests</span>
        {overCap ? <GoldSrdCapWarning /> : null}
        <span className={GOLD_RULE_H} aria-hidden />
      </span>
      <span className={`col-start-2 row-start-3 ${GOLD_DIGIT_CLASS}`}>{chests}</span>
      <span className={`col-start-3 row-start-3 ${GOLD_DIGIT_CLASS}`}>{bags}</span>
      <span className={`col-start-4 row-start-3 ${GOLD_DIGIT_CLASS}`}>{handfuls}</span>
      <span className="col-start-5 row-start-3 flex items-center gap-1 justify-self-start self-center pl-0.5">
        <span className={GOLD_RULE_H} aria-hidden />
        <span className={GOLD_LABEL_CLASS}>Handfuls</span>
      </span>
    </DigitWrap>
  );
}

/**
 * Annotated chests / bags / handfuls digits (left / above / right) over a single gold integer.
 * Click the number to edit; Save or Enter commits once (Escape cancels).
 */
export function GoldTracker({ gold, editable, onChange }) {
  const g = Math.max(0, Math.floor(gold || 0));
  const slots = goldToSlots(g);
  const overCap = isGoldOverSrdCap(g);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    const id = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [editing]);

  const startEdit = () => {
    if (!editable) return;
    setDraft(String(g));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const commitEdit = () => {
    const next = parseGoldInput(draft);
    setEditing(false);
    setDraft('');
    if (next !== g) onChange?.(next);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[11px]">
        <Package size={10} className="text-dh-hope-soft shrink-0" />
        <span className="text-dh-muted">Gold</span>
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                commitEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
              }
            }}
            className="w-full bg-dh-raised border border-dh-strong rounded px-2 py-1 text-center text-[1.75rem] leading-none font-semibold tabular-nums text-amber-200 focus:outline-none focus:border-amber-500/60"
            aria-label="Gold amount"
          />
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="px-2.5 py-1 rounded text-[11px] font-medium border border-dh-border text-dh-muted hover:bg-dh-hover/50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitEdit}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-sky-700/80 hover:bg-sky-600 text-white border border-sky-600/60"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <GoldAnnotatedDigits
            chests={slots.chests}
            bags={slots.bags}
            handfuls={slots.handfuls}
            overCap={overCap}
            editable={editable}
            onEdit={startEdit}
            ariaLabel={`Gold ${g}: ${formatGold(g)}`}
          />
        </div>
      )}
    </div>
  );
}

function InventoryQtyStepper({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        className="w-5 h-5 flex items-center justify-center rounded border border-dh-border bg-dh-raised text-dh hover:bg-dh-inset disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Decrease quantity"
      >
        <Minus size={10} />
      </button>
      <span className="w-5 text-center text-[11px] text-dh tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="w-5 h-5 flex items-center justify-center rounded border border-dh-border bg-dh-raised text-dh hover:bg-dh-inset disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Increase quantity"
      >
        <Plus size={10} />
      </button>
    </div>
  );
}

function InventoryMoveMenu({ destinations, onMove, disabled }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuStyle(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_MIN_W = 160;
    const GAP = 4;
    let left = rect.right - MENU_MIN_W;
    if (left < 8) left = 8;
    if (left + MENU_MIN_W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - MENU_MIN_W - 8);
    let top = rect.bottom + GAP;
    const estimatedH = Math.min(280, 40 + destinations.length * 32);
    if (top + estimatedH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - GAP - estimatedH);
    }
    setMenuStyle({
      position: 'fixed',
      zIndex: 80,
      top,
      left,
      minWidth: MENU_MIN_W,
      maxWidth: Math.min(240, window.innerWidth - 16),
    });
  }, [open, destinations.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!destinations?.length || !onMove) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-dh-muted opacity-0 group-hover/invrow:opacity-100 focus:opacity-100 hover:text-dh hover:bg-dh-hover disabled:opacity-0"
        aria-label="Move item"
        aria-expanded={open}
      >
        <ChevronRight size={12} />
      </button>
      {open && menuStyle && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Move item to"
          className="rounded-lg border border-dh-strong bg-dh-surface shadow-xl shadow-black/40 max-h-[min(50vh,280px)] overflow-y-auto py-1"
          style={menuStyle}
          {...{ [DH_OUTSIDE_DISMISS_EXEMPT_ATTR]: '' }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {destinations.map((dest) => {
            const key = dest.scope === 'party' ? 'party' : `character:${dest.instanceId}`;
            return (
              <button
                key={key}
                type="button"
                role="option"
                className="w-full text-left px-3 py-1.5 text-[12px] text-dh hover:bg-dh-hover"
                onClick={() => {
                  setOpen(false);
                  onMove(dest);
                }}
              >
                {dest.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Inventory name/quantity rows. Editable Game Table rows get a stepper, remove, and
 * (for free-text) a name field. Library-linked rows show a collection badge.
 * Optional `moveDestinations` + `onMoveItem(uid, dest)` add a hover move menu.
 */
export function CharacterInventoryList({ inventory, editable, onChange, onOpenPicker, moveDestinations, onMoveItem }) {
  const rows = Array.isArray(inventory) ? inventory.filter((e) => e && typeof e === 'object') : [];
  const canMove = editable && Array.isArray(moveDestinations) && moveDestinations.length > 0 && typeof onMoveItem === 'function';

  const mutate = (fn) => {
    if (!onChange) return;
    const normalized = normalizeInventoryList(rows);
    onChange(fn(normalized));
  };

  if (!editable) {
    if (!rows.length) return null;
    return (
      <p className="text-[11px] text-dh-muted leading-relaxed">
        {rows.map((item, i) => (
          <span key={item.uid || item.id || i}>
            {item.quantity > 1 && <span className="text-dh font-semibold">{item.quantity}× </span>}
            <span className="text-dh">{item.name}</span>
            {i < rows.length - 1 && <span className="text-dh-muted">, </span>}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map((item, i) => {
        const linked = isLibraryLinkedInventoryEntry(item);
        const rowKey = item.uid || item.id || `idx-${i}`;
        return (
          <div key={rowKey} className="group/invrow flex items-center gap-1.5 min-w-0">
            <InventoryQtyStepper
              value={Math.max(1, Math.floor(item.quantity || 1))}
              onChange={(q) => mutate((list) => updateInventoryEntryQuantity(list, list[i].uid, q))}
            />
            {linked ? (
              <span className="flex-1 min-w-0 truncate text-[11px] text-dh">{item.name}</span>
            ) : (
              <input
                type="text"
                value={item.name || ''}
                onChange={(e) => mutate((list) => updateInventoryEntryName(list, list[i].uid, e.target.value))}
                className="flex-1 min-w-0 bg-dh-raised border border-dh-border rounded px-1.5 py-0.5 text-[11px] text-dh focus:outline-none focus:border-dh-strong"
                aria-label="Item name"
              />
            )}
            {linked && item.refCollection && (
              <span className="shrink-0 text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-dh-inset text-dh-muted">
                {INVENTORY_COLLECTION_LABEL[item.refCollection] || item.refCollection}
              </span>
            )}
            {canMove && item.uid && (
              <InventoryMoveMenu
                destinations={moveDestinations}
                onMove={(dest) => onMoveItem(item.uid, dest)}
              />
            )}
            <button
              type="button"
              onClick={() => mutate((list) => removeInventoryEntry(list, list[i].uid))}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-dh-muted hover:text-red-300 hover:bg-red-950/40"
              aria-label={`Remove ${item.name || 'item'}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onOpenPicker?.()}
        className="mt-0.5 text-[11px] text-sky-300 hover:text-sky-200"
      >
        + Add item
      </button>
    </div>
  );
}

/** Read-only library/detail wrapper. Game Table uses GoldTracker + CharacterInventoryList. */
export function CharacterInventory({ el }) {
  const inventory = el.inventory || [];
  if (!inventory.length && el.gold == null) return null;
  return (
    <Section label="Inventory">
      {el.gold != null && <GoldTracker gold={el.gold} editable={false} />}
      <CharacterInventoryList inventory={inventory} editable={false} />
    </Section>
  );
}

/**
 * Full character detail pane for use in ItemDetailModal display side.
 * @param {{ item: object, srdData: object, onCharacterRuntimeUpdate?: (patch: object) => void }} props
 */
export function CharacterDetailPane({ item, srdData, onCharacterRuntimeUpdate, onOpenImageLightbox }) {
  const el = useMemo(() => {
    const raw = item || {};
    if (!srdData) return raw;
    const base = recomputeCharacter(raw, srdData);
    return mergeV2DeclarativeSheetOverlay(base, raw, srdData, {});
  }, [item, srdData]);

  const defenseTrackInteraction = useMemo(() => {
    if (!onCharacterRuntimeUpdate) return null;
    const out = { stress: undefined, armor: undefined, hp: undefined };
    if ((el.maxStress || 0) > 0) {
      out.stress = {
        onSetFilled: (s) => onCharacterRuntimeUpdate({ currentStress: s }),
        label: 'Stress',
        verbs: ['Mark', 'Clear'],
      };
    }
    if ((el.maxArmor || 0) > 0) {
      out.armor = {
        onSetFilled: (v) => {
          const upd = { currentArmor: v };
          if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
          onCharacterRuntimeUpdate(upd);
        },
        label: 'Armor',
        verbs: ['Mark', 'Clear'],
      };
    }
    if ((el.maxHp || 0) > 0) {
      out.hp = {
        onSetFilled: (dmg) => onCharacterRuntimeUpdate({ currentHp: (el.maxHp || 0) - dmg }),
        label: 'HP',
        verbs: ['Mark', 'Clear'],
      };
    }
    return out;
  }, [el, onCharacterRuntimeUpdate]);

  const hopeTrackInteraction = useMemo(() => {
    if (!onCharacterRuntimeUpdate) return null;
    const maxHope = el.maxHope ?? 6;
    if (maxHope <= 0) return null;
    return {
      filled: el.hope ?? maxHope,
      onSetFilled: (h) => onCharacterRuntimeUpdate({ hope: h }),
      trackKind: 'hope',
      label: 'Hope',
      verbs: ['Gain', 'Spend'],
      pulseOnDecreaseOnly: true,
    };
  }, [el, onCharacterRuntimeUpdate]);

  const { complete, missing } = isCharacterComplete(el, srdData ? { srdData } : undefined);
  return (
    <div className="flex flex-col gap-3 min-h-0 w-full min-w-0 lg:min-w-[48rem]">
      <CharacterSheetSourceHighlightProvider>
      <CharacterSheetHighlightSurface className="bg-dh-raised border border-dh-border rounded-xl shadow-2xl overflow-hidden flex flex-col min-h-0 flex-1 max-h-full w-full min-w-0">
        <CharacterIdentityHeader el={el} onOpenImageLightbox={onOpenImageLightbox} />
        {el.description && (
          <div className="px-3 pt-2 pb-2 shrink-0 bg-dh-canvas/30 w-full">
            <p className="text-[11px] text-dh-muted leading-relaxed italic">{el.description}</p>
          </div>
        )}
        {(el.maxHope ?? 0) > 0 && (
          <div className="px-3 py-2 shrink-0 bg-dh-canvas/30">
            <HopeHeroTrack el={el} hopeTrackInteraction={hopeTrackInteraction} />
          </div>
        )}
        {!complete && (
          <div className="mx-3 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded border border-amber-700/60 bg-amber-950/40 text-dh text-[11px] shrink-0">
            <AlertTriangle size={12} className="shrink-0" />
            <span>Incomplete — missing: {missing.join(', ')}</span>
          </div>
        )}
        <div className="p-3 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-3 items-start">
            <div className="space-y-3 min-w-0">
              <div className="space-y-2 min-w-0">
                <CharacterStatBlockGraphic
                  el={el}
                  variant="stack"
                  srdData={srdData}
                  hideHope
                  defenseTrackInteraction={defenseTrackInteraction}
                />
                <CharacterStatBlockGraphic
                  el={el}
                  variant="rail"
                  srdData={srdData}
                  hideHope
                  defenseTrackInteraction={defenseTrackInteraction}
                />
              </div>
              <CharacterTraitGrid
                el={el}
                omitOuterSection
                sheetEmphasisTitle="Traits"
                sheetEmphasisSubtitle="Action Rolls"
              />
              <CharacterExperiences el={el} omitOuterSection sheetEmphasisTitle="Experiences" />
              <CharacterFeaturesPanel el={el} omitActions omitDeclarativeCards />
            </div>
            <div className="space-y-3 min-w-0">
              <CharacterWeaponList el={el} omitOuterSection sheetEmphasisTitle="Offense" />
              <CharacterFeatureActionsEmphasisCard el={el} />
              <CharacterSheetDeclarativeCards el={el} interactionMode="preview" />
              <CharacterAbilityList el={el} />
              <CharacterVaultAbilityList el={el} />
              <CharacterInventory el={el} />
              {el.background && (
                <Section label="Background">
                  <p className="text-[11px] text-dh-muted leading-relaxed">{el.background}</p>
                </Section>
              )}
              {el.connectionText && (
                <Section label="Connections">
                  <p className="text-[11px] text-dh-muted leading-relaxed">{el.connectionText}</p>
                </Section>
              )}
            </div>
          </div>
        </div>
      </CharacterSheetHighlightSurface>
      </CharacterSheetSourceHighlightProvider>
    </div>
  );
}
