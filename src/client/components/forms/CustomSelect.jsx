import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Tooltip } from '../Tooltip.jsx';
import { usePortalHoverTooltip, PortalHoverTooltipLayer } from '../../lib/portal-hover-tooltip.jsx';
import { DH_OUTSIDE_DISMISS_EXEMPT_ATTR } from '../../lib/useHoverOverlay.js';

const DROPDOWN_MAX_HEIGHT = 288;
const DROPDOWN_GAP = 2;

/**
 * Custom dropdown for visual consistency with native selects.
 * Shows a button when closed; expands to a list when opened.
 * The option list is portaled to document.body with position:fixed so it is
 * bounded by the viewport (opens downward or upward to avoid being cut off).
 * Pass `anchorRef` to size and place the overlay from that element instead of the trigger.
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
 * @param {boolean} [props.truncateClosedLabel] — ellipsis the closed label (placeholder and selected value)
 * @param {boolean} [props.disabled] — Hard lock: no open (preview / no handler). Prefer this over `selectionBlocked`.
 * @param {boolean} [props.selectionBlocked] — Cannot confirm a choice (e.g. unaffordable cost, already used) but the menu may still open so option descriptions / tooltips work.
 * @param {string} [props.disabledReason] — Plain text when `disabled` (e.g. insufficient resources).
 * @param {import('react').ReactNode} [props.disabledTooltipContent] — Rich tooltip when `disabled` (e.g. preview mode + markdown); takes precedence over `disabledReason`.
 * @param {string} [props.className]
 * @param {string} [props.triggerClassName] — optional closed-button border/background (e.g. source-colored Actions strip)
 * @param {string} [props.dropdownClassName] - Extra classes for the dropdown panel
 * @param {boolean} [props.fixedDropdown] - Deprecated; dropdown is always viewport-positioned
 * @param {boolean} [props.tooltipWide] - Use a wider hover tooltip (long markdown)
 * @param {function} [props.renderTooltipExtra] - (value) => ReactNode — rendered below markdown; enables pointer-events on tooltip and delayed hide so content can be scrolled
 * @param {boolean} [props.open] — Controlled open state. Omit for internal toggle state.
 * @param {function} [props.onOpenChange] — `(nextOpen: boolean) => void` when the menu opens or closes
 * @param {import('react').RefObject<HTMLElement|null>} [props.anchorRef] — Overlay is positioned from this element (e.g. a compound trigger row) instead of the trigger button
 */
