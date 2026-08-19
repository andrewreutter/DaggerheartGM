import { RefreshCw, X } from 'lucide-react';

/**
 * Post-deploy prompt — portaled from `app.jsx`. Does not auto-reload so a
 * Game Table session can finish a roll or editor save first.
 *
 * `z-[100]` sits above nav (`z-[70]`) and `ItemDetailModal` (`z-[80]`) so
 * the prompt is visible even with an editor open.
 */
export function NewVersionBanner({ onReload, onDismiss }) {
  return (
    <div
      className="pointer-events-auto fixed left-1/2 top-20 z-[100] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2"
      role="status"
    >
      <div className="relative rounded-xl border-2 border-dh-strong bg-dh-surface/95 px-5 py-3 text-center shadow-2xl backdrop-blur-sm">
        <button
          type="button"
          className="absolute right-2 top-2 rounded p-1 text-dh-muted hover:bg-dh-raised/40 hover:text-dh focus:outline-none focus-visible:ring-2 focus-visible:ring-dh-strong"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-1 text-[11px] uppercase tracking-widest text-dh-muted">Update</div>
        <div className="mb-1 text-base font-bold text-dh">A new version is available</div>
        <p className="mb-3 text-left text-[12px] leading-snug text-dh-muted">
          Reload to pick up the latest Game Table and Library. You can dismiss this and finish what you are doing first.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-dh-raised px-3 py-1.5 text-sm font-semibold text-dh hover:bg-dh-raised/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-dh-strong"
          onClick={onReload}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload
        </button>
      </div>
    </div>
  );
}
