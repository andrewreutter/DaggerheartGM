/**
 * Game Table pinned character sheet: column and unified-card widths.
 * The sheet body uses a fixed max column width; the title bar must share the same
 * total width or flex-1 can grow wider than the body (empty strip on the right).
 *
 * When the editor is open, sheet + editor share one horizontal budget (Characters
 * panel is w-56 + gap) so the pair never exceeds the viewport — see
 * CHARACTER_TABLE_*_WITH_EDITOR and characterTableUnifiedCardWidth(true).
 */

/** Horizontal space for the pinned card to the right of the Characters panel + gap (matches GMTableView overlay). */
export const CHARACTER_TABLE_CARD_AVAILABLE = 'calc(100vw - 14rem - 8px)';

/** Sheet column when the editor drawer is closed. */
export const CHARACTER_TABLE_SHEET_COLUMN_WIDTH = 'min(44rem, calc(100vw - 14rem - 8px))';

/** Editor drawer width when used alone (e.g. portal inner while column is collapsed). */
export const CHARACTER_TABLE_EDITOR_DRAWER_WIDTH = 'min(42rem, calc(100vw - 14rem - 8px))';

/**
 * Sheet column when both sheet and editor are visible: proportional share of
 * {@link CHARACTER_TABLE_CARD_AVAILABLE}, capped at 44rem.
 */
export const CHARACTER_TABLE_SHEET_COLUMN_WIDTH_WITH_EDITOR =
  'min(44rem, calc((100vw - 14rem - 8px) * 44 / 86))';

/**
 * Editor column when both are visible: proportional share, capped at 42rem.
 */
export const CHARACTER_TABLE_EDITOR_DRAWER_WIDTH_WITH_EDITOR =
  'min(42rem, calc((100vw - 14rem - 8px) * 42 / 86))';

/** Total width of the rounded shell (title bar + sheet + optional editor column). */
export function characterTableUnifiedCardWidth(editDrawerOpen) {
  return editDrawerOpen
    ? 'min(86rem, calc(100vw - 14rem - 8px))'
    : CHARACTER_TABLE_SHEET_COLUMN_WIDTH;
}
