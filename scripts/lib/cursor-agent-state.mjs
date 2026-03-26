/**
 * Parse last-line workflow state from Cursor CLI `agent --print` output.
 */

/** Map single-token agent output to tracker Status label. */
export function normalizeStateToken(raw) {
  const t = String(raw)
    .trim()
    .replace(/^[`"']+|[`"']+$/g, '')
    .replace(/\s+/g, '');
  const map = new Map([
    ['done', 'Done'],
    ['blocked', 'Blocked'],
    ['inprogress', 'In Progress'],
    ['unclaimed', 'Unclaimed'],
    ['validated', 'Validated'],
    ['reviewed', 'Reviewed'],
    ['needsfix', 'Needs Fix'],
    ['fixing', 'Fixing'],
    ['validating', 'Validating'],
    ['skipped', 'Skipped'],
    ['awaitinghuman', 'Awaiting Human'],
  ]);
  const key = t.toLowerCase().replace(/[^a-z]/g, '');
  return map.get(key) ?? null;
}

export function extractLastStateLine(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const norm = normalizeStateToken(lines[i]);
    if (norm) return norm;
  }
  const last = lines[lines.length - 1] ?? '';
  return normalizeStateToken(last);
}
