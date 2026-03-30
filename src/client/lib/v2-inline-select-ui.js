/** Shared segmented control for V2 chips (sheet Actions strip + dice banner review chips). */
/** `isSelect` lists longer than this use a dropdown (e.g. large Prayer Dice pools). */
export const V2_REVIEW_CHIP_INLINE_OPTION_MAX = 8;

/**
 * Outer shell: column — title row ({@link V2_INLINE_GROUP_TITLE_ROW}) + segmented option rows.
 */
export const V2_INLINE_GROUP_OUTER =
  'flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-dh-border bg-dh-raised/50 dh-sheet-clickable-chip p-1';

/** Chip name, subtitle, cost icons — sits above {@link V2SegmentedRowWrap} option buttons. */
export const V2_INLINE_GROUP_TITLE_ROW =
  'flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0';

/** Horizontal scroll strip (e.g. ActionBanner life-support picker). */
export const V2_INLINE_GROUP_OUTER_SCROLL =
  'flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-dh-border bg-dh-raised/50 dh-sheet-clickable-chip p-1';

/**
 * Option buttons: width fits label text (no flex-grow); same flex-wrap flow as title/icons.
 */
export const V2_INLINE_SEG_BTN_BASE =
  'inline-flex w-fit max-w-full min-w-0 shrink-0 items-center justify-start rounded-md border border-dh-strong/70 bg-dh-surface/80 px-2 py-1.5 text-left text-[10px] font-medium leading-snug shadow-sm dh-sheet-clickable-chip transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none';

/** Target pickers (`selectTargets`): same sizing as {@link V2_INLINE_SEG_BTN_BASE}. */
export const V2_INLINE_SEG_TARGET_BTN = V2_INLINE_SEG_BTN_BASE;

export const V2_INLINE_SEG_OFF = 'text-dh hover:bg-dh-hover hover:border-dh-strong';
/** Selected segment: stronger fill, border, and ring so the active option reads clearly (Actions strip, iconGrid, banners). */
export const V2_INLINE_SEG_ON =
  'bg-sky-500/65 text-white border-sky-300/85 ring-2 ring-sky-300/55 shadow-md z-[1] font-semibold dh-light:bg-sky-600/80 dh-light:text-sky-950 dh-light:border-sky-700/60 dh-light:ring-sky-600/45';

/** One flex row of options joined as a segmented control (use with {@link V2_SEGMENT_BTN_BASE}). */
export const V2_SEGMENT_ROW_OUTER =
  'inline-flex flex-nowrap max-w-full min-w-0 rounded-md border border-dh-strong/70 bg-dh-surface/80 shadow-sm divide-x divide-dh-strong/50 overflow-hidden';

/**
 * Option styling inside {@link V2_SEGMENT_ROW_OUTER} — replaces {@link V2_INLINE_SEG_BTN_BASE}
 * (no per-button outer radius; row border + divide-x handle edges).
 */
export const V2_SEGMENT_BTN_BASE =
  'inline-flex w-fit max-w-full min-w-0 shrink-0 items-center justify-start rounded-none border-0 px-2 py-1.5 text-left text-[10px] font-medium leading-snug dh-sheet-clickable-chip transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-inset focus:z-10';

/**
 * @param {number[]} offsetTops — offsetTop per button (same order as options).
 * @returns {number[][]} — indices grouped per flex row.
 */
export function groupButtonIndicesByRow(offsetTops) {
  if (!offsetTops.length) return [];
  const groups = [];
  let cur = [];
  let prevTop = null;
  for (let i = 0; i < offsetTops.length; i++) {
    const top = offsetTops[i];
    if (prevTop !== null && Math.abs(top - prevTop) > 1) {
      groups.push(cur);
      cur = [];
    }
    prevTop = top;
    cur.push(i);
  }
  if (cur.length) groups.push(cur);
  return groups;
}
