/** Default source filter for library browse (Mine + SRD). Shared by `useCollectionSearch` and empty-state reset UI. */
export const LIBRARY_DEFAULT_INCLUDES = Object.freeze(['own', 'srd']);

/** Strips removed source keys from persisted `includes` (e.g. HoD toggle removed from UI). */
export function normalizePersistedIncludes(includes) {
  if (!Array.isArray(includes)) return includes;
  return includes.filter(s => s !== 'hod' && s !== 'fcg');
}
