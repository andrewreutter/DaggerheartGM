/**
 * Pure helper for `UnifiedImportProvider` (`unified-import-context.jsx`): builds the ordered,
 * de-duplicated list of "Add image to X" menu targets for the currently registered editable
 * item (see `registerEditableItem`). The primary item's own image comes first, followed by any
 * `extraTargets` it registered (e.g. a character's Beastbound companion) — this module has no
 * knowledge of what "companion" means, it just forwards whatever targets are present.
 *
 * @param {{ name?: string, onAddImageUrl?: (url: string) => void, extraTargets?: { key: string, label?: string, onAddImageUrl?: (url: string) => void }[] } | null | undefined} editableItem
 * @returns {{ key: string, label: string|undefined, onAddImageUrl: (url: string) => void }[]}
 */
export function buildAddToItemTargets(editableItem) {
  if (!editableItem) return [];
  const candidates = [
    editableItem.onAddImageUrl ? { key: 'primary', label: editableItem.name, onAddImageUrl: editableItem.onAddImageUrl } : null,
    ...(Array.isArray(editableItem.extraTargets) ? editableItem.extraTargets : []),
  ];
  return candidates.filter((t) => t && typeof t.onAddImageUrl === 'function');
}
