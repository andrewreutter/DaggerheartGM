import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown.js';
import { Tooltip } from '../Tooltip.jsx';

const TOOLTIP_WIDTH = 272;
/** Max width for rich markdown tooltips (Beastform, etc.). */
const TOOLTIP_WIDTH_WIDE = 448;
const TOOLTIP_GAP = 6;
const TOOLTIP_BOTTOM_PAD = 16;
const DROPDOWN_MAX_HEIGHT = 288;
const DROPDOWN_GAP = 2;

/**
 * Custom dropdown for visual consistency with native selects.
 * Shows a button when closed; expands to a list when opened.
 * Dropdown is always portaled to document.body with position:fixed so it is
 * bounded by the viewport (opens downward or upward to avoid being cut off).
 * When getOptionDescription is provided, hovering an option shows a tooltip
 * to the left or right depending on available viewport space.
 *
 * @param {Object} props
 * @param {*} props.value - Current selected value
 * @param {Function} props.onChange - (value) => void
 * @param {Array} props.options - Array of option values
 * @param {Function} props.getOptionLabel - (value) => string
 * @param {Function} [props.getOptionDescription] - (value) => string | undefined
 * @param {Function} [props.getOptionKey] - (value) => string (for React key; defaults to String(value))
 * @param {Function} [props.renderOption] - (value, { isSelected }) => ReactNode — custom option rendering
 * @param {Function} [props.renderValue] - (value) => ReactNode — custom closed-state rendering
 * @param {Function} [props.renderPlaceholder] - () => ReactNode — when value is null/undefined, render instead of the placeholder string (e.g. name + resource icons inside the trigger)
 * @param {string} [props.placeholder] - Shown when value is null/undefined (also used for the clear option in the dropdown and string fallback when renderPlaceholder is absent)
 * @param {boolean} [props.truncateClosedLabel] — when there is no selection, apply single-line ellipsis to the closed label
 * @param {boolean} [props.disabled]
 * @param {string} [props.disabledReason] — Plain text when `disabled` (e.g. insufficient resources).
 * @param {import('react').ReactNode} [props.disabledTooltipContent] — Rich tooltip when `disabled` (e.g. preview mode + markdown); takes precedence over `disabledReason`.
 * @param {string} [props.className]
 * @param {string} [props.dropdownClassName] - Extra classes for the dropdown panel
 * @param {boolean} [props.fixedDropdown] - Deprecated; dropdown is always viewport-positioned
 * @param {boolean} [props.tooltipWide] - Use a wider hover tooltip (long markdown)
 * @param {function} [props.renderTooltipExtra] - (value) => ReactNode — rendered below markdown; enables pointer-events on tooltip and delayed hide so content can be scrolled
 */
