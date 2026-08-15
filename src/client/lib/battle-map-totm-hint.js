/**
 * Empty-map overlay helpers + prep setup checklist completion predicates.
 */

export function getGmTotMEmptyMapHint({ tableStateReady, mapConfigHasImage }) {
  return tableStateReady && !mapConfigHasImage;
}

export function getPlayerTotMEmptyMapHint({ tableStateReady, mapConfigHasImage }) {
  return tableStateReady && !mapConfigHasImage;
}

/**
 * Build step: hide once meaningful content exists on the table.
 * A default/empty map with no image does NOT count — the user still needs to build.
 * Counts: a map with an image, adversaries, environments, countdowns, notes.
 */
export function isPrepBuildStepDone({
  maps = [],
  mapConfigHasImage = false,
  activeElements = [],
  sessionCountdowns = [],
}) {
  if (mapConfigHasImage) return true;
  // A map row only counts if it has actual art.
  if (Array.isArray(maps) && maps.some((m) => m?.mapImageUrl)) return true;
  if (Array.isArray(sessionCountdowns) && sessionCountdowns.length > 0) return true;
  return activeElements.some((el) => {
    const t = el?.elementType;
    return t === 'adversary' || t === 'environment' || t === 'note';
  });
}

/** Invite step: hide once an invite link exists. */
export function isPrepInviteStepDone({ inviteLink }) {
  return Boolean(inviteLink);
}

/**
 * Play step: same as Prep mode banner — show while `sessionStarted === false`.
 * Session start dismisses all checklist cards.
 */
export function isPrepPlayStepDone({ sessionStarted }) {
  return sessionStarted !== false;
}

/** Whether the session has started (dismisses the whole checklist). */
export function isPrepSessionActive({ sessionStarted }) {
  return sessionStarted !== false;
}
