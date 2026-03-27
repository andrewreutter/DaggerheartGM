/**
 * File detection for Game Table / Page regions encounter import drop targets.
 * Finder and some exports leave {@link File#type} empty; still treat as image by extension.
 */
export function isEncounterImportImageFile(f) {
  if (!f) return false;
  const t = (f.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  if (t === '' && /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(f.name)) return true;
  return false;
}

/**
 * Prefer `files`; some browsers expose only `items` until drop.
 * @param {DataTransfer} dt
 * @returns {File | null}
 */
export function firstImageFileFromDataTransfer(dt) {
  if (!dt) return null;
  const fromFiles = dt.files?.[0];
  if (fromFiles && isEncounterImportImageFile(fromFiles)) return fromFiles;
  const items = dt.items;
  if (!items?.length) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind !== 'file') continue;
    const f = it.getAsFile();
    if (f && isEncounterImportImageFile(f)) return f;
  }
  return null;
}
