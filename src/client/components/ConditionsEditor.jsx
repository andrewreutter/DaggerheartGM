import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { normalizeConditionsToList, serializeConditionsList } from '../lib/conditions-utils.js';
import { conditionMarks, conditionSymbolForName } from '../lib/condition-symbols.js';
import { filterConditionsSuggestions, mergeConditionSuggestionLists } from '../lib/conditions-history.js';
import { ConditionSymbolIcon } from './ConditionSymbolIcon.jsx';

const DROPDOWN_MAX_HEIGHT = 220;
const DROPDOWN_GAP = 2;

/**
 * Multi-entry conditions editor. Parent state is server-driven (SSE); chip list
 * commits via `onCommit` (comma-joined string). Optional `suggestions` power a
 * shared per-table history picker.
 */
export function ConditionsEditor({
  value,
  instanceId,
  onCommit,
  className,
  placeholder = 'Add condition…',
  readOnly,
  disabled,
  autoFocus,
  onBlur: onBlurProp,
  'aria-label': ariaLabel,
  suggestions,
  extraSuggestions,
  onAddSuggestion,
  onRemoveSuggestion,
}) {
  const chips = normalizeConditionsToList(value);
  const marks = conditionMarks(chips);
  const displaySuggestions = mergeConditionSuggestionLists(suggestions, extraSuggestions);
  const historyHas = (entry) => {
    const lower = String(entry ?? '').trim().toLowerCase();
    if (!lower) return false;
    return (Array.isArray(suggestions) ? suggestions : []).some(
      (s) => String(s).trim().toLowerCase() === lower,
    );
  };
  const editable = !readOnly && typeof onCommit === 'function' && !disabled;
  const [draft, setDraft] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState(null);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    setDraft('');
    setSuggestionsOpen(false);
  }, [instanceId]);

  useEffect(() => {
    if (autoFocus && editable) {
      inputRef.current?.focus();
    }
  }, [autoFocus, editable, instanceId]);

  const filtered =
    displaySuggestions.length > 0
      ? filterConditionsSuggestions(displaySuggestions, draft, chips, 50)
      : [];

  useLayoutEffect(() => {
    if (!suggestionsOpen || !inputRef.current || filtered.length === 0) {
      setDropdownPos(null);
      return;
    }
    const rect = inputRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, rootRef.current?.getBoundingClientRect().width || rect.width, 160);
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP;
    const spaceAbove = rect.top - DROPDOWN_GAP;
    if (spaceBelow >= Math.min(DROPDOWN_MAX_HEIGHT, 120) || spaceBelow >= spaceAbove) {
      setDropdownPos({
        top: rect.bottom + DROPDOWN_GAP,
        left: rect.left,
        width,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(80, spaceBelow)),
      });
    } else {
      setDropdownPos({
        bottom: window.innerHeight - rect.top + DROPDOWN_GAP,
        left: rect.left,
        width,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(80, spaceAbove - 8)),
      });
    }
  }, [suggestionsOpen, draft, filtered.length, chips.length]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const handleClickOutside = (e) => {
      const inRoot = rootRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inRoot && !inDropdown) setSuggestionsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [suggestionsOpen]);

  const commitChips = (nextList) => {
    onCommit?.(serializeConditionsList(nextList));
  };

  const maybeAddSuggestion = (entry) => {
    if (!onAddSuggestion) return;
    if (!historyHas(entry)) onAddSuggestion(entry);
  };

  const addChip = (raw) => {
    const entry = String(raw ?? '').trim();
    if (!entry || !editable) return false;
    const lower = entry.toLowerCase();
    if (chips.some((c) => c.toLowerCase() === lower)) {
      setDraft('');
      return true;
    }
    const next = [...chips, entry];
    commitChips(next);
    maybeAddSuggestion(entry);
    setDraft('');
    return true;
  };

  const removeChip = (index) => {
    if (!editable) return;
    commitChips(chips.filter((_, i) => i !== index));
  };

  const handleDraftKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(draft.replace(/,$/, ''));
      return;
    }
    if (e.key === 'Backspace' && !draft && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  };

  const handleBlur = (e) => {
    const next = e.relatedTarget;
    if (rootRef.current?.contains(next) || dropdownRef.current?.contains(next)) return;
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      onBlurProp?.(e);
      return;
    }
    if (draft.trim()) addChip(draft);
    setSuggestionsOpen(false);
    onBlurProp?.(e);
  };

  if (!editable) {
    if (chips.length === 0) {
      return (
        <div className={className || 'text-xs text-dh-muted'} aria-label={ariaLabel}>
          {placeholder === 'Add condition…' ? 'none' : placeholder}
        </div>
      );
    }
    return (
      <div
        className={className || 'flex flex-wrap gap-1'}
        aria-label={ariaLabel}
        aria-readonly="true"
      >
        {marks.map((m) => (
          <span
            key={`${m.index}-${m.name}`}
            className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded bg-dh-hover border border-dh-strong text-xs text-dh"
          >
            <ConditionSymbolIcon symbol={m.symbol} size={12} />
            <span className="truncate">{m.name}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={
        className ||
        'flex flex-wrap items-center gap-1 w-full bg-dh-raised/50 border border-dh-strong rounded px-1.5 py-0.5'
      }
      aria-label={ariaLabel}
      onBlur={handleBlur}
    >
      {marks.map((m) => (
        <span
          key={`${m.index}-${m.name}`}
          className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded bg-dh-hover border border-dh-strong text-xs text-dh"
        >
          <ConditionSymbolIcon symbol={m.symbol} size={12} />
          <span className="truncate">{m.name}</span>
          <button
            type="button"
            className="shrink-0 p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-canvas/40"
            title={`Remove ${m.name}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => removeChip(m.index)}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="flex-1 min-w-[5rem] bg-transparent border-0 outline-none text-xs text-dh placeholder-dh-muted py-0.5"
        placeholder={chips.length === 0 ? placeholder : ''}
        disabled={disabled}
        value={draft}
        onFocus={() => {
          if (displaySuggestions.length > 0) setSuggestionsOpen(true);
        }}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) {
            const parts = v.split(',');
            const last = parts.pop();
            for (const part of parts) addChip(part);
            setDraft(last ?? '');
          } else {
            setDraft(v);
          }
          if (displaySuggestions.length > 0) setSuggestionsOpen(true);
        }}
        onKeyDown={handleDraftKeyDown}
      />
      {suggestionsOpen &&
        dropdownPos &&
        filtered.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[90] rounded-md border border-dh-strong bg-dh-raised shadow-xl overflow-y-auto"
            style={{
              top: dropdownPos.top,
              bottom: dropdownPos.bottom,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
            }}
            onMouseDown={(e) => {
              // Keep input focus; prevent blur-commit while picking a suggestion.
              e.preventDefault();
              skipBlurCommitRef.current = true;
            }}
          >
            {filtered.map((entry) => (
              <div
                key={entry}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-dh hover:bg-dh-hover cursor-pointer"
              >
                <ConditionSymbolIcon symbol={conditionSymbolForName(entry)} size={12} />
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left truncate"
                  onClick={() => {
                    addChip(entry);
                    setSuggestionsOpen(true);
                    inputRef.current?.focus();
                  }}
                >
                  {entry}
                </button>
                {onRemoveSuggestion && historyHas(entry) && (
                  <button
                    type="button"
                    className="shrink-0 p-0.5 rounded text-dh-muted hover:text-red-300"
                    title={`Remove "${entry}" from suggestions`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSuggestion(entry);
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
