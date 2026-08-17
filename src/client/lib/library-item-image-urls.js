/**
 * Primary art URL for library chrome (modal thumb, card thumb).
 * Prefer `imageUrl`; fall back to `image` when that is already an absolute URL.
 */
function primaryImageUrl(item) {
  const direct = item.imageUrl || item.mapImageUrl;
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const raw = item.image;
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return s;
}

/** Primary + extra gallery URLs for library/modal image chrome. */
export function getLibraryItemImageUrls(item) {
  if (!item) return [];
  const primary = primaryImageUrl(item);
  const extras = Array.isArray(item._additionalImages) ? item._additionalImages : [];
  return [primary, ...extras].filter(Boolean);
}
