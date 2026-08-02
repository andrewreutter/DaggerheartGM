/**
 * BugReportButton — GM-only, non-interrupting in-session bug capture (T13).
 *
 * On click: captures a client-side state snapshot and POSTs it to
 * POST /api/room/my/bug-report. Shows a brief, auto-dismissing toast.
 * Never uses window.confirm or a blocking modal — play is never paused.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bug } from 'lucide-react';
import { getAuthToken } from '../lib/api.js';

/** Ring buffer of recent console.error calls. Installed once globally. */
const ERROR_RING_SIZE = 20;
const _consoleErrorRing = [];
let _consoleErrorIntercepted = false;

function installConsoleErrorInterceptor() {
  if (_consoleErrorIntercepted || typeof window === 'undefined') return;
  _consoleErrorIntercepted = true;
  const orig = console.error.bind(console);
  console.error = (...args) => {
    _consoleErrorRing.push({ ts: Date.now(), msg: args.map(a => String(a)).join(' ').slice(0, 500) });
    if (_consoleErrorRing.length > ERROR_RING_SIZE) _consoleErrorRing.shift();
    orig(...args);
  };
}

export function BugReportButton({ tableId, actionLog = [], activeElements = [] }) {
  const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'error'
  const toastTimerRef = useRef(null);

  useEffect(() => {
    installConsoleErrorInterceptor();
  }, []);

  const handleClick = useCallback(async () => {
    if (status === 'sending') return;
    setStatus('sending');

    const payload = {
      tableId,
      route: typeof window !== 'undefined' ? window.location.href : null,
      recentActionLog: (actionLog || []).slice(-20).map(r => ({
        timestamp: r.timestamp,
        displayName: r.displayName,
        rollText: r.rollText,
        total: r.total,
        _action: r._action,
        _logId: r._logId,
      })),
      activeElementsSummary: (activeElements || []).map(el => ({
        instanceId: el.instanceId,
        elementType: el.elementType,
        name: el.name,
        id: el.id,
        currentHp: el.currentHp,
        currentStress: el.currentStress,
        hope: el.hope,
        conditions: el.conditions,
      })),
      recentConsoleErrors: [..._consoleErrorRing],
      capturedAt: new Date().toISOString(),
    };

    try {
      const token = await getAuthToken();
      const res = await fetch('/api/room/my/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('ok');
    } catch (err) {
      console.warn('[BugReportButton] submit failed:', err);
      setStatus('error');
    } finally {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setStatus(null), 3000);
    }
  }, [tableId, actionLog, activeElements, status]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'sending'}
        title="Report a problem — captures a snapshot of your current session for triage"
        className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-[10px] font-medium transition-colors w-full
          ${status === 'sending'
            ? 'text-dh-muted cursor-wait opacity-60'
            : status === 'ok'
              ? 'text-emerald-400 hover:bg-dh-hover'
              : status === 'error'
                ? 'text-red-400 hover:bg-dh-hover'
                : 'text-dh-muted hover:text-dh hover:bg-dh-hover/60'
          }`}
      >
        <Bug size={11} className="shrink-0" />
        <span>
          {status === 'sending' ? 'Reporting…'
            : status === 'ok' ? 'Report sent'
            : status === 'error' ? 'Report failed — try again'
            : 'Report a problem'}
        </span>
      </button>
    </div>
  );
}
