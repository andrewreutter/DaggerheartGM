/**
 * Item image storage helpers — defense-in-depth guard that ensures inline `data:` URLs on
 * character/adversary/environment/scene/adventure items never persist in the database.
 *
 * Mirrors the pattern in `src/server/map-storage.js` (which guards map/overlay images on
 * `table_state`). Built on `uploadDataUrlToMapStorageIfNeeded` from that module so all
 * uploads use the same `whiteboard-assets` Supabase bucket; item images land under the
 * `item-images/{ownerUid}/{uuid}.{ext}` path.
 *
 * `supabase` is passed in rather than imported so this module has no side effects at import
 * time and is easy to unit-test with a mock client.
 */
import { uploadDataUrlToMapStorageIfNeeded } from './map-storage.js';

const DEFAULT_FOLDER = 'item-images';

/**
 * Sanitize a single `{ imageUrl, _additionalImages }` pair (shallow — used by the dedicated
 * `PUT /api/data/:collection/:id/image` route which only handles image fields at the top
 * level).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string} ownerUid
 * @param {{ imageUrl?: string, _additionalImages?: string[] }} fields
 * @param {string} [folder]
 * @returns {Promise<{ imageUrl?: string, _additionalImages?: string[] }>}
 */
export async function sanitizeImageFields(supabase, ownerUid, { imageUrl, _additionalImages }, folder = DEFAULT_FOLDER) {
  const result = {};
  if (imageUrl !== undefined) {
    result.imageUrl = await uploadDataUrlToMapStorageIfNeeded(supabase, ownerUid, imageUrl, folder);
  }
  if (_additionalImages !== undefined) {
    result._additionalImages = await Promise.all(
      (Array.isArray(_additionalImages) ? _additionalImages : []).map((u) =>
        uploadDataUrlToMapStorageIfNeeded(supabase, ownerUid, u, folder),
      ),
    );
  }
  return result;
}

/**
 * Deep-walk an arbitrary item JSON tree and upload every `imageUrl` / `_additionalImages`
 * entry that is still an inline `data:` URL.
 *
 * Handles:
 *  - Top-level `{ imageUrl, _additionalImages }` on any library item.
 *  - Nested scene shapes: `adversaries[].data.imageUrl`, `environments[].data.imageUrl`.
 *  - Any other plain objects/arrays encountered recursively.
 *
 * Fast-path: if the tree contains no `data:` strings at all, returns `value` unchanged (no
 * deep clone, no uploads, `supabase.storage.from` never called).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string} ownerUid
 * @param {unknown} value
 * @param {string} [folder]
 * @returns {Promise<unknown>}
 */
export async function sanitizeItemImageDataUrlsDeep(supabase, ownerUid, value, folder = DEFAULT_FOLDER) {
  if (!hasAnyDataUrl(value)) return value;
  return walkAndSanitize(supabase, ownerUid, value, folder);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasAnyDataUrl(val) {
  if (typeof val === 'string') return val.startsWith('data:');
  if (Array.isArray(val)) return val.some(hasAnyDataUrl);
  if (val && typeof val === 'object') return Object.values(val).some(hasAnyDataUrl);
  return false;
}

async function walkAndSanitize(supabase, ownerUid, value, folder) {
  if (typeof value === 'string') {
    return uploadDataUrlToMapStorageIfNeeded(supabase, ownerUid, value, folder);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => walkAndSanitize(supabase, ownerUid, item, folder)));
  }
  if (value && typeof value === 'object') {
    const result = {};
    await Promise.all(
      Object.entries(value).map(async ([k, v]) => {
        if ((k === 'imageUrl' || k === '_additionalImages') && hasAnyDataUrl(v)) {
          result[k] = await walkAndSanitize(supabase, ownerUid, v, folder);
        } else if (typeof v === 'object' && v !== null && hasAnyDataUrl(v)) {
          result[k] = await walkAndSanitize(supabase, ownerUid, v, folder);
        } else {
          result[k] = v;
        }
      }),
    );
    return result;
  }
  return value;
}
