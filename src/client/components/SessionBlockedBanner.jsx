/**
 * Idle-pause hint — portaled to `document.body` from `app.jsx` so GM and player
 * always see it above the Game Table layout (not behind dice canvas or column stacking).
 * Prep mode guidance lives on the floating Play setup card instead.
 *
 * Keep `z-[52]` below fullscreen modal backdrops (e.g. `z-[53]` in EditChoiceDialog /
 * ImportModalShell) and below `ItemDetailModal` (`z-[80]`), but above battle-map chrome (`z-50`).
 */
export function SessionBlockedBanner({ isPlayer, onResume }) {
  const bodyGm = onResume
    ? 'Click this banner (or Resume in the Encounter panel) to roll, use features, and apply damage. You can still adjust the map, notes, and Fear.'
    : 'The table went idle. Click Resume in the Encounter panel to roll, use features, and apply damage. You can still adjust the map, notes, and Fear.';
  const bodyPlayer = 'Waiting for the GM to resume the session.';
  const shellClass =
    'px-5 py-3 rounded-xl shadow-2xl text-center bg-dh-surface/95 border-2 border-dh-strong backdrop-blur-sm';
  const resumeInteractive =
    typeof onResume === 'function'
      ? 'pointer-events-auto w-full cursor-pointer text-left transition-colors hover:bg-dh-raised/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-dh-strong focus-visible:ring-offset-2 focus-visible:ring-offset-dh-surface'
      : '';
  return (
    <div
      className="select-none pointer-events-none fixed left-1/2 bottom-[7rem] z-[52] max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2"
    >
      {typeof onResume === 'function' ? (
        <button type="button" className={`${shellClass} ${resumeInteractive}`} onClick={onResume}>
          <div className="text-[11px] uppercase tracking-widest text-dh-muted mb-1">Table</div>
          <div className="text-base font-bold text-dh mb-1">Session paused</div>
          <p className="text-[12px] text-dh-muted text-left leading-snug">
            {isPlayer ? bodyPlayer : bodyGm}
          </p>
        </button>
      ) : (
        <div className={shellClass}>
          <div className="text-[11px] uppercase tracking-widest text-dh-muted mb-1">Table</div>
          <div className="text-base font-bold text-dh mb-1">Session paused</div>
          <p className="text-[12px] text-dh-muted text-left leading-snug">
            {isPlayer ? bodyPlayer : bodyGm}
          </p>
        </div>
      )}
    </div>
  );
}
