import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bug, Check, Copy, RefreshCw, ShieldOff } from 'lucide-react';
import { fetchAdminBugReports } from '../lib/api.js';
import { buildBugReportDebugText } from '../lib/bug-report-debug-text.js';

const PAGE_SIZE = 50;

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

/**
 * @param {{ navigate: (path: string, opts?: object) => void }} props
 */
export function AdminBugReportsPage({ navigate }) {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ replace = true } = {}) => {
    if (replace) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const offset = replace ? 0 : items.length;
      const json = await fetchAdminBugReports({ limit: PAGE_SIZE, offset });
      setTotalCount(json.totalCount ?? null);
      setItems(prev => (replace ? json.items : [...prev, ...json.items]));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [items.length]);

  useEffect(() => {
    void load({ replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canLoadMore = totalCount != null && items.length < totalCount;

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
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading && items.length === 0 && (
          <p className="text-dh-muted text-sm">Loading…</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-dh-muted text-sm">No problem reports yet.</p>
        )}

        {items.length > 0 && (
          <>
            <p className="text-xs text-dh-muted">
              Showing {items.length}{totalCount != null ? ` of ${totalCount}` : ''} reports (newest first)
            </p>
            <div className="border border-dh-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-dh-muted border-b border-dh-border bg-dh-surface/50">
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Time</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Reporter</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Table ID</th>
                      <th className="px-3 py-2 font-medium">Notes</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Copy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const { _reportedByEmail, _reportedByRole, notes } = row.payload ?? {};
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-dh-border/60 hover:bg-dh-hover/30 align-top"
                        >
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
                          <td className="px-3 py-2 font-mono text-xs text-dh-muted whitespace-nowrap">
                            {row.tableId ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-dh max-w-xs">
                            {notes ? (
                              <span className="line-clamp-2" title={notes}>{notes}</span>
                            ) : (
                              <span className="text-dh-muted italic">no notes</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <CopyButton row={row} />
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
                  onClick={() => void load({ replace: false })}
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
