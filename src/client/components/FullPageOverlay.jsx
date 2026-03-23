import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center ${containerClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
    >
      <button type="button" className={`absolute inset-0 ${overlayClassName}`} aria-label="Close" onClick={onClose} />
      <div
        className={`relative z-10 flex w-full ${heightClass} ${maxWidthClass} flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-2xl ${panelClassName}`}
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
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-white">
          {Icon && <Icon size={20} className="text-sky-400 shrink-0" aria-hidden />}
          <h2 id={titleId} className="text-lg font-semibold truncate">
            {title}
          </h2>
          {rightSlot}
        </div>
        {subtitle != null && subtitle !== '' && (
          <p className="mt-0.5 truncate font-mono text-xs text-slate-400" title={typeof subtitle === 'string' ? subtitle : undefined}>
            {subtitle}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        aria-label="Close"
      >
        <X size={20} />
      </button>
    </div>
  );
}
