/**
 * Pure helper: resolves which image paste/drop actions are available in the current context.
 * The first matching priority wins; a resolved set of exactly one action should be applied
 * immediately by the caller without opening a picker menu.
 *
 * Priority (first match wins):
 *  1. Character/adversary editor open → only "Add to item" targets; map and import options excluded.
 *  2. Add Map picker dialog open      → only "New Map" (caller auto-dismisses the picker after).
 *  3. Map Editor (library map) open   → only "Replace Map" scoped to the editor.
 *  4. Otherwise                       → all non-null Game Table / Library options.
 *
 * @param {object} [ctx]
 * @param {{ key: string, label: string|undefined, onAdd: (file: File) => Promise<void> }[]} [ctx.addToItemTargets]
 * @param {(() => void) | null} [ctx.addMapDialogDismiss]
 * @param {((file: File) => Promise<void>) | null} [ctx.onNewMap]
 * @param {((file: File) => Promise<void>) | null} [ctx.onMapEditorReplace]
 * @param {((file: File) => Promise<void>) | null} [ctx.onReplaceMap]
 * @param {((file: File) => Promise<void>) | null} [ctx.onNewImageObject]
 * @param {((file?: File) => void) | null} [ctx.onImportTools]
 * @returns {{ key: string, label?: string, run: (file?: File) => Promise<void> }[]}
 */
export function resolveImagePasteActions({
  addToItemTargets = [],
  addMapDialogDismiss = null,
  onNewMap = null,
  onMapEditorReplace = null,
  onReplaceMap = null,
  onNewImageObject = null,
  onImportTools = null,
} = {}) {
  // Priority 1: character/adversary editor — only add-to-item targets, no map or import options.
  if (addToItemTargets.length > 0) {
    return addToItemTargets.map((t) => ({
      key: `add-to-item-${t.key}`,
      label: t.label,
      run: t.onAdd,
    }));
  }

  // Priority 2: Add Map dialog open — only New Map, auto-dismiss the dialog when done.
  if (addMapDialogDismiss) {
    if (!onNewMap) return [];
    return [{
      key: 'new-map',
      run: async (file) => {
        await onNewMap(file);
        addMapDialogDismiss();
      },
    }];
  }

  // Priority 3: Map Editor open — only editor-scoped replace (not the live-table replace).
  if (onMapEditorReplace) {
    return [{ key: 'replace-map', run: onMapEditorReplace }];
  }

  // Priority 4: Game Table / Library — all non-null options in display order.
  const actions = [];
  if (onNewMap) actions.push({ key: 'new-map', run: onNewMap });
  if (onReplaceMap) actions.push({ key: 'replace-map', run: onReplaceMap });
  if (onNewImageObject) actions.push({ key: 'new-image-object', run: onNewImageObject });
  if (onImportTools) actions.push({ key: 'import-tools', run: async (file) => { onImportTools(file); } });
  return actions;
}
