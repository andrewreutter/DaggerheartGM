import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Bug,
  Check,
  Copy,
  GripVertical,
  Inbox,
  Lightbulb,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  ShieldOff,
  Tag,
  X,
} from 'lucide-react';
import { fetchAdminBugReports, fetchMe, postAdminBugReportCreate, postAdminBugReportNotes, postAdminBugReportStatus, putUserPreferences } from '../lib/api.js';
import { buildBugReportDebugText } from '../lib/bug-report-debug-text.js';
import {
  addBugReportColumn,
  bugReportSelectionState,
  normalizeBugReportColumns,
  otherBugReportStatuses,
  readStoredBugReportColumns,
  readStoredBugReportTab,
  reorderBugReportColumns,
  resolveBugReportTab,
  setBugReportVisibleSelection,
  toggleBugReportSelection,
  writeStoredBugReportColumns,
  writeStoredBugReportTab,
} from '../lib/bug-report-admin.js';

const PAGE_SIZE = 50;

/** Built-in column chrome; custom columns fall back to Tag + the stored label. */
const STATUS_CONFIG = {
  triage: { icon: Inbox, emptyText: 'No problem reports yet.' },
  bug: { icon: Bug, emptyText: 'No bug reports yet.' },
  feature: { icon: Lightbulb, emptyText: 'No feature requests yet.' },
  completed: { icon: Check, emptyText: 'No completed reports yet.' },
  shipped: { icon: Rocket, emptyText: 'No shipped reports yet.' },
  cancelled: { icon: Ban, emptyText: 'No cancelled reports yet.' },
};

