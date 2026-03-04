import { useState, useRef, useEffect } from 'react';
import { BookOpen } from 'lucide-react';

/**
 * Icon button that opens a menu of RightKnight guide values.
 * Shows only the icon; click opens a popover with "Tier X [Role] Guide" title and options.
 *
 * @param {Object} props
 * @param {[number, number]} [props.guideRange] - [min, max] to generate numeric options
 * @param {Array<string|number>} [props.options] - Explicit options (e.g. dice pools for damage)
 * @param {string|number} props.value - Current form value
 * @param {Function} props.onChange - (value) => void
 * @param {number} [props.tier] - Tier for menu title (e.g. 1)
 * @param {string} [props.role] - Role for menu title (e.g. "standard")
 * @param {string} [props.title] - Tooltip text
 */
export function GuideRangeDropdown({ guideRange, options: optionsProp, value, onChange, tier, role, title = "RightKnight's guide" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const options = optionsProp ?? (guideRange && guideRange.length >= 2
    ? (() => { const [min, max] = guideRange; const a = []; for (let i = min; i <= max; i++) a.push(i); return a; })()
    : null);

  if (!options || options.length === 0) return null;

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  const menuTitle = tier != null && roleLabel ? `Tier ${tier} ${roleLabel} Guide` : 'Guide';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={title}
        className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors"
      >
        <BookOpen size={16} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 right-0 min-w-[5rem] w-max bg-slate-900 border border-slate-700 rounded shadow-xl overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-slate-400 border-b border-slate-800 bg-slate-800/60 whitespace-nowrap">
            {menuTitle}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = String(opt) === String(value);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${isSelected ? 'bg-slate-800/80 text-white' : 'text-slate-200'}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
