/** Stable link between declarative `virtualTokens[]` and persisted `boardToken` rows. */
export const BEASTBOUND_COMPANION_VIRTUAL_TOKEN_ID = 'beastbound-companion';

export function characterWantsCompanionBoardToken(el) {
  return (
    el?.elementType === 'character' &&
    el.subclassId === 'srd-sub-beastbound' &&
    el.companion != null
  );
}

export function isCompanionBoardToken(el) {
  return (
    el?.elementType === 'boardToken' &&
    (el.virtualTokenId === BEASTBOUND_COMPANION_VIRTUAL_TOKEN_ID || el.tokenKind === 'companion')
  );
}

export function hasCompanionBoardToken(activeElements, parentInstanceId) {
  return (activeElements || []).some(
    (e) => isCompanionBoardToken(e) && e.parentInstanceId === parentInstanceId,
  );
}

/**
 * @param {string} parentInstanceId
 * @param {{ name?: string } | null | undefined} companion
 * @returns {object} element for `add-elements`
 */
export function buildCompanionBoardTokenElement(parentInstanceId, companion) {
  const label =
    companion?.name != null && String(companion.name).trim() !== ''
      ? String(companion.name)
      : 'Companion';
  return {
    elementType: 'boardToken',
    instanceId: crypto.randomUUID(),
    parentInstanceId,
    virtualTokenId: BEASTBOUND_COMPANION_VIRTUAL_TOKEN_ID,
    tokenKind: 'companion',
    label,
    tokenX: null,
    tokenY: null,
    mapId: null,
  };
}

/** Rows to `add-elements` for Beastbound PCs missing a companion board token (GM reconciliation). */
export function collectMissingCompanionBoardTokenElements(activeElements) {
  const list = activeElements || [];
  const out = [];
  for (const el of list) {
    if (el.elementType !== 'character') continue;
    if (!characterWantsCompanionBoardToken(el)) continue;
    if (hasCompanionBoardToken(list, el.instanceId)) continue;
    out.push(buildCompanionBoardTokenElement(el.instanceId, el.companion));
  }
  return out;
}
