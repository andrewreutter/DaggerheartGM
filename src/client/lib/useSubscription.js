import { useState, useEffect, useRef } from 'react';

/**
 * Subscribe to a LISTEN/NOTIFY-backed channel event on an SSE EventSource.
 *
 * The server pushes a full result-set snapshot whenever the underlying data changes
 * (via Postgres trigger → SubscriptionManager → SSE). The client replaces its local
 * state on each event — no delta reconciliation needed.
 *
 * @param {EventSource|null} es  - The active SSE EventSource for the current room.
 * @param {string} channel       - Channel name (e.g. 'banners', 'dice_log').
 * @param {*} [initialState]     - State before the first snapshot arrives (default null).
 * @returns {*} The latest snapshot, or initialState if no snapshot has arrived yet.
 *
 * @example
 *   // In a component that receives the EventSource via props or context:
 *   const banners = useSubscription(es, 'banners', []);
 *   // banners is always the current pending banner list — no queue management needed.
 */
export function useSubscription(es, channel, initialState = null) {
  const [snapshot, setSnapshot] = useState(initialState);
  // Track the current EventSource + channel so the effect re-registers when either changes.
  const prevEsRef = useRef(null);

  useEffect(() => {
    if (!es) return;
    prevEsRef.current = es;
    const handler = (e) => {
      try {
        setSnapshot(JSON.parse(e.data));
      } catch {
        console.warn(`[useSubscription] failed to parse ${channel} event`);
      }
    };
    es.addEventListener(channel, handler);
    return () => es.removeEventListener(channel, handler);
  }, [es, channel]);

  return snapshot;
}
