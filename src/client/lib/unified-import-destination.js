/**
 * Resolves Library / Table / Both import modes for the unified import modal (GM on Game Table).
 * When not on the table, destination is treated as library-only.
 */

export function resolveUnifiedImportDestination(isGameTableGm, importDestination) {
  const dest = isGameTableGm ? importDestination : 'library';
  return {
    dest,
    wantTable: dest === 'table' || dest === 'both',
    wantLibrary: dest === 'library' || dest === 'both',
  };
}

export function isTableAddableCollection(col) {
  return col === 'adversaries' || col === 'environments' || col === 'scenes';
}

/**
 * Whether to persist via saveItem for this collection and destination.
 * Map and notes never use saveItem here.
 */
export function shouldSaveItemForUnifiedImport(col, dest, wantLibrary) {
  if (col === 'map' || col === 'notes') return false;
  const tableAddable = isTableAddableCollection(col);
  return wantLibrary || (dest === 'table' && !tableAddable);
}

/**
 * Whether to add adversary/environment/scene rows to the encounter after import.
 */
export function shouldAddImportedRowToTable(isGameTableGm, col, wantTable) {
  return wantTable && isGameTableGm && isTableAddableCollection(col);
}
