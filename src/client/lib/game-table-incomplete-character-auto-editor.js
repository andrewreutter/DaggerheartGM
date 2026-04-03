/**
 * Game Table: when the pinned character sheet opens, optionally also open the library editor
 * drawer for incomplete characters the viewer may edit.
 */
export function shouldAutoOpenCharacterEditorForIncompleteCharacter({
  viewerCanEditSheet,
  isCharacterComplete,
  editState,
  characterInstanceId,
}) {
  if (!viewerCanEditSheet) return false;
  if (isCharacterComplete) return false;
  if (
    editState?.step === 'form' &&
    editState?.presentation === 'rightDrawer' &&
    editState?.collection === 'characters' &&
    editState?.baseElement?.instanceId === characterInstanceId
  ) {
    return false;
  }
  return true;
}
