import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTouchDevice } from '../lib/useTouchDevice.js';

/**
 * Instant tooltip (no browser delay). Shows on mouseEnter, hides on mouseLeave.
 * On touch devices: tap to show, tap anywhere outside to dismiss.
 *
 * Uses a React portal to render at document.body — this escapes overflow:hidden
 * ancestors so the tooltip is never clipped.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.label] - Tooltip text (also use as aria-label on icon-only buttons)
 * @param {React.ReactNode} [props.content] - Rich content (e.g. Markdown); when set, tooltip is wider and wraps
 * @param {'top'|'bottom'|'bottom-right'|'bottom-left'|'right'} [props.placement='bottom-right']
 * @param {string} [props.className] - Wrapper around children (default `relative inline-flex`). Use `relative block w-full min-w-0` for full-width controls so width matches the non-tooltip state.
 * @param {boolean} [props.showOnTouch=true] - When false, skip tap-to-toggle on touch (hover-only).
 */
export function Tooltip({ children, label, content, placement = 'bottom-right', className = 'relative inline-flex', showOnTouch = true }) {
  const [tooltipStyle, setTooltipStyle] = useState(null);
  const isTouch = useTouchDevice();
  const wrapperRef = useRef(null);
  const contentEmpty =
    content == null
    || content === ''
    || (typeof content === 'string' && content.trim() === '');
  const hasContent = (label != null && label !== '') || !contentEmpty;

  const show = () => {
    if (!wrapperRef.current || !hasContent) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const GAP = 6;
    let style = { position: 'fixed', zIndex: 9999 };
    if (placement === 'top') {
      style = { ...style, bottom: window.innerHeight - rect.top + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    } else if (placement === 'bottom') {
      style = { ...style, top: rect.bottom + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    } else if (placement === 'bottom-left') {
      style = { ...style, top: rect.bottom + GAP, left: rect.left };
    } else if (placement === 'right') {
      style = {
        ...style,
        left: rect.right + GAP,
        top: rect.top + rect.height / 2,
        transform: 'translateY(-50%)',
      };
    } else {
      // bottom-right: align right edge with trigger
      style = { ...style, top: rect.bottom + GAP, right: window.innerWidth - rect.right };
    }
    setTooltipStyle(style);
  };

  const hide = () => setTooltipStyle(null);

  // Touch: dismiss on tap outside
  useEffect(() => {
    if (!isTouch || !tooltipStyle) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) hide();
    };
    document.addEventListener('touchstart', handler, { passive: true });
    return () => document.removeEventListener('touchstart', handler);
  }, [isTouch, tooltipStyle]);

  const labelHasNewlines = typeof label === 'string' && label.includes('\n');
  const tooltip = tooltipStyle && hasContent && createPortal(
    <span
      style={tooltipStyle}
      className={`px-2 py-1.5 bg-dh-raised text-dh text-xs rounded pointer-events-none border border-dh-border shadow-xl ${
        content ? 'max-w-[280px] whitespace-normal text-left' : labelHasNewlines ? 'max-w-[280px] whitespace-pre-line text-left' : 'whitespace-nowrap'
      }`}
    >
      {content ?? label}
    </span>,
    document.body
  );

  return (
    <span
      ref={wrapperRef}
      className={className}
      onMouseEnter={() => { if (!isTouch) show(); }}
      onMouseLeave={() => { if (!isTouch) hide(); }}
      onClick={() => { if (isTouch && showOnTouch) (tooltipStyle ? hide() : show()); }}
    >
      {children}
      {tooltip}
    </span>
  );
}
