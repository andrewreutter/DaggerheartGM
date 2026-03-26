/**
 * Merge batched `update-elements` rows for one instance into a single patch (e.g. player `postCharacterUpdate`).
 */
export function mergeUpdatesForInstance(updates, instanceId) {
  const merged = {};
  for (const u of updates) {
    if (u.instanceId !== instanceId) continue;
    Object.assign(merged, u.updates);
  }
  return merged;
}
