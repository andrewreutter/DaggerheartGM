import { useEffect, useState } from 'react';
import hljs from 'highlight.js';
import { Code2, Loader2 } from 'lucide-react';
import { fetchFeatureSource } from '../../lib/api.js';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';

/**
 * Read-only full-page modal with syntax-highlighted V2 feature module source.
 */
export function FeatureSourceModal({ open, relativePath, onClose }) {
  const [phase, setPhase] = useState({ loading: false, error: null, html: null, label: null });

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

  const subtitle = phase.label ? `src/features-v2/${phase.label}` : relativePath ? `src/features-v2/${relativePath}` : '';

  return (
    <FullPageOverlay open={open} onClose={onClose} ariaLabelledBy="feature-source-modal-title">
      <FullPageOverlayHeader
        title="Feature implementation"
        titleId="feature-source-modal-title"
        icon={Code2}
        onClose={onClose}
        subtitle={subtitle}
      />
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4 sm:px-6">
        {phase.loading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        )}
        {phase.error && <p className="text-red-400">{phase.error}</p>}
        {!phase.loading && phase.html && (
          <pre className="m-0 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-4 font-mono text-[13px] leading-relaxed">
            <code className="hljs language-javascript" dangerouslySetInnerHTML={{ __html: phase.html }} />
          </pre>
        )}
      </div>
    </FullPageOverlay>
  );
}
