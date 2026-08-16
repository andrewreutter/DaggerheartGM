/**
 * Group Game Table / Scene `activeElements` the way the Encounter sidebar does:
 * characters, notes, and environments stay one row each; adversaries collapse by library id.
 *
 * @param {Array<object>} [activeElements]
 * @returns {Array<object>}
 */
export function groupEncounterElements(activeElements) {
  const result = [];
  const seenAdvKeys = {};
  for (const el of activeElements || []) {
    if (el.elementType === 'character') {
      result.push({ kind: 'character', element: el });
    } else if (el.elementType === 'note') {
      result.push({ kind: 'note', element: el });
    } else if (el.elementType === 'environment') {
      result.push({ kind: 'environment', element: el });
    } else if (el.elementType === 'adversary') {
      const key = el.id || el.instanceId;
      if (seenAdvKeys[key] === undefined) {
        seenAdvKeys[key] = result.length;
        result.push({ kind: 'adversary-group', baseElement: el, instances: [el] });
      } else {
        result[seenAdvKeys[key]].instances.push(el);
      }
    }
  }
  return result;
}
