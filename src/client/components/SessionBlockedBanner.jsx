import { useEffect } from 'react';
import { postDebugLog } from '../lib/debug-log.js';

/**
 * Prep / idle-pause hint — portaled to `document.body` from `app.jsx` so GM and player
 * always see it above the Game Table layout (not behind dice canvas or column stacking).
 */
export function SessionBlockedBanner({ isPlayer, sessionStarted }) {
  // #region agent log
  useEffect(() => {
    const isPrep = sessionStarted === false;
    postDebugLog({
      _debugSessionId: '7dabc3',
      sessionId: '7dabc3',
      location: 'SessionBlockedBanner.jsx:mount',
      message: 'SessionBlockedBanner mounted',
      hypothesisId: 'H3',
      data: { isPlayer, sessionStarted, isPrep, titleKind: isPrep ? 'prep' : 'paused' },
      timestamp: Date.now(),
      runId: 'pre-fix',
    });
  }, [isPlayer, sessionStarted]);
  // #endregion

  const isPrep = sessionStarted === false;
  const title = isPrep ? 'Prep mode' : 'Session paused';
  const bodyGm = isPrep
    ? 'Click Start Session in the Encounter panel to roll, use features, and apply damage. You can still adjust the map, tokens, conditions, and Fear.'
    : 'The table went idle. Click Resume in the Encounter panel to roll, use features, and apply damage. You can still adjust the map, tokens, conditions, and Fear.';
  const bodyPlayer = isPrep
    ? 'Waiting for the GM to start the session.'
    : 'Waiting for the GM to resume the session.';
  return (
    <div
      className="select-none pointer-events-none"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '7rem',
        transform: 'translateX(-50%)',
        zIndex: 100050,
        maxWidth: 'min(420px, calc(100vw - 2rem))',
      }}
    >
      <div className="px-5 py-3 rounded-xl shadow-2xl text-center bg-dh-surface/95 border-2 border-dh-strong backdrop-blur-sm">
        <div className="text-[11px] uppercase tracking-widest text-dh-muted mb-1">Table</div>
        <div className="text-base font-bold text-dh mb-1">{title}</div>
        <p className="text-[12px] text-dh-muted text-left leading-snug">
          {isPlayer ? bodyPlayer : bodyGm}
        </p>
      </div>
    </div>
  );
}
