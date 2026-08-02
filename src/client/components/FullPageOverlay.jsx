import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Selector for elements a keyboard user can Tab to (mirrors common ARIA dialog focus-trap implementations). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centered full-viewport modal shell: dimmed backdrop + rounded panel (same geometry as the Feature authoring guide).
 * Use for large read-only or edit surfaces (guide, feature source, and optionally item editors).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {import('react').ReactNode} props.children — typically {@link FullPageOverlayHeader} + scrollable body
 * @param {string} [props.zIndexClass='z-[200]']
 * @param {string} [props.maxWidthClass='max-w-6xl']
 * @param {string} [props.heightClass='h-[min(90vh,900px)]']
 * @param {string} [props.overlayClassName='bg-black/70']
 * @param {string} [props.containerClassName='p-4 sm:p-6'] — outer padding; item editors may use e.g. `pt-[4.5rem]` for nav clearance
 * @param {string} [props.panelClassName]
 * @param {string} [props.ariaLabelledBy]
 * @param {string} [props.ariaLabel] — when there is no title heading
 */
export function FullPageOverlay({
  open,
  onClose,
  children,
  zIndexClass = 'z-[200]',
  maxWidthClass = 'max-w-6xl',
  heightClass = 'h-[min(90vh,900px)]',
  overlayClassName = 'bg-black/70',
  containerClassName = 'p-4 sm:p-6',
  panelClassName = '',
  ariaLabelledBy,
  ariaLabel,
}) {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus management (T18): move focus into the panel when it opens, trap Tab/Shift+Tab
  // within it while open (so keyboard users can't tab into the page behind the backdrop),
  // and restore focus to whatever triggered the overlay once it closes.
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current = document.activeElement;

    const panel = panelRef.current;
    const focusable = panel ? panel.querySelectorAll(FOCUSABLE_SELECTOR) : [];
    (focusable[0] || panel)?.focus();

    const onKeyDown = (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const toRestore = previouslyFocusedRef.current;
      if (toRestore && document.contains(toRestore) && typeof toRestore.focus === 'function') {
        toRestore.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center ${containerClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        tabIndex={-1}
        className={`absolute inset-0 ${overlayClassName}`}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative z-10 flex w-full ${heightClass} ${maxWidthClass} flex-col overflow-hidden rounded-xl border border-dh-strong bg-dh-surface shadow-2xl outline-none ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Standard title row for {@link FullPageOverlay} (icon + title + optional subtitle + close).
 */
export function FullPageOverlayHeader({
  title,
  titleId,
  icon: Icon,
  onClose,
  rightSlot,
  subtitle,
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-dh-strong px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-dh">
          {Icon && <Icon size={20} className="text-sky-400 shrink-0" aria-hidden />}
          <h2 id={titleId} className="text-lg font-semibold truncate">
            {title}
          </h2>
          {rightSlot}
        </div>
        {subtitle != null && subtitle !== '' && (
          <p className="mt-0.5 truncate font-mono text-xs text-dh-muted" title={typeof subtitle === 'string' ? subtitle : undefined}>
            {subtitle}
          </p>
        )}
      </div>
      <button
        type="button"
        tabIndex={0}
        onClick={onClose}
        className="shrink-0 rounded-md p-2 text-dh-muted hover:bg-dh-raised hover:text-dh"
        aria-label="Close"
      >
        <X size={20} />
      </button>
    </div>
  );
}
