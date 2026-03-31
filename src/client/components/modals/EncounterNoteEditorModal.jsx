import { useEffect, useRef, useState } from 'react';
import { StickyNote, Eye, EyeOff } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';
import { MarkdownText } from '../../lib/markdown.js';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';

/**
 * Edit an encounter note (table-only markdown text + optional attached image).
 * @param {'players' | 'gm'} [props.visibility] — `'gm'` = GM only (hidden from players), default players-visible
 */
export function EncounterNoteEditorModal({
  open,
  name: initialName,
  body: initialBody,
  imageUrl: initialImageUrl,
  visibility: initialVisibility,
  onSave,
  onClose,
}) {
  const [name, setName] = useState(initialName || '');
  const [body, setBody] = useState(initialBody || '');
  const [visibility, setVisibility] = useState(initialVisibility === 'gm' ? 'gm' : 'players');
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName || '');
    setBody(initialBody || '');
    setVisibility(initialVisibility === 'gm' ? 'gm' : 'players');
    const id = window.setTimeout(() => {
      const el = titleInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => clearTimeout(id);
  }, [open, initialName, initialBody, initialVisibility]);

  return (
    <FullPageOverlay
      open={open}
      onClose={onClose}
      zIndexClass="z-[200]"
      maxWidthClass="max-w-3xl"
      heightClass="h-[min(88vh,720px)]"
      containerClassName="p-4 sm:p-6 pt-[4.5rem]"
    >
      <FullPageOverlayHeader
        title="Encounter note"
        titleId="encounter-note-editor-title"
        icon={StickyNote}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4">
        {initialImageUrl ? (
          <div className="shrink-0 overflow-hidden rounded-lg border border-dh-border bg-dh-inset/40">
            <img src={initialImageUrl} alt="" className="max-h-40 w-full object-contain object-left" />
          </div>
        ) : null}
        <label className="block shrink-0">
          <span className="text-xs font-semibold text-dh-muted">Title</span>
          <input
            ref={titleInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-dh-strong"
            placeholder="Short label"
          />
        </label>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-semibold text-dh-muted">Body (markdown)</span>
            <MarkdownHelpTooltip />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[200px] w-full resize-y rounded-lg border border-dh-strong bg-dh-raised p-3 font-mono text-xs text-dh outline-none focus:border-dh-strong"
              placeholder="Note text…"
              aria-labelledby="encounter-note-editor-title"
            />
            <div className="min-h-[200px] overflow-y-auto rounded-lg border border-dh-border bg-dh-inset/40 p-3">
              <MarkdownText text={body || '—'} className="dh-md text-sm text-dh" />
            </div>
          </div>
        </div>

        <button
          type="button"
          tabIndex={0}
          onClick={() => setVisibility(visibility === 'gm' ? 'players' : 'gm')}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-dh-border bg-dh-raised/60 px-3 py-2 text-left text-sm text-dh hover:bg-dh-hover/60"
        >
          {visibility === 'gm' ? <EyeOff size={18} className="text-dh-muted shrink-0" /> : <Eye size={18} className="text-dh-muted shrink-0" />}
          <span>{visibility === 'gm' ? 'GM only (hidden from players)' : 'Visible to players'}</span>
        </button>

        <div className="flex shrink-0 justify-end gap-2 border-t border-dh-border pt-3">
          <button
            type="button"
            tabIndex={0}
            onClick={onClose}
            className="rounded-lg border border-dh-strong px-4 py-2 text-sm text-dh hover:bg-dh-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            tabIndex={0}
            onClick={() => onSave?.({ name: name.trim() || 'Note', body, visibility })}
            className="rounded-lg border border-sky-700 bg-sky-900/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/60"
          >
            Save
          </button>
        </div>
      </div>
    </FullPageOverlay>
  );
}
