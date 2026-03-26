/**
 * Prototype graphical stat block: Hope hero row → evasion → damage thresholds → Stress / Armor / HP flow,
 * then armor feature cards (SRD) when not redundant with existing tooltips.
 */
import { ArrowDown, ArrowRight, Heart, Shield, Sparkles, Zap } from 'lucide-react';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { Tooltip } from './Tooltip.jsx';
import {
  isArmorFeatureEvasionOnlyTooltipRedundant,
  tierFromLevel,
} from '../lib/character-calc.js';
import {
  effectiveThresholds,
  formatArmorChipTooltip,
  formatEvasionModifierTooltip,
  formatStatModsTooltip,
  getEvasionModifierTotal,
} from '../lib/helpers.js';

function ChipTooltip({ content, children }) {
  const empty = content == null || (typeof content === 'string' && !content.trim());
  if (empty) return children;
  return (
    <Tooltip content={content} className="relative inline-flex w-full justify-center" placement="bottom">
      {children}
    </Tooltip>
  );
}

/** Preview demo armor cards (stable hash). Off = use SRD armor only. */
const PREVIEW_DEMO_ARMOR_CARDS = false;
const DEMO_ARMOR_FEATURE_POOL = [
  {
    name: 'Quiet',
    description: 'You gain a +2 bonus to rolls you make to move silently.',
  },
  {
    name: 'Reinforced',
    description:
      'When you mark your last Armor Slot, increase your damage thresholds by +2 until you clear at least 1 Armor Slot.',
  },
  {
    name: 'Fortified',
    description:
      'When you mark an Armor Slot, you reduce the severity of an attack by two thresholds instead of one.',
  },
];

