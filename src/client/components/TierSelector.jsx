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
 */
export function TierSelector({
  value,
  onChange,
  multi = false,
  showAll = false,
  activeClass = 'bg-amber-700 border-amber-500 text-amber-100',
  inactiveClass = 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300',
  btnClass = 'px-2 py-0.5 rounded font-medium border transition-colors',
}) {
  const tiers = multi ? (Array.isArray(value) ? value : []) : [];
  const isAllActive = multi && tiers.length === 0;
  const isActive = (t) => multi ? tiers.includes(t) : value === t;

  return (
    <div className="flex items-center gap-1.5">
      {showAll && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`${btnClass} ${isAllActive ? activeClass : inactiveClass}`}
        >
          All
        </button>
      )}
      {TIERS.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`${btnClass} ${isActive(t) ? activeClass : inactiveClass}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