export function CustomSelect({ value, onChange, options, getOptionLabel, getOptionDescription, getOptionKey, renderOption, renderValue, renderPlaceholder, placeholder, truncateClosedLabel, disabled, disabledReason, disabledTooltipContent, className = '', dropdownClassName = '', fixedDropdown = false, tooltipWide = false, renderTooltipExtra }) {
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null); // { label, description, x, y, extra }
  const [dropdownPos, setDropdownPos] = useState(null); // { top?, bottom?, left, width, maxHeight } for portaled dropdown
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipLeaveTimerRef = useRef(null);

  const clearTooltipLeaveTimer = () => {
    if (tooltipLeaveTimerRef.current != null) {
      clearTimeout(tooltipLeaveTimerRef.current);
      tooltipLeaveTimerRef.current = null;
    }
  };

  const scheduleTooltipClose = () => {
    clearTooltipLeaveTimer();
    tooltipLeaveTimerRef.current = setTimeout(() => setTooltip(null), 180);
  };

  // After the tooltip renders, measure its actual height and nudge it up if it overflows the viewport.
  // Keyed on description so it only runs when content changes, not on the y adjustment itself.
  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const elBottom = tooltipRef.current.getBoundingClientRect().bottom;
    const overflow = elBottom - (window.innerHeight - TOOLTIP_BOTTOM_PAD);
    if (overflow > 0) {
      setTooltip(t => t ? { ...t, y: Math.max(TOOLTIP_BOTTOM_PAD, t.y - overflow) } : null);
    }
  }, [tooltip?.description, tooltip?.wide, tooltip?.extraKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute position relative to the browser window (viewport), not any scroll container.
  // Portaled to body so fixed positioning is viewport-relative and the dropdown isn't clipped.
  useLayoutEffect(() => {
    if (!open || !ref.current) { setDropdownPos(null); return; }
    const btn = ref.current.querySelector('button');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP;
    const spaceAbove = rect.top - DROPDOWN_GAP;
    if (spaceBelow >= DROPDOWN_MAX_HEIGHT) {
      setDropdownPos({
        top: rect.bottom + DROPDOWN_GAP,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, spaceBelow),
      });
    } else {
      setDropdownPos({
        bottom: window.innerHeight - rect.top + DROPDOWN_GAP,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, spaceAbove - 8),
      });
    }
  }, [open]);

  useEffect(() => () => clearTooltipLeaveTimer(), []);

  useEffect(() => {
    if (!open) {
      clearTooltipLeaveTimer();
      setTooltip(null);
      return;
    }
    const handleClickOutside = (e) => {
      const inTrigger = ref.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      const inTooltipPanel = tooltipRef.current?.contains(e.target);
      if (!inTrigger && !inDropdown && !inTooltipPanel) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const hasValue = value != null;
  const label = hasValue ? getOptionLabel(value) : (placeholder || '');
  const closedContent = hasValue
    ? (renderValue ? renderValue(value) : getOptionLabel(value))
    : (typeof renderPlaceholder === 'function' ? renderPlaceholder() : (placeholder || ''));

  const handleOptionMouseEnter = (opt, e) => {
    clearTooltipLeaveTimer();
    const desc = getOptionDescription?.(opt);
    const extra = renderTooltipExtra?.(opt);
    const extraKey = extra != null ? String(getOptionKey ? getOptionKey(opt) : opt) : null;
    if (!desc && extra == null) { setTooltip(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const panelW = tooltipWide ? Math.min(TOOLTIP_WIDTH_WIDE, window.innerWidth - 24) : TOOLTIP_WIDTH;
    const spaceRight = window.innerWidth - rect.right;
    const useRight = spaceRight >= panelW + TOOLTIP_GAP;
    const x = useRight ? rect.right + TOOLTIP_GAP : rect.left - panelW - TOOLTIP_GAP;
    // Start at the hovered row; overflow detection + nudge happens in useLayoutEffect
    const y = rect.top;
    setTooltip({
      label: getOptionLabel(opt),
      description: desc || '',
      x,
      y,
      wide: tooltipWide,
      extra,
      extraKey,
    });
  };

  const inner = (
    <div ref={ref} className={`relative w-full min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        title={disabled && disabledReason && !disabledTooltipContent ? disabledReason : undefined}
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full bg-slate-950 border border-slate-700 rounded p-2 text-left flex items-center justify-between focus:outline-none focus:border-blue-500 ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'text-white hover:border-slate-600'
        }`}
      >
        <span
          className={`flex-1 min-w-0 ${hasValue ? '' : 'text-slate-500'} ${!hasValue && truncateClosedLabel && typeof renderPlaceholder !== 'function' ? 'truncate' : ''}`}
          title={
            typeof closedContent === 'string'
              ? closedContent
              : typeof placeholder === 'string'
                ? placeholder
                : undefined
          }
        >
          {closedContent}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-1 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className={`bg-slate-900 border border-slate-700 rounded shadow-xl overflow-y-auto fixed z-[90] ${dropdownClassName}`}
          style={{
            top: dropdownPos.top,
            bottom: dropdownPos.bottom,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
          }}
        >
          {placeholder && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              onMouseEnter={() => setTooltip(null)}
              className={`w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-800 text-slate-500 ${!hasValue ? 'bg-slate-800/80' : ''}`}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt) => {
            const key = getOptionKey ? getOptionKey(opt) : String(opt);
            const isSelected = opt === value;
            const hasDesc = !!getOptionDescription?.(opt) || (renderTooltipExtra?.(opt) != null);
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                onMouseEnter={(e) => handleOptionMouseEnter(opt, e)}
                onMouseLeave={scheduleTooltipClose}
                className={`relative w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-b-0 ${isSelected ? 'bg-slate-800/80 text-white' : 'text-slate-200'} ${hasDesc ? 'pr-6' : ''}`}
              >
                {renderOption
                  ? renderOption(opt, { isSelected })
                  : <span className="font-medium">{getOptionLabel(opt)}</span>
                }
                {hasDesc && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-slate-500 opacity-50" />
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {tooltip && createPortal(
        <div
          ref={tooltipRef}
          className={`fixed z-[90] ${tooltip.extra ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            left: tooltip.x,
            top: tooltip.y,
            width: tooltip.wide ? Math.min(TOOLTIP_WIDTH_WIDE, window.innerWidth - 24) : TOOLTIP_WIDTH,
            maxHeight: window.innerHeight - TOOLTIP_BOTTOM_PAD,
          }}
          onMouseEnter={tooltip.extra ? clearTooltipLeaveTimer : undefined}
          onMouseLeave={tooltip.extra ? scheduleTooltipClose : undefined}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 overflow-y-auto max-h-[min(70vh,calc(100vh-32px))]">
            <div className="text-xs font-semibold text-white mb-1.5">{tooltip.label}</div>
            {!!tooltip.description?.trim() && (
              <div
                className="text-xs text-slate-300 leading-relaxed dh-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(tooltip.description) }}
              />
            )}
            {tooltip.extra}
          </div>
        </div>,
        document.body
      )}
    </div>
  );

  if (disabled && (disabledReason || disabledTooltipContent)) {
    return (
      <Tooltip
        content={disabledTooltipContent}
        label={disabledTooltipContent ? undefined : disabledReason}
        placement="bottom"
        className="relative flex w-full min-w-0"
      >
        {inner}
      </Tooltip>
    );
  }

  return inner;
}