function hashStringForDemo(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @returns {1 | 2} */
function demoArmorCardCount(el) {
  const key = String(el?.id ?? el?.instanceId ?? el?.name ?? 'character');
  return 1 + (hashStringForDemo(key) % 2);
}

function demoArmorFeaturesForPreview(el) {
  const n = demoArmorCardCount(el);
  const h = hashStringForDemo(String(el?.id ?? el?.instanceId ?? el?.name ?? 'x'));
  const out = [];
  for (let i = 0; i < n; i++) {
    const raw = DEMO_ARMOR_FEATURE_POOL[(h + i) % DEMO_ARMOR_FEATURE_POOL.length];
    out.push({ ...raw, name: `${raw.name} (RANDO)` });
  }
  return out;
}

/** Same `unwrap` context shape as {@link computeArmorModifiers} for per-feature redundancy checks. */
function buildGearSheetCtxFromEl(el) {
  return {
    computed: {
      traits: el.traits || {
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
      },
      tier: el.tier ?? tierFromLevel(el.level ?? 1),
      level: el.level ?? 1,
      proficiency: el.proficiency ?? 1,
    },
    raw: el,
  };
}

function ArmorFeatureCards({ armorItem, sheetCtx }) {
  const feats = (armorItem?.features || []).filter((f) => {
    const name = f?.name;
    if (!name) return false;
    return !isArmorFeatureEvasionOnlyTooltipRedundant(name, sheetCtx);
  });
  if (!feats.length) return null;
  return (
    <div className="flex flex-col gap-2 w-full min-w-0 pt-1">
      {feats.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="rounded-lg bg-dh-raised/80 ring-1 ring-dh-border px-2.5 py-2 min-w-0"
        >
          <div className="text-[10px] font-semibold text-dh">{f.name}</div>
          {(f.description || f.text) ? (
            <MarkdownText text={f.description || f.text} className="dh-md text-[10px] text-dh-muted mt-1 leading-snug" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Fits exactly three CheckboxTrack boxes (w-4 + gap-0.5); scrolls when total &gt; 3. */
function NarrowCheckboxTrack({ total, filled, fillColor, ...checkboxRest }) {
  if (!total || total <= 0) {
    return <span className="inline-block w-4 h-4 shrink-0" aria-hidden />;
  }
  return (
    <div className="max-w-[3.25rem] overflow-x-auto overflow-y-hidden mx-auto">
      <div className="inline-flex justify-center min-w-min">
        <CheckboxTrack total={total} filled={filled} fillColor={fillColor} {...checkboxRest} />
      </div>
    </div>
  );
}

function FlowArrow({ dir = 'right', className = '' }) {
  const Icon = dir === 'down' ? ArrowDown : ArrowRight;
  return (
    <div
      className={`flex items-center justify-center text-dh-muted/50 ${className}`}
      aria-hidden
    >
      <Icon className={dir === 'down' ? 'w-3.5 h-3.5' : 'w-3 h-3'} strokeWidth={2.25} />
    </div>
  );
}

/** Horizontal rule + chevron; grows with parent width (Armor → HP). */
function FlowSpanningArrowRight() {
  return (
    <div className="flex w-full min-w-2 items-center" aria-hidden>
      <div className="h-px flex-1 min-w-2 rounded-full bg-dh-muted/45" />
      <ArrowRight className="-ml-px h-3 w-3 shrink-0 text-dh-muted/50" strokeWidth={2.25} />
    </div>
  );
}

function ThresholdZones({ major, severe }) {
  /** Band label small; threshold range prominent; "N HP" de-emphasized */
  const rangeCls =
    'text-[11px] font-bold tabular-nums text-dh leading-tight dh-light:text-dh';
  const hpCls = 'text-[8px] font-medium tabular-nums text-dh-muted mt-0.5';
  return (
    <div className="grid grid-cols-3 gap-0.5 rounded-lg overflow-hidden ring-1 ring-dh-border min-h-[2.25rem]">
      <div className="bg-gradient-to-b from-red-950/45 via-red-950/25 to-red-950/15 dh-light:from-red-100/95 dh-light:via-red-50/50 dh-light:to-white px-1 py-1 flex flex-col justify-center items-center text-center border-r border-dh-border/60 ring-1 ring-red-900/25">
        <span className="text-[9px] font-bold text-red-100/95 dh-light:text-red-950">Minor</span>
        <span className={`${rangeCls} text-red-50/95 dh-light:text-red-950`}>
          ≤ {Math.max(0, major - 1)}
        </span>
        <span className={`${hpCls} text-red-100/80 dh-light:text-red-900/80`}>1 HP</span>
      </div>
      {/* Midway blend between Minor and Severe column washes */}
      <div className="bg-gradient-to-b from-red-950/60 via-red-900/40 to-red-950/30 dh-light:from-red-100/93 dh-light:via-rose-50/82 dh-light:to-red-50/78 px-1 py-1 flex flex-col justify-center items-center text-center border-r border-dh-border/60 ring-1 ring-red-900/28">
        <span className="text-[9px] font-bold text-dh">Major</span>
        <span className={rangeCls}>
          {major}–{severe - 1}
        </span>
        <span className={hpCls}>2 HP</span>
      </div>
      <div className="bg-gradient-to-b from-red-950/80 via-red-900/55 to-dh-raised/80 dh-light:from-red-100/90 dh-light:via-rose-50/90 dh-light:to-dh-raised px-1 py-1 flex flex-col justify-center items-center text-center ring-1 ring-red-900/35">
        <span className="text-[9px] font-bold text-dh">Severe</span>
        <span className={rangeCls}>≥ {severe}</span>
        <span className={hpCls}>3 HP</span>
      </div>
    </div>
  );
}

/**
 * DEFENSE left above Evasion; DAMAGE THRESHOLDS centered over bands; titles share baseline.
 */
function DamageThresholdSection({ evasionBlock, major, severe }) {
  if (major == null || severe == null) return null;

  const titleRow = (
    <div className="text-[10px] font-semibold text-dh-muted uppercase tracking-wider text-center w-full">
      DAMAGE THRESHOLDS
    </div>
  );

  if (!evasionBlock) {
    return (
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {titleRow}
        <ThresholdZones major={major} severe={severe} />
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-2 gap-y-1 items-start">
      <div className="col-start-1 row-start-1 flex items-end min-h-[1.25rem]">
        <span className="text-sm font-semibold text-dh-muted uppercase tracking-wider">Defense</span>
      </div>
      <div className="col-start-3 row-start-1 justify-self-center w-full min-w-0 flex items-end justify-center min-h-[1.25rem]">
        {titleRow}
      </div>
      <div className="col-start-1 row-start-2 self-center">{evasionBlock}</div>
      <div className="col-start-2 row-start-2 self-center">
        <FlowArrow dir="right" />
      </div>
      <div className="col-start-3 row-start-2 min-w-0 self-center">
        <ThresholdZones major={major} severe={severe} />
      </div>
    </div>
  );
}

/**
 * Hope row for sheet header / stat block. Read-only uses a 12-column grid when it divides evenly.
 * When `hopeTrackInteraction` is set (Game Table), uses {@link CheckboxTrack} — same behavior as Resources.
 * @param {{ el: object, hopeTrackInteraction?: Record<string, unknown> | null }} props
 */
export function HopeHeroTrack({ el, hopeTrackInteraction = null }) {
  const maxHope = el.maxHope ?? 6;
  if (maxHope <= 0) return null;

  const {
    filled: interactionFilled,
    ...hopeCheckboxRest
  } = hopeTrackInteraction && typeof hopeTrackInteraction === 'object' ? hopeTrackInteraction : {};
  const filled =
    hopeTrackInteraction != null && interactionFilled !== undefined
      ? interactionFilled
      : (el.hope ?? maxHope);

  if (hopeTrackInteraction != null) {
    return (
      <div className="w-full flex items-center gap-1.5 min-w-0">
        <Sparkles className={HOPE_ICON} strokeWidth={2.25} aria-hidden />
        <span className={HOPE_LABEL}>Hope</span>
        <div className="flex-1 min-w-0">
          <CheckboxTrack
            total={maxHope}
            filled={filled}
            fillColor="bg-amber-400"
            fillRow
            className="w-full gap-1"
            itemClassName="max-h-6 rounded border-2"
            pulseOnDecreaseOnly
            {...hopeCheckboxRest}
          />
        </div>
      </div>
    );
  }

  const useTwelveCol = 12 % maxHope === 0;
  const colSpan = useTwelveCol ? 12 / maxHope : 0;
  const boxes = Array.from({ length: maxHope }, (_, i) => {
    const isChecked = i < filled;
    const on = isChecked ? 'bg-amber-400 border-transparent' : 'border-dh-strong/80';
    return (
      <div
        key={i}
        className={`min-h-5 max-h-6 rounded border transition-colors ${on} ${useTwelveCol ? '' : 'flex-1 min-w-0'}`}
        style={useTwelveCol ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : undefined}
        aria-hidden
      />
    );
  });

  return (
    <div className="w-full flex items-center gap-1.5 min-w-0">
      <Sparkles className={HOPE_ICON} strokeWidth={2.25} aria-hidden />
      <span className={HOPE_LABEL}>Hope</span>
      {useTwelveCol ? (
        <div className="grid w-full min-w-0 grid-cols-12 gap-1">{boxes}</div>
      ) : (
        <div className="flex w-full min-w-0 gap-1">{boxes}</div>
      )}
    </div>
  );
}

/** ~1.4× prior 8px chip labels; icons match cap height */
const STAT_CHIP_LABEL = 'text-[11px] font-semibold uppercase tracking-wide leading-tight';
const STAT_CHIP_ICON = 'w-[11px] h-[11px] shrink-0';
/** HP chip: slightly larger label + icon than Stress/Armor */
const HP_CHIP_LABEL = 'text-[14px] font-semibold uppercase tracking-wide leading-tight';
const HP_CHIP_ICON = 'w-[14px] h-[14px] shrink-0';
const EVASION_LABEL = 'text-[13px] font-semibold uppercase tracking-wide';
/** Evasion shell matches Armor (cyan ring/labels); score uses sky (see evasionInner). */
const EVASION_ICON = 'w-[13px] h-[13px] shrink-0 text-cyan-400 dh-light:text-dh';
const HOPE_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-dh-muted shrink-0';
const HOPE_ICON = 'w-[11px] h-[11px] text-amber-600 dh-light:text-amber-800 shrink-0';

/** Hint under Armor / HP track titles (Daggerheart damage flow). */
const DEFENSE_TRACK_SUBTITLE =
  'text-[9px] font-normal normal-case tracking-normal text-dh-muted/90 text-center leading-tight px-0.5';

/** Shared vertical rhythm so Stress / Armor / HP chips match height; fixed width for 3-checkbox track + padding. */
const CHIP_PRIMARY_BOX = 'min-h-[2.25rem] flex items-center justify-center w-full';
const CHIP_TRACK_BOX = 'w-full flex justify-center min-h-[1.125rem] pt-0.5 border-t';
const CHIP_COL_W = 'w-[4.75rem] max-w-[4.75rem] shrink-0';

/**
 * Big cyan chip (Evasion-shaped): header, primary value, armor slot checkboxes.
 */
function ArmorStatChip({ el, compact, trackInteraction }) {
  const maxArmor = el.maxArmor ?? 0;
  const armor = el.currentArmor ?? 0;
  const armorScore = el.armorScore;
  const hasSlots = maxArmor > 0;
  const shell = compact ? 'px-1.5 py-1.5' : 'px-2 py-2';

  const primary = (() => {
    if (armorScore != null && armorScore > 0) {
      return (
        <div
          className={`font-bold tabular-nums leading-none ${compact ? 'text-lg' : 'text-xl'} text-cyan-100 dh-light:text-dh`}
        >
          {armorScore}
        </div>
      );
    }
    if (hasSlots) {
      return (
        <div
          className={`font-bold tabular-nums leading-none ${compact ? 'text-lg' : 'text-xl'} text-cyan-100 dh-light:text-dh`}
        >
          {maxArmor}
        </div>
      );
    }
    return (
      <div className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-dh-muted tabular-nums`}>—</div>
    );
  })();

  const tip = formatArmorChipTooltip(el);
  const inner = (
    <div
      className={`rounded-xl bg-dh-raised ring-1 ring-cyan-500/25 flex flex-col items-stretch gap-1.5 ${shell} ${CHIP_COL_W} h-full`}
    >
      <div className="flex flex-col items-center gap-0.5 w-full">
        <div className={`flex items-center justify-center gap-0.5 ${STAT_CHIP_LABEL} text-cyan-300/90 dh-light:text-dh text-center`}>
          <Shield className={`${STAT_CHIP_ICON} text-cyan-400 dh-light:text-dh`} strokeWidth={2.25} />
          Armor
        </div>
        <div className={DEFENSE_TRACK_SUBTITLE}>Mark 1?</div>
      </div>
      <div className={CHIP_PRIMARY_BOX}>
        {primary}
      </div>
      <div className={`${CHIP_TRACK_BOX} border-cyan-900/30`}>
        {hasSlots ? (
          <NarrowCheckboxTrack
            total={maxArmor}
            filled={armor}
            fillColor="bg-cyan-400"
            {...(trackInteraction || {})}
          />
        ) : (
          <span className="inline-block w-4 h-4 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  );

  return <ChipTooltip content={tip}>{inner}</ChipTooltip>;
}

/**
 * Big orange chip: Stress — mirrors HP (marked / max + track).
 */
function StressStatChip({ el, compact, trackInteraction }) {
  const maxStress = el.maxStress ?? 0;
  const stress = el.currentStress ?? 0;
  const shell = compact ? 'px-1.5 py-1.5' : 'px-2 py-2';
  const tip = formatStatModsTooltip(el, 'maxStress');

  if (maxStress <= 0) {
    const inner = (
      <div
        className={`rounded-xl bg-dh-raised ring-1 ring-orange-500/20 flex flex-col items-stretch gap-1.5 ${shell} ${CHIP_COL_W} h-full text-dh-muted`}
      >
        <div className={`flex items-center justify-center gap-0.5 ${STAT_CHIP_LABEL} text-orange-300/80 dh-light:text-dh text-center`}>
          <Zap className={`${STAT_CHIP_ICON} text-orange-400/80 dh-light:text-dh`} strokeWidth={2.25} />
          Stress
        </div>
        <div className={CHIP_PRIMARY_BOX}>
          <span className={compact ? 'text-xs' : 'text-sm'}>—</span>
        </div>
        <div className={`${CHIP_TRACK_BOX} border-orange-900/25`}>
          <span className="inline-block w-4 h-4 shrink-0" aria-hidden />
        </div>
      </div>
    );
    return <ChipTooltip content={tip}>{inner}</ChipTooltip>;
  }

  const inner = (
    <div
      className={`rounded-xl bg-dh-raised ring-1 ring-orange-500/25 flex flex-col items-stretch gap-1.5 ${shell} ${CHIP_COL_W} h-full`}
    >
      <div className={`flex items-center justify-center gap-0.5 ${STAT_CHIP_LABEL} text-orange-300/90 dh-light:text-dh text-center`}>
        <Zap className={`${STAT_CHIP_ICON} text-orange-400 dh-light:text-dh`} strokeWidth={2.25} />
        Stress
      </div>
      <div className={CHIP_PRIMARY_BOX}>
        <div className={`font-bold tabular-nums leading-none ${compact ? 'text-lg' : 'text-xl'} text-orange-100 dh-light:text-dh`}>
          {maxStress}
        </div>
      </div>
      <div className={`${CHIP_TRACK_BOX} border-orange-900/30`}>
        <NarrowCheckboxTrack
          total={maxStress}
          filled={stress}
          fillColor="bg-orange-500"
          {...(trackInteraction || {})}
        />
      </div>
    </div>
  );

  return <ChipTooltip content={tip}>{inner}</ChipTooltip>;
}

/**
 * Big red chip: header, current/max HP, damage checkboxes.
 */
function HpStatChip({ el, compact, trackInteraction }) {
  const maxHp = el.maxHp ?? 0;
  const currentHp = el.currentHp ?? maxHp;
  const hpDamage = maxHp > 0 ? maxHp - currentHp : 0;
  const shell = compact ? 'px-1.5 py-1.5' : 'px-2 py-2';
  const tip = formatStatModsTooltip(el, 'maxHp');

  if (maxHp <= 0) {
    const inner = (
      <div
        className={`rounded-xl bg-dh-raised ring-1 ring-red-500/20 flex flex-col items-stretch gap-1.5 ${shell} ${CHIP_COL_W} h-full text-dh-muted`}
      >
        <div className="flex flex-col items-center gap-0.5 w-full">
          <div className={`flex items-center justify-center gap-0.5 ${HP_CHIP_LABEL} text-red-300/80 dh-light:text-dh text-center`}>
            <Heart className={`${HP_CHIP_ICON} text-red-400/70 dh-light:text-dh`} strokeWidth={2.25} />
            HP
          </div>
          <div className={DEFENSE_TRACK_SUBTITLE}>Mark the rest</div>
        </div>
        <div className={CHIP_PRIMARY_BOX}>
          <span className={compact ? 'text-xs' : 'text-sm'}>—</span>
        </div>
        <div className={`${CHIP_TRACK_BOX} border-red-900/25`}>
          <span className="inline-block w-4 h-4 shrink-0" aria-hidden />
        </div>
      </div>
    );
    return <ChipTooltip content={tip}>{inner}</ChipTooltip>;
  }

  const inner = (
    <div
      className={`rounded-xl bg-dh-raised ring-1 ring-red-500/25 flex flex-col items-stretch gap-1.5 ${shell} ${CHIP_COL_W} h-full`}
    >
      <div className="flex flex-col items-center gap-0.5 w-full">
        <div className={`flex items-center justify-center gap-0.5 ${HP_CHIP_LABEL} text-red-300/90 dh-light:text-dh text-center`}>
          <Heart className={`${HP_CHIP_ICON} text-red-400 dh-light:text-dh`} strokeWidth={2.25} />
          HP
        </div>
        <div className={DEFENSE_TRACK_SUBTITLE}>Mark the rest</div>
      </div>
      <div className={CHIP_PRIMARY_BOX}>
        <div className={`font-bold tabular-nums leading-none ${compact ? 'text-lg' : 'text-xl'} text-red-100 dh-light:text-dh`}>
          {maxHp}
        </div>
      </div>
      <div className={`${CHIP_TRACK_BOX} border-red-900/30`}>
        <NarrowCheckboxTrack
          total={maxHp}
          filled={hpDamage}
          fillColor="bg-red-500"
          {...(trackInteraction || {})}
        />
      </div>
    </div>
  );

  return <ChipTooltip content={tip}>{inner}</ChipTooltip>;
}

/**
 * Full-width row: Stress (start) | Armor (center) | spanning → | HP (end); down arrow above Armor.
 */
function StressArmorHpChipRow({ el, compact, defenseTrackInteraction }) {
  return (
    <div className="w-full min-w-0 flex flex-col gap-1">
      <div className="flex w-full items-end">
        <div className="min-w-0 flex-1" aria-hidden />
        <div className="flex shrink-0 justify-center pb-0.5">
          <FlowArrow dir="down" />
        </div>
        <div className="min-w-0 flex-1" aria-hidden />
      </div>
      <div className="flex w-full min-w-0 items-stretch gap-2">
        <div className="flex min-w-0 flex-1 justify-start">
          <StressStatChip el={el} compact={compact} trackInteraction={defenseTrackInteraction?.stress} />
        </div>
        <div className="flex shrink-0">
          <ArmorStatChip el={el} compact={compact} trackInteraction={defenseTrackInteraction?.armor} />
        </div>
        <div className="flex min-w-0 flex-1 items-stretch gap-2">
          <div className="flex min-h-0 min-w-2 flex-1 items-center">
            <FlowSpanningArrowRight />
          </div>
          <HpStatChip el={el} compact={compact} trackInteraction={defenseTrackInteraction?.hp} />
        </div>
      </div>
    </div>
  );
}

/**
 * Optional interactive Stress / Armor / HP tracks (Game Table). Same semantics as Resources {@link CheckboxTrack} rows.
 * @typedef {{ onSetFilled?: (n: number) => void, pendingFilled?: number, pendingClearFilled?: number, label?: string, verbs?: [string, string], pulseOnDecreaseOnly?: boolean }} DefenseTrackSlice
 * @typedef {{ stress?: DefenseTrackSlice, armor?: DefenseTrackSlice, hp?: DefenseTrackSlice } | null | undefined} DefenseTrackInteraction
 *
 * @param {{ el: object, variant?: 'stack' | 'rail', compact?: boolean, srdData?: object, hideHope?: boolean, defenseFooter?: import('react').ReactNode, defenseTrackInteraction?: DefenseTrackInteraction, hopeTrackInteraction?: Record<string, unknown> | null }} props
 */
export function CharacterStatBlockGraphic({
  el,
  variant = 'stack',
  compact = false,
  srdData,
  hideHope = false,
  defenseFooter = null,
  defenseTrackInteraction = null,
  hopeTrackInteraction = null,
}) {
  const thresholds = effectiveThresholds(el);
  const evMod = getEvasionModifierTotal(el);
  const evasion = el.evasion;
  const major = thresholds?.major;
  const severe = thresholds?.severe;
  const pad = compact ? 'p-2' : 'p-2.5';
  const gap = compact ? 'gap-1.5' : 'gap-2';

  const sheetCtx = buildGearSheetCtxFromEl(el);
  const armorItem = srdData?.armorById?.[el.armorId] || null;

  const evasionTip = formatEvasionModifierTooltip(el);
  const evasionInner =
    evasion != null && (
      <div
        className={`rounded-xl bg-dh-raised ring-1 ring-cyan-500/25 flex flex-col items-center justify-center ${compact ? 'px-2 py-1.5 min-w-[4.5rem]' : 'px-3 py-2 min-w-[5.5rem]'}`}
      >
        <div className={`flex items-center gap-1 ${EVASION_LABEL} text-cyan-300/90 dh-light:text-dh`}>
          <Shield className={EVASION_ICON} strokeWidth={2.25} />
          Evasion
        </div>
        <div
          className={`font-bold tabular-nums leading-none ${compact ? 'text-xl' : 'text-2xl'} ${evMod ? 'text-sky-300 dh-light:text-sky-900' : 'text-sky-100 dh-light:text-dh'}`}
        >
          {evasion}
          {evMod ? <span className="text-sm font-semibold text-sky-400 dh-light:text-sky-800"> ({evMod > 0 ? '+' : ''}{evMod})</span> : null}
        </div>
      </div>
    );

  const evasionBlock =
    evasion != null ? (
      <Tooltip
        content={evasionTip || undefined}
        className="relative inline-flex"
        placement="bottom-right"
      >
        {evasionInner}
      </Tooltip>
    ) : null;

  const thresholdBlock =
    major != null && severe != null ? (
      <DamageThresholdSection evasionBlock={evasionBlock} major={major} severe={severe} />
    ) : (
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {evasionBlock}
        <div className="rounded-xl bg-dh-raised/50 ring-1 ring-dh-border px-2 py-2 text-[10px] text-dh-muted text-center">
          Thresholds appear when the character has armor (Major / Severe values).
        </div>
      </div>
    );

  const hopeSection =
    !hideHope && (el.maxHope ?? 0) > 0 ? (
      <div className={`w-full min-w-0 ${compact ? '' : ''}`}>
        <HopeHeroTrack el={el} hopeTrackInteraction={hopeTrackInteraction} />
      </div>
    ) : null;

  const armorCardsSection = PREVIEW_DEMO_ARMOR_CARDS ? (
    <ArmorFeatureCards armorItem={{ features: demoArmorFeaturesForPreview(el) }} sheetCtx={sheetCtx} />
  ) : armorItem ? (
    <ArmorFeatureCards armorItem={armorItem} sheetCtx={sheetCtx} />
  ) : null;

  const defenseBodyStack = (
    <div className={`flex flex-col ${gap} items-stretch`}>
      <div className="w-full min-w-0 max-w-full">{thresholdBlock}</div>
      <StressArmorHpChipRow el={el} compact={compact} defenseTrackInteraction={defenseTrackInteraction} />
      {armorCardsSection}
    </div>
  );

  const defenseCardShell = (
    <div className={`rounded-xl bg-gradient-to-b from-dh-surface to-dh-raised/80 border border-dh-border ${pad} space-y-2 min-w-0`}>
      {variant === 'rail' ? (
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-1 min-w-0 overflow-x-auto pb-1">
          <div className="min-w-[min(100%,12rem)] flex-1 flex flex-col min-h-0 shrink-0">{thresholdBlock}</div>
          <FlowArrow dir="right" className="shrink-0 self-center hidden lg:flex" />
          <div className="min-w-0 flex-1 lg:max-w-none shrink w-full">
            <StressArmorHpChipRow el={el} compact={compact} defenseTrackInteraction={defenseTrackInteraction} />
          </div>
        </div>
      ) : (
        defenseBodyStack
      )}
      {variant === 'rail' ? armorCardsSection : null}
      {defenseFooter}
    </div>
  );

  if (variant === 'rail') {
    return (
      <div className="flex flex-col gap-2 w-full min-w-0">
        {hopeSection}
        {defenseCardShell}
      </div>
    );
  }

  // stack: Hope above the DEFENSE card (not inside it)
  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      {hopeSection}
      <div className={`rounded-xl bg-gradient-to-b from-dh-surface to-dh-raised/80 border border-dh-border ${pad} space-y-2 min-w-0`}>
        {defenseBodyStack}
        {defenseFooter}
      </div>
    </div>
  );
}

/**
 * Same shell as the defense stat block: large title + gradient card (Traits / Offense / Experiences).
 */
export function CharacterSheetEmphasisCard({ title, subtitle, children, compact = false }) {
  const pad = compact ? 'p-2' : 'p-2.5';
  return (
    <div className={`rounded-xl bg-gradient-to-b from-dh-surface to-dh-raised/80 border border-dh-border ${pad} space-y-2 min-w-0`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 min-w-0">
        <span className="text-sm font-semibold text-dh-muted uppercase tracking-wider">{title}</span>
        {subtitle ? (
          <span className="text-[10px] font-semibold text-dh-muted/90 uppercase tracking-wider">{subtitle}</span>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
