import { useState, useRef, useEffect } from 'react';
import { useTouchDevice } from '../lib/useTouchDevice.js';

/**
 * Instant tooltip (no browser delay). Shows on mouseEnter, hides on mouseLeave.
 * On touch devices: tap to show, tap anywhere outside to dismiss.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} props.label - Tooltip text (also use as aria-label on icon-only buttons)
 * @param {'top'|'bottom'|'bottom-right'} [props.placement='bottom-right'] - bottom-right: below, right-aligned (avoids card overflow cutoff)
 */
export function Tooltip({ children, label, placement = 'bottom-right' }) {
  const [visible, setVisible] = useState(false);
  const isTouch = useTouchDevice();
  const wrapperRef = useRef(null);

  const positionClass =
    placement === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
      : placement === 'bottom'
        ? 'top-full left-1/2 -translate-x-1/2 mt-1.5'
        : 'top-full right-0 mt-1.5';

  // Touch: dismiss on tap outside
  useEffect(() => {
    if (!isTouch || !visible) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setVisible(false);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    return () => document.removeEventListener('touchstart', handler);
  }, [isTouch, visible]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => { if (!isTouch) setVisible(true); }}
      onMouseLeave={() => { if (!isTouch) setVisible(false); }}
      onClick={() => { if (isTouch) setVisible(v => !v); }}
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