export function CustomSelect({ value, onChange, options, getOptionLabel, getOptionDescription, getOptionKey, renderOption, renderValue, renderPlaceholder, placeholder, truncateClosedLabel, disabled, selectionBlocked = false, disabledReason, disabledTooltipContent, className = '', triggerClassName = '', dropdownClassName = '', fixedDropdown = false, tooltipWide = false, renderTooltipExtra, open: openProp, onOpenChange, anchorRef = null }) {
  const isOpenControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpenControlled ? !!openProp : internalOpen;
  const setOpen = (next) => {
    const resolved = typeof next === 'function' ? next(open) : next;
    if (!isOpenControlled) setInternalOpen(resolved);
    onOpenChange?.(resolved);
  };
  const [dropdownPos, setDropdownPos] = useState(null); // { top?, bottom?, left, width, maxHeight } for portaled dropdown
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const portalHover = usePortalHoverTooltip();

  // Compute position relative to the browser window (viewport), not any scroll container.
  // Portaled to body so fixed positioning is viewport-relative and the dropdown isn't clipped.
  useLayoutEffect(() => {
    if (!open) {
      setDropdownPos(null);
      return;
    }
    const anchorEl = anchorRef?.current || ref.current?.querySelector('button');
    if (!anchorEl) {
      setDropdownPos(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
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
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) {
      portalHover.hide();
      return;
    }
    const handleClickOutside = (e) => {
      const inTrigger = ref.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      const inTooltipPanel = portalHover.tooltipRef.current?.contains(e.target);
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
  }, [open, portalHover.tooltipRef, portalHover.hide]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const hardDisabled = !!disabled;
  const softBlocked = !!selectionBlocked;

  const hasValue = value != null;
  const label = hasValue ? getOptionLabel(value) : (placeholder || '');
  const closedContent = hasValue
    ? (renderValue ? renderValue(value) : getOptionLabel(value))
    : (typeof renderPlaceholder === 'function' ? renderPlaceholder() : (placeholder || ''));

  const handleOptionMouseEnter = (opt, e) => {
    const desc = getOptionDescription?.(opt);
    const extra = renderTooltipExtra?.(opt);
    const extraKey = extra != null ? String(getOptionKey ? getOptionKey(opt) : opt) : null;
    if (!desc && extra == null) {
      portalHover.hide();
      return;
    }
    portalHover.showFromPointerEvent(e, {
      label: getOptionLabel(opt),
      description: desc || '',
      wide: tooltipWide,
      extra,
      extraKey,
    });
  };

  const triggerSurface = triggerClassName
    ? `${triggerClassName} rounded p-2`
    : 'bg-dh-inset border border-dh-border rounded p-2';

  const triggerTitle =
    hardDisabled && disabledReason && !disabledTooltipContent
      ? disabledReason
      : !hardDisabled && softBlocked && disabledReason
        ? disabledReason
        : undefined;

  const inner = (
    <div ref={ref} className={`relative w-full min-w-0 ${className}`}>
      <button
        type="button"
        disabled={hardDisabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={!hardDisabled && softBlocked ? true : undefined}
        title={triggerTitle}
        onClick={() => !hardDisabled && setOpen(!open)}
        className={`w-full ${triggerSurface} text-left flex items-center justify-between focus:outline-none focus:border-blue-500 ${
          open ? 'ring-1 ring-inset ring-blue-500' : ''
        } ${
          hardDisabled
            ? 'opacity-40 cursor-not-allowed'
            : softBlocked
              ? 'opacity-50 text-dh hover:border-dh-strong cursor-pointer'
              : 'text-dh hover:border-dh-strong'
        }`}
      >
        <span
          className={`flex-1 min-w-0 ${hasValue ? '' : 'text-dh-muted'} ${truncateClosedLabel && (hasValue || typeof renderPlaceholder !== 'function') ? 'truncate' : ''}`}
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
        <ChevronDown className={`w-4 h-4 text-dh-muted transition-transform shrink-0 ml-1 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          {...{ [DH_OUTSIDE_DISMISS_EXEMPT_ATTR]: '' }}
          className={`bg-dh-surface border border-dh-border rounded shadow-xl overflow-y-auto fixed z-[90] ${dropdownClassName}`}
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
              onMouseEnter={() => portalHover.hide()}
              className={`w-full text-left px-3 py-2.5 hover:bg-dh-hover transition-colors border-b border-dh-border text-dh-muted ${!hasValue ? 'bg-dh-raised/80' : ''}`}
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
                onClick={() => {
                  if (softBlocked) {
                    setOpen(false);
                    return;
                  }
                  onChange(opt);
                  setOpen(false);
                }}
                onMouseEnter={(e) => handleOptionMouseEnter(opt, e)}
                onMouseLeave={portalHover.scheduleClose}
                className={`relative w-full text-left px-3 py-2.5 hover:bg-dh-hover transition-colors border-b border-dh-border last:border-b-0 ${isSelected ? 'bg-dh-raised/80 text-dh' : 'text-dh'} ${hasDesc ? 'pr-6' : ''}`}
              >
                {renderOption
                  ? renderOption(opt, { isSelected })
                  : <span className="font-medium">{getOptionLabel(opt)}</span>
                }
                {hasDesc && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-dh-muted opacity-50" />
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}

      <PortalHoverTooltipLayer
        tooltip={portalHover.tooltip}
        tooltipRef={portalHover.tooltipRef}
        scheduleClose={portalHover.scheduleClose}
        clearLeaveTimer={portalHover.clearLeaveTimer}
      />
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

/**
 * Several labeled CustomSelects on one row. Opening any field shows the usual
 * portaled overlay, sized and placed immediately under the compound trigger row.
 *
 * @param {Object} props
 * @param {Array<{ key: string, label?: string, [selectProp: string]: * }>} props.fields
 * @param {import('react').ReactNode} [props.decoration] — persistent chrome directly under the trigger row
 * @param {string} [props.className]
 */
export function CompoundSelectRow({ fields, decoration, className = '' }) {
  const [openKey, setOpenKey] = useState(null);
  const rowRef = useRef(null);

  return (
    <div className={`mb-4 ${className}`}>
      <div ref={rowRef} className="grid grid-cols-4 gap-2">
        {fields.map((field) => {
          const { key, label, ...selectProps } = field;
          return (
            <div key={key} className="min-w-0 flex flex-col gap-1">
              {label ? (
                <label className="text-sm font-medium text-dh-muted truncate" title={label}>{label}</label>
              ) : null}
              <CustomSelect
                {...selectProps}
                truncateClosedLabel
                anchorRef={rowRef}
                open={openKey === key}
                onOpenChange={(next) => {
                  setOpenKey((prev) => (next ? key : (prev === key ? null : prev)));
                }}
              />
            </div>
          );
        })}
      </div>
      {decoration}
    </div>
  );
}
