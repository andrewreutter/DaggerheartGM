/**
 * Guide row ordering and keys for `CharacterFeatureList` / `GuideFeatureCard`.
 * Pure module (no React) — safe for unit tests and `feature-usage-key.js`.
 */

/** Hope ability name from `hopeFeature` / `hopeAbility` (string or object). */
export function resolveHopeFeatureName(el) {
  const hopeFeature = el?.hopeFeature || el?.hopeAbility;
  if (!hopeFeature) return null;
  if (typeof hopeFeature === 'object') {
    return hopeFeature.name || el?.hopeAbilityName || null;
  }
  const str = String(hopeFeature);
  const colonIdx = str.indexOf(': ');
  if (colonIdx > 0) return str.slice(0, colonIdx).trim();
  return el?.hopeAbilityName || null;
}

/**
 * Same ordering as `CharacterFeatureList` guide rows (class → beastform sub-features → subclass → ancestry → community).
 * Beastform rows merge SRD `beastformFeatures` with V2 `activeFeatures` (`type: 'beastform'`) for chips / engine metadata.
 */
export function getOrderedGuideFeatureEntries(el, onV2CardChip) {
  const af = el.activeFeatures || [];
  const findRow = (f, type) =>
    af.find((a) => a.name === f.name && a.type === type) || {
      ...f,
      type,
      description: f.description || '',
      source: f.source,
      sourceType: f.sourceType,
    };
  const out = [];
  let idx = 0;
  for (const f of el.classFeatures || []) {
    out.push({ kind: 'guide', row: findRow(f, 'class'), key: f.id || `class-${f.name}-${idx++}` });
  }
  for (const f of el.beastformFeatures || []) {
    const engineRow = af.find((a) => a.type === 'beastform' && a.name === f.name);
    const row = engineRow
      ? {
          ...engineRow,
          sourceType: engineRow.sourceType ?? f.sourceType ?? 'beastform',
          source: engineRow.source ?? f.source,
        }
      : {
          ...f,
          type: 'beastform',
          description: f.description || '',
          sourceType: f.sourceType ?? 'beastform',
        };
    out.push({ kind: 'guide', row, key: f.id ? `bf-${f.id}` : `bf-${f.name}-${idx++}` });
  }
  for (const f of el.subclassFeatures || []) {
    out.push({ kind: 'guide', row: findRow(f, 'subclass'), key: f.id || `sub-${f.name}-${idx++}` });
  }
  for (const f of el.ancestryFeatures || []) {
    out.push({ kind: 'guide', row: findRow(f, 'ancestry'), key: f.id || `anc-${f.name}-${idx++}` });
  }
  for (const f of el.communityFeatures || []) {
    out.push({ kind: 'guide', row: findRow(f, 'community'), key: f.id || `com-${f.name}-${idx++}` });
  }

  const hn = resolveHopeFeatureName(el);
  const hopeRow = hn && af.find((a) => a.name === hn);
  if (
    hopeRow &&
    onV2CardChip &&
    Array.isArray(hopeRow.chips) &&
    hopeRow.chips.length > 0 &&
    !(el.classFeatures || []).some((f) => f.name === hn)
  ) {
    out.unshift({ kind: 'guide', row: hopeRow, key: `hope-${hn}` });
  }
  return out;
}
