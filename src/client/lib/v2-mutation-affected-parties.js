/**
 * Infer which other **player characters** were targeted by V2 engine mutations (e.g. Rally clears
 * ally Stress) by scanning `{ type, payload }` rows — no feature source parsing.
 *
 * Summaries group by mutation **shape** (type + amounts / condition / etc.), not by character, so
 * multiple allies with the same effect read as e.g. "2 HP each to Vodalus and Vivius".
 *
 * Numeric totals (Hope, Stress, HP, Armor, Gold) use **applied** amounts after the same caps as
 * `applyV2BannerMutations` (via {@link accumulateOtherPartyEffectiveNumericDeltas}), not raw payload
 * values.
 *
 * Only `elementType === 'character'` rows count as "other parties". Mutations without a resolvable
 * `instanceId` on the allowlist are ignored.
 */

import { accumulateOtherPartyEffectiveNumericDeltas } from './table-ops.js';

/** @param {string|null|undefined} id @param {object[]} activeElements */
export function resolveCanonicalInstanceId(id, activeElements) {
  if (id == null || id === '') return null;
  const s = String(id);
  const match = (activeElements || []).find(
    (e) =>
      e &&
      (e.instanceId === id ||
        e.id === id ||
        String(e.instanceId) === s ||
        String(e.id) === s)
  );
  return match ? (match.instanceId ?? match.id) : null;
}

/**
 * Mutation types whose primary target is `payload.instanceId` (character / adversary row).
 * Excludes `actionLoop`, `setFeatureState`, roll-shape rows, and table-level `broadcast` / `gainFear`.
 */
const INSTANCE_TARGETING_MUTATION_TYPES = new Set([
  'spendHope',
  'gainHope',
  'markStress',
  'clearStress',
  'markHP',
  'clearHP',
  'markArmor',
  'clearArmor',
  'spendGold',
  'addCondition',
  'removeCondition',
  'appendActiveModifier',
  'removeActiveModifier',
  'setFocusTarget',
  'setRangerFocusOnNextAttack',
  'setFocusedBy',
  'setPrayerDicePool',
  'removePrayerDieAt',
  'clearFeatureUsageKey',
  'addRestAction',
  'addExperienceBonus',
  'runtimeStatMod',
  'inventoryAdd',
  'inventoryRemove',
  'loadoutSwapCard',
  'domainCardMoveToVault',
  'move',
  'restrictMovement',
  'allowMovement',
]);

const NUMERIC_AMOUNT_TYPES = new Set([
  'spendHope',
  'gainHope',
  'markStress',
  'clearStress',
  'markHP',
  'clearHP',
  'markArmor',
  'clearArmor',
  'spendGold',
]);

/**
 * @param {string[]} names — sorted for stable output
 */
