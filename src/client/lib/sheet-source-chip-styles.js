/**
 * Character sheet Actions strip: chip colors by feature source (aligned with GuideFeatureCard source badges).
 * @see GuideFeatureCard.jsx source badge classes
 */

import {
  V2_INLINE_GROUP_OUTER,
  V2_INLINE_GROUP_OUTER_SCROLL,
  V2_INLINE_SEG_OFF,
  V2_INLINE_SEG_ON,
} from './v2-inline-select-ui.js';

/**
 * @typedef {Object} SheetSourceChipPalette
 * @property {string} groupOuter — replaces {@link V2_INLINE_GROUP_OUTER} for grouped isSelect / selectTargets
 * @property {string} segmentOff — replaces {@link V2_INLINE_SEG_OFF} (paired with V2_INLINE_SEG_BTN_BASE)
 * @property {string} segmentOn — selected segment (replaces generic sky {@link V2_INLINE_SEG_ON})
 * @property {string} segmentScrollOuter — horizontal scroll strip (e.g. segmented rows in banners)
 * @property {string} actionDefault — primary one-shot chip; icon grid idle
 * @property {string} actionActive — toggle on, icon grid selected
 * @property {string} toggleDeferRing — ring when awaiting GM ack on toggle
 * @property {string} triggerClosed — CustomSelect closed button (border + bg + hover)
 */

/** @type {Record<string, SheetSourceChipPalette>} */
const PALETTES = {
  class: {
    groupOuter:
      'flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-violet-700/50 bg-violet-950/25 dh-sheet-clickable-chip p-1',
    segmentScrollOuter:
      'flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-violet-700/50 bg-violet-950/25 dh-sheet-clickable-chip p-1',
    segmentOff: 'text-dh hover:bg-violet-900/35 hover:border-violet-600/60',
    segmentOn:
      'bg-violet-950/55 text-dh border-violet-500/45 ring-1 ring-violet-500/35 shadow-sm z-[1]',
    actionDefault:
      'dh-sheet-clickable-chip border-violet-700/50 bg-violet-950/35 text-violet-200 hover:bg-violet-900/45 hover:border-violet-600/70',
    actionActive:
      'dh-sheet-clickable-chip border-violet-500 bg-violet-800/65 text-violet-100 ring-1 ring-violet-500/45 hover:bg-violet-800/75',
    toggleDeferRing: 'ring-1 ring-violet-300/70 ring-offset-1 ring-offset-dh-canvas',
    triggerClosed: 'border-violet-700/50 bg-violet-950/25 hover:border-violet-600/70 hover:bg-violet-900/35',
  },
  subclass: {
    groupOuter:
      'flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-sky-700/50 bg-sky-950/25 dh-sheet-clickable-chip p-1',
    segmentScrollOuter:
      'flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-sky-700/50 bg-sky-950/25 dh-sheet-clickable-chip p-1',
    segmentOff: 'text-dh hover:bg-sky-900/35 hover:border-sky-600/60',
    segmentOn: V2_INLINE_SEG_ON,
    actionDefault:
      'dh-sheet-clickable-chip border-sky-700/50 bg-sky-950/35 text-sky-200 hover:bg-sky-900/45 hover:border-sky-600/70',
    actionActive:
      'dh-sheet-clickable-chip border-sky-500 bg-sky-800/65 text-sky-100 ring-1 ring-sky-500/45 hover:bg-sky-800/75',
    toggleDeferRing: 'ring-1 ring-sky-300/70 ring-offset-1 ring-offset-dh-canvas',
    triggerClosed: 'border-sky-700/50 bg-sky-950/25 hover:border-sky-600/70 hover:bg-sky-900/35',
  },
  ancestry: {
    groupOuter:
      'flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-amber-700/50 bg-amber-950/25 dh-sheet-clickable-chip p-1',
    segmentScrollOuter:
      'flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-amber-700/50 bg-amber-950/25 dh-sheet-clickable-chip p-1',
    segmentOff: 'text-dh hover:bg-amber-900/35 hover:border-amber-600/60',
    segmentOn:
      'bg-amber-950/55 text-dh border-amber-500/45 ring-1 ring-amber-500/35 shadow-sm z-[1]',
    actionDefault:
      'dh-sheet-clickable-chip border-amber-700/50 bg-amber-950/35 text-amber-200 hover:bg-amber-900/45 hover:border-amber-600/70',
    actionActive:
      'dh-sheet-clickable-chip border-amber-500 bg-amber-800/65 text-amber-100 ring-1 ring-amber-500/45 hover:bg-amber-800/75',
    toggleDeferRing: 'ring-1 ring-amber-300/70 ring-offset-1 ring-offset-dh-canvas',
    triggerClosed: 'border-amber-700/50 bg-amber-950/25 hover:border-amber-600/70 hover:bg-amber-900/35',
  },
  community: {
    groupOuter:
      'flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-emerald-700/50 bg-emerald-950/25 dh-sheet-clickable-chip p-1',
    segmentScrollOuter:
      'flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-emerald-700/50 bg-emerald-950/25 dh-sheet-clickable-chip p-1',
    segmentOff: 'text-dh hover:bg-emerald-900/35 hover:border-emerald-600/60',
    segmentOn:
      'bg-emerald-950/55 text-dh border-emerald-500/45 ring-1 ring-emerald-500/35 shadow-sm z-[1]',
    actionDefault:
      'dh-sheet-clickable-chip border-emerald-700/50 bg-emerald-950/35 text-emerald-200 hover:bg-emerald-900/45 hover:border-emerald-600/70',
    actionActive:
      'dh-sheet-clickable-chip border-emerald-500 bg-emerald-800/65 text-emerald-100 ring-1 ring-emerald-500/45 hover:bg-emerald-800/75',
    toggleDeferRing: 'ring-1 ring-emerald-300/70 ring-offset-1 ring-offset-dh-canvas',
    triggerClosed: 'border-emerald-700/50 bg-emerald-950/25 hover:border-emerald-600/70 hover:bg-emerald-900/35',
  },
  beastform: {
    groupOuter:
      'flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-teal-700/50 bg-teal-950/25 dh-sheet-clickable-chip p-1',
    segmentScrollOuter:
      'flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-teal-700/50 bg-teal-950/25 dh-sheet-clickable-chip p-1',
    segmentOff: 'text-dh hover:bg-teal-900/35 hover:border-teal-600/60',
    segmentOn:
      'bg-teal-950/55 text-dh border-teal-500/45 ring-1 ring-teal-500/35 shadow-sm z-[1]',
    actionDefault:
      'dh-sheet-clickable-chip border-teal-700/50 bg-teal-950/35 text-teal-200 hover:bg-teal-900/45 hover:border-teal-600/70',
    actionActive:
      'dh-sheet-clickable-chip border-teal-500 bg-teal-800/65 text-teal-100 ring-1 ring-teal-500/45 hover:bg-teal-800/75',
    toggleDeferRing: 'ring-1 ring-teal-300/70 ring-offset-1 ring-offset-dh-canvas',
    triggerClosed: 'border-teal-700/50 bg-teal-950/25 hover:border-teal-600/70 hover:bg-teal-900/35',
  },
  default: {
    groupOuter: V2_INLINE_GROUP_OUTER,
    segmentScrollOuter: V2_INLINE_GROUP_OUTER_SCROLL,
    segmentOff: V2_INLINE_SEG_OFF,
    segmentOn: V2_INLINE_SEG_ON,
    actionDefault:
      'dh-sheet-clickable-chip border-dh-border/60 bg-dh-raised/55 text-dh hover:bg-dh-hover/55 hover:border-dh-strong/70',
    actionActive:
      'dh-sheet-clickable-chip border-sky-600/60 bg-sky-950/50 text-sky-100 ring-1 ring-sky-500/40 hover:bg-sky-900/55',
    toggleDeferRing: 'ring-1 ring-sky-300/70 ring-offset-1 ring-offset-dh-canvas',
    triggerClosed: 'bg-dh-inset border border-dh-border hover:border-dh-strong',
  },
};

