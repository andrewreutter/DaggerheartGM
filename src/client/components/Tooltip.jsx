import { useState } from 'react';

/**
 * Instant tooltip (no browser delay). Shows on mouseEnter, hides on mouseLeave.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} props.label - Tooltip text (also use as aria-label on icon-only buttons)
 * @param {'top'|'bottom'|'bottom-right'} [props.placement='bottom-right'] - bottom-right: below, right-aligned (avoids card overflow cutoff)
 */
export function Tooltip({ children, label, placement = 'bottom-right' }) {
  const [visible, setVisible] = useState(false);

  const positionClass =
    placement === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
      : placement === 'bottom'
        ? 'top-full left-1/2 -translate-x-1/2 mt-1.5'
        : 'top-full right-0 mt-1.5';

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && label && (
        <span
          className={`absolute ${positionClass} px-2 py-1 bg-slate-800 text-slate-200 text-xs rounded whitespace-nowrap z-50 pointer-events-none border border-slate-700 shadow-lg`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