function columnMeta(id, columns) {
  const col = columns.find(c => c.id === id);
  const preset = STATUS_CONFIG[id];
  const label = col?.label ?? preset?.label ?? id;
  return {
    label,
    icon: preset?.icon ?? Tag,
    emptyText: preset?.emptyText ?? `No ${label.toLowerCase()} reports yet.`,
  };
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

function RoleBadge({ role }) {
  if (!role) return null;
  const styles = {
    gm: 'bg-sky-900/60 text-sky-300 border border-sky-700/60',
    player: 'bg-violet-900/60 text-violet-300 border border-violet-700/60',
    admin: 'bg-red-900/60 text-red-200 border border-red-700/60',
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        styles[role] ?? styles.player
      }`}
    >
      {role}
    </span>
  );
}

function CopyButton({ row }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const handleCopy = useCallback(async () => {
    if (copied) return;
    try {
      const text = buildBugReportDebugText(row);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied — no-op, user can still see the JSON by expanding
    }
  }, [row, copied]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy debug bundle to clipboard'}
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
        copied
          ? 'bg-emerald-800/60 text-emerald-300 border border-emerald-700/60'
          : 'bg-dh-raised border border-dh-border text-dh-muted hover:text-dh hover:border-dh-strong hover:bg-dh-hover'
      }`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function StatusMoveButtons({ currentStatus, columns, onMove, isPending, size = 'sm' }) {
  const otherStatuses = otherBugReportStatuses(currentStatus, columns);
  const pad = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {otherStatuses.map(status => {
        const { label, icon: Icon } = columnMeta(status, columns);
        return (
          <button
            key={status}
            type="button"
            onClick={() => onMove(status)}
            disabled={isPending}
            title={`Move to ${label}`}
            className={`inline-flex items-center gap-1 rounded ${pad} text-xs font-medium bg-dh-raised border border-dh-border text-dh-muted hover:text-dh hover:border-dh-strong hover:bg-dh-hover disabled:opacity-50`}
          >
            <Icon size={12} className={isPending ? 'animate-spin' : ''} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ColumnTabs({ columns, tab, onSelect, onReorder, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [addError, setAddError] = useState(null);
  const dragIdRef = useRef(null);
  const didDragRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const commitAdd = useCallback(() => {
    const result = addBugReportColumn(columns, draft);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setDraft('');
    setAddError(null);
    setAdding(false);
    onAdd(result.columns, result.column.id);
  }, [columns, draft, onAdd]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 border-b border-dh-border flex-wrap">
        {columns.map((col) => {
          const { label, icon: Icon } = columnMeta(col.id, columns);
          const active = tab === col.id;
          return (
            <button
              key={col.id}
              type="button"
              draggable
              title="Drag to reorder"
              onDragStart={(e) => {
                dragIdRef.current = col.id;
                didDragRef.current = false;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', col.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromId = dragIdRef.current || e.dataTransfer.getData('text/plain');
                const fromIndex = columns.findIndex(c => c.id === fromId);
                const toIndex = columns.findIndex(c => c.id === col.id);
                if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                  didDragRef.current = true;
                  onReorder(fromIndex, toIndex);
                }
                dragIdRef.current = null;
              }}
              onDragEnd={() => {
                dragIdRef.current = null;
              }}
              onClick={() => {
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                onSelect(col.id);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-grab active:cursor-grabbing ${
                active
                  ? 'border-red-500 text-dh'
                  : 'border-transparent text-dh-muted hover:text-dh'
              }`}
            >
              <GripVertical size={12} className="opacity-50" />
              <Icon size={14} />
              {label}
            </button>
          );
        })}
        {adding ? (
          <form
            className="inline-flex items-center gap-1.5 px-2 py-1 -mb-px"
            onSubmit={(e) => {
              e.preventDefault();
              commitAdd();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                setAddError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setAdding(false);
                  setDraft('');
                  setAddError(null);
                }
              }}
              placeholder="Column name"
              maxLength={32}
              aria-label="New column name"
              className="w-36 rounded border border-dh-border bg-dh-raised text-dh text-xs px-2 py-1 focus:outline-none focus:border-dh-strong focus:ring-1 focus:ring-dh-strong/40"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-emerald-800/60 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-700/60"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft('');
                setAddError(null);
              }}
              className="inline-flex items-center rounded px-2 py-1 text-xs font-medium text-dh-muted hover:text-dh"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            title="Add column"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border-b-2 -mb-px border-transparent text-dh-muted hover:text-dh"
          >
            <Plus size={14} />
            Add column
          </button>
        )}
      </div>
      {addError && <p className="text-xs text-red-400">{addError}</p>}
    </div>
  );
}

function SortableHeader({ label, columnKey, sortColumn, sortDir, onSort }) {
  const active = sortColumn === columnKey;
  return (
    <th className="px-3 py-2 font-medium whitespace-nowrap">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 hover:text-dh transition-colors ${active ? 'text-dh' : ''}`}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowDown size={12} className="opacity-0" />
        )}
      </button>
    </th>
  );
}

function NotesCell({ row, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const textareaRef = useRef(null);

  const notes = row.payload?.notes ?? '';

  const startEdit = useCallback(() => {
    setDraft(notes);
    setSaveError(null);
    setEditing(true);
  }, [notes]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { item } = await postAdminBugReportNotes(row.id, draft);
      onSaved(row.id, item);
      setEditing(false);
    } catch (e) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [row.id, draft, onSaved]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }, [handleCancel, handleSave]);

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[16rem]">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Add admin notes…"
          className="w-full rounded border border-dh-border bg-dh-raised text-dh text-xs px-2 py-1 resize-y focus:outline-none focus:border-dh-strong focus:ring-1 focus:ring-dh-strong/40"
        />
        {saveError && (
          <p className="text-xs text-red-400">{saveError}</p>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            title="Save notes (Ctrl+Enter)"
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-emerald-800/60 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-700/60 disabled:opacity-50"
          >
            <Check size={11} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            title="Cancel (Escape)"
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-dh-raised border border-dh-border text-dh-muted hover:text-dh hover:border-dh-strong disabled:opacity-50"
          >
            <X size={11} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/notes flex items-start gap-1.5 max-w-xs">
      <div className="flex-1 min-w-0">
        {notes ? (
          <span className="text-xs text-dh whitespace-pre-wrap break-words">{notes}</span>
        ) : (
          <span className="text-xs text-dh-muted italic">no notes</span>
        )}
      </div>
      <button
        type="button"
        onClick={startEdit}
        title="Edit notes"
        className="shrink-0 opacity-0 group-hover/notes:opacity-100 focus:opacity-100 transition-opacity rounded p-0.5 text-dh-muted hover:text-dh hover:bg-dh-hover"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

function QuickAddItemForm({ columnLabel, status, disabled, onCreated }) {
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = notes.trim().length > 0 && !pending && !disabled;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = notes.trim();
    if (!trimmed || pending || disabled) return;
    setPending(true);
    setError(null);
    try {
      const { item } = await postAdminBugReportCreate(trimmed, status);
      if (!item) throw new Error('No item returned');
      onCreated(item);
      setNotes('');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setPending(false);
    }
  }, [notes, pending, disabled, status, onCreated]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`Add to ${columnLabel}…`}
          disabled={pending || disabled}
          aria-label={`Add item to ${columnLabel}`}
          className="flex-1 min-w-0 rounded-md border border-dh-border bg-dh-raised px-3 py-2 text-sm text-dh placeholder:text-dh-muted focus:outline-none focus:border-red-700 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 shrink-0 rounded-md px-3 py-2 text-sm font-medium bg-red-950/50 border border-red-700 text-red-200 hover:bg-red-900 disabled:opacity-50"
        >
          {pending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-300">{error}</p>
      )}
    </form>
  );
}

/**
 * @param {{ navigate: (path: string, opts?: object) => void }} props
 */
export function AdminBugReportsPage({ navigate }) {
  const [columns, setColumns] = useState(() => readStoredBugReportColumns() ?? normalizeBugReportColumns(null));
  const [tab, setTab] = useState(() => readStoredBugReportTab(readStoredBugReportColumns() ?? normalizeBugReportColumns(null)));
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [sortColumn, setSortColumn] = useState(null); // 'time' | 'reporter'
  const [sortDir, setSortDir] = useState('desc');
  const selectAllRef = useRef(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const selectTab = useCallback((nextTab) => {
    const resolved = resolveBugReportTab(nextTab, columns);
    setTab(resolved);
    writeStoredBugReportTab(resolved);
  }, [columns]);

  const persistColumns = useCallback(async (nextColumns, { selectId } = {}) => {
    const normalized = normalizeBugReportColumns(nextColumns);
    setColumns(normalized);
    writeStoredBugReportColumns(normalized);
    const nextTab = selectId && normalized.some(c => c.id === selectId)
      ? selectId
      : (normalized.some(c => c.id === tabRef.current) ? tabRef.current : normalized[0]?.id);
    if (nextTab && nextTab !== tabRef.current) {
      setTab(nextTab);
      writeStoredBugReportTab(nextTab);
    }
    try {
      await putUserPreferences({ bugReportColumns: normalized });
    } catch {
      // localStorage still has the layout
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then(({ preferences }) => {
        if (cancelled || !preferences?.bugReportColumns) return;
        const next = normalizeBugReportColumns(preferences.bugReportColumns);
        setColumns(next);
        writeStoredBugReportColumns(next);
        if (!next.some(c => c.id === tabRef.current)) {
          const fallback = next[0]?.id ?? 'triage';
          setTab(fallback);
          writeStoredBugReportTab(fallback);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async ({ replace = true, offset: offsetOverride, currentLength = 0 } = {}) => {
    if (replace) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const offset = replace ? 0 : offsetOverride ?? currentLength;
      const json = await fetchAdminBugReports({ limit: PAGE_SIZE, offset, status: tab });
      setTotalCount(json.totalCount ?? null);
      setItems(prev => (replace ? json.items : [...prev, ...json.items]));
      if (replace) setSelectedIds(new Set());
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tab]);

  useEffect(() => {
    void load({ replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const canLoadMore = totalCount != null && items.length < totalCount;

  const handleSort = useCallback((columnKey) => {
    setSortColumn(prevCol => {
      if (prevCol !== columnKey) {
        setSortDir('asc');
        return columnKey;
      }
      setSortDir(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
      return columnKey;
    });
  }, []);

  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;
    const dir = sortDir === 'asc' ? 1 : -1;
    const withKey = items.map(row => {
      let key;
      if (sortColumn === 'time') {
        key = row.createdAt ? new Date(row.createdAt).getTime() : 0;
      } else if (sortColumn === 'reporter') {
        key = (row.payload?._reportedByEmail ?? row.gmUid ?? '').toLowerCase();
      } else {
        key = '';
      }
      return { row, key };
    });
    withKey.sort((a, b) => {
      if (a.key < b.key) return -1 * dir;
      if (a.key > b.key) return 1 * dir;
      return 0;
    });
    return withKey.map(x => x.row);
  }, [items, sortColumn, sortDir]);

  const visibleIds = useMemo(() => sortedItems.map(row => row.id), [sortedItems]);
  const { selectedCount, allSelected, someSelected } = useMemo(
    () => bugReportSelectionState(selectedIds, visibleIds),
    [selectedIds, visibleIds]
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleRowSelected = useCallback((id) => {
    setSelectedIds(prev => toggleBugReportSelection(prev, id));
  }, []);

  const handleSelectAllChange = useCallback((e) => {
    const selectAll = e.target.checked;
    setSelectedIds(prev => setBugReportVisibleSelection(prev, visibleIds, selectAll));
  }, [visibleIds]);

  const removeRowsByIds = useCallback((ids) => {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    setItems(prev => prev.filter(r => !idSet.has(r.id)));
    setTotalCount(prev => (prev != null ? Math.max(0, prev - idSet.size) : prev));
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of idSet) next.delete(id);
      return next;
    });
    setPendingIds(prev => {
      const next = new Set(prev);
      for (const id of idSet) next.delete(id);
      return next;
    });
  }, []);

  const handleNotesSaved = useCallback((id, updatedItem) => {
    setItems(prev => prev.map(r => (r.id === id ? updatedItem : r)));
  }, []);

  const handleQuickAddCreated = useCallback((item) => {
    setItems(prev => [item, ...prev]);
    setTotalCount(prev => (prev != null ? prev + 1 : 1));
    setError(null);
  }, []);

  const handleMove = useCallback(async (row, nextStatus) => {
    setPendingIds(prev => new Set(prev).add(row.id));
    try {
      await postAdminBugReportStatus(row.id, nextStatus);
      removeRowsByIds([row.id]);
    } catch (e) {
      setError(e?.message || String(e));
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }, [removeRowsByIds]);

  const handleBulkMove = useCallback(async (nextStatus) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkPending(true);
    setPendingIds(prev => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    try {
      const results = await Promise.allSettled(
        ids.map(id => postAdminBugReportStatus(id, nextStatus))
      );
      const succeeded = new Set();
      const failures = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') succeeded.add(ids[i]);
        else failures.push(result.reason?.message || String(result.reason));
      });
      if (succeeded.size > 0) removeRowsByIds(succeeded);
      if (failures.length > 0) {
        setError(
          failures.length === ids.length
            ? failures[0]
            : `Moved ${succeeded.size} of ${ids.length}; ${failures.length} failed: ${failures[0]}`
        );
      }
    } finally {
      setBulkPending(false);
      setPendingIds(prev => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
  }, [selectedIds, removeRowsByIds]);

  return (
    <div className="flex-1 overflow-auto flex flex-col bg-dh-canvas text-dh">
      {/* Header */}
      <div className="border-b border-dh-border bg-red-900/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-red-200">
          <ShieldOff size={22} className="shrink-0" />
          <div>
            <h1 className="text-lg font-semibold">Problem reports (admin)</h1>
            <p className="text-xs text-red-200/80">
              In-session captures from GMs and players, plus items you add to the current column. Drag columns to reorder; Add column for a new status. Use Copy on each row for a debug bundle.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load({ replace: true })}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-950/50 border border-red-700 text-red-200 hover:bg-red-900 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/library/all', { replace: false })}
            className="text-sm px-3 py-1.5 rounded-md border border-red-700 bg-red-950/50 text-red-200 hover:bg-red-900"
          >
            Back to Library
          </button>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto w-full space-y-4">
        <ColumnTabs
          columns={columns}
          tab={tab}
          onSelect={selectTab}
          onReorder={(fromIndex, toIndex) => {
            void persistColumns(reorderBugReportColumns(columns, fromIndex, toIndex));
          }}
          onAdd={(nextColumns, selectId) => {
            void persistColumns(nextColumns, { selectId });
          }}
        />

        <QuickAddItemForm
          key={tab}
          columnLabel={columnMeta(tab, columns).label}
          status={tab}
          disabled={loading}
          onCreated={handleQuickAddCreated}
        />

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading && items.length === 0 && (
          <p className="text-dh-muted text-sm">Loading…</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-dh-muted text-sm">{columnMeta(tab, columns).emptyText}</p>
        )}

        {items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-dh-muted">
                Showing {items.length}{totalCount != null ? ` of ${totalCount}` : ''} {columnMeta(tab, columns).label.toLowerCase()} reports
                {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
              </p>
              {selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-dh-muted whitespace-nowrap">Move selected to</span>
                  <StatusMoveButtons
                    currentStatus={tab}
                    columns={columns}
                    onMove={handleBulkMove}
                    isPending={bulkPending}
                    size="md"
                  />
                </div>
              )}
            </div>
            <div className="border border-dh-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-dh-muted border-b border-dh-border bg-dh-surface/50">
                      <th className="px-3 py-2 w-10">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAllChange}
                          aria-label="Select all reports on this page"
                          className="rounded border-dh-border bg-dh-raised text-red-500 focus:ring-red-500/40"
                        />
                      </th>
                      <SortableHeader label="Time" columnKey="time" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Reporter" columnKey="reporter" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
                      <th className="px-3 py-2 font-medium">Notes</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Copy</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Move to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((row) => {
                      const { _reportedByEmail, _reportedByRole } = row.payload ?? {};
                      const isPending = pendingIds.has(row.id);
                      const isSelected = selectedIds.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-dh-border/60 hover:bg-dh-hover/30 align-top ${
                            isSelected ? 'bg-red-950/20' : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRowSelected(row.id)}
                              aria-label={`Select report #${row.id}`}
                              className="rounded border-dh-border bg-dh-raised text-red-500 focus:ring-red-500/40"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-dh-muted">
                            {formatTimestamp(row.createdAt)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-dh truncate max-w-[14rem]" title={_reportedByEmail}>
                                {_reportedByEmail ?? row.gmUid}
                              </span>
                              <RoleBadge role={_reportedByRole} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-dh max-w-xs">
                            <NotesCell row={row} onSaved={handleNotesSaved} />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <CopyButton row={row} />
                          </td>
                          <td className="px-3 py-2">
                            <StatusMoveButtons
                              currentStatus={row.status ?? tab}
                              columns={columns}
                              onMove={(status) => handleMove(row, status)}
                              isPending={isPending}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {canLoadMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => void load({ replace: false, currentLength: items.length })}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-dh-raised border border-dh-border text-dh-muted hover:text-dh hover:border-dh-strong text-sm font-medium disabled:opacity-50"
                >
                  {loadingMore ? <RefreshCw size={14} className="animate-spin" /> : null}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
