/**
 * Interim UX for `table.move()` from V2 review chips: broadcast an action banner describing
 * the required forced movement instead of arming `v2PendingMove` / map locks.
 */
export function buildForcedMovementActionNotification(payload, activeElements) {
  const id = payload?.instanceId;
  const el = Array.isArray(activeElements)
    ? activeElements.find(
        (e) =>
          e &&
          (e.instanceId === id || e.id === id || String(e.instanceId) === String(id))
      )
    : null;
  const rollUser = el?.name || 'Character';
  const dc = String(payload?.desiredCondition ?? '').trim();
  const desc = String(payload?.description ?? '').trim();
  const actionText =
    [dc, desc].filter(Boolean).join(' — ') ||
    'Place the token on the map to satisfy this feature’s forced movement.';
  return {
    _action: true,
    rollUser,
    actionName: 'Forced movement',
    actionText,
  };
}
