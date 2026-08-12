import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Bug,
  Check,
  Copy,
  Inbox,
  Lightbulb,
  RefreshCw,
  Rocket,
  ShieldOff,
} from 'lucide-react';
import { fetchAdminBugReports, postAdminBugReportStatus } from '../lib/api.js';
import { buildBugReportDebugText } from '../lib/bug-report-debug-text.js';
import {
  BUG_REPORT_STATUS_ORDER,
  bugReportSelectionState,
  otherBugReportStatuses,
  setBugReportVisibleSelection,
  toggleBugReportSelection,
} from '../lib/bug-report-admin.js';

const PAGE_SIZE = 50;

/** Ordered tabs on the admin Problem reports page; also the set of valid `bug_reports.status` values. */
const STATUS_CONFIG = {
  triage: { label: 'Triage', icon: Inbox, emptyText: 'No problem reports yet.' },
  bug: { label: 'Bug', icon: Bug, emptyText: 'No bug reports yet.' },
  feature: { label: 'Feature', icon: Lightbulb, emptyText: 'No feature requests yet.' },
  completed: { label: 'Completed', icon: Check, emptyText: 'No completed reports yet.' },
  shipped: { label: 'Shipped', icon: Rocket, emptyText: 'No shipped reports yet.' },
  cancelled: { label: 'Cancelled', icon: Ban, emptyText: 'No cancelled reports yet.' },
};
const STATUS_ORDER = BUG_REPORT_STATUS_ORDER;

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
  const isGm = role === 'gm';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isGm
          ? 'bg-sky-900/60 text-sky-300 border border-sky-700/60'
          : 'bg-violet-900/60 text-violet-300 border border-violet-700/60'
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

function StatusMoveButtons({ currentStatus, onMove, isPending, size = 'sm' }) {
  const otherStatuses = otherBugReportStatuses(currentStatus);
  const pad = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {otherStatuses.map(status => {
        const { label, icon: Icon } = STATUS_CONFIG[status];
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

/**
 * @param {{ navigate: (path: string, opts?: object) => void }} props
 */
export function AdminBugReportsPage({ navigate }) {
  const [tab, setTab] = useState('triage'); // one of STATUS_ORDER
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [sortColumn, setSortColumn] = useState(null); // 'time' | 'reporter'
  const [sortDir, setSortDir] = useState('desc');
  const selectAllRef = useRef(null);

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

  const toggleExpanded = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
              In-session bug captures from GMs and players. Use the Copy button on each row to grab a full debug bundle.
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
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-dh-border flex-wrap">
          {STATUS_ORDER.map(key => {
            const { label, icon: Icon } = STATUS_CONFIG[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === key
                    ? 'border-red-500 text-dh'
                    : 'border-transparent text-dh-muted hover:text-dh'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading && items.length === 0 && (
          <p className="text-dh-muted text-sm">Loading…</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-dh-muted text-sm">{STATUS_CONFIG[tab].emptyText}</p>
        )}

        {items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-dh-muted">
                Showing {items.length}{totalCount != null ? ` of ${totalCount}` : ''} {STATUS_CONFIG[tab].label.toLowerCase()} reports
                {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
              </p>
              {selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-dh-muted whitespace-nowrap">Move selected to</span>
                  <StatusMoveButtons
                    currentStatus={tab}
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
                      const { _reportedByEmail, _reportedByRole, notes } = row.payload ?? {};
                      const isExpanded = expandedIds.has(row.id);
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
                            {notes ? (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(row.id)}
                                title={isExpanded ? 'Click to collapse' : 'Click to expand full text'}
                                className={`text-left w-full hover:text-dh-muted transition-colors ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}
                              >
                                {notes}
                              </button>
                            ) : (
                              <span className="text-dh-muted italic">no notes</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <CopyButton row={row} />
                          </td>
                          <td className="px-3 py-2">
                            <StatusMoveButtons
                              currentStatus={row.status ?? tab}
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
