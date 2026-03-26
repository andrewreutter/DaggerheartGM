/**
 * Game Table: derive character ItemDetailModal mode from /table/:id/characters/:characterId URL sync.
 * Table-only stubs (not yet saved to the library) use mode "new".
 */
export function resolveGameTableCharacterEditMode(baseElement, libraryCharacters, canEditOriginal) {
  const inLibrary =
    Array.isArray(libraryCharacters) && libraryCharacters.some((c) => c.id === baseElement?.id);
  if (!inLibrary) return 'new';
  return canEditOriginal ? 'original' : 'copy';
}
