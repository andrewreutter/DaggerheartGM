/**
 * When the GM manually marks Stress (or similar) on a character while a roll's
 * resource cost is still "pending" (dashed boxes), reduce the pending tally so
 * the preview stays in sync. Banner ack still applies the roll's cost, but
 * `min(current + cost, max)` caps correctly when stress was pre-marked.
 *
 * @param {Record<string, { hope?: number; stress?: number; armorMark?: number; armorClear?: number }>} prev
 * @param {string} instanceId
 * @param {number} delta — positive amount of stress just marked manually
 * @returns {typeof prev} next map (same ref if unchanged)
 */
export function reducePendingStressAfterManualMark(prev, instanceId, delta) {
  if (delta <= 0) return prev;
  const cur = prev[instanceId];
  if (!cur?.stress) return prev;
  const dec = Math.min(cur.stress, delta);
  const stress = cur.stress - dec;
  const nextEntry = { ...cur, stress };
  if (!nextEntry.hope && !nextEntry.stress && !nextEntry.armorMark && !nextEntry.armorClear) {
    const { [instanceId]: _, ...rest } = prev;
    return rest;
  }
  return { ...prev, [instanceId]: nextEntry };
}
