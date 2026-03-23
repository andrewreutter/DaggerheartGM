/**
 * V2 hover / sheet metadata: spellcast lines and target hints from description,
 * plus small text extractors for embedded sub-options (not full prose "feature parsing").
 *
 * Does **not** infer Hope/Stress costs from prose — those come from V2 `card` chips
 * and registry fields (see `deriveFeatureActionFromV2Row` in client).
 */

/**
 * Merge spellcast/target metadata into a feature row copy (non-mutating).
 * Safe to call on registry-loaded rows; returns a new object when anything is added.
 *
 * @param {object} row
 * @returns {object}
 */
export function enrichHoverActionMeta(row) {
  if (!row || typeof row !== 'object') return row;
  const description = row.description ?? '';
  if (typeof description !== 'string' || !description) return row;

  const added = {};

  if (row.spellcastDC == null) {
    const spellcastMatch = description.match(/spellcast roll\s*\((\d+)\)/i);
    if (spellcastMatch) added.spellcastDC = parseInt(spellcastMatch[1], 10);
  }

  if (row.spellcastVsRoll !== true && row.spellcastDC == null && added.spellcastDC == null) {
    if (/\bmake\s+(?:a\s+)?\*\*spellcast\s+roll\*\*/i.test(description)) {
      added.spellcastVsRoll = true;
    }
  }

  const lower = description.toLowerCase();
  if (row.impliesTarget === undefined || row.impliesTarget === null) {
    added.impliesTarget = /\btarget\b|\badversary\b|\bally\b|\benemy\b/i.test(lower);
  }
  const implies = added.impliesTarget ?? row.impliesTarget;
  if (row.targetType == null) {
    if (/adversary|enemy/i.test(lower)) added.targetType = 'adversary';
    else if (/\bally\b|another player character|another character/i.test(lower)) added.targetType = 'character';
    else if (implies) added.targetType = 'adversary';
  }

  return Object.keys(added).length ? { ...row, ...added } : row;
}

/**
 * Hope / Stress / Armor costs from free text (embedded sub-features, bullets).
 * Used when there is no merged V2 chip for the fragment.
 */
export function extractEmbeddedResourceCostsFromText(description) {
  if (!description) {
    return {
      hopeCost: 0,
      stressCost: 0,
      armorMark: 0,
      armorClear: 0,
      frequency: null,
    };
  }
  const lower = description.toLowerCase();

  let hopeCost = 0;
  const hopeMatch =
    lower.match(/(?:spend|costs?)\s+(\d+)\s+hope/) ||
    lower.match(/(\d+)\s+hope/);
  if (hopeMatch) {
    hopeCost = parseInt(hopeMatch[1], 10);
  } else if (/spend a hope/.test(lower)) {
    hopeCost = 1;
  }

  let stressCost = 0;
  const stressExplicit = lower.match(/mark\s+(\d+)\s+stress|spend\s+(\d+)\s+stress/);
  if (stressExplicit) {
    stressCost = parseInt(stressExplicit[1] || stressExplicit[2], 10);
  } else if (/mark a stress|mark 1 stress/.test(lower)) {
    stressCost = 1;
  }

  let armorMark = 0;
  const armorMarkMatch = lower.match(/mark\s+(\d+)\s+armor(?:\s+slot)?/);
  if (armorMarkMatch) {
    armorMark = parseInt(armorMarkMatch[1], 10);
  } else if (/mark an armor slot/.test(lower)) {
    armorMark = 1;
  }

  let armorClear = 0;
  const armorClearMatch = lower.match(/clear\s+(\d+)\s+armor(?:\s+slot)?/);
  if (armorClearMatch) {
    armorClear = parseInt(armorClearMatch[1], 10);
  } else if (/clear an armor slot/.test(lower)) {
    armorClear = 1;
  }

  let frequency = null;
  if (/once per session|once a session|beginning of (?:each|every) session|at the start of (?:each|every) session/i.test(lower)) {
    frequency = 'session';
  } else if (/once per long rest|after (?:a|your) long rest/i.test(lower)) {
    frequency = 'longRest';
  } else if (/once per rest|once per short rest|after (?:a|your) rest\b|per rest/i.test(lower)) {
    frequency = 'rest';
  }

  return { hopeCost, stressCost, armorMark, armorClear, frequency };
}

/** First sentence with "have/gain advantage on…" — for legacy sub-bullets without `advantageTriggers`. */
export function extractAdvantageConditionFromText(description) {
  if (!description || typeof description !== 'string') return null;
  const advMatch = description.match(/([^.]*(?:have|gain) advantage on[^.]+)(?:\.|$)/i);
  return advMatch ? advMatch[1].trim().replace(/\.$/, '') : null;
}
