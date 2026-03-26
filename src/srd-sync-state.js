/**
 * sync_state key `srd_hash` stores `${REVISION}:${contentHash}`.
 * Bump REVISION when loader semantics change (e.g. which collections are written)
 * so existing databases re-fill external_item_cache without requiring a submodule change.
 */
export const SRD_EXTERNAL_CACHE_REVISION = '2';

/** @param {string | null | undefined} contentHash */
export function formatSrdCacheStamp(contentHash) {
  if (!contentHash) return null;
  return `${SRD_EXTERNAL_CACHE_REVISION}:${contentHash}`;
}
