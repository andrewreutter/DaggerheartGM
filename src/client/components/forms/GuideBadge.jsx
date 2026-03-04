import { BookOpen } from 'lucide-react';

/**
 * Badge showing the RightKnight guide value or range for a stat field.
 * Renders to the right of the input. Clicking applies the baseline value.
 *
 * @param {Object} props
 * @param {string|number} props.guideValue - Baseline value to apply when clicked (or null if N/A)
 * @param {[number, number]} [props.guideRange] - Optional [min, max] from the guide for display
 * @param {string|number} props.currentValue - Current form value
 * @param {Function} props.onApply - () => void, called when user clicks to apply
 * @param {string} [props.title] - Tooltip text
 */
export function GuideBadge({ guideValue, guideRange, currentValue, onApply, title = "RightKnight's guide" }) {
  if (guideValue == null && !guideRange) return null;

  const display = guideRange
    ? (guideRange[0] === guideRange[1] ? String(guideRange[0]) : `${guideRange[0]}–${guideRange[1]}`)
    : String(guideValue);
  const applyValue = guideValue != null ? guideValue : (guideRange ? Math.floor((guideRange[0] + guideRange[1]) / 2) : null);
  const canApply = guideValue != null;
  const matches = currentValue != null && applyValue != null && String(currentValue) === String(applyValue);

  return (
    <button
      type="button"
      onClick={canApply ? onApply : undefined}
      title={title}
      disabled={!canApply}
      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
        !canApply
          ? 'bg-slate-800/40 text-slate-500 border-slate-700 cursor-default'
          : matches
            ? 'bg-slate-800/60 text-slate-400 border-slate-700'
            : 'bg-slate-800/80 text-slate-300 border-slate-600 hover:border-slate-500 hover:text-white'
      }`}
    >
      <BookOpen size={12} className="text-slate-500" />
      <span>{display}</span>
    </button>
  );
}
