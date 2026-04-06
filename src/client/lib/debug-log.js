/**
 * Browser-side debug instrumentation: POST to same-origin `/api/debug-log`. In non-production the
 * server appends NDJSON to `.cursor/debug-{sessionId}.log` and optionally forwards to `_debugUrl`.
 * Direct `fetch` to `127.0.0.1` from the browser is blocked; this path is not.
 *
 * Body shape: `{ _debugUrl?, _debugSessionId?, sessionId?, ...fields }` — `_debugUrl` is optional.
 */

export const DEBUG_LOG_DEFAULT_INGEST =
  'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a';

/**
 * @param {object} payload — include `_debugSessionId` / `sessionId` when using a Cursor debug session
 * @param {string} [ingestUrl] — override default ingest URL (port/path change per session)
 */
export function postDebugLog(payload, ingestUrl = DEBUG_LOG_DEFAULT_INGEST) {
  const sid = payload?._debugSessionId ?? payload?.sessionId;
  fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _debugUrl: ingestUrl,
      ...(sid && !payload?._debugSessionId ? { _debugSessionId: sid } : {}),
      ...payload,
    }),
  }).catch(() => {});
}
