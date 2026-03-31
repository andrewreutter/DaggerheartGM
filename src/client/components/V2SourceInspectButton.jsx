import { useState } from 'react';
import { Search } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';
import { FeatureSourceModal } from './features/FeatureSourceModal.jsx';

/**
 * Magnifying glass → view V2 implementation source (`GET /api/features-v2/source`).
 */
export function V2SourceInspectButton({ relativePath, variant = 'card' }) {
  const [open, setOpen] = useState(false);
  if (!relativePath) return null;
  const size = variant === 'header' ? 16 : 14;
  const btnClass =
    variant === 'header'
      ? 'p-1.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors shrink-0'
      : 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-dh-muted hover:text-white transition-colors';
  return (
    <>
      <Tooltip content="View implementation source" placement="top">
        <button
          type="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className={btnClass}
          aria-label="View implementation source"
        >
          <Search size={size} />
        </button>
      </Tooltip>
      <FeatureSourceModal open={open} relativePath={relativePath} onClose={() => setOpen(false)} />
    </>
  );
}
