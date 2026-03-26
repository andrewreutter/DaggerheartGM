import { TIERS } from '../lib/constants.js';

/**
 * Reusable tier button bank for 1–4 tier selection.
 *
 * Props:
 *   value         - number (single-select) or number[] (multi-select)
 *   onChange      - (t) => void — t is the tier number clicked.
 *                   In multi mode, passes null when "All" is clicked.
 *   multi         - boolean. If true, value is number[] (multi-select toggle).
 *                   If false, value is a single number. Default false.
 *   showAll       - boolean. If true, shows an "All" button (multi mode only). Default false.
 *   activeClass   - CSS classes for a selected tier button.
 *   inactiveClass - CSS classes for an unselected tier button.
 *   btnClass      - CSS classes applied to every tier button.
 *   segmented     - If true, All + number buttons render as one bordered button group (single-select).
 */
const segmentedOff =
  'bg-dh-raised text-dh-muted transition-colors hover:bg-dh-hover hover:text-dh';
const segmentedBtn = 'rounded-none border-0 shadow-none shrink-0 px-2 py-0.5 font-medium transition-colors';

export function TierSelector({
  value,
  onChange,
  multi = false,
  showAll = false,
  numbers = TIERS,
  segmented = false,
  activeClass = 'bg-red-800 border-red-500 text-red-100',
  inactiveClass = 'bg-dh-raised border-dh-border text-dh-muted hover:border-dh-strong hover:text-dh',
  btnClass = 'px-2 py-0.5 rounded font-medium border transition-colors',
  /** When true, “All” uses inactive styling (another structural filter is active). */
  suppressAllHighlight = false,
  /** When set, called instead of `onChange(null)` for the All button (structural reset). */
  onAllClick = null,
}) {
  const tiers = multi ? (Array.isArray(value) ? value : []) : [];
  const isAllActive =
    showAll && !suppressAllHighlight && (multi ? tiers.length === 0 : value == null);
  const isActive = (t) => multi ? tiers.includes(t) : value === t;
  const off = segmented ? segmentedOff : inactiveClass;
  const b = segmented ? segmentedBtn : btnClass;
  const activeResolved = segmented ? `${activeClass} hover:brightness-110` : activeClass;

  return (
    <div
      className={
        segmented
          ? 'inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong'
          : 'flex flex-wrap items-center gap-1.5'
      }
    >
      {showAll && (
        <button
          type="button"
          onClick={() => (typeof onAllClick === 'function' ? onAllClick() : onChange(null))}
          className={`${b} ${isAllActive ? activeResolved : off}`}
        >
          All
        </button>
      )}
      {numbers.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`${b} ${isActive(t) ? activeResolved : off}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
