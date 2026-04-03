import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sticker } from 'lucide-react';

/**
 * Edit a table-local display name for a weapon, feature, or domain card.
 * @param {boolean} props.open
 * @param {string} props.originalName — SRD / card name (shown in parentheses when customized)
 * @param {string|undefined} props.initialCustom — stored nickname (if any)
 * @param {() => void} props.onClose
 * @param {(value: string) => void} props.onSave — receives trimmed nickname; empty clears override
 */
export function SheetDisplayNameDialog({
  open,
  originalName,
  initialCustom,
  onClose,
  onSave,
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const o = String(originalName ?? '').trim();
    const c = initialCustom != null ? String(initialCustom).trim() : '';
    setValue(c || o);
    const id = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => clearTimeout(id);
  }, [open, originalName, initialCustom]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const o = String(originalName ?? '').trim();
  const handleSave = () => {
    const t = value.trim();
    if (!t || t === o) onSave('');
    else onSave(t);
    onClose();
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-display-name-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-dh-border bg-dh-canvas shadow-xl p-4 text-dh"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sticker size={16} className="text-sky-400/90 shrink-0" aria-hidden />
          <h2 id="sheet-display-name-title" className="text-sm font-semibold">
            Custom name
          </h2>
        </div>
        <p className="text-[11px] text-dh-muted mb-2">
          Shown on your sheet and in rolls as <span className="text-dh">Nickname ({o || '…'})</span> when set.
        </p>
        <label className="block">
          <span className="text-[10px] font-medium text-dh-muted">Display name</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-sky-500/60"
            placeholder={o || 'Name'}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dh-border text-dh-muted hover:bg-dh-hover/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave('');
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dh-border text-dh-muted hover:bg-dh-hover/50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-700/80 hover:bg-sky-600 text-white border border-sky-600/60"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
