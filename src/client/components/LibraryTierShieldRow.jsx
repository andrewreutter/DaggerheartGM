import { TIERS } from '../lib/constants.js';
import { TierShieldBadge } from './TierShieldBadge.jsx';

const allBtn =
  'px-2 py-0.5 rounded font-medium border transition-colors shrink-0';
const inactive = 'bg-dh-raised border-dh-strong text-dh-muted hover:border-dh-strong hover:text-dh';
const active = 'bg-red-800 border-red-500 text-red-100';

/**
 * Library tier filter: shield buttons (single-select) + optional upscale column for tiers 2–4 (adversaries).
 * @param {number[]} tiers — at most one tier when filtered
 * @param {(key: 'tier', value: null|number|{ tier: number, scaled: boolean }) => void} onFilterChange
 */
export function LibraryTierShieldRow({
  tiers = [],
  includeScaledUp = false,
  showUpscale = false,
  onFilterChange,
  activeClass = active,
  inactiveClass = inactive,
  allBtnClass = allBtn,
  /** When true, “All” uses inactive styling even with no tier selected (another structural filter is active). */
  suppressAllHighlight = false,
  /** When set (e.g. structural reset), called instead of clearing tier — e.g. release lock from another row. */
  onAllClick = null,
}) {
  const single = tiers.length === 1 ? tiers[0] : null;
  const allActive = tiers.length === 0 && !suppressAllHighlight;

  const shieldWrap = (isOn) =>
    `rounded p-0.5 transition-colors border ${
      isOn
        ? 'bg-red-800 border-red-500 hover:brightness-110'
        : 'border-transparent hover:border-dh-strong/60 hover:bg-dh-hover/40'
    }`;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => (typeof onAllClick === 'function' ? onAllClick() : onFilterChange('tier', null))}
        className={`${allBtnClass} ${allActive ? activeClass : inactiveClass}`}
      >
        All
      </button>
      {TIERS.map(t => (
        <div key={t} className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onFilterChange('tier', t)}
            className={shieldWrap(single === t && !includeScaledUp)}
            aria-pressed={single === t && !includeScaledUp}
            aria-label={`Tier ${t}`}
          >
            <TierShieldBadge tier={t} size="sm" />
          </button>
          {showUpscale && t >= 2 && (
            <button
              type="button"
              onClick={() => onFilterChange('tier', { tier: t, scaled: true })}
              className={shieldWrap(single === t && !!includeScaledUp)}
              aria-pressed={single === t && !!includeScaledUp}
              aria-label={`Tier ${t} including scaled-up adversaries`}
            >
              <TierShieldBadge tier={t} upscaleFilter size="sm" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
