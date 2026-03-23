/**
 * Pre-roll intent panel: synthetic toggles for passive V2 `advantageTriggers`.
 */

export function collectAdvantageTriggerStrings(row) {
  const raw = row?.advantageTriggers;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x : x?._value))
    .filter(Boolean)
    .map((c) => String(c).trim())
    .filter(Boolean);
}

/**
 * @param {object} characterEl
 * @param {object} resolvers
 * @param {function(object, string): object|null} resolvers.resolveOriginFeatureDescriptor
 * @param {function(object, string): object|null} resolvers.resolveClassFeatureDescriptor
 * @param {function(string, object): object|null} [resolvers.resolveWeaponTagDescriptor]
 * @returns {object[]} descriptors suitable for `canvas.addChip` (include `isVisible`)
 */
export function buildAdvantageTriggerPrerollChips(characterEl, resolvers) {
  const {
    resolveOriginFeatureDescriptor,
    resolveClassFeatureDescriptor,
    resolveWeaponTagDescriptor,
  } = resolvers || {};
  const out = [];
  const seen = new Set();

  const pushFromRow = (featureName, row) => {
    if (!featureName || !row) return;
    for (const cond of collectAdvantageTriggerStrings(row)) {
      const key = `${featureName}\0${cond}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const short = cond.length > 100 ? `${cond.slice(0, 97)}…` : cond;
      out.push({
        label: `${featureName}: ${short}`,
        _featureName: featureName,
        _advantageTriggerChip: true,
        isVisible: () => true,
      });
    }
  };

  if (Array.isArray(characterEl.activeFeatures) && characterEl.activeFeatures.length > 0) {
    for (const row of characterEl.activeFeatures) {
      if (row?.name) pushFromRow(row.name, row);
    }
  } else {
    const names = [
      ...(characterEl.ancestryFeatures || []).map((f) => f.name),
      ...(characterEl.communityFeatures || []).map((f) => f.name),
      ...(characterEl.classFeatures || []).map((f) => f.name),
      ...(characterEl.subclassFeatures || []).map((f) => f.name),
    ];
    for (const name of names) {
      if (!name) continue;
      const row =
        resolveOriginFeatureDescriptor?.(characterEl, name) ||
        resolveClassFeatureDescriptor?.(characterEl, name);
      pushFromRow(name, row);
    }
  }

  if (typeof resolveWeaponTagDescriptor === 'function') {
    for (const w of characterEl.weapons || []) {
      const feat = w.feature;
      if (!feat?.name) continue;
      const wrow = resolveWeaponTagDescriptor(feat.name, characterEl);
      pushFromRow(feat.name || w.name, wrow);
    }
  }

  return out;
}
