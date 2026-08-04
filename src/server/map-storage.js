/**
 * Map/overlay image storage helpers (Supabase Storage bucket `whiteboard-assets`).
 *
 * Shared by the `POST /api/room/my/map-image` upload route and the server-side blob guard in
 * `applyOpToTableState` in server.js (Fix 1, game table latency plan: inline base64 `data:`
 * URLs must never persist in `table_state` — they get read/written/broadcast on every
 * unrelated op for that table; see docs/plans or the latency diagnosis plan for the incident
 * that motivated this).
 *
 * `supabase` (a `@supabase/supabase-js` client, or `null` when unconfigured) is passed in
 * rather than imported so this module has no side effects at import time and is easy to unit
 * test with a mock client.
 */
import { randomUUID } from 'crypto';

export const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/apng': 'apng',
};

/**
 * Parse a base64 `data:` URL into its mimetype and decoded buffer.
 * @param {*} value
 * @returns {{ mimetype: string, buffer: Buffer } | null} `null` when `value` isn't a base64 data URL.
 */
export function parseDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null;
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,(.+)$/s.exec(value);
  if (!match) return null;
  const [, mimetype, base64] = match;
  return { mimetype, buffer: Buffer.from(base64, 'base64') };
}

/**
 * Upload an image buffer to `whiteboard-assets/{folder}/{ownerUid}/{uuid}.{ext}`.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @returns {Promise<string|null>} the public URL, or `null` when Supabase isn't configured.
 */
export async function uploadBufferToMapStorage(supabase, ownerUid, buffer, mimetype, folder) {
  if (!supabase) return null;
  const ext = MIME_TO_EXT[mimetype] || 'bin';
  const storagePath = `${folder}/${ownerUid}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('whiteboard-assets')
    .upload(storagePath, buffer, { contentType: mimetype, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('whiteboard-assets').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Defense-in-depth guard: if `value` is an inline `data:` URL, upload it to Storage and return
 * the resulting URL. Non-data-URL values (already a URL, `null`, `undefined`) pass through
 * unchanged. Falls back to returning the original data URL (with a warning) when Supabase isn't
 * configured or the upload fails, so local dev without Storage keeps working.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 */
export async function uploadDataUrlToMapStorageIfNeeded(supabase, ownerUid, value, folder) {
  const parsed = parseDataUrl(value);
  if (!parsed) return value;
  try {
    const url = await uploadBufferToMapStorage(supabase, ownerUid, parsed.buffer, parsed.mimetype, folder);
    if (url) return url;
    console.warn(
      `[map-storage] Supabase not configured; storing inline ${folder} data URL (${parsed.buffer.length} bytes) in table_state for ${ownerUid} — row will grow.`,
    );
    return value;
  } catch (err) {
    console.error(`[map-storage] Failed to upload inline ${folder} image for ${ownerUid}; keeping data URL:`, err);
    return value;
  }
}
