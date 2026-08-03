/**
 * BugReportButton — non-blocking in-session bug capture (T13, extended).
 *
 * Available to both GMs and invited players from the shared Characters panel.
 * On click: opens an inline single-line notes input (optional). Pressing Enter
 * (with or without text) or clicking the send button submits the report.
 * Escape collapses the composer without sending.
 *
 * Posts to:
 *   GM    → POST /api/room/my/bug-report   (body.tableId)
 *   Player → POST /api/room/:tableId/bug-report
 *
 * Never uses window.confirm or a blocking modal — play is never paused.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bug, Send, X } from 'lucide-react';
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

export function BugReportButton({ tableId, actionLog = [], activeElements = [], isPlayer = false }) {
  const [status, setStatus] = useState(null); // null | 'composing' | 'sending' | 'ok' | 'error'
  const [notes, setNotes] = useState('');
  const toastTimerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    installConsoleErrorInterceptor();
  }, []);

  // Auto-focus the input when the composer opens.
  useEffect(() => {
    if (status === 'composing') {
      inputRef.current?.focus();
    }
  }, [status]);

  const handleOpenComposer = useCallback(() => {
    if (status === 'sending') return;
    setStatus('composing');
  }, [status]);

  const handleCancel = useCallback(() => {
    setStatus(null);
    setNotes('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');

    const url = isPlayer
      ? `/api/room/${tableId}/bug-report`
      : '/api/room/my/bug-report';

    const payload = {
      tableId,
      notes: notes.trim() || null,
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
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNotes('');
      setStatus('ok');
    } catch (err) {
      console.warn('[BugReportButton] submit failed:', err);
      setStatus('error');
    } finally {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setStatus(null), 3000);
    }
  }, [tableId, isPlayer, actionLog, activeElements, notes, status]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  if (status === 'composing') {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1 rounded px-1 py-1"
      >
        <Bug size={11} className="shrink-0 text-dh-muted" />
        <input
          ref={inputRef}
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); handleCancel(); } }}
          placeholder="Notes (optional) — Enter to send"
          className="min-w-0 flex-1 rounded bg-dh-inset px-1.5 py-0.5 text-[10px] text-dh placeholder:text-dh-muted/60 outline-none border border-dh-border focus:border-dh-strong"
        />
        <button
          type="submit"
          title="Send report"
          className="shrink-0 rounded p-0.5 text-dh-muted hover:text-emerald-400 hover:bg-dh-hover/60 transition-colors"
        >
          <Send size={10} />
        </button>
        <button
          type="button"
          title="Cancel"
          onClick={handleCancel}
          className="shrink-0 rounded p-0.5 text-dh-muted hover:text-red-400 hover:bg-dh-hover/60 transition-colors"
        >
          <X size={10} />
        </button>
      </form>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpenComposer}
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
