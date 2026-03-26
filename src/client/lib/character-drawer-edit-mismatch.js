/**
 * Game Table: pinned character sheet overlay vs right-drawer library edit session.
 * When they refer to different `instanceId`s, merging form preview into the sheet is wrong.
 */
export function characterDrawerEditMismatch(editState, characterOverlay) {
  if (editState?.step !== 'form' || editState?.presentation !== 'rightDrawer' || editState?.collection !== 'characters') {
    return false;
  }
  if (!characterOverlay?.isOpen || !characterOverlay?.data?.element) return false;
  const editingId = editState.baseElement?.instanceId ?? editState.instances?.[0]?.instanceId;
  const pinnedId = characterOverlay.data.element.instanceId;
  return editingId != null && pinnedId != null && editingId !== pinnedId;
}

/**
 * While the Game Table character editor is open in the unified sheet card, do not dismiss the
 * pinned sheet on outside mousedown/touch (portaled pickers and the modal backdrop sit outside
 * the overlay DOM subtree).
 */
export function shouldSuppressCharacterOverlayOutsideDismiss(editState, characterOverlay, mismatch) {
  return (
    !!characterOverlay?.isOpen &&
    editState?.step === 'form' &&
    editState?.presentation === 'rightDrawer' &&
    editState?.collection === 'characters' &&
    !mismatch
  );
}
