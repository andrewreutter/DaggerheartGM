import { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';
import { MarkdownText } from '../../lib/markdown.js';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';

/**
 * Edit an encounter note (table-only markdown text + optional attached image).
 */
export function EncounterNoteEditorModal({
  open,
  name: initialName,
  body: initialBody,
  imageUrl: initialImageUrl,
  onSave,
  onClose,
}) {
  const [name, setName] = useState(initialName || '');
  const [body, setBody] = useState(initialBody || '');

  useEffect(() => {
    if (!open) return;
    setName(initialName || '');
    setBody(initialBody || '');
  }, [open, initialName, initialBody]);

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
        <div className="flex shrink-0 justify-end gap-2 border-t border-dh-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-dh-strong px-4 py-2 text-sm text-dh hover:bg-dh-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave?.({ name: name.trim() || 'Note', body })}
            className="rounded-lg border border-sky-700 bg-sky-900/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/60"
          >
            Save
          </button>
        </div>
      </div>
    </FullPageOverlay>
  );
}
