/**
 * Pure helper: formats a bug_reports row into a Markdown-flavored text block
 * suitable for pasting into an agent chat for debugging.
 *
 * Input shape matches the API response from GET /api/admin/bug-reports:
 *   { id, gmUid, tableId, payload, createdAt }
 * where payload is the stored JSONB object.
 */

/**
 * @param {{ id: number, gmUid: string, tableId: string|null, payload: object, createdAt: string }} row
 * @returns {string}
 */
export function buildBugReportDebugText(row) {
  const { id, gmUid, tableId, payload = {}, createdAt } = row;
  const {
    notes,
    route,
    capturedAt,
    recentActionLog,
    activeElementsSummary,
    recentConsoleErrors,
    _reportedByEmail,
    _reportedByRole,
    _serverTimestamp,
    _userAgent,
  } = payload;

  const lines = [];

  lines.push(`# Bug Report #${id}`);
  lines.push('');

  lines.push('## Meta');
  lines.push(`- **Reported at (server):** ${_serverTimestamp ?? createdAt ?? '?'}`);
  lines.push(`- **Captured at (client):** ${capturedAt ?? '?'}`);
  lines.push(`- **Reporter:** ${_reportedByEmail ?? '?'} (${_reportedByRole ?? '?'})`);
  lines.push(`- **GM UID:** ${gmUid}`);
  lines.push(`- **Table ID:** ${tableId ?? '?'}`);
  lines.push(`- **Route:** ${route ?? '?'}`);
  if (_userAgent) lines.push(`- **User-agent:** ${_userAgent}`);
  lines.push('');

  if (notes) {
    lines.push('## Notes');
    lines.push(notes);
    lines.push('');
  }

  if (activeElementsSummary?.length) {
    lines.push('## Active Elements Summary');
    lines.push('```json');
    lines.push(JSON.stringify(activeElementsSummary, null, 2));
    lines.push('```');
    lines.push('');
  }

  if (recentActionLog?.length) {
    lines.push('## Recent Action Log');
    lines.push('```json');
    lines.push(JSON.stringify(recentActionLog, null, 2));
    lines.push('```');
    lines.push('');
  }

  if (recentConsoleErrors?.length) {
    lines.push('## Recent Console Errors');
    lines.push('```json');
    lines.push(JSON.stringify(recentConsoleErrors, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
