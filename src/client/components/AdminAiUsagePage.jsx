import React, { useCallback, useEffect, useState } from 'react';
import { ShieldOff, RefreshCw } from 'lucide-react';
import { fetchAdminAiUsage } from '../lib/api.js';

function utcYmd(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

function defaultToYmd() {
  return utcYmd(new Date());
}

function defaultFromYmd() {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - 30);
  return utcYmd(t);
}

function formatNum(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

/**
 * @param {{ navigate: (path: string, opts?: object) => void }} props
 */
export function AdminAiUsagePage({ navigate }) {
  const [from, setFrom] = useState(defaultFromYmd);
  const [to, setTo] = useState(defaultToYmd);
  const [builder, setBuilder] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = { from, to };
      if (builder.trim()) q.builder = builder.trim();
      const json = await fetchAdminAiUsage(q);
      setData(json);
    } catch (e) {
      setError(e?.message || String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, builder]);

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex-1 overflow-auto flex flex-col bg-dh-canvas text-dh">
      <div className="border-b border-dh-border bg-red-900/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-red-200">
          <ShieldOff size={22} className="shrink-0" />
          <div>
            <h1 className="text-lg font-semibold">AI usage (admin)</h1>
            <p className="text-xs text-red-200/80">
              Token totals and call counts — prompts are not stored. Dates are UTC calendar days.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/library/all`, { replace: false })}
          className="text-sm px-3 py-1.5 rounded-md border border-red-700 bg-red-950/50 text-red-200 hover:bg-red-900"
        >
          Back to Library
        </button>
      </div>

      <div className="p-4 max-w-6xl mx-auto w-full space-y-4">
        <div className="flex flex-wrap items-end gap-3 bg-dh-raised border border-dh-border rounded-lg p-4">
          <label className="flex flex-col gap-1 text-xs text-dh-muted">
            From (UTC)
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-dh-canvas border border-dh-border rounded px-2 py-1.5 text-sm text-dh"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-dh-muted">
            To (UTC)
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-dh-canvas border border-dh-border rounded px-2 py-1.5 text-sm text-dh"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-dh-muted min-w-[10rem]">
            Builder
            <input
              type="text"
              value={builder}
              onChange={(e) => setBuilder(e.target.value)}
              placeholder="all"
              className="bg-dh-canvas border border-dh-border rounded px-2 py-1.5 text-sm text-dh font-mono"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {data && (
          <p className="text-xs text-dh-muted">
            Range: <span className="font-mono text-dh">{data.fromInclusive}</span> –{' '}
            <span className="font-mono text-dh">{data.toInclusive}</span>
            {data.builder ? (
              <>
                {' '}
                · builder filter: <span className="font-mono text-dh">{data.builder}</span>
              </>
            ) : null}
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 text-red-200 px-4 py-3 text-sm">{error}</div>
        )}

        {loading && !data && <p className="text-dh-muted text-sm">Loading…</p>}

        {data?.totals?.length > 0 && (
          <div className="border border-dh-border rounded-lg overflow-hidden">
            <div className="bg-dh-raised px-3 py-2 text-sm font-medium border-b border-dh-border">Totals by builder</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dh-muted border-b border-dh-border bg-dh-surface/50">
                    <th className="px-3 py-2 font-medium">Builder</th>
                    <th className="px-3 py-2 font-medium">Calls</th>
                    <th className="px-3 py-2 font-medium">Errors</th>
                    <th className="px-3 py-2 font-medium">Prompt tok.</th>
                    <th className="px-3 py-2 font-medium">Completion tok.</th>
                    <th className="px-3 py-2 font-medium">Cached prompt</th>
                    <th className="px-3 py-2 font-medium">Total tok.</th>
                    <th className="px-3 py-2 font-medium">Latency Σ (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.totals.map((row) => (
                    <tr key={row.builder} className="border-b border-dh-border/60 hover:bg-dh-hover/30">
                      <td className="px-3 py-2 font-mono text-xs">{row.builder}</td>
                      <td className="px-3 py-2">{formatNum(row.calls)}</td>
                      <td className="px-3 py-2">{formatNum(row.errors)}</td>
                      <td className="px-3 py-2">{formatNum(row.prompt_tokens)}</td>
                      <td className="px-3 py-2">{formatNum(row.completion_tokens)}</td>
                      <td className="px-3 py-2">{formatNum(row.cached_prompt_tokens)}</td>
                      <td className="px-3 py-2">{formatNum(row.total_tokens)}</td>
                      <td className="px-3 py-2">{formatNum(row.latency_ms_sum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && !loading && (!data.totals || data.totals.length === 0) && !error && (
          <p className="text-dh-muted text-sm">No usage events in this range.</p>
        )}

        {data?.byDay?.length > 0 && (
          <div className="border border-dh-border rounded-lg overflow-hidden">
            <div className="bg-dh-raised px-3 py-2 text-sm font-medium border-b border-dh-border">By day (UTC)</div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-dh-surface z-[1]">
                  <tr className="text-left text-dh-muted border-b border-dh-border">
                    <th className="px-3 py-2 font-medium">Day</th>
                    <th className="px-3 py-2 font-medium">Builder</th>
                    <th className="px-3 py-2 font-medium">Calls</th>
                    <th className="px-3 py-2 font-medium">Prompt</th>
                    <th className="px-3 py-2 font-medium">Completion</th>
                    <th className="px-3 py-2 font-medium">Cached</th>
                    <th className="px-3 py-2 font-medium">Total tok.</th>
                    <th className="px-3 py-2 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDay.map((row, i) => (
                    <tr key={`${row.day}-${row.builder}-${i}`} className="border-b border-dh-border/60 hover:bg-dh-hover/30">
                      <td className="px-3 py-1.5 font-mono text-xs">{row.day}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{row.builder}</td>
                      <td className="px-3 py-1.5">{formatNum(row.calls)}</td>
                      <td className="px-3 py-1.5">{formatNum(row.prompt_tokens)}</td>
                      <td className="px-3 py-1.5">{formatNum(row.completion_tokens)}</td>
                      <td className="px-3 py-1.5">{formatNum(row.cached_prompt_tokens)}</td>
                      <td className="px-3 py-1.5">{formatNum(row.total_tokens)}</td>
                      <td className="px-3 py-1.5">{formatNum(row.errors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
