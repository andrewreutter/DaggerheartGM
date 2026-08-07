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
  /**
   * Merge SRD list rows with V2 `activeFeatures` when names match.
   * Registry-only rows marked `hideFromGuideFeatureList` stay out of the guide list body:
   * use the SRD `f` row so sheet `cards` / engine metadata do not duplicate guide copy.
   */
  const findRow = (f, type) => {
    const afRow = af.find((a) => {
      if (a.name !== f.name || a.type !== type) return false;
      const fMc = !!(f._multiclass || f._multiclassSubclass);
      const aMc = !!(a._multiclass || a._multiclassSubclass);
      return fMc === aMc;
    });
    if (afRow?.hideFromGuideFeatureList) {
      return {
        ...f,
        type,
        description: f.description || '',
        source: f.source,
        sourceType: f.sourceType,
      };
    }
    if (afRow) {
      return {
        ...f,
        ...afRow,
        type,
        description: afRow.description || f.description || '',
        source: f.source ?? afRow.source,
        sourceType: f.sourceType ?? afRow.sourceType,
      };
    }
    return {
      ...f,
      type,
      description: f.description || '',
      source: f.source,
      sourceType: f.sourceType,
    };
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
  // Include hope rows that expose a Default Card Action (explicit chips, root
  // hopeCost/onUse/frequency, or hooks) so they appear on the Actions strip.
  const hopeHasCardAction =
    !!hopeRow &&
    ((Array.isArray(hopeRow.chips) && hopeRow.chips.length > 0) ||
      typeof hopeRow.onUse === 'function' ||
      hopeRow.hopeCost != null ||
      hopeRow.stressCost != null ||
      hopeRow.frequency != null ||
      !!hopeRow.hooks);
  if (
    hopeHasCardAction &&
    !hopeRow.hideFromGuideFeatureList &&
    onV2CardChip &&
    !(el.classFeatures || []).some((f) => f.name === hn)
  ) {
    out.unshift({ kind: 'guide', row: hopeRow, key: `hope-${hn}` });
  }
  return out;
}

/**
 * Merge one `el.abilities` entry with V2 `activeFeatures` (`type: 'ability'`) for sheet / Actions / LOADOUT.
 * Single source of truth with {@link getOrderedGuideLoadoutEntries}.
 *
 * @param {object} el
 * @param {object} ability — entry from `el.abilities`
 */
export function resolveLoadoutAbilityFeatRow(el, ability) {
  return (
    el.activeFeatures?.find((f) => f.type === 'ability' && f.name === ability.name) || {
      name: ability.name,
      description: ability.description || '',
      type: 'ability',
      sourceType: 'domain',
      source: [ability.domain, ability.type, `Lvl ${ability.level}`].filter(Boolean).join(' · '),
    }
  );
}

/**
 * Ordered LOADOUT guide entries — domain cards only (`el.abilities`).
 * Each item includes `ability` (list row) for source-badge dimming on the Actions strip.
 *
 * @returns {{ kind: 'loadout', row: object, key: string, ability: object }[]}
 */
export function getOrderedGuideLoadoutEntries(el) {
  const out = [];
  let idx = 0;
  for (const a of el.abilities || []) {
    out.push({
      kind: 'loadout',
      row: resolveLoadoutAbilityFeatRow(el, a),
      key: `ability-${a.id ?? idx}`,
      ability: a,
    });
    idx += 1;
  }
  return out;
}
