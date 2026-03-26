/** Shared segmented control for V2 chips (sheet Actions strip + dice banner review chips). */
/** `isSelect` lists longer than this use a dropdown (e.g. large Prayer Dice pools). */
export const V2_REVIEW_CHIP_INLINE_OPTION_MAX = 8;

/** Equal-width segments when the whole row fits (isSelect, short target lists). */
export const V2_INLINE_SEG_BTN_BASE =
  'flex-1 min-w-0 px-2 py-1.5 text-[10px] font-medium border-l border-dh-border first:border-l-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Target pickers (`selectTargets`): never use `flex-1` so 9+ allies stay one row with horizontal scroll.
 */
export const V2_INLINE_SEG_TARGET_BTN =
  'shrink-0 min-w-[3.5rem] max-w-[11rem] px-2 py-1.5 text-[10px] font-medium border-l border-dh-border first:border-l-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const V2_INLINE_SEG_OFF = 'bg-dh-surface/60 text-dh hover:bg-dh-hover';
export const V2_INLINE_SEG_ON = 'bg-sky-950/50 text-dh ring-inset ring-1 ring-sky-500/35 z-[1]';
