/**
 * Character-name roster for table cards (Owner / Player / Public).
 * Uses `elementType === 'character'` display names only — never emails or Firebase names.
 */

/**
 * @param {object|null|undefined} data — table_state `data` (or resolved snapshot)
 * @returns {{ count: number, names: string[] }}
 */
export function summarizeTableCharacterRoster(data) {
  const elements = Array.isArray(data?.elements)
    ? data.elements
    : (Array.isArray(data?.activeElements) ? data.activeElements : []);
  const names = [];
  for (const el of elements) {
    if (!el || el.elementType !== 'character') continue;
    const name = typeof el.name === 'string' ? el.name.trim() : '';
    if (name) names.push(name);
  }
  return { count: names.length, names };
}

/**
 * Homepage / lobby card DTO. Never includes emails.
 * @param {{ id: string, data?: object, userId?: string }} row
 * @param {{ tableIdKey?: 'id' | 'tableId' }} [opts]
 */
export function toUpdatedAtMs(value) {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : undefined;
}

export function toTableCardDto(row, opts = {}) {
  const data = row?.data || {};
  const roster = summarizeTableCharacterRoster(data);
  const rawName = typeof data.tableName === 'string' ? data.tableName.trim() : '';
  const name = rawName || 'Table';
  const rawPreviewUrl = typeof data.tablePreviewUrl === 'string' && data.tablePreviewUrl.trim()
    ? data.tablePreviewUrl.trim()
    : null;
  // Append ?v=<epoch> so the browser re-fetches the upserted PNG when the preview refreshes.
  let previewUrl = rawPreviewUrl;
  if (rawPreviewUrl && data.tablePreviewAt != null) {
    const at = Number(data.tablePreviewAt);
    if (Number.isFinite(at) && at > 0) {
      try {
        const u = new URL(rawPreviewUrl);
        u.searchParams.set('v', String(at));
        previewUrl = u.toString();
      } catch {
        previewUrl = `${rawPreviewUrl}${rawPreviewUrl.includes('?') ? '&' : '?'}v=${at}`;
      }
    }
  }
  const gmName = typeof data.gmDisplayName === 'string' ? data.gmDisplayName.trim() : '';
  const id = row.id;
  const base = {
    name,
    gmName,
    previewUrl,
    characterNames: roster.names,
    characterCount: roster.count,
  };
  const updatedAt = toUpdatedAtMs(row?.updatedAt);
  if (updatedAt != null) base.updatedAt = updatedAt;
  if (opts.tableIdKey === 'tableId') {
    return { ...base, tableId: id, gmUid: row.userId || '', tableName: name };
  }
  return { ...base, id };
}

/**
 * @param {boolean} currentIsPublic — `items.is_public` on the table_state row
 * @param {{ op?: string, isPublic?: boolean }|null|undefined} op
 * @returns {boolean}
 */
export function nextTableIsPublic(currentIsPublic, op) {
  if (op?.op === 'set-table-public') return op.isPublic === true;
  return currentIsPublic === true;
}

/**
 * @param {{ isOwner?: boolean, isInvited?: boolean, isPublic?: boolean }} args
 * @returns {'owner' | 'player' | 'spectator' | 'denied'}
 */
export function classifyTableViewer({ isOwner = false, isInvited = false, isPublic = false } = {}) {
  if (isOwner) return 'owner';
  if (isInvited) return 'player';
  if (isPublic) return 'spectator';
  return 'denied';
}
