import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { MarkdownText } from '../lib/markdown.js';
import { MarkdownHelpTooltip } from './MarkdownHelpTooltip.jsx';

const TEXT_DEBOUNCE_MS = 500;

/**
 * Panel-width encounter note editor (title + body + stacked preview).
 * Visibility applies immediately; title/body debounce and flush on blur/unmount.
 *
 * @param {object} props
 * @param {string} [props.noteKey] — hydrate when this id changes (instanceId)
 * @param {string} [props.name]
 * @param {string} [props.body]
 * @param {string} [props.imageUrl]
 * @param {'players' | 'gm'} [props.visibility]
 * @param {(patch: { name?: string, body?: string, visibility?: 'players' | 'gm' }) => void} props.onApplyPatch
 */
export function EncounterNoteEditorForm({
  noteKey,
  name: initialName,
  body: initialBody,
  imageUrl,
  visibility: initialVisibility,
  onApplyPatch,
}) {
  const [name, setName] = useState(initialName || '');
  const [body, setBody] = useState(initialBody || '');
  const [visibility, setVisibility] = useState(initialVisibility === 'gm' ? 'gm' : 'players');
  const titleInputRef = useRef(null);
  const nameRef = useRef(name);
  const bodyRef = useRef(body);
  const onApplyPatchRef = useRef(onApplyPatch);
  nameRef.current = name;
  bodyRef.current = body;
  onApplyPatchRef.current = onApplyPatch;

  const flushText = () => {
    onApplyPatchRef.current?.({
      name: String(nameRef.current || '').trim() || 'Note',
      body: bodyRef.current,
    });
  };

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate only when the open note changes
  }, [noteKey]);

  useEffect(() => {
    if (!noteKey) return undefined;
    const t = window.setTimeout(flushText, TEXT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [name, body, noteKey]);

  useEffect(() => () => flushText(), [noteKey]);

  return (
    <div className="flex flex-col gap-3">
      {imageUrl ? (
        <div className="overflow-hidden rounded-lg border border-dh-border bg-dh-inset/40">
          <img src={imageUrl} alt="" className="max-h-32 w-full object-contain object-left" />
        </div>
      ) : null}
      <label className="block">
        <span className="text-xs font-semibold text-dh-muted">Title</span>
        <input
          ref={titleInputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={flushText}
          className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-dh-strong"
          placeholder="Short label"
        />
      </label>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-dh-muted">Body (markdown)</span>
          <MarkdownHelpTooltip />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={flushText}
          className="min-h-[140px] w-full resize-y rounded-lg border border-dh-strong bg-dh-raised p-3 font-mono text-xs text-dh outline-none focus:border-dh-strong"
          placeholder="Note text…"
          aria-label="Note body"
        />
        <div className="min-h-[80px] overflow-y-auto rounded-lg border border-dh-border bg-dh-inset/40 p-3">
          <MarkdownText text={body || '—'} className="dh-md text-sm text-dh" />
        </div>
      </div>

      <button
        type="button"
        tabIndex={0}
        onClick={() => {
          const next = visibility === 'gm' ? 'players' : 'gm';
          setVisibility(next);
          onApplyPatch?.({ visibility: next });
        }}
        className="flex items-center gap-2 rounded-lg border border-dh-border bg-dh-raised/60 px-3 py-2 text-left text-sm text-dh hover:bg-dh-hover/60"
      >
        {visibility === 'gm' ? <EyeOff size={18} className="text-dh-muted shrink-0" /> : <Eye size={18} className="text-dh-muted shrink-0" />}
        <span>{visibility === 'gm' ? 'GM only (hidden from players)' : 'Visible to players'}</span>
      </button>
    </div>
  );
}