/**
 * Merged `activeFeatures` rows use `type` (`'class'`, `'subclass'`, …) but often omit `sourceType`.
 * Use this so sheet Actions chips match provenance (e.g. Seraph Life Support + Prayer Dice → class violet).
 *
 * @param {{ sourceType?: string, type?: string } | null | undefined} featRow
 * @param {string | undefined} modelSourceType — from {@link buildFeatureCardModel} (`row.sourceType`)
 * @returns {string | undefined}
 */
export function resolveSheetSourcePaletteKey(featRow, modelSourceType) {
  const raw = modelSourceType ?? featRow?.sourceType;
  /** `sourceType: 'ability'` is not a palette bucket — treat like domain LOADOUT rows. */
  const st = raw === 'ability' ? 'domain' : raw;
  if (st != null && st !== '') return st;
  const t = featRow?.type;
  if (t === 'class' || t === 'subclass' || t === 'ancestry' || t === 'community' || t === 'beastform') {
    return t;
  }
  /** LOADOUT domain abilities: same violet as class (see `getSheetSourceChipPalette('domain')`). */
  if (t === 'ability') return 'domain';
  return undefined;
}

/**
 * @param {string | undefined | null} sourceType — e.g. `class`, `subclass`, `domain`
 * @returns {SheetSourceChipPalette}
 */
export function getSheetSourceChipPalette(sourceType) {
  if (sourceType == null || sourceType === '') return PALETTES.default;
  /** Domain ability chips use the same violet as class features (not magic-token purple). */
  if (sourceType === 'domain' || sourceType === 'ability') return PALETTES.class;
  const p = PALETTES[sourceType];
  return p || PALETTES.default;
}

/**
 * Sheet Actions master strip: grouped chip shells should hug content (not stretch full column width).
 * @param {SheetSourceChipPalette} palette
 * @returns {SheetSourceChipPalette}
 */
export function intrinsicWidthActionsStripPalette(palette) {
  if (!palette || typeof palette !== 'object') return palette;
  return {
    ...palette,
    groupOuter: palette.groupOuter.replace(/\bflex w-full\b/g, 'flex w-auto max-w-full'),
    segmentScrollOuter: palette.segmentScrollOuter.replace(/\bflex w-full\b/g, 'flex w-auto max-w-full'),
  };
}
