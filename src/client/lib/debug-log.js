/**
 * Browser-side debug instrumentation: POST to same-origin `/api/debug-log`, which relays the
 * payload to the Cursor ingest URL (see `server.js`). Direct `fetch` to `127.0.0.1` from the
 * browser is blocked; this path is not.
 *
 * Body shape: `{ _debugUrl, _debugSessionId?, ...fields }` — server strips `_debugUrl` / `_debugSessionId`
 * and forwards the rest to `_debugUrl` with optional `X-Debug-Session-Id`.
 */

export const DEBUG_LOG_DEFAULT_INGEST =
  'http://127.0.0.1:7456/ingest/b8b9e013-5af1-438e-8ea4-5198e805186a';

/**
 * @param {object} payload — include `_debugSessionId` / `sessionId` when using a Cursor debug session
 * @param {string} [ingestUrl] — override default ingest URL (port/path change per session)
 */
export function postDebugLog(payload, ingestUrl = DEBUG_LOG_DEFAULT_INGEST) {
  fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _debugUrl: ingestUrl,
      ...payload,
    }),
  }).catch(() => {});
}
