import { useEffect, useState } from 'react';
import hljs from 'highlight.js';
import { Code2, ExternalLink, Loader2 } from 'lucide-react';
import {
  fetchDevAgentIssues,
  fetchDevAgentQueueEnabled,
  fetchFeatureSource,
  fetchMe,
  postDevAgentQueue,
} from '../../lib/api.js';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';

/**
 * Read-only full-page modal with syntax-highlighted V2 feature module source.
 * Optional footer (admin or QA): enqueue dev-agent work (GitHub Issues) when `DEV_AGENT_QUEUE_ENABLED=1`.
 */
export function FeatureSourceModal({ open, relativePath, onClose, isAdmin: isAdminProp, isQa: isQaProp }) {
  const [phase, setPhase] = useState({ loading: false, error: null, html: null, label: null });

  const [privilegeGate, setPrivilegeGate] = useState({ checked: false, canUseDevAgent: false });
  useEffect(() => {
    if (!open) return undefined;
    const explicit = isAdminProp !== undefined || isQaProp !== undefined;
    if (explicit) {
      setPrivilegeGate({ checked: true, canUseDevAgent: !!(isAdminProp || isQaProp) });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const m = await fetchMe();
        if (!cancelled) {
          setPrivilegeGate({
            checked: true,
            canUseDevAgent: !!(m.isAdmin || m.isQa),
          });
        }
      } catch {
        if (!cancelled) setPrivilegeGate({ checked: true, canUseDevAgent: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAdminProp, isQaProp]);

  const [kind, setKind] = useState('feature');
  const [message, setMessage] = useState('');
  const [submitErr, setSubmitErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [queue, setQueue] = useState({ loading: false, issues: [], disabled: false, error: null });
  /** `null` until `/api/config` is fetched when the modal opens — avoids stale module flag after server env change. */
  const [serverQueueEnabled, setServerQueueEnabled] = useState(null);

  useEffect(() => {
    if (!open) {
      setServerQueueEnabled(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const enabled = await fetchDevAgentQueueEnabled();
      if (!cancelled) setServerQueueEnabled(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !relativePath) return undefined;

    let cancelled = false;
    setPhase({ loading: true, error: null, html: null, label: relativePath });

    (async () => {
      try {
        const { path, source } = await fetchFeatureSource(relativePath);
        if (cancelled) return;
        const highlighted = hljs.highlight(source, { language: 'javascript' }).value;
        setPhase({ loading: false, error: null, html: highlighted, label: path });
      } catch (e) {
        if (cancelled) return;
        setPhase({ loading: false, error: e?.message || 'Failed to load', html: null, label: relativePath });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, relativePath]);

  useEffect(() => {
    if (!open || !relativePath || serverQueueEnabled !== true || !privilegeGate.checked || !privilegeGate.canUseDevAgent) {
      return undefined;
    }

    let cancelled = false;
    const tick = async () => {
      setQueue((q) => ({ ...q, loading: true, error: null }));
      try {
        const data = await fetchDevAgentIssues(relativePath.replace(/\\/g, '/'));
        if (cancelled) return;
        if (data.disabled) {
          setQueue({ loading: false, issues: [], disabled: true, error: null });
        } else {
          setQueue({ loading: false, issues: data.issues || [], disabled: false, error: null });
        }
      } catch (e) {
        if (cancelled) return;
        setQueue({ loading: false, issues: [], disabled: false, error: e?.message || 'Failed to load queue' });
      }
    };

    tick();
    const id = setInterval(tick, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, relativePath, serverQueueEnabled, privilegeGate.checked, privilegeGate.canUseDevAgent]);

  const subtitle = phase.label ? `src/features-v2/${phase.label}` : relativePath ? `src/features-v2/${relativePath}` : '';

  const canShowDevAgentArea =
    privilegeGate.checked &&
    privilegeGate.canUseDevAgent &&
    !!relativePath &&
    !phase.loading &&
    !phase.error;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!relativePath) return;
    setSubmitErr(null);
    setSubmitting(true);
    try {
      await postDevAgentQueue({
        path: relativePath.replace(/\\/g, '/'),
        kind,
        message: message.trim(),
      });
      setMessage('');
      const pathParam = relativePath.replace(/\\/g, '/');
      // GitHub's Issues list can lag briefly after create; retry a few times so Status isn't empty.
      let data = await fetchDevAgentIssues(pathParam);
      for (let i = 0; i < 5 && (data.issues || []).length === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 400));
        data = await fetchDevAgentIssues(pathParam);
      }
      setQueue({
        loading: false,
        issues: data.issues || [],
        disabled: !!data.disabled,
        error: null,
      });
    } catch (err) {
      setSubmitErr(err?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const stateLabelPretty = (label) => {
    if (!label) return '—';
    return label.replace(/^dh-agent-/, '').replace(/-/g, ' ');
  };

  return (
    <FullPageOverlay open={open} onClose={onClose} ariaLabelledBy="feature-source-modal-title">
      <FullPageOverlayHeader
        title="Feature implementation"
        titleId="feature-source-modal-title"
        icon={Code2}
        onClose={onClose}
        subtitle={subtitle}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4 sm:px-6">
          {phase.loading && (
            <div className="flex items-center gap-2 text-dh-muted">
              <Loader2 size={18} className="animate-spin" /> Loading…
            </div>
          )}
          {phase.error && <p className="text-red-400">{phase.error}</p>}
          {!phase.loading && phase.html && (
            <pre className="m-0 overflow-x-auto rounded-lg border border-dh-border bg-dh-inset/80 p-4 font-mono text-[13px] leading-relaxed">
              <code className="hljs language-javascript" dangerouslySetInnerHTML={{ __html: phase.html }} />
            </pre>
          )}
        </div>

        {canShowDevAgentArea && serverQueueEnabled === null && (
          <footer className="shrink-0 border-t border-dh-border bg-dh-inset/90 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-xs text-dh-muted">
              <Loader2 size={14} className="animate-spin shrink-0" />
              Checking dev agent settings…
            </div>
          </footer>
        )}

        {canShowDevAgentArea && serverQueueEnabled === false && (
          <footer className="shrink-0 border-t border-amber-900/50 bg-dh-inset/90 px-4 py-3 sm:px-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-500/90">Dev agent (disabled)</div>
            <p className="mt-1 text-xs leading-relaxed text-dh-muted">
              The queue API is off. Add{' '}
              <code className="rounded bg-dh-raised px-1 py-0.5 font-mono text-[11px] text-amber-200/90">
                DEV_AGENT_QUEUE_ENABLED=1
              </code>{' '}
              to your server <code className="rounded bg-dh-raised px-1 font-mono text-[11px]">.env</code> and restart{' '}
              <code className="rounded bg-dh-raised px-1 font-mono text-[11px]">npm run dev</code>. For enqueue + worker,
              also set <code className="rounded bg-dh-raised px-1 font-mono text-[11px]">GITHUB_REPOSITORY</code> and{' '}
              <code className="rounded bg-dh-raised px-1 font-mono text-[11px]">GITHUB_TOKEN</code> (or{' '}
              <code className="rounded bg-dh-raised px-1 font-mono text-[11px]">GH_TOKEN</code>). Run{' '}
              <code className="rounded bg-dh-raised px-1 font-mono text-[11px]">npm run setup:dev-agent-labels</code> once.
            </p>
          </footer>
        )}

        {canShowDevAgentArea && serverQueueEnabled === true && (
          <footer className="shrink-0 border-t border-dh-border bg-dh-inset/90 px-4 py-3 sm:px-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-dh-muted">Dev agent</span>
                {['feature', 'bug', 'other'].map((k) => (
                  <label key={k} className="inline-flex cursor-pointer items-center gap-1 text-xs text-dh">
                    <input
                      type="radio"
                      name="dev-agent-kind"
                      checked={kind === k}
                      onChange={() => setKind(k)}
                      className="accent-sky-500"
                    />
                    {k}
                  </label>
                ))}
              </div>
              <textarea
                value={message}
                onChange={(ev) => setMessage(ev.target.value)}
                placeholder="Request details (markdown ok)"
                rows={2}
                className="w-full resize-y rounded border border-dh-strong bg-dh-surface px-2 py-1.5 text-sm text-dh placeholder:text-dh-muted"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Queue on GitHub'}
                </button>
                {submitErr && <span className="text-xs text-red-400">{submitErr}</span>}
              </div>
            </form>

            <div className="mt-3 border-t border-dh-border pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-dh-muted">Status</div>
              {queue.loading && !queue.issues?.length && (
                <p className="mt-1 flex items-center gap-1 text-xs text-dh-muted">
                  <Loader2 size={12} className="animate-spin" /> Loading issues…
                </p>
              )}
              {queue.error && <p className="mt-1 text-xs text-red-400">{queue.error}</p>}
              {queue.disabled && <p className="mt-1 text-xs text-dh-muted">Queue API disabled on server.</p>}
              {!queue.loading && !queue.error && !queue.disabled && queue.issues?.length === 0 && (
                <p className="mt-1 text-xs text-dh-muted">No open dev-agent issues for this path.</p>
              )}
              <ul className="mt-1 space-y-1.5">
                {(queue.issues || []).map((iss) => (
                  <li key={iss.number} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-dh">
                    <a
                      href={iss.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-mono text-sky-400 hover:underline"
                    >
                      #{iss.number}
                      <ExternalLink size={10} className="opacity-70" />
                    </a>
                    <span className="text-dh-muted">{stateLabelPretty(iss.stateLabel)}</span>
                    {iss.prUrl && (
                      <a
                        href={iss.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-amber-400/90 hover:underline"
                      >
                        PR{iss.prNumber != null ? ` #${iss.prNumber}` : ''}
                        {iss.merged === true ? ' (merged)' : iss.merged === false ? '' : ''}
                        <ExternalLink size={10} className="opacity-70" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </footer>
        )}
      </div>
    </FullPageOverlay>
  );
}
