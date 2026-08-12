/**
 * Layout constraints for the Action Log floating panel + manual dice builder.
 * Kept as named exports so unit tests can lock the policies that prevent:
 * - the expanded log pushing the dice roller off-screen
 * - die control columns squishing until the count is invisible
 * - oversized die-type label strips
 */

/** Cap the whole floating panel so it stays within the viewport above the title bar. */
export const ACTION_LOG_PANEL_MAX_HEIGHT = 'calc(100dvh - 6.5rem)';

/**
 * Cap the scrollable log list when expanded.
 * Intentionally well below a full viewport so the dice builder above it remains visible.
 */
export const ACTION_LOG_LIST_MAX_HEIGHT = 'min(360px, 40dvh)';

/**
 * Dice-builder open animation ceiling — tall enough for a wrapped second row of
 * die controls + preview tray, without unbounded growth.
 */
export const ACTION_LOG_DICE_BUILDER_MAX_HEIGHT = '32rem';

/**
 * Minimum width for each Duality / die-size / modifier column so the − / count / +
 * stepper stays readable; the row wraps when the container is narrower than N columns.
 */
export const DIE_CONTROL_COLUMN_MIN_WIDTH_PX = 88;

/** Tailwind class matching {@link DIE_CONTROL_COLUMN_MIN_WIDTH_PX}. */
export const DIE_CONTROL_COLUMN_MIN_WIDTH_CLASS = 'min-w-[5.5rem]';

/**
 * Compact height for the die-type label strip above each stepper.
 * Font size stays the same; only vertical chrome is reduced (was h-9 / 36px).
 */
export const DIE_TYPE_LABEL_HEIGHT_CLASS = 'h-6';

/**
 * True when `columnCount` columns at `minWidthPx` (+ gaps) cannot fit in `containerWidthPx`
 * on a single row — the flex-wrap layout should spill to a second row.
 */
export function dieControlsNeedWrap(containerWidthPx, columnCount, {
  minWidthPx = DIE_CONTROL_COLUMN_MIN_WIDTH_PX,
  gapPx = 6,
} = {}) {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) return false;
  if (!Number.isFinite(columnCount) || columnCount <= 0) return false;
  const gaps = Math.max(0, columnCount - 1) * gapPx;
  return columnCount * minWidthPx + gaps > containerWidthPx;
}