function formatNameList(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * @param {string} type
 * @param {object} row — merged row: { amount?, condition?, featureKey?, modifierName?, ... }
 * @param {object[]} els — activeElements (for resolving focus target ids to names)
 */
function formatMutationGroupPhrase(type, row, namesSorted, els) {
  const nl = formatNameList(namesSorted);
  const n = Math.max(0, Math.floor(Number(row.amount)) || 0);

  switch (type) {
    case 'clearHP':
      return `${n} HP each to ${nl}`;
    case 'markHP':
      return `${n} HP damage each to ${nl}`;
    case 'clearStress':
      return `cleared ${n} Stress each from ${nl}`;
    case 'markStress':
      return `${n} Stress each to ${nl}`;
    case 'spendHope':
      return `spent ${n} Hope each for ${nl}`;
    case 'gainHope':
      return `${n} Hope each to ${nl}`;
    case 'markArmor':
      return `${n} Armor slot${n === 1 ? '' : 's'} marked each for ${nl}`;
    case 'clearArmor':
      return `cleared ${n} Armor slot${n === 1 ? '' : 's'} each from ${nl}`;
    case 'spendGold':
      return `${n} gold spent each from ${nl}`;
    case 'addCondition': {
      const c = row.condition != null ? String(row.condition).trim() : '';
      return c ? `added “${c}” to ${nl}` : `condition added to ${nl}`;
    }
    case 'removeCondition': {
      const c = row.condition != null ? String(row.condition).trim() : '';
      return c ? `removed “${c}” from ${nl}` : `condition removed from ${nl}`;
    }
    case 'appendActiveModifier': {
      const label = row.modifierName != null ? String(row.modifierName).trim() : '';
      return label ? `modifier “${label}” on ${nl}` : `modifier on ${nl}`;
    }
    case 'removeActiveModifier':
      return `modifier removed from ${nl}`;
    case 'clearFeatureUsageKey': {
      const k = row.featureKey != null ? String(row.featureKey).trim() : '';
      return k ? `refreshed “${k}” for ${nl}` : `usage refreshed for ${nl}`;
    }
    case 'addExperienceBonus': {
      const id = row.experienceId != null ? String(row.experienceId).trim() : '';
      const amt = Math.max(0, Math.floor(Number(row.amount)) || 0);
      return id
        ? `+${amt} experience bonus (${id}) for ${nl}`
        : `+${amt} experience bonus for ${nl}`;
    }
    case 'setRangerFocusOnNextAttack':
      return row.value === true ? `Ranger focus armed for ${nl}` : `Ranger focus cleared for ${nl}`;
    case 'setFocusedBy': {
      const by = row.focusedBy != null ? String(row.focusedBy).trim() : '';
      return by ? `Focus from ${by} on ${nl}` : `Focus updated on ${nl}`;
    }
    case 'setFocusTarget': {
      const tid = row.focusTargetInstanceId != null ? String(row.focusTargetInstanceId).trim() : '';
      const canon = tid ? resolveCanonicalInstanceId(tid, els) : null;
      const tlabel = canon ? displayNameForId(els, canon) : tid || 'target';
      return tid ? `Focus on ${tlabel} for ${nl}` : `Focus updated on ${nl}`;
    }
    case 'addRestAction':
      return `rest action recorded for ${nl}`;
    case 'setPrayerDicePool':
      return `Prayer dice pool updated for ${nl}`;
    case 'removePrayerDieAt':
      return `Prayer die removed for ${nl}`;
    case 'inventoryAdd':
      return `inventory gained on ${nl}`;
    case 'inventoryRemove':
      return `inventory removed on ${nl}`;
    case 'loadoutSwapCard':
      return `domain loadout swap on ${nl}`;
    case 'domainCardMoveToVault':
      return `domain card to vault on ${nl}`;
    case 'move':
      return `movement request on ${nl}`;
    case 'restrictMovement':
      return `movement restricted for ${nl}`;
    case 'allowMovement':
      return `movement allowed for ${nl}`;
    default:
      return `update (${type}) on ${nl}`;
  }
}

/**
 * Stable key for grouping: same key → same English template; targets are merged into one phrase.
 * @param {string} type
 * @param {object} row
 */
function groupKeyForRow(type, row) {
  if (NUMERIC_AMOUNT_TYPES.has(type)) {
    const n = Math.max(0, Math.floor(Number(row.amount)) || 0);
    return `${type}:${n}`;
  }
  switch (type) {
    case 'addCondition':
    case 'removeCondition':
      return `${type}:${String(row.condition ?? '').trim()}`;
    case 'clearFeatureUsageKey':
      return `${type}:${String(row.featureKey ?? '').trim()}`;
    case 'appendActiveModifier':
      return `${type}:${String(row.modifierName ?? '').trim()}:${String(row.modifierId ?? '').trim()}`;
    case 'removeActiveModifier':
      return `${type}:${String(row.modifierId ?? '').trim()}`;
    case 'addExperienceBonus':
      return `${type}:${String(row.experienceId ?? '').trim()}:${Math.max(0, Math.floor(Number(row.amount)) || 0)}`;
    case 'setRangerFocusOnNextAttack':
      return `${type}:${row.value === true ? '1' : '0'}`;
    case 'setFocusedBy':
      return `${type}:${String(row.focusedBy ?? '').trim()}`;
    case 'setFocusTarget':
      return `${type}:${String(row.focusTargetInstanceId ?? '').trim()}`;
    case 'setPrayerDicePool':
      return `${type}:pool`;
    case 'removePrayerDieAt':
      return `${type}:${Math.floor(Number(row.index)) || 0}`;
    default:
      return `${type}`;
  }
}

function displayNameForId(els, id) {
  const el = els.find((e) => (e.instanceId ?? e.id) === id);
  return (el?.name && String(el.name).trim()) || id;
}

/**
 * @param {object[]} mutations — engine output (before optional synthetic `actionLoop` append)
 * @param {string} ownerInstanceId — character who owns / used the feature (e.g. card chip owner)
 * @param {object[]} activeElements
 * @returns {{
 *   otherPartyIds: string[],
 *   otherPartyNames: string[],
 *   affectedSummary: string,
 * }}
 */
export function inferAffectedPartiesFromV2Mutations(mutations, ownerInstanceId, activeElements) {
  const els = Array.isArray(activeElements) ? activeElements : [];
  const ownerKey = resolveCanonicalInstanceId(ownerInstanceId, els);
  if (!ownerKey) {
    return { otherPartyIds: [], otherPartyNames: [], affectedSummary: '' };
  }

  const effectiveNumeric = accumulateOtherPartyEffectiveNumericDeltas(els, mutations, ownerInstanceId);

  /** @type {Map<string, { type: string, targetId: string, amount?: number, condition?: string, featureKey?: string, modifierName?: string, modifierId?: string, experienceId?: string, focusTargetInstanceId?: string, focusedBy?: string, value?: boolean, index?: number }>} */
  const rowByTargetType = new Map();

  for (const [effKey, total] of effectiveNumeric.entries()) {
    if (total <= 0) continue;
    const sep = effKey.lastIndexOf('\0');
    if (sep <= 0) continue;
    const canon = effKey.slice(0, sep);
    const type = effKey.slice(sep + 1);
    if (!NUMERIC_AMOUNT_TYPES.has(type)) continue;
    rowByTargetType.set(effKey, { type, targetId: canon, amount: total });
  }

  for (const m of mutations || []) {
    if (!m?.type || !m?.payload || typeof m.payload !== 'object') continue;
    if (!INSTANCE_TARGETING_MUTATION_TYPES.has(m.type)) continue;

    const { type, payload } = m;
    const rawId = payload.instanceId;
    if (rawId == null || rawId === '') continue;

    const canon = resolveCanonicalInstanceId(rawId, els);
    if (!canon || canon === ownerKey) continue;

    const el = els.find((e) => (e.instanceId ?? e.id) === canon);
    if (!el || el.elementType !== 'character') continue;

    if (type === 'runtimeStatMod' && payload.stat === 'difficulty') {
      continue;
    }

    if (NUMERIC_AMOUNT_TYPES.has(type)) {
      continue;
    }

    const mergeKey = `${canon}\0${type}`;

    if (type === 'appendActiveModifier') {
      const mod = payload.modifier || {};
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        modifierName: mod.name != null ? String(mod.name) : '',
        modifierId: mod.id != null ? String(mod.id) : '',
      });
      continue;
    }

    if (type === 'removeActiveModifier') {
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        modifierId: payload.id != null ? String(payload.id) : '',
      });
      continue;
    }

    if (type === 'addCondition' || type === 'removeCondition') {
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        condition: payload.condition != null ? String(payload.condition) : '',
      });
      continue;
    }

    if (type === 'clearFeatureUsageKey') {
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        featureKey: payload.featureKey != null ? String(payload.featureKey) : '',
      });
      continue;
    }

    if (type === 'addExperienceBonus') {
      const expId = payload.experienceId != null ? String(payload.experienceId) : '';
      const expMergeKey = `${canon}\0${type}\0${expId}`;
      const addAmt = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const prev = rowByTargetType.get(expMergeKey);
      if (prev) {
        prev.amount = (prev.amount ?? 0) + addAmt;
      } else {
        rowByTargetType.set(expMergeKey, {
          type,
          targetId: canon,
          experienceId: expId,
          amount: addAmt,
        });
      }
      continue;
    }

    if (type === 'setFocusTarget') {
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        focusTargetInstanceId:
          payload.focusTargetInstanceId != null ? String(payload.focusTargetInstanceId) : '',
      });
      continue;
    }

    if (type === 'setFocusedBy') {
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        focusedBy: payload.focusedBy != null ? String(payload.focusedBy) : '',
      });
      continue;
    }

    if (type === 'setRangerFocusOnNextAttack') {
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        value: payload.value === true,
      });
      continue;
    }

    if (type === 'removePrayerDieAt') {
      rowByTargetType.set(mergeKey, {
        type,
        targetId: canon,
        index: Math.floor(Number(payload.index)) || 0,
      });
      continue;
    }

    rowByTargetType.set(mergeKey, { type, targetId: canon });
  }

  const rows = [...rowByTargetType.values()];
  const otherIds = new Set(rows.map((r) => r.targetId));
  const otherPartyIds = [...otherIds].sort((a, b) =>
    displayNameForId(els, a).localeCompare(displayNameForId(els, b), undefined, { sensitivity: 'base' })
  );
  const otherPartyNames = otherPartyIds.map((id) => displayNameForId(els, id));

  /** @type {Map<string, { type: string, row: object, targetIds: Set<string> }>} */
  const groups = new Map();

  for (const row of rows) {
    const gk = groupKeyForRow(row.type, row);
    const key = `${row.type}\0${gk}`;
    let g = groups.get(key);
    if (!g) {
      g = { type: row.type, row, targetIds: new Set() };
      groups.set(key, g);
    }
    g.targetIds.add(row.targetId);
  }

  const phrases = [];
  const sortedGroupKeys = [...groups.keys()].sort();
  for (const gk of sortedGroupKeys) {
    const g = groups.get(gk);
    const namesSorted = [...g.targetIds].sort((a, b) =>
      displayNameForId(els, a).localeCompare(displayNameForId(els, b), undefined, { sensitivity: 'base' })
    );
    const nameLabels = namesSorted.map((id) => displayNameForId(els, id));
    const phrase = formatMutationGroupPhrase(g.type, g.row, nameLabels, els);
    if (phrase) phrases.push(phrase);
  }

  const affectedSummary = phrases.length > 0 ? `Also affected: ${phrases.join('; ')}` : '';

  return { otherPartyIds, otherPartyNames, affectedSummary };
}
