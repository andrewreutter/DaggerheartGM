import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Custom dropdown for visual consistency with native selects.
 * Shows a button when closed; expands to a list when opened.
 *
 * @param {Object} props
 * @param {*} props.value - Current selected value
 * @param {Function} props.onChange - (value) => void
 * @param {Array} props.options - Array of option values
 * @param {Function} props.getOptionLabel - (value) => string
 * @param {Function} [props.getOptionDescription] - (value) => string | undefined
 * @param {string} [props.className]
 */
export function CustomSelect({ value, onChange, options, getOptionLabel, getOptionDescription, className = '' }) {
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

  const label = value != null ? getOptionLabel(value) : '';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-left flex items-center justify-between hover:border-slate-600 focus:outline-none focus:border-blue-500"
      >
        <span>{label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute z-20 mt-1 w-full bg-slate-900 border border-slate-700 rounded shadow-xl ${getOptionDescription ? 'min-w-[280px] max-h-72 overflow-y-auto' : ''}`}>
          {options.map((opt) => {
            const desc = getOptionDescription?.(opt);
            const isSelected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-b-0 ${isSelected ? 'bg-slate-800/80 text-white' : 'text-slate-200'}`}
              >
                <span className="font-medium">{getOptionLabel(opt)}</span>
                {desc && <span className="block text-sm text-slate-400 mt-0.5">{desc}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
